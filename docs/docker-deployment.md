# Docker Deployment Guide

## 🐳 Quick Start

### 1. Build the Image
```bash
cd docker
docker build -t microsoft-rewards-bot -f Dockerfile ..
```

Or use the npm script:
```bash
npm run docker:build
```

### 2. Configure Environment
Edit `docker/compose.yaml`:
```yaml
environment:
  TZ: "America/New_York"        # Your timezone
  CRON_SCHEDULE: "0 9 * * *"    # Daily at 9 AM
  RUN_ON_START: "true"          # Run immediately on start
```

### 3. Start the Container
```bash
cd docker
docker compose up -d
```

## 📋 Configuration Files

The container needs access to your configuration files via volume mounts:

```yaml
volumes:
  - ../src/accounts.jsonc:/usr/src/microsoft-rewards-bot/dist/accounts.jsonc:ro
  - ../src/config.jsonc:/usr/src/microsoft-rewards-bot/dist/config.jsonc:ro
  - ./sessions:/usr/src/microsoft-rewards-bot/dist/browser/sessions
```

**Before starting:**
1. Create `src/accounts.jsonc` (copy from `src/accounts.example.jsonc`)
2. Edit `src/config.jsonc` with your settings
3. (Optional) Create `docker/sessions/` directory for persistent login

## 🔧 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CRON_SCHEDULE` | ✅ Yes | N/A | Cron expression (e.g., `0 9 * * *`) |
| `TZ` | ❌ No | `UTC` | Timezone (e.g., `America/New_York`) |
| `RUN_ON_START` | ❌ No | `false` | Run immediately on container start |
| `SKIP_RANDOM_SLEEP` | ❌ No | `false` | Skip random delay before execution |
| `MIN_SLEEP_MINUTES` | ❌ No | `5` | Minimum random delay (minutes) |
| `MAX_SLEEP_MINUTES` | ❌ No | `50` | Maximum random delay (minutes) |
| `STUCK_PROCESS_TIMEOUT_HOURS` | ❌ No | `8` | Kill stuck processes after N hours |
| `PLAYWRIGHT_BROWSERS_PATH` | 🔒 Fixed | `0` | Use browsers in node_modules (DO NOT CHANGE) |
| `FORCE_HEADLESS` | 🔒 Fixed | `1` | Headless mode (DO NOT CHANGE) |
| `NODE_ENV` | 🔒 Fixed | `production` | Production environment (DO NOT CHANGE) |

## 📅 Scheduling Examples

Use [crontab.guru](https://crontab.guru) to create cron expressions.

| Schedule | Cron Expression | Description |
|----------|----------------|-------------|
| Daily at 9 AM | `0 9 * * *` | Once per day |
| Every 6 hours | `0 */6 * * *` | 4 times daily |
| Twice daily (9 AM, 9 PM) | `0 9,21 * * *` | Morning & evening |
| Weekdays at 8 AM | `0 8 * * 1-5` | Monday-Friday only |
| Random time (7-8 AM) | `0 7 * * *` + random sleep | Use `MIN_SLEEP_MINUTES`/`MAX_SLEEP_MINUTES` |

**Example with Random Delay:**
```yaml
environment:
  CRON_SCHEDULE: "0 7 * * *"    # Start scheduling at 7 AM
  MIN_SLEEP_MINUTES: "0"        # No minimum delay
  MAX_SLEEP_MINUTES: "60"       # Up to 1 hour delay
  # Result: Runs between 7:00 AM - 8:00 AM randomly
```

## 🔍 Monitoring

### View Logs
```bash
docker logs -f microsoft-rewards-bot
```

### Check Container Status
```bash
docker ps -a | grep microsoft-rewards-bot
```

### Health Check
```bash
docker inspect microsoft-rewards-bot --format='{{.State.Health.Status}}'
```

Expected output: `healthy`

### Execute Commands Inside Container
```bash
# Check cron status
docker exec microsoft-rewards-bot crontab -l

# Check timezone
docker exec microsoft-rewards-bot date

# List running processes
docker exec microsoft-rewards-bot ps aux
```

## 🛠️ Troubleshooting

### "Chromium not installed" After First Run

**Symptoms:**
- Bot works on first run
- Fails on subsequent scheduled runs with "Chromium not installed"

**Root Cause:** 
Fixed in latest version! Chromium browser files are now copied correctly from builder stage.

**Solution:**
```bash
# Rebuild with latest Dockerfile (includes fix)
docker build --no-cache -t microsoft-rewards-bot -f docker/Dockerfile ..
docker compose down
docker compose up -d
```

**Verification:**
Check that Chromium is present in the container:
```bash
docker exec microsoft-rewards-bot ls -la /usr/src/microsoft-rewards-bot/node_modules/@playwright/
```

You should see `browser-chromium/` directory.

### Container Exits Immediately

**Check logs:**
```bash
docker logs microsoft-rewards-bot
```

**Common causes:**
1. **Missing CRON_SCHEDULE:** Set environment variable in compose.yaml
2. **Invalid cron expression:** Validate at https://crontab.guru
3. **Permission issues:** Ensure config files are readable

**Fix:**
```bash
# Update compose.yaml with correct CRON_SCHEDULE
docker compose down
docker compose up -d
```

### Random Delays Not Working

**Check environment variables:**
```bash
docker exec microsoft-rewards-bot env | grep SLEEP
```

**Verify run_daily.sh receives variables:**
```bash
docker exec microsoft-rewards-bot cat docker/run_daily.sh
```

**Test manually:**
```bash
docker exec microsoft-rewards-bot docker/run_daily.sh
```

### Timezone Incorrect

**Check container timezone:**
```bash
docker exec microsoft-rewards-bot date
```

**Fix:**
1. Update `TZ` in compose.yaml
2. Restart container:
```bash
docker compose restart
```

**Verify:**
```bash
docker exec microsoft-rewards-bot date
docker logs microsoft-rewards-bot | grep "Timezone:"
```

### Health Check Failing

**Check cron daemon:**
```bash
docker exec microsoft-rewards-bot ps aux | grep cron
```

**Expected output:**
```
root         1  0.0  0.0   2576  1024 ?        Ss   12:00   0:00 cron -f
```

**Restart container if missing:**
```bash
docker compose restart
```

### Sessions Not Persisting

**Check volume mount:**
```bash
docker inspect microsoft-rewards-bot | grep sessions
```

**Verify local directory exists:**
```bash
ls -la docker/sessions/
```

**Fix permissions:**
```bash
# Linux/Mac
chmod -R 755 docker/sessions/

# Windows
# No action needed (NTFS handles permissions)
```

### Out of Memory Errors

**Increase memory limit in compose.yaml:**
```yaml
mem_limit: 6g  # Increase from 4g
```

**Restart:**
```bash
docker compose down
docker compose up -d
```

**Monitor memory usage:**
```bash
docker stats microsoft-rewards-bot
```

## 🔄 Updates

### Update to Latest Version

**Method 1: Rebuild (Recommended)**
```bash
# Pull latest code
git pull origin main

# Rebuild image
docker build --no-cache -t microsoft-rewards-bot -f docker/Dockerfile ..

# Restart container
docker compose down
docker compose up -d
```

**Method 2: Auto-Update (If Enabled in config.jsonc)**
The bot can auto-update itself if `update.enabled: true` in config.jsonc.
After auto-update, container will restart automatically (Docker restarts on exit).

### Backup Before Update
```bash
# Backup sessions
cp -r docker/sessions/ docker/sessions.backup/

# Backup config
cp src/config.jsonc src/config.jsonc.backup
cp src/accounts.jsonc src/accounts.jsonc.backup
```

## 📊 Resource Usage

**Typical resource consumption:**
- **CPU:** 50-80% during active runs, <1% idle
- **RAM:** 1-3 GB during active runs, <100 MB idle
- **Disk:** ~500 MB (base image + browsers)
- **Network:** Minimal (<10 MB per run)

**Recommended limits:**
```yaml
mem_limit: 4g
cpus: 2
```

## 🔐 Security Hardening

The default compose.yaml includes:
```yaml
security_opt:
  - no-new-privileges:true  # Prevent privilege escalation
```

**Additional hardening (optional):**
```yaml
security_opt:
  - no-new-privileges:true
  - seccomp:unconfined  # Only if Chromium fails to start
read_only: false  # Must be false (Chromium needs write access)
tmpfs:
  - /tmp
  - /root/.cache
```

## 🆘 Getting Help

If issues persist:
1. **Check logs:** `docker logs -f microsoft-rewards-bot`
2. **Rebuild with no cache:** `docker build --no-cache ...`
3. **Verify Chromium:** `docker exec microsoft-rewards-bot ls -la node_modules/@playwright/`
4. **Discord Support:** https://discord.gg/k5uHkx9mne
5. **GitHub Issues:** https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/issues

## 📚 Related Documentation

- **Build System:** [docs/build-system.md](build-system.md)
- **Scheduling:** [src/scheduler/README.md](../src/scheduler/README.md)
- **Configuration:** [src/config.jsonc](../src/config.jsonc) (inline comments)
- **Accounts:** [docs/accounts.md](accounts.md)

---

**Last Updated:** November 2025  
**Applies To:** v2.56.7+
