import { Request } from 'express';
import { Middleware } from '../types';

interface RequestLoggerOptions {
  logBody?: boolean;
  logHeaders?: boolean;
  logQuery?: boolean;
  logParams?: boolean;
}

export function createRequestLogger(options: RequestLoggerOptions = {}): Middleware {
  const {
    logBody = false,
    logHeaders = false,
    logQuery = true,
    logParams = true,
  } = options;

  return async (req: Request, params, next) => {
    const start = Date.now();
    const { method, originalUrl, ip } = req;

    // Log request start
    console.log(`[${new Date().toISOString()}] ${method} ${originalUrl} from ${ip}`);
    
    if (logHeaders) {
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
    }
    
    if (logQuery && Object.keys(req.query).length > 0) {
      console.log('Query:', JSON.stringify(req.query, null, 2));
    }
    
    if (logParams && Object.keys(req.params).length > 0) {
      console.log('Params:', JSON.stringify(req.params, null, 2));
    }
    
    if (logBody && req.body && Object.keys(req.body).length > 0) {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }

    // Wait for the request to finish
    await next();

    // Log request completion
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${method} ${originalUrl} - ${duration}ms`);
  };
}

// Default logger middleware
export const logger = createRequestLogger();
