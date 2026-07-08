import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * TEMPORARY diagnostic route — probes each configured NVIDIA key against the
 * live API from inside Vercel's network and reports status/latency/body
 * snippets. Exposes no key material. Delete once the AI outage is resolved.
 */
export async function GET(req: NextRequest) {
  const keysStr = process.env.NVIDIA_API_KEY || '';
  const keys = keysStr.split(',').map((k) => k.trim()).filter(Boolean);
  const model = req.nextUrl.searchParams.get('model') || 'meta/llama-3.3-70b-instruct';

  const results: Array<Record<string, unknown>> = [];
  for (let i = 0; i < keys.length; i++) {
    const t0 = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${keys[i]}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with the single word OK' }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });
      const text = await res.text();
      clearTimeout(timer);
      results.push({ key: i + 1, status: res.status, ms: Date.now() - t0, body: text.substring(0, 250) });
    } catch (e) {
      clearTimeout(timer);
      results.push({ key: i + 1, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 });
    }
  }

  return NextResponse.json({ keyCount: keys.length, model, results });
}
