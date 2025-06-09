import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager } from '../browser/manager.js';
import { NavigateParams } from '../types/index.js';
import { logger, ALLOWED_PROTOCOLS, BLOCKED_DOMAINS } from '../config/environment.js';

export class NavigationTool {
  constructor(private browserManager: BrowserManager) {}

  getTool(): Tool {
    return {
      name: 'puppeteer_navigate',
      description: 'Navigate to a URL and return the page title and content length',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to'
          },
          timeout: {
            type: 'number',
            description: 'Navigation timeout in milliseconds (default: 30000)',
            minimum: 1000,
            maximum: 60000
          }
        },
        required: ['url']
      }
    };
  }

  async execute(params: unknown): Promise<any> {
    const validatedParams = NavigateParams.parse(params);
    const { url, timeout } = validatedParams;

    // Security checks
    this.validateUrl(url);

    logger.info(`Navigating to URL: ${url}`);

    const page = await this.browserManager.acquirePage();

    try {
      // Set CSP headers
      await page.setExtraHTTPHeaders({
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block'
      });

      // Navigate to the page
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout
      });

      if (!response) {
        throw new Error('Navigation failed - no response received');
      }

      const status = response.status();
      if (status >= 400) {
        throw new Error(`Navigation failed with status ${status}`);
      }

      // Get page information
      const title = await page.title();
      const content = await page.content();
      const contentLength = content.length;

      // Get page metrics
      const metrics = await page.metrics();

      logger.info(`Successfully navigated to ${url}`);

      return {
        success: true,
        url: page.url(),
        title,
        contentLength,
        status,
        metrics: {
          domContentLoaded: metrics.DOMContentLoaded,
          loadComplete: metrics.Load,
          documentCount: metrics.Documents,
          frameCount: metrics.Frames,
          jsHeapUsed: metrics.JSHeapUsedSize
        }
      };

    } catch (error) {
      logger.error(`Navigation failed for ${url}:`, error);
      throw new Error(`Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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