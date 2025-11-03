# 🐳 Docker Guide

Run the bot in a containerized environment with optional in-container cron support.

---

## ⚡ Quick Start

1. **Create required files**
   - `src/accounts.jsonc` with your credentials
   - `src/config.jsonc` (defaults apply if missing)
2. **Start the container**
   ```bash
   docker compose up -d
   ```
3. **Watch logs**
   ```bash
   docker logs -f microsoft-rewards-bot
   ```

The container performs a single pass. Use cron, Task Scheduler, or another orchestrator to restart it on your desired cadence.

---

## 🎯 What's Included

- ✅ Chromium Headless Shell (lightweight browser runtime)
- ✅ Cron-ready entrypoint (`docker-entrypoint.sh`)
- ✅ Volume mounts for persistent sessions and configs
- ✅ Forced headless mode for container stability

---

## 📁 Mounted Volumes

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `./src/accounts.jsonc` | `/app/src/accounts.jsonc` | Account credentials (read-only) |
| `./src/config.jsonc` | `/app/src/config.jsonc` | Configuration (read-only) |
| `./sessions` | `/app/sessions` | Cookies, fingerprints, and job-state |

Edit `compose.yaml` to adjust paths or add additional mounts.

---

## 🌍 Environment Variables

```yaml
services:
  microsoft-rewards-bot:
    environment:
      TZ: "Europe/Paris"          # Container timezone (cron + logging)
      NODE_ENV: "production"
      FORCE_HEADLESS: "1"        # Required for Chromium in Docker
      #USE_CRON: "true"          # Optional cron mode (see below)
      #CRON_SCHEDULE: "0 9 * * *"
      #RUN_ON_START: "true"
```

- `ACCOUNTS_JSON` and `ACCOUNTS_FILE` can override account sources.
- `ACCOUNTS_JSON` expects inline JSON; `ACCOUNTS_FILE` points to a mounted path.

---

## 🔧 Common Commands

```bash
# Start container
docker compose up -d

# View logs
docker logs -f microsoft-rewards-bot

# Stop container
docker compose down

# Rebuild image
docker compose build --no-cache

# Restart container
docker compose restart
```

---

## 🎛️ Scheduling Options

### Use a host scheduler (recommended)

- Trigger `docker compose up --build` (or restart the container) with cron, systemd timers, Task Scheduler, Kubernetes CronJobs, etc.
- Ensure persistent volumes are mounted so repeated runs reuse state.
- See [External Scheduling](schedule.md) for host-level examples.

### Enable in-container cron (optional)

1. Set environment variables in `docker-compose.yml`:
   ```yaml
   services:
     microsoft-rewards-bot:
       environment:
         USE_CRON: "true"
         CRON_SCHEDULE: "0 9,16,21 * * *"  # Example: 09:00, 16:00, 21:00
         RUN_ON_START: "true"              # Optional one-time run at container boot
   ```
2. Rebuild and redeploy:
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```
3. Confirm cron is active:
   ```bash
   docker logs -f microsoft-rewards-bot
   ```

#### Cron schedule examples

| Schedule | Description | Cron expression |
|----------|-------------|-----------------|
| Daily at 09:00 | Single run | `0 9 * * *` |
| Twice daily | 09:00 & 21:00 | `0 9,21 * * *` |
| Every 6 hours | Four runs/day | `0 */6 * * *` |
| Weekdays at 08:00 | Monday–Friday | `0 8 * * 1-5` |

Validate expressions with [crontab.guru](https://crontab.guru).

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| **"accounts.json not found"** | Ensure `./src/accounts.jsonc` exists and is mounted read-only |
| **"Browser launch failed"** | Verify `FORCE_HEADLESS=1` and Chromium dependencies installed |
| **"Permission denied"** | Check file permissions (`chmod 644 accounts.jsonc config.jsonc`) |
| **Automation not repeating** | Enable cron (`USE_CRON=true`) or use a host scheduler |
| **Cron not working** | See [Cron troubleshooting](#-cron-troubleshooting) |

### Debug container

```bash
# Enter container shell
docker exec -it microsoft-rewards-bot /bin/bash

# Check Node.js version
docker exec -it microsoft-rewards-bot node --version

# Inspect mounted config
docker exec -it microsoft-rewards-bot cat /app/src/config.jsonc

# Check env vars
docker exec -it microsoft-rewards-bot printenv | grep -E "TZ|USE_CRON|CRON_SCHEDULE"
```

---

## 🔄 Switching cron on or off

- **Enable cron:** set `USE_CRON=true`, provide `CRON_SCHEDULE`, rebuild, and redeploy.
- **Disable cron:** remove `USE_CRON` (and related variables). The container will run once per start; handle recurrence externally.

---

## 🐛 Cron troubleshooting

| Problem | Solution |
|---------|----------|
| **Cron not executing** | Check logs for "Cron mode enabled" and cron syntax errors |
| **Wrong timezone** | Ensure `TZ` matches your location |
| **Syntax error** | Validate expression at [crontab.guru](https://crontab.guru) |
| **No logs generated** | Tail `/var/log/cron.log` inside the container |
| **Duplicate runs** | Ensure only one cron entry is configured |

### Inspect cron inside the container

```bash
docker exec -it microsoft-rewards-bot /bin/bash
ps aux | grep cron
crontab -l
tail -100 /var/log/cron.log
```

---

## 📚 Next steps

- [Configuration guide](config.md)
- [External scheduling](schedule.md)
- [Humanization guide](humanization.md)

---

### Option 3: Single Run (Manual)

```yaml
services:
  rewards:
    build: .
    command: ["node", "./dist/index.js"]
```

---

## 🔄 Switching Cron On or Off

- **Enable cron:** set `USE_CRON=true`, provide `CRON_SCHEDULE`, rebuild the image, and redeploy.
- **Disable cron:** remove `USE_CRON` (and related variables). The container will run once per start; use host automation to relaunch when needed.

---

## 🐛 Cron Troubleshooting

| Problem | Solution |
|---------|----------|
| **Cron not executing** | Check `docker logs` for "Cron mode enabled" message |
| **Wrong timezone** | Verify `TZ` environment variable matches your location |
| **Syntax error** | Validate cron expression at [crontab.guru](https://crontab.guru) |
| **No logs** | Use `docker exec <container> tail -f /var/log/cron.log` |
| **Multiple executions** | Check for duplicate cron entries |

### Debug Cron Inside Container

```bash
# Enter container
docker exec -it microsoft-rewards-bot /bin/bash

# Check cron is running
ps aux | grep cron

# View installed cron jobs
crontab -l

# Check cron logs
tail -100 /var/log/cron.log

# Test environment variables
printenv | grep -E 'TZ|NODE_ENV'
```

---

## 📚 Next Steps

**Need 2FA?**  
→ **[Accounts & TOTP Setup](./accounts.md)**

**Want notifications?**  
→ **[Discord Webhooks](./conclusionwebhook.md)**

**Need scheduling tips?**  
→ **[External Scheduling](./schedule.md)**

---

**[← Back to Hub](./index.md)** | **[Getting Started](./getting-started.md)**
