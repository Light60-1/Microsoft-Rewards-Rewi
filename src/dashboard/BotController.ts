import { dashboardState } from './state'
import type { MicrosoftRewardsBot } from '../index'

export class BotController {
  private botInstance: MicrosoftRewardsBot | null = null
  private botPromise: Promise<void> | null = null
  private startTime?: Date

  constructor() {
    process.on('exit', () => this.stop())
  }

  private log(message: string, level: 'log' | 'warn' | 'error' = 'log'): void {
    console.log(`[BotController] ${message}`)
    
    dashboardState.addLog({
      timestamp: new Date().toISOString(),
      level,
      platform: 'MAIN',
      title: 'BOT-CONTROLLER',
      message
    })
  }

  public async start(): Promise<{ success: boolean; error?: string; pid?: number }> {
    if (this.botInstance) {
      return { success: false, error: 'Bot is already running' }
    }

    try {
      this.log('🚀 Starting bot...', 'log')

      const { MicrosoftRewardsBot } = await import('../index')
      
      this.botInstance = new MicrosoftRewardsBot(false)
      this.startTime = new Date()
      dashboardState.setRunning(true)
      dashboardState.setBotInstance(this.botInstance)

      this.botPromise = (async () => {
        try {
          this.log('✓ Bot initialized, starting execution...', 'log')
          
          await this.botInstance!.initialize()
          await this.botInstance!.run()
          
          this.log('✓ Bot completed successfully', 'log')
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          this.log(`Bot error: ${errorMsg}`, 'error')
          throw error
        } finally {
          this.cleanup()
        }
      })()

      this.botPromise.catch(error => {
        this.log(`Bot execution failed: ${error instanceof Error ? error.message : String(error)}`, 'error')
      })

      return { success: true, pid: process.pid }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.log(`Failed to start bot: ${errorMsg}`, 'error')
      this.cleanup()
      return { success: false, error: errorMsg }
    }
  }

  public stop(): { success: boolean; error?: string } {
    if (!this.botInstance) {
      return { success: false, error: 'Bot is not running' }
    }

    try {
      this.log('🛑 Stopping bot...', 'warn')
      this.log('⚠ Note: Bot will complete current task before stopping', 'warn')
      
      this.cleanup()
      return { success: true }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.log(`Error stopping bot: ${errorMsg}`, 'error')
      this.cleanup()
      return { success: false, error: errorMsg }
    }
  }

  public async restart(): Promise<{ success: boolean; error?: string; pid?: number }> {
    this.log('🔄 Restarting bot...', 'log')
    this.stop()
    
    return new Promise((resolve) => {
      setTimeout(async () => {
        const result = await this.start()
        resolve(result)
      }, 2000)
    })
  }

  public getStatus(): {
    running: boolean
    pid?: number
    uptime?: number
    startTime?: string
  } {
    return {
      running: !!this.botInstance,
      pid: process.pid,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : undefined,
      startTime: this.startTime?.toISOString()
    }
  }

  private cleanup(): void {
    this.botInstance = null
    this.botPromise = null
    this.startTime = undefined
    dashboardState.setRunning(false)
    dashboardState.setBotInstance(undefined)
  }
}

export const botController = new BotController()
