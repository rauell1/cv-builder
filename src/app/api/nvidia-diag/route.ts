import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * TEMPORARY diagnostic route — probes NVIDIA connectivity and one key at a
 * time from inside Vercel's network. Exposes no key material.
 * Usage:
 *   /api/nvidia-diag            -> connectivity check only (no auth)
 *   /api/nvidia-diag?key=1      -> probe key #1 with a tiny completion
 *   /api/nvidia-diag?key=1&model=meta/llama-3.3-70b-instruct
 * Delete once the AI outage is resolved.
 */
async function timedFetch(url: string, init: RequestInit, timeoutMs: number) {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    clearTimeout(timer);
    return { status: res.status, ms: Date.now() - t0, body: text.substring(0, 250) };
  } catch (e) {
    clearTimeout(timer);
    return { error: e instanceof Error ? `${e.name}: ${e.message}` : String(e), ms: Date.now() - t0 };
  }
}

export async function GET(req: NextRequest) {
  const keysStr = process.env.NVIDIA_API_KEY || '';
  const keys = keysStr.split(',').map((k) => k.trim()).filter(Boolean);
  const keyParam = req.nextUrl.searchParams.get('key');
  const model = req.nextUrl.searchParams.get('model') || 'meta/llama-3.3-70b-instruct';

  // Bare connectivity: no auth, should return 401/404 fast if egress works
  const connectivity = await timedFetch(
    'https://integrate.api.nvidia.com/v1/models',
    { method: 'GET' },
    10_000,
  );

  let keyProbe: Record<string, unknown> | null = null;
  if (keyParam) {
    const idx = parseInt(keyParam, 10) - 1;
    if (idx >= 0 && idx < keys.length) {
      keyProbe = {
        key: idx + 1,
        completion: await timedFetch(
          'https://integrate.api.nvidia.com/v1/chat/completions',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${keys[idx]}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'Reply with the single word OK' }],
              max_tokens: 5,
            }),
          },
          30_000,
        ),
      };
    } else {
      keyProbe = { error: `key index out of range (1-${keys.length})` };
    }
  }

  return NextResponse.json({ keyCount: keys.length, model, connectivity, keyProbe });
}
