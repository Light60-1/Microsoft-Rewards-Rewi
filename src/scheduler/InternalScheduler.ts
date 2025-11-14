import cron from 'node-cron'
import type { Config } from '../interface/Config'
import { log } from '../util/notifications/Logger'

/**
 * Internal Scheduler for automatic bot execution
 * Uses node-cron internally but provides simple time-based scheduling
 * 
 * Features:
 * - Simple time-based scheduling (e.g., "09:00" = daily at 9 AM)
 * - Automatic timezone detection (uses your computer/server timezone)
 * - Overlap protection (prevents concurrent runs)
 * - Error recovery with retries
 * - Clean shutdown handling
 * - Cross-platform (Windows, Linux, Mac)
 */
export class InternalScheduler {
    private cronJob: cron.ScheduledTask | null = null
    private config: Config
    private taskCallback: () => Promise<void>
    private isRunning: boolean = false
    private lastRunTime: Date | null = null

    constructor(config: Config, taskCallback: () => Promise<void>) {
        this.config = config
        this.taskCallback = taskCallback
    }

    /**
     * Start the scheduler if enabled in config
     * @returns true if scheduler started successfully, false otherwise
     */
    public start(): boolean {
        const scheduleConfig = this.config.scheduling

        // Validation checks
        if (!scheduleConfig?.enabled) {
            log('main', 'SCHEDULER', 'Internal scheduler disabled (scheduling.enabled = false)')
            return false
        }

        // Get schedule from simple time format (e.g., "09:00") or fallback to cron format
        const schedule = this.parseSchedule(scheduleConfig)

        if (!schedule) {
            log('main', 'SCHEDULER', 'Invalid schedule format. Use time in HH:MM format (e.g., "09:00" for 9 AM)', 'error')
            return false
        }

        // Validate cron expression
        if (!cron.validate(schedule)) {
            log('main', 'SCHEDULER', `Invalid schedule: "${schedule}"`, 'error')
            return false
        }

        try {
            const timezone = this.detectTimezone()

            this.cronJob = cron.schedule(schedule, async () => {
                await this.runScheduledTask()
            }, {
                scheduled: true,
                timezone
            })

            const displayTime = scheduleConfig.time || this.extractTimeFromCron(schedule)

            log('main', 'SCHEDULER', '✓ Internal scheduler started', 'log', 'green')
            log('main', 'SCHEDULER', `  Daily run time: ${displayTime}`, 'log', 'cyan')
            log('main', 'SCHEDULER', `  Timezone: ${timezone}`, 'log', 'cyan')
            log('main', 'SCHEDULER', `  Next run: ${this.getNextRunTime()}`, 'log', 'cyan')

            return true
        } catch (error) {
            log('main', 'SCHEDULER', `Failed to start scheduler: ${error instanceof Error ? error.message : String(error)}`, 'error')
            return false
        }
    }

    /**
     * Parse schedule from config - supports simple time format (HH:MM) or cron expression
     * @returns Cron expression string
     */
    private parseSchedule(scheduleConfig: { time?: string; cron?: { schedule?: string } }): string | null {
        // Priority 1: Simple time format (e.g., "09:00")
        if (scheduleConfig.time) {
            const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(scheduleConfig.time.trim())
            if (timeMatch) {
                const hours = parseInt(timeMatch[1]!, 10)
                const minutes = parseInt(timeMatch[2]!, 10)

                if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                    // Convert to cron: "minute hour * * *" = daily at specified time
                    return `${minutes} ${hours} * * *`
                }
            }
            return null // Invalid time format
        }

        // Priority 2: COMPATIBILITY format (cron.schedule field, pre-v2.58)
        if (scheduleConfig.cron?.schedule) {
            return scheduleConfig.cron.schedule
        }

        // Default: 9 AM daily
        return '0 9 * * *'
    }

    /**
     * Extract readable time from cron expression (for display purposes)
     */
    private extractTimeFromCron(cronExpr: string): string {
        const parts = cronExpr.split(' ')
        if (parts.length >= 2) {
            const minute = parts[0]
            const hour = parts[1]
            if (minute && hour && minute !== '*' && hour !== '*') {
                return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
            }
        }
        return cronExpr
    }

    /**
     * Execute the scheduled task with overlap protection and retry logic
     */
    private async runScheduledTask(): Promise<void> {
        // Overlap protection
        if (this.isRunning) {
            log('main', 'SCHEDULER', 'Skipping scheduled run: previous task still running', 'warn')
            return
        }

        const maxRetries = this.config.crashRecovery?.maxRestarts ?? 1
        let attempts = 0

        while (attempts <= maxRetries) {
            try {
                this.isRunning = true
                this.lastRunTime = new Date()

                log('main', 'SCHEDULER', '⏰ Scheduled run triggered', 'log', 'cyan')

                await this.taskCallback()

                log('main', 'SCHEDULER', '✓ Scheduled run completed successfully', 'log', 'green')
                log('main', 'SCHEDULER', `  Next run: ${this.getNextRunTime()}`, 'log', 'cyan')

                return // Success - exit retry loop

            } catch (error) {
                attempts++
                const errorMsg = error instanceof Error ? error.message : String(error)
                log('main', 'SCHEDULER', `Scheduled run failed (attempt ${attempts}/${maxRetries + 1}): ${errorMsg}`, 'error')

                if (attempts <= maxRetries) {
                    const backoff = (this.config.crashRecovery?.backoffBaseMs ?? 2000) * attempts
                    log('main', 'SCHEDULER', `Retrying in ${backoff}ms...`, 'warn')
                    await new Promise(resolve => setTimeout(resolve, backoff))
                } else {
                    log('main', 'SCHEDULER', `Max retries (${maxRetries + 1}) exceeded. Waiting for next scheduled run.`, 'error')
                }
            } finally {
                this.isRunning = false
            }
        }
    }

    /**
     * Stop the scheduler gracefully
     */
    public stop(): void {
        if (this.cronJob) {
            this.cronJob.stop()
            log('main', 'SCHEDULER', 'Scheduler stopped', 'warn')
            this.cronJob = null
        }
    }

    /**
     * Get the next scheduled run time
     */
    private getNextRunTime(): string {
        if (!this.cronJob) return 'unknown'

        try {
            const scheduleConfig = this.config.scheduling
            const timezone = this.detectTimezone()

            // Get the cron schedule being used
            let cronSchedule: string
            if (scheduleConfig?.time) {
                cronSchedule = this.parseSchedule(scheduleConfig) || '0 9 * * *'
            } else if (scheduleConfig?.cron?.schedule) {
                cronSchedule = scheduleConfig.cron.schedule
            } else {
                cronSchedule = '0 9 * * *'
            }

            // Calculate next run based on cron expression
            const now = new Date()
            const parts = cronSchedule.split(' ')

            if (parts.length !== 5) {
                return 'invalid schedule format'
            }

            // Simple next-run calculation for daily schedules
            const [minute, hour] = parts

            if (!minute || !hour || minute === '*' || hour === '*') {
                return 'varies (see schedule configuration)'
            }

            const targetHour = parseInt(hour, 10)
            const targetMinute = parseInt(minute, 10)

            if (isNaN(targetHour) || isNaN(targetMinute)) {
                return 'complex schedule'
            }

            const next = new Date(now)
            next.setHours(targetHour, targetMinute, 0, 0)

            // If time already passed today, move to tomorrow
            if (next <= now) {
                next.setDate(next.getDate() + 1)
            }

            return next.toLocaleString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: timezone
            })
        } catch {
            return 'unable to calculate'
        }
    }

    /**
     * Detect system timezone
     */
    private detectTimezone(): string {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        } catch {
            return 'UTC'
        }
    }

    /**
     * Check if scheduler is active
     */
    public isActive(): boolean {
        return this.cronJob !== null
    }

    /**
     * Get scheduler status for monitoring
     */
    public getStatus(): {
        active: boolean
        isRunning: boolean
        lastRun: string | null
        nextRun: string
    } {
        return {
            active: this.isActive(),
            isRunning: this.isRunning,
            lastRun: this.lastRunTime ? this.lastRunTime.toLocaleString() : null,
            nextRun: this.getNextRunTime()
        }
    }

    /**
     * Trigger an immediate run (useful for manual triggers or dashboard)
     */
    public async triggerNow(): Promise<void> {
        log('main', 'SCHEDULER', 'Manual trigger requested', 'log', 'cyan')
        await this.runScheduledTask()
    }
}
