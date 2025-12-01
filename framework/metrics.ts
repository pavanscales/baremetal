// framework/metrics.ts

interface MetricsRequest {
  method?: string;
  url: string;
  statusCode?: number;
  headers?: Record<string, string | string[] | undefined>;
}

interface MetricsResponse {
  statusCode?: number;
  on(event: string, callback: () => void): void;
}

interface MetricsOptions {
  /** Whether to enable detailed request logging */
  enableRequestLogging?: boolean;
  /** Custom logger function */
  logger?: (message: string, meta?: Record<string, unknown>) => void;
}

let coldStartLogged = false;
let metricsOptions: MetricsOptions = {
  enableRequestLogging: true,
  logger: console.log
};

/**
 * Initialize metrics with custom options
 */
export function initMetrics(options: MetricsOptions = {}): void {
  metricsOptions = { ...metricsOptions, ...options };
}

/**
 * Log cold start metrics
 */
export function logMetrics(bootStart: number): void {
  if (coldStartLogged) return;
  coldStartLogged = true;

  const coldStartTime = Date.now() - bootStart;
  const message = ` Cold start took: ${coldStartTime}ms`;
  
  if (metricsOptions.logger) {
    metricsOptions.logger(message, { coldStartTime });
  }
}

/**
 * Log request metrics
 */
export function logRequestTime(
  startTime: number, 
  url: string, 
  req?: MetricsRequest
): void {
  if (!metricsOptions.enableRequestLogging) return;
  
  const duration = Date.now() - startTime;
  const message = ` Request for ${url} took ${duration}ms`;
  
  if (metricsOptions.logger) {
    metricsOptions.logger(message, { 
      duration,
      url,
      method: req?.method,
      statusCode: req?.statusCode
    });
  }
}

/**
 * Create a request timing middleware
 */
export function requestTimingMiddleware(
  req: MetricsRequest, 
  res: MetricsResponse, 
  next: () => void
): void {
  const start = Date.now();
  
  res.on('finish', () => {
    logRequestTime(start, req.url, req);
  });
  
  next();
}

export default {
  initMetrics,
  logMetrics,
  logRequestTime,
  requestTimingMiddleware
};
