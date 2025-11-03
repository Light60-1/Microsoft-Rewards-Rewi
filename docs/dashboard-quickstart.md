# 🚀 Dashboard Quick Start Guide

## What's New?

The dashboard has been completely redesigned with:
- ✨ Modern, beautiful interface with gradients and animations
- 🔄 Real-time updates via WebSocket
- 📊 Enhanced statistics and metrics
- 🎮 Better control panel
- 📱 Fully responsive design
- 🎨 Professional UI/UX

## Getting Started

### Option 1: Standalone Dashboard (Recommended for Testing)

Start only the dashboard to see the interface:

```bash
npm run build
npm run dashboard
```

Then open: **http://localhost:3000**

### Option 2: Enable with Bot

1. Edit `src/config.jsonc`:

```jsonc
{
  "dashboard": {
    "enabled": true,
    "port": 3000,
    "host": "127.0.0.1"
  }
}
```

2. Start the bot:

```bash
npm start
```

Dashboard will be available at: **http://localhost:3000**

## What You'll See

### 📊 Header
- Bot logo and title
- Real-time status badge (RUNNING/STOPPED with animated indicator)
- Last run timestamp

### 📈 Statistics Cards
- **Total Accounts** - Number of configured accounts
- **Total Points** - Sum of all points across accounts
- **Completed** - Successfully processed accounts
- **Errors** - Accounts with issues

### 🎮 Control Panel
- **Start Bot** - Begin automation (shows when stopped)
- **Stop Bot** - Halt execution (shows when running)
- **Refresh** - Update all data manually
- **Clear Logs** - Remove log history

### 👥 Accounts Section
- List of all accounts with masked emails
- Current points for each account
- Status badge (idle, running, completed, error)
- Last sync timestamp

### 📋 Live Logs
- Real-time streaming logs
- Color-coded by level:
  - 🟢 Green = Info
  - 🟡 Yellow = Warning
  - 🔴 Red = Error
- Platform indicators (MAIN, DESKTOP, MOBILE)
- Timestamps for each entry
- Auto-scrolling to latest

## Features to Try

### 1. Real-Time Updates
- Open dashboard while bot is running
- Watch logs appear instantly
- See account status change in real-time
- Notice points increment live

### 2. Control Bot
- Click "Start Bot" to begin automation
- Watch status badge change to RUNNING
- See logs stream in
- Click "Stop Bot" to halt

### 3. View Account Details
- Each account shows current points
- Status badge shows current state
- Last sync shows when it was processed

### 4. Manage Logs
- Logs auto-update as they happen
- Scroll through history
- Click "Clear Logs" to start fresh
- Logs persist in memory (up to 500 entries)

## API Access

You can also use the API directly:

### Get Status
```bash
curl http://localhost:3000/api/status
```

### Get All Accounts
```bash
curl http://localhost:3000/api/accounts
```

### Get Logs
```bash
curl http://localhost:3000/api/logs?limit=50
```

### Get Metrics
```bash
curl http://localhost:3000/api/metrics
```

### Control Bot
```bash
# Start
curl -X POST http://localhost:3000/api/start

# Stop
curl -X POST http://localhost:3000/api/stop
```

## WebSocket Testing

Test real-time WebSocket connection:

```javascript
// Open browser console at http://localhost:3000
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => console.log('✓ Connected');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

## Troubleshooting

### "Cannot GET /"
- Run `npm run build` first
- Check `public/index.html` exists
- Try `npm run dashboard-dev` instead

### No Accounts Showing
- Ensure `src/accounts.jsonc` is configured
- Check file exists and has valid JSON
- Refresh the page

### WebSocket Not Connected
- Check dashboard server is running
- Look for "WebSocket connected" in browser console
- Try refreshing the page

### Port Already in Use
Change the port:
```bash
# In config.jsonc
"dashboard": {
  "port": 3001  // Use different port
}
```

Or use environment variable:
```bash
DASHBOARD_PORT=3001 npm run dashboard
```

## Next Steps

1. **Customize Theme** - Edit colors in `public/index.html`
2. **Add Features** - Extend API in `src/dashboard/routes.ts`
3. **Monitor Bot** - Leave dashboard open while bot runs
4. **Use API** - Build custom integrations
5. **Deploy** - Set up reverse proxy for remote access

## Tips

- 💡 Keep dashboard open in a browser tab while bot runs
- 💡 Use Refresh button if data seems stale
- 💡 Clear logs periodically for better performance
- 💡 Check browser console for WebSocket status
- 💡 Use API for automated monitoring scripts

## Need Help?

- 📖 Read full documentation in `src/dashboard/DASHBOARD.md`
- 🔍 Check API reference in `src/dashboard/README.md`
- 🐛 Report issues on GitHub
- 💬 Ask in community Discord

---

**Enjoy your new dashboard! 🎉**
