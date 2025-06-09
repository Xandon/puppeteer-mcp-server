import { Tool, Resource } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager } from './browser/manager.js';
import { NavigationTool } from './tools/navigation.js';
import { InteractionTools } from './tools/interaction.js';
import { ScreenshotTool } from './tools/screenshots.js';
import { JavaScriptTool } from './tools/javascript.js';
import { ScreenshotResource } from './resources/screenshots.js';
import { ConsoleLogResource } from './resources/console-logs.js';
import { logger, rateLimitConfig } from './config/environment.js';

export class PuppeteerMcpServer {
  private browserManager: BrowserManager;
  private navigationTool: NavigationTool;
  private interactionTools: InteractionTools;
  private screenshotTool: ScreenshotTool;
  private javascriptTool: JavaScriptTool;
  private screenshotResource: ScreenshotResource;
  private consoleLogResource: ConsoleLogResource;
  private requestCounts: Map<string, { count: number; resetTime: number }>;

  constructor() {
    this.browserManager = BrowserManager.getInstance();
    this.navigationTool = new NavigationTool(this.browserManager);
    this.interactionTools = new InteractionTools(this.browserManager);
    this.screenshotTool = new ScreenshotTool(this.browserManager);
    this.javascriptTool = new JavaScriptTool(this.browserManager);
    this.screenshotResource = new ScreenshotResource();
    this.consoleLogResource = new ConsoleLogResource();
    this.requestCounts = new Map();
  }

  getTools(): Tool[] {
    return [
      this.navigationTool.getTool(),
      ...this.interactionTools.getTools(),
      this.screenshotTool.getTool(),
      this.javascriptTool.getTool()
    ];
  }

  getResources(): Resource[] {
    return [
      this.screenshotResource.getResource(),
      this.consoleLogResource.getResource()
    ];
  }

  private checkRateLimit(clientId: string = 'default'): boolean {
    const now = Date.now();
    const clientData = this.requestCounts.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      this.requestCounts.set(clientId, {
        count: 1,
        resetTime: now + rateLimitConfig.windowMs
      });
      return true;
    }

    if (clientData.count >= rateLimitConfig.maxRequests) {
      logger.warn(`Rate limit exceeded for client: ${clientId}`);
      return false;
    }

    clientData.count++;
    return true;
  }

  async handleToolCall(name: string, args: any): Promise<any> {
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    logger.info(`Handling tool call: ${name}`, { args });

    try {
      switch (name) {
        case 'puppeteer_navigate':
          return await this.navigationTool.execute(args);
        case 'puppeteer_click':
        case 'puppeteer_fill':
        case 'puppeteer_select':
          return await this.interactionTools.execute(name, args);
        case 'puppeteer_screenshot':
          return await this.screenshotTool.execute(args);
        case 'puppeteer_evaluate':
          return await this.javascriptTool.execute(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Tool execution failed: ${name}`, error);
      throw error;
    }
  }

  async handleResourceCall(uri: string): Promise<any> {
    logger.info(`Handling resource call: ${uri}`);

    try {
      if (uri.startsWith('screenshot://')) {
        return await this.screenshotResource.get(uri);
      } else if (uri.startsWith('console://')) {
        return await this.consoleLogResource.get(uri);
      } else {
        throw new Error(`Unknown resource URI: ${uri}`);
      }
    } catch (error) {
      logger.error(`Resource retrieval failed: ${uri}`, error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up server resources...');
    await this.browserManager.cleanup();
    this.requestCounts.clear();
  }
}