import type { MicrosoftRewardsBot } from '../index'
import { log as botLog } from '../util/Logger'
import { getErrorMessage } from '../util/Utils'
import { dashboardState } from './state'

export class BotController {
  private botInstance: MicrosoftRewardsBot | null = null
  private startTime?: Date
  private isStarting: boolean = false // Race condition protection

  constructor() {
    process.on('exit', () => this.stop())
  }

  private log(message: string, level: 'log' | 'warn' | 'error' = 'log'): void {
    botLog('main', 'BOT-CONTROLLER', message, level)
    
    dashboardState.addLog({
      timestamp: new Date().toISOString(),
      level,
      platform: 'MAIN',
      title: 'BOT-CONTROLLER',
      message
    })
  }

  public async start(): Promise<{ success: boolean; error?: string; pid?: number }> {
    // FIXED: Race condition protection - prevent multiple simultaneous start() calls
    if (this.botInstance) {
      return { success: false, error: 'Bot is already running' }
    }
    
    if (this.isStarting) {
      return { success: false, error: 'Bot is currently starting, please wait' }
    }

    try {
      this.isStarting = true
      this.log('🚀 Starting bot...', 'log')

      const { MicrosoftRewardsBot } = await import('../index')
      
      this.botInstance = new MicrosoftRewardsBot(false)
      this.startTime = new Date()
      dashboardState.setRunning(true)
      dashboardState.setBotInstance(this.botInstance)

      // Run bot asynchronously - don't block the API response
      void (async () => {
        try {
          this.log('✓ Bot initialized, starting execution...', 'log')
          
          await this.botInstance!.initialize()
          await this.botInstance!.run()
          
          this.log('✓ Bot completed successfully', 'log')
        } catch (error) {
          this.log(`Bot error: ${getErrorMessage(error)}`, 'error')
        } finally {
          this.cleanup()
        }
      })()

      return { success: true, pid: process.pid }

    } catch (error) {
      const errorMsg = getErrorMessage(error)
      this.log(`Failed to start bot: ${errorMsg}`, 'error')
      this.cleanup()
      return { success: false, error: errorMsg }
    } finally {
      this.isStarting = false
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
      const errorMsg = getErrorMessage(error)
      this.log(`Error stopping bot: ${errorMsg}`, 'error')
      this.cleanup()
      return { success: false, error: errorMsg }
    }
  }

  public async restart(): Promise<{ success: boolean; error?: string; pid?: number }> {
    this.log('🔄 Restarting bot...', 'log')
    
    const stopResult = this.stop()
    if (!stopResult.success && stopResult.error !== 'Bot is not running') {
      return { success: false, error: `Failed to stop: ${stopResult.error}` }
    }
    
    await this.wait(2000)
    
    return await this.start()
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
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
    this.startTime = undefined
    dashboardState.setRunning(false)
    dashboardState.setBotInstance(undefined)
  }
}

export const botController = new BotController()
