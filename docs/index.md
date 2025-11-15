<div align="center"><div align="center">



<img src="../assets/logo.png" alt="Microsoft Rewards Bot Logo" width="150"/># 📚 Documentation



# 📚 Documentation Hub**Complete guide for Microsoft Rewards Bot**



**Complete guides for Microsoft Rewards Bot**[← Back to Main](../README.md)



[← Back to Main](../README.md)</div>



</div>---



---## 🚀 Quick Start (3 Steps)



## 🚀 Getting Started1. **[Setup Accounts](accounts.md)** — Add credentials + 2FA

2. **[Configure Bot](config.md)** — Essential settings

**New to the bot?** Start with these guides in order:3. **[Schedule Runs](schedule.md)** — Use OS-level automation



| Step | Guide | What You'll Learn |**Done!** The bot will run automatically.

|------|-------|-------------------|

| **1** | **[📘 Getting Started](getting-started.md)** | Installation, account setup, first run |---

| **2** | **[👤 Accounts & 2FA](accounts.md)** | Add accounts, enable TOTP authentication |

| **3** | **[⚙️ Configuration](config.md)** | Customize bot behavior and features |## ✨ Feature Guides

| **4** | **[⏰ Scheduling](schedule.md)** | Automate daily runs with cron/Task Scheduler |

| Feature | Description |

**That's all you need to get started!** The guides above cover everything for basic usage.|---------|-------------|

| **[Configuration](config.md)** | All settings explained |

---| **[External Scheduling](schedule.md)** | Automate with cron or Task Scheduler |

| **[Humanization](humanization.md)** | Anti-detection system |

## 📖 Feature Guides| **[Webhooks](conclusionwebhook.md)** | Discord notifications |

| **[Error Reporting](ERROR_REPORTING.md)** | 🆕 Automatic error reporting |

Explore advanced features and customization options:| **[NTFY Alerts](ntfy.md)** | Mobile push notifications |

| **[Proxy Setup](proxy.md)** | IP rotation (optional) |

### Core Features

| Guide | Description |
|-------|-------------|
| **[🔔 Notifications](notifications.md)** | Discord webhooks and mobile push alerts |
| **[📊 Dashboard](../src/dashboard/README.md)** | Web interface for monitoring and control |
| **[🌐 Proxy Setup](proxy.md)** | Configure proxies for privacy |
| **[🤖 Humanization](humanization.md)** | Anti-detection and natural behavior patterns |

### Deployment

| Guide | Description |
|-------|-------------|
| **[🐳 Docker](docker-deployment.md)** | Containerized deployment with Docker Compose |

| **[☁️ Cloud Deployment](cloud-deployment.md)** | Deploy to VPS, Raspberry Pi, or cloud services |**Need help?** → [Discord Community](https://discord.gg/k5uHkx9mne)



### Advanced---



| Guide | Description |[← Back to Main](../README.md)

|-------|-------------|
| **[🔧 Advanced Configuration](advanced-config.md)** | Power user settings and optimization |
| **[🛡️ Security Best Practices](security.md)** | Account protection and risk management |

---

## 🆕 Account Creator

**Create new Microsoft accounts with the built-in account creator:**

| Guide | Description |
|-------|-------------|
| **[🎯 Account Creator Guide](../src/account-creation/README.md)** | Create accounts with 2FA and referral links |
| **[💰 Referral System](referrals.md)** | Earn 7,500 points/month per referral |

**Quick command:**
```bash
npm run creator -- -y backup@gmail.com https://rewards.bing.com/welcome?rh=YOUR_CODE
```

---

## 🆘 Help & Troubleshooting

Having issues? Check these resources:

### Common Issues

| Problem | Solution |
|---------|----------|
| **Bot not starting** | [Troubleshooting Guide](troubleshooting.md) |
| **Login failures** | [Accounts & 2FA Setup](accounts.md#troubleshooting) |
| **Account banned** | [Security Guide](security.md) |
| **Configuration errors** | [Config Reference](config.md) |

### Support Resources

- 💬 **[Discord Community](https://discord.gg/k5uHkx9mne)** — Get help from the community
- 🐛 **[GitHub Issues](https://github.com/LightZirconite/Microsoft-Rewards-Bot/issues)** — Report bugs
- 📖 **[FAQ](FAQ.md)** — Frequently asked questions
- 🔍 **[Diagnostics Guide](diagnostics.md)** — Debug and capture logs

---

## 📚 Reference Documentation

Technical references and detailed information:

### Configuration

| Document | Description |
|----------|-------------|
| **[Config Reference](config.md)** | Complete `config.jsonc` options |
| **[Accounts Reference](accounts.md)** | Complete `accounts.jsonc` schema |
| **[Environment Variables](environment-variables.md)** | Available env vars for CI/Docker |

### Technical

| Document | Description |
|----------|-------------|
| **[API Documentation](../src/dashboard/README.md)** | Dashboard REST API endpoints |
| **[Error Reporting](ERROR_REPORTING.md)** | Automatic error reporting system |
| **[Changelog](../CHANGELOG.md)** | Version history and changes |

---

## 🎓 Guides by Topic

### For Beginners

1. [Getting Started](getting-started.md) — Start here!
2. [Accounts & 2FA](accounts.md) — Setup your accounts
3. [First Run](getting-started.md#-first-run) — Test the bot
4. [Scheduling](schedule.md) — Automate daily runs

### For Raspberry Pi Users

1. [Getting Started](getting-started.md) — Installation steps
2. [Scheduling](schedule.md) — Setup cron for daily runs
3. [Notifications](notifications.md) — Get mobile alerts
4. [Cloud Deployment](cloud-deployment.md) — Run 24/7

### For Docker Users

1. [Docker Guide](docker-deployment.md) — Setup Docker Compose
2. [Environment Variables](environment-variables.md) — Configure via env vars
3. [Notifications](notifications.md) — Monitor container runs

### For Multiple Accounts

1. [Accounts & 2FA](accounts.md) — Manage multiple accounts
2. [Proxy Setup](proxy.md) — Use different IPs per account
3. [Advanced Config](advanced-config.md) — Parallel execution
4. [Referrals](referrals.md) — Earn bonus points

---

## 🔗 External Resources

- **[Microsoft Rewards](https://rewards.bing.com/)** — Official Microsoft Rewards site
- **[Playwright Docs](https://playwright.dev/)** — Browser automation framework
- **[Node.js](https://nodejs.org/)** — JavaScript runtime
- **[TypeScript](https://www.typescriptlang.org/)** — Programming language

---

## 🤝 Contributing

Want to help improve the bot?

- 📖 **[Contributing Guide](../CONTRIBUTING.md)** — How to contribute
- 🐛 **[Report Bugs](https://github.com/LightZirconite/Microsoft-Rewards-Bot/issues)** — Found an issue?
- 💡 **[Feature Requests](https://github.com/LightZirconite/Microsoft-Rewards-Bot/issues)** — Suggest new features
- 📝 **[Improve Docs](https://github.com/LightZirconite/Microsoft-Rewards-Bot/tree/main/docs)** — Help with documentation

---

<div align="center">

**Need help?** [Join our Discord](https://discord.gg/k5uHkx9mne)

[← Back to Main](../README.md)

</div>
