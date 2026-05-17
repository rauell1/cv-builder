/**
 * GET /api/health
 *
 * Returns provider credential status — safe for client polling.
 * Never exposes key values, only whether each provider is configured.
 *
 * GET /api/health?debug=1
 * Returns additional diagnostics (which env var names resolved), for
 * server-side debugging only. Strip or gate behind auth in production
 * if needed.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getProviderCredentialDetails,
  getProviderApiKey,
  type AIProvider,
} from '@/lib/ai-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER_ENV_ALIASES: Record<AIProvider, string[]> = {
  glm:       ['ZHIPU_API_KEY', 'GLM_API_KEY', 'BIGMODEL_API_KEY'],
  openai:    ['OPENAI_API_KEY', 'OPENAI_KEY'],
  anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  google:    ['GOOGLE_AI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY'],
  pekpik:    ['PEKPIK_API_KEY', 'PEKPIK_KEY'],
  nvidia:    ['NVIDIA_API_KEY', 'NVIDIA_NIM_API_KEY'],
};

function scrubKey(val: string | undefined): string {
  if (!val || val.length < 8) return val ? '****' : '(empty)';
  return val.substring(0, 4) + '****' + val.slice(-4);
}

export async function GET(request: NextRequest) {
  const details = getProviderCredentialDetails();

  const debugToken = request.nextUrl.searchParams.get('debug');
  const expectedToken = process.env.HEALTH_DEBUG_TOKEN;
  // Debug mode requires HEALTH_DEBUG_TOKEN env var to be set and matched
  const isDebug = Boolean(
    debugToken && expectedToken && debugToken === expectedToken
  );

  // Debug block: show which env var names exist and scrubbed prefix/suffix
  let debugInfo: Record<string, unknown> | undefined;
  if (isDebug) {
    const envDump: Record<string, unknown> = {};
    for (const [provider, aliases] of Object.entries(PROVIDER_ENV_ALIASES) as [AIProvider, string[]][]) {
      const found: { name: string; value: string }[] = [];
      for (const alias of aliases) {
        const raw = process.env[alias]?.trim();
        if (raw) found.push({ name: alias, value: scrubKey(raw) });
      }
      // Also check NEXT_PUBLIC_ prefixed variants
      for (const alias of aliases) {
        const pubName = `NEXT_PUBLIC_${alias}`;
        const raw = process.env[pubName]?.trim();
        if (raw) found.push({ name: pubName, value: scrubKey(raw) });
      }
      const resolved = getProviderApiKey(provider as AIProvider);
      envDump[provider] = {
        envVarsFound: found,
        resolvedKey: scrubKey(resolved ?? undefined),
        configured: details.status[provider as AIProvider],
      };
    }
    debugInfo = {
      envDump,
      zaiSdkFallback: process.env.ZAI_SDK_FALLBACK,
      nodeEnv: process.env.NODE_ENV,
      allEnvKeys: Object.keys(process.env)
        .filter(k =>
          /(api[_-]?key|secret|token|nvidia|openai|anthropic|google|zhipu|glm|gemini|bigmodel)/i.test(k)
        )
        .map(k => ({ name: k, value: scrubKey(process.env[k]) })),
    };
  }

  return NextResponse.json(
    {
      status: 'ok',
      providers: {
        anyConfigured: details.anyConfigured,
        glm:       details.status.glm,
        openai:    details.status.openai,
        anthropic: details.status.anthropic,
        google:    details.status.google,
        pekpik:    details.status.pekpik,
        nvidia:    details.status.nvidia,
        zaiSdkFallback: details.zaiSdkFallback,
      },
      ...(isDebug ? { debug: debugInfo } : {}),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache',
        'Pragma': 'no-cache',
      },
    },
  );
}
