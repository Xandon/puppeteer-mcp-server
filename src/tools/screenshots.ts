import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager } from '../browser/manager.js';
import { ScreenshotParams } from '../types/index.js';
import { logger, ALLOWED_PROTOCOLS, BLOCKED_DOMAINS } from '../config/environment.js';
import { promises as fs } from 'fs';
import { join } from 'path';

export class ScreenshotTool {
  private screenshotDir = 'downloads';

  constructor(private browserManager: BrowserManager) {
    this.ensureScreenshotDir();
  }

  private async ensureScreenshotDir(): Promise<void> {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create screenshot directory:', error);
    }
  }

  getTool(): Tool {
    return {
      name: 'puppeteer_screenshot',
      description: 'Take a screenshot of a webpage or specific element',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to screenshot'
          },
          selector: {
            type: 'string',
            description: 'CSS selector for specific element (optional)'
          },
          width: {
            type: 'number',
            description: 'Viewport width (default: 1280)',
            minimum: 320,
            maximum: 3840
          },
          height: {
            type: 'number',
            description: 'Viewport height (default: 720)',
            minimum: 240,
            maximum: 2160
          },
          fullPage: {
            type: 'boolean',
            description: 'Capture full page screenshot (default: false)'
          }
        },
        required: ['url']
      }
    };
  }

  async execute(params: unknown): Promise<any> {
    const validatedParams = ScreenshotParams.parse(params);
    const { url, selector, width, height, fullPage } = validatedParams;

    // Validate URL
    this.validateUrl(url);

    logger.info(`Taking screenshot of: ${url}`);

    const page = await this.browserManager.acquirePage();

    try {
      // Set viewport size
      await page.setViewport({ width, height });

      // Navigate to the page
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      if (!response) {
        throw new Error('Navigation failed - no response received');
      }

      const status = response.status();
      if (status >= 400) {
        throw new Error(`Navigation failed with status ${status}`);
      }

      // Wait a bit for any animations to complete
      await page.waitForTimeout(1000);

      let screenshotBuffer: Buffer;

      if (selector) {
        // Wait for the element to be visible
        await page.waitForSelector(selector, {
          visible: true,
          timeout: 5000
        });

        // Take screenshot of specific element
        const element = await page.$(selector);
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }

        // Scroll element into view
        await element.scrollIntoView();
        await page.waitForTimeout(500);

        screenshotBuffer = await element.screenshot({
          type: 'png',
          encoding: 'binary'
        }) as Buffer;

      } else {
        // Take full page or viewport screenshot
        screenshotBuffer = await page.screenshot({
          type: 'png',
          fullPage,
          encoding: 'binary'
        }) as Buffer;
      }

      // Convert to base64
      const base64Image = screenshotBuffer.toString('base64');

      // Save screenshot to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}.png`;
      const filepath = join(this.screenshotDir, filename);
      await fs.writeFile(filepath, screenshotBuffer);

      logger.info(`Screenshot saved to: ${filepath}`);

      return {
        success: true,
        url: page.url(),
        selector,
        filename,
        filepath,
        size: {
          width: selector ? undefined : (fullPage ? undefined : width),
          height: selector ? undefined : (fullPage ? undefined : height)
        },
        fullPage: !selector && fullPage,
        imageBase64: base64Image,
        imageSizeBytes: screenshotBuffer.length
      };

    } catch (error) {
      logger.error(`Screenshot failed for ${url}:`, error);
      throw new Error(`Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await this.browserManager.releasePage(page);
    }
  }

  private validateUrl(url: string): void {
    try {
      const urlObj = new URL(url);
      
      // Check protocol
      if (!ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
        throw new Error(`Protocol ${urlObj.protocol} is not allowed`);
      }

      // Check for blocked domains
      const hostname = urlObj.hostname.toLowerCase();
      if (BLOCKED_DOMAINS.some(blocked => hostname.includes(blocked))) {
        throw new Error(`Domain ${hostname} is blocked`);
      }

      // Check for javascript: or data: URLs
      if (url.toLowerCase().startsWith('javascript:') || url.toLowerCase().startsWith('data:')) {
        throw new Error('JavaScript and data URLs are not allowed');
      }

    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid URL format');
      }
      throw error;
    }
  }
}