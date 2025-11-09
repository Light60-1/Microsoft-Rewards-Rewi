# 🔧 Troubleshooting

**Common issues and how to fix them**

[← Back to Documentation](index.md)

---

## 📋 Table of Contents

- [Installation Issues](#-installation-issues)
- [Login Problems](#-login-problems)
- [Account Issues](#-account-issues)
- [Browser Issues](#-browser-issues)
- [Configuration Problems](#-configuration-problems)
- [Performance Issues](#-performance-issues)
- [Getting Diagnostic Logs](#-getting-diagnostic-logs)

---

## 📦 Installation Issues

### "npm install" fails

**Problem**: Dependencies won't install

**Solutions**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and try again
rm -rf node_modules package-lock.json
npm install

# Try with legacy peer deps
npm install --legacy-peer-deps
```

### "npm run build" fails

**Problem**: TypeScript compilation errors

**Solution**:
```bash
# Make sure you have the latest dependencies
npm install

# Check Node.js version (needs 20+)
node --version

# Try cleaning build cache
npm run build --clean
```

### Permission denied (Linux/Mac)

**Problem**: Can't run setup scripts

**Solution**:
```bash
chmod +x setup/setup.sh
bash setup/setup.sh
```

### Execution policy error (Windows)

**Problem**: PowerShell blocks scripts

**Solution**:
```powershell
# Run as Administrator
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then run setup
.\setup\setup.bat
```

---

## 🔐 Login Problems

### "Account credentials are invalid"

**Cause**: Wrong email/password or missing TOTP

**Solutions**:
1. **Verify credentials** in `src/accounts.jsonc`
2. **Test manually** at https://login.live.com/
3. **Check TOTP** if 2FA enabled (see [Accounts Guide](accounts.md))
4. **Check for typos** in email/password (copy-paste recommended)

### "TOTP challenge still present after multiple attempts"

**Cause**: Invalid TOTP secret or time sync issue

**Solutions**:
1. **Verify TOTP secret** format (Base32, no spaces)
2. **Check system time** is accurate (use NTP)
3. **Re-setup 2FA** and get new secret
4. **Test with authenticator app** first

Example of valid TOTP:
```jsonc
{
  "email": "test@outlook.com",
  "password": "password123",
  "totp": "JBSWY3DPEHPK3PXP"  // ✅ Valid Base32
}
```

### "Login timeout" or "Page did not load"

**Cause**: Network issues or slow connection

**Solutions**:
1. **Check internet connection**
2. **Increase timeout** in `config.jsonc`:
   ```jsonc
   {
     "browserConfig": {
       "timeout": 60000  // Increase to 60 seconds
     }
   }
   ```
3. **Use proxy** if connection is unreliable
4. **Disable VPN** temporarily to test

### "Recovery email mismatch detected"

**Cause**: Recovery email in config doesn't match Microsoft's records

**Solutions**:
1. **Check recovery email** on https://account.microsoft.com/
2. **Update `accounts.jsonc`** with correct recovery email
3. **Leave empty** if no recovery email set:
   ```jsonc
   {
     "recoveryEmail": ""
   }
   ```

---

## 🚫 Account Issues

### "Account suspended" or "Ban detected"

**Cause**: Microsoft detected automation

**Prevention**:
- ✅ **Always enable humanization** in config
- ✅ **Run once per day maximum**
- ✅ **Use different proxies** per account
- ✅ **Don't run multiple accounts** from same IP

**Recovery Steps**:
1. **Wait 24-48 hours** before trying again
2. **Use account recovery** with birthdate/recovery code from `accounts-created/`
3. **Contact Microsoft support** if permanently banned
4. **Check [Security Guide](security.md)** for best practices

### "Account locked" message

**Cause**: Too many failed login attempts

**Solution**:
1. Go to https://account.live.com/acsr
2. Follow the account recovery process
3. Use birthdate from `accounts-created/` file
4. Wait 24 hours before running bot again

### "Verify it's you" security challenge

**Cause**: Microsoft wants additional verification

**Solutions**:
1. **Complete manually** at https://account.microsoft.com/
2. **Add recovery email** if not set
3. **Enable 2FA** for better trust
4. **Use proxy** to avoid location inconsistencies

---

## 🌐 Browser Issues

### "Browser launch failed" or "Executable doesn't exist"

**Cause**: Playwright browser not installed

**Solution**:
```bash
npx playwright install chromium

# Or install all browsers
npx playwright install
```

### Browser crashes or freezes

**Cause**: Memory issues or system resources

**Solutions**:
1. **Close other applications**
2. **Reduce clusters** in config:
   ```jsonc
   {
     "execution": {
       "clusters": 1  // Run one at a time
     }
   }
   ```
3. **Increase system RAM** if possible
4. **Check disk space** (needs ~500MB free)

### "Chrome error://chromewebdata/" errors

**Cause**: Browser navigation interrupted

**Solution**: The bot automatically handles this with retry logic. If it persists:
1. **Check internet stability**
2. **Clear browser cache**:
   ```bash
   rm -rf sessions/
   ```
3. **Reinstall Playwright**:
   ```bash
   npx playwright install --force chromium
   ```

---

## ⚙️ Configuration Problems

### "config.jsonc not found"

**Solution**:
```bash
# Copy from example
cp src/config.example.jsonc src/config.jsonc

# Or use setup wizard
npm run setup
```

### "accounts.jsonc not found"

**Solution**:
```bash
# Copy from example
cp src/accounts.example.jsonc src/accounts.jsonc

# Edit with your credentials
```

### "Invalid JSON" error

**Cause**: Syntax error in JSON file

**Solutions**:
1. **Use a JSON validator**: https://jsonlint.com/
2. **Check for**:
   - Missing commas
   - Trailing commas before `}`
   - Unescaped quotes in strings
   - Missing closing brackets

### Settings not applying

**Solution**:
1. **Rebuild after config changes**:
   ```bash
   npm run build
   ```
2. **Restart bot** completely
3. **Check file is saved** before running

---

## ⚡ Performance Issues

### Bot runs very slowly

**Causes & Solutions**:

1. **Too many accounts running in parallel**:
   ```jsonc
   {
     "execution": {
       "clusters": 1  // Reduce from higher number
     }
   }
   ```

2. **Slow internet connection**:
   - Use wired connection instead of WiFi
   - Increase timeouts in config
   - Run during off-peak hours

3. **System resources low**:
   - Close other applications
   - Check CPU/RAM usage
   - Consider running on better hardware

### Searches taking too long

**Solution**: Adjust search delays:
```jsonc
{
  "search": {
    "settings": {
      "searchDelay": {
        "min": 2000,  // Reduce if too slow
        "max": 3000
      }
    }
  }
}
```

### High memory usage

**Solutions**:
1. **Run fewer accounts in parallel**
2. **Close browser between accounts**:
   ```jsonc
   {
     "execution": {
       "closeBrowserOnError": true
     }
   }
   ```
3. **Clear sessions regularly**:
   ```bash
   rm -rf sessions/
   ```

---

## 📊 Getting Diagnostic Logs

### Capture full logs

**Linux/Mac**:
```bash
npm start > logs.txt 2>&1
```

**Windows**:
```powershell
npm start > logs.txt 2>&1
```

### Enable debug mode

Add to `config.jsonc`:
```jsonc
{
  "debug": true,
  "headless": false  // See browser in action
}
```

### Check dashboard logs

If dashboard is enabled:
1. Go to http://localhost:3000
2. Click "Logs" tab
3. View real-time logs
4. Download log file if needed

### Useful log locations

- **Main logs**: Console output
- **Error logs**: `reports/` folder (if error reporting enabled)
- **Screenshots**: `reports/screenshots/` (on errors)
- **Session data**: `sessions/` folder

---

## 🆘 Still Need Help?

If none of these solutions work:

1. **💬 [Join Discord](https://discord.gg/k5uHkx9mne)** — Get community support
2. **🐛 [Open GitHub Issue](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/issues)** — Report the bug
3. **📖 [Check FAQ](FAQ.md)** — Common questions answered

**When asking for help, include**:
- Operating system (Windows/Linux/Mac)
- Node.js version (`node --version`)
- Error message (full text or screenshot)
- Relevant config (remove sensitive data!)
- Steps to reproduce the issue

---

<div align="center">

[← Back to Documentation](index.md)

</div>
