#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import puppeteer from 'puppeteer';

console.log('Starting Puppeteer MCP Server...');

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

// Simple tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.log('Tool call received:', request.params);
  
  if (request.params.name === 'test_browser') {
    try {
      const url = request.params.arguments?.url || 'https://example.com';
      
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
      
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });
      const title = await page.title();
      await browser.close();
      
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
          text: `Browser test failed: ${error.message}`
        }]
      };
    }
  }
  
  throw new Error(`Unknown tool: ${request.params.name}`);
});

const transport = new StdioServerTransport();

// Connect and run
try {
  await server.connect(transport);
  console.log('Puppeteer MCP Server started successfully');
  
  // Keep alive
  setInterval(() => {
    console.log('Server heartbeat:', new Date().toISOString());
  }, 30000);
  
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}