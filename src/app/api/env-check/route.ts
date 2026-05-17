/**
 * GET /api/env-check?token=<HEALTH_DEBUG_TOKEN>
 *
 * Live diagnostic endpoint — shows which environment variables are found
 * and how many keys are available per NVIDIA slot, WITHOUT exposing
 * the actual key values.
 *
 * Requires HEALTH_DEBUG_TOKEN env var to be set and matched.
 * Visit this URL after every Vercel deployment to verify your env vars
 * are being picked up correctly.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getProviderCredentialDetails,
  getNvidiaSlotDiagnostics,
  getAllProviderKeys,
} from '@/lib/ai-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? request.nextUrl.searchParams.get('debug');
  const expectedToken = process.env.HEALTH_DEBUG_TOKEN;
  if (!expectedToken || !token || token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const details = getProviderCredentialDetails();
  const nvidiaSlots = getNvidiaSlotDiagnostics();

  // Count keys per non-NVIDIA provider (safe — counts only, no values)
  const keyCounts: Record<string, number> = {};
  for (const provider of ['glm', 'openai', 'anthropic', 'google'] as const) {
    keyCounts[provider] = getAllProviderKeys(provider).length;
  }

  // Build a human-friendly summary
  const summary: Record<string, unknown> = {
    status: details.anyConfigured ? 'ok' : 'no_providers_configured',
    timestamp: new Date().toISOString(),
    providers: {
      nvidia: {
        configured: details.status.nvidia,
        sourcesFound: details.sources.nvidia,
        slots: {
          MISTRAL: {
            keysFound: nvidiaSlots.MISTRAL.keyCount,
            healthyKeys: nvidiaSlots.MISTRAL.healthyKeys,
            modelId: nvidiaSlots.MISTRAL.modelId,
            baseUrl: nvidiaSlots.MISTRAL.baseUrl,
            envVarsRead: ['NVIDIA_MISTRAL_KEYS', 'NVIDIA_MISTRAL_KEY', 'NVIDIA_MISTRAL_MODEL', 'NVIDIA_MISTRAL_URL'],
          },
          DEEPSEEK: {
            keysFound: nvidiaSlots.DEEPSEEK.keyCount,
            healthyKeys: nvidiaSlots.DEEPSEEK.healthyKeys,
            modelId: nvidiaSlots.DEEPSEEK.modelId,
            baseUrl: nvidiaSlots.DEEPSEEK.baseUrl,
            envVarsRead: ['NVIDIA_DEEPSEEK_KEYS', 'NVIDIA_DEEPSEEK_KEY', 'NVIDIA_DEEPSEEK_MODEL', 'NVIDIA_DEEPSEEK_URL'],
          },
          KIMI: {
            keysFound: nvidiaSlots.KIMI.keyCount,
            healthyKeys: nvidiaSlots.KIMI.healthyKeys,
            modelId: nvidiaSlots.KIMI.modelId,
            baseUrl: nvidiaSlots.KIMI.baseUrl,
            envVarsRead: ['NVIDIA_KIMI_KEYS', 'NVIDIA_KIMI_KEY', 'KIMI_KEYS', 'KIMI_KEY', 'NVIDIA_KIMI_MODEL', 'NVIDIA_KIMI_URL'],
          },
        },
      },
      openai:    { configured: details.status.openai,    keyCount: keyCounts.openai,    sourcesFound: details.sources.openai },
      anthropic: { configured: details.status.anthropic, keyCount: keyCounts.anthropic, sourcesFound: details.sources.anthropic },
      google:    { configured: details.status.google,    keyCount: keyCounts.google,    sourcesFound: details.sources.google },
      glm:       { configured: details.status.glm,       keyCount: keyCounts.glm,       sourcesFound: details.sources.glm },
    },
    zaiSdkFallback: details.zaiSdkFallback,
    help: {
      message: 'If keysFound is 0 for a slot you expect to have keys, the env var name does not match what the code is reading.',
      nvidiaKeyVarNames: {
        MISTRAL:  'NVIDIA_MISTRAL_KEYS or NVIDIA_MISTRAL_KEY (comma-separated for multiple)',
        DEEPSEEK: 'NVIDIA_DEEPSEEK_KEYS or NVIDIA_DEEPSEEK_KEY (comma-separated for multiple)',
        KIMI:     'NVIDIA_KIMI_KEYS or NVIDIA_KIMI_KEY (comma-separated for multiple)',
        generic:  'NVIDIA_API_KEY (fallback pool used by any model)',
      },
      otherProviders: {
        openai:    'OPENAI_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        google:    'GOOGLE_AI_API_KEY',
        glm:       'ZHIPU_API_KEY',
      },
    },
  };

  const httpStatus = details.anyConfigured ? 200 : 503;
  return NextResponse.json(summary, { status: httpStatus });
}
