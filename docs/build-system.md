# Build System Documentation

## 📋 Overview

The Microsoft Rewards Bot uses a **clean, automated build system** that handles TypeScript compilation and browser installation automatically.

## 🚀 Quick Start

### First Time Setup
```bash
npm install
```
**This command does everything:**
- ✅ Installs all Node.js dependencies
- ✅ Compiles TypeScript to JavaScript
- ✅ Installs Chromium browser automatically

### Run the Bot
```bash
npm start
```
**No build step needed!** The bot is ready to run immediately after `npm install`.

## 📦 Available Commands

| Command | Description | Use When |
|---------|-------------|----------|
| `npm install` | **Complete setup** (deps + build + browser) | First time, after updates |
| `npm start` | **Run the bot** (production) | Normal usage |
| `npm run build` | Compile TypeScript + install browser | Manual rebuild needed |
| `npm run dev` | **Dev mode** (TypeScript directly, hot reload) | Development only |
| `npm run creator` | Account creation wizard | Creating new accounts |
| `npm run dashboard` | Web dashboard (production) | Remote monitoring |
| `npm run dashboard-dev` | Web dashboard (dev mode) | Dashboard development |
| `npm run typecheck` | Type checking only (no build) | Quick validation |
| `npm run test` | Run test suite | Development |
| `npm run clean` | Delete compiled files | Before fresh rebuild |
| `npm run kill-chrome` | Kill all Chrome processes | Cleanup after crashes |

## 🔄 Build Workflow (Automatic)

### When you run `npm install`:
```
1. npm installs dependencies
   ↓
2. postinstall hook triggers
   ↓
3. npm run build executes
   ↓
4. prebuild hook checks for Chromium
   ↓
5. If Chromium missing: npx playwright install chromium
   ↓
6. TypeScript compilation (tsc)
   ↓
7. postbuild hook shows success message
```

**Result:** Bot is ready to use!

### When you run `npm run build`:
```
1. prebuild hook checks for Chromium
   ↓
2. If missing: Install Chromium automatically
   ↓
3. Compile TypeScript (src/ → dist/)
   ↓
4. Show success message
```

### When you run `npm start`:
```
1. Run compiled JavaScript (dist/index.js)
   ↓
2. No build check (already done by npm install)
```

## 🐳 Docker Workflow

### Docker Build Process
```bash
npm run docker:build
```

**What happens:**
1. **Stage 1 (Builder):**
   - Install all dependencies
   - Build TypeScript
   - Reinstall production-only dependencies
   - Install Chromium Headless Shell
   - Clean up build artifacts

2. **Stage 2 (Runtime):**
   - Copy compiled code (`dist/`)
   - Copy production dependencies (`node_modules/`)
   - **Copy Chromium browser** (`node_modules/@playwright/`)
   - Install minimal system libraries
   - Configure cron for scheduling

### Docker Run
```bash
npm run docker:run
```

Or with Docker Compose:
```bash
cd docker
docker compose up -d
```

### Environment Variables (Docker)
| Variable | Default | Description |
|----------|---------|-------------|
| `PLAYWRIGHT_BROWSERS_PATH` | `0` | Use browsers in node_modules (required) |
| `FORCE_HEADLESS` | `1` | Run in headless mode (required for Docker) |
| `TZ` | `UTC` | Container timezone |
| `CRON_SCHEDULE` | **Required** | Cron schedule (e.g., `0 9 * * *`) |
| `RUN_ON_START` | `false` | Run immediately on container start |
| `SKIP_RANDOM_SLEEP` | `false` | Skip random delay before execution |

## 🔧 Development Workflow

### Hot Reload Development
```bash
npm run dev
```
- Runs TypeScript directly (no compilation needed)
- Auto-reloads on file changes
- Uses `-dev` flag (loads `accounts.dev.json` if it exists)

### Type Checking
```bash
npm run typecheck
```
- Validates TypeScript types without compiling
- Faster than full build
- Use before committing code

### Testing
```bash
npm run test
```
- Runs all unit tests in `tests/` directory
- Uses Node.js native test runner

### Clean Build
```bash
npm run clean
npm run build
```
- Deletes `dist/` folder
- Rebuilds everything from scratch

## 🛠️ Troubleshooting

### "Chromium not installed" Error

**Symptoms:**
```
[ERROR] DESKTOP [BROWSER] Chromium not installed. Run "npm run pre-build" or set AUTO_INSTALL_BROWSERS=1
```

**Solution:**
```bash
npx playwright install chromium --with-deps
```

**Or set environment variable:**
```bash
# Windows (PowerShell)
$env:AUTO_INSTALL_BROWSERS="1"
npm start

# Linux/Mac
export AUTO_INSTALL_BROWSERS=1
npm start
```

### Docker: "Chromium not installed" After First Run

**Root Cause:** Chromium browser files not copied from builder stage.

**Solution:** Rebuild Docker image with fixed Dockerfile:
```bash
docker build --no-cache -t microsoft-rewards-bot -f docker/Dockerfile .
```

The updated Dockerfile now includes:
```dockerfile
COPY --from=builder /usr/src/microsoft-rewards-bot/node_modules/@playwright ./node_modules/@playwright
```

### "Build not found" on Every `npm start`

**Root Cause:** Old version had unnecessary `prestart` hook that checked for build on every start.

**Solution:** Update to latest version. The `prestart` hook has been removed - build happens automatically during `npm install`.

### TypeScript Compilation Errors

**Check for missing dependencies:**
```bash
npm install
```

**Verify tsconfig.json is valid:**
```bash
npm run typecheck
```

**Clean rebuild:**
```bash
npm run clean
npm run build
```

## 📁 Directory Structure

```
Microsoft-Rewards-Bot/
├── src/                     # TypeScript source code
│   ├── index.ts             # Main entry point
│   ├── config.jsonc         # User configuration
│   ├── accounts.jsonc       # Account credentials (gitignored)
│   └── ...
├── dist/                    # Compiled JavaScript (generated)
│   ├── index.js             # Compiled entry point
│   └── ...
├── node_modules/            # Dependencies
│   └── @playwright/         # Chromium browser files
├── docker/                  # Docker configuration
│   ├── Dockerfile           # Multi-stage Docker build
│   ├── compose.yaml         # Docker Compose config
│   ├── entrypoint.sh        # Container initialization
│   ├── run_daily.sh         # Daily execution script
│   └── crontab.template     # Cron schedule template
├── package.json             # Dependencies + scripts
├── tsconfig.json            # TypeScript configuration
└── README.md                # Main documentation
```

## 🔐 Environment Variables

### General
| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `production`, `development` |
| `DEBUG_REWARDS_VERBOSE` | Enable verbose logging | `1` |
| `FORCE_HEADLESS` | Force headless browser | `1` |
| `AUTO_INSTALL_BROWSERS` | Auto-install Chromium if missing | `1` |
| `SKIP_RANDOM_SLEEP` | Skip random delays | `true` |

### Docker-Specific
| Variable | Description | Required |
|----------|-------------|----------|
| `CRON_SCHEDULE` | Cron expression for scheduling | ✅ Yes |
| `TZ` | Timezone (e.g., `America/New_York`) | ❌ No (default: UTC) |
| `RUN_ON_START` | Run immediately on container start | ❌ No (default: false) |
| `PLAYWRIGHT_BROWSERS_PATH` | Browser location (must be `0`) | ✅ Yes (set in Dockerfile) |

## 📚 Related Documentation

- **Getting Started:** [docs/getting-started.md](getting-started.md)
- **Configuration:** [docs/config.md](config.md) (via inline comments in `src/config.jsonc`)
- **Accounts:** [docs/accounts.md](accounts.md)
- **Scheduling:** [src/scheduler/README.md](../src/scheduler/README.md)
- **Docker Deployment:** [docker/README.md](../docker/README.md) (if exists)

## ✅ Best Practices

1. **Always use `npm install` for initial setup** - It does everything automatically
2. **Use `npm start` for normal runs** - No manual build needed
3. **Use `npm run dev` for development** - Faster iteration with hot reload
4. **Clean rebuild if weird errors occur** - `npm run clean && npm run build`
5. **Docker users: Rebuild image after Dockerfile changes** - `docker build --no-cache`
6. **Set `AUTO_INSTALL_BROWSERS=1` if Chromium issues persist** - Automatic fallback

## 🆘 Getting Help

- **Discord:** https://discord.gg/k5uHkx9mne
- **GitHub Issues:** https://github.com/LightZirconite/Microsoft-Rewards-Bot/issues
- **Documentation:** [docs/index.md](index.md)

---

**Last Updated:** November 2025  
**Applies To:** v2.56.7+
