-- Row-Level Security for public tables.
--
-- Prisma connects as the `neondb_owner` role, which owns every table here and
-- therefore always bypasses RLS (Postgres default: table owners are exempt
-- unless FORCE ROW LEVEL SECURITY is set, which we deliberately do NOT set -
-- forcing it would break the app's own writes). So enabling RLS changes
-- nothing for the app itself.
--
-- What it protects against: this project has Neon's Data API enabled
-- (a PostgREST-compatible REST endpoint, separate from the app, using the
-- `anonymous`/`authenticated`/`authenticator` Postgres roles). As of the last
-- audit, none of those roles have been GRANTed any table privileges here, so
-- the Data API currently can't reach these tables regardless of RLS - but
-- that's one GRANT away from exposing everything (e.g. an "expose to Data
-- API" toggle in the Neon console typically issues that GRANT automatically).
-- RLS with no policies is a second, independent lock: even if a future GRANT
-- gives those roles table access, RLS-enabled-with-no-policies still denies
-- every row to any non-owner role by default.
--
-- Since the app doesn't use the Data API at all, the cleanest fix is to
-- disable it entirely in the Neon console (Project -> Settings -> Data API).
-- This file is the fallback/defense-in-depth layer in case it's ever
-- re-enabled or a table gets exposed by accident.
--
-- `prisma db push` does not manage RLS - re-run this file after any
-- `prisma db push --accept-data-loss` that drops and recreates a table.

ALTER TABLE "CVSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyRateLimit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GenerationEvent" ENABLE ROW LEVEL SECURITY;
