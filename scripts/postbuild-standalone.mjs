import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const nextDir = resolve('.next');
const standaloneDir = resolve(nextDir, 'standalone');
const standaloneNextDir = resolve(standaloneDir, '.next');
const staticDir = resolve(nextDir, 'static');
const publicDir = resolve('public');

if (!existsSync(standaloneDir)) {
  console.warn('[postbuild] Standalone output not found at .next/standalone. Skipping copy step.');
  process.exit(0);
}

mkdirSync(standaloneNextDir, { recursive: true });

if (existsSync(staticDir)) {
  cpSync(staticDir, resolve(standaloneNextDir, 'static'), { recursive: true, force: true });
}

if (existsSync(publicDir)) {
  cpSync(publicDir, resolve(standaloneDir, 'public'), { recursive: true, force: true });
}

console.warn('[postbuild] Copied static assets into standalone output.');
