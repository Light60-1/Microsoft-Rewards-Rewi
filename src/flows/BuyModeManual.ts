/**
 * Buy Mode Manual Handler Module
 * Extracted from index.ts runBuyMode() method
 * 
 * Provides manual spending mode where user retains control:
 * - Opens two browser tabs (monitor + browsing)
 * - Passively monitors point changes every ~10s
 * - Detects spending and sends notifications
 * - Session has configurable duration (default: 45 minutes)
 * - User manually selects and purchases items
 */

import type { BrowserContext } from 'playwright'
import type { MicrosoftRewardsBot } from '../index'
import type { Account } from '../interface/Account'
import { BuyModeMonitor, BuyModeSelector } from '../util/BuyMode'
import { saveSessionData } from '../util/Load'
import { log } from '../util/Logger'

interface AccountSummary {
    email: string
    durationMs: number
    desktopCollected: number
    mobileCollected: number
    totalCollected: number
    initialTotal: number
    endTotal: number
    errors: string[]
    banned: { status: boolean; reason: string }
}

export class BuyModeManual {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    /**
     * Execute manual buy mode session
     * Opens browser, logs in, and passively monitors points while user browses/purchases
     * @param buyModeArgument Optional account email to use (otherwise prompts user)
     * @returns Promise that resolves when session ends
     */
    async execute(buyModeArgument?: string): Promise<void> {
        try {
            const buyModeConfig = this.bot.config.buyMode as { maxMinutes?: number } | undefined
            const maxMinutes = buyModeConfig?.maxMinutes ?? 45

            // Access private accounts array via type assertion
            const accounts = (this.bot as unknown as { accounts: Account[] }).accounts
            const selector = new BuyModeSelector(accounts)
            const selection = await selector.selectAccount(buyModeArgument, maxMinutes)

            if (!selection) {
                log('main', 'BUY-MODE', 'Buy mode cancelled: no account selected', 'warn')
                return
            }

            const { account, maxMinutes: sessionMaxMinutes } = selection

            log('main', 'BUY-MODE', `Buy mode ENABLED for ${account.email}. Opening 2 tabs: (1) monitor tab (auto-refresh), (2) your browsing tab`, 'log', 'green')
            log('main', 'BUY-MODE', `Session duration: ${sessionMaxMinutes} minutes. Monitor tab refreshes every ~10s. Use the other tab for your actions.`, 'log', 'yellow')

            this.bot.isMobile = false
            
            // Access private browserFactory via type assertion
            const browserFactory = (this.bot as unknown as { browserFactory: { createBrowser: (proxy: Account['proxy'], email: string) => Promise<BrowserContext> } }).browserFactory
            const browser = await browserFactory.createBrowser(account.proxy, account.email)

            // Open the monitor tab FIRST so auto-refresh happens out of the way
            let monitor = await browser.newPage()
            
            // Access private login via type assertion (use 'any' for internal page type - unavoidable)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const loginModule = (this.bot as any).login
            await loginModule.login(monitor, account.email, account.password, account.totp)
            await this.bot.browser.func.goHome(monitor)
            this.bot.log(false, 'BUY-MODE', 'Opened MONITOR tab (auto-refreshes to track points).', 'log', 'yellow')

            // Then open the user free-browsing tab SECOND so users don't see the refreshes
            const page = await browser.newPage()
            await this.bot.browser.func.goHome(page)
            this.bot.log(false, 'BUY-MODE', 'Opened USER tab (use this one to redeem/purchase freely).', 'log', 'green')

            // Helper to recreate monitor tab if the user closes it
            const recreateMonitor = async () => {
                try { if (!monitor.isClosed()) await monitor.close() } catch { /* ignore */ }
                monitor = await browser.newPage()
                await this.bot.browser.func.goHome(monitor)
            }

            // Helper to send an immediate spend notice via webhooks/NTFY
            const sendSpendNotice = async (delta: number, nowPts: number, cumulativeSpent: number) => {
                try {
                    const { ConclusionWebhook } = await import('../util/ConclusionWebhook')
                    await ConclusionWebhook(
                        this.bot.config,
                        '💳 Spend Detected',
                        `**Account:** ${account.email}\n**Spent:** -${delta} points\n**Current:** ${nowPts} points\n**Session spent:** ${cumulativeSpent} points`,
                        undefined,
                        0xFFAA00
                    )
                } catch (e) {
                    this.bot.log(false, 'BUY-MODE', `Failed to send spend notice: ${e instanceof Error ? e.message : e}`, 'warn')
                }
            }

            // Get initial points
            let initial = 0
            try {
                const data = await this.bot.browser.func.getDashboardData(monitor)
                initial = data.userStatus.availablePoints || 0
            } catch {/* ignore */}

            const pointMonitor = new BuyModeMonitor(initial)

            this.bot.log(false, 'BUY-MODE', `Logged in as ${account.email}. Starting passive point monitoring (session: ${sessionMaxMinutes} min)`)

            // Passive watcher: poll points periodically without clicking.
            const start = Date.now()
            const endAt = start + sessionMaxMinutes * 60 * 1000

            while (Date.now() < endAt) {
                await this.bot.utils.wait(10000)

                // If monitor tab was closed by user, recreate it quietly
                try {
                    if (monitor.isClosed()) {
                        this.bot.log(false, 'BUY-MODE', 'Monitor tab was closed; reopening in background...', 'warn')
                        await recreateMonitor()
                    }
                } catch (e) {
                    this.bot.log(false, 'BUY-MODE', `Failed to check/recreate monitor tab: ${e instanceof Error ? e.message : String(e)}`, 'warn')
                }

                try {
                    const data = await this.bot.browser.func.getDashboardData(monitor)
                    const nowPts = data.userStatus.availablePoints || 0

                    const spendInfo = pointMonitor.checkSpending(nowPts)
                    if (spendInfo) {
                        this.bot.log(false, 'BUY-MODE', `Detected spend: -${spendInfo.spent} points (current: ${spendInfo.current})`)
                        await sendSpendNotice(spendInfo.spent, spendInfo.current, spendInfo.total)
                    }
                } catch (err) {
                    // If we lost the page context, recreate the monitor tab and continue
                    const msg = err instanceof Error ? err.message : String(err)
                    if (/Target closed|page has been closed|browser has been closed/i.test(msg)) {
                        this.bot.log(false, 'BUY-MODE', 'Monitor page closed or lost; recreating...', 'warn')
                        try {
                            await recreateMonitor()
                        } catch (e) {
                            this.bot.log(false, 'BUY-MODE', `Failed to recreate monitor: ${e instanceof Error ? e.message : String(e)}`, 'warn')
                        }
                    } else {
                        this.bot.log(false, 'BUY-MODE', `Dashboard check error: ${msg}`, 'warn')
                    }
                }
            }

            // Save cookies and close monitor; keep main page open for user until they close it themselves
            try {
                await saveSessionData(this.bot.config.sessionPath, browser, account.email, this.bot.isMobile)
            } catch (e) {
                log(false, 'BUY-MODE', `Failed to save session: ${e instanceof Error ? e.message : String(e)}`, 'warn')
            }
            try {
                if (!monitor.isClosed()) await monitor.close()
            } catch (e) {
                log(false, 'BUY-MODE', `Failed to close monitor tab: ${e instanceof Error ? e.message : String(e)}`, 'warn')
            }

            // Send a final minimal conclusion webhook for this manual session
            const monitorSummary = pointMonitor.getSummary()
            const summary: AccountSummary = {
                email: account.email,
                durationMs: monitorSummary.duration,
                desktopCollected: 0,
                mobileCollected: 0,
                totalCollected: -monitorSummary.spent, // negative indicates spend
                initialTotal: monitorSummary.initial,
                endTotal: monitorSummary.current,
                errors: [],
                banned: { status: false, reason: '' }
            }
            
            // Access private sendConclusion via type assertion
            const sendConclusion = (this.bot as unknown as { sendConclusion: (summaries: AccountSummary[]) => Promise<void> }).sendConclusion
            await sendConclusion.call(this.bot, [summary])

            this.bot.log(false, 'BUY-MODE', 'Buy mode session finished (monitoring period ended). You can close the browser when done.')
        } catch (e) {
            this.bot.log(false, 'BUY-MODE', `Error in buy mode: ${e instanceof Error ? e.message : String(e)}`, 'error')
        }
    }
}
