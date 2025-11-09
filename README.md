<div align="center"><div align="center">



<img src="assets/logo.png" alt="Microsoft Rewards Bot Logo" width="200"/><img src="assets/logo.png" alt="Microsoft Rewards Bot Logo" width="200"/>



# Microsoft Rewards Bot# Microsoft Rewards Bot



**Automate your Microsoft Rewards points collection effortlessly****Automate your Microsoft Rewards points collection effortlessly**



[![Discord](https://img.shields.io/badge/💬_Join_Discord-7289DA?style=for-the-badge&logo=discord)](https://discord.gg/k5uHkx9mne) [![Discord](https://img.shields.io/badge/💬_Join_Discord-7289DA?style=for-the-badge&logo=discord)](https://discord.gg/k5uHkx9mne) 

[![GitHub](https://img.shields.io/badge/⭐_Star_Project-yellow?style=for-the-badge&logo=github)](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot)[![GitHub](https://img.shields.io/badge/⭐_Star_Project-yellow?style=for-the-badge&logo=github)](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot)

[![Version](https://img.shields.io/badge/version-2.56.0-blue?style=for-the-badge)](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/releases)[![Version](https://img.shields.io/badge/version-2.56.0-blue?style=for-the-badge)](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/releases)

[![License](https://img.shields.io/badge/license-CC_BY--NC--SA_4.0-green?style=for-the-badge)](LICENSE)[![License](https://img.shields.io/badge/license-CC_BY--NC--SA_4.0-green?style=for-the-badge)](LICENSE)



</div></div>



------



## 🎯 What It Does##  About



Automatically completes Microsoft Rewards tasks to maximize your points:This TypeScript-based automation bot helps you maximize your **Microsoft Rewards** points by automatically completing daily tasks, searches, quizzes, and promotional offers. Designed with sophisticated anti-detection measures and human-like behavior patterns to ensure safe, reliable operation.



- ✅ **Desktop & Mobile Searches** — 30+ desktop + 20+ mobile Bing searches### ✨ Key Features

- ✅ **Daily Activities** — Quizzes, polls, daily sets

- ✅ **Promotional Offers** — Special tasks and bonuses- 🔍 **Automated Searches** — Desktop and mobile Bing searches with natural patterns

- ✅ **Punch Cards** — Multi-day challenges- 📅 **Daily Activities** — Quizzes, polls, daily sets, and punch cards

- ✅ **Human-like Behavior** — Advanced anti-detection- 🤖 **Human-like Behavior** — Advanced humanization system to avoid detection

- ✅ **Multi-Account Support** — Manage unlimited accounts- 🛡️ **Risk Management** — Built-in ban detection and prediction with ML algorithms

- ✅ **Automatic Scheduling** — Set it and forget it- ⏰ **Automatic Scheduling** — Easy configuration for cron (Linux/Raspberry Pi) and Windows Task Scheduler

- ✅ **Notifications** — Discord webhooks & push alerts- 🔔 **Notifications** — Discord webhooks and NTFY push alerts

- 🐳 **Docker Support** — Easy containerized deployment

---- 🔐 **Multi-Account** — Manage multiple accounts with parallel execution

- 🌐 **Proxy Support** — Optional proxy configuration for enhanced privacy

## 🚀 Quick Start

---

### Prerequisites

## 🚀 Quick Start

- **Node.js 20+** → [Download](https://nodejs.org/)

- **Git** (optional) → [Download](https://git-scm.com/) or download ZIP### ⚡ Prerequisites



### Installation- **Node.js 20+** (v22 recommended) — [Download here](https://nodejs.org/)

- **Git** (optional) — [Download here](https://git-scm.com/) or download project as ZIP

```bash

# 1. Get the project### 🎯 3-Step Setup

git clone https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot.git

cd Microsoft-Rewards-Bot1. **Get the project:**

   ```bash

# 2. Install dependencies   git clone https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot.git

npm i   cd Microsoft-Rewards-Bot

   ```

# 3. Create accounts with referral (earn +7,500 points/month!)   Or download ZIP: [Code → Download ZIP](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/archive/refs/heads/main.zip)

npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE -y backup@gmail.com

2. **Install dependencies:**

# 4. Configure   ```bash

npm run setup   npm i

   ```

# 5. Run

npm start3. **Create accounts & configure:**

```   ```bash

   # Use our account creator (recommended - earn +7,500 points/month!)

**📖 [Complete Setup Guide](docs/getting-started.md)** — Detailed step-by-step instructions   npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE -y backup@gmail.com

   

---   # Or use setup wizard

   npm run setup

## 🆕 Account Creator   ```



**💰 Earn +7,500 bonus points per month per referral!****📖 Need detailed instructions? See [Getting Started Guide](docs/getting-started.md)**



Automatically create Microsoft accounts with full security:---



```bash## 📚 Documentation

# Full automation (referral + recovery email + 2FA)

npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE -y backup@gmail.comFor detailed configuration, advanced features, and troubleshooting, visit our comprehensive documentation:

```

**👉 [Complete Documentation](docs/index.md)**

**What it does:**

- Creates realistic Microsoft account### Quick Links

- Enrolls in Rewards with YOUR referral link

- Adds recovery email + 2FA with TOTP| Topic | Description |

- Saves everything to `accounts-created/` folder|-------|-------------|

| **[Getting Started](docs/getting-started.md)** | Detailed installation and first-run guide |

**📖 [Creator Guide](src/account-creation/README.md) | [Getting Started](docs/getting-started.md)**| **[Configuration](docs/config.md)** | Complete configuration options reference |

| **[Accounts & 2FA](docs/accounts.md)** | Setting up accounts with TOTP authentication |

---| **[Dashboard](src/dashboard/README.md)** | 🆕 Local web dashboard for monitoring and control |

| **[External Scheduling](docs/schedule.md)** | Use OS schedulers for automation |

## 📊 Dashboard| **[Docker Deployment](docs/docker.md)** | Running in containers |

| **[Humanization](docs/humanization.md)** | Anti-detection and natural behavior |

Monitor and control your bot through a web interface:| **[Notifications](docs/conclusionwebhook.md)** | Discord webhooks and NTFY setup |

| **[Proxy Setup](docs/proxy.md)** | Configuring proxies for privacy |

```bash| **[Troubleshooting](docs/diagnostics.md)** | Debug common issues and capture logs |

npm run dashboard

# Access at http://localhost:3000---

```

## 📊 Dashboard (BETA)

**Features:**

- Real-time points and account statusMonitor and control your bot through a local web interface:

- Live log streaming

- Manual sync controls```bash

- Configuration editor# Start dashboard separately

- Historical metricsnpm run dashboard



**📖 [Dashboard Documentation](src/dashboard/README.md)**# Or enable auto-start in config.jsonc:

{

---  "dashboard": {

    "enabled": true,

## ⏰ Automatic Scheduling    "port": 3000

  }

Run the bot automatically every day:}

```

```jsonc

// src/config.jsoncAccess at `http://localhost:3000` to:

{- 📈 View real-time points and account status

  "scheduling": {- 📋 Monitor live logs with WebSocket streaming

    "enabled": true,- 🔄 Manually sync individual accounts

    "type": "auto",- ⚙️ Edit configuration with automatic backup

    "cron": { "schedule": "0 9 * * *" }  // 9 AM daily- 📊 View historical run summaries and metrics

  }

}**[📖 Full Dashboard API Documentation](src/dashboard/README.md)**

```

---

Then just run once:

```bash## 🆕 Account Creator (BETA)

npm start

```Automatically create new Microsoft accounts with advanced security features:



The bot will automatically schedule itself. Perfect for Raspberry Pi!```bash

# Interactive mode (asks everything)

**📖 [Scheduling Guide](docs/schedule.md)**npm run creator



---# With referral link (earn rewards credit)

npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE

## 📚 Documentation

# Auto-accept mode (enables recovery + 2FA automatically)

| Topic | Description |npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE -y

|-------|-------------|

| **[Getting Started](docs/getting-started.md)** | Complete setup tutorial |# With specific recovery email (auto-detected, no flag needed!)

| **[Configuration](docs/config.md)** | All settings explained |npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE -y backup@gmail.com

| **[Accounts & 2FA](docs/accounts.md)** | Account setup with TOTP |

| **[Scheduling](docs/schedule.md)** | Automatic daily runs |# Just recovery email, no referral

| **[Dashboard](src/dashboard/README.md)** | Web interface guide |npm run creator -y myrecovery@gmail.com

| **[Docker](docs/docker.md)** | Container deployment |```

| **[Notifications](docs/conclusionwebhook.md)** | Discord & NTFY alerts |

| **[Proxy Setup](docs/proxy.md)** | IP rotation |**✨ Features:**

| **[Humanization](docs/humanization.md)** | Anti-detection |- 🎯 **Language-independent** — Works in any language

| **[Troubleshooting](docs/diagnostics.md)** | Debug issues |- 🔐 **Strong passwords** — Automatically generated (12-16 chars)

- 📧 **Realistic emails** — 200+ name database for natural-looking addresses

**📖 [Full Documentation Index](docs/index.md)**- 🎂 **Natural birthdates** — Random age 18-50 years old

- 🛡️ **Recovery email** — Optional backup email for account recovery

---- 🔒 **2FA support** — TOTP authentication with Google Authenticator

- 🔑 **TOTP secrets** — Extracts and saves secret keys

## ⚠️ Disclaimer- 💾 **Complete backups** — Saves all details including recovery codes

- 🤖 **CAPTCHA support** — Manual solving (human verification)

**Use at your own risk.** This script automates Microsoft Rewards, which may violate their Terms of Service. Using automation can result in:- � **Organized storage** — Individual files per account



- Account suspension or permanent ban**🎛️ Command Arguments (SIMPLIFIED!):**

- Loss of points and rewards- `<url>` — Referral URL (auto-detected if starts with http)

- Restriction from future participation- `<email>` — Recovery email (auto-detected if contains @)

- `-y` — Auto-accept mode (enables recovery + 2FA automatically)

**This project is for educational purposes only.** The developers are not responsible for any actions taken against your account.

**That's it! No more confusing flags.** 🎉

---

**⚙️ How It Works:**

## 📄 License

| Command | Recovery Email | 2FA | Notes |

Licensed under **CC BY-NC-SA 4.0** — Personal use only, no commercial use.|---------|---------------|-----|-------|

| `npm run creator` | ❓ Prompts | ❓ Prompts | Interactive mode |

See [LICENSE](LICENSE) for details.| `npm run creator -y` | ✅ Prompts for email | ✅ Enabled | Auto-accept all |

| `npm run creator -y backup@gmail.com` | ✅ Uses provided email | ✅ Enabled | Full automation |

---| `npm run creator URL -y` | ✅ Prompts for email | ✅ Enabled | With referral |

| `npm run creator URL -y backup@gmail.com` | ✅ Uses provided email | ✅ Enabled | Complete setup |

## 🙏 Acknowledgments

**📋 What happens:**

- Built with [Playwright](https://playwright.dev/) and [ReBrowser](https://github.com/rebrowser/rebrowser-playwright)1. Creates Microsoft account (email, password, birthdate, names)

- Thanks to all [contributors](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/graphs/contributors)2. Enrolls in Microsoft Rewards (if referral URL provided)

3. **[Optional]** Adds recovery email with verification

---4. **[Optional]** Sets up 2FA with TOTP (Google Authenticator compatible)

5. Extracts and saves TOTP secret key and recovery code

<div align="center">6. Saves complete account info to `accounts-created/` directory



**Made with ❤️ by the community****🔐 Saved Information:**

- Email and password

[Documentation](docs/index.md) • [Discord](https://discord.gg/k5uHkx9mne) • [Issues](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/issues)- Full name and birthdate

- Referral URL (if used)

</div>- Recovery email (if added)

- TOTP secret key (for authenticator apps)
- 5-part recovery code (emergency access)

**[📖 Full Account Creator Guide](src/account-creation/README.md)**

---

## ⏰ Automatic Scheduling

Configure automatic task scheduling directly from `config.jsonc` - **perfect for Raspberry Pi!**

```jsonc
{
  "scheduling": {
    "enabled": true,    // Just set this to true
    "type": "auto",     // Automatically detects Windows/Linux/Raspberry Pi
    "cron": {
      "schedule": "0 9 * * *"  // Raspberry Pi/Linux: Daily at 9 AM
    },
    "taskScheduler": {
      "schedule": "09:00"      // Windows: Daily at 9:00
    }
  }
}
```

**Then simply run:**
```bash
npm run start
```

The bot will automatically configure cron (Linux/Raspberry Pi) or Task Scheduler (Windows) for you!

**[📖 Full Scheduling Documentation](docs/schedule.md)**

---

## 🐳 Docker Quick Start

For containerized deployment with built-in scheduling:

```bash
# Ensure accounts.jsonc and config.jsonc exist in src/
docker compose up -d

# View logs
docker logs -f microsoft-rewards-script

# Check status
docker compose ps
```

Container includes:
- ✅ Built-in cron scheduling
- ✅ Automatic timezone handling
- ✅ Random execution delays (anti-detection)
- ✅ Health checks

**📖 [Full Docker Guide](docs/docker.md)**

---

## ⚙️ Configuration Highlights

The script works great with default settings, but you can customize everything in `src/config.jsonc`:

```jsonc
{
  "search": {
    "useLocalQueries": false,     // Prioritize Google Trends API (recommended)
    "settings": {
      "useGeoLocaleQueries": true // Use account country for searches (FR, DE, JP, etc.)
    }
  },
  "queryDiversity": {
    "enabled": true,              // Mix multiple search sources
    "sources": ["google-trends", "reddit", "local-fallback"]
  },
  "humanization": {
    "enabled": true,              // Enable natural behavior patterns
    "stopOnBan": true             // Stop on ban detection
  },
  "workers": {
    "doDesktopSearch": true,      // Desktop Bing searches
    "doMobileSearch": true,       // Mobile Bing searches
    "doDailySet": true,           // Daily tasks and quizzes
    "doMorePromotions": true,     // Promotional offers
    "doPunchCards": true          // Multi-day challenges
  },
  "execution": {
    "clusters": 1,                // Parallel account processing
    "runOnZeroPoints": false      // Skip when no points available
  }
}
```

**📖 [Complete Configuration Guide](docs/config.md)**

---

## 🎯 What Gets Automated

The script automatically completes:

- ✅ **Desktop Searches** — 30+ searches on Bing (desktop user-agent)
- ✅ **Mobile Searches** — 20+ searches on Bing (mobile user-agent)
- ✅ **Daily Set** — Quizzes, polls, and daily activities
- ✅ **More Activities** — Promotional tasks and special offers
- ✅ **Punch Cards** — Multi-day challenges and bonus tasks
- ✅ **Daily Check-in** — Simple check-in for bonus points
- ✅ **Read to Earn** — Article reading tasks

All while maintaining **natural behavior patterns** to minimize detection risk.

---

## 💡 Usage Tips

- **Run regularly:** Use cron, systemd timers, or Windows Task Scheduler (see docs)
- **Use humanization:** Always keep `humanization.enabled: true` for safety
- **Monitor logs:** Check for ban warnings and adjust settings if needed
- **Multiple accounts:** Use the `clusters` setting to run accounts in parallel
- **Start small:** Test with one account before scaling up
- **Capture logs:** Pipe output to a file or webhook for later review

---

## ✅ Tests

- `npm run test`: runs the node:test suite with ts-node to validate critical utilities.

---

## 🆘 Getting Help

- 💬 **[Join our Discord](https://discord.gg/k5uHkx9mne)** — Community support and updates
- 📖 **[Documentation Hub](docs/index.md)** — Complete guides and references
- 🐛 **[Report Issues](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/issues)** — Bug reports and feature requests
- 📧 **[Troubleshooting Guide](docs/diagnostics.md)** — Debug common issues

---

## ⚠️ Disclaimer

**Use at your own risk.** This script automates interactions with Microsoft Rewards, which may violate [Microsoft's Terms of Service](https://www.microsoft.com/en-us/servicesagreement/). Using automation tools can result in:

- ⚠️ Account suspension or permanent ban
- 🚫 Loss of accumulated points and rewards
- 🔒 Restriction from future participation

**This project is provided for educational and research purposes only.** The developers and contributors:
- Are **not responsible** for any actions taken by Microsoft against your account
- Do **not encourage** violating terms of service
- Provide **no guarantees** regarding account safety

**Use responsibly and at your own discretion.**

---

## 📄 License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License**.

**You may:**
- ✅ Use for personal, non-commercial purposes
- ✅ Modify the code for your own use
- ✅ Share with others (with same restrictions)
- ✅ Submit improvements via pull requests

**You may NOT:**
- ❌ Use for commercial purposes
- ❌ Sell or monetize this software
- ❌ Remove license/copyright notices

See [LICENSE](LICENSE) for complete terms.

---

## 🙏 Acknowledgments

- Built with [Playwright](https://playwright.dev/) and [ReBrowser](https://github.com/rebrowser/rebrowser-playwright)
- Thanks to all [contributors](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/graphs/contributors)
- Community support via [Discord](https://discord.gg/k5uHkx9mne)

---

## 🌟 Support the Project

If you find this project helpful:

- ⭐ **Star the repository** on GitHub
- 💬 **Join our Discord** community
- 🐛 **Report bugs** and suggest features
- 📖 **Contribute** to documentation

---

<div align="center">

**Made with ❤️ by the community**

[Documentation](docs/index.md) • [Discord](https://discord.gg/k5uHkx9mne) • [Issues](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/issues)

</div>
