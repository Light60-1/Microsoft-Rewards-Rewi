# Configuration Reference

This page mirrors the defaults that ship in `src/config.jsonc` and explains what each field does. Use it as a companion after trimming comments from the JSONC file.

---

## General

| Key | Default | Notes |
| --- | --- | --- |
| `baseURL` | `https://rewards.bing.com` | Microsoft Rewards dashboard root. |
| `sessionPath` | `sessions` | Folder for cookies, fingerprints, and job-state. |
| `dryRun` | `false` | Log actions without executing tasks.

---

## Browser & Fingerprinting

| Key | Default | Notes |
| --- | --- | --- |
| `browser.headless` | `false` | Use `true` for CI or servers. |
| `browser.globalTimeout` | `"30s"` | Accepts milliseconds or readable strings (e.g. `"2min"`). |
| `fingerprinting.saveFingerprint.desktop` | `true` | Persist desktop fingerprint between runs. |
| `fingerprinting.saveFingerprint.mobile` | `true` | Persist mobile fingerprint.

---

## Execution & Job State

| Key | Default | Notes |
| --- | --- | --- |
| `execution.parallel` | `false` | Run desktop and mobile simultaneously. |
| `execution.runOnZeroPoints` | `false` | Skip account when no points remain. |
| `execution.clusters` | `1` | Worker processes. Increase for parallel accounts. |
| `execution.passesPerRun` | `1` | Extra full passes. Keep at `1` to allow job-state skipping. |
| `jobState.enabled` | `true` | Persist daily completion markers. |
| `jobState.dir` | `""` | Custom job-state directory (defaults under `sessionPath`).

> Raising `passesPerRun` intentionally prevents job-state from skipping finished accounts.

---

## Scheduler

| Key | Default | Notes |
| --- | --- | --- |
| `schedule.enabled` | `false` | Enable built-in scheduler loop. |
| `schedule.useAmPm` | `false` | Toggle between `time12` (12h) and `time24` (24h). |
| `schedule.time12` | `"9:00 AM"` | Used when `useAmPm` is `true`. |
| `schedule.time24` | `"09:00"` | Used when `useAmPm` is `false`. |
| `schedule.timeZone` | `Europe/Paris` | IANA timezone for scheduling. |
| `schedule.runImmediatelyOnStart` | `true` | Execute one pass right after startup. |
| `schedule.cron` | - | Optional cron expression(s).

See `docs/schedule.md` for jitter, cron patterns, and vacation integration.

---

## Workers

| Key | Default | Notes |
| --- | --- | --- |
| `workers.doDailySet` | `true` | Daily set. |
| `workers.doMorePromotions` | `true` | Extra promotions. |
| `workers.doPunchCards` | `true` | Punch cards. |
| `workers.doDesktopSearch` | `true` | Desktop search tasks. |
| `workers.doMobileSearch` | `true` | Mobile search tasks. |
| `workers.doDailyCheckIn` | `true` | Mobile check-in. |
| `workers.doReadToEarn` | `true` | Read-to-earn. |
| `workers.bundleDailySetWithSearch` | `true` | Launch desktop search immediately after the daily set.

---

## Search & Diversity

| Key | Default | Notes |
| --- | --- | --- |
| `search.useLocalQueries` | `true` | Use region-aware query pools. |
| `search.settings.useGeoLocaleQueries` | `true` | Inject account country into generated queries. |
| `search.settings.scrollRandomResults` | `true` | Random scrolls for realism. |
| `search.settings.clickRandomResults` | `true` | Occasional safe click-through. |
| `search.settings.retryMobileSearchAmount` | `2` | Retries for mobile search failures. |
| `search.settings.delay.min/max` | `3min` / `5min` | Delay between searches. |
| `queryDiversity.enabled` | `true` | Combine multiple content sources. |
| `queryDiversity.sources` | `["google-trends", "reddit", "local-fallback"]` | Active diversity sources. |
| `queryDiversity.maxQueriesPerSource` | `10` | Cap per source. |
| `queryDiversity.cacheMinutes` | `30` | Cache lifetime in minutes.

---

## Humanization & Vacation

| Key | Default | Notes |
| --- | --- | --- |
| `humanization.enabled` | `true` | Master toggle. |
| `humanization.stopOnBan` | `true` | Halt remaining accounts after a ban. |
| `humanization.immediateBanAlert` | `true` | Send alert instantly on ban. |
| `humanization.actionDelay.min/max` | `500` / `2200` | Extra wait between steps (ms). |
| `humanization.gestureMoveProb` | `0.65` | Chance of micro mouse move. |
| `humanization.gestureScrollProb` | `0.4` | Chance of small scroll. |
| `humanization.allowedWindows` | `[]` | Optional `HH:mm-HH:mm` windows. |
| `vacation.enabled` | `true` | Random monthly break. |
| `vacation.minDays` / `maxDays` | `2` / `4` | Range for skipped days.

---

## Risk Management & Retries

| Key | Default | Notes |
| --- | --- | --- |
| `riskManagement.enabled` | `true` | Adaptive risk scoring. |
| `riskManagement.autoAdjustDelays` | `true` | Increase delays on high risk. |
| `riskManagement.stopOnCritical` | `false` | Stop automation at critical risk. |
| `riskManagement.banPrediction` | `true` | Estimate ban likelihood. |
| `riskManagement.riskThreshold` | `75` | Alert threshold (0-100). |
| `retryPolicy.maxAttempts` | `3` | Generic retry attempts. |
| `retryPolicy.baseDelay` | `1000` | Initial backoff delay (ms or string). |
| `retryPolicy.maxDelay` | `"30s"` | Maximum backoff delay. |
| `retryPolicy.multiplier` | `2` | Backoff multiplier. |
| `retryPolicy.jitter` | `0.2` | Adds randomness to delays.

---

## Networking & Notifications

| Key | Default | Notes |
| --- | --- | --- |
| `proxy.proxyGoogleTrends` | `true` | Route Google Trends calls through the proxy. |
| `proxy.proxyBingTerms` | `true` | Route Bing requests through the proxy. |
| `webhook.enabled` | `false` | Live logs webhook. |
| `conclusionWebhook.enabled` | `false` | Summary webhook. |
| `ntfy.enabled` | `false` | Push notifications via NTFY. |
| `logging.excludeFunc` | `["SEARCH-CLOSE-TABS", "LOGIN-NO-PROMPT", "FLOW"]` | Buckets skipped locally. |
| `logging.webhookExcludeFunc` | same | Buckets skipped in webhook payloads. |
| `logging.redactEmails` | `true` | Mask email addresses in logs. |
| `diagnostics.enabled` | `true` | Capture screenshots/HTML on failure. |
| `diagnostics.maxPerRun` | `2` | Limit capture count per run. |
| `diagnostics.retentionDays` | `7` | Auto-clean old diagnostics. |
| `analytics.enabled` | `true` | Persist account metrics. |
| `analytics.retentionDays` | `30` | Keep analytics data for N days. |
| `analytics.exportMarkdown` | `true` | Write markdown summaries to `reports/`. |
| `analytics.webhookSummary` | `true` | Send analytics summary via webhook.

---

## Buy Mode & Updates

| Key | Default | Notes |
| --- | --- | --- |
| `buyMode.maxMinutes` | `45` | Session length cap when using `-buy`. |
| `update.git` | `true` | Run git updater after completion. |
| `update.docker` | `false` | Use Docker updater instead. |
| `update.scriptPath` | `setup/update/update.mjs` | Update script path. |
| `update.autoUpdateConfig` | `true` | Merge upstream config changes with backups. |
| `update.autoUpdateAccounts` | `false` | Skip account template merges unless you opt in.

---

### Recommended Workflow

1. Start from the default config and copy it if you need a local override.
2. Leave `passesPerRun` at `1` so job-state can skip accounts automatically.
3. Enable the scheduler only after testing manual runs.
4. Document any changes you make (without storing credentials in git).

Related docs: [`accounts.md`](./accounts.md), [`schedule.md`](./schedule.md), [`proxy.md`](./proxy.md), [`humanization.md`](./humanization.md), [`security.md`](./security.md).
