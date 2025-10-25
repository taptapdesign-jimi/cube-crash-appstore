// Error Boundary for App Store compliance
export class ErrorBoundary {
  private static instance: ErrorBoundary;
  private errorHandler?: (error: Error, errorInfo: any) => void;

  static getInstance(): ErrorBoundary {
    if (!ErrorBoundary.instance) {
      ErrorBoundary.instance = new ErrorBoundary();
    }
    return ErrorBoundary.instance;
  }

  init(): void {
    // Error boundary is already initialized via global event listeners
    // This method exists for consistency with other managers
  }

  setErrorHandler(handler: (error: Error, errorInfo: any) => void): void {
    this.errorHandler = handler;
  }

  handleError(error: Error, errorInfo: any): void {
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    if (this.errorHandler) {
      this.errorHandler(error, errorInfo);
    }
    
    // Report to analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: false
      });
    }
  }

  wrapFunction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      try {
        return fn(...args);
      } catch (error) {
        this.handleError(error as Error, { function: fn.name, args });
        throw error;
      }
    }) as T;
  }
}

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    ErrorBoundary.getInstance().handleError(event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    ErrorBoundary.getInstance().handleError(new Error(event.reason), {
      type: 'unhandledrejection'
    });
  });
}
