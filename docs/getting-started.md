# 🚀 Getting Started Guide<div align="center">



Complete step-by-step tutorial to set up and run Microsoft Rewards Bot.<img src="../assets/logo.png" alt="Microsoft Rewards Script Logo" width="120"/>



---# 🚀 Getting Started



## 📋 Table of Contents**🎯 From zero to earning Microsoft Rewards points in minutes**  

*Complete setup guide for beginners*

1. [Prerequisites](#-prerequisites)

2. [Get the Project](#-get-the-project)</div>

3. [Create Microsoft Accounts](#-create-microsoft-accounts)

4. [Configuration](#-configuration)---

5. [First Run](#-first-run)

6. [Troubleshooting](#-troubleshooting)## ✅ Requirements



---- **Node.js 18+** (22 recommended) — [Download here](https://nodejs.org/)

- **Microsoft accounts** with email + password

## ✅ Prerequisites- **Optional:** Docker for containerized deployment



Before starting, you need:---



1. **Node.js 20+** (version 22 recommended)## ⚡ Quick Setup (Recommended)

   - Download: https://nodejs.org/

   - Verify: `node --version` should show v20 or higher<div align="center">



2. **Git** (optional, but recommended)### **🎬 One Command, Total Automation**

   - Download: https://git-scm.com/

   - Or download project as ZIP</div>



3. **A main Microsoft account** (your personal account)```bash

   - Go to https://rewards.bing.com/referandearn/# 🪟 Windows

   - Copy your referral link (looks like: `https://rewards.bing.com/welcome?rh=XXXX`)setup/setup.bat

   - **Why?** You earn **7,500 points per month** for each referral!

# 🐧 Linux/macOS/WSL  

---bash setup/setup.sh



## 📦 Get the Project# 🌍 Any platform

npm run setup

### Option 1: Git Clone (Recommended)```



```bash**That's it!** The wizard will:

git clone https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot.git- ✅ Help you create `src/accounts.json` with your Microsoft credentials

cd Microsoft-Rewards-Bot- ✅ Install all dependencies automatically  

```- ✅ Build the TypeScript project

- ✅ Start earning points immediately

### Option 2: Download ZIP

---

1. Go to: https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot

2. Click **Code** → **Download ZIP**## 🛠️ Manual Setup

3. Extract the ZIP file

4. Open terminal in the extracted folder<details>

<summary><strong>📖 Prefer step-by-step? Click here</strong></summary>

### Install Dependencies

### 1️⃣ **Configure Your Accounts**

```bash```bash

npm icp src/accounts.example.json src/accounts.json

```# Edit accounts.json with your Microsoft credentials

```

This will install all required packages.

### 2️⃣ **Install Dependencies & Build**

---```bash

npm install

## 🎯 Create Microsoft Accountsnpm run build

```

**⚠️ IMPORTANT: Use the account creator with YOUR referral link to earn 7,500 points per account per month!**

### 3️⃣ **Choose Your Mode**

### Step 1: Get Your Referral Link```bash

# Single run (test it works)

1. Log into your **main Microsoft account**npm start

2. Go to: https://rewards.bing.com/referandearn/

3. Copy your referral link (format: `https://rewards.bing.com/welcome?rh=YOUR_CODE`)# Schedule it (Task Scheduler, cron, etc.)

# See docs/schedule.md for examples

### Step 2: Create Accounts```



**Recommended command** (enables everything):</details>



```bash---

npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE -y backup@gmail.com

```## 🎯 What Happens Next?



**Replace:**The script will automatically:

- `YOUR_CODE` with your actual referral code- 🔍 **Search Bing** for points (desktop + mobile)

- `backup@gmail.com` with your real recovery email- 📅 **Complete daily sets** (quizzes, polls, activities)  

- 🎁 **Grab promotions** and bonus opportunities

**What this does:**- 🃏 **Work on punch cards** (multi-day challenges)

1. ✅ Creates a realistic Microsoft account (email, password, name, birthdate)- ✅ **Daily check-ins** for easy points

2. ✅ Enrolls in Microsoft Rewards using YOUR referral link- 📚 **Read articles** for additional rewards

3. ✅ Adds recovery email for account security

4. ✅ Enables 2FA with TOTP (Google Authenticator)**All while looking completely natural to Microsoft!** 🤖

5. ✅ Saves everything to `accounts-created/` folder

---

### Step 3: CAPTCHA & Verification

## 🐳 Docker Alternative

During account creation:

If you prefer containers:

1. **CAPTCHA**: The browser will pause - solve it manually

2. **Recovery Email**: Check your email, enter the verification code```bash

3. **2FA Setup**: Scan the QR code with Google Authenticator app# Ensure accounts.json and config.json exist

4. **Complete**: Account details saved automaticallydocker compose up -d



### Step 4: Find Your Account Info# Follow logs

docker logs -f microsoft-rewards-bot

After creation, check:```

```

accounts-created/account_USERNAME_TIMESTAMP.jsonc**[Full Docker Guide →](./docker.md)**

```

---

Example file content:

```jsonc## 🔧 Next Steps

{

  "email": "john.smith1995@outlook.com",Once running, explore these guides:

  "password": "Xyz789!@#AbcDef",

  "birthdate": {| Priority | Guide | Why Important |

    "day": 15,|----------|-------|---------------|

    "month": 6,| **High** | **[Accounts & 2FA](./accounts.md)** | Set up TOTP for secure automation |

    "year": 1995| **High** | **[External Scheduling](./schedule.md)** | Automate with Task Scheduler or cron |

  },| **Medium** | **[Notifications](./ntfy.md)** | Get alerts on your phone |

  "firstName": "John",| **Low** | **[Humanization](./humanization.md)** | Advanced anti-detection |

  "lastName": "Smith",

  "createdAt": "2025-11-09T10:30:00.000Z",---

  "referralUrl": "https://rewards.bing.com/welcome?rh=YOUR_CODE",

  "recoveryEmail": "backup@gmail.com",## 🆘 Need Help?

  "totpSecret": "JBSWY3DPEHPK3PXP",

  "recoveryCode": "MWGR3-9MJC9-STK76-SZCE5-X77PR"**Script not starting?** → [Troubleshooting Guide](./diagnostics.md)  

}**Login issues?** → [Accounts & 2FA Setup](./accounts.md)  

```**Want Docker?** → [Container Guide](./docker.md)  



**⚠️ IMPORTANT: Keep this file safe!****Found a bug?** [Report it here](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/issues)  

- `totpSecret`: Needed for 2FA login (bot uses this)**Need support?** [Join our Discord](https://discord.gg/k5uHkx9mne)

- `recoveryCode`: Emergency account recovery

- `birthdate`: Needed if Microsoft suspends account---

- `password`: Keep it safe!

## 🔗 Related Guides

### Without 2FA (Not Recommended)

- **[Accounts & 2FA](./accounts.md)** — Add Microsoft accounts with TOTP

If you don't want 2FA, just omit `-y`:- **[Docker](./docker.md)** — Deploy with containers  

- **[External Scheduling](./schedule.md)** — Automate daily execution

```bash- **[Discord Webhooks](./conclusionwebhook.md)** — Get run summaries

npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE
```

Then answer "n" when asked about 2FA.

---

## ⚙️ Configuration

### Step 1: Setup Accounts File

#### Option A: Use Setup Wizard

```bash
# Windows
setup\setup.bat

# Linux/Mac
bash setup/setup.sh

# Or via npm
npm run setup
```

The wizard will:
1. Create `src/accounts.jsonc` from template
2. Ask you to fill in account details
3. Compile the project

#### Option B: Manual Setup

1. Copy the template:
   ```bash
   # Windows
   copy src\accounts.example.jsonc src\accounts.jsonc
   
   # Linux/Mac
   cp src/accounts.example.jsonc src/accounts.jsonc
   ```

2. Open `src/accounts.jsonc` in a text editor

3. Fill in your account(s):
   ```jsonc
   {
     "accounts": [
       {
         "email": "john.smith1995@outlook.com",  // From accounts-created/ file
         "password": "Xyz789!@#AbcDef",          // From accounts-created/ file
         "totp": "JBSWY3DPEHPK3PXP",            // ⚠️ REQUIRED if you enabled 2FA!
         "enabled": true                         // Set to true to activate
       }
     ]
   }
   ```

4. **For each account you created**, copy the info from `accounts-created/` folder

5. Save the file

### Step 2: Configure Bot Settings (Optional)

Open `src/config.jsonc` and adjust settings:

#### Scheduling (Recommended)

```jsonc
{
  "scheduling": {
    "enabled": true,           // Enable automatic scheduling
    "type": "auto",            // Auto-detect OS
    "cron": {
      "schedule": "0 9 * * *" // Run daily at 9 AM (Linux/Mac/Raspberry Pi)
    },
    "taskScheduler": {
      "schedule": "09:00"      // Run daily at 9:00 (Windows)
    }
  }
}
```

**How it works:**
- Set `enabled: true`
- Run `npm start` once
- Bot will automatically run every day at the scheduled time
- Perfect for Raspberry Pi or always-on PC!

#### Notifications (Optional)

Get notified when bot finishes:

**Discord Webhook:**
```jsonc
{
  "conclusionWebhook": {
    "enabled": true,
    "webhookUrl": "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"
  }
}
```

**NTFY Push Notifications:**
```jsonc
{
  "ntfy": {
    "enabled": true,
    "topic": "your-unique-topic",
    "priority": 3
  }
}
```

See [Notifications Guide](conclusionwebhook.md) for setup instructions.

#### Other Important Settings

```jsonc
{
  "search": {
    "useLocalQueries": false,     // Use Google Trends (recommended)
    "settings": {
      "useGeoLocaleQueries": true // Use account country (FR, DE, etc.)
    }
  },
  "humanization": {
    "enabled": true,               // ⚠️ ALWAYS keep this true!
    "stopOnBan": true              // Stop if ban detected
  },
  "workers": {
    "doDesktopSearch": true,       // Desktop searches
    "doMobileSearch": true,        // Mobile searches
    "doDailySet": true,            // Daily activities
    "doMorePromotions": true,      // Promotional offers
    "doPunchCards": true           // Multi-day challenges
  }
}
```

### Step 3: Build the Project

```bash
npm run build
```

Or if you used the setup wizard, it already did this for you.

---

## 🎮 First Run

### Manual Run

```bash
npm start
```

The bot will:
1. ✅ Log into each enabled account
2. ✅ Complete desktop searches (30+)
3. ✅ Complete mobile searches (20+)
4. ✅ Do daily activities (quizzes, polls)
5. ✅ Complete promotional offers
6. ✅ Show summary of earned points

### With Scheduling (Recommended)

If you enabled scheduling in config:

```bash
npm start
```

Then the bot will:
- Run immediately once
- **Automatically schedule future runs** (daily at your chosen time)
- You don't need to run it again manually!

Perfect for Raspberry Pi or always-on systems.

---

## 🔍 Monitoring

### Real-time Logs

Watch the console output to see:
- Login status for each account
- Search queries being performed
- Activities completed
- Points earned
- Ban warnings (if any)

### Dashboard (Optional)

Enable the web dashboard:

```jsonc
{
  "dashboard": {
    "enabled": true,
    "port": 3000
  }
}
```

Then access: http://localhost:3000

Features:
- Real-time account status
- Live log streaming
- Manual sync buttons
- Configuration editor
- Historical metrics

---

## ❓ Troubleshooting

### "Account credentials are invalid"

**Problem**: Wrong email/password or missing TOTP

**Solution**:
1. Check `src/accounts.jsonc` has correct email and password
2. If you enabled 2FA, make sure `totp` field has the secret from `accounts-created/` file
3. Test login manually at https://login.live.com/

### "Ban detected" or "Account suspended"

**Problem**: Microsoft detected automation

**Solutions**:
- ✅ Always keep `humanization.enabled: true` in config
- ✅ Don't run the bot multiple times per day
- ✅ Use different proxies for each account (see [Proxy Guide](proxy.md))
- ✅ Start with 1-2 accounts to test

**Account Recovery**:
- Use the `birthdate` from `accounts-created/` file
- Use the `recoveryCode` if you can't login
- Contact Microsoft support with account creation date

### "Browser launch failed"

**Problem**: Chromium not installed

**Solution**:
```bash
npx playwright install chromium
```

### "Module not found" errors

**Problem**: Dependencies not installed

**Solution**:
```bash
npm i
npm run build
```

### Setup Script Not Working

**Windows:**
```powershell
# Run as Administrator
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup\setup.bat
```

**Linux/Mac:**
```bash
chmod +x setup/setup.sh
bash setup/setup.sh
```

### More Help

- 📖 [Configuration Reference](config-reference.md)
- 📖 [Accounts & 2FA](accounts.md)
- 📖 [Proxy Setup](proxy.md)
- 📖 [Diagnostics & Logs](diagnostics.md)
- 💬 [Join Discord](https://discord.gg/k5uHkx9mne)

---

## 🎯 Best Practices

1. **Use referral links** - Earn 7,500 extra points per account per month
2. **Enable 2FA** - Protect accounts from being stolen
3. **Keep humanization ON** - Reduces ban risk
4. **Run once per day** - Don't over-automate
5. **Save account files** - Keep `accounts-created/` folder safe
6. **Use recovery email** - Helps recover suspended accounts
7. **Monitor logs** - Watch for ban warnings
8. **Start small** - Test with 1-2 accounts first

---

## 🚀 Next Steps

Now that you're set up:

1. ✅ Let the bot run once to see results
2. ✅ Check points earned on https://rewards.bing.com/
3. ✅ Set up scheduling for automatic runs
4. ✅ Configure notifications to stay informed
5. ✅ Add more accounts with referrals (earn more points!)

**Happy farming! 🎉**

---

## 📚 Related Documentation

- [Configuration Guide](config.md)
- [Account Creator Full Guide](../src/account-creation/README.md)
- [Dashboard Guide](../src/dashboard/README.md)
- [Scheduling Setup](schedule.md)
- [Docker Deployment](docker.md)
- [Troubleshooting](diagnostics.md)
