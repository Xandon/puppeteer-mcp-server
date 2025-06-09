import { Browser, Page } from 'puppeteer';

interface PageSession {
  page: Page;
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  isActive: boolean;
}

/**
 * Connection pool for managing Puppeteer page instances
 */
export class PagePool {
  private browser: Browser;
  private maxPages: number;
  private sessions: Map<string, PageSession> = new Map();
  private availablePages: Page[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  constructor(browser: Browser, maxPages: number = 5) {
    this.browser = browser;
    this.maxPages = maxPages;
    this.startIdleCleanup();
  }

  /**
   * Acquire a page from the pool
   */
  async acquire(): Promise<Page> {
    // Try to get an available page
    let page = this.availablePages.pop();

    if (!page) {
      // Check if we can create a new page
      if (this.sessions.size < this.maxPages) {
        page = await this.createNewPage();
      } else {
        // Wait for a page to become available or force cleanup
        await this.forceCleanupOldestIdle();
        page = this.availablePages.pop() || await this.createNewPage();
      }
    }

    // Update session
    const sessionId = this.getPageId(page);
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = true;
      session.lastUsedAt = new Date();
    }

    return page;
  }

  /**
   * Release a page back to the pool
   */
  async release(page: Page): Promise<void> {
    const sessionId = this.getPageId(page);
    const session = this.sessions.get(sessionId);

    if (!session) {
      // Page not tracked, close it
      await this.closePage(page);
      return;
    }

    try {
      // Reset page state
      await this.resetPage(page);

      // Mark as available
      session.isActive = false;
      session.lastUsedAt = new Date();
      this.availablePages.push(page);
    } catch (error) {
      console.error('Error resetting page, closing it:', error);
      await this.closePage(page);
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Create a new page with error recovery
   */
  private async createNewPage(): Promise<Page> {
    try {
      const page = await this.browser.newPage();
      const sessionId = this.generateSessionId();

      // Set page viewport
      await page.setViewport({ width: 1280, height: 720 });

      // Set up error handling
      page.on('error', (error) => {
        console.error(`Page error for session ${sessionId}:`, error);
        this.handlePageError(sessionId);
      });

      page.on('pageerror', (error) => {
        console.error(`Page runtime error for session ${sessionId}:`, error);
      });

      // Track session
      this.sessions.set(sessionId, {
        page,
        id: sessionId,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        isActive: true
      });

      // Store session ID on page for tracking
      (page as any).__sessionId = sessionId;

      return page;
    } catch (error) {
      console.error('Failed to create new page:', error);
      throw new Error('Unable to create new page: ' + (error as Error).message);
    }
  }

  /**
   * Reset page to clean state
   */
  private async resetPage(page: Page): Promise<void> {
    try {
      // Navigate to blank page
      await page.goto('about:blank', { waitUntil: 'domcontentloaded' });

      // Clear cookies
      const client = await page.target().createCDPSession();
      await client.send('Network.clearBrowserCookies');
      await client.send('Network.clearBrowserCache');

      // Clear local storage and session storage
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Reset viewport
      await page.setViewport({ width: 1280, height: 720 });

      // Remove any extra tabs/windows
      const pages = await this.browser.pages();
      for (const p of pages) {
        if (p !== page && this.getPageId(p) === this.getPageId(page)) {
          await p.close();
        }
      }
    } catch (error) {
      console.error('Error resetting page:', error);
      throw error;
    }
  }

  /**
   * Close a page safely
   */
  private async closePage(page: Page): Promise<void> {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch (error) {
      console.error('Error closing page:', error);
    }
  }

  /**
   * Handle page errors with recovery
   */
  private async handlePageError(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      // Remove from available pages
      this.availablePages = this.availablePages.filter(p => 
        this.getPageId(p) !== sessionId
      );

      // Close the errored page
      await this.closePage(session.page);

      // Remove session
      this.sessions.delete(sessionId);

      // Try to create a replacement if we're below capacity
      if (this.sessions.size < this.maxPages) {
        try {
          const newPage = await this.createNewPage();
          this.availablePages.push(newPage);
        } catch (error) {
          console.error('Failed to create replacement page:', error);
        }
      }
    } catch (error) {
      console.error('Error handling page error:', error);
    }
  }

  /**
   * Start cleanup interval for idle pages
   */
  private startIdleCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdlePages();
    }, 60000); // Check every minute
  }

  /**
   * Cleanup idle pages
   */
  private async cleanupIdlePages(): Promise<void> {
    const now = new Date();
    const sessionsToRemove: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (!session.isActive && 
          now.getTime() - session.lastUsedAt.getTime() > this.IDLE_TIMEOUT) {
        sessionsToRemove.push(sessionId);
      }
    }

    for (const sessionId of sessionsToRemove) {
      const session = this.sessions.get(sessionId);
      if (session) {
        await this.closePage(session.page);
        this.sessions.delete(sessionId);
        this.availablePages = this.availablePages.filter(p => 
          this.getPageId(p) !== sessionId
        );
      }
    }
  }

  /**
   * Force cleanup of the oldest idle page
   */
  private async forceCleanupOldestIdle(): Promise<void> {
    let oldestIdle: PageSession | null = null;

    for (const session of this.sessions.values()) {
      if (!session.isActive) {
        if (!oldestIdle || session.lastUsedAt < oldestIdle.lastUsedAt) {
          oldestIdle = session;
        }
      }
    }

    if (oldestIdle) {
      await this.closePage(oldestIdle.page);
      this.sessions.delete(oldestIdle.id);
      this.availablePages = this.availablePages.filter(p => 
        this.getPageId(p) !== oldestIdle.id
      );
    }
  }

  /**
   * Cleanup all pages
   */
  async cleanup(): Promise<void> {
    // Close all available pages
    for (const page of this.availablePages) {
      await this.closePage(page);
    }
    this.availablePages = [];

    // Close all tracked sessions
    for (const session of this.sessions.values()) {
      await this.closePage(session.page);
    }
    this.sessions.clear();
  }

  /**
   * Destroy the pool
   */
  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    await this.cleanup();
  }

  /**
   * Get the number of active pages
   */
  getActiveCount(): number {
    return Array.from(this.sessions.values()).filter(s => s.isActive).length;
  }

  /**
   * Get page ID
   */
  private getPageId(page: Page): string {
    return (page as any).__sessionId || '';
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}