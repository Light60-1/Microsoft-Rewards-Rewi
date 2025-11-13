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
    initialPoints: number       // Points avant l'exécution
    finalPoints: number         // Points après l'exécution
    desktopPoints: number       // Points gagnés sur Desktop
    mobilePoints: number        // Points gagnés sur Mobile
    errors?: string[]
    banned?: boolean
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
     * Send comprehensive summary via webhook with complete statistics
     */
    async sendWebhookSummary(summary: SummaryData): Promise<void> {
        if (!this.config.webhook?.enabled && !this.config.conclusionWebhook?.enabled) {
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

            // Calculate global statistics
            const totalDesktop = summary.accounts.reduce((sum, acc) => sum + acc.desktopPoints, 0)
            const totalMobile = summary.accounts.reduce((sum, acc) => sum + acc.mobilePoints, 0)
            const totalInitial = summary.accounts.reduce((sum, acc) => sum + acc.initialPoints, 0)
            const totalFinal = summary.accounts.reduce((sum, acc) => sum + acc.finalPoints, 0)
            const bannedCount = summary.accounts.filter(acc => acc.banned).length

            // Build structured embed description
            let description = `┌${'─'.repeat(48)}┐\n`
            description += `│ ${' '.repeat(10)}📊 EXECUTION SUMMARY${' '.repeat(11)}│\n`
            description += `└${'─'.repeat(48)}┘\n\n`

            // Global Overview
            description += `**🌐 GLOBAL STATISTICS**\n`
            description += `┌${'─'.repeat(48)}┐\n`
            description += `│ ⏱️ Duration: \`${durationText}\`${' '.repeat(48 - 14 - durationText.length)}│\n`
            description += `│ 💰 Total Earned: **${summary.totalPoints}** points${' '.repeat(48 - 22 - String(summary.totalPoints).length)}│\n`
            description += `│ 🖥️ Desktop: **${totalDesktop}** pts | 📱 Mobile: **${totalMobile}** pts${' '.repeat(48 - 28 - String(totalDesktop).length - String(totalMobile).length)}│\n`
            description += `│ ✅ Success: ${summary.successCount}/${summary.accounts.length} accounts${' '.repeat(48 - 18 - String(summary.successCount).length - String(summary.accounts.length).length)}│\n`
            if (summary.failureCount > 0) {
                description += `│ ❌ Failed: ${summary.failureCount} accounts${' '.repeat(48 - 14 - String(summary.failureCount).length)}│\n`
            }
            if (bannedCount > 0) {
                description += `│ 🚫 Banned: ${bannedCount} accounts${' '.repeat(48 - 14 - String(bannedCount).length)}│\n`
            }
            description += `└${'─'.repeat(48)}┘\n\n`

            // Account Details
            description += `**📄 ACCOUNT BREAKDOWN**\n\n`

            const accountsWithErrors: AccountResult[] = []

            for (const account of summary.accounts) {
                const status = account.banned ? '🚫' : (account.errors?.length ? '❌' : '✅')
                const emailShort = account.email.length > 30 ? account.email.substring(0, 27) + '...' : account.email
                const durationSec = Math.round(account.runDuration / 1000)

                description += `${status} **${emailShort}**\n`
                description += `┌${'─'.repeat(46)}┐\n`

                // Points Earned Breakdown
                description += `│ 📊 Points Earned: **+${account.pointsEarned}** points${' '.repeat(46 - 23 - String(account.pointsEarned).length)}│\n`
                description += `│   └─ Desktop: **${account.desktopPoints}** pts${' '.repeat(46 - 20 - String(account.desktopPoints).length)}│\n`
                description += `│   └─ Mobile: **${account.mobilePoints}** pts${' '.repeat(46 - 19 - String(account.mobilePoints).length)}│\n`
                description += `├${'─'.repeat(46)}┤\n`

                // Account Total Balance (formula)
                description += `│ 💳 Account Total Balance${' '.repeat(23)}│\n`
                description += `│   \`${account.initialPoints}\` + \`${account.pointsEarned}\` = **\`${account.finalPoints}\` pts**${' '.repeat(46 - 17 - String(account.initialPoints).length - String(account.pointsEarned).length - String(account.finalPoints).length)}│\n`
                description += `│   (Initial + Earned = Final)${' '.repeat(18)}│\n`
                description += `├${'─'.repeat(46)}┤\n`

                // Duration
                description += `│ ⏱️ Duration: ${durationSec}s${' '.repeat(46 - 13 - String(durationSec).length)}│\n`

                description += `└${'─'.repeat(46)}┘\n\n`

                // Collect accounts with errors for separate webhook
                if ((account.errors?.length || account.banned) && account.email) {
                    accountsWithErrors.push(account)
                }
            }

            // Footer summary
            description += `┌${'─'.repeat(48)}┐\n`
            description += `│ 🌐 TOTAL ACROSS ALL ACCOUNTS${' '.repeat(22)}│\n`
            description += `├${'─'.repeat(48)}┤\n`
            description += `│ Initial Balance: \`${totalInitial}\` points${' '.repeat(48 - 25 - String(totalInitial).length)}│\n`
            description += `│ Final Balance: \`${totalFinal}\` points${' '.repeat(48 - 23 - String(totalFinal).length)}│\n`
            description += `│ Total Earned: **+${summary.totalPoints}** points${' '.repeat(48 - 23 - String(summary.totalPoints).length)}│\n`
            description += `└${'─'.repeat(48)}┘\n`

            const color = bannedCount > 0 ? 0xFF0000 : summary.failureCount > 0 ? 0xFFAA00 : 0x00FF00

            // Send main summary webhook
            await ConclusionWebhook(
                this.config,
                '🎉 Daily Rewards Collection Complete',
                description,
                undefined,
                color
            )

            // Send separate error report if there are accounts with issues
            if (accountsWithErrors.length > 0) {
                await this.sendErrorReport(accountsWithErrors)
            }
        } catch (error) {
            log('main', 'SUMMARY', `Failed to send webhook: ${error instanceof Error ? error.message : String(error)}`, 'error')
        }
    }

    /**
     * Send separate webhook for accounts with errors or bans
     */
    private async sendErrorReport(accounts: AccountResult[]): Promise<void> {
        try {
            let errorDescription = `┌${'─'.repeat(48)}┐\n`
            errorDescription += `│ ${' '.repeat(10)}⚠️ ERROR REPORT${' '.repeat(16)}│\n`
            errorDescription += `└${'─'.repeat(48)}┘\n\n`

            errorDescription += `**${accounts.length} account(s) encountered issues:**\n\n`

            for (const account of accounts) {
                const status = account.banned ? '🚫 BANNED' : '❌ ERROR'
                const emailShort = account.email.length > 35 ? account.email.substring(0, 32) + '...' : account.email

                errorDescription += `${status} | **${emailShort}**\n`
                errorDescription += `┌${'─'.repeat(46)}┐\n`

                // Show what was attempted
                errorDescription += `│ 📊 Progress${' '.repeat(35)}│\n`
                errorDescription += `│   Desktop: ${account.desktopPoints} pts earned${' '.repeat(46 - 21 - String(account.desktopPoints).length)}│\n`
                errorDescription += `│   Mobile: ${account.mobilePoints} pts earned${' '.repeat(46 - 20 - String(account.mobilePoints).length)}│\n`
                errorDescription += `│   Total: ${account.pointsEarned} pts${' '.repeat(46 - 13 - String(account.pointsEarned).length)}│\n`
                errorDescription += `├${'─'.repeat(46)}┤\n`

                // Error details
                if (account.banned) {
                    errorDescription += `│ 🚫 Status: Account Banned/Suspended${' '.repeat(9)}│\n`
                    if (account.errors?.length && account.errors[0]) {
                        errorDescription += `│ 💬 Reason:${' '.repeat(36)}│\n`
                        const lines = this.wrapText(account.errors[0], 42)
                        for (const line of lines) {
                            errorDescription += `│   ${line}${' '.repeat(46 - 3 - line.length)}│\n`
                        }
                    }
                } else if (account.errors?.length && account.errors[0]) {
                    errorDescription += `│ ❌ Error Details:${' '.repeat(29)}│\n`
                    const lines = this.wrapText(account.errors[0], 42)
                    for (const line of lines) {
                        errorDescription += `│   ${line}${' '.repeat(46 - 3 - line.length)}│\n`
                    }
                }

                errorDescription += `└${'─'.repeat(46)}┘\n\n`
            }

            errorDescription += `**📋 Recommended Actions:**\n`
            errorDescription += `• Check account status manually\n`
            errorDescription += `• Review error messages above\n`
            errorDescription += `• Verify credentials if login failed\n`
            errorDescription += `• Consider proxy rotation if rate-limited\n`

            await ConclusionWebhook(
                this.config,
                '⚠️ Execution Errors & Warnings',
                errorDescription,
                undefined,
                0xFF0000 // Red color for errors
            )
        } catch (error) {
            log('main', 'SUMMARY', `Failed to send error report webhook: ${error instanceof Error ? error.message : String(error)}`, 'error')
        }
    }

    /**
     * Wrap text to fit within specified width
     */
    private wrapText(text: string, maxWidth: number): string[] {
        const words = text.split(' ')
        const lines: string[] = []
        let currentLine = ''

        for (const word of words) {
            if ((currentLine + word).length > maxWidth) {
                if (currentLine) lines.push(currentLine.trim())
                currentLine = word + ' '
            } else {
                currentLine += word + ' '
            }
        }

        if (currentLine.trim()) lines.push(currentLine.trim())
        return lines
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
