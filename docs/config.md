# ⚙️ Configuration Guide

This guide explains **how to adjust `src/config.jsonc` safely** and when to touch each section. If you just need a field-by-field table, jump to [`config-reference.md`](./config-reference.md).

---

## 1. Recommended Editing Workflow

1. Keep the committed `src/config.jsonc` as your baseline. It already contains sane defaults.
2. Copy it next to the executable (project root) only when you need local overrides.
3. Edit with a JSONC-aware editor (VS Code works out of the box).
4. After major changes, run `npm run typecheck` or at least start the bot once to trigger the startup validator.

> The loader also accepts plain `config.json` (no comments) if you prefer standard JSON.

---

## 2. Essential Toggles (Review First)

| Section | Keys to check | Why it matters |
| --- | --- | --- |
| `execution` | `parallel`, `runOnZeroPoints`, `clusters`, `passesPerRun` | Determines concurrency and whether accounts repeat during the same day. Leave `passesPerRun` at `1` unless you knowingly want additional passes (job-state skip is disabled otherwise). |
| `schedule` | `enabled`, `time12`/`time24`, `timeZone`, `runImmediatelyOnStart` | Controls unattended runs. Test manual runs before enabling the scheduler. |
| `workers` | `doDesktopSearch`, `doMobileSearch`, `doDailySet`, etc. | Disable tasks you never want to run to shorten execution time. |
| `humanization` | `enabled`, `stopOnBan`, `actionDelay` | Keep enabled for safer automation. Tweaks here influence ban resilience. |
| `proxy` | `proxyGoogleTrends`, `proxyBingTerms` | Tell the bot whether to route outbound API calls through your proxy. |

Once these are set, most users can leave the rest alone.

---

## 3. Scheduler & Humanization Coordination

The scheduler honours humanization constraints:

- Weekly off-days: controlled by `humanization.randomOffDaysPerWeek` (defaults to 1). The scheduler samples new days each ISO week.
- Allowed windows: if `humanization.allowedWindows` contains time ranges, the bot delays execution until the next window.
- Vacation mode: `vacation.enabled` selects a random contiguous block (between `minDays` and `maxDays`) and skips the entire period.

If you enable the scheduler (`schedule.enabled: true`), review these limits so the run does not surprise you by skipping on specific days.

---

## 4. Handling Updates Safely

The `update` block defines how the post-run updater behaves:

- `git: true` keeps your checkout current by calling the bundled script.
- Backups live under `.update-backup/` before merges apply.
- Set `autoUpdateConfig` or `autoUpdateAccounts` to `false` if you prefer to keep local versions untouched (you will then need to merge new fields manually).

When running inside Docker, you can instead rely on `update.docker: true` so the container refresh is handled for you.

---

## 5. Diagnostics, Logging, and Analytics

Three sections determine observability:

- `logging`: adjust `excludeFunc` and `webhookExcludeFunc` if certain log buckets are too noisy. `redactEmails` should stay `true` in most setups.
- `diagnostics`: captures screenshots/HTML when failures occur. Reduce `maxPerRun` or switch off entirely only if storage is constrained.
- `analytics`: when enabled, daily metrics are persisted under `analytics/` and optional markdown summaries go to `reports/<date>/`. Disable if you do not want local history or webhook summaries.

---

## 6. Advanced Tips

- **Risk management**: Leave `riskManagement.enabled` and `banPrediction` on unless you have a reason to reduce telemetry. Raising `riskThreshold` (>75) makes alerts rarer.
- **Search pacing**: The delay window (`search.settings.delay.min` / `max`) accepts either numbers (ms) or strings like `"2min"`. Keep the range wide enough for natural behaviour.
- **Dry run**: Set `dryRun: true` to test account rotation without performing tasks. Useful for validating login flow after configuration changes.
- **Buy mode**: The config entry simply caps the session length. Use `npm start -- -buy [email]` to launch it.

---

## 7. Validation & Troubleshooting

- The startup validator (`StartupValidator`) emits warnings/errors when config or accounts look suspicious. It never blocks execution but should be read carefully.
- For syntax issues, run `npm run typecheck` or open the JSONC file in VS Code to surface parsing errors immediately.
- Diagnostics are written to `reports/` (failures) and `analytics/` (metrics). Clean up periodically or adjust `diagnostics.retentionDays` and `analytics.retentionDays`.

---

## 8. Reference

For complete field defaults and descriptions, open [`config-reference.md`](./config-reference.md). Additional topic-specific guides:

- [`accounts.md`](./accounts.md)
- [`schedule.md`](./schedule.md)
- [`proxy.md`](./proxy.md)
- [`humanization.md`](./humanization.md)
- [`security.md`](./security.md)

Happy tuning! 🎯
