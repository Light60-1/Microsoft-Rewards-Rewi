# Docker Deployment Guide

Complete guide for containerized deployment with built-in scheduling.

## 📂 Docker File Structure

```
Microsoft-Rewards-Bot/
├── docker/                      # All Docker-related files
│   ├── Dockerfile               # Multi-stage build configuration
│   ├── compose.yaml             # Service definition
│   ├── entrypoint.sh            # Container initialization
│   ├── run_daily.sh             # Daily execution wrapper + locking
│   └── crontab.template         # Cron job template
├── src/
│   ├── accounts.jsonc           # Your accounts (volume mount)
│   └── config.jsonc             # Bot configuration (volume mount)
└── package.json                 # Build scripts
```

**Important:** All Docker files are in the `docker/` folder, but the build context is the **project root** (to access `src/`, `package.json`, etc.)

---

## 🚀 Quick Start

### 1. Build the Image

**Option A: Using npm script (recommended)**
```bash
# From project root
npm run docker:build
```

**Option B: Direct Docker command**
```bash
# From project root
docker build -f docker/Dockerfile -t microsoft-rewards-bot .
```

**Why from root?** The Dockerfile needs access to `src/`, `package.json`, `tsconfig.json`. Docker can't copy files outside the build context.

### 2. Configure Environment

Edit `docker/compose.yaml`:
```yaml
environment:
  TZ: "America/New_York"        # Your timezone
  CRON_SCHEDULE: "0 9 * * *"    # Daily at 9 AM
  RUN_ON_START: "true"          # Run immediately on start
```

### 3. Start the Container

**Option A: Using npm script**
```bash
npm run docker:compose
```

**Option B: Direct docker compose command**
```bash
docker compose -f docker/compose.yaml up -d
```

**Note:** Volumes in `compose.yaml` use relative paths from `docker/`:
- `./src/` → `docker/../src/` (goes to project root)
- `./sessions/` → `docker/sessions/` (local to docker folder)

## 📋 Configuration Files

The container needs access to your configuration files via volume mounts:

```yaml
volumes:
  # Read-only mounts for configuration (prevents accidental container edits)
  - ../src/accounts.jsonc:/usr/src/microsoft-rewards-bot/accounts.jsonc:ro
  - ../src/config.jsonc:/usr/src/microsoft-rewards-bot/config.jsonc:ro
  
  # Read-write mount for persistent login sessions
  - ../sessions:/usr/src/microsoft-rewards-bot/sessions
```

**Paths explained:**
- `../src/accounts.jsonc` = `docker/../src/accounts.jsonc` (relative from compose.yaml location, goes to project root)
- `../sessions` = `docker/../sessions/` (project root sessions folder)

**Before starting:**
1. Create `src/accounts.jsonc` (copy from `src/accounts.example.jsonc`)
2. Edit `src/config.jsonc` with your settings
3. (Optional) Create `sessions/` directory at project root for persistent login

---

## 🏗️ Architecture & Build Process

### Two-Stage Docker Build

**Stage 1: Builder**
```dockerfile
FROM node:22-slim AS builder
# 1. Install dependencies + dev dependencies
# 2. Compile TypeScript → JavaScript (dist/)
# 3. Install Playwright Chromium
# 4. Remove dev dependencies (keep only production)
```

**Stage 2: Runtime**
```dockerfile
FROM node:22-slim AS runtime
# 1. Install minimal system libraries for Chromium
# 2. Copy compiled code + dependencies from builder
# 3. Copy runtime scripts (entrypoint.sh, run_daily.sh)
# 4. Configure cron daemon
```

**Why two stages?**
- Smaller final image (~800 MB vs 1.5 GB)
- No build tools in production
- Security: no dev dependencies

### Build Context Explained

```bash
# ❌ WRONG: Building from docker/ folder
cd docker
docker build -t bot .
# Error: Cannot find package.json, src/, etc.

# ✅ CORRECT: Build from root, specify Dockerfile location
cd /path/to/Microsoft-Rewards-Bot
docker build -f docker/Dockerfile -t bot .
# Success: Access to all project files
```

**The Dockerfile copies files relative to project root:**
```dockerfile
COPY package.json tsconfig.json ./      # From project root
COPY src/ ./src/                        # From project root
COPY docker/run_daily.sh ./docker/      # Subfolder
```

---

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

### ❌ Build Error: "Cannot find module 'package.json'"

**Cause:** Wrong build context - building from `docker/` instead of project root.

**Solution:**
```bash
# ❌ WRONG
cd docker
docker build -t bot .

# ✅ CORRECT (from project root)
docker build -f docker/Dockerfile -t bot .
# Or use npm script
npm run docker:build
```

### ❌ Build Error: "COPY failed: file not found: docker/run_daily.sh"

**Cause:** `.dockerignore` file excludes `docker/` folder.

**Solution:** Check `.dockerignore` - it should NOT contain `docker/`:
```ignore
# ❌ BAD
docker/

# ✅ GOOD (current config)
scripts/installer/
```

### ❌ "Chromium not installed" After First Run

**Symptoms:**
- Bot works on first run
- Fails on subsequent scheduled runs with "Chromium not installed"

**Root Cause:** 
Fixed in v2.56.7+! Chromium browser files are now copied correctly from builder stage.

**Solution:**
```bash
# Rebuild with latest Dockerfile (includes fix)
npm run docker:build
docker compose -f docker/compose.yaml down
docker compose -f docker/compose.yaml up -d
```

**Verification:**
Check that Chromium is present in the container:
```bash
docker exec microsoft-rewards-bot ls -la /usr/src/microsoft-rewards-bot/node_modules/@playwright/
```

You should see `browser-chromium/` directory.

### ❌ Container Exits Immediately

**Check logs:**
```bash
docker logs microsoft-rewards-bot
```

**Common causes:**
1. **Missing CRON_SCHEDULE:** Set environment variable in compose.yaml
   ```yaml
   environment:
     CRON_SCHEDULE: "0 9 * * *"  # Required!
   ```

2. **Invalid cron expression:** Validate at https://crontab.guru

3. **Script not executable:** Dockerfile should handle this automatically
   ```dockerfile
   COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
   ```

**Fix:**
```bash
# Update compose.yaml with correct CRON_SCHEDULE
docker compose -f docker/compose.yaml down
docker compose -f docker/compose.yaml up -d
```

### ❌ "Permission denied: entrypoint.sh"

**Cause:** Script not executable or Windows CRLF line endings.

**Solution:** The Dockerfile handles both automatically:
```dockerfile
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh  # Convert CRLF → LF
```

If still failing, manually fix line endings:
```bash
# Linux/Mac
dos2unix docker/entrypoint.sh docker/run_daily.sh

# Or with sed
sed -i 's/\r$//' docker/entrypoint.sh
sed -i 's/\r$//' docker/run_daily.sh
```

### ❌ Volumes Not Mounting

### ❌ Volumes Not Mounting

**Check if files exist:**
```bash
# From docker/ folder
ls -la ../src/accounts.jsonc ../src/config.jsonc

# Or from project root
ls -la src/accounts.jsonc src/config.jsonc
```

**Verify volume paths in running container:**
```bash
docker inspect microsoft-rewards-bot | grep -A 10 Mounts
```

**Fix paths in compose.yaml:**
```yaml
# Paths are relative to compose.yaml location (docker/)
volumes:
  - ../src/accounts.jsonc:/usr/src/microsoft-rewards-bot/accounts.jsonc:ro
  # This resolves to: docker/../src/accounts.jsonc (project root)
  # Note: Files mount to project root, NOT dist/ (Load.ts searches multiple locations)
```

---

## 📚 Complete File Reference

### `docker/Dockerfile`
Multi-stage build configuration:
- **Builder stage:** Compiles TypeScript, installs Playwright
- **Runtime stage:** Minimal image with only production dependencies

### `docker/compose.yaml`
Service definition with:
- Build context (points to project root)
- Volume mounts (configuration files)
- Environment variables (scheduling, timezone)
- Resource limits (CPU, memory)
- Health checks (cron daemon monitoring)

### `docker/entrypoint.sh`
Container initialization script:
1. Configures timezone from `TZ` env var
2. Validates `CRON_SCHEDULE` is set
3. Optionally runs bot immediately (`RUN_ON_START=true`)
4. Templates cron job with environment variables
5. Starts cron daemon in foreground

### `docker/run_daily.sh`
Daily execution wrapper:
- File-based locking (prevents concurrent runs)
- Self-healing lockfile validation
- Random sleep delay (anti-detection)
- Stuck process killer (timeout after N hours)
- Executes `npm start`

### `docker/crontab.template`
Cron job template with variable interpolation:
```bash
${CRON_SCHEDULE} TZ=${TZ} /bin/bash /usr/src/microsoft-rewards-bot/docker/run_daily.sh >> /proc/1/fd/1 2>&1
```

Expanded by `entrypoint.sh` using `envsubst`.

---

## 🎯 Build & Deployment Checklist

### Pre-Build Checklist
- [ ] Files exist: `src/accounts.jsonc`, `src/config.jsonc`
- [ ] Docker installed and running
- [ ] At project root (not in `docker/` folder)
- [ ] `.dockerignore` does NOT exclude `docker/` folder

### Build Steps
```bash
# 1. Clean previous builds (optional)
docker rmi microsoft-rewards-bot

# 2. Build image
npm run docker:build
# Or: docker build -f docker/Dockerfile -t microsoft-rewards-bot .

# 3. Verify image created
docker images | grep microsoft-rewards-bot
```

### Deployment Steps
```bash
# 1. Configure compose.yaml
# - Set CRON_SCHEDULE (required)
# - Set TZ (optional, default UTC)
# - Set RUN_ON_START (optional, default false)

# 2. Start container
npm run docker:compose
# Or: docker compose -f docker/compose.yaml up -d

# 3. Verify running
docker ps | grep microsoft-rewards-bot

# 4. Check logs
docker logs -f microsoft-rewards-bot

# 5. Verify health
docker inspect microsoft-rewards-bot --format='{{.State.Health.Status}}'
```

---

## 🔍 Debugging Commands

### Check Build Context
```bash
# List files Docker can see during build
docker build -f docker/Dockerfile -t test . --progress=plain 2>&1 | grep "COPY"
```

### Inspect Running Container
```bash
# Shell access
docker exec -it microsoft-rewards-bot bash

# Check environment variables
docker exec microsoft-rewards-bot env

# Check cron jobs
docker exec microsoft-rewards-bot crontab -l

# Check timezone
docker exec microsoft-rewards-bot date

# Check Playwright browsers
docker exec microsoft-rewards-bot ls -la node_modules/@playwright/

# Check running processes
docker exec microsoft-rewards-bot ps aux
```

### Test Scripts Manually
```bash
# Test entrypoint
docker exec microsoft-rewards-bot /usr/local/bin/entrypoint.sh

# Test run_daily (bypass lock)
docker exec microsoft-rewards-bot bash -c "rm -f /tmp/run_daily.lock && docker/run_daily.sh"

# Test bot directly
docker exec microsoft-rewards-bot npm start
```

---

## 📖 Additional Resources

- **Build System:** [docs/build-system.md](build-system.md)
- **Scheduling:** [src/scheduler/README.md](../src/scheduler/README.md)
- **Configuration:** [src/config.jsonc](../src/config.jsonc) (inline comments)
- **Accounts:** [docs/accounts.md](accounts.md)

---

**Last Updated:** November 2025  
**Applies To:** v2.56.7+
