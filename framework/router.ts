import { renderRSC } from './render';
import {
  RouteNode,
  MatchedRoute,
  Middleware,
  MiddlewareNext,
  RouteHandler,
  RouteConfig,
  RouteNodeType
} from './types';

// Cache configuration
const ROUTE_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// Re-export types for backward compatibility
export type { RouteNode, MatchedRoute, RouteConfig };

class UltraRouter {
  private root: RouteNode;
  private routeCache = new Map<string, { data: MatchedRoute | null; timestamp: number; expires: number }>();
  private lastCacheCleanup = Date.now();

  constructor() {
    this.root = this.createNode("");
    // Clean up cache periodically
    setInterval(() => this.cleanupCache(), ROUTE_CACHE_TTL).unref();
  }

  private createNode(
    segment: string, 
    type: RouteNodeType = RouteNodeType.STATIC, 
    paramName?: string
  ): RouteNode {
    return {
      segment,
      type,
      paramName,
      children: new Map(),
      middleware: [],
      isLayout: false,
      isGroup: false,
      priority: 0
    };
  }

  private cleanupCache(): void {
    const now = Date.now();
    if (now - this.lastCacheCleanup < ROUTE_CACHE_TTL) return;
    
    for (const [key, entry] of this.routeCache.entries()) {
      if (!entry || now > entry.expires) {
        this.routeCache.delete(key);
      }
    }
    
    this.lastCacheCleanup = now;
  }

  /**
   * Add a new route to the router
   * @param path Route path pattern (e.g., '/users/:id')
   * @param handler Route handler function
   * @param options Route configuration options
   */
  addRoute(
    path: string,
    handler: RouteHandler,
    options: {
      isLayout?: boolean;
      isGroup?: boolean;
      middleware?: Middleware[];
      priority?: number;
    } = {}
  ): this {
    const segments = this.parseSegments(path);
    let node = this.root;
    let priority = options.priority ?? 0;

    // Traverse or create the route tree
    for (const seg of segments) {
      const segmentKey = seg.segment;
      let child = node.children.get(segmentKey);
      
      // Create new node if it doesn't exist
      if (!child) {
        child = this.createNode(
          segmentKey,
          seg.isCatchAll ? RouteNodeType.CATCH_ALL : 
            seg.isDynamic ? RouteNodeType.DYNAMIC : RouteNodeType.STATIC,
          seg.paramName
        );
        child.parent = node;
        node.children.set(segmentKey, child);
        
        // Sort children by priority (highest first) when adding new nodes
        if (node.children.size > 1) {
          const sorted = new Map(
            [...node.children.entries()].sort((a, b) => b[1].priority - a[1].priority)
          );
          node.children = sorted;
        }
      }
      
      node = child;
      node.priority = Math.max(node.priority, priority);
    }

    // Set route handler or layout handler
    if (options.isLayout) {
      if (node.layoutHandler) {
        throw new Error(`Duplicate layout handler defined for path: ${path}`);
      }
      node.layoutHandler = handler;
    } else {
      if (node.routeHandler) {
        throw new Error(`Duplicate route handler defined for path: ${path}`);
      }
      node.routeHandler = handler;
    }

    // Set route metadata
    node.isGroup = Boolean(options.isGroup);
    node.isLayout = Boolean(options.isLayout);
    
    // Add middleware if provided
    if (options.middleware?.length) {
      node.middleware.push(...options.middleware);
    }
    
    // Invalidate route cache when routes change
    this.routeCache.clear();
    
    return this; // Enable method chaining
  }

  /**
   * Parse URL path into route segments
   * @param path URL path to parse
   * @returns Array of route segments with metadata
   */
  private parseSegments(path: string): Array<{
    segment: string;
    type: RouteNodeType;
    isDynamic: boolean;
    isCatchAll: boolean;
    paramName?: string;
  }> {
    return path
      .split("/")
      .filter(Boolean)
      .map((segment) => {
        // Handle route groups (e.g., (auth))
        if (segment.startsWith("(") && segment.endsWith(")")) {
          return { 
            segment,
            type: RouteNodeType.STATIC,
            isDynamic: false,
            isCatchAll: false
          };
        }
        
        // Handle catch-all segments (e.g., *all)
        if (segment.startsWith("*")) {
          const paramName = segment.slice(1);
          if (!paramName) {
            throw new Error(`Catch-all segment must have a name: ${segment}`);
          }
          return { 
            segment,
            type: RouteNodeType.CATCH_ALL,
            isDynamic: true,
            isCatchAll: true,
            paramName
          };
        }
        
        // Handle dynamic segments (e.g., :id)
        if (segment.startsWith(":")) {
          const paramName = segment.slice(1);
          if (!paramName) {
            throw new Error(`Dynamic segment must have a name: ${segment}`);
          }
          return { 
            segment,
            type: RouteNodeType.DYNAMIC,
            isDynamic: true,
            isCatchAll: false,
            paramName 
          };
        }
        
        // Static segment
        return { 
          segment, 
          type: RouteNodeType.STATIC,
          isDynamic: false,
          isCatchAll: false
        };
      });
  }

  private async runMiddleware(
    req: Request,
    params: Readonly<Record<string, string>>,
    middleware: Middleware[]
  ): Promise<void> {
    if (!middleware.length) return;
    
    let index = 0;
    const next: MiddlewareNext = async () => {
      if (index >= middleware.length) return;
      const currentMiddleware = middleware[index++];
      let isNextCalled = false;
      
      try {
        await currentMiddleware(req, params, async () => {
          if (isNextCalled) {
            throw new Error("`next()` called multiple times in middleware");
          }
          isNextCalled = true;
          await next();
        });
      } catch (error) {
        console.error('Middleware error:', error);
        throw error;
      }
    };
    await next();
  }

  match(pathname: string): MatchedRoute | null {
    const now = Date.now();
    const cacheKey = pathname;
    const cached = this.routeCache.get(cacheKey);
    
    if (cached && now < cached.expires) {
      return cached.data;
    }

    const segments = pathname.split("/").filter(Boolean);
    const params: Record<string, string> = {};
    const match = this.matchNode(this.root, segments, 0, params);
    if (!match) {
      this.routeCache.set(cacheKey, { 
        data: null, 
        timestamp: now,
        expires: now + ROUTE_CACHE_TTL
      });
      return null;
    }

    // Collect all layout handlers in the hierarchy
    const layouts: RouteNode[] = [];
    let currentNode: RouteNode | undefined = match.node;
    
    while (currentNode) {
      if (currentNode.isLayout && currentNode.layoutHandler) {
        layouts.unshift(currentNode);
      }
      currentNode = currentNode.parent;
    }

    const result = { 
      node: match.node, 
      params: { ...params }, // Clone params to prevent mutation
      layouts 
    };
    
    // Cache the result with timestamp and expiration
    this.routeCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      expires: Date.now() + ROUTE_CACHE_TTL
    });
    
    return result;
  }

  private matchNode(
    node: RouteNode,
    segments: string[],
    index: number,
    params: Record<string, string>
  ): { node: RouteNode; params: Record<string, string> } | null {
    // If we've reached the end of the path segments
    if (index === segments.length) {
      if (node.routeHandler) return { node, params };
      return null;
    }

    const currentSegment = segments[index];
    
    // Try to match static routes first (highest priority)
    for (const child of node.children.values()) {
      if (child.type === RouteNodeType.STATIC && child.segment === currentSegment) {
        const result = this.matchNode(child, segments, index + 1, params);
        if (result) return result;
      }
    }
    
    // Then try dynamic routes
    for (const child of node.children.values()) {
      if (child.type === RouteNodeType.DYNAMIC && child.paramName) {
        const originalParam = params[child.paramName];
        params[child.paramName] = currentSegment;
        
        const result = this.matchNode(child, segments, index + 1, params);
        if (result) return result;
        
        // Backtrack
        if (originalParam === undefined) {
          delete params[child.paramName];
        } else {
          params[child.paramName] = originalParam;
        }
      }
    }
    
    // Finally, try catch-all routes
    for (const child of node.children.values()) {
      if (child.type === RouteNodeType.CATCH_ALL && child.paramName) {
        params[child.paramName] = segments.slice(index).join("/");
        return { node: child, params };
      }
    }
    
    return null;
  }

  async render(req: Request, pathname: string): Promise<Response> {
    const matched = this.match(pathname);
    if (!matched) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      // Run all layout middleware first (from root to leaf)
      for (const layout of matched.layouts) {
        await this.runMiddleware(req, matched.params, layout.middleware);
      }

      // Run route-specific middleware
      await this.runMiddleware(req, matched.params, matched.node.middleware);

      if (!matched.node.routeHandler) {
        throw new Error(`No route handler found for path: ${pathname}`);
      }

      // Use the renderRSC function from render.ts
      return await renderRSC({
        route: {
          routeNode: matched.node,
          params: matched.params || {},
          handler: matched.node.routeHandler
        },
        req
      });
    } catch (error) {
      console.error('Render error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  /**
   * Get all registered routes in the router
   * @returns Array of route paths with metadata
   */
  getAllRoutes(): Array<{ path: string; isLayout: boolean }> {
    const routes: Array<{ path: string; isLayout: boolean }> = [];
    
    const traverse = (node: RouteNode, parts: string[] = []) => {
      // Add route if it has a handler
      if (node.routeHandler || node.layoutHandler) {
        const path = "/" + parts.filter(Boolean).join("/");
        routes.push({ 
          path,
          isLayout: node.isLayout
        });
      }
      
      // Recursively traverse children
      for (const [segment, child] of node.children.entries()) {
        traverse(child, [...parts, segment]);
      }
    };
    
    traverse(this.root);
    return routes.sort((a, b) => a.path.localeCompare(b.path));
  }
}

// Create and export a singleton instance
export const router = new UltraRouter();

// Re-export types for external use
export type { Middleware, MiddlewareNext };
// RouteHandler is already exported above
