/**
 * Server-side rendering utilities for React Server Components
 * 
 * This module handles rendering React components to HTML on the server,
 * including error boundaries, streaming, and performance monitoring.
 */

import * as React from 'react';
import { renderToReadableStream } from 'react-dom/server';
import type { RenderRSCProps } from './types';
import { ErrorBoundary } from './ErrorBoundary';
import { logRequestTime } from './metrics';

// Text encoder for converting strings to Uint8Array
const encoder = new TextEncoder();

// HTML shell template parts
const shellStart = encoder.encode(
  '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"/>' +
  '<title>Baremetal App</title><style>body{margin:0;font-family:system-ui,sans-serif}</style>' +
  '</head><body><div id="root">'
);

const shellEnd = encoder.encode('</div></body></html>');

/**
 * Creates a 500 error response with a user-friendly message
 */
function createErrorResponse(message: string): Response {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Error - Baremetal App</title>
        <style>
          body { 
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            padding: 2rem;
            max-width: 800px;
            margin: 0 auto;
            color: #1f2937;
          }
          h1 { color: #dc2626; }
          pre { 
            background: #f3f4f6;
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        <h1>500 Internal Server Error</h1>
        <p>An error occurred while processing your request:</p>
        <pre>${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      </body>
    </html>
  `;
  
  return new Response(html, {
    status: 500,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Wraps the React stream in a complete HTML document
 */
function wrapInHTMLShell(stream: ReadableStream<Uint8Array>): Response {
  const fullStream = new ReadableStream({
    async start(controller) {
      controller.enqueue(shellStart);
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
      controller.enqueue(shellEnd);
      controller.close();
    },
  });

  return new Response(fullStream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=59',
    },
  });
}

/**
 * Creates a timeout wrapper around a promise
 */
function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeout}ms`));
    }, timeout);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Renders a React Server Component to a Response
 */
export async function renderRSC({
  route,
  req
}: RenderRSCProps): Promise<Response> {
  const startTime = performance.now();
  const url = new URL(req.url);

  try {
    // Handle both new and old route formats
    let element: React.ReactElement;
    try {
      const result = route.handler 
        ? route.handler(req, {})
        : route.routeNode?.routeHandler?.(req, route.params || {});
      
      if (!result) {
        throw new Error('No valid route handler found');
      }

      element = result instanceof Promise 
        ? await withTimeout(result, 3000)
        : result;

    } catch (error) {
      console.error('Error in route handler:', error);
      throw new Error(`Route handler error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Apply layouts if available
    const layouts = (globalThis as any)._layouts as
      | ((children: React.ReactNode) => React.ReactNode)[]
      | undefined;

    // Wrap with ErrorBoundary in development
    if (process.env.NODE_ENV !== 'production') {
      element = React.createElement(
        ErrorBoundary,
        {
          fallback: (error: Error) => React.createElement(
            'div',
            { style: { color: 'red', padding: '1rem' } },
            React.createElement('h2', null, 'Component Error'),
            React.createElement('pre', null, error.message),
            React.createElement('pre', null, error.stack)
          )
        },
        element
      );
    }

    // Apply layout wrappers
    if (layouts?.length) {
      for (const wrap of [...layouts].reverse()) {
        element = wrap(element) as React.ReactElement;
      }
    }

    if (!element || typeof element !== 'object') {
      throw new Error('Route handler returned invalid JSX element');
    }

    // Render the component to a stream
    const stream = await withTimeout(
      renderToReadableStream(element),
      3000
    );

    // Log request metrics
    const metricsReq = {
      url: url.pathname,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries())
    };
    logRequestTime(startTime, url.pathname, metricsReq);

    // Return the response
    return wrapInHTMLShell(stream);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Render error:', message, error);
    return createErrorResponse(message);
  } finally {
    const endTime = performance.now();
    console.log(`Render time: ${endTime - startTime}ms`);
  }
}