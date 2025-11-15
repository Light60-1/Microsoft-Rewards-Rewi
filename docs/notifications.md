# 🔔 Notifications

**Get alerts when the bot completes its run**

[← Back to Documentation](index.md)

---

## 📋 Table of Contents

- [Discord Webhooks](#-discord-webhooks)
- [NTFY Mobile Alerts](#-ntfy-mobile-alerts)
- [Comparison](#-comparison)
- [Examples](#-examples)

---

## 💬 Discord Webhooks

Get detailed run summaries sent to your Discord server.

### Setup

#### 1. Create Webhook in Discord

1. Open your Discord server
2. Go to **Server Settings** → **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Name it (e.g., "Microsoft Rewards Bot")
5. Choose a channel
6. Click **Copy Webhook URL**

#### 2. Add to Configuration

Edit `src/config.jsonc`:

```jsonc
{
  "conclusionWebhook": {
    "enabled": true,
    "webhookUrl": "https://discord.com/api/webhooks/123456789/AbCdEfGhIjKlMnOpQrStUvWxYz"
  }
}
```

### What You'll Receive

**Rich embeds with**:
- ✅ Total points earned
- 📊 Per-account breakdown
- ⏱️ Run duration
- 🎯 Completion status
- ⚠️ Errors and warnings

**Example message**:
```
🎉 Microsoft Rewards Summary

Total Points: 450
Duration: 12 minutes
Accounts Processed: 3/3

✅ account1@outlook.com: 150 points (45s)
✅ account2@outlook.com: 150 points (48s)
✅ account3@outlook.com: 150 points (42s)
```

### Advanced Options

```jsonc
{
  "conclusionWebhook": {
    "enabled": true,
    "webhookUrl": "YOUR_WEBHOOK_URL",
    "username": "Rewards Bot",           // Custom bot name
    "avatar": "https://example.com/avatar.png", // Custom avatar
    "color": 3447003,                    // Embed color (decimal)
    "onlyOnError": false,                // Send only when errors occur
    "pingOnError": true                  // @mention on errors
  }
}
```

### Multiple Webhooks

Send to different channels:

```jsonc
{
  "conclusionWebhook": {
    "enabled": true,
    "webhookUrl": "WEBHOOK_FOR_SUCCESS",
    "errorWebhookUrl": "WEBHOOK_FOR_ERRORS"  // Separate channel for errors
  }
}
```

---

## 📱 NTFY Mobile Alerts

Get **instant push notifications** on your phone with [ntfy.sh](https://ntfy.sh/).

### Setup

#### 1. Install NTFY App

- **Android**: [Google Play Store](https://play.google.com/store/apps/details?id=io.heckel.ntfy)
- **iOS**: [App Store](https://apps.apple.com/us/app/ntfy/id1625396347)
- **Web**: https://ntfy.sh/app

#### 2. Choose a Topic

Pick a **unique topic name** (acts as your channel):
- Examples: `rewards-bot-john`, `msrewards-12345`
- Keep it secret to avoid spam!

#### 3. Subscribe in App

1. Open NTFY app
2. Tap **+** or **Subscribe**
3. Enter your topic name
4. Save

#### 4. Add to Configuration

Edit `src/config.jsonc`:

```jsonc
{
  "ntfy": {
    "enabled": true,
    "topic": "your-unique-topic-name",  // From step 2
    "priority": 3,                      // 1-5 (3 = default, 5 = urgent)
    "tags": ["robot", "money"]          // Optional emojis
  }
}
```

### What You'll Receive

**Simple push notifications**:
- ✅ Bot completion status
- 📊 Total points earned
- ⚠️ Error alerts
- ⏱️ Run duration

**Example notification**:
```
🤖 Rewards Bot Complete

✅ 3 accounts processed
💰 450 points earned
⏱️ 12 minutes
```

### Priority Levels

| Priority | Behavior | When to Use |
|----------|----------|-------------|
| 1 | Min | Background only, no sound |
| 2 | Low | Vibrate only |
| 3 | **Default** | Normal notification |
| 4 | High | Makes sound |
| 5 | Max | Critical alert, repeats |

**Recommended**: Priority 3 or 4 for most use cases.

### Custom NTFY Server

Using your own NTFY server:

```jsonc
{
  "ntfy": {
    "enabled": true,
    "server": "https://ntfy.yourdomain.com",  // Your server
    "topic": "your-topic",
    "priority": 3
  }
}
```

### Advanced Options

```jsonc
{
  "ntfy": {
    "enabled": true,
    "topic": "your-topic",
    "priority": 4,
    "tags": ["robot", "chart_increasing"],  // Emojis in notification
    "title": "Rewards Bot",                  // Custom title
    "clickUrl": "https://rewards.bing.com",  // URL to open on click
    "attachUrl": "https://example.com/image.png",  // Attach image
    "onlyOnError": false,                    // Send only on errors
    "email": "you@example.com"               // Also send email
  }
}
```

### Available Tags (Emojis)

Common ones:
- `robot`, `money`, `chart`, `check`, `warning`, `fire`
- Full list: https://ntfy.sh/docs/emojis/

---

## ⚖️ Comparison

| Feature | Discord Webhooks | NTFY |
|---------|------------------|------|
| **Setup** | Medium (need server) | Easy (just install app) |
| **Detail** | Rich embeds with full stats | Simple text notifications |
| **Speed** | Fast | Instant |
| **Mobile** | Requires Discord app | Dedicated notifications app |
| **Free** | ✅ Yes | ✅ Yes |
| **Privacy** | Data goes to Discord | Self-hostable |
| **Best For** | Detailed reports | Quick alerts |

**Recommendation**: Use **both**!
- Discord for detailed daily reports
- NTFY for instant mobile alerts

---

## 📝 Examples

### Both Enabled (Recommended)

```jsonc
{
  "conclusionWebhook": {
    "enabled": true,
    "webhookUrl": "YOUR_DISCORD_WEBHOOK"
  },
  "ntfy": {
    "enabled": true,
    "topic": "your-unique-topic",
    "priority": 3,
    "tags": ["robot", "money"]
  }
}
```

### Errors Only

```jsonc
{
  "conclusionWebhook": {
    "enabled": true,
    "webhookUrl": "YOUR_DISCORD_WEBHOOK",
    "onlyOnError": true  // Only send when something goes wrong
  },
  "ntfy": {
    "enabled": true,
    "topic": "your-topic",
    "priority": 5,  // Max priority for errors
    "onlyOnError": true
  }
}
```

### Different Priorities for Success/Error

```jsonc
{
  "ntfy": {
    "enabled": true,
    "topic": "your-topic",
    "priority": 3,  // Normal for success
    "priorityOnError": 5,  // Urgent for errors
    "tags": ["robot"],
    "tagsOnError": ["warning", "fire"]  // Different emoji on error
  }
}
```

### Custom Formatting

```jsonc
{
  "conclusionWebhook": {
    "enabled": true,
    "webhookUrl": "YOUR_WEBHOOK",
    "username": "🤖 Rewards Bot",
    "color": 3066993,  // Green color (decimal)
    "footer": "Powered by Microsoft Rewards Bot",
    "timestamp": true  // Show timestamp
  }
}
```

---

## 🔧 Troubleshooting

### Discord webhook not working

**Check**:
1. Webhook URL is correct (starts with `https://discord.com/api/webhooks/`)
2. Webhook still exists in Discord server settings
3. Bot has permissions to send webhooks
4. Check console for error messages

**Test manually**:
```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message"}'
```

### NTFY notifications not arriving

**Check**:
1. Topic name is correct (case-sensitive!)
2. Subscribed in app with same topic
3. App has notification permissions
4. Internet connection is stable
5. Not using a banned/common topic name

**Test manually**:
```bash
curl -d "Test notification" "https://ntfy.sh/your-topic"
```

Or visit in browser: https://ntfy.sh/your-topic

### Rate limiting

If sending too many notifications:

```jsonc
{
  "conclusionWebhook": {
    "enabled": true,
    "webhookUrl": "YOUR_WEBHOOK",
    "debounceMs": 5000  // Wait 5s between messages
  }
}
```

---

## 🆘 Need Help?

- 💬 **[Discord Community](https://discord.gg/k5uHkx9mne)** — Get support
- 📖 **[Configuration Guide](config.md)** — All config options
- 🐛 **[Report Issue](https://github.com/LightZirconite/Microsoft-Rewards-Bot/issues)** — Found a bug?

---

<div align="center">

[← Back to Documentation](index.md)

</div>
