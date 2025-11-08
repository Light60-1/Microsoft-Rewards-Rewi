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
import { ConclusionWebhook } from '../util/ConclusionWebhook'
import { JobState } from '../util/JobState'
import { Ntfy } from '../util/Ntfy'

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

            let description = `**Duration:** ${durationText}\n**Total Points:** ${summary.totalPoints}\n**Success:** ${summary.successCount}/${summary.accounts.length}\n\n`

            // Add individual account results
            description += '**Account Results:**\n'
            for (const account of summary.accounts) {
                const status = account.errors?.length ? '❌' : '✅'
                description += `${status} ${account.email}: ${account.pointsEarned} points (${Math.round(account.runDuration / 1000)}s)\n`
                
                if (account.errors?.length) {
                    description += `   ⚠️ ${account.errors[0]}\n`
                }
            }

            await ConclusionWebhook(
                this.config,
                '📊 Daily Run Complete',
                description,
                undefined,
                summary.failureCount > 0 ? 0xFF5555 : 0x00FF00
            )
        } catch (error) {
            console.error('[SUMMARY] Failed to send webhook:', error)
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
            console.error('[SUMMARY] Failed to send Ntfy notification:', error)
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
            console.error('[SUMMARY] Failed to update job state:', error)
        }
    }

    /**
     * Generate and send comprehensive summary
     */
    async generateReport(summary: SummaryData): Promise<void> {
        console.log('\n' + '═'.repeat(80))
        console.log('📊 EXECUTION SUMMARY')
        console.log('═'.repeat(80))
        
        const duration = Math.round((summary.endTime.getTime() - summary.startTime.getTime()) / 1000)
        console.log(`\n⏱️  Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`)
        console.log(`📈 Total Points Collected: ${summary.totalPoints}`)
        console.log(`✅ Successful Accounts: ${summary.successCount}/${summary.accounts.length}`)
        
        if (summary.failureCount > 0) {
            console.log(`❌ Failed Accounts: ${summary.failureCount}`)
        }

        console.log('\n' + '─'.repeat(80))
        console.log('Account Breakdown:')
        console.log('─'.repeat(80))

        for (const account of summary.accounts) {
            const status = account.errors?.length ? '❌ FAILED' : '✅ SUCCESS'
            const duration = Math.round(account.runDuration / 1000)
            
            console.log(`\n${status} | ${account.email}`)
            console.log(`   Points: ${account.pointsEarned} | Duration: ${duration}s`)
            
            if (account.errors?.length) {
                console.log(`   Error: ${account.errors[0]}`)
            }
        }

        console.log('\n' + '═'.repeat(80) + '\n')

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
