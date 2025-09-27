<<<<<<< HEAD
=======

>>>>>>> 78921f4c8dd1f1fa229ad2cae46896aae1a57dfd
import React from 'react';
import { renderToReadableStream } from './rsc';
import { cache } from './cache';
import { profiler } from './profiler';

const encoder = new TextEncoder();
<<<<<<< HEAD

=======
>>>>>>> 78921f4c8dd1f1fa229ad2cae46896aae1a57dfd
const shellStart = encoder.encode(
  '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>' +
    '<title>Fast RSC App</title><style>body{margin:0;font-family:system-ui,sans-serif}</style>' +
    '</head><body><div id="root">'
);
const shellEnd = encoder.encode('</div></body></html>');

<<<<<<< HEAD
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

=======
>>>>>>> 78921f4c8dd1f1fa229ad2cae46896aae1a57dfd
function htmlShell(stream: ReadableStream<Uint8Array>): Response {
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
<<<<<<< HEAD
        controller.close();
      } catch (error) {
        controller.error(error);
      }
=======
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
      controller.enqueue(shellEnd);
      controller.close();
>>>>>>> 78921f4c8dd1f1fa229ad2cae46896aae1a57dfd
    },
  });

  return new Response(fullStream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=59',
    },
  });
}

<<<<<<< HEAD
=======
function htmlShellBuffer(buffer: Uint8Array): Response {
  const fullStream = new ReadableStream({
    start(controller) {
      controller.enqueue(shellStart);
      controller.enqueue(buffer);
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

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout exceeded')), ms)
    ),
  ]);
}
>>>>>>> 78921f4c8dd1f1fa229ad2cae46896aae1a57dfd
export async function renderRSC({
  route,
  req,
}: {
<<<<<<< HEAD
  route: { routeNode: any; params: Record<string, string> };
=======
  route: { handler: (req: Request) => Promise<React.ReactNode> };
>>>>>>> 78921f4c8dd1f1fa229ad2cae46896aae1a57dfd
  req: Request;
}): Promise<Response> {
  profiler.start();

  try {
    const url = new URL(req.url);
    const cacheKey = `${req.method}:${url.pathname}`;

<<<<<<< HEAD
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
=======
    const cachedBuffer = cache.get(cacheKey);
    if (cachedBuffer instanceof Uint8Array) {
      return htmlShellBuffer(cachedBuffer);
    }

    let element = await withTimeout(route.handler(req), 3000);

    const layouts = (globalThis as any)._layouts as
      | ((children: React.ReactNode) => React.ReactNode)[]
      | undefined;

    if (layouts?.length) {
      for (const wrap of layouts.reverse()) {
        element = wrap(element);
      }
    }

    if (!element || typeof element !== 'object') {
      throw new Error('Route handler returned invalid JSX element');
    }

    const stream = await withTimeout(renderToReadableStream(element), 3000);

    // ALWAYS use tee() to avoid re-use of locked stream
    const [body1, body2] = stream.tee();

    // cache one copy
    bufferStream(body2).then((buffer) => cache.set(cacheKey, buffer));

    // serve the first
    return htmlShell(body1);
  } catch (err: any) {
    return error500(err.message);
  } finally {
>>>>>>> 78921f4c8dd1f1fa229ad2cae46896aae1a57dfd
    profiler.stop();
  }
}

<<<<<<< HEAD
=======
async function bufferStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function error500(msg: string): Response {
  const html = `<!DOCTYPE html><html><body><h1>500 Error</h1><pre>${escapeHtml(
    msg
  )}</pre></body></html>`;
  return new Response(html, {
    status: 500,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

>>>>>>> 78921f4c8dd1f1fa229ad2cae46896aae1a57dfd
function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}
