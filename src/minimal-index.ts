#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BrowserManager } from './browser/manager.js';
import { logger } from './config/environment.js';

async function main() {
  logger.info('Starting Puppeteer MCP Server...');

  const server = new Server(
    { 
      name: 'puppeteer-automation',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  const browserManager = BrowserManager.getInstance();

  // Simple tool that tests browser functionality
  server.setRequestHandler('tools/list', async () => {
    return {
      tools: [{
        name: 'test_browser',
        description: 'Test browser automation functionality',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to test navigation',
              default: 'https://example.com'
            }
          }
        }
      }]
    };
  });

  server.setRequestHandler('tools/call', async (request: any) => {
    if (request.params.name === 'test_browser') {
      try {
        const url = request.params.arguments?.url || 'https://example.com';
        
        const page = await browserManager.acquirePage();
        await page.goto(url, { waitUntil: 'networkidle2' });
        const title = await page.title();
        await browserManager.releasePage(page);
        
        return {
          content: [{
            type: 'text',
            text: `Successfully navigated to ${url}. Page title: ${title}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Browser test failed: ${error}`
          }]
        };
      }
    }
    
    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  const transport = new StdioServerTransport();
  
  // Set up graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down server...');
    await browserManager.cleanup();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Connect server to transport
  await server.connect(transport);
  logger.info('Puppeteer MCP Server started successfully');
}

main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});