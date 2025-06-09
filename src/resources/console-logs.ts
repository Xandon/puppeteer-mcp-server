import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from '../config/environment.js';

interface ConsoleLogEntry {
  timestamp: string;
  level: string;
  message: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  stackTrace?: string;
}

export class ConsoleLogResource {
  private logDir = 'logs';
  private consoleLogsFile = 'console-logs.json';
  private logs: ConsoleLogEntry[] = [];
  private maxLogs = 1000;

  constructor() {
    this.ensureLogDir();
  }

  private async ensureLogDir(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create log directory:', error);
    }
  }

  getResource(): Resource {
    return {
      uri: 'console://logs',
      name: 'Console Logs',
      description: 'Browser console logs captured during automation'
    };
  }

  async get(uri: string): Promise<any> {
    logger.info(`Retrieving console logs: ${uri}`);

    try {
      if (uri === 'console://logs') {
        return await this.getLogs();
      } else if (uri === 'console://logs/recent') {
        return await this.getRecentLogs(50);
      } else if (uri === 'console://logs/errors') {
        return await this.getErrorLogs();
      } else {
        throw new Error(`Unknown console log resource URI: ${uri}`);
      }
    } catch (error) {
      logger.error(`Failed to retrieve console logs ${uri}:`, error);
      throw error;
    }
  }

  async addLog(entry: ConsoleLogEntry): Promise<void> {
    this.logs.unshift(entry);
    
    // Keep only the most recent logs in memory
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Persist to file asynchronously
    this.persistLogs().catch((error) => {
      logger.error('Failed to persist console logs:', error);
    });
  }

  private async getLogs(): Promise<any> {
    try {
      // Load logs from file if memory is empty
      if (this.logs.length === 0) {
        await this.loadLogs();
      }

      return {
        mimeType: 'application/json',
        text: JSON.stringify({
          count: this.logs.length,
          logs: this.logs,
          summary: this.generateSummary()
        }, null, 2)
      };
    } catch (error) {
      logger.error('Failed to get console logs:', error);
      throw new Error('Failed to retrieve console logs');
    }
  }

  private async getRecentLogs(limit: number): Promise<any> {
    try {
      if (this.logs.length === 0) {
        await this.loadLogs();
      }

      const recentLogs = this.logs.slice(0, limit);

      return {
        mimeType: 'application/json',
        text: JSON.stringify({
          count: recentLogs.length,
          logs: recentLogs,
          summary: this.generateSummary(recentLogs)
        }, null, 2)
      };
    } catch (error) {
      logger.error('Failed to get recent console logs:', error);
      throw new Error('Failed to retrieve recent console logs');
    }
  }

  private async getErrorLogs(): Promise<any> {
    try {
      if (this.logs.length === 0) {
        await this.loadLogs();
      }

      const errorLogs = this.logs.filter(log => 
        log.level === 'error' || log.level === 'warning'
      );

      return {
        mimeType: 'application/json',
        text: JSON.stringify({
          count: errorLogs.length,
          logs: errorLogs,
          summary: this.generateSummary(errorLogs)
        }, null, 2)
      };
    } catch (error) {
      logger.error('Failed to get error logs:', error);
      throw new Error('Failed to retrieve error logs');
    }
  }

  private generateSummary(logs: ConsoleLogEntry[] = this.logs): any {
    const summary = {
      total: logs.length,
      byLevel: {} as Record<string, number>,
      errors: 0,
      warnings: 0,
      timeRange: {
        earliest: null as string | null,
        latest: null as string | null
      }
    };

    for (const log of logs) {
      // Count by level
      summary.byLevel[log.level] = (summary.byLevel[log.level] || 0) + 1;
      
      // Count errors and warnings
      if (log.level === 'error') summary.errors++;
      if (log.level === 'warning') summary.warnings++;

      // Track time range
      if (!summary.timeRange.earliest || log.timestamp < summary.timeRange.earliest) {
        summary.timeRange.earliest = log.timestamp;
      }
      if (!summary.timeRange.latest || log.timestamp > summary.timeRange.latest) {
        summary.timeRange.latest = log.timestamp;
      }
    }

    return summary;
  }

  private async loadLogs(): Promise<void> {
    try {
      const filepath = join(this.logDir, this.consoleLogsFile);
      const data = await fs.readFile(filepath, 'utf-8');
      const parsedData = JSON.parse(data);
      
      if (Array.isArray(parsedData.logs)) {
        this.logs = parsedData.logs.slice(0, this.maxLogs);
      }
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error('Failed to load console logs:', error);
      }
      // If file doesn't exist or is invalid, start with empty logs
      this.logs = [];
    }
  }

  private async persistLogs(): Promise<void> {
    try {
      const filepath = join(this.logDir, this.consoleLogsFile);
      const data = {
        lastUpdated: new Date().toISOString(),
        count: this.logs.length,
        logs: this.logs
      };
      
      await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to persist console logs:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Keep only recent logs in memory
      this.logs = this.logs.slice(0, Math.floor(this.maxLogs / 2));
      
      // Persist the cleaned logs
      await this.persistLogs();
      
      logger.info('Console logs cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup console logs:', error);
    }
  }

  // Method to clear all logs
  async clearLogs(): Promise<void> {
    this.logs = [];
    try {
      const filepath = join(this.logDir, this.consoleLogsFile);
      await fs.unlink(filepath);
      logger.info('Console logs cleared');
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error('Failed to clear console logs:', error);
      }
    }
  }
}