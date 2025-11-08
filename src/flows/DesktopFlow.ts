/**
 * Desktop Flow Module
 * Extracted from index.ts to improve maintainability and testability
 * 
 * Handles desktop browser automation:
 * - Login and session management
 * - Daily set completion
 * - More promotions
 * - Punch cards
 * - Desktop searches
 */

import type { BrowserContext, Page } from 'playwright'
import type { MicrosoftRewardsBot } from '../index'
import type { Account } from '../interface/Account'
import { saveSessionData } from '../util/Load'

export interface DesktopFlowResult {
    initialPoints: number
    collectedPoints: number
}

export class DesktopFlow {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    /**
     * Execute the full desktop automation flow for an account
     * @param account Account to process
     * @returns Points collected during the flow
     */
    async run(account: Account): Promise<DesktopFlowResult> {
        this.bot.log(false, 'DESKTOP-FLOW', 'Starting desktop automation flow')
        
        const browserFactory = (this.bot as unknown as { browserFactory: { createBrowser: (proxy: Account['proxy'], email: string) => Promise<BrowserContext> } }).browserFactory
        const browser = await browserFactory.createBrowser(account.proxy, account.email)
        
        let keepBrowserOpen = false
        
        try {
            this.bot.homePage = await browser.newPage()

            this.bot.log(false, 'DESKTOP-FLOW', 'Browser started successfully')

            // Login into MS Rewards, then optionally stop if compromised
            const login = (this.bot as unknown as { login: { login: (page: Page, email: string, password: string, totp?: string) => Promise<void> } }).login
            await login.login(this.bot.homePage, account.email, account.password, account.totp)

            if (this.bot.compromisedModeActive) {
                // User wants the page to remain open for manual recovery. Do not proceed to tasks.
                keepBrowserOpen = true
                const reason = this.bot.compromisedReason || 'security-issue'
                this.bot.log(false, 'DESKTOP-FLOW', `Account security check failed (${reason}). Browser kept open for manual review: ${account.email}`, 'warn', 'yellow')
                
                try {
                    const { ConclusionWebhook } = await import('../util/ConclusionWebhook')
                    await ConclusionWebhook(
                        this.bot.config,
                        '🔐 Security Check',
                        `**Account:** ${account.email}\n**Status:** ${reason}\n**Action:** Browser kept open, activities paused`,
                        undefined,
                        0xFFAA00
                    )
                } catch {/* ignore */}
                
                // Save session for convenience, but do not close the browser
                try { 
                    await saveSessionData(this.bot.config.sessionPath, this.bot.homePage.context(), account.email, false) 
                } catch (e) {
                    this.bot.log(false, 'DESKTOP-FLOW', `Failed to save session: ${e instanceof Error ? e.message : String(e)}`, 'warn')
                }
                
                return { initialPoints: 0, collectedPoints: 0 }
            }

            await this.bot.browser.func.goHome(this.bot.homePage)

            const data = await this.bot.browser.func.getDashboardData()

            const initial = data.userStatus.availablePoints

            this.bot.log(false, 'DESKTOP-FLOW', `Current point count: ${initial}`)

            const browserEarnablePoints = await this.bot.browser.func.getBrowserEarnablePoints()

            // Tally all the desktop points
            const pointsCanCollect = browserEarnablePoints.dailySetPoints +
                browserEarnablePoints.desktopSearchPoints +
                browserEarnablePoints.morePromotionsPoints

            this.bot.log(false, 'DESKTOP-FLOW', `You can earn ${pointsCanCollect} points today`)

            if (pointsCanCollect === 0) {
                // Extra diagnostic breakdown so users know WHY it's zero
                this.bot.log(false, 'DESKTOP-FLOW', `Breakdown (desktop): dailySet=${browserEarnablePoints.dailySetPoints} search=${browserEarnablePoints.desktopSearchPoints} promotions=${browserEarnablePoints.morePromotionsPoints}`)
                this.bot.log(false, 'DESKTOP-FLOW', 'All desktop earnable buckets are zero. This usually means: tasks already completed today OR the daily reset has not happened yet for your time zone. If you still want to force run activities set execution.runOnZeroPoints=true in config.', 'log', 'yellow')
            }

            // If runOnZeroPoints is false and 0 points to earn, don't continue
            if (!this.bot.config.runOnZeroPoints && pointsCanCollect === 0) {
                this.bot.log(false, 'DESKTOP-FLOW', 'No points to earn and "runOnZeroPoints" is set to "false", stopping!', 'log', 'yellow')
                return { initialPoints: initial, collectedPoints: 0 }
            }

            // Open a new tab to where the tasks are going to be completed
            const workerPage = await browser.newPage()

            // Go to homepage on worker page
            await this.bot.browser.func.goHome(workerPage)

            // Complete daily set
            if (this.bot.config.workers.doDailySet) {
                const workers = (this.bot as unknown as { workers: { doDailySet: (page: Page, data: unknown) => Promise<void> } }).workers
                await workers.doDailySet(workerPage, data)
            }

            // Complete more promotions
            if (this.bot.config.workers.doMorePromotions) {
                const workers = (this.bot as unknown as { workers: { doMorePromotions: (page: Page, data: unknown) => Promise<void> } }).workers
                await workers.doMorePromotions(workerPage, data)
            }

            // Complete punch cards
            if (this.bot.config.workers.doPunchCards) {
                const workers = (this.bot as unknown as { workers: { doPunchCard: (page: Page, data: unknown) => Promise<void> } }).workers
                await workers.doPunchCard(workerPage, data)
            }

            // Do desktop searches
            if (this.bot.config.workers.doDesktopSearch) {
                await this.bot.activities.doSearch(workerPage, data)
            }

            // Fetch points BEFORE closing (avoid page closed reload error)
            const after = await this.bot.browser.func.getCurrentPoints().catch(() => initial)
            
            return {
                initialPoints: initial,
                collectedPoints: (after - initial) || 0
            }
        } finally {
            if (!keepBrowserOpen) {
                try {
                    await this.bot.browser.func.closeBrowser(browser, account.email)
                } catch (closeError) {
                    const message = closeError instanceof Error ? closeError.message : String(closeError)
                    this.bot.log(false, 'DESKTOP-FLOW', `Failed to close desktop context: ${message}`, 'warn')
                }
            }
        }
    }
}
