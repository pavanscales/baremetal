import * as React from 'react';
import type { ErrorBoundaryProps, ErrorBoundaryState } from './types';

/**
 * Re-export types for backward compatibility
 * @public
 */
export type { ErrorBoundaryProps, ErrorBoundaryState };

/**
 * ErrorBoundary is a React component that catches JavaScript errors in its child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary 
 *   fallback={(error) => <ErrorComponent error={error} />}
 *   onError={(error, errorInfo) => logErrorToService(error, errorInfo)}
 * >
 *   <App />
 * </ErrorBoundary>
 * ```
 */

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  /**
   * Initialize the error boundary with default state
   */
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Update state when an error is thrown
   * @param error - The error that was thrown
   * @returns New state with error information
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Handle errors that occur during rendering
   * @param error - The error that was thrown
   * @param errorInfo - Additional error information
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    // Call the onError handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // You can also log errors to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  /**
   * Render the error boundary
   * @returns The children if no error, or the fallback UI if an error occurred
   */
  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback ? (
        this.props.fallback(this.state.error)
      ) : (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error.message}</p>
          {this.state.error && (
            <details style={{ whiteSpace: 'pre-wrap' }}>
              {this.state.error.toString()}
              <br />
              {this.state.error.stack}
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export function withErrorBoundary<P>(
  Component: React.ComponentType<P>,
  fallback?: (error: Error) => React.ReactNode
): React.FC<P> {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props as any} />
      </ErrorBoundary>
    );
  };
}

export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);
  
  if (error) {
    throw error;
  }
  
  return (error: Error) => {
    setError(error);
  };
}
