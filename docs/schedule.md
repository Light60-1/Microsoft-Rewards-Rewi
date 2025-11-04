# Automatic Task Scheduling

The bot can **automatically configure** your system's task scheduler when you run it for the first time. This works on:
- ✅ **Windows** → Windows Task Scheduler
- ✅ **Linux/Raspberry Pi** → cron
- ✅ **macOS** → cron

---

## Quick Setup (Recommended)

### 1. Edit your configuration

Open `src/config.jsonc` and find the `scheduling` section:

```jsonc
{
  "scheduling": {
    "enabled": true,  // ← Change this to true
    "type": "auto",   // ← Leave as "auto" for automatic detection
    
    // For Linux/Raspberry Pi/macOS:
    "cron": {
      "schedule": "0 9 * * *"  // ← Daily at 9 AM (customize if needed)
    },
    
    // For Windows:
    "taskScheduler": {
      "schedule": "09:00",     // ← Daily at 9:00 AM (customize if needed)
      "frequency": "daily"
    }
  }
}
```

### 2. Run the bot once

```bash
npm run start
```

**That's it!** The bot will automatically:
- Detect your operating system
- Configure the appropriate scheduler (cron or Task Scheduler)
- Set it up to run at your specified time
- Show you a confirmation message

### 3. Verify it worked

**Linux/Raspberry Pi/macOS:**
```bash
crontab -l
```
You should see a line with `# Microsoft-Rewards-Bot`

**Windows:**
- Open Task Scheduler
- Look for "Microsoft-Rewards-Bot" in the task list

---

## Configuration Examples

### Example 1: Raspberry Pi - Run daily at 9 AM

```jsonc
{
  "scheduling": {
    "enabled": true,
    "type": "auto",
    "cron": {
      "schedule": "0 9 * * *",
      "logFile": "/home/pi/rewards.log"  // Optional: save logs here
    }
  }
}
```

### Example 2: Windows - Run twice daily

```jsonc
{
  "scheduling": {
    "enabled": true,
    "type": "auto",
    "taskScheduler": {
      "schedule": "09:00",    // First run at 9 AM
      "frequency": "daily"
    }
  }
}
```

For multiple times per day on Windows, you'll need to manually create additional tasks.

### Example 3: Linux - Run on weekdays only at 2:30 PM

```jsonc
{
  "scheduling": {
    "enabled": true,
    "type": "cron",
    "cron": {
      "schedule": "30 14 * * 1-5"  // 2:30 PM, Monday-Friday
    }
  }
}
```

### Cron Schedule Examples

Use [crontab.guru](https://crontab.guru) to create custom schedules:

| Schedule | Description |
|----------|-------------|
| `0 9 * * *` | Every day at 9:00 AM |
| `30 14 * * *` | Every day at 2:30 PM |
| `0 9,21 * * *` | Every day at 9:00 AM and 9:00 PM |
| `0 9 * * 1-5` | Weekdays at 9:00 AM (Monday-Friday) |
| `0 */6 * * *` | Every 6 hours |
| `0 8 * * 0` | Every Sunday at 8:00 AM |

---

## Disabling Automatic Scheduling

To remove the scheduled task:

1. Set `"enabled": false` in your config
2. Run the bot once: `npm run start`
3. The scheduler will be automatically removed

Or manually remove it:

**Linux/Raspberry Pi/macOS:**
```bash
crontab -e
# Delete the line with "# Microsoft-Rewards-Bot"
```

**Windows:**
- Open Task Scheduler
- Find "Microsoft-Rewards-Bot"
- Right-click → Delete

---

## Manual Configuration (Advanced)

If you prefer manual setup or need more control, follow these platform-specific guides:

### Windows Task Scheduler (Manual)

1. Open Task Scheduler, choose **Create Basic Task...**, and name it `Microsoft Rewards Bot`.
2. Pick a trigger (daily, weekly, at startup, etc.).
3. Choose **Start a Program** and configure:
   - Program/script: `powershell.exe`
   - Arguments: `-NoProfile -ExecutionPolicy Bypass -Command "cd 'C:\Users\YourUser\Microsoft-Rewards-Script'; npm run start"`
   - Start in (optional): `C:\Users\YourUser\Microsoft-Rewards-Script`
4. Finish the wizard, edit the task on the **General** tab, and enable **Run whether user is logged on or not**. Grant highest privileges if required.
5. Test with **Run**. Append `| Tee-Object -FilePath C:\Logs\rewards.log` to capture output in a file.

> Tip: prefer a batch file? Create `run-rewards.bat` with `cd /d C:\Users\YourUser\Microsoft-Rewards-Script` and `npm run start`, then point Task Scheduler to that file.

---

## Linux / macOS (cron - Manual)

1. Run `npm run start` once to confirm the project completes successfully.
2. Edit the crontab: `crontab -e`.
3. Add an entry (example: 09:15 daily):
   ```cron
   15 9 * * * cd /home/you/Microsoft-Rewards-Script && /usr/bin/env npm run start >> /home/you/rewards.log 2>&1
   ```
4. Save the file and verify the log after the next trigger.

Need multiple runs? Add more cron lines with different times (for example `0 9 * * *` and `30 18 * * *`).

---

## Systemd Timer (Linux alternative - Manual)

1. Create `/etc/systemd/system/rewards-bot.service`:
   ```ini
   [Unit]
   Description=Microsoft Rewards Bot
   WorkingDirectory=/home/you/Microsoft-Rewards-Script

   [Service]
   Type=oneshot
   Environment=NODE_ENV=production
   ExecStart=/usr/bin/env npm run start
   ```
2. Create `/etc/systemd/system/rewards-bot.timer`:
   ```ini
   [Unit]
   Description=Run Microsoft Rewards Bot daily

   [Timer]
   OnCalendar=*-*-* 09:00:00
   Persistent=true

   [Install]
   WantedBy=timers.target
   ```
3. Reload and enable:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now rewards-bot.timer
   ```
4. Inspect status via `systemctl status rewards-bot.timer` and recent runs with `journalctl -u rewards-bot.service`.

---

## Docker & Containers

- The container now runs a single pass. Restart it on your schedule (cron, Kubernetes CronJob, Task Scheduler, etc.).
- To schedule inside the container, set:
  ```yaml
  USE_CRON: "true"
  CRON_SCHEDULE: "0 9 * * *"
  RUN_ON_START: "true"
  ```
  The entrypoint installs cron, runs according to `CRON_SCHEDULE`, and tails `/var/log/cron.log`.
- Mount `accounts.jsonc`, `config.jsonc`, and `sessions/` so each run shares state.

---

## Troubleshooting

**"cron is not installed"** (Linux/Raspberry Pi)
```bash
sudo apt-get update
sudo apt-get install cron
```

**"Permission denied"** (Linux/Raspberry Pi)
- The bot needs write access to crontab
- Make sure you're running as the correct user

**"Access denied"** (Windows)
- Right-click PowerShell or Command Prompt
- Choose "Run as Administrator"
- Run `npm run start` again

**Task not running at scheduled time:**
1. Check your system's time and timezone
2. Verify the schedule format is correct
3. For cron: use [crontab.guru](https://crontab.guru) to validate
4. Check logs to see if there are any errors

**Manually check if scheduler is active:**

**Linux/Raspberry Pi:**
```bash
crontab -l | grep "Microsoft-Rewards"
```

**Windows:**
```powershell
schtasks /Query /TN "Microsoft-Rewards-Bot" /FO LIST
```

---

**Next steps:** [Configuration](./config.md) · [Docker](./docker.md) · [Humanization](./humanization.md)
