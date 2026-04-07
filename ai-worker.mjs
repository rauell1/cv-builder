#!/usr/bin/env node
/**
 * AI Worker — Isolated child process for z-ai-web-dev-sdk calls.
 * 
 * Communication: JSON over stdin/stdout
 * - Input (stdin): { type: "chat" | "vision", model, messages, timeout }
 * - Output (stdout): { ok: true, content: string } | { ok: false, error: string }
 */

import ZAI from 'z-ai-web-dev-sdk';

let _zai = null;

async function getZAI() {
  if (!_zai) {
    _zai = await ZAI.create();
  }
  return _zai;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`AI call timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function handleRequest(req) {
  try {
    if (req.type === 'chat') {
      const zai = await getZAI();
      const completion = await withTimeout(
        zai.chat.completions.create({
          model: req.model,
          messages: req.messages,
          thinking: { type: 'disabled' },
        }),
        req.timeout || 15_000,
      );
      const content = completion.choices?.[0]?.message?.content;
      if (!content) return { ok: false, error: 'AI returned empty content' };
      return { ok: true, content };
    }

    if (req.type === 'vision') {
      const zai = await getZAI();
      const completion = await withTimeout(
        zai.chat.completions.createVision({
          model: req.model,
          messages: req.messages,
        }),
        req.timeout || 30_000,
      );
      const content = completion.choices?.[0]?.message?.content;
      if (!content) return { ok: false, error: 'Vision AI returned empty content' };
      return { ok: true, content };
    }

    return { ok: false, error: `Unknown request type: ${req.type}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Main: read stdin line-by-line, process, write to stdout, exit
process.stdin.setEncoding('utf8');
let buffer = '';

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  while (buffer.includes('\n')) {
    const idx = buffer.indexOf('\n');
    const line = buffer.substring(0, idx).trim();
    buffer = buffer.substring(idx + 1);
    if (!line) continue;
    // Process synchronously (one request at a time, no race conditions)
    (async () => {
      try {
        const req = JSON.parse(line);
        const result = await handleRequest(req);
        // Use write callback to ensure flush before exit
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (err) {
        process.stdout.write(JSON.stringify({ ok: false, error: 'Invalid request: ' + String(err) }) + '\n');
      }
    })();
  }
});

process.stdin.on('end', () => {
  // Give time for the async handler to complete (max 25s for slow API calls)
  setTimeout(() => {
    process.exit(0);
  }, 25_000);
});

process.on('uncaughtException', (err) => {
  console.error('[ai-worker] Uncaught exception:', err.message);
  process.exit(1);
});

process.stdin.resume();
