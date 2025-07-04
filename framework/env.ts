// framework/env.ts

// Simple env loader with defaults and type safety
export const env = {
PORT: Number.isNaN(parseInt(process.env.PORT ?? "", 10)) ? 8000 : parseInt(process.env.PORT!, 10),

    NODE_ENV: process.env.NODE_ENV ?? "development",
  // Add more env variables as needed
  // Example:
  // API_URL: process.env.API_URL ?? "http://localhost:3000/api",
};

// Utility to check if running in production
export const isProd = env.NODE_ENV === "production";
