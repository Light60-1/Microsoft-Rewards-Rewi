import express from 'express'
import fs from 'fs'
import { createServer } from 'http'
import path from 'path'
import { WebSocket, WebSocketServer } from 'ws'
import { log as botLog } from '../util/Logger'
import { apiRouter } from './routes'
import { DashboardLog, dashboardState } from './state'

// Dashboard logging helper
const dashLog = (message: string, type: 'log' | 'warn' | 'error' = 'log'): void => {
  botLog('main', 'DASHBOARD', message, type)
}

const PORT = process.env.DASHBOARD_PORT ? parseInt(process.env.DASHBOARD_PORT) : 3000
const HOST = process.env.DASHBOARD_HOST || '127.0.0.1'

export class DashboardServer {
  private app: express.Application
  private server: ReturnType<typeof createServer>
  private wss: WebSocketServer
  private clients: Set<WebSocket> = new Set()

  constructor() {
    this.app = express()
    this.server = createServer(this.app)
    this.wss = new WebSocketServer({ server: this.server })
    this.setupMiddleware()
    this.setupRoutes()
    this.setupWebSocket()
    this.interceptBotLogs()
    this.setupStateListener()
  }

  private setupStateListener(): void {
    // Listen to dashboard state changes and broadcast to all clients
    dashboardState.addChangeListener((type, data) => {
      this.broadcastUpdate(type, data)
    })
  }

  private setupMiddleware(): void {
    this.app.use(express.json())
    this.app.use('/assets', express.static(path.join(__dirname, '../../assets')))
    this.app.use(express.static(path.join(__dirname, '../../public')))
  }

  private setupRoutes(): void {
    this.app.use('/api', apiRouter)
    
    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', uptime: process.uptime() })
    })

    // Serve dashboard UI (with fallback if file doesn't exist)
    this.app.get('/', (_req, res) => {
      const dashboardPath = path.join(__dirname, '../../public/dashboard.html')
      const indexPath = path.join(__dirname, '../../public/index.html')
      
      if (fs.existsSync(dashboardPath)) {
        res.sendFile(dashboardPath)
      } else if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath)
      } else {
        res.status(200).send(`
          <!DOCTYPE html>
          <html><head><title>Dashboard - API Only Mode</title></head>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>Dashboard API Active</h1>
            <p>Frontend UI not found. API endpoints are available:</p>
            <ul style="list-style: none; padding: 0;">
              <li><a href="/api/status">GET /api/status</a></li>
              <li><a href="/api/accounts">GET /api/accounts</a></li>
              <li><a href="/api/logs">GET /api/logs</a></li>
              <li><a href="/api/metrics">GET /api/metrics</a></li>
              <li><a href="/health">GET /health</a></li>
            </ul>
          </body></html>
        `)
      }
    })
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws)
      dashLog('WebSocket client connected')

      ws.on('close', () => {
        this.clients.delete(ws)
        dashLog('WebSocket client disconnected')
      })

      ws.on('error', (error) => {
        dashLog(`WebSocket error: ${error instanceof Error ? error.message : String(error)}`, 'error')
      })

      // Send initial data on connect
      const recentLogs = dashboardState.getLogs(100)
      const status = dashboardState.getStatus()
      const accounts = dashboardState.getAccounts()
      
      ws.send(JSON.stringify({ 
        type: 'init', 
        data: {
          logs: recentLogs,
          status,
          accounts
        }
      }))
    })
  }

  private interceptBotLogs(): void {
    const originalLog = botLog
    
    ;(global as Record<string, unknown>).botLog = (
      isMobile: boolean | 'main',
      title: string,
      message: string,
      type: 'log' | 'warn' | 'error' = 'log'
    ) => {
      const result = originalLog(isMobile, title, message, type)
      
      const logEntry: DashboardLog = {
        timestamp: new Date().toISOString(),
        level: type,
        platform: isMobile === 'main' ? 'MAIN' : isMobile ? 'MOBILE' : 'DESKTOP',
        title,
        message
      }
      
      dashboardState.addLog(logEntry)
      this.broadcastUpdate('log', { log: logEntry })
      
      return result
    }
  }

  public broadcastUpdate(type: string, data: unknown): void {
    const payload = JSON.stringify({ type, data })
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload)
        } catch (error) {
          dashLog(`Error broadcasting update: ${error instanceof Error ? error.message : String(error)}`, 'error')
        }
      }
    }
  }

  public start(): void {
    this.server.listen(PORT, HOST, () => {
      dashLog(`Server running on http://${HOST}:${PORT}`)
      dashLog('WebSocket ready for live logs')
    })
  }

  public stop(): void {
    this.wss.close()
    this.server.close()
    dashLog('Server stopped')
  }
}

export function startDashboardServer(): DashboardServer {
  const server = new DashboardServer()
  server.start()
  return server
}
