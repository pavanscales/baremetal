interface Config {
  env: 'development' | 'production' | 'test';
  port: number;
  api: {
    baseUrl: string;
    timeout: number;
  };
  cache: {
    enabled: boolean;
    ttl: number; // in seconds
  };
  security: {
    cors: {
      origin: string[];
      methods: string[];
      allowedHeaders: string[];
    };
    rateLimit: {
      windowMs: number;
      max: number;
    };
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    pretty: boolean;
  };
}

const config: Config = {
  env: (process.env.NODE_ENV as any) || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  api: {
    baseUrl: process.env.API_BASE_URL || '/api',
    timeout: 10000, // 10 seconds
  },
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttl: 300, // 5 minutes
  },
  security: {
    cors: {
      origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',')
        : ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    },
  },
  logging: {
    level: (process.env.LOG_LEVEL as any) || 'info',
    pretty: process.env.NODE_ENV !== 'production',
  },
};

export default config;
