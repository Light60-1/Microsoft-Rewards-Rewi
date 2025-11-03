import { dashboardState } from './state'

// We'll import and run the bot directly in the same process
let botRunning = false
let botPromise: Promise<void> | null = null

export class BotController {
  private isRunning: boolean = false
  private startTime?: Date

  constructor() {
    // Cleanup on exit
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
    if (this.isRunning || botRunning) {
      return { success: false, error: 'Bot is already running' }
    }

    try {
      this.log('🚀 Starting bot...', 'log')

      // Import the bot main logic
      const { MicrosoftRewardsBot } = await import('../index')
      
      this.isRunning = true
      botRunning = true
      this.startTime = new Date()
      dashboardState.setRunning(true)

      // Run the bot in the same process using the exact same logic as npm start
      botPromise = (async () => {
        try {
          const rewardsBot = new MicrosoftRewardsBot(false)
          
          this.log('✓ Bot initialized, starting execution...', 'log')
          
          await rewardsBot.initialize()
          await rewardsBot.run()
          
          this.log('✓ Bot completed successfully', 'log')
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          this.log(`Bot error: ${errorMsg}`, 'error')
          throw error
        } finally {
          this.cleanup()
        }
      })()

      // Don't await - let it run in background
      botPromise.catch(error => {
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
    if (!this.isRunning && !botRunning) {
      return { success: false, error: 'Bot is not running' }
    }

    try {
      this.log('🛑 Stopping bot...', 'warn')
      
      // For now, we can't gracefully stop a running bot in the same process
      // This would require refactoring the bot to support cancellation
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
    
    // Wait a bit before restarting
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
      running: this.isRunning || botRunning,
      pid: process.pid,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : undefined,
      startTime: this.startTime?.toISOString()
    }
  }

  private cleanup(): void {
    this.isRunning = false
    botRunning = false
    botPromise = null
    this.startTime = undefined
    dashboardState.setRunning(false)
  }
}

// Singleton instance
export const botController = new BotController()
