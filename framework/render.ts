import React from 'react';
import { renderToReadableStream } from './rsc';
import { cache } from './cache';
import { profiler } from './profiler';

const encoder = new TextEncoder();

const shellStart = encoder.encode(
  '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"/>' +
  '<title>Fast RSC App</title><style>body{margin:0;font-family:system-ui,sans-serif}</style>' +
  '</head><body><div id="root">'
);

const shellEnd = encoder.encode('</div></body></html>');

async function* combinedStreamGenerator(stream: ReadableStream<Uint8Array>) {
  yield shellStart;
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
  yield shellEnd;
}

function htmlShell(stream: ReadableStream<Uint8Array>): Response {
  const combinedStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of combinedStreamGenerator(stream)) {
          controller.enqueue(chunk);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(combinedStream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=59',
    },
  });
}

export async function renderRSC({
  route,
  req,
}: {
  route: { routeNode: any; params: Record<string, string> };
  req: Request;
}): Promise<Response> {
  profiler.start();

  try {
    const url = new URL(req.url);
    const cacheKey = `${req.method}:${url.pathname}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      profiler.stop();
      return cached.clone();
    }

    // Use the routeNode (already matched by router)
    const element = await route.routeNode.routeHandler!(req, route.params);
    const rscStream = await renderToReadableStream(element);
    const response = htmlShell(rscStream);

    cache.set(cacheKey, response.clone());
    profiler.stop();
    return response;
  } catch (error: any) {
    profiler.stop();
    const errorHTML = `<!DOCTYPE html><html><body><h1>Server Error</h1><pre>${escapeHtml(error.message)}</pre></body></html>`;
    return new Response(errorHTML, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}
