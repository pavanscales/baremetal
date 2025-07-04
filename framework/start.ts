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

import './routes';

const bootStart = Date.now();
const port = env.PORT ?? 3000;
const isDev = process.env.NODE_ENV !== 'production';

async function handler(
  req: http.IncomingMessage | http2.Http2ServerRequest,
  res: http.ServerResponse | http2.Http2ServerResponse
) {
  const reqStart = Date.now();

  try {
    const method = 'method' in req ? req.method : req.headers[':method'];
    const reqPath = 'url' in req ? req.url : req.headers[':path'];
    const host = 'headers' in req && 'host' in req.headers ? req.headers.host : req.headers[':authority'];

    if (!method || !reqPath || !host) {
      res.statusCode = 400;
      return res.end('Bad Request');
    }

    const url = new URL(reqPath, `http://${host}`);

    const fetchRequest = new Request(url.toString(), {
      method,
      headers: req.headers as HeadersInit,
      body:
        method === 'GET' || method === 'HEAD'
          ? null
          : (Readable.toWeb(req as any) as unknown as ReadableStream<Uint8Array>),
    });

    // Serve static files
    const staticResponse = await serveStatic(fetchRequest);
    if (staticResponse) {
      res.writeHead(staticResponse.status, Object.fromEntries(staticResponse.headers));
      if (staticResponse.body) {
        const stream = Readable.fromWeb(staticResponse.body);
        stream.pipe(res as any);
      } else {
        res.end();
      }
      return;
    }

    // Match dynamic route
    const routeMatch = router.match(url.pathname);
    if (!routeMatch) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found');
    }

    // Render using router
    const response = await router.render(fetchRequest, url.pathname);
    res.writeHead(response.status, Object.fromEntries(response.headers));

    if (response.body) {
      const stream = Readable.fromWeb(response.body);
      stream.pipe(res as any);
    } else {
      res.end();
    }
  } catch (err: any) {
    console.error('❌ Server error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Internal Server Error');
  } finally {
    const duration = Date.now() - reqStart;
    const method = 'method' in req ? req.method : req.headers[':method'];
    const reqPath = 'url' in req ? req.url : req.headers[':path'];
    console.log(`📡 ${method} ${reqPath} - ${duration}ms`);
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
