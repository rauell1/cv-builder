'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full border-border shadow-stripe-sm rounded-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-lg font-semibold text-foreground">
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. This has been logged for debugging.
            You can try again or return to the home page.
          </p>
          {error.message && (
            <div className="rounded-lg bg-muted p-3 text-left">
              <p className="text-xs font-mono text-muted-foreground break-words">
                {error.message.length > 200
                  ? error.message.substring(0, 200) + '...'
                  : error.message}
              </p>
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={reset}
              className="gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </Button>
            <Button
              variant="default"
              onClick={() => (window.location.href = '/')}
              className="gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
