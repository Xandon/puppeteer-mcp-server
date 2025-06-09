#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PuppeteerMcpServer } from './server.js';
import { logger } from './config/environment.js';

async function main() {
  try {
    logger.info('Starting Puppeteer MCP Server...');

    const server = new PuppeteerMcpServer();
    const mcpServer = new McpServer(
      { 
        name: 'puppeteer-automation',
        version: '1.0.0',
        description: 'MCP server for browser automation with Puppeteer'
      },
      {
        capabilities: {
          tools: true,
          resources: true,
          prompts: false
        },
        tools: server.getTools(),
        resources: server.getResources()
      }
    );

    const transport = new StdioServerTransport();
    
    // Set up graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down server...');
      await server.cleanup();
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
    await mcpServer.connect(transport);
    
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