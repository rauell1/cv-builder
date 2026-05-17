#!/usr/bin/env node
/**
 * update-docs.mjs
 * ----------------
 * Regenerates CODEBASE_MAP.md and CLAUDE.md with the latest commit SHA + timestamp.
 * Run by: .github/workflows/update-docs.yml on every push to main.
 *
 * This script is intentionally simple and dependency-free (Node built-ins only).
 * It will never break the build — if it fails, it exits 0 so the workflow succeeds.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function safeRead(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function safeWrite(path, content) {
  try {
    writeFileSync(path, content, 'utf8');
    console.log(`✓ Updated ${path}`);
  } catch (e) {
    console.error(`⚠ Could not write ${path}:`, e.message);
  }
}

const sha = run('git rev-parse --short HEAD');
const date = new Date().toISOString().split('T')[0];
const branch = run('git rev-parse --abbrev-ref HEAD');

// Stamp a "Last updated" header into CODEBASE_MAP.md
const mapPath = join(ROOT, 'docs', 'CODEBASE_MAP.md');
let mapContent = safeRead(mapPath);
if (mapContent) {
  // Replace or insert the auto-update line near the top
  const stamp = `> **Auto-updated** on every push to \`main\` by \`.github/workflows/update-docs.yml\`.  \n> Last update: ${date} · commit \`${sha}\` · branch \`${branch}\``;
  mapContent = mapContent.replace(
    /> \*\*Auto-updated\*\*.*?\n> Last .*?\n/s,
    stamp + '\n'
  );
  safeWrite(mapPath, mapContent);
}

// Stamp CLAUDE.md with last updated line
const claudePath = join(ROOT, 'CLAUDE.md');
let claudeContent = safeRead(claudePath);
if (claudeContent) {
  const stamp = `> **Auto-updated**: ${date} · commit \`${sha}\` · branch \`${branch}\``;
  if (claudeContent.includes('> **Auto-updated**')) {
    claudeContent = claudeContent.replace(/> \*\*Auto-updated\*\*:.*\n/, stamp + '\n');
  } else {
    // Insert after the first blockquote block
    claudeContent = claudeContent.replace(
      /^(# CLAUDE\.md.*?\n)/,
      `$1\n${stamp}\n`
    );
  }
  safeWrite(claudePath, claudeContent);
}

console.log(`\ndocs update complete: ${sha} @ ${date}`);
