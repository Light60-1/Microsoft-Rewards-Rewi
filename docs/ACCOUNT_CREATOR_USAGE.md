# 🎯 Account Creator - How to Use

## ⚠️ CRITICAL: The `--` separator

**npm consumes `-y` if you don't use `--` !**

### ❌ WRONG (doesn't work)
```powershell
npm run creator "URL" -y
# Result: -y is consumed by npm, not passed to the script
```

### ✅ CORRECT (works)
```powershell
npm run creator -- "URL" -y
# The -- tells npm: "everything after belongs to the script"
```

---

## 📋 Examples

### Auto mode (no questions asked)
```powershell
npm run creator -- "https://rewards.bing.com/welcome?rh=E3DCB441" -y
```

### Auto mode with recovery email
```powershell
npm run creator -- "https://rewards.bing.com/welcome?rh=E3DCB441" -y maxou.freq@gmail.com
```

### Interactive mode (asks for options)
```powershell
npm run creator -- "https://rewards.bing.com/welcome?rh=E3DCB441"
```

### -y can be BEFORE the URL too
```powershell
npm run creator -- -y "https://rewards.bing.com/welcome?rh=E3DCB441"
```

---

## 🔧 Flags

| Flag | Description |
|------|-------------|
| `--` | **REQUIRED** - Separates npm args from script args |
| `-y` or `--yes` | Auto-accept all prompts (no questions) |
| `"URL"` | Referral URL (use quotes!) |
| `email@domain.com` | Recovery email (optional) |

---

## 🚨 Common Errors

### "Generate email automatically? (Y/n):" appears even with -y

**Cause**: You forgot the `--` separator

**Fix**: Add `--` after `npm run creator`

```powershell
# ❌ WRONG
npm run creator "URL" -y

# ✅ CORRECT
npm run creator -- "URL" -y
```

---

### URL is truncated at & character

**Cause**: URL not wrapped in quotes

**Fix**: Always use quotes around URLs

```powershell
# ❌ WRONG
npm run creator -- https://rewards.bing.com/welcome?rh=CODE&ref=xxx -y

# ✅ CORRECT
npm run creator -- "https://rewards.bing.com/welcome?rh=CODE&ref=xxx" -y
```

---

## 📝 Full Command Template

```powershell
npm run creator -- "https://rewards.bing.com/welcome?rh=YOUR_CODE" -y your.email@gmail.com
                 ↑  ↑                                                ↑  ↑
                 |  |                                                |  |
                 |  URL in quotes (required if contains &)         |  Optional recovery email
                 |                                                  |
                 -- separator (REQUIRED for -y to work)            -y flag (auto mode)
```
