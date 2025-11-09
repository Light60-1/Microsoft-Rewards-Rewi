# Setup Scripts

This folder contains setup and update scripts for the Microsoft Rewards Bot.

## Files

### setup.bat / setup.sh
**First-time installation scripts** for Windows (.bat) and Linux/macOS (.sh).

**What they do:**
1. Check prerequisites (Node.js, npm)
2. Create `accounts.jsonc` from template
3. Guide you through account configuration
4. Install dependencies (`npm install`)
5. Build TypeScript project (`npm run build`)
6. Install Playwright Chromium browser

**Usage:**
```bash
# Windows
.\setup\setup.bat

# Linux/macOS
./setup/setup.sh
```

**Important:** These scripts do NOT start the bot automatically. After setup, run:
```bash
npm start
```

### update/update.mjs
**Automatic update script** that keeps your bot up-to-date with the latest version.

**Features:**
- Two update methods: Git-based or GitHub API (no Git needed)
- Preserves your configuration and accounts
- No merge conflicts with GitHub API method
- Automatic dependency installation and rebuild

**Usage:**
```bash
# Auto-detect method from config.jsonc
node setup/update/update.mjs

# Force GitHub API method (recommended)
node setup/update/update.mjs --no-git

# Force Git method
node setup/update/update.mjs --git
```

**Automatic updates:** The bot checks for updates on startup (controlled by `update.enabled` in config.jsonc).

### update/setup.mjs
**Interactive setup wizard** used by setup.bat/setup.sh.

This is typically not run directly - use the wrapper scripts instead.

## Quick Start Guide

### First-time setup:

**Windows:**
```batch
.\setup\setup.bat
```

**Linux/macOS:**
```bash
chmod +x setup/setup.sh
./setup/setup.sh
```

### Daily usage:

```bash
# Start the bot
npm start

# Start with TypeScript (development)
npm run dev

# View dashboard
npm run dashboard
```

### Configuration:

- **Accounts:** Edit `src/accounts.jsonc`
- **Settings:** Edit `src/config.jsonc`
- **Documentation:** See `docs/` folder

## Troubleshooting

### "npm not found"
Install Node.js from https://nodejs.org/ (v20 or newer recommended)

### "Setup failed"
1. Delete `node_modules` folder
2. Delete `package-lock.json` file
3. Run setup again

### "Build failed"
```bash
npm run clean
npm run build
```

### Update issues
If automatic updates fail, manually update:
```bash
git pull origin main
npm install
npm run build
```

## Need Help?

- **Documentation:** `docs/index.md`
- **Getting Started:** `docs/getting-started.md`
- **Troubleshooting:** `docs/troubleshooting.md`
- **Discord:** https://discord.gg/k5uHkx9mne
