# Codebase map: significant-change rules

These rules define what should trigger reviewing or regenerating the architectural map (`npm run map:update`).

## Always significant

- New, deleted, or renamed files under `src/`, `prisma/`, or root config (`middleware.ts`, `next.config.ts`).
- Changes to `package.json` or `package-lock.json` (dependency graph or scripts).
- Changes to `prisma/schema.prisma` (data model).
- Any edit under `src/app/api/**` (HTTP contract).
- Edits to shared contracts: `src/lib/cv-types.ts`, Zod schemas consumed by routes, `src/lib/api-calls.ts`.

## Often significant

- `src/lib/ai-provider.ts` (all LLM traffic).
- `src/lib/middleware` policy: `src/lib/ai-rate-limit-paths.ts` (must match real routes; run `npm run map:check-parity`).
- Large route modules (`extract-file`, `generate-pdf`, etc.) — prefer splitting when touching repeatedly.

## Usually not significant (for map freshness)

- Comment-only or whitespace-only edits.
- Changes confined to `docs/codebase-map.md` / `docs/codebase-map.json` from the generator itself.
- Pure styling in a single component with no import/API changes.

## Automation hooks

- **Post-commit** (Husky): regenerates the map when relevant paths change.
- **CI**: runs `map:update` and fails if generated files drift from committed output.
