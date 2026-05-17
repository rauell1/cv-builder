/**
 * ApiKeyBanner
 *
 * Shows a dismissible warning banner when NO provider API keys are configured
 * server-side. Uses useProviderStatus() which fetches from /api/health
 * (server-side) rather than reading process.env directly in the browser.
 *
 * States:
 *  - loading   → render nothing (avoids flash-of-warning on first paint)
 *  - configured → render nothing (keys are present, all good)
 *  - unconfigured → show the warning banner
 */

'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useProviderStatus } from '@/hooks/use-provider-status';

export function ApiKeyBanner() {
  const status = useProviderStatus();
  const [dismissed, setDismissed] = useState(false);

  // Do not render anything while loading or if keys are present or user dismissed
  if (status !== 'unconfigured' || dismissed) return null;

  return (
    <Alert
      variant="destructive"
      className="mb-4 relative pr-10"
      role="alert"
      aria-live="polite"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>API Keys Not Configured</AlertTitle>
      <AlertDescription>
        No AI provider API keys were found. Add at least one of the following to
        your Vercel project environment variables and redeploy:{' '}
        <code className="font-mono text-xs">
          NVIDIA_API_KEY, ZHIPU_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY,
          GOOGLE_AI_API_KEY
        </code>
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss warning"
      >
        <X className="h-3 w-3" />
      </Button>
    </Alert>
  );
}
