import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from '../config/environment.js';

export class ScreenshotResource {
  private screenshotDir = 'downloads';

  getResource(): Resource {
    return {
      uri: 'screenshot://list',
      name: 'Screenshots',
      description: 'Access saved screenshots from browser automation'
    };
  }

  async get(uri: string): Promise<any> {
    logger.info(`Retrieving resource: ${uri}`);

    try {
      if (uri === 'screenshot://list') {
        return await this.listScreenshots();
      } else if (uri.startsWith('screenshot://file/')) {
        const filename = uri.replace('screenshot://file/', '');
        return await this.getScreenshot(filename);
      } else {
        throw new Error(`Unknown screenshot resource URI: ${uri}`);
      }
    } catch (error) {
      logger.error(`Failed to retrieve screenshot resource ${uri}:`, error);
      throw error;
    }
  }

  private async listScreenshots(): Promise<any> {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
      const files = await fs.readdir(this.screenshotDir);
      
      const screenshots = [];
      for (const file of files) {
        if (file.endsWith('.png')) {
          try {
            const filepath = join(this.screenshotDir, file);
            const stats = await fs.stat(filepath);
            screenshots.push({
              filename: file,
              uri: `screenshot://file/${file}`,
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime
            });
          } catch (error) {
            logger.warn(`Failed to stat screenshot file ${file}:`, error);
          }
        }
      }

      // Sort by creation time, newest first
      screenshots.sort((a, b) => b.created.getTime() - a.created.getTime());

      return {
        mimeType: 'application/json',
        text: JSON.stringify({
          count: screenshots.length,
          screenshots
        }, null, 2)
      };

    } catch (error) {
      logger.error('Failed to list screenshots:', error);
      throw new Error('Failed to list screenshots');
    }
  }

  private async getScreenshot(filename: string): Promise<any> {
    // Validate filename to prevent path traversal
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new Error('Invalid filename');
    }

    if (!filename.endsWith('.png')) {
      throw new Error('Only PNG screenshots are supported');
    }

    try {
      const filepath = join(this.screenshotDir, filename);
      
      // Check if file exists
      await fs.access(filepath);
      
      // Read the file
      const data = await fs.readFile(filepath);
      
      // Get file stats
      const stats = await fs.stat(filepath);
      
      return {
        mimeType: 'image/png',
        blob: data,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };

    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`Screenshot not found: ${filename}`);
      }
      logger.error(`Failed to get screenshot ${filename}:`, error);
      throw new Error('Failed to retrieve screenshot');
    }
  }

  async cleanup(): Promise<void> {
    try {
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      const now = Date.now();
      
      await fs.mkdir(this.screenshotDir, { recursive: true });
      const files = await fs.readdir(this.screenshotDir);
      
      for (const file of files) {
        if (file.endsWith('.png')) {
          try {
            const filepath = join(this.screenshotDir, file);
            const stats = await fs.stat(filepath);
            
            if (now - stats.birthtime.getTime() > maxAge) {
              await fs.unlink(filepath);
              logger.info(`Cleaned up old screenshot: ${file}`);
            }
          } catch (error) {
            logger.warn(`Failed to cleanup screenshot ${file}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup screenshots:', error);
    }
  }
}