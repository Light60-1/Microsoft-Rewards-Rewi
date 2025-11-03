import express from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import path from 'path'
import { apiRouter } from './routes'
import { dashboardState, DashboardLog } from './state'
import { log as botLog } from '../util/Logger'

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
  }

  private setupMiddleware(): void {
    this.app.use(express.json())
    this.app.use(express.static(path.join(__dirname, '../../public')))
  }

  private setupRoutes(): void {
    this.app.use('/api', apiRouter)
    
    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', uptime: process.uptime() })
    })

    // Serve dashboard UI
    this.app.get('/', (_req, res) => {
      res.sendFile(path.join(__dirname, '../../public/index.html'))
    })
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws)
      console.log('[Dashboard] WebSocket client connected')

      ws.on('close', () => {
        this.clients.delete(ws)
        console.log('[Dashboard] WebSocket client disconnected')
      })

      // Send recent logs on connect
      const recentLogs = dashboardState.getLogs(50)
      ws.send(JSON.stringify({ type: 'history', logs: recentLogs }))
    })
  }

  private interceptBotLogs(): void {
    // Store reference to this.clients for closure
    const clients = this.clients
    
    // Intercept bot logs and forward to dashboard
    const originalLog = botLog
    ;(global as Record<string, unknown>).botLog = function(
      isMobile: boolean | 'main',
      title: string,
      message: string,
      type: 'log' | 'warn' | 'error' = 'log'
    ) {
      const result = originalLog(isMobile, title, message, type)
      
      const logEntry: DashboardLog = {
        timestamp: new Date().toISOString(),
        level: type,
        platform: isMobile === 'main' ? 'MAIN' : isMobile ? 'MOBILE' : 'DESKTOP',
        title,
        message
      }
      
      dashboardState.addLog(logEntry)
      
      // Broadcast to WebSocket clients
      const payload = JSON.stringify({ type: 'log', log: logEntry })
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload)
        }
      }
      
      return result
    }
  }

  public start(): void {
    this.server.listen(PORT, HOST, () => {
      console.log(`[Dashboard] Server running on http://${HOST}:${PORT}`)
      console.log('[Dashboard] WebSocket ready for live logs')
    })
  }

  public stop(): void {
    this.wss.close()
    this.server.close()
    console.log('[Dashboard] Server stopped')
  }
}

export function startDashboardServer(): DashboardServer {
  const server = new DashboardServer()
  server.start()
  return server
}
