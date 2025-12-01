import { createServer, IncomingMessage, ServerResponse } from 'http';
import { router } from './framework';
import config from './framework/config';

// Import your routes
import './routes';

const server = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!req.url) {
        res.statusCode = 400;
        return res.end('Invalid URL');
      }

      // Handle static files in production
      if (process.env.NODE_ENV === 'production') {
        // Add static file serving logic here
      }

      // Handle API routes
      const response = await router.render(
        new Request(`http://${req.headers.host}${req.url}`, {
          method: req.method,
          headers: req.headers as HeadersInit,
          // @ts-ignore
          body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
        })
      );

      // Set response headers
      if (response) {
        res.statusCode = response.status;
        response.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
        
        // Stream the response
        const reader = response.body?.getReader();
        if (reader) {
          res.flushHeaders();
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        }
        
        return res.end();
      }

      // No route matched
      res.statusCode = 404;
      res.end('Not Found');
    } catch (error) {
      console.error('Server error:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }
);

// Start the server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
