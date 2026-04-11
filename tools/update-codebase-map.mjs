#!/usr/bin/env node
/**
 * Regenerates docs/codebase-map.md, docs/codebase-map.json, and docs/diagrams/codebase-map.mmd.
 * Tracks file hashes in .codebase-map-cache.json (gitignored) for change detection metadata.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CACHE_FILE = path.join(ROOT, '.codebase-map-cache.json');
const OUT_MD = path.join(ROOT, 'docs/codebase-map.md');
const OUT_JSON = path.join(ROOT, 'docs/codebase-map.json');
const OUT_MMD = path.join(ROOT, 'docs/diagrams/codebase-map.mmd');

const IGNORE_DIRS = new Set([
  'node_modules',
  '.next',
  'out',
  'upload',
  'examples',
  'mini-services',
  'skills',
]);

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.prisma']);

const ROOT_FILES = ['middleware.ts', 'next.config.ts', 'watchdog.ts'];

/** @type {Set<string>} */
const EXTERNAL_PREFIXES = new Set([
  'node:',
  '@next/',
  'next/',
  'react',
  '@radix-ui/',
  'lucide-react',
  'framer-motion',
  'zod',
  '@prisma',
  'prisma',
  'pdf-lib',
  'mammoth',
  'pdf-parse',
  'uuid',
  'date-fns',
  'sonner',
  'vaul',
  'cmdk',
  'embla-carousel-react',
  'recharts',
  'geist',
  'input-otp',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  'tailwindcss',
  'z-ai-web-dev-sdk',
  'zustand',
  'react-hook-form',
  'react-day-picker',
  'react-resizable-panels',
  '@pdf-lib',
]);

function isExternal(spec) {
  if (spec.startsWith('node:')) return true;
  if (spec.startsWith('@/')) return false;
  if (spec.startsWith('.') || spec.startsWith('/')) return false;
  for (const p of EXTERNAL_PREFIXES) {
    if (spec === p || spec.startsWith(p + '/')) return true;
  }
  return true;
}

function normalizeRel(p) {
  return p.split(path.sep).join('/');
}

function sha256File(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function listProjectFiles() {
  /** @type {string[]} */
  const files = [];

  function walkDir(dir, relBase) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const name = e.name;
      if (name.startsWith('.')) continue;
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(name)) continue;
        walkDir(path.join(dir, name), path.join(relBase, name));
      } else {
        const rel = normalizeRel(path.join(relBase, name));
        const ext = path.extname(name);
        if (SCAN_EXTENSIONS.has(ext) || ROOT_FILES.includes(rel)) {
          files.push(rel);
        }
      }
    }
  }

  walkDir(path.join(ROOT, 'src'), 'src');
  walkDir(path.join(ROOT, 'prisma'), 'prisma');

  for (const rf of ROOT_FILES) {
    const abs = path.join(ROOT, rf);
    if (fs.existsSync(abs)) files.push(rf);
  }

  return [...new Set(files)].sort();
}

/**
 * @param {string} content
 * @returns {string[]}
 */
function extractImportSpecs(content) {
  const specs = new Set();
  const patterns = [
    /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      specs.add(m[1]);
    }
  }
  return [...specs];
}

/**
 * @param {string} spec
 * @param {string} fromFileRel posix path from ROOT
 * @returns {string | null} resolved project-relative path or null
 */
function resolveImport(spec, fromFileRel) {
  if (isExternal(spec)) return null;
  if (spec.startsWith('@/')) {
    const rest = spec.slice(2);
    return normalizeRel(path.join('src', rest));
  }
  if (!spec.startsWith('.')) return null;
  const dir = path.dirname(fromFileRel);
  const resolved = normalizeRel(path.join(dir, spec));
  const candidates = [
    resolved,
    resolved + '.ts',
    resolved + '.tsx',
    resolved + '.js',
    resolved + '/index.ts',
    resolved + '/index.tsx',
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(ROOT, c))) return c;
  }
  return null;
}

function collectApiRoutes() {
  const apiRoot = path.join(ROOT, 'src/app/api');
  if (!fs.existsSync(apiRoot)) return [];

  /** @type {{ path: string, file: string }[]} */
  const routes = [];

  function walk(dir, segments) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(p, [...segments, e.name]);
      } else if (e.name.startsWith('route.') && e.name.endsWith('.ts')) {
        const urlPath = '/api' + (segments.length ? '/' + segments.join('/') : '');
        routes.push({
          path: urlPath,
          file: normalizeRel(path.relative(ROOT, p)),
        });
      }
    }
  }

  walk(apiRoot, []);
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

function getGitInfo() {
  try {
    const commit = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const short = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    let baseCommit = null;
    try {
      if (fs.existsSync(OUT_JSON)) {
        const prev = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
        baseCommit = prev.version?.commit ?? null;
      }
    } catch {
      /* ignore */
    }
    /** @type {string[]} */
    const changeSummary = [];
    let diffStat = '';
    if (baseCommit && baseCommit !== commit) {
      try {
        diffStat = execSync(`git diff --stat ${baseCommit}..HEAD -- .`, {
          cwd: ROOT,
          encoding: 'utf8',
          maxBuffer: 5 * 1024 * 1024,
        });
        const names = execSync(`git diff --name-status ${baseCommit}..HEAD -- .`, {
          cwd: ROOT,
          encoding: 'utf8',
          maxBuffer: 5 * 1024 * 1024,
        })
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        for (const line of names.slice(0, 40)) {
          changeSummary.push(line);
        }
        if (names.length > 40) changeSummary.push(`… and ${names.length - 40} more paths`);
      } catch {
        changeSummary.push('(could not diff against previous map commit)');
      }
    }
    return { commit, short, baseCommit, diffStat, changeSummary };
  } catch {
    return {
      commit: 'unknown',
      short: 'unknown',
      baseCommit: null,
      diffStat: '',
      changeSummary: ['(not a git repository or git unavailable)'],
    };
  }
}

function getGitChangedFiles() {
  try {
    const out = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    if (out) return out.split('\n').filter(Boolean).map(normalizeRel);
    const staged = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf8' }).trim();
    return staged ? staged.split('\n').filter(Boolean).map(normalizeRel) : [];
  } catch {
    return [];
  }
}

function getHotspots() {
  try {
    const out = execSync(
      'git log -200 --name-only --pretty=format: -- src middleware.ts prisma next.config.ts',
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    const counts = new Map();
    for (const line of out.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([file, commitTouches]) => ({ file, commitTouches }));
  } catch {
    return [];
  }
}

/**
 * @param {string} rel
 */
function riskForPath(rel) {
  if (rel === 'middleware.ts' || rel.includes('ai-provider.ts') || rel.includes('cv-types.ts')) {
    return 'high';
  }
  if (rel.includes('api-calls.ts') || rel.includes('/app/api/')) return 'medium';
  return 'low';
}

function buildImportGraph(files) {
  /** @type {{ from: string, to: string }[]} */
  const edges = [];
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    if (!rel.endsWith('.ts') && !rel.endsWith('.tsx') && !rel.endsWith('.mts')) continue;
    const content = fs.readFileSync(abs, 'utf8');
    for (const spec of extractImportSpecs(content)) {
      const to = resolveImport(spec, rel);
      if (to && files.includes(to)) {
        edges.push({ from: rel, to, kind: 'import' });
      }
    }
  }
  return edges;
}

function closureImporters(changedFiles, edges) {
  /** @type {Set<string>} */
  const affected = new Set(changedFiles);
  let added = true;
  while (added) {
    added = false;
    for (const e of edges) {
      if (affected.has(e.to) && !affected.has(e.from)) {
        affected.add(e.from);
        added = true;
      }
    }
  }
  return [...affected];
}

function buildTreeLines(files) {
  /** @type {Map<string, Set<string>>} */
  const children = new Map();
  for (const f of files) {
    const parts = f.split('/');
    for (let i = 0; i < parts.length; i++) {
      const parent = i === 0 ? '__root__' : parts.slice(0, i).join('/');
      const name = parts[i];
      if (!children.has(parent)) children.set(parent, new Set());
      children.get(parent).add(name);
    }
  }

  /** @type {string[]} */
  const lines = [];

  function walk(parent, indent) {
    const names = [...(children.get(parent) || [])].sort();
    for (const name of names) {
      const full = parent === '__root__' ? name : `${parent}/${name}`;
      const isFile = files.includes(full);
      lines.push(`${indent}${name}${isFile ? '' : '/'}`);
      if (!isFile) walk(full, `${indent}  `);
    }
  }

  walk('__root__', '');
  return lines;
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return { fileHashes: {} };
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function main() {
  const files = listProjectFiles();
  const prevCache = loadCache();
  const hashes = {};
  for (const f of files) {
    hashes[f] = sha256File(path.join(ROOT, f));
  }
  const hashChanged = files.filter((f) => prevCache.fileHashes?.[f] !== hashes[f]);
  const newFiles = files.filter((f) => !prevCache.fileHashes?.[f]);
  const removedFiles = Object.keys(prevCache.fileHashes || {}).filter((f) => !files.includes(f));

  const edges = buildImportGraph(files);
  const gitChanged = getGitChangedFiles();
  const seed = [...new Set([...gitChanged, ...hashChanged])].filter((f) => files.includes(f));
  const affectedModules = seed.length ? closureImporters(seed, edges) : [];

  const routes = collectApiRoutes();
  const git = getGitInfo();
  const hotspots = getHotspots();

  const nodes = files.map((id) => ({
    id,
    path: id,
    risk: riskForPath(id),
  }));

  const pkgChanged = hashChanged.includes('package.json') || newFiles.includes('package.json');
  const prismaChanged =
    hashChanged.some((f) => f.startsWith('prisma/')) || newFiles.some((f) => f.startsWith('prisma/'));

  const incrementalMode =
    !pkgChanged &&
    !prismaChanged &&
    hashChanged.length > 0 &&
    hashChanged.length < files.length * 0.45;

  const generatedAt = new Date().toISOString();

  const json = {
    version: {
      commit: git.commit,
      short: git.short,
      generatedAt,
      baseCommit: git.baseCommit,
      changeSummary: git.changeSummary,
      diffStat: git.diffStat ? git.diffStat.slice(0, 8000) : '',
    },
    significantChangeHints: {
      description:
        'Significant: changes under src/, prisma/, middleware.ts, next.config.ts, package.json; API routes; shared types (cv-types); dependency/import graph changes.',
      incremental: incrementalMode,
      hashChangedFiles: hashChanged,
      newFiles,
      removedFiles,
      packageJsonChanged: pkgChanged || newFiles.includes('package-lock.json'),
      prismaChanged,
    },
    tree: buildTreeLines(files),
    nodes,
    edges,
    apiRoutes: routes,
    hotspots,
    affectedModules: affectedModules.sort(),
    metrics: {
      fileCount: files.length,
      edgeCount: edges.length,
    },
  };

  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_MMD), { recursive: true });

  const mmd = `flowchart LR
  subgraph client["Browser"]
    Page["app/page.tsx"]
    Store["cv-store"]
    ApiCalls["api-calls.ts"]
    Page --> Store
    Page --> ApiCalls
  end
  subgraph edge["Edge"]
    MW["middleware.ts"]
  end
  subgraph server["Node_Server"]
    Routes["app/api/*/route.ts"]
    AI["ai-provider.ts"]
    Queue["request-queue"]
    Cache["response-cache"]
    DB["Prisma"]
    PDF["pdf-utils"]
  end
  ApiCalls -->|HTTP| MW
  MW --> Routes
  Routes --> AI
  Routes --> Queue
  Routes --> Cache
  Routes --> DB
  Routes --> PDF
`;

  const md = `# Codebase map

Auto-generated by \`npm run map:update\` — do not edit by hand.

## Version

| Field | Value |
|-------|-------|
| Commit | \`${json.version.commit}\` |
| Short | \`${json.version.short}\` |
| Generated (UTC) | ${json.version.generatedAt} |
| Previous map commit | ${json.version.baseCommit || '(none)'} |
| Incremental hint | ${incrementalMode ? 'yes' : 'full or first run'} |

## Changes since previous map version

${json.version.changeSummary.map((l) => `- ${l}`).join('\n')}

## Directory tree (src, prisma, root config)

\`\`\`text
${json.tree.join('\n')}
\`\`\`

## HTTP API routes

| Path | Source file |
|------|-------------|
${routes.map((r) => `| \`${r.path}\` | \`${r.file}\` |`).join('\n')}

## Metrics

- Files scanned: ${json.metrics.fileCount}
- Import edges (internal): ${json.metrics.edgeCount}
- Hotspot files (recent commit touches): see \`hotspots\` in JSON

## Interaction diagram

See [diagrams/codebase-map.mmd](diagrams/codebase-map.mmd) (Mermaid).

## Machine-readable output

Full graph and metadata: [docs/codebase-map.json](codebase-map.json)

---

Rules for significant changes: [codebase-map-rules.md](codebase-map-rules.md)
`;

  fs.writeFileSync(OUT_MD, md, 'utf8');
  fs.writeFileSync(OUT_JSON, JSON.stringify(json, null, 2), 'utf8');
  fs.writeFileSync(OUT_MMD, mmd, 'utf8');

  saveCache({ fileHashes: hashes, lastGeneratedAt: generatedAt, lastCommit: git.commit });

  process.stdout.write(
    `[codebase-map] Wrote ${normalizeRel(path.relative(ROOT, OUT_MD))}\n` +
      `[codebase-map] Wrote ${normalizeRel(path.relative(ROOT, OUT_JSON))}\n` +
      `[codebase-map] Wrote ${normalizeRel(path.relative(ROOT, OUT_MMD))}\n`
  );
}

main();
