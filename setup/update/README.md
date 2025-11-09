# Update System

## Overview

The bot uses a **simplified GitHub API-based update system** that:
- ✅ Downloads latest code as ZIP archive
- ✅ No Git required
- ✅ No merge conflicts
- ✅ Preserves user files automatically
- ✅ Automatic dependency installation
- ✅ TypeScript rebuild

## How It Works

1. **Automatic Updates**: If enabled in `config.jsonc`, the bot checks for updates on every startup
2. **Download**: Latest code is downloaded as ZIP from GitHub
3. **Protection**: User files (accounts, config, sessions) are backed up
4. **Update**: Code files are replaced selectively
5. **Restore**: Protected files are restored
6. **Install**: Dependencies are installed (`npm ci`)
7. **Build**: TypeScript is compiled
8. **Restart**: Bot restarts automatically with new version

## Configuration

In `src/config.jsonc`:

```jsonc
{
  "update": {
    "enabled": true,                    // Enable/disable updates
    "autoUpdateAccounts": false,        // Protect accounts files (recommended: false)
    "autoUpdateConfig": false           // Protect config.jsonc (recommended: false)
  }
}
```

## Protected Files

These files are **always protected** (never overwritten):
- `sessions/` - Browser session data
- `.playwright-chromium-installed` - Browser installation marker

These files are **conditionally protected** (based on config):
- `src/accounts.jsonc` - Protected unless `autoUpdateAccounts: true`
- `src/accounts.json` - Protected unless `autoUpdateAccounts: true`
- `src/config.jsonc` - Protected unless `autoUpdateConfig: true`

## Manual Update

Run the update manually:

```bash
node setup/update/update.mjs
```

## Update Detection

The bot uses marker files to prevent restart loops:

- `.update-happened` - Created when files are actually updated
- `.update-restart-count` - Tracks restart attempts (max 3)

If no updates are available, **no marker is created** and the bot won't restart.

## Troubleshooting

### Updates disabled
```
⚠️  Updates are disabled in config.jsonc
```
→ Set `update.enabled: true` in `src/config.jsonc`

### Download failed
```
❌ Download failed: [error]
```
→ Check your internet connection
→ Verify GitHub is accessible

### Extraction failed
```
❌ Extraction failed: [error]
```
→ Ensure you have one of: `unzip`, `tar`, or PowerShell (Windows)

### Build failed
```
⚠️  Update completed with build warnings
```
→ Check TypeScript errors above
→ May still work, but review errors

## Architecture

### File Structure
```
setup/update/
  ├── update.mjs         # Main update script (468 lines)
  └── README.md          # This file
```

### Update Flow
```
Start
  ↓
Check config (enabled?)
  ↓
Read user preferences (autoUpdate flags)
  ↓
Backup protected files
  ↓
Download ZIP from GitHub
  ↓
Extract archive
  ↓
Copy files selectively (skip protected)
  ↓
Restore protected files
  ↓
Cleanup temporary files
  ↓
Create marker (.update-happened) if files changed
  ↓
Install dependencies (npm ci)
  ↓
Build TypeScript
  ↓
Exit (bot auto-restarts if marker exists)
```

## Previous System

The old update system (799 lines) supported two methods:
- Git method (required Git, had merge conflicts)
- GitHub API method

**New system**: Only GitHub API method (simpler, more reliable)

## Anti-Loop Protection

The bot has built-in protection against infinite restart loops:

1. **Marker detection**: Bot only restarts if `.update-happened` exists
2. **Restart counter**: Max 3 restart attempts (`.update-restart-count`)
3. **Counter cleanup**: Removed after successful run without updates
4. **No-update detection**: Marker NOT created if already up to date

This ensures the bot never gets stuck in an infinite update loop.

## Dependencies

No external dependencies required! The update system uses only Node.js built-in modules:
- `node:child_process` - Run shell commands
- `node:fs` - File system operations
- `node:https` - Download files
- `node:path` - Path manipulation

## Exit Codes

- `0` - Success (updated or already up to date)
- `1` - Error (download failed, extraction failed, etc.)

## NPM Scripts

- `npm run start` - Start bot (runs update check first if enabled)
- `npm run dev` - Start in dev mode (skips update check)
- `npm run build` - Build TypeScript manually

## Version Info

- Current version: **v2** (GitHub API only)
- Previous version: v1 (Dual Git/GitHub API)
- Lines of code: **468** (down from 799)
- Complexity: **Simple** (down from Complex)
