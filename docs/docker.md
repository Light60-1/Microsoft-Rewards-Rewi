# 🐳 Docker Guide

Run the bot in a containerized environment with built-in cron scheduling.

---

## ⚡ Quick Start

1. **Create required files**
   - `src/accounts.jsonc` with your credentials
   - `src/config.jsonc` (optional, defaults apply if missing)

2. **Start the container**
   ```bash
   docker compose up -d
   ```

3. **Watch logs**
   ```bash
   docker logs -f microsoft-rewards-script
   ```

The container runs with cron scheduling enabled by default. Configure schedule via environment variables.

---

## 🎯 What's Included

- ✅ **Chromium Headless Shell** — Lightweight browser runtime
- ✅ **Built-in Cron** — Automated scheduling inside container
- ✅ **Volume Mounts** — Persistent sessions and configs
- ✅ **Forced Headless Mode** — Optimized for container stability
- ✅ **Health Checks** — Monitors cron daemon status
- ✅ **Random Sleep** — Spreads execution to avoid patterns

---

## 📁 Mounted Volumes

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `./src/accounts.jsonc` | `/usr/src/microsoft-rewards-script/dist/accounts.jsonc` | Account credentials (read-only) |
| `./src/config.jsonc` | `/usr/src/microsoft-rewards-script/dist/config.jsonc` | Configuration (read-only) |
| `./sessions` | `/usr/src/microsoft-rewards-script/sessions` | Cookies, fingerprints, and job-state |
| `./reports` | `/usr/src/microsoft-rewards-script/reports` | Run summaries and metrics |

Edit `compose.yaml` to adjust paths or add additional mounts.

---

## 🌍 Environment Variables

Configure via `compose.yaml`:

```yaml
services:
  microsoft-rewards-script:
    environment:
      # Required
      TZ: "America/Toronto"                   # Container timezone
      CRON_SCHEDULE: "0 7,16,20 * * *"       # When to run (crontab format)
      
      # Optional
      RUN_ON_START: "true"                    # Run immediately on startup
      NODE_ENV: "production"                  # Node environment
      
      # Randomization (spreads execution time)
      MIN_SLEEP_MINUTES: "5"                  # Min random delay (default: 5)
      MAX_SLEEP_MINUTES: "50"                 # Max random delay (default: 50)
      SKIP_RANDOM_SLEEP: "false"              # Set to "true" to disable
      
      # Safety
      STUCK_PROCESS_TIMEOUT_HOURS: "8"        # Kill stuck runs (default: 8h)
```

### Key Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TZ` | `UTC` | Container timezone for logs and scheduling |
| `CRON_SCHEDULE` | Required | Cron expression (use [crontab.guru](https://crontab.guru)) |
| `RUN_ON_START` | `false` | Run once immediately when container starts |
| `MIN_SLEEP_MINUTES` | `5` | Minimum random delay before execution |
| `MAX_SLEEP_MINUTES` | `50` | Maximum random delay before execution |
| `SKIP_RANDOM_SLEEP` | `false` | Disable randomization (not recommended) |
| `STUCK_PROCESS_TIMEOUT_HOURS` | `8` | Timeout for stuck processes |

---

## 🕐 Cron Schedule Examples

| Schedule | Description | Cron Expression |
|----------|-------------|-----------------|
| Daily at 09:00 | Single daily run | `0 9 * * *` |
| Three times daily | 07:00, 16:00, 20:00 | `0 7,16,20 * * *` |
| Every 6 hours | Four runs per day | `0 */6 * * *` |
| Weekdays at 08:00 | Monday–Friday only | `0 8 * * 1-5` |
| Twice daily | 09:00 and 21:00 | `0 9,21 * * *` |

**Validate expressions:** [crontab.guru](https://crontab.guru)

---

## 🔧 Common Commands

```bash
# Start container
docker compose up -d

# View logs (follow)
docker logs -f microsoft-rewards-script

# View last 100 lines
docker logs --tail 100 microsoft-rewards-script

# Stop container
docker compose down

# Rebuild image (after code changes)
docker compose build --no-cache
docker compose up -d

# Restart container
docker compose restart

# Check container status
docker compose ps
```

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| **"accounts.jsonc not found"** | Ensure file exists at `./src/accounts.jsonc` |
| **"Browser launch failed"** | Verify `FORCE_HEADLESS=1` is set (automatic in Dockerfile) |
| **"Permission denied"** | Fix file permissions: `chmod 644 src/*.jsonc` |
| **Cron not running** | Check logs for "Cron configured" message |
| **Wrong timezone** | Update `TZ` in `compose.yaml` and restart |
| **No output in logs** | Wait for cron schedule or set `RUN_ON_START=true` |

### Debug Container

```bash
# Enter container shell
docker exec -it microsoft-rewards-script /bin/bash

# Check Node.js version
docker exec -it microsoft-rewards-script node --version

# Inspect mounted config
docker exec -it microsoft-rewards-script cat /usr/src/microsoft-rewards-script/dist/config.jsonc

# Check environment variables
docker exec -it microsoft-rewards-script printenv | grep -E "TZ|CRON"

# View cron configuration
docker exec -it microsoft-rewards-script crontab -l

# Check if cron is running
docker exec -it microsoft-rewards-script ps aux | grep cron
```

---

## � Health Check

The container includes a health check that monitors the cron daemon:

```yaml
healthcheck:
  test: ["CMD", "sh", "-c", "pgrep cron > /dev/null || exit 1"]
  interval: 60s
  timeout: 10s
  retries: 3
  start_period: 30s
```

Check health status:
```bash
docker inspect --format='{{.State.Health.Status}}' microsoft-rewards-script
```

---

## ⚠️ Important Notes

### Buy Mode Not Supported

**Buy Mode cannot be used in Docker** because it requires interactive terminal input. Use Buy Mode only in local installations:

```bash
# ✅ Works locally
npm run buy

# ❌ Does not work in Docker
docker exec microsoft-rewards-script npm run buy
```

For manual redemptions, run the bot locally outside Docker.

### Headless Mode Required

Docker containers **must run in headless mode**. The Dockerfile automatically sets `FORCE_HEADLESS=1`. Do not disable this.

### Random Sleep Behavior

- **Enabled by default** to avoid detection patterns
- Adds 5-50 minutes random delay before each run
- Disable only for testing: `SKIP_RANDOM_SLEEP=true`
- First run (when `RUN_ON_START=true`) skips random sleep

---

## � Resource Limits

Recommended settings in `compose.yaml`:

```yaml
services:
  microsoft-rewards-script:
    mem_limit: 4g     # Maximum RAM
    cpus: 2           # CPU cores
```

Adjust based on your system and number of accounts.

---

## 🔒 Security Hardening

The compose file includes security measures:

```yaml
security_opt:
  - no-new-privileges:true  # Prevents privilege escalation
```

Volumes are mounted **read-only** (`:ro`) for credentials to prevent tampering.

---

## 📚 Next Steps

**Need 2FA setup?**  
→ **[Accounts & TOTP Guide](./accounts.md)**

**Want notifications?**  
→ **[Discord Webhooks](./conclusionwebhook.md)**  
→ **[NTFY Push Alerts](./ntfy.md)**

**Need proxy configuration?**  
→ **[Proxy Setup](./proxy.md)**

**External scheduling?**  
→ **[Scheduling Guide](./schedule.md)**

---

**[← Back to Hub](./index.md)** | **[Getting Started](./getting-started.md)**
