import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager } from '../browser/manager.js';
import { EvaluateParams } from '../types/index.js';
import { logger } from '../config/environment.js';

export class JavaScriptTool {
  constructor(private browserManager: BrowserManager) {}

  getTool(): Tool {
    return {
      name: 'puppeteer_evaluate',
      description: 'Execute JavaScript code in the browser context',
      inputSchema: {
        type: 'object',
        properties: {
          script: {
            type: 'string',
            description: 'JavaScript code to execute in the page context'
          },
          timeout: {
            type: 'number',
            description: 'Execution timeout in milliseconds (default: 30000)',
            minimum: 1000,
            maximum: 60000
          }
        },
        required: ['script']
      }
    };
  }

  async execute(params: unknown): Promise<any> {
    const validatedParams = EvaluateParams.parse(params);
    const { script, timeout } = validatedParams;

    // Basic security checks
    this.validateScript(script);

    logger.info('Executing JavaScript in browser context');

    const page = await this.browserManager.acquirePage();

    try {
      // Create a sandboxed execution context
      const executionContext = await page.createIsolatedWorld('puppeteer-sandbox');

      // Set up timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Script execution timeout')), timeout);
      });

      // Execute the script
      const resultPromise = executionContext.evaluate((scriptToRun) => {
        try {
          // Wrap in function to prevent direct global access
          const fn = new Function('return (' + scriptToRun + ')');
          const result = fn();
          
          // Try to serialize the result
          if (result === undefined) {
            return { type: 'undefined' };
          } else if (result === null) {
            return { type: 'null' };
          } else if (typeof result === 'function') {
            return { type: 'function', value: result.toString() };
          } else if (result instanceof Error) {
            return { type: 'error', message: result.message, stack: result.stack };
          } else if (result instanceof Date) {
            return { type: 'date', value: result.toISOString() };
          } else if (result instanceof RegExp) {
            return { type: 'regexp', value: result.toString() };
          } else if (typeof result === 'symbol') {
            return { type: 'symbol', value: result.toString() };
          } else if (typeof result === 'bigint') {
            return { type: 'bigint', value: result.toString() };
          } else {
            // For objects and primitives, attempt JSON serialization
            try {
              return { type: typeof result, value: JSON.parse(JSON.stringify(result)) };
            } catch (e) {
              return { type: 'object', value: Object.prototype.toString.call(result) };
            }
          }
        } catch (error) {
          return {
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          };
        }
      }, script);

      // Race between execution and timeout
      const result = await Promise.race([resultPromise, timeoutPromise]);

      logger.info('JavaScript execution completed successfully');

      return {
        success: true,
        result,
        executionTime: Date.now(),
        pageUrl: page.url()
      };

    } catch (error) {
      logger.error('JavaScript execution failed:', error);
      throw new Error(`Script execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await this.browserManager.releasePage(page);
    }
  }

  private validateScript(script: string): void {
    // Basic validation to prevent obvious malicious patterns
    const dangerous = [
      'require(',
      'import(',
      'process.',
      '__dirname',
      '__filename',
      'child_process',
      'fs.',
      'fs/',
      'eval(',
      'Function(',
      'setTimeout(',
      'setInterval(',
      'setImmediate('
    ];

    const scriptLower = script.toLowerCase();
    for (const pattern of dangerous) {
      if (scriptLower.includes(pattern.toLowerCase())) {
        throw new Error(`Script contains potentially dangerous pattern: ${pattern}`);
      }
    }

    // Check script length
    if (script.length > 100000) {
      throw new Error('Script is too long (max 100KB)');
    }

    // Check for basic syntax errors
    try {
      new Function(script);
    } catch (error) {
      throw new Error(`Script syntax error: ${error instanceof Error ? error.message : 'Invalid syntax'}`);
    }
  }
}