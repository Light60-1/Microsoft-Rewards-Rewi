# 🐳 Docker Guide

**Run the script in a container**

---

## ⚡ Quick Start

### 1. Create Required Files

Ensure you have:
- `src/accounts.json` with your credentials
- `src/config.jsonc` (uses defaults if missing)

### 2. Start Container

```bash
docker compose up -d
```

### 3. View Logs

```bash
docker logs -f microsoft-rewards-script
```

**That's it!** Script runs automatically.

---

## 🎯 What's Included

The Docker setup:
- ✅ **Chromium Headless Shell** — Lightweight browser
- ✅ **Scheduler enabled** — Daily automation
- ✅ **Volume mounts** — Persistent sessions
- ✅ **Force headless** — Required for containers

---

## 📁 Mounted Volumes

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `./src/accounts.jsonc` | `/usr/src/.../accounts.json` | Account credentials (read-only) |
| `./src/config.jsonc` | `/usr/src/.../config.json` | Configuration (read-only) |
| `./sessions` | `/usr/src/.../sessions` | Cookies & fingerprints |

---

## 🌍 Environment Variables

### Set Timezone

```yaml
services:
  rewards:
    environment:
      TZ: Europe/Paris
```

### Use Inline JSON

```bash
docker run -e ACCOUNTS_JSON='{"accounts":[...]}' ...
```

### Custom Config Path

```bash
docker run -e ACCOUNTS_FILE=/custom/path/accounts.json ...
```

---

## 🔧 Common Commands

```bash
# Start container
docker compose up -d

# View logs
docker logs -f microsoft-rewards-script

# Stop container
docker compose down

# Rebuild image
docker compose build --no-cache

# Restart container
docker compose restart
```

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| **"accounts.json not found"** | Ensure `./src/accounts.jsonc` exists and is mounted in compose.yaml |
| **"Browser launch failed"** | Ensure `FORCE_HEADLESS=1` is set |
| **"Permission denied"** | Check file permissions (`chmod 644 accounts.jsonc config.jsonc`) |
| **Scheduler not running** | Verify `schedule.enabled: true` in config |
| **Cron not working** | See [Cron Troubleshooting](#-cron-troubleshooting) above |

### Debug Container

```bash
# Enter container shell
docker exec -it microsoft-rewards-script /bin/bash

# Check Node.js version
docker exec -it microsoft-rewards-script node --version

# View config
docker exec -it microsoft-rewards-script cat config.json

# Check if cron is enabled
docker exec -it microsoft-rewards-script printenv | grep USE_CRON
```

---

## 🎛️ Custom Configuration

### Option 1: Built-in Scheduler (Default, Recommended)

**Pros:**
- ✅ Lighter resource usage
- ✅ Better integration with config.jsonc
- ✅ No additional setup needed
- ✅ Automatic jitter for natural timing

**Default** `docker-compose.yml`:
```yaml
services:
  rewards:
    build: .
    environment:
      TZ: "Europe/Paris"
    command: ["npm", "run", "start:schedule"]
```

Configure schedule in `src/config.jsonc`:
```jsonc
{
  "schedule": {
    "enabled": true,
    "useAmPm": false,
    "time24": "09:00",
    "timeZone": "Europe/Paris"
  }
}
```

### Option 2: Native Cron (For Traditional Cron Users)

**Pros:**
- ✅ Familiar cron syntax
- ✅ Multiple daily runs with standard crontab
- ✅ Native Linux scheduling

**Setup:**

1. **Enable cron in `docker-compose.yml`:**
```yaml
services:
  rewards:
    build: .
    environment:
      TZ: "Europe/Paris"
      USE_CRON: "true"
      CRON_SCHEDULE: "0 9,16,21 * * *"  # 9 AM, 4 PM, 9 PM daily
      RUN_ON_START: "true"                # Optional: run once on start
```

2. **Cron Schedule Examples:**

| Schedule | Description | Cron Expression |
|----------|-------------|-----------------|
| Daily at 9 AM | Once per day | `0 9 * * *` |
| Twice daily | 9 AM and 9 PM | `0 9,21 * * *` |
| Three times | 9 AM, 4 PM, 9 PM | `0 9,16,21 * * *` |
| Every 6 hours | 4 times daily | `0 */6 * * *` |
| Weekdays only | Mon-Fri at 8 AM | `0 8 * * 1-5` |

**Use [crontab.guru](https://crontab.guru) to validate your cron expressions.**

3. **Rebuild and restart:**
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

4. **Verify cron is running:**
```bash
# Check container logs
docker logs -f microsoft-rewards-script

# Should see: "==> Cron mode enabled"

# View cron logs inside container
docker exec microsoft-rewards-script tail -f /var/log/cron.log
```

### Option 3: Single Run (Manual)

```yaml
services:
  rewards:
    build: .
    command: ["node", "./dist/index.js"]
```

---

## 🔄 Switching Between Scheduler and Cron

**From Built-in → Cron:**
1. Add `USE_CRON: "true"` to environment
2. Add `CRON_SCHEDULE` with desired timing
3. Rebuild: `docker compose up -d --build`

**From Cron → Built-in:**
1. Remove or comment `USE_CRON` variable
2. Configure `schedule` in `src/config.jsonc`
3. Rebuild: `docker compose up -d --build`

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
docker exec -it microsoft-rewards-script /bin/bash

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

**Scheduler config?**  
→ **[Scheduler Guide](./schedule.md)**

---

**[← Back to Hub](./index.md)** | **[Getting Started](./getting-started.md)**
