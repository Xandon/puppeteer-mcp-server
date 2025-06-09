import winston from 'winston';
import { BrowserManagerOptions, RateLimitConfig } from '../types/index.js';

// Environment variables
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const PUPPETEER_TIMEOUT = parseInt(process.env.PUPPETEER_TIMEOUT || '30000', 10);
export const MAX_CONCURRENT_PAGES = parseInt(process.env.MAX_CONCURRENT_PAGES || '5', 10);
export const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
export const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH;

// Logger configuration
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'puppeteer-mcp-server' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transport in production
if (NODE_ENV === 'production') {
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error' 
  }));
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log' 
  }));
}

// Browser manager configuration
export const browserConfig: BrowserManagerOptions = {
  maxConcurrentPages: MAX_CONCURRENT_PAGES,
  defaultTimeout: PUPPETEER_TIMEOUT,
  headless: NODE_ENV === 'production',
  executablePath: PUPPETEER_EXECUTABLE_PATH
};

// Rate limiting configuration
export const rateLimitConfig: RateLimitConfig = {
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_REQUESTS
};

// Security configurations
export const ALLOWED_PROTOCOLS = ['http:', 'https:'];
export const BLOCKED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1'
];

// CSP Headers
export const CSP_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'none'; object-src 'none';",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block'
};