// Global state
let ws = null
let logs = []
let accounts = []
let status = { running: false }

// Theme
function toggleTheme() {
  document.body.classList.toggle('light-theme')
  const icon = document.querySelector('.theme-toggle i')
  if (document.body.classList.contains('light-theme')) {
    icon.className = 'fas fa-sun'
    localStorage.setItem('theme', 'light')
  } else {
    icon.className = 'fas fa-moon'
    localStorage.setItem('theme', 'dark')
  }
}

// Load theme
const savedTheme = localStorage.getItem('theme')
if (savedTheme === 'light') {
  document.body.classList.add('light-theme')
  document.querySelector('.theme-toggle i').className = 'fas fa-sun'
}

// HTML escaping utility to prevent XSS attacks
function escapeHtml(text) {
  if (text === null || text === undefined) return ''
  const div = document.createElement('div')
  div.textContent = String(text)
  return div.innerHTML
}

// Toast notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer')
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`

  const iconMap = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  }

  toast.innerHTML = `
    <i class="fas ${iconMap[type]}"></i>
    <span>${escapeHtml(message)}</span>
  `

  container.appendChild(toast)

  setTimeout(() => {
    toast.remove()
  }, 5000)
}

// Update UI
function updateStatus(data) {
  status = data
  const badge = document.getElementById('statusBadge')
  const btnStart = document.getElementById('btnStart')
  const btnStop = document.getElementById('btnStop')

  if (data.running) {
    badge.className = 'status-badge status-running'
    badge.textContent = 'RUNNING'
    btnStart.disabled = true
    btnStop.disabled = false
  } else {
    badge.className = 'status-badge status-stopped'
    badge.textContent = 'STOPPED'
    btnStart.disabled = false
    btnStop.disabled = true
  }
}

function updateMetrics(data) {
  document.getElementById('totalAccounts').textContent = data.totalAccounts || 0
  document.getElementById('totalPoints').textContent = (data.totalPoints || 0).toLocaleString()
  document.getElementById('completed').textContent = data.accountsCompleted || 0
  document.getElementById('errors').textContent = data.accountsWithErrors || 0
}

function updateAccounts(data) {
  accounts = data
  const container = document.getElementById('accountsList')

  if (data.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No accounts configured</p></div>'
    return
  }

  // SECURITY FIX: Escape all user-provided data to prevent XSS
  container.innerHTML = data.map(acc => `
    <div class="account-item">
      <div class="account-info">
        <div class="account-avatar">${escapeHtml(acc.maskedEmail.charAt(0).toUpperCase())}</div>
        <div class="account-details">
          <div class="account-email">${escapeHtml(acc.maskedEmail)}</div>
          <div class="account-status-text">
            ${acc.lastSync ? `Last sync: ${escapeHtml(new Date(acc.lastSync).toLocaleString())}` : 'Never synced'}
          </div>
        </div>
      </div>
      <div class="account-stats">
        <div class="account-points">
          <div class="account-points-value">${acc.points !== undefined ? escapeHtml(acc.points.toLocaleString()) : 'N/A'}</div>
          <div class="account-points-label">Points</div>
        </div>
        <span class="account-badge badge-${escapeHtml(acc.status)}">${escapeHtml(acc.status.toUpperCase())}</span>
      </div>
    </div>
  `).join('')
}

function addLog(log) {
  logs.push(log)
  if (logs.length > 200) {
    logs.shift()
  }
  renderLogs()
}

function renderLogs() {
  const container = document.getElementById('logsContainer')

  if (logs.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-stream"></i><p>No logs yet...</p></div>'
    return
  }

  // SECURITY FIX: Escape all log data to prevent XSS
  container.innerHTML = logs.map(log => `
    <div class="log-entry log-level-${escapeHtml(log.level)}">
      <span class="log-timestamp">[${escapeHtml(new Date(log.timestamp).toLocaleTimeString())}]</span>
      <span class="log-platform platform-${escapeHtml(log.platform)}">${escapeHtml(log.platform)}</span>
      <span class="log-title">[${escapeHtml(log.title)}]</span>
      <span>${escapeHtml(log.message)}</span>
    </div>
  `).join('')

  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight
}

// API calls
async function fetchData() {
  try {
    const [statusRes, accountsRes, metricsRes, logsRes] = await Promise.all([
      fetch('/api/status'),
      fetch('/api/accounts'),
      fetch('/api/metrics'),
      fetch('/api/logs?limit=100')
    ])

    updateStatus(await statusRes.json())
    updateAccounts(await accountsRes.json())
    updateMetrics(await metricsRes.json())
    logs = await logsRes.json()
    renderLogs()
  } catch (error) {
    showToast('Failed to fetch data: ' + error.message, 'error')
  }
}

async function startBot() {
  try {
    showToast('Starting bot...', 'info')
    const res = await fetch('/api/start', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      showToast(`Bot started! (PID: ${data.pid})`)
      setTimeout(fetchData, 1000)
    } else {
      showToast(data.error || 'Failed to start bot', 'error')
    }
  } catch (error) {
    showToast('Failed to start bot: ' + error.message, 'error')
  }
}

async function stopBot() {
  try {
    showToast('Stopping bot...', 'info')
    const res = await fetch('/api/stop', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      showToast('Bot stopped')
      setTimeout(fetchData, 1000)
    } else {
      showToast(data.error || 'Failed to stop bot', 'error')
    }
  } catch (error) {
    showToast('Failed to stop bot: ' + error.message, 'error')
  }
}

async function restartBot() {
  try {
    showToast('Restarting bot...', 'info')
    const res = await fetch('/api/restart', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      showToast(`Bot restarted! (PID: ${data.pid})`)
      setTimeout(fetchData, 1000)
    } else {
      showToast(data.error || 'Failed to restart bot', 'error')
    }
  } catch (error) {
    showToast('Failed to restart bot: ' + error.message, 'error')
  }
}

async function clearLogs() {
  try {
    await fetch('/api/logs', { method: 'DELETE' })
    logs = []
    renderLogs()
    showToast('Logs cleared')
  } catch (error) {
    showToast('Failed to clear logs', 'error')
  }
}

function refreshData() {
  fetchData()
  showToast('Data refreshed')
}

// WebSocket
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${window.location.host}`)

  ws.onopen = () => {
    console.log('WebSocket connected')
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)

      if (data.type === 'init') {
        logs = data.data.logs || []
        renderLogs()
        if (data.data.status) updateStatus(data.data.status)
        if (data.data.accounts) updateAccounts(data.data.accounts)
      } else if (data.type === 'log') {
        if (data.log) addLog(data.log)
      } else if (data.type === 'status') {
        updateStatus(data.data)
      } else if (data.type === 'accounts') {
        updateAccounts(data.data)
      } else if (data.type === 'account_update') {
        const index = accounts.findIndex(acc => acc.email === data.data.email)
        if (index >= 0) {
          accounts[index] = data.data
        } else {
          accounts.push(data.data)
        }
        updateAccounts(accounts)
      }
    } catch (error) {
      console.error('WebSocket message error:', error)
    }
  }

  ws.onclose = () => {
    console.log('WebSocket disconnected, reconnecting...')
    setTimeout(connectWebSocket, 3000)
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
  }
}

// Initialize
fetchData()
connectWebSocket()
setInterval(fetchData, 10000)
