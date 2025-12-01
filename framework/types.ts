/**
 * Core type definitions for the Baremetal framework
 * 
 * This file contains all the shared types and interfaces used throughout the framework.
 * Keeping them centralized ensures consistency and makes maintenance easier.
 */

import { ReactNode, ComponentType, ReactElement } from 'react';

/**
 * Represents the configuration for a route
 * @property {string} path - The URL path pattern
 * @property {ComponentType} component - The React component to render
 * @property {Middleware[]} [middleware] - Array of middleware functions
 * @property {ComponentType} [layout] - Optional layout component
 * @property {boolean} [isLayout] - Whether this route is a layout route
 * @property {boolean} [isGroup] - Whether this route is a route group
 */

// Core types
export interface RouteConfig {
  path: string;
  component: ComponentType<any>;
  middleware?: Middleware[];
  layout?: ComponentType<{ children: ReactNode }>;
  isLayout?: boolean;
  isGroup?: boolean;
}

export type Middleware = (
  req: Request,
  params: Record<string, string>,
  next: () => Promise<void>
) => Promise<void> | void;

export type MiddlewareNext = () => Promise<void>;

// Router types
export type RouteNodeType = 'static' | 'dynamic' | 'catch_all';

export interface RouteNode {
  segment: string;
  type: 'static' | 'dynamic' | 'catch_all';
  paramName?: string;
  children: Map<string, RouteNode>;
  middleware: Middleware[];
  isLayout: boolean;
  isGroup: boolean;
  parent?: RouteNode;
  routeHandler?: RouteHandler;
  layoutHandler?: RouteHandler;
  priority: number;
}

export interface MatchedRoute {
  node: RouteNode;
  params: Record<string, string>;
  layouts: RouteNode[];
}

export type RouteHandler = (
  req: Request,
  params: Readonly<Record<string, string>>,
  childResponse?: Response
) => Promise<ReactElement> | ReactElement;

// Render types
export interface RenderRSCProps {
  route: {
    handler: RouteHandler;
    routeNode?: RouteNode;
    params?: Record<string, string>;
  };
  req: Request;
}

// Server types
export interface ServerConfig {
  port?: number;
  hostname?: string;
  enableHTTP2?: boolean;
  ssl?: {
    key: string;
    cert: string;
  };
}

// Cache types
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expires: number;
}

// Error types
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// RSC (React Server Components) types
export interface RSCComponentProps {
  params: Record<string, string>;
  searchParams: URLSearchParams;
}

export type RSCComponent = ComponentType<RSCComponentProps>;
