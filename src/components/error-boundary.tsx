'use client';

import React, { Component, createContext, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RotateCcw } from 'lucide-react';

// Context to allow programmatic reset from child components
interface ErrorBoundaryContextValue {
  reset: () => void;
}

const ErrorBoundaryContext = createContext<ErrorBoundaryContextValue>({
  reset: () => {},
});

export function useErrorBoundary() {
  return useContext(ErrorBoundaryContext);
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInner extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorBoundaryContext.Provider value={{ reset: this.handleReset }}>
          <DefaultErrorFallback
            error={this.state.error}
            onReset={this.handleReset}
          />
        </ErrorBoundaryContext.Provider>
      );
    }

    return (
      <ErrorBoundaryContext.Provider value={{ reset: this.handleReset }}>
        {this.props.children}
      </ErrorBoundaryContext.Provider>
    );
  }
}

function DefaultErrorFallback({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="max-w-md w-full border-red-200 bg-red-50">
        <CardContent className="py-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold text-zinc-800 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-zinc-600 mb-4">
            An unexpected error occurred. This has been logged for review.
            {error?.message && (
              <span className="block mt-2 text-xs text-zinc-500 font-mono bg-white rounded p-2 border border-zinc-200">
                {error.message}
              </span>
            )}
          </p>
          <Button
            onClick={onReset}
            variant="outline"
            className="border-zinc-300 hover:bg-zinc-100"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export { ErrorBoundaryInner as ErrorBoundary };
export { ErrorBoundaryContext };
