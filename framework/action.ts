// framework/actions.ts

/**
 * High-performance server action system for React Server Components
 * Zero-overhead action handling with type safety and optimal scheduling
 */

import { cache } from './cache';
import { metricsCollector } from './metrics';
import { actionQueue } from './queue';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ActionContext {
  requestId: string;
  timestamp: number;
  userId?: string;
  headers: Record<string, string>;
}

interface ActionResult<T = any> {
  status: 'success' | 'error';
  data?: T;
  error?: string;
  metadata: {
    executionTime: number;
    timestamp: number;
    cached: boolean;
  };
}

interface ActionConfig {
  cache?: {
    enabled: boolean;
    ttl: number; // milliseconds
    key: (input: any) => string;
  };
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  timeout?: number; // milliseconds
  retry?: {
    attempts: number;
    backoff: number; // exponential backoff multiplier
  };
}

// ============================================================================
// VALIDATION ENGINE
// ============================================================================

type ValidationRule<T> = (value: T) => boolean | string;

class Validator<T> {
  private rules: ValidationRule<T>[] = [];

  required(message = 'Field is required'): this {
    this.rules.push((value) => value != null || message);
    return this;
  }

  type(expectedType: string, message?: string): this {
    this.rules.push(
      (value) =>
        typeof value === expectedType ||
        message ||
        `Expected ${expectedType}, got ${typeof value}`
    );
    return this;
  }

  custom(rule: ValidationRule<T>): this {
    this.rules.push(rule);
    return this;
  }

  validate(value: T): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const rule of this.rules) {
      const result = rule(value);
      if (typeof result === 'string') {
        errors.push(result);
      } else if (!result) {
        errors.push('Validation failed');
      }
    }
    return { valid: errors.length === 0, errors };
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

class RateLimiter {
  private requests = new Map<string, number[]>();

  check(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Remove expired timestamps
    const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (validTimestamps.length >= maxRequests) {
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }

  reset(key: string): void {
    this.requests.delete(key);
  }
}

const rateLimiter = new RateLimiter();

// ============================================================================
// ACTION EXECUTOR WITH RETRY LOGIC
// ============================================================================

async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: ActionConfig['retry'],
  attempt = 0
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!config || attempt >= config.attempts) {
      throw error;
    }

    const delay = Math.pow(config.backoff, attempt) * 100;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return executeWithRetry(fn, config, attempt + 1);
  }
}

// ============================================================================
// ACTION HANDLER FACTORY
// ============================================================================

export function createAction<TInput, TOutput>(
  handler: (input: TInput, ctx: ActionContext) => Promise<TOutput>,
  config: ActionConfig = {}
) {
  const validator = new Validator<TInput>();

  return {
    // Fluent validation API
    validate: (rule: ValidationRule<TInput>) => {
      validator.custom(rule);
      return this;
    },

    // Execute action with full pipeline
    execute: async (
      input: TInput,
      context: Partial<ActionContext> = {}
    ): Promise<ActionResult<TOutput>> => {
      const startTime = performance.now();
      const ctx: ActionContext = {
        requestId: context.requestId || crypto.randomUUID(),
        timestamp: Date.now(),
        userId: context.userId,
        headers: context.headers || {},
      };

      try {
        // 1. Input validation
        const validation = validator.validate(input);
        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // 2. Rate limiting
        if (config.rateLimit) {
          const rateLimitKey = ctx.userId || ctx.requestId;
          const allowed = rateLimiter.check(
            rateLimitKey,
            config.rateLimit.maxRequests,
            config.rateLimit.windowMs
          );
          if (!allowed) {
            throw new Error('Rate limit exceeded');
          }
        }

        // 3. Cache check
        let cached = false;
        if (config.cache?.enabled) {
          const cacheKey = config.cache.key(input);
          const cachedResult = await cache.get(cacheKey);
          if (cachedResult) {
            cached = true;
            metricsCollector.recordCacheHit('action', cacheKey);
            return {
              status: 'success',
              data: cachedResult,
              metadata: {
                executionTime: performance.now() - startTime,
                timestamp: ctx.timestamp,
                cached: true,
              },
            };
          }
        }

        // 4. Execute with timeout and retry
        const timeoutMs = config.timeout || 30000;
        const executePromise = executeWithRetry(
          () => handler(input, ctx),
          config.retry
        );

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Action timeout')), timeoutMs)
        );

        const result = await Promise.race([executePromise, timeoutPromise]);

        // 5. Cache result
        if (config.cache?.enabled) {
          const cacheKey = config.cache.key(input);
          await cache.set(cacheKey, result, config.cache.ttl);
          metricsCollector.recordCacheMiss('action', cacheKey);
        }

        // 6. Metrics
        const executionTime = performance.now() - startTime;
        metricsCollector.recordActionExecution(ctx.requestId, executionTime);

        return {
          status: 'success',
          data: result,
          metadata: {
            executionTime,
            timestamp: ctx.timestamp,
            cached,
          },
        };
      } catch (error) {
        const executionTime = performance.now() - startTime;
        metricsCollector.recordActionError(ctx.requestId, (error as Error).message);

        return {
          status: 'error',
          error: (error as Error).message,
          metadata: {
            executionTime,
            timestamp: ctx.timestamp,
            cached: false,
          },
        };
      }
    },
  };
}

// ============================================================================
// BATCHED ACTIONS FOR OPTIMAL THROUGHPUT
// ============================================================================

interface BatchedActionConfig {
  maxBatchSize: number;
  maxWaitMs: number;
}

export function createBatchedAction<TInput, TOutput>(
  handler: (inputs: TInput[], ctx: ActionContext) => Promise<TOutput[]>,
  config: BatchedActionConfig
) {
  const queue: Array<{
    input: TInput;
    resolve: (result: ActionResult<TOutput>) => void;
    reject: (error: any) => void;
    ctx: ActionContext;
  }> = [];

  let batchTimeout: NodeJS.Timeout | null = null;

  const processBatch = async () => {
    if (queue.length === 0) return;

    const batch = queue.splice(0, config.maxBatchSize);
    const startTime = performance.now();

    try {
      const inputs = batch.map((item) => item.input);
      const ctx = batch[0].ctx; // Use first context for batch

      const results = await handler(inputs, ctx);

      batch.forEach((item, index) => {
        item.resolve({
          status: 'success',
          data: results[index],
          metadata: {
            executionTime: performance.now() - startTime,
            timestamp: ctx.timestamp,
            cached: false,
          },
        });
      });
    } catch (error) {
      batch.forEach((item) => {
        item.resolve({
          status: 'error',
          error: (error as Error).message,
          metadata: {
            executionTime: performance.now() - startTime,
            timestamp: Date.now(),
            cached: false,
          },
        });
      });
    }

    // Process remaining items
    if (queue.length > 0) {
      processBatch();
    }
  };

  const scheduleBatch = () => {
    if (batchTimeout) clearTimeout(batchTimeout);
    batchTimeout = setTimeout(processBatch, config.maxWaitMs);
  };

  return {
    execute: async (
      input: TInput,
      context: Partial<ActionContext> = {}
    ): Promise<ActionResult<TOutput>> => {
      return new Promise((resolve, reject) => {
        const ctx: ActionContext = {
          requestId: context.requestId || crypto.randomUUID(),
          timestamp: Date.now(),
          userId: context.userId,
          headers: context.headers || {},
        };

        queue.push({ input, resolve, reject, ctx });

        if (queue.length >= config.maxBatchSize) {
          if (batchTimeout) clearTimeout(batchTimeout);
          processBatch();
        } else {
          scheduleBatch();
        }
      });
    },
  };
}

// ============================================================================
// OPTIMISTIC ACTIONS WITH ROLLBACK
// ============================================================================

interface OptimisticUpdate<T> {
  optimisticData: T;
  rollback: () => void;
}

export function createOptimisticAction<TInput, TOutput>(
  handler: (input: TInput, ctx: ActionContext) => Promise<TOutput>,
  optimisticUpdater: (input: TInput) => OptimisticUpdate<TOutput>
) {
  return {
    execute: async (
      input: TInput,
      context: Partial<ActionContext> = {}
    ): Promise<ActionResult<TOutput>> => {
      const ctx: ActionContext = {
        requestId: context.requestId || crypto.randomUUID(),
        timestamp: Date.now(),
        userId: context.userId,
        headers: context.headers || {},
      };

      const { optimisticData, rollback } = optimisticUpdater(input);
      const startTime = performance.now();

      try {
        const result = await handler(input, ctx);
        return {
          status: 'success',
          data: result,
          metadata: {
            executionTime: performance.now() - startTime,
            timestamp: ctx.timestamp,
            cached: false,
          },
        };
      } catch (error) {
        rollback(); // Revert optimistic update
        return {
          status: 'error',
          error: (error as Error).message,
          metadata: {
            executionTime: performance.now() - startTime,
            timestamp: ctx.timestamp,
            cached: false,
          },
        };
      }
    },
  };
}

// ============================================================================
// STREAMING ACTIONS FOR LARGE RESPONSES
// ============================================================================

export function createStreamingAction<TInput, TChunk>(
  handler: (
    input: TInput,
    ctx: ActionContext,
    emit: (chunk: TChunk) => void
  ) => Promise<void>
) {
  return {
    stream: async function* (
      input: TInput,
      context: Partial<ActionContext> = {}
    ): AsyncGenerator<TChunk> {
      const ctx: ActionContext = {
        requestId: context.requestId || crypto.randomUUID(),
        timestamp: Date.now(),
        userId: context.userId,
        headers: context.headers || {},
      };

      const chunks: TChunk[] = [];
      const emit = (chunk: TChunk) => chunks.push(chunk);

      const handlerPromise = handler(input, ctx, emit);

      // Yield chunks as they arrive
      while (chunks.length > 0 || handlerPromise) {
        if (chunks.length > 0) {
          yield chunks.shift()!;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        // Check if handler completed
        const completed = await Promise.race([
          handlerPromise.then(() => true),
          Promise.resolve(false),
        ]);
        if (completed && chunks.length === 0) break;
      }
    },
  };
}

// ============================================================================
// EXAMPLE ACTIONS
// ============================================================================

// Simple action with validation and caching
export const fetchUserData = createAction(
  async (userId: string, ctx: ActionContext) => {
    // Simulated database query
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      id: userId,
      name: 'User ' + userId,
      email: `user${userId}@example.com`,
    };
  },
  {
    cache: {
      enabled: true,
      ttl: 60000, // 1 minute
      key: (userId) => `user:${userId}`,
    },
    timeout: 5000,
    retry: {
      attempts: 3,
      backoff: 2,
    },
  }
);

// Batched action for bulk operations
export const fetchMultipleUsers = createBatchedAction(
  async (userIds: string[], ctx: ActionContext) => {
    // Single DB query for all users
    await new Promise((resolve) => setTimeout(resolve, 100));
    return userIds.map((id) => ({
      id,
      name: 'User ' + id,
      email: `user${id}@example.com`,
    }));
  },
  {
    maxBatchSize: 50,
    maxWaitMs: 10,
  }
);

// Optimistic action for mutations
export const updateUserProfile = createOptimisticAction(
  async (data: { userId: string; name: string }, ctx: ActionContext) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { ...data, updatedAt: Date.now() };
  },
  (data) => {
    const previousData = { name: 'Old Name' }; // Get from cache/store
    return {
      optimisticData: { ...data, updatedAt: Date.now() },
      rollback: () => {
        // Restore previous data in cache/store
        console.log('Rollback to:', previousData);
      },
    };
  }
);

// Streaming action for large datasets
export const streamLargeDataset = createStreamingAction(
  async (query: string, ctx: ActionContext, emit) => {
    // Stream results in chunks
    for (let i = 0; i < 100; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      emit({ index: i, data: `Result ${i} for ${query}` });
    }
  }
);