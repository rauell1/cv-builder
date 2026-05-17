# Rollback Procedures

> Safe, tested rollback steps for every layer of the cv-builder stack.
> When in doubt: **revert code first, investigate second.**

---

## 1. Code Rollback (Vercel — Instant)

The fastest rollback — no git required.

### Via Vercel Dashboard (30 seconds)
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard) → `cv-builder` project.
2. Click **Deployments** tab.
3. Find the last known-good deployment (green checkmark).
4. Click the `⋯` menu → **Promote to Production**.
5. Done — traffic switches instantly with zero downtime.

### Via Vercel CLI
```bash
npx vercel rollback [deployment-url-or-id]
```

---

## 2. Git Rollback

### Revert a single bad commit (safe — creates a new commit)
```bash
git revert <bad-commit-sha>
git push origin main
```
Vercel picks this up and redeploys automatically.

### Hard reset to a previous commit (destructive — use with care)
```bash
git reset --hard <good-commit-sha>
git push origin main --force-with-lease
```
> ⚠️ Only use `--force-with-lease` on `main` if you are the only developer or have confirmed with the team.

### Find the last good commit
```bash
git log --oneline -20
# Copy the SHA of the last commit before things broke
```

---

## 3. Environment Variable Rollback

If a bad API key or config value caused the issue:

1. Go to Vercel → Project → **Settings** → **Environment Variables**.
2. Find the variable that changed.
3. Click **Edit** and restore the previous value.
4. Click **Save** — Vercel will offer to redeploy; accept it.

### If you rotated a key and old one is gone
- NVIDIA: generate a new key at [build.nvidia.com](https://build.nvidia.com) → API Keys.
- OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
- Anthropic: [console.anthropic.com](https://console.anthropic.com).
- Google: [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
- Zhipu: [open.bigmodel.cn](https://open.bigmodel.cn).

---

## 4. AI Provider Failover (Runtime — No Deploy Needed)

If a provider is down but code is fine:

The system self-heals automatically:
- A failed key is marked down for **5 minutes**, then retried.
- A failed model falls through to the next in the race.
- No manual action needed for transient outages.

If a provider is **permanently down** (e.g., API deprecated):
1. In `ai-provider.ts`, set `status: 'disabled'` on the affected models in `TASK_MODEL_PREFERENCES`.
2. Push to main → Vercel redeploys in ~1 minute.

---

## 5. Build Failure Rollback

If a push broke the Vercel build:

1. **Immediate**: Promote last good deployment via Vercel dashboard (step 1 above).
2. **Fix**: Check the build log in Vercel → Deployments → failed deployment → View Logs.
3. **Most common errors**:
   - `Module has no exported member` → renamed export not updated in importers.
   - `Type error` → TypeScript strict mode violation.
   - `Cannot find module` → new file not committed or wrong path alias.
4. Fix the error, push to main, verify build passes.

---

## 6. Dependency Rollback

If an `npm` package update broke something:

```bash
# Check what changed
git diff HEAD~1 package-lock.json | grep '"version"' | head -30

# Pin the bad package to its previous version
npm install some-package@<previous-version>
git add package.json package-lock.json
git commit -m "fix: pin some-package to <previous-version>"
git push
```

---

## 7. Emergency Contacts / Status Pages

| Service | Status page |
|---------|-------------|
| Vercel | [vercel-status.com](https://www.vercel-status.com) |
| NVIDIA NIM | [status.ngc.nvidia.com](https://status.ngc.nvidia.com) |
| OpenAI | [status.openai.com](https://status.openai.com) |
| Anthropic | [status.anthropic.com](https://status.anthropic.com) |
| Google AI | [status.cloud.google.com](https://status.cloud.google.com) |

---

## Rollback Decision Tree

```
Something broke in production
        │
        ▼
Is it a UI/code issue? ──YES──► Promote last good Vercel deployment (Step 1)
        │
       NO
        │
        ▼
Is it an env var / API key issue? ──YES──► Fix in Vercel env vars (Step 3)
        │
       NO
        │
        ▼
Is one AI provider down? ──YES──► Wait 5 min (auto-heal) or disable in ai-provider.ts (Step 4)
        │
       NO
        │
        ▼
Is the build failing? ──YES──► Check Vercel build logs → fix TypeScript/import error (Step 5)
        │
       NO
        │
        ▼
Git revert the last commit (Step 2)
```
