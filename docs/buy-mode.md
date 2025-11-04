# 💳 Buy Mode

**Manually redeem rewards while monitoring points**

---

## 💡 What Is It?

Launches browser and **passively monitors** your points balance while you manually shop/redeem.

**Use case:** Safely redeem gift cards without automation interference.

---

## ⚡ Quick Start

### Option 1: Interactive Selection (Recommended)
```bash
npm run buy
```

### Option 2: Direct Email Selection
```bash
npm run buy your@email.com
```

### Option 3: Numeric Account Index
```bash
npm run buy 1
```

**What happens:**
1. Opens 2 browser tabs:
   - **Monitor tab** — Background point tracking (auto-refresh every ~10s)
   - **Your tab** — Use this for manual purchases
2. Monitors points passively without clicking
3. Sends alerts when spending detected
4. Session runs for configured duration (default: 45 minutes)

---

## 🎯 Account Selection Methods

### 1. Interactive Selection (Easiest)
Run without arguments to see a menu of available accounts:
```bash
npm run buy
```

You'll see:
```
Available accounts:
────────────────────────────────────────────────────────────
[1]   my***t@outlook.com                   Direct
[2]   se***d@outlook.com                   🔒 Proxy
[3]   th***d@outlook.com                   Direct
────────────────────────────────────────────────────────────

Enter account number (1-3) or email:
```

**Features:**
- ✅ Masked emails for privacy
- ✅ Proxy status indication
- ✅ Only shows enabled accounts
- ✅ Validates selection before proceeding

### 2. By Email Address
Specify the exact email address:
```bash
npm run buy myaccount@outlook.com
```

### 3. By Account Number
Use the account index (1-based):
```bash
npm run buy 1  # First enabled account
npm run buy 2  # Second enabled account
```

---

## 🎯 Example Usage

### Redeem Gift Card (Interactive)

```bash
npm run buy
```
Choose your account from the interactive menu.

### Redeem Gift Card (Email)

```bash
npm run buy myaccount@outlook.com
```

1. Script opens Microsoft Rewards in browser
2. Use the **user tab** to browse and redeem
3. **Monitor tab** tracks your balance in background
4. Get notification when points decrease

### Redeem Gift Card (Index)

```bash
npm run buy 1
```
Directly selects the first enabled account from your accounts list.

---

## ⚙️ Configuration

**Set max session time:**

**Edit** `src/config.jsonc`:
```jsonc
{
  "buyMode": {
    "maxMinutes": 45  // Session duration (minimum: 10, default: 45)
  }
}
```

**Session behavior:**
- Monitor tab refreshes every ~10 seconds
- Session automatically ends after `maxMinutes`
- You can close the browser anytime
- Cookies are saved at the end

---

## 🔔 Notifications

Buy mode sends real-time alerts when:
- 💳 **Points spent** — Shows amount and new balance
- 📉 **Balance changes** — Tracks cumulative spending

**Example alert:**
```
💳 Spend Detected (Buy Mode)
Account: user@email.com
Spent: -500 points
Current: 12,500 points
Session spent: 1,200 points
```

**Alert channels:** Uses your configured webhooks (Discord, NTFY, etc.)

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| **"No enabled accounts found"** | Enable at least one account in `accounts.jsonc` |
| **"Invalid account index"** | Check your account number (must be 1-N) |
| **"Account not found"** | Verify email spelling and that account is enabled |
| **Monitor tab closes** | Script auto-reopens it in background |
| **No spending alerts** | Check webhook/NTFY config in `config.jsonc` |
| **Session too short** | Increase `maxMinutes` in config |
| **Interactive prompt not showing** | Run: `npm run buy` (no arguments) |

---

## ⚠️ Important Notes

- ✅ **Browser visible** — Always runs in visible mode (not headless)
- ✅ **No automation** — Script only monitors, never clicks or redeems
- ✅ **Safe** — Use your browsing tab normally
- ✅ **Real-time tracking** — Immediate notifications on point changes
- ✅ **Multiple selection methods** — Interactive, email, or index
- ✅ **Privacy-friendly** — Emails are masked in interactive mode
- ⚠️ **Only enabled accounts** — Disabled accounts don't appear

---

## 📊 Session Summary

At the end of each buy mode session, you'll receive a summary:

```
Account: myaccount@outlook.com
Duration: 45m 12s
Initial points: 15,000
Current points: 13,500
Total spent: 1,500
```

This summary is sent via your configured notification channels.

---

## 💡 Pro Tips

- **Use interactive mode** for the safest selection
- **Build first** if you modified code: `npm run build`
- **Multiple accounts?** Use numeric index for speed
- **Check your balance** before and after in the monitor tab

---

## 📚 Next Steps

**Setup notifications?**  
→ **[Discord Webhooks](./conclusionwebhook.md)**  
→ **[NTFY Push](./ntfy.md)**

**Manage multiple accounts?**  
→ **[Accounts Guide](./accounts.md)**

**Back to automation?**  
→ **[Getting Started](./getting-started.md)**

---

**[← Back to Hub](./index.md)** | **[Config Guide](./config.md)**
