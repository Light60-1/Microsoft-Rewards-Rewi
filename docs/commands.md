# NPM Commands Reference

This guide explains all available npm commands and when to use them.

## 🚀 Essential Commands

### `npm start`
**Start the bot** - Use this to run the Microsoft Rewards Bot after setup.

```bash
npm start
```

**What it does:**
- Runs the compiled JavaScript from `dist/index.js`
- Checks for automatic updates (if enabled)
- Executes reward earning tasks
- Fastest way to run the bot

**When to use:**
- Daily bot execution
- After setup is complete
- When you want to earn points

---

### `npm run setup`
**First-time installation** - Run this only once when setting up the project.

```bash
npm run setup
```

**What it does:**
1. Creates `accounts.jsonc` from template
2. Guides you through account configuration
3. Installs dependencies (`npm install`)
4. Builds TypeScript (`npm run build`)
5. Installs Playwright browsers

**When to use:**
- First time installing the bot
- After fresh git clone
- To reconfigure accounts

**Important:** This does NOT start the bot automatically. After setup, run `npm start`.

---

## 🔨 Development Commands

### `npm run build`
**Build TypeScript to JavaScript** - Compiles the project.

```bash
npm run build
```

**What it does:**
- Compiles `src/*.ts` files to `dist/*.js`
- Generates source maps for debugging
- Required before running `npm start`

**When to use:**
- After modifying TypeScript source code
- Before starting the bot with `npm start`
- After pulling updates from git

---

### `npm run dev`
**Development mode** - Run TypeScript directly without building.

```bash
npm run dev
```

**What it does:**
- Runs TypeScript files directly with `ts-node`
- No build step required
- Slower but convenient for development
- Includes `-dev` flag for debug features

**When to use:**
- During development/testing
- When making code changes
- Quick testing without full build

---

### `npm run ts-start`
**TypeScript direct execution** - Like `dev` but without debug flags.

```bash
npm run ts-start
```

**When to use:**
- Alternative to `npm run dev`
- Running TypeScript without full build

---

## 🧹 Maintenance Commands

### `npm run clean`
**Remove build artifacts** - Deletes the `dist` folder.

```bash
npm run clean
```

**When to use:**
- Before fresh rebuild
- To clear stale compiled code
- Troubleshooting build issues

---

### `npm run install-deps`
**Install all dependencies** - Fresh installation of dependencies and browsers.

```bash
npm run install-deps
```

**What it does:**
- Runs `npm install` to install Node.js packages
- Installs Playwright Chromium browser

**When to use:**
- After deleting `node_modules`
- Setting up on new machine
- Troubleshooting dependency issues

---

### `npm run typecheck`
**Check TypeScript types** - Validates code without building.

```bash
npm run typecheck
```

**When to use:**
- Checking for type errors
- Before committing code
- Part of CI/CD pipeline

---

## 🧪 Testing & Quality

### `npm test`
**Run unit tests** - Execute test suite.

```bash
npm test
```

**When to use:**
- Verifying code changes
- Before submitting pull requests
- Continuous integration

---

### `npm run lint`
**Check code style** - ESLint validation.

```bash
npm run lint
```

**When to use:**
- Checking code formatting
- Before commits
- Maintaining code quality

---

## 📊 Dashboard Commands

### `npm run dashboard`
**Start web dashboard only** - Web interface without bot execution.

```bash
npm run dashboard
```

**What it does:**
- Launches web interface on http://localhost:3000
- Provides monitoring and control panel
- Does NOT start reward earning

**When to use:**
- Monitoring bot status
- Viewing logs remotely
- Configuring settings via UI

---

### `npm run dashboard-dev`
**Dashboard development mode** - TypeScript version of dashboard.

```bash
npm run dashboard-dev
```

**When to use:**
- Dashboard development/testing
- Quick dashboard testing without build

---

## 🤖 Account Creation

### `npm run creator`
**Account creation wizard** - Create new Microsoft accounts.

```bash
# Interactive mode
npm run creator

# With auto-accept and recovery email (copy-paste URL directly from Microsoft)
npm run creator -- -y backup@gmail.com https://rewards.bing.com/welcome?rh=YOUR_CODE
```

**When to use:**
- Creating new Microsoft accounts
- Bulk account creation
- Testing account setup

---

## 🐳 Docker Commands

### `npm run create-docker`
**Build Docker image** - Create containerized version.

```bash
npm run create-docker
```

**When to use:**
- Deploying with Docker
- Creating container image
- Testing Docker setup

---

## 🆘 Troubleshooting Commands

### `npm run kill-chrome-win` (Windows only)
**Force close Chrome browsers** - Kill stuck browser processes.

```bash
npm run kill-chrome-win
```

**When to use:**
- Browser processes stuck
- Windows only
- Before restarting bot

---

## 📝 Command Comparison

| Command | Speed | Purpose | When to Use |
|---------|-------|---------|-------------|
| `npm start` | ⚡ Fast | Run bot | Daily use |
| `npm run dev` | 🐌 Slow | Development | Code changes |
| `npm run build` | ⏱️ Medium | Compile TS | Before start |
| `npm run setup` | ⏱️ Medium | First install | Once only |

---

## Common Workflows

### First-Time Setup
```bash
# 1. Run setup wizard
npm run setup

# 2. Start the bot
npm start
```

### Daily Usage
```bash
npm start
```

### After Code Changes
```bash
# Method 1: Build then run (faster)
npm run build
npm start

# Method 2: Direct run (slower)
npm run dev
```

### After Pulling Updates
```bash
# If dependencies changed
npm install

# Rebuild
npm run build

# Start bot
npm start
```

### Troubleshooting
```bash
# Clean install
npm run clean
rm -rf node_modules package-lock.json
npm run install-deps

# Rebuild
npm run build

# Test
npm start
```

---

## ❓ FAQ

### Why does `npm run start` trigger updates?
The bot automatically checks for updates on startup (configurable in `config.jsonc`). To disable:
```jsonc
{
  "update": {
    "enabled": false
  }
}
```

### What's the difference between `npm start` and `npm run start`?
**No functional difference** - both run the same command. `npm start` is a shorthand for `npm run start`.

### Should I use `npm start` or `npm run dev`?
- **Production/Daily use:** `npm start` (faster)
- **Development:** `npm run dev` (no build needed)

### How do I completely reset the project?
```bash
npm run clean
rm -rf node_modules package-lock.json dist
npm run setup
```

---

## Need Help?

- **Getting Started:** [docs/getting-started.md](getting-started.md)
- **Configuration:** [docs/config.md](config.md)
- **Troubleshooting:** [docs/troubleshooting.md](troubleshooting.md)
- **Discord:** https://discord.gg/k5uHkx9mne
