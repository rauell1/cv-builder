#!/usr/bin/env node
/**
 * Ensures each path in AI_RATE_LIMIT_PATHS has a matching App Router handler
 * under src/app/api/<segments>/route.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PATHS_FILE = path.join(ROOT, 'src/lib/ai-rate-limit-paths.ts');

function extractPaths() {
  const content = fs.readFileSync(PATHS_FILE, 'utf8');
  const paths = [];
  const re = /'(\/api\/[^']+)'/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    paths.push(m[1]);
  }
  return paths;
}

function routeFileForApiPath(apiPath) {
  const rest = apiPath.replace(/^\/api\/?/, '');
  if (!rest) return path.join(ROOT, 'src/app/api/route.ts');
  return path.join(ROOT, 'src/app/api', ...rest.split('/'), 'route.ts');
}

let failed = false;
const paths = extractPaths();
for (const p of paths) {
  const file = routeFileForApiPath(p);
  if (!fs.existsSync(file)) {
    console.error(`[parity] Missing route for AI rate-limit path ${p} (expected ${path.relative(ROOT, file)})`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
process.stdout.write(`[parity] OK — ${paths.length} AI rate-limit paths have matching route files.\n`);
