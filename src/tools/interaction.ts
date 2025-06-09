import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager } from '../browser/manager.js';
import { ClickParams, FillParams, SelectParams } from '../types/index.js';
import { logger } from '../config/environment.js';

export class InteractionTools {
  constructor(private browserManager: BrowserManager) {}

  getTools(): Tool[] {
    return [
      this.getClickTool(),
      this.getFillTool(),
      this.getSelectTool()
    ];
  }

  private getClickTool(): Tool {
    return {
      name: 'puppeteer_click',
      description: 'Click on an element specified by a CSS selector',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to click'
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 5000)',
            minimum: 1000,
            maximum: 30000
          }
        },
        required: ['selector']
      }
    };
  }

  private getFillTool(): Tool {
    return {
      name: 'puppeteer_fill',
      description: 'Fill a form field with the specified value',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the form field'
          },
          value: {
            type: 'string',
            description: 'Value to fill in the field'
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 5000)',
            minimum: 1000,
            maximum: 30000
          }
        },
        required: ['selector', 'value']
      }
    };
  }

  private getSelectTool(): Tool {
    return {
      name: 'puppeteer_select',
      description: 'Select an option from a dropdown menu',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the select element'
          },
          value: {
            type: 'string',
            description: 'Value of the option to select'
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 5000)',
            minimum: 1000,
            maximum: 30000
          }
        },
        required: ['selector', 'value']
      }
    };
  }

  async execute(toolName: string, params: unknown): Promise<any> {
    switch (toolName) {
      case 'puppeteer_click':
        return await this.executeClick(params);
      case 'puppeteer_fill':
        return await this.executeFill(params);
      case 'puppeteer_select':
        return await this.executeSelect(params);
      default:
        throw new Error(`Unknown interaction tool: ${toolName}`);
    }
  }

  private async executeClick(params: unknown): Promise<any> {
    const validatedParams = ClickParams.parse(params);
    const { selector, timeout } = validatedParams;

    logger.info(`Clicking element: ${selector}`);

    const page = await this.browserManager.acquirePage();

    try {
      // Wait for element to be visible and clickable
      await page.waitForSelector(selector, {
        visible: true,
        timeout
      });

      // Scroll element into view
      await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, selector);

      // Small delay to ensure element is ready
      await page.waitForTimeout(100);

      // Click the element
      await page.click(selector);

      logger.info(`Successfully clicked element: ${selector}`);

      return {
        success: true,
        selector,
        action: 'click'
      };

    } catch (error) {
      logger.error(`Failed to click element ${selector}:`, error);
      throw new Error(`Failed to click element: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await this.browserManager.releasePage(page);
    }
  }

  private async executeFill(params: unknown): Promise<any> {
    const validatedParams = FillParams.parse(params);
    const { selector, value, timeout } = validatedParams;

    logger.info(`Filling form field: ${selector}`);

    const page = await this.browserManager.acquirePage();

    try {
      // Wait for element to be visible
      await page.waitForSelector(selector, {
        visible: true,
        timeout
      });

      // Clear existing value
      await page.evaluate((sel) => {
        const element = document.querySelector(sel) as HTMLInputElement;
        if (element) {
          element.value = '';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, selector);

      // Type the new value
      await page.type(selector, value, { delay: 50 });

      // Trigger change event
      await page.evaluate((sel) => {
        const element = document.querySelector(sel) as HTMLInputElement;
        if (element) {
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }, selector);

      logger.info(`Successfully filled form field: ${selector}`);

      return {
        success: true,
        selector,
        action: 'fill',
        value: value.substring(0, 50) + (value.length > 50 ? '...' : '')
      };

    } catch (error) {
      logger.error(`Failed to fill form field ${selector}:`, error);
      throw new Error(`Failed to fill form field: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await this.browserManager.releasePage(page);
    }
  }

  private async executeSelect(params: unknown): Promise<any> {
    const validatedParams = SelectParams.parse(params);
    const { selector, value, timeout } = validatedParams;

    logger.info(`Selecting option in: ${selector}`);

    const page = await this.browserManager.acquirePage();

    try {
      // Wait for select element to be visible
      await page.waitForSelector(selector, {
        visible: true,
        timeout
      });

      // Select the option
      await page.select(selector, value);

      // Trigger change event
      await page.evaluate((sel) => {
        const element = document.querySelector(sel) as HTMLSelectElement;
        if (element) {
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, selector);

      logger.info(`Successfully selected option in: ${selector}`);

      return {
        success: true,
        selector,
        action: 'select',
        value
      };

    } catch (error) {
      logger.error(`Failed to select option in ${selector}:`, error);
      throw new Error(`Failed to select option: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await this.browserManager.releasePage(page);
    }
  }
}