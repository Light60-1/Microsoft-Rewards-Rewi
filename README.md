<div align="center">

<img src="assets/logo.png" alt="Microsoft Rewards Bot Logo" width="200"/>

# Microsoft Rewards Bot

**Automate your Microsoft Rewards points collection effortlessly**

[![Discord](https://img.shields.io/badge/💬_Join_Discord-7289DA?style=for-the-badge&logo=discord)](https://discord.gg/k5uHkx9mne) 
[![GitHub](https://img.shields.io/badge/⭐_Star_Project-yellow?style=for-the-badge&logo=github)](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot)
[![Version](https://img.shields.io/badge/version-2.55.0-blue?style=for-the-badge)](https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/releases)
[![License](https://img.shields.io/badge/license-CC_BY--NC--SA_4.0-green?style=for-the-badge)](LICENSE)

</div>

---

##  About

This TypeScript-based automation bot helps you maximize your **Microsoft Rewards** points by automatically completing daily tasks, searches, quizzes, and promotional offers. Designed with sophisticated anti-detection measures and human-like behavior patterns to ensure safe, reliable operation.

### ✨ Key Features

- 🔍 **Automated Searches** — Desktop and mobile Bing searches with natural patterns
- 📅 **Daily Activities** — Quizzes, polls, daily sets, and punch cards
- 🤖 **Human-like Behavior** — Advanced humanization system to avoid detection
- 🛡️ **Risk Management** — Built-in ban detection and prediction with ML algorithms
- ⏰ **Automatic Scheduling** — Easy configuration for cron (Linux/Raspberry Pi) and Windows Task Scheduler
- 🔔 **Notifications** — Discord webhooks and NTFY push alerts
- 🐳 **Docker Support** — Easy containerized deployment
- 🔐 **Multi-Account** — Manage multiple accounts with parallel execution
- 🌐 **Proxy Support** — Optional proxy configuration for enhanced privacy

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** (version 22 recommended) — [Download here](https://nodejs.org/)
- **Git** for cloning the repository
- **Microsoft account(s)** with email and password

### Installation

**The automated setup script handles everything for you:**

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot.git
   cd Microsoft-Rewards-Bot
   ```

2. **Run the setup script:**
   - **Windows:** Double-click `setup/setup.bat` or run in PowerShell:
     ```powershell
     .\setup\setup.bat
     ```
   - **Linux / macOS / WSL:**
     ```bash
     bash setup/setup.sh
     ```
   - **Or use npm:**
     ```bash
     npm run setup
     ```

3. **The setup wizard will:**
   - ✅ Create and configure `accounts.jsonc` with your credentials
   - ✅ Install all dependencies automatically
   - ✅ Build the TypeScript project
   - ✅ Optionally start the script immediately

**That's it! You're ready to start earning points.** 🎉

---

## 📚 Documentation

For detailed configuration, advanced features, and troubleshooting, visit our comprehensive documentation:

**👉 [Complete Documentation](docs/index.md)**

### Quick Links

| Topic | Description |
|-------|-------------|
| **[Getting Started](docs/getting-started.md)** | Detailed installation and first-run guide |
| **[Configuration](docs/config.md)** | Complete configuration options reference |
| **[Accounts & 2FA](docs/accounts.md)** | Setting up accounts with TOTP authentication |
| **[Dashboard](src/dashboard/README.md)** | 🆕 Local web dashboard for monitoring and control |
| **[External Scheduling](docs/schedule.md)** | Use OS schedulers for automation |
| **[Docker Deployment](docs/docker.md)** | Running in containers |
| **[Humanization](docs/humanization.md)** | Anti-detection and natural behavior |
| **[Notifications](docs/conclusionwebhook.md)** | Discord webhooks and NTFY setup |
| **[Proxy Setup](docs/proxy.md)** | Configuring proxies for privacy |
| **[Troubleshooting](docs/diagnostics.md)** | Debug common issues and capture logs |

---

## 📊 Dashboard (BETA)

Monitor and control your bot through a local web interface:

```bash
# Start dashboard separately
npm run dashboard

# Or enable auto-start in config.jsonc:
{
  "dashboard": {
    "enabled": true,
    "port": 3000
  }
}
```

Access at `http://localhost:3000` to:
- 📈 View real-time points and account status
- 📋 Monitor live logs with WebSocket streaming
- 🔄 Manually sync individual accounts
- ⚙️ Edit configuration with automatic backup
- 📊 View historical run summaries and metrics

**[📖 Full Dashboard API Documentation](src/dashboard/README.md)**

---

## 🆕 Account Creator (BETA)

Automatically create new Microsoft accounts with referral link support:

```bash
# Create account without referral
npm run creator

# Create account with your referral link
npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE&ref=rafsrchae
```

**Features:**
- 🎯 Language-independent (works in any language)
- 🔐 Generates strong passwords automatically
- 📧 Creates unique email addresses
- 🎂 Realistic birthdates (18-50 years old)
- 🤖 CAPTCHA support (manual solving required)
- 💾 Saves all account details to `accounts-created/` directory

**What happens:**
1. Opens browser to Microsoft signup page
2. Automatically fills email, password, birthdate, and name
3. Waits for you to solve CAPTCHA
4. Saves complete account info to file

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
