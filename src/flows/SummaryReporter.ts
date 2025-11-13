/**
 * Summary Reporter Module
 * Extracted from index.ts to improve maintainability and testability
 * 
 * Handles reporting and notifications:
 * - Points collection summaries
 * - Webhook notifications
 * - Ntfy push notifications
 * - Job state updates
 */

import type { Config } from '../interface/Config'
import { ConclusionWebhook } from '../util/notifications/ConclusionWebhook'
import { log } from '../util/notifications/Logger'
import { Ntfy } from '../util/notifications/Ntfy'
import { JobState } from '../util/state/JobState'

export interface AccountResult {
    email: string
    pointsEarned: number
    runDuration: number
    errors?: string[]
}

export interface SummaryData {
    accounts: AccountResult[]
    startTime: Date
    endTime: Date
    totalPoints: number
    successCount: number
    failureCount: number
}

export class SummaryReporter {
    private config: Config
    private jobState: JobState

    constructor(config: Config) {
        this.config = config
        this.jobState = new JobState(config)
    }

    /**
     * Send comprehensive summary via webhook
     */
    async sendWebhookSummary(summary: SummaryData): Promise<void> {
        if (!this.config.webhook?.enabled) {
            return
        }

        try {
            const duration = Math.round((summary.endTime.getTime() - summary.startTime.getTime()) / 1000)
            const hours = Math.floor(duration / 3600)
            const minutes = Math.floor((duration % 3600) / 60)
            const seconds = duration % 60

            const durationText = hours > 0
                ? `${hours}h ${minutes}m ${seconds}s`
                : minutes > 0
                    ? `${minutes}m ${seconds}s`
                    : `${seconds}s`

            let description = `╔════════════════════════════════════════╗\n`
            description += `║          Daily Run Summary             ║\n`
            description += `╚════════════════════════════════════════╝\n\n`
            description += `⏱️ **Duration:** ${durationText}\n`
            description += `💰 **Total Points:** ${summary.totalPoints}\n`
            description += `✅ **Success Rate:** ${summary.successCount}/${summary.accounts.length} accounts\n\n`

            // Add individual account results with better formatting
            description += `📊 **Detailed Results:**\n`
            description += `${'─'.repeat(45)}\n`
            for (const account of summary.accounts) {
                const status = account.errors?.length ? '❌' : '✅'
                const emailShort = account.email.length > 25 ? account.email.substring(0, 22) + '...' : account.email
                description += `${status} \`${emailShort}\`\n`
                description += `   💎 Points: **${account.pointsEarned}** | ⏱️ Time: ${Math.round(account.runDuration / 1000)}s\n`

                if (account.errors?.length) {
                    description += `   ⚠️ Error: *${account.errors[0]}*\n`
                }
                description += `\n`
            }

            await ConclusionWebhook(
                this.config,
                '📊 Daily Run Complete',
                description,
                undefined,
                summary.failureCount > 0 ? 0xFF5555 : 0x00FF00
            )
        } catch (error) {
            log('main', 'SUMMARY', `Failed to send webhook: ${error instanceof Error ? error.message : String(error)}`, 'error')
        }
    }

    /**
     * Send push notification via Ntfy
     */
    async sendPushNotification(summary: SummaryData): Promise<void> {
        if (!this.config.ntfy?.enabled) {
            return
        }

        try {
            const message = `Collected ${summary.totalPoints} points across ${summary.accounts.length} account(s). Success: ${summary.successCount}, Failed: ${summary.failureCount}`

            await Ntfy(message, summary.failureCount > 0 ? 'warn' : 'log')
        } catch (error) {
            log('main', 'SUMMARY', `Failed to send Ntfy notification: ${error instanceof Error ? error.message : String(error)}`, 'error')
        }
    }

    /**
     * Update job state with completion status
     */
    async updateJobState(summary: SummaryData): Promise<void> {
        try {
            const day = summary.endTime.toISOString().split('T')?.[0]
            if (!day) return

            for (const account of summary.accounts) {
                this.jobState.markAccountComplete(
                    account.email,
                    day,
                    {
                        totalCollected: account.pointsEarned,
                        banned: false,
                        errors: account.errors?.length ?? 0
                    }
                )
            }
        } catch (error) {
            log('main', 'SUMMARY', `Failed to update job state: ${error instanceof Error ? error.message : String(error)}`, 'error')
        }
    }

    /**
     * Generate and send comprehensive summary
     */
    async generateReport(summary: SummaryData): Promise<void> {
        log('main', 'SUMMARY', '═'.repeat(80))
        log('main', 'SUMMARY', '📊 EXECUTION SUMMARY')
        log('main', 'SUMMARY', '═'.repeat(80))

        const duration = Math.round((summary.endTime.getTime() - summary.startTime.getTime()) / 1000)
        log('main', 'SUMMARY', `⏱️  Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`)
        log('main', 'SUMMARY', `📈 Total Points Collected: ${summary.totalPoints}`)
        log('main', 'SUMMARY', `✅ Successful Accounts: ${summary.successCount}/${summary.accounts.length}`)

        if (summary.failureCount > 0) {
            log('main', 'SUMMARY', `❌ Failed Accounts: ${summary.failureCount}`, 'warn')
        }

        log('main', 'SUMMARY', '─'.repeat(80))
        log('main', 'SUMMARY', 'Account Breakdown:')
        log('main', 'SUMMARY', '─'.repeat(80))

        for (const account of summary.accounts) {
            const status = account.errors?.length ? '❌ FAILED' : '✅ SUCCESS'
            const duration = Math.round(account.runDuration / 1000)

            log('main', 'SUMMARY', `${status} | ${account.email}`)
            log('main', 'SUMMARY', `   Points: ${account.pointsEarned} | Duration: ${duration}s`)

            if (account.errors?.length) {
                log('main', 'SUMMARY', `   Error: ${account.errors[0]}`, 'error')
            }
        }

        log('main', 'SUMMARY', '═'.repeat(80))

        // Send notifications
        await Promise.all([
            this.sendWebhookSummary(summary),
            this.sendPushNotification(summary),
            this.updateJobState(summary)
        ])
    }

    /**
     * Create summary data structure from account results
     */
    createSummary(
        accounts: AccountResult[],
        startTime: Date,
        endTime: Date
    ): SummaryData {
        const totalPoints = accounts.reduce((sum, acc) => sum + acc.pointsEarned, 0)
        const successCount = accounts.filter(acc => !acc.errors?.length).length
        const failureCount = accounts.length - successCount

        return {
            accounts,
            startTime,
            endTime,
            totalPoints,
            successCount,
            failureCount
        }
    }
}
