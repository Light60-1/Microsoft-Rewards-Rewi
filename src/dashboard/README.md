# Dashboard API Reference

## Endpoints

### Status & Control

#### `GET /api/status`
Get current bot status.

**Response:**
```json
{
  "running": false,
  "lastRun": "2025-11-03T10:30:00.000Z",
  "currentAccount": "user@example.com",
  "totalAccounts": 5
}
```

#### `POST /api/start`
Start bot execution in background.

**Response:**
```json
{
  "success": true,
  "pid": 12345
}
```

#### `POST /api/stop`
Stop bot execution.

**Response:**
```json
{
  "success": true
}
```

---

### Accounts

#### `GET /api/accounts`
List all accounts with masked emails and status.

**Response:**
```json
[
  {
    "email": "user@example.com",
    "maskedEmail": "u***@e***.com",
    "points": 5420,
    "lastSync": "2025-11-03T10:30:00.000Z",
    "status": "completed",
    "errors": []
  }
]
```

#### `POST /api/sync/:email`
Force synchronization for a single account.

**Parameters:**
- `email` (path): Account email

**Response:**
```json
{
  "success": true,
  "pid": 12346
}
```

---

### Logs & History

#### `GET /api/logs?limit=100`
Get recent logs.

**Query Parameters:**
- `limit` (optional): Max number of logs (default: 100, max: 500)

**Response:**
```json
[
  {
    "timestamp": "2025-11-03T10:30:00.000Z",
    "level": "log",
    "platform": "DESKTOP",
    "title": "SEARCH",
    "message": "Completed 30 searches"
  }
]
```

#### `DELETE /api/logs`
Clear all logs from memory.

**Response:**
```json
{
  "success": true
}
```

#### `GET /api/history`
Get recent run summaries (last 7 days).

**Response:**
```json
[
  {
    "runId": "abc123",
    "timestamp": "2025-11-03T10:00:00.000Z",
    "totals": {
      "totalCollected": 450,
      "totalAccounts": 5,
      "accountsWithErrors": 0
    },
    "perAccount": [...]
  }
]
```

---

### Configuration

#### `GET /api/config`
Get current configuration (sensitive data masked).

**Response:**
```json
{
  "baseURL": "https://rewards.bing.com",
  "headless": true,
  "clusters": 2,
  "webhook": {
    "enabled": true,
    "url": "htt***://dis***"
  }
}
```

#### `POST /api/config`
Update configuration (creates automatic backup).

**Request Body:** Full config object

**Response:**
```json
{
  "success": true,
  "backup": "/path/to/config.jsonc.backup.1730634000000"
}
```

---

### Metrics

#### `GET /api/metrics`
Get aggregated metrics.

**Response:**
```json
{
  "totalAccounts": 5,
  "totalPoints": 27100,
  "accountsWithErrors": 0,
  "accountsRunning": 0,
  "accountsCompleted": 5
}
```

---

## WebSocket

Connect to `ws://localhost:3000/ws` for real-time log streaming.

**Message Format:**
```json
{
  "type": "log",
  "log": {
    "timestamp": "2025-11-03T10:30:00.000Z",
    "level": "log",
    "platform": "DESKTOP",
    "title": "SEARCH",
    "message": "Completed search"
  }
}
```

**On Connect:**
Receives history of last 50 logs:
```json
{
  "type": "history",
  "logs": [...]
}
```

---

## Usage

### Start Dashboard
```bash
npm run dashboard
# or in dev mode
npm run dashboard-dev
```

Default: `http://127.0.0.1:3000`

### Environment Variables
- `DASHBOARD_PORT`: Port number (default: 3000)
- `DASHBOARD_HOST`: Bind address (default: 127.0.0.1)

### Security
- **Localhost only**: Dashboard binds to `127.0.0.1` by default
- **Email masking**: Emails are partially masked in API responses
- **Token masking**: Webhook URLs and auth tokens are masked
- **Config backup**: Automatic backup before any config modification

---

## Example Usage

### Check Status
```bash
curl http://localhost:3000/api/status
```

### Start Bot
```bash
curl -X POST http://localhost:3000/api/start
```

### Get Logs
```bash
curl http://localhost:3000/api/logs?limit=50
```

### Sync Single Account
```bash
curl -X POST http://localhost:3000/api/sync/user@example.com
```
