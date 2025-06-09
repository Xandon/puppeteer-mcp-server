import { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';
import puppeteer from 'puppeteer';
import { getPuppeteerLaunchOptions } from '../config.js';
import { PagePool } from './connection.js';
import { PageLifecycleManager } from './lifecycle.js';

/**
 * Singleton browser manager for managing Puppeteer browser instances
 */
export class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private pagePool: PagePool | null = null;
  private lifecycleManager: PageLifecycleManager | null = null;
  private isShuttingDown = false;
  private memoryCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  /**
   * Get the singleton instance of BrowserManager
   */
  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  /**
   * Lazily initialize the browser instance
   */
  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      const options = getPuppeteerLaunchOptions();
      this.browser = await puppeteer.launch(options as PuppeteerLaunchOptions);
      
      // Set up browser event handlers
      this.browser.on('disconnected', () => {
        console.error('Browser disconnected unexpectedly');
        this.browser = null;
      });

      // Initialize page pool and lifecycle manager
      this.pagePool = new PagePool(this.browser, 5); // Max 5 concurrent pages
      this.lifecycleManager = new PageLifecycleManager();

      // Start memory monitoring
      this.startMemoryMonitoring();
    }

    return this.browser;
  }

  /**
   * Get a page from the pool
   */
  async getPage(): Promise<Page> {
    if (this.isShuttingDown) {
      throw new Error('BrowserManager is shutting down');
    }

    await this.ensureBrowser();
    
    if (!this.pagePool) {
      throw new Error('Page pool not initialized');
    }

    const page = await this.pagePool.acquire();
    
    if (!this.lifecycleManager) {
      throw new Error('Lifecycle manager not initialized');
    }

    // Set up page lifecycle management
    await this.lifecycleManager.setupPage(page);
    
    return page;
  }

  /**
   * Release a page back to the pool
   */
  async releasePage(page: Page): Promise<void> {
    if (!this.pagePool) {
      return;
    }

    try {
      await this.pagePool.release(page);
    } catch (error) {
      console.error('Error releasing page:', error);
    }
  }

  /**
   * Start monitoring memory usage
   */
  private startMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      return;
    }

    this.memoryCheckInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);

      console.log(`Memory usage - Heap: ${heapUsedMB}/${heapTotalMB} MB, RSS: ${rssMB} MB`);

      // If memory usage is too high, trigger cleanup
      if (heapUsedMB > 500) {
        console.warn('High memory usage detected, triggering cleanup');
        this.performMemoryCleanup();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Perform memory cleanup
   */
  private async performMemoryCleanup(): Promise<void> {
    if (this.pagePool) {
      await this.pagePool.cleanup();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Shutdown the browser manager and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    // Stop memory monitoring
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    // Cleanup page pool
    if (this.pagePool) {
      await this.pagePool.destroy();
      this.pagePool = null;
    }

    // Cleanup lifecycle manager
    if (this.lifecycleManager) {
      await this.lifecycleManager.cleanup();
      this.lifecycleManager = null;
    }

    // Close browser
    if (this.browser && this.browser.isConnected()) {
      await this.browser.close();
      this.browser = null;
    }

    this.isShuttingDown = false;
  }

  /**
   * Get browser metrics
   */
  async getMetrics(): Promise<{
    isConnected: boolean;
    pagesCount: number;
    memoryUsage: NodeJS.MemoryUsage;
  }> {
    const isConnected = this.browser?.isConnected() || false;
    const pagesCount = this.pagePool?.getActiveCount() || 0;
    const memoryUsage = process.memoryUsage();

    return {
      isConnected,
      pagesCount,
      memoryUsage
    };
  }
}

// Export singleton instance
export const browserManager = BrowserManager.getInstance();