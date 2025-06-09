import { Page, Browser, BrowserContext } from 'puppeteer';

interface PageContext {
  page: Page;
  context: BrowserContext;
  eventHandlers: Map<string, Function>;
  setupComplete: boolean;
}

/**
 * Manages the lifecycle of Puppeteer pages
 */
export class PageLifecycleManager {
  private pageContexts: Map<Page, PageContext> = new Map();
  private defaultTimeout = 30000; // 30 seconds

  /**
   * Set up a page with proper lifecycle management
   */
  async setupPage(page: Page): Promise<void> {
    if (this.pageContexts.has(page)) {
      return; // Already set up
    }

    const context = page.browserContext();
    const eventHandlers = new Map<string, Function>();

    // Set default navigation timeout
    page.setDefaultNavigationTimeout(this.defaultTimeout);
    page.setDefaultTimeout(this.defaultTimeout);

    // Set up request interception for better control
    await page.setRequestInterception(true);

    // Request handler
    const requestHandler = (request: any) => {
      // Block unnecessary resources to improve performance
      const blockedResourceTypes = ['font', 'media'];
      if (blockedResourceTypes.includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    };
    page.on('request', requestHandler);
    eventHandlers.set('request', requestHandler);

    // Response handler
    const responseHandler = (response: any) => {
      if (!response.ok() && response.status() >= 400) {
        console.warn(`HTTP ${response.status()} error for ${response.url()}`);
      }
    };
    page.on('response', responseHandler);
    eventHandlers.set('response', responseHandler);

    // Console handler
    const consoleHandler = (msg: any) => {
      const type = msg.type();
      if (type === 'error') {
        console.error('Page console error:', msg.text());
      }
    };
    page.on('console', consoleHandler);
    eventHandlers.set('console', consoleHandler);

    // Dialog handler
    const dialogHandler = async (dialog: any) => {
      console.log(`Dialog ${dialog.type()}: ${dialog.message()}`);
      await dialog.dismiss();
    };
    page.on('dialog', dialogHandler);
    eventHandlers.set('dialog', dialogHandler);

    // Frame handlers for better navigation tracking
    const frameNavigatedHandler = (frame: any) => {
      if (frame === page.mainFrame()) {
        console.log('Main frame navigated to:', frame.url());
      }
    };
    page.on('framenavigated', frameNavigatedHandler);
    eventHandlers.set('framenavigated', frameNavigatedHandler);

    // Store context
    this.pageContexts.set(page, {
      page,
      context,
      eventHandlers,
      setupComplete: true
    });
  }

  /**
   * Create a new isolated page in a fresh context
   */
  async createIsolatedPage(browser: Browser): Promise<Page> {
    // Create new incognito context for isolation
    const context = await browser.createIncognitoBrowserContext();
    
    // Set permissions
    await context.overridePermissions('https://example.com', []);

    // Create page in isolated context
    const page = await context.newPage();

    // Set up the page
    await this.setupPage(page);

    return page;
  }

  /**
   * Dispose of a page and its context
   */
  async disposePage(page: Page): Promise<void> {
    const pageContext = this.pageContexts.get(page);
    if (!pageContext) {
      // Page not managed, just close it
      if (!page.isClosed()) {
        await page.close();
      }
      return;
    }

    try {
      // Remove all event listeners
      for (const [event, handler] of pageContext.eventHandlers) {
        page.removeListener(event, handler as any);
      }

      // Close the page
      if (!page.isClosed()) {
        await page.close();
      }

      // If this was an isolated context, close it
      if (pageContext.context.isIncognito()) {
        await pageContext.context.close();
      }
    } catch (error) {
      console.error('Error disposing page:', error);
    } finally {
      // Remove from tracking
      this.pageContexts.delete(page);
    }
  }

  /**
   * Set up navigation handling with proper error recovery
   */
  async setupNavigation(page: Page, url: string, options?: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
    timeout?: number;
  }): Promise<void> {
    const pageContext = this.pageContexts.get(page);
    if (!pageContext || !pageContext.setupComplete) {
      throw new Error('Page not properly set up');
    }

    const navigationOptions = {
      waitUntil: options?.waitUntil || 'networkidle2',
      timeout: options?.timeout || this.defaultTimeout
    };

    try {
      await page.goto(url, navigationOptions as any);
    } catch (error) {
      console.error('Navigation error:', error);
      
      // Try recovery with simpler options
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: navigationOptions.timeout
        });
      } catch (retryError) {
        throw new Error(`Failed to navigate to ${url}: ${(retryError as Error).message}`);
      }
    }
  }

  /**
   * Execute a function in the page context with error handling
   */
  async executeInContext<T>(
    page: Page, 
    fn: Function, 
    ...args: any[]
  ): Promise<T> {
    const pageContext = this.pageContexts.get(page);
    if (!pageContext || !pageContext.setupComplete) {
      throw new Error('Page not properly set up');
    }

    try {
      return await page.evaluate(fn, ...args);
    } catch (error) {
      console.error('Error executing in page context:', error);
      throw new Error(`Failed to execute in page context: ${(error as Error).message}`);
    }
  }

  /**
   * Wait for a selector with proper error handling
   */
  async waitForElement(
    page: Page, 
    selector: string, 
    options?: {
      visible?: boolean;
      hidden?: boolean;
      timeout?: number;
    }
  ): Promise<void> {
    const pageContext = this.pageContexts.get(page);
    if (!pageContext || !pageContext.setupComplete) {
      throw new Error('Page not properly set up');
    }

    try {
      await page.waitForSelector(selector, {
        visible: options?.visible,
        hidden: options?.hidden,
        timeout: options?.timeout || this.defaultTimeout
      });
    } catch (error) {
      throw new Error(`Element "${selector}" not found: ${(error as Error).message}`);
    }
  }

  /**
   * Take a screenshot with error handling
   */
  async screenshot(
    page: Page, 
    options?: {
      path?: string;
      fullPage?: boolean;
      clip?: { x: number; y: number; width: number; height: number };
    }
  ): Promise<Buffer> {
    const pageContext = this.pageContexts.get(page);
    if (!pageContext || !pageContext.setupComplete) {
      throw new Error('Page not properly set up');
    }

    try {
      return await page.screenshot({
        path: options?.path,
        fullPage: options?.fullPage,
        clip: options?.clip
      }) as Buffer;
    } catch (error) {
      throw new Error(`Failed to take screenshot: ${(error as Error).message}`);
    }
  }

  /**
   * Cleanup all managed pages
   */
  async cleanup(): Promise<void> {
    const pages = Array.from(this.pageContexts.keys());
    
    for (const page of pages) {
      await this.disposePage(page);
    }

    this.pageContexts.clear();
  }

  /**
   * Get metrics about managed pages
   */
  getMetrics(): {
    totalPages: number;
    isolatedContexts: number;
  } {
    let isolatedContexts = 0;
    
    for (const context of this.pageContexts.values()) {
      if (context.context.isIncognito()) {
        isolatedContexts++;
      }
    }

    return {
      totalPages: this.pageContexts.size,
      isolatedContexts
    };
  }
}