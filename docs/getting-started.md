# 🚀 Getting Started# 🚀 Getting Started# 🚀 Getting Started Guide<div align="center">



<div align="center">



**Complete guide to set up and run Microsoft Rewards Bot****Complete step-by-step guide to set up and run Microsoft Rewards Bot**



*From zero to earning points in 10 minutes*



[← Back to Documentation](index.md)[← Back to Documentation](index.md)Complete step-by-step tutorial to set up and run Microsoft Rewards Bot.<img src="../assets/logo.png" alt="Microsoft Rewards Script Logo" width="120"/>



</div>



------



## 📋 Table of Contents



1. [Requirements](#-requirements)## 📋 Table of Contents---# 🚀 Getting Started

2. [Installation](#-installation)

3. [Account Setup](#-account-setup)

4. [Configuration](#-configuration)

5. [First Run](#-first-run)1. [Prerequisites](#-prerequisites)

6. [Next Steps](#-next-steps)

7. [Troubleshooting](#-troubleshooting)2. [Get the Project](#-get-the-project)



---3. [Create Accounts](#-create-accounts)## 📋 Table of Contents**🎯 From zero to earning Microsoft Rewards points in minutes**  



## ✅ Requirements4. [Configuration](#-configuration)



Before starting, you need:5. [First Run](#-first-run)*Complete setup guide for beginners*



### 1. Node.js 20 or Higher6. [What's Next](#-whats-next)



- **Download:** https://nodejs.org/ (get the LTS version)1. [Prerequisites](#-prerequisites)

- **Verify installation:**

  ```bash---

  node --version

  ```2. [Get the Project](#-get-the-project)</div>

  Should show `v20.x.x` or `v22.x.x`

## ✅ Prerequisites

### 2. Microsoft Accounts

3. [Create Microsoft Accounts](#-create-microsoft-accounts)

- At least **one Microsoft account** (Outlook/Hotmail email)

- If you don't have one, see [Creating New Accounts](#creating-new-accounts-bonus)Before starting, you need:



### 3. Git (Optional)4. [Configuration](#-configuration)---



- **Download:** https://git-scm.com/### 1. Node.js 20 or Higher

- **Alternative:** Download project as ZIP from GitHub

5. [First Run](#-first-run)

---

- **Download:** https://nodejs.org/

## 📦 Installation

- **Recommended:** Version 226. [Troubleshooting](#-troubleshooting)## ✅ Requirements

### Option 1: Git Clone (Recommended)

- **Verify installation:**

```bash

git clone https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot.git  ```bash

cd Microsoft-Rewards-Bot

npm install  node --version

```

  ```---- **Node.js 18+** (22 recommended) — [Download here](https://nodejs.org/)

### Option 2: Download ZIP

  Should show `v20.x.x` or higher

1. Go to: https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot

2. Click **Code** → **Download ZIP**- **Microsoft accounts** with email + password

3. Extract the ZIP file

4. Open a terminal in the extracted folder### 2. Git (Optional but Recommended)

5. Run: `npm install`

## ✅ Prerequisites- **Optional:** Docker for containerized deployment

**Installation takes 2-3 minutes** to download dependencies.

- **Download:** https://git-scm.com/

---

- **Alternative:** Download project as ZIP from GitHub

## 🎯 Account Setup



You have **two options** for setting up accounts:

### 3. Your Referral LinkBefore starting, you need:---

### Option A: Setup Wizard (Easiest)



Run the interactive setup wizard:

**💰 Important: You earn 7,500 points per month for each account you refer!**

```bash

# Windows

setup\setup.bat

1. Log into your **main Microsoft account**1. **Node.js 20+** (version 22 recommended)## ⚡ Quick Setup (Recommended)

# Linux/Mac/WSL

bash setup/setup.sh2. Go to: https://rewards.bing.com/referandearn/



# Or via npm3. Copy your referral link (format: `https://rewards.bing.com/welcome?rh=XXXXX`)   - Download: https://nodejs.org/

npm run setup

```



The wizard will:---   - Verify: `node --version` should show v20 or higher<div align="center">

- ✅ Create `src/accounts.jsonc` from template

- ✅ Guide you through adding your Microsoft account(s)

- ✅ Build the TypeScript project

- ✅ Verify everything works## 📦 Get the Project



### Option B: Manual Setup



1. **Copy the template:**### Option 1: Git Clone (Recommended)2. **Git** (optional, but recommended)### **🎬 One Command, Total Automation**

   ```bash

   # Windows

   copy src\accounts.example.jsonc src\accounts.jsonc

   ```bash   - Download: https://git-scm.com/

   # Linux/Mac

   cp src/accounts.example.jsonc src/accounts.jsoncgit clone https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot.git

   ```

cd Microsoft-Rewards-Bot   - Or download project as ZIP</div>

2. **Edit `src/accounts.jsonc`:**

   ```jsonc```

   {

     "accounts": [

       {

         "email": "your@email.com",### Option 2: Download ZIP

         "password": "your_password",

         "recoveryEmail": "backup@gmail.com",  // Optional but recommended3. **A main Microsoft account** (your personal account)```bash

         "totp": "",                            // Leave empty for now

         "enabled": true1. Visit: https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot

       }

     ]2. Click **Code** → **Download ZIP**   - Go to https://rewards.bing.com/referandearn/# 🪟 Windows

   }

   ```3. Extract the ZIP file



3. **Build the project:**4. Open a terminal in the extracted folder   - Copy your referral link (looks like: `https://rewards.bing.com/welcome?rh=XXXX`)setup/setup.bat

   ```bash

   npm run build

   ```

### Install Dependencies   - **Why?** You earn **7,500 points per month** for each referral!

**📖 Need 2FA/TOTP?** See [Accounts & 2FA Guide](accounts.md) for detailed setup.



---

```bash# 🐧 Linux/macOS/WSL  

## 🆕 Creating New Accounts (Bonus)

npm i

**💰 Important:** You earn **7,500 bonus points per month** for each account created with your referral link!

```---bash setup/setup.sh

### Step 1: Get Your Referral Link



1. Log into your **main Microsoft account**

2. Go to: https://rewards.bing.com/referandearn/This installs all required packages (~2-3 minutes).

3. Copy your referral URL (format: `https://rewards.bing.com/welcome?rh=XXXXX`)



### Step 2: Create Account with Bot

---## 📦 Get the Project# 🌍 Any platform

**Recommended command** (full automation with 2FA):



```bash

npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE -y backup@gmail.com## 🎯 Create Accountsnpm run setup

```



**Replace:**

- `YOUR_CODE` → Your actual referral code### Why Use the Account Creator?### Option 1: Git Clone (Recommended)```

- `backup@gmail.com` → Your real recovery email



**What this does:**

1. ✅ Creates realistic Microsoft account (email, password, name, birthdate)- ✅ **Earn 7,500 bonus points** per month per referral

2. ✅ Enrolls in Microsoft Rewards using YOUR referral

3. ✅ Adds recovery email for account security- ✅ Creates realistic accounts (avoids detection)

4. ✅ Enables 2FA with TOTP (Google Authenticator)

5. ✅ Saves everything to `accounts-created/` folder- ✅ Automatic enrollment in Microsoft Rewards```bash**That's it!** The wizard will:



### Step 3: Complete CAPTCHA- ✅ Built-in 2FA security with TOTP



During creation:- ✅ Saves all account details for yougit clone https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot.git- ✅ Help you create `src/accounts.json` with your Microsoft credentials

1. **CAPTCHA**: Browser will pause - solve it manually

2. **Recovery Email**: Check your email, enter the 6-digit code

3. **2FA Setup**: Scan QR code with Google Authenticator app

4. **Done**: Account details saved automatically!### Step 1: Get Your Referral Linkcd Microsoft-Rewards-Bot- ✅ Install all dependencies automatically  



### Step 4: Find Your Account Info



After creation, find the file in:If you haven't already:```- ✅ Build the TypeScript project

```

accounts-created/account_USERNAME_TIMESTAMP.jsonc1. Log into your main Microsoft account

```

2. Visit: https://rewards.bing.com/referandearn/- ✅ Start earning points immediately

Example content:

```jsonc3. Copy the referral URL

{

  "email": "john.smith1995@outlook.com",### Option 2: Download ZIP

  "password": "Xyz789!@#AbcDef",

  "firstName": "John",### Step 2: Create Account

  "lastName": "Smith",

  "birthdate": {---

    "day": 15,

    "month": 6,**Recommended command (full automation):**

    "year": 1995

  },1. Go to: https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot

  "referralUrl": "https://rewards.bing.com/welcome?rh=YOUR_CODE",

  "recoveryEmail": "backup@gmail.com",```bash

  "totpSecret": "JBSWY3DPEHPK3PXP",

  "recoveryCode": "MWGR3-9MJC9-STK76-SZCE5-X77PR"npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE -y backup@gmail.com2. Click **Code** → **Download ZIP**## 🛠️ Manual Setup

}

``````



**⚠️ KEEP THIS FILE SAFE!**3. Extract the ZIP file

- `totpSecret` → Required for bot login (2FA)

- `recoveryCode` → Emergency account recovery**Replace:**

- `birthdate` → Needed if account gets suspended

- `YOUR_CODE` → Your actual referral code4. Open terminal in the extracted folder<details>

**📖 More details:** [Account Creator Full Guide](../src/account-creation/README.md)

- `backup@gmail.com` → Your real recovery email

---

<summary><strong>📖 Prefer step-by-step? Click here</strong></summary>

## ⚙️ Configuration

**What this does:**

The bot works **great with default settings**, but you can customize it:

1. Creates realistic Microsoft account (email, password, name, birthdate)### Install Dependencies

### Essential Settings

2. Enrolls in Microsoft Rewards using YOUR referral

Open `src/config.jsonc` and review these:

3. Adds recovery email for account security### 1️⃣ **Configure Your Accounts**

```jsonc

{4. Enables 2FA with TOTP (Google Authenticator)

  "humanization": {

    "enabled": true,        // ⚠️ ALWAYS keep this true!5. Saves everything to `accounts-created/` folder```bash```bash

    "stopOnBan": true       // Stop if ban detected

  },

  "workers": {

    "doDesktopSearch": true,  // Desktop Bing searches### Step 3: Complete CAPTCHA & Verificationnpm icp src/accounts.example.json src/accounts.json

    "doMobileSearch": true,   // Mobile Bing searches

    "doDailySet": true,       // Daily activities

    "doMorePromotions": true, // Promotional offers

    "doPunchCards": true      // Multi-day challengesDuring creation:```# Edit accounts.json with your Microsoft credentials

  }

}

```

1. **CAPTCHA**: Browser will pause - solve it manually (required by Microsoft)```

### Optional: Enable Scheduling

2. **Recovery Email**: Check your email, enter the 6-digit code

For **automatic daily runs**:

3. **2FA Setup**: This will install all required packages.

```jsonc

{   - Open Google Authenticator app on your phone

  "scheduling": {

    "enabled": true,   - Scan the QR code shown in browser### 2️⃣ **Install Dependencies & Build**

    "type": "auto",

    "cron": {   - Enter the 6-digit code from the app

      "schedule": "0 9 * * *"  // Daily at 9 AM (Linux/Mac/Raspberry Pi)

    },4. **Done**: Account saved automatically!---```bash

    "taskScheduler": {

      "schedule": "09:00"      // Daily at 9:00 (Windows)

    }

  }### Step 4: Find Your Account Infonpm install

}

```



**How it works:**After creation, a file is created in:## 🎯 Create Microsoft Accountsnpm run build

- Run `npm start` once

- Bot automatically schedules itself```

- Runs every day at your chosen time

- Perfect for Raspberry Pi!accounts-created/account_USERNAME_TIMESTAMP.jsonc```



**📖 More options:** [Configuration Guide](config.md) | [Scheduling Guide](schedule.md)```



---**⚠️ IMPORTANT: Use the account creator with YOUR referral link to earn 7,500 points per account per month!**



## 🎮 First RunExample content:



### Manual Run```jsonc### 3️⃣ **Choose Your Mode**



```bash{

npm start

```  "email": "john.smith1995@outlook.com",### Step 1: Get Your Referral Link```bash



**What happens:**  "password": "Xyz789!@#AbcDef",

1. Bot logs into each enabled account

2. Completes desktop searches (~30 searches)  "birthdate": {# Single run (test it works)

3. Completes mobile searches (~20 searches)

4. Does daily activities (quizzes, polls)    "day": 15,

5. Completes promotional offers

6. Shows summary of points earned    "month": 6,1. Log into your **main Microsoft account**npm start



### With Scheduling    "year": 1995



If you enabled scheduling:  },2. Go to: https://rewards.bing.com/referandearn/

```bash

npm start  "firstName": "John",

```

  "lastName": "Smith",3. Copy your referral link (format: `https://rewards.bing.com/welcome?rh=YOUR_CODE`)# Schedule it (Task Scheduler, cron, etc.)

The bot will:

- Run immediately once  "createdAt": "2025-11-09T10:30:00.000Z",

- **Automatically schedule future runs** (daily)

- No need to run manually again!  "referralUrl": "https://rewards.bing.com/welcome?rh=YOUR_CODE",# See docs/schedule.md for examples



---  "recoveryEmail": "backup@gmail.com",



## 🔧 Next Steps  "totpSecret": "JBSWY3DPEHPK3PXP",### Step 2: Create Accounts```



Now that you're set up, explore these features:  "recoveryCode": "MWGR3-9MJC9-STK76-SZCE5-X77PR"



### High Priority}



| Guide | Why Important |```

|-------|---------------|

| **[Accounts & 2FA](accounts.md)** | Set up TOTP for secure automation |**Recommended command** (enables everything):</details>

| **[Scheduling](schedule.md)** | Automate with Task Scheduler or cron |

**⚠️ KEEP THIS FILE SAFE!**

### Medium Priority

- `totpSecret` → Required for bot login (2FA)

| Guide | Why Useful |

|-------|------------|- `recoveryCode` → Emergency account recovery

| **[Notifications](notifications.md)** | Get alerts on your phone |

| **[Dashboard](../src/dashboard/README.md)** | Monitor accounts in real-time |- `birthdate` → Needed if account gets suspended```bash---



### Optional- All info → Needed to restore account if banned



| Guide | When Needed |npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE -y backup@gmail.com

|-------|-------------|

| **[Proxy Setup](proxy.md)** | Enhanced privacy |### Alternative: Without 2FA (Not Recommended)

| **[Docker](docker.md)** | Containerized deployment |

```## 🎯 What Happens Next?

---

If you don't want 2FA:

## ❓ Troubleshooting



### "Account credentials are invalid"

```bash

**Problem**: Wrong email/password or missing TOTP

npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE**Replace:**The script will automatically:

**Solution**:

1. Check `src/accounts.jsonc` has correct credentials```

2. If 2FA enabled, make sure `totp` field has the secret

3. Test login manually: https://login.live.com/- `YOUR_CODE` with your actual referral code- 🔍 **Search Bing** for points (desktop + mobile)



### "Ban detected" or "Account suspended"Then answer "n" when asked about 2FA setup.



**Problem**: Microsoft detected automation- `backup@gmail.com` with your real recovery email- 📅 **Complete daily sets** (quizzes, polls, activities)  



**Solutions**:---

- ✅ Always keep `humanization.enabled: true`

- ✅ Don't run bot multiple times per day- 🎁 **Grab promotions** and bonus opportunities

- ✅ Use proxies (see [Proxy Guide](proxy.md))

- ✅ Start with 1-2 accounts to test## ⚙️ Configuration



**Account Recovery**:**What this does:**- 🃏 **Work on punch cards** (multi-day challenges)

- Use `birthdate` from `accounts-created/` file

- Use `recoveryCode` if you can't login### Step 1: Setup Accounts File



### "Browser launch failed"1. ✅ Creates a realistic Microsoft account (email, password, name, birthdate)- ✅ **Daily check-ins** for easy points



**Solution:**You have 2 options:

```bash

npx playwright install chromium2. ✅ Enrolls in Microsoft Rewards using YOUR referral link- 📚 **Read articles** for additional rewards

```

#### Option A: Setup Wizard (Easiest)

### "Module not found" errors

3. ✅ Adds recovery email for account security

**Solution:**

```bash```bash

npm install

npm run buildnpm run setup4. ✅ Enables 2FA with TOTP (Google Authenticator)**All while looking completely natural to Microsoft!** 🤖

```

```

### Setup Script Issues

5. ✅ Saves everything to `accounts-created/` folder

**Windows (if PowerShell blocks scripts):**

```powershellThe wizard will:

# Run as Administrator

Set-ExecutionPolicy RemoteSigned -Scope CurrentUser- Create `src/accounts.jsonc` from template---

.\setup\setup.bat

```- Guide you through configuration



**Linux/Mac (if permission denied):**- Build the project automatically### Step 3: CAPTCHA & Verification

```bash

chmod +x setup/setup.sh

bash setup/setup.sh

```**On Windows:**## 🐳 Docker Alternative



**📖 More help:** [Troubleshooting Guide](troubleshooting.md)```powershell



---setup\setup.batDuring account creation:



## 🎯 Best Practices```



1. ✅ **Use referral links** — Earn 7,500 extra points per account per monthIf you prefer containers:

2. ✅ **Enable 2FA** — Protects accounts from theft

3. ✅ **Keep humanization ON** — Reduces ban risk significantly**On Linux/Mac:**

4. ✅ **Run once per day** — Don't over-automate

5. ✅ **Save account files** — Keep `accounts-created/` folder safe```bash1. **CAPTCHA**: The browser will pause - solve it manually

6. ✅ **Use recovery email** — Helps recover suspended accounts

7. ✅ **Monitor logs** — Watch for ban warningsbash setup/setup.sh

8. ✅ **Start small** — Test with 1-2 accounts first

```2. **Recovery Email**: Check your email, enter the verification code```bash

---



## 🆘 Still Need Help?

#### Option B: Manual Setup3. **2FA Setup**: Scan the QR code with Google Authenticator app# Ensure accounts.json and config.json exist

- 💬 **[Join Discord](https://discord.gg/k5uHkx9mne)** — Community support

- 📖 **[Documentation Hub](index.md)** — All guides

- 🐛 **[Report Issue](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/issues)** — Found a bug?

1. **Copy the template:**4. **Complete**: Account details saved automaticallydocker compose up -d

---

   ```bash

<div align="center">

   # Windows

**Happy farming! 🎉**

   copy src\accounts.example.jsonc src\accounts.jsonc

[← Back to Documentation](index.md)

   ### Step 4: Find Your Account Info# Follow logs

</div>

   # Linux/Mac

   cp src/accounts.example.jsonc src/accounts.jsoncdocker logs -f microsoft-rewards-bot

   ```

After creation, check:```

2. **Open `src/accounts.jsonc` in text editor**

```

3. **Fill in account details:**

   ```jsoncaccounts-created/account_USERNAME_TIMESTAMP.jsonc**[Full Docker Guide →](./docker.md)**

   {

     "accounts": [```

       {

         "email": "john.smith1995@outlook.com",     // From accounts-created/ file---

         "password": "Xyz789!@#AbcDef",              // From accounts-created/ file

         "totp": "JBSWY3DPEHPK3PXP",                // ⚠️ REQUIRED if 2FA enabled!Example file content:

         "enabled": true                             // Set to true

       }```jsonc## 🔧 Next Steps

     ]

   }{

   ```

  "email": "john.smith1995@outlook.com",Once running, explore these guides:

4. **Copy info from `accounts-created/` folder**

  "password": "Xyz789!@#AbcDef",

   For each account you created:

   - Copy `email`  "birthdate": {| Priority | Guide | Why Important |

   - Copy `password`

   - Copy `totpSecret` → Put in `totp` field    "day": 15,|----------|-------|---------------|

   - Set `enabled: true`

    "month": 6,| **High** | **[Accounts & 2FA](./accounts.md)** | Set up TOTP for secure automation |

5. **Save the file**

    "year": 1995| **High** | **[External Scheduling](./schedule.md)** | Automate with Task Scheduler or cron |

### Step 2: Configure Bot Settings

  },| **Medium** | **[Notifications](./ntfy.md)** | Get alerts on your phone |

Open `src/config.jsonc`:

  "firstName": "John",| **Low** | **[Humanization](./humanization.md)** | Advanced anti-detection |

#### Enable Automatic Scheduling (Recommended)

  "lastName": "Smith",

```jsonc

{  "createdAt": "2025-11-09T10:30:00.000Z",---

  "scheduling": {

    "enabled": true,  "referralUrl": "https://rewards.bing.com/welcome?rh=YOUR_CODE",

    "type": "auto",

    "cron": {  "recoveryEmail": "backup@gmail.com",## 🆘 Need Help?

      "schedule": "0 9 * * *"    // Daily at 9 AM (Linux/Mac/Raspberry Pi)

    },  "totpSecret": "JBSWY3DPEHPK3PXP",

    "taskScheduler": {

      "schedule": "09:00"         // Daily at 9:00 (Windows)  "recoveryCode": "MWGR3-9MJC9-STK76-SZCE5-X77PR"**Script not starting?** → [Troubleshooting Guide](./diagnostics.md)  

    }

  }}**Login issues?** → [Accounts & 2FA Setup](./accounts.md)  

}

``````**Want Docker?** → [Container Guide](./docker.md)  



**How it works:**

- Run `npm start` once

- Bot automatically schedules itself**⚠️ IMPORTANT: Keep this file safe!****Found a bug?** [Report it here](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/issues)  

- Runs every day at your chosen time

- Perfect for Raspberry Pi!- `totpSecret`: Needed for 2FA login (bot uses this)**Need support?** [Join our Discord](https://discord.gg/k5uHkx9mne)



**See [Scheduling Guide](schedule.md) for details**- `recoveryCode`: Emergency account recovery



#### Notifications (Optional)- `birthdate`: Needed if Microsoft suspends account---



Get notified when bot finishes:- `password`: Keep it safe!



**Discord Webhook:**## 🔗 Related Guides

```jsonc

{### Without 2FA (Not Recommended)

  "conclusionWebhook": {

    "enabled": true,- **[Accounts & 2FA](./accounts.md)** — Add Microsoft accounts with TOTP

    "webhookUrl": "https://discord.com/api/webhooks/YOUR_WEBHOOK"

  }If you don't want 2FA, just omit `-y`:- **[Docker](./docker.md)** — Deploy with containers  

}

```- **[External Scheduling](./schedule.md)** — Automate daily execution



**NTFY Push Notifications:**```bash- **[Discord Webhooks](./conclusionwebhook.md)** — Get run summaries

```jsonc

{npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE

  "ntfy": {```

    "enabled": true,

    "topic": "your-unique-topic",Then answer "n" when asked about 2FA.

    "priority": 3

  }---

}

```## ⚙️ Configuration



**See [Notifications Guide](conclusionwebhook.md) for setup**### Step 1: Setup Accounts File



#### Important Settings#### Option A: Use Setup Wizard



```jsonc```bash

{# Windows

  "humanization": {setup\setup.bat

    "enabled": true,        // ⚠️ ALWAYS keep true!

    "stopOnBan": true       // Stop if ban detected# Linux/Mac

  },bash setup/setup.sh

  "workers": {

    "doDesktopSearch": true,# Or via npm

    "doMobileSearch": true,npm run setup

    "doDailySet": true,```

    "doMorePromotions": true,

    "doPunchCards": trueThe wizard will:

  }1. Create `src/accounts.jsonc` from template

}2. Ask you to fill in account details

```3. Compile the project



**See [Configuration Guide](config.md) for all options**#### Option B: Manual Setup



### Step 3: Build the Project1. Copy the template:

   ```bash

```bash   # Windows

npm run build   copy src\accounts.example.jsonc src\accounts.jsonc

```   

   # Linux/Mac

Or skip if you used the setup wizard (it builds automatically).   cp src/accounts.example.jsonc src/accounts.jsonc

   ```

---

2. Open `src/accounts.jsonc` in a text editor

## 🎮 First Run

3. Fill in your account(s):

### Manual Run   ```jsonc

   {

```bash     "accounts": [

npm start       {

```         "email": "john.smith1995@outlook.com",  // From accounts-created/ file

         "password": "Xyz789!@#AbcDef",          // From accounts-created/ file

**What happens:**         "totp": "JBSWY3DPEHPK3PXP",            // ⚠️ REQUIRED if you enabled 2FA!

1. Bot logs into each enabled account         "enabled": true                         // Set to true to activate

2. Completes desktop searches (30+)       }

3. Completes mobile searches (20+)     ]

4. Does daily activities (quizzes, polls)   }

5. Completes promotional offers   ```

6. Shows summary of points earned

4. **For each account you created**, copy the info from `accounts-created/` folder

### With Automatic Scheduling

5. Save the file

If you enabled scheduling in config:

### Step 2: Configure Bot Settings (Optional)

```bash

npm startOpen `src/config.jsonc` and adjust settings:

```

#### Scheduling (Recommended)

The bot will:

- Run immediately once```jsonc

- Automatically schedule future runs{

- Run daily at your chosen time  "scheduling": {

- No need to run manually again!    "enabled": true,           // Enable automatic scheduling

    "type": "auto",            // Auto-detect OS

### Monitoring    "cron": {

      "schedule": "0 9 * * *" // Run daily at 9 AM (Linux/Mac/Raspberry Pi)

Watch the console output to see:    },

- Login status    "taskScheduler": {

- Search queries      "schedule": "09:00"      // Run daily at 9:00 (Windows)

- Activities completed    }

- Points earned  }

- Ban warnings (if any)}

```

---

**How it works:**

## 🎯 What's Next- Set `enabled: true`

- Run `npm start` once

### Optional: Enable Dashboard- Bot will automatically run every day at the scheduled time

- Perfect for Raspberry Pi or always-on PC!

Add to `src/config.jsonc`:

```jsonc#### Notifications (Optional)

{

  "dashboard": {Get notified when bot finishes:

    "enabled": true,

    "port": 3000**Discord Webhook:**

  }```jsonc

}{

```  "conclusionWebhook": {

    "enabled": true,

Then access: http://localhost:3000    "webhookUrl": "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"

  }

**See [Dashboard Guide](../src/dashboard/README.md)**}

```

### Optional: Setup Proxies

**NTFY Push Notifications:**

For each account, add proxy in `accounts.jsonc`:```jsonc

```jsonc{

{  "ntfy": {

  "email": "...",    "enabled": true,

  "password": "...",    "topic": "your-unique-topic",

  "proxy": {    "priority": 3

    "url": "proxy.example.com",  }

    "port": 8080,}

    "username": "user",```

    "password": "pass"

  }See [Notifications Guide](conclusionwebhook.md) for setup instructions.

}

```#### Other Important Settings



**See [Proxy Guide](proxy.md)**```jsonc

{

### Create More Accounts  "search": {

    "useLocalQueries": false,     // Use Google Trends (recommended)

Repeat the account creation process:    "settings": {

```bash      "useGeoLocaleQueries": true // Use account country (FR, DE, etc.)

npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE -y backup@gmail.com    }

```  },

  "humanization": {

Each account earns YOU 7,500 bonus points per month!    "enabled": true,               // ⚠️ ALWAYS keep this true!

    "stopOnBan": true              // Stop if ban detected

---  },

  "workers": {

## ❓ Troubleshooting    "doDesktopSearch": true,       // Desktop searches

    "doMobileSearch": true,        // Mobile searches

### "Account credentials are invalid"    "doDailySet": true,            // Daily activities

    "doMorePromotions": true,      // Promotional offers

**Cause:** Wrong email/password or missing TOTP    "doPunchCards": true           // Multi-day challenges

  }

**Solution:**}

1. Check `src/accounts.jsonc` has correct credentials```

2. If 2FA enabled, make sure `totp` field has the secret

3. Test login manually: https://login.live.com/### Step 3: Build the Project



### "Ban detected" or "Account suspended"```bash

npm run build

**Cause:** Microsoft detected automation```



**Solutions:**Or if you used the setup wizard, it already did this for you.

- Always keep `humanization.enabled: true`

- Don't run bot multiple times per day---

- Use proxies (see [Proxy Guide](proxy.md))

- Start with 1-2 accounts to test## 🎮 First Run



**Recovery:**### Manual Run

- Use `birthdate` from `accounts-created/` file

- Use `recoveryCode` if can't login```bash

- Contact Microsoft with account creation datenpm start

```

### "Browser launch failed"

The bot will:

**Solution:**1. ✅ Log into each enabled account

```bash2. ✅ Complete desktop searches (30+)

npx playwright install chromium3. ✅ Complete mobile searches (20+)

```4. ✅ Do daily activities (quizzes, polls)

5. ✅ Complete promotional offers

### "Module not found"6. ✅ Show summary of earned points



**Solution:**### With Scheduling (Recommended)

```bash

npm iIf you enabled scheduling in config:

npm run build

``````bash

npm start

### More Help```



- 📖 [Configuration Reference](config-reference.md)Then the bot will:

- 📖 [Diagnostics Guide](diagnostics.md)- Run immediately once

- 📖 [Accounts & 2FA](accounts.md)- **Automatically schedule future runs** (daily at your chosen time)

- 💬 [Join Discord](https://discord.gg/k5uHkx9mne)- You don't need to run it again manually!



---Perfect for Raspberry Pi or always-on systems.



## 🎯 Best Practices---



1. **Use referral links** — 7,500 extra points per account## 🔍 Monitoring

2. **Enable 2FA** — Protects accounts

3. **Keep humanization ON** — Reduces ban risk### Real-time Logs

4. **Run once per day** — Don't overuse

5. **Save account files** — Keep `accounts-created/` safeWatch the console output to see:

6. **Monitor logs** — Watch for warnings- Login status for each account

7. **Start small** — Test with 1-2 accounts- Search queries being performed

- Activities completed

---- Points earned

- Ban warnings (if any)

## 📚 Related Documentation

### Dashboard (Optional)

- [Configuration Guide](config.md)

- [Account Creator Details](../src/account-creation/README.md)Enable the web dashboard:

- [Dashboard Guide](../src/dashboard/README.md)

- [Scheduling Setup](schedule.md)```jsonc

- [Docker Deployment](docker.md){

- [Troubleshooting](diagnostics.md)  "dashboard": {

    "enabled": true,

---    "port": 3000

  }

[← Back to Documentation](index.md)}

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
