import puppeteer, { Browser, Page } from 'puppeteer';
import { logger } from '../config/environment.js';
import { getPuppeteerLaunchOptions } from '../config/puppeteer-options.js';

export class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private pages: Set<Page> = new Set();
  private maxPages = 5;

  private constructor() {}

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const options = getPuppeteerLaunchOptions(true);
      this.browser = await puppeteer.launch(options);
      logger.info('Browser launched');
    }
    return this.browser;
  }

  async acquirePage(): Promise<Page> {
    if (this.pages.size >= this.maxPages) {
      throw new Error('Maximum number of pages reached');
    }

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    this.pages.add(page);
    
    page.on('close', () => {
      this.pages.delete(page);
    });

    return page;
  }

  async releasePage(page: Page): Promise<void> {
    try {
      await page.close();
      this.pages.delete(page);
    } catch (error) {
      logger.error('Error closing page:', error);
    }
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up browser manager...');
    
    // Close all pages
    for (const page of this.pages) {
      try {
        await page.close();
      } catch (error) {
        logger.error('Error closing page during cleanup:', error);
      }
    }
    this.pages.clear();

    // Close browser
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        logger.info('Browser closed');
      } catch (error) {
        logger.error('Error closing browser:', error);
      }
    }
  }
}