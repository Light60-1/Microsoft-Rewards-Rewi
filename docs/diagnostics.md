# 🛠️ Troubleshooting Guide

Keep runs healthy by watching logs, catching alerts early, and validating your setup before enabling automation on a schedule.

---

## Quick Checklist

- ✅ Run `npm run start` manually after every configuration change.
- ✅ Confirm Node.js 20+ with `node -v` (22 LTS recommended).
- ✅ Keep dependencies current: `npm install` then `npm run build`.
- ✅ Double-check credentials, TOTP secrets, and recovery email values.
- ✅ Review external scheduler logs (Task Scheduler, cron, etc.).

---

## Capture Logs Reliably

### Terminal sessions

- **PowerShell**
	```powershell
	npm run start *>&1 | Tee-Object -FilePath logs/rewards.txt
	```
- **Bash / Linux / macOS**
	```bash
	mkdir -p logs
	npm run start >> logs/rewards.log 2>&1
	```

### Verbose output

Set `DEBUG_REWARDS_VERBOSE=1` for additional context around worker progress and risk scoring.

```powershell
$env:DEBUG_REWARDS_VERBOSE = "1"
npm run start
```

Clear the variable afterwards (`Remove-Item Env:DEBUG_REWARDS_VERBOSE`).

### Structured alerts

- Enable `conclusionWebhook` to receive a summary on completion.
- Turn on `ntfy` for lightweight push alerts.
- Pipe logs into observability tools (ELK, Loki, etc.) if you self-host them.

---

## Common Issues & Fixes

| Symptom | Checks | Fix |
|---------|--------|-----|
| **Login loops or MFA prompts** | Ensure `totp` secret is correct, recovery email matches your Microsoft profile. | Regenerate TOTP from Microsoft Account, update `recoveryEmail`, retry manually. |
| **Points not increasing** | Review `workers` section; confirm searches complete in logs. | Enable missing workers, increase `passesPerRun`, verify network connectivity. |
| **Script stops early** | Look for `SECURITY` or `RISK` warnings. | Address ban alerts, adjust `riskManagement` thresholds, or pause for 24h. |
| **Scheduler runs but nothing happens** | Confirm working directory, environment variables, file paths. | Use absolute paths in cron/Task Scheduler, ensure `npm` is available on PATH. |
| **Proxy failures** | Check proxy URL/port/auth in logs. | Test with `curl`/`Invoke-WebRequest`, update credentials, or disable proxy temporarily. |

---

## Manual Investigation Tips

- **Single account test:** `npm run start -- --account email@example.com`
- **Playwright Inspector:** set `PWDEBUG=1` to pause the browser for step-by-step review.
- **Job state reset:** delete `sessions/job-state/` for a clean pass.
- **Session reset:** remove `sessions/` to force fresh logins.
- **Network tracing:** use the bundled Chromium DevTools (`--devtools`) when running locally.

---

## When to Revisit Config

- After Microsoft introduces new activities or login flows.
- When risk alerts become frequent (tune delays, enable vacation mode).
- If external schedulers overlap and cause concurrent runs.
- When scaling to more accounts (consider proxies, increase `clusters`).

---

**Related guides:** [Configuration](./config.md) · [Notifications](./conclusionwebhook.md) · [Security](./security.md)
