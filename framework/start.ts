// optimized-start.ts
import fs from 'fs';
import path from 'path';
import http from 'http';
import http2 from 'http2';
import cluster from 'cluster';
import os from 'os';
import { Readable } from 'stream';
import { router } from './router';
import { preloadAll } from './preload';
import { logMetrics } from './metrics';
import { env } from './env';
import { serveStatic } from './serveStatic';
// zlib is not currently used but kept for future compression support

import './routes';

const bootStart = Date.now();
const port = env.PORT ?? 3000;
const isDev = process.env.NODE_ENV !== 'production';

function logRequest(method: string, url: string, duration: number) {
  const mem = process.memoryUsage();
  console.log(
    `⏱️ ${method} ${url} - ${duration}ms | Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(
      2
    )} MB | RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`
  );
}

async function handler(
  req: http.IncomingMessage | http2.Http2ServerRequest,
  res: http.ServerResponse | http2.Http2ServerResponse
) {
  const reqStart = Date.now();
  let method: string | undefined;
  let reqPath: string | undefined;

  try {
    method = 'method' in req ? req.method : req.headers[':method'] as string;
    reqPath = 'url' in req ? req.url : req.headers[':path'] as string;
    const host = 'headers' in req && 'host' in req.headers 
      ? req.headers.host 
      : req.headers[':authority'] as string;

    if (!method || !reqPath || !host) {
      res.statusCode = 400;
      res.end('Invalid request');
      return;
    }

    // Create URL object
    const url = new URL(reqPath, `http://${host}`);
    const pathname = url.pathname;

    // Handle static files
    if (pathname.startsWith('/_next/static/') || pathname === '/favicon.ico') {
      const staticResponse = await serveStatic(new Request(url.toString(), {
        method,
        headers: req.headers as HeadersInit,
      }));

      if (staticResponse) {
        res.statusCode = staticResponse.status;
        for (const [key, value] of staticResponse.headers.entries()) {
          res.setHeader(key, value);
        }
        if (staticResponse.body) {
          try {
            const stream = Readable.fromWeb(staticResponse.body as any);
            stream.pipe(res as any);
            return;
          } catch (err) {
            console.error('Stream error:', err);
            res.statusCode = 500;
            res.end('Internal Server Error');
            return;
          }
        } else {
          res.end();
          return;
        }
      }
    }

    // Handle API routes
    if (pathname.startsWith('/api/')) {
      const apiPath = pathname.replace(/^\/api\//, '');
      try {
        const apiHandler = await import(`./api/${apiPath}`);
        await apiHandler.default(req, res);
        return;
      } catch (err) {
        console.error('API route error:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
        return;
      }
    }

    // Handle RSC rendering
    try {
      const response = await router.render(new Request(url.toString(), {
        method,
        headers: req.headers as HeadersInit,
      }), pathname);

      if (response) {
        res.statusCode = response.status;
        for (const [key, value] of response.headers.entries()) {
          res.setHeader(key, value);
        }
        
        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              (res as any).write(Buffer.from(value.buffer));
            }
          }
        }
        res.end();
        return;
      }
    } catch (err) {
      console.error('Rendering error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
      return;
    }

    // 404 Not Found
    res.statusCode = 404;
    res.end('Not Found');
  } catch (error) {
    console.error('Request error:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  } finally {
    if (method && reqPath) {
      logRequest(method, reqPath, Date.now() - reqStart);
    }
  }
}

async function runServer() {
  await preloadAll();

  const server = isDev
    ? http.createServer(handler)
    : http2.createSecureServer(
        {
          key: fs.readFileSync(path.join(process.cwd(), 'certs/key.pem')),
          cert: fs.readFileSync(path.join(process.cwd(), 'certs/cert.pem')),
        },
        handler
      );

  server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Worker ${process.pid} started on ${isDev ? 'http' : 'https'}://localhost:${port}`);
  });

  server.on('error', (err) => {
    console.error('❌ Server error:', err);
    process.exit(1);
  });

  if (!isDev) {
    logMetrics(bootStart);
  } else {
    console.log(`🚀 Cold start took: ${Date.now() - bootStart}ms`);
  }
}

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  const workerCount = isDev ? Math.min(4, numCPUs) : numCPUs;

  console.log(`🧠 Master ${process.pid} running with ${workerCount} workers`);
  for (let i = 0; i < workerCount; i++) cluster.fork();

  cluster.on('exit', (worker) => {
    console.log(`⚠️ Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  runServer().catch((err) => {
    console.error('❌ Fatal startup error:', err);
    process.exit(1);
  });
}
