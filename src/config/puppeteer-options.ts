import { PuppeteerLaunchOptions } from 'puppeteer';
import { PUPPETEER_EXECUTABLE_PATH } from './environment.js';

export const getPuppeteerLaunchOptions = (headless: boolean = true): PuppeteerLaunchOptions => {
  const options: PuppeteerLaunchOptions = {
    headless: headless,
    args: [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--no-first-run',
      '--disable-default-apps',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-breakpad',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=site-per-process',
      '--enable-features=NetworkService',
      '--allow-running-insecure-content',
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-trials',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    defaultViewport: {
      width: 1280,
      height: 720
    },
    ignoreHTTPSErrors: true,
    timeout: 30000
  };

  // Use custom executable path if provided
  if (PUPPETEER_EXECUTABLE_PATH) {
    options.executablePath = PUPPETEER_EXECUTABLE_PATH;
  }

  // Add additional args for Docker environment
  if (process.env.RUNNING_IN_DOCKER === 'true') {
    options.args!.push(
      '--disable-dev-shm-usage',
      '--shm-size=1gb'
    );
  }

  return options;
};

export const getPageOptions = () => {
  return {
    waitUntil: 'networkidle2' as const,
    timeout: 30000
  };
};