import { z } from 'zod';

export const NavigateParams = z.object({
  url: z.string().url('Invalid URL format'),
  timeout: z.number().min(1000).max(60000).optional().default(30000)
});

export const ClickParams = z.object({
  selector: z.string().min(1),
  timeout: z.number().min(1000).max(30000).optional().default(5000)
});

export const FillParams = z.object({
  selector: z.string().min(1),
  value: z.string(),
  timeout: z.number().min(1000).max(30000).optional().default(5000)
});

export const SelectParams = z.object({
  selector: z.string().min(1),
  value: z.string(),
  timeout: z.number().min(1000).max(30000).optional().default(5000)
});

export const ScreenshotParams = z.object({
  url: z.string().url('Invalid URL format'),
  selector: z.string().optional(),
  width: z.number().min(320).max(3840).optional().default(1280),
  height: z.number().min(240).max(2160).optional().default(720),
  fullPage: z.boolean().optional().default(false)
});

export const EvaluateParams = z.object({
  script: z.string().min(1),
  timeout: z.number().min(1000).max(60000).optional().default(30000)
});

export interface BrowserManagerOptions {
  maxConcurrentPages: number;
  defaultTimeout: number;
  headless: boolean;
  executablePath?: string;
}

export interface PageSession {
  id: string;
  page: any;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export type ToolParams = 
  | z.infer<typeof NavigateParams>
  | z.infer<typeof ClickParams>
  | z.infer<typeof FillParams>
  | z.infer<typeof SelectParams>
  | z.infer<typeof ScreenshotParams>
  | z.infer<typeof EvaluateParams>;