#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './config/environment.js';
import { BrowserManager } from './browser/manager.js';
import { NavigationTool } from './tools/navigation.js';
import { ScreenshotTool } from './tools/screenshots.js';

async function main() {
  try {
    logger.info('Starting Puppeteer MCP Server...');

    const browserManager = BrowserManager.getInstance();
    const navigationTool = new NavigationTool(browserManager);
    const screenshotTool = new ScreenshotTool(browserManager);

    const server = new Server(
      { 
        name: 'puppeteer-automation',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );

    // Set up tool handlers
    server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          navigationTool.getTool(),
          screenshotTool.getTool()
        ]
      };
    });

    server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case 'puppeteer_navigate':
          return await navigationTool.execute(args);
        case 'puppeteer_screenshot':
          return await screenshotTool.execute(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    const transport = new StdioServerTransport();
    
    // Set up graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down server...');
      await browserManager.cleanup();
      await transport.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      shutdown();
    });

    // Connect server to transport
    await server.connect(transport);
    
    logger.info('Puppeteer MCP Server started successfully');
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});