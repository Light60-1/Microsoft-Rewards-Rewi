/**
 * Mobile Flow Module
 * Extracted from index.ts to improve maintainability and testability
 * 
 * Handles mobile browser automation:
 * - Login and session management
 * - OAuth token acquisition
 * - Daily check-in
 * - Read to earn
 * - Mobile searches
 * - Mobile retry logic
 */

import type { BrowserContext, Page } from 'playwright'
import type { MicrosoftRewardsBot } from '../index'
import type { Account } from '../interface/Account'
import { saveSessionData } from '../util/Load'
import { MobileRetryTracker } from '../util/MobileRetryTracker'

export interface MobileFlowResult {
    initialPoints: number
    collectedPoints: number
}

export class MobileFlow {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    /**
     * Execute the full mobile automation flow for an account
     * @param account Account to process
     * @param retryTracker Retry tracker for mobile search failures
     * @returns Points collected during the flow
     */
    async run(
        account: Account,
        retryTracker = new MobileRetryTracker(this.bot.config.searchSettings.retryMobileSearchAmount)
    ): Promise<MobileFlowResult> {
        this.bot.log(true, 'MOBILE-FLOW', 'Starting mobile automation flow')
        
        const browserFactory = (this.bot as unknown as { browserFactory: { createBrowser: (proxy: Account['proxy'], email: string) => Promise<BrowserContext> } }).browserFactory
        const browser = await browserFactory.createBrowser(account.proxy, account.email)
        
        let keepBrowserOpen = false
        let browserClosed = false
        
        try {
            this.bot.homePage = await browser.newPage()

            this.bot.log(true, 'MOBILE-FLOW', 'Browser started successfully')

            // Login into MS Rewards, then respect compromised mode
            const login = (this.bot as unknown as { login: { login: (page: Page, email: string, password: string, totp?: string) => Promise<void>; getMobileAccessToken: (page: Page, email: string, totp?: string) => Promise<string> } }).login
            await login.login(this.bot.homePage, account.email, account.password, account.totp)
            
            if (this.bot.compromisedModeActive) {
                keepBrowserOpen = true
                const reason = this.bot.compromisedReason || 'security-issue'
                this.bot.log(true, 'MOBILE-FLOW', `Mobile security check failed (${reason}). Browser kept open for manual review: ${account.email}`, 'warn', 'yellow')
                
                try {
                    const { ConclusionWebhook } = await import('../util/ConclusionWebhook')
                    await ConclusionWebhook(
                        this.bot.config,
                        '🔐 Security Check (Mobile)',
                        `**Account:** ${account.email}\n**Status:** ${reason}\n**Action:** Browser kept open, mobile activities paused`,
                        undefined,
                        0xFFAA00
                    )
                } catch {/* ignore */}
                
                try {
                    await saveSessionData(this.bot.config.sessionPath, this.bot.homePage.context(), account.email, true)
                } catch (e) {
                    this.bot.log(true, 'MOBILE-FLOW', `Failed to save session: ${e instanceof Error ? e.message : String(e)}`, 'warn')
                }
                
                return { initialPoints: 0, collectedPoints: 0 }
            }
            
            const accessToken = await login.getMobileAccessToken(this.bot.homePage, account.email, account.totp)
            await this.bot.browser.func.goHome(this.bot.homePage)

            const data = await this.bot.browser.func.getDashboardData()
            const initialPoints = data.userStatus.availablePoints || 0

            const browserEarnablePoints = await this.bot.browser.func.getBrowserEarnablePoints()
            const appEarnablePoints = await this.bot.browser.func.getAppEarnablePoints(accessToken)

            const pointsCanCollect = browserEarnablePoints.mobileSearchPoints + appEarnablePoints.totalEarnablePoints

            this.bot.log(true, 'MOBILE-FLOW', `You can earn ${pointsCanCollect} points today (Browser: ${browserEarnablePoints.mobileSearchPoints} points, App: ${appEarnablePoints.totalEarnablePoints} points)`)

            if (pointsCanCollect === 0) {
                this.bot.log(true, 'MOBILE-FLOW', `Breakdown (mobile): browserSearch=${browserEarnablePoints.mobileSearchPoints} appTotal=${appEarnablePoints.totalEarnablePoints}`)
                this.bot.log(true, 'MOBILE-FLOW', 'All mobile earnable buckets are zero. Causes: mobile searches already maxed, daily set finished, or daily rollover not reached yet. You can force execution by setting execution.runOnZeroPoints=true.', 'log', 'yellow')
            }

            // If runOnZeroPoints is false and 0 points to earn, don't continue
            if (!this.bot.config.runOnZeroPoints && pointsCanCollect === 0) {
                this.bot.log(true, 'MOBILE-FLOW', 'No points to earn and "runOnZeroPoints" is set to "false", stopping!', 'log', 'yellow')

                return {
                    initialPoints: initialPoints,
                    collectedPoints: 0
                }
            }
            
            // Do daily check in
            if (this.bot.config.workers.doDailyCheckIn) {
                await this.bot.activities.doDailyCheckIn(accessToken, data)
            }

            // Do read to earn
            if (this.bot.config.workers.doReadToEarn) {
                await this.bot.activities.doReadToEarn(accessToken, data)
            }

            // Do mobile searches
            const configuredRetries = Number(this.bot.config.searchSettings.retryMobileSearchAmount ?? 0)
            const maxMobileRetries = Number.isFinite(configuredRetries) ? configuredRetries : 0

            if (this.bot.config.workers.doMobileSearch) {
                // If no mobile searches data found, stop (Does not always exist on new accounts)
                if (data.userStatus.counters.mobileSearch) {
                    // Open a new tab to where the tasks are going to be completed
                    const workerPage = await browser.newPage()

                    // Go to homepage on worker page
                    await this.bot.browser.func.goHome(workerPage)

                    await this.bot.activities.doSearch(workerPage, data)

                    // Fetch current search points
                    const mobileSearchPoints = (await this.bot.browser.func.getSearchPoints()).mobileSearch?.[0]

                    if (mobileSearchPoints && (mobileSearchPoints.pointProgressMax - mobileSearchPoints.pointProgress) > 0) {
                        const shouldRetry = retryTracker.registerFailure()

                        if (!shouldRetry) {
                            const exhaustedAttempts = retryTracker.getAttemptCount()
                            this.bot.log(true, 'MOBILE-FLOW', `Max retry limit of ${maxMobileRetries} reached after ${exhaustedAttempts} attempt(s). Exiting retry loop`, 'warn')
                        } else {
                            const attempt = retryTracker.getAttemptCount()
                            this.bot.log(true, 'MOBILE-FLOW', `Attempt ${attempt}/${maxMobileRetries}: Unable to complete mobile searches, bad User-Agent? Increase search delay? Retrying...`, 'log', 'yellow')

                            // Close mobile browser before retrying to release resources
                            try {
                                await this.bot.browser.func.closeBrowser(browser, account.email)
                                browserClosed = true
                            } catch (closeError) {
                                const message = closeError instanceof Error ? closeError.message : String(closeError)
                                this.bot.log(true, 'MOBILE-FLOW', `Failed to close mobile context before retry: ${message}`, 'warn')
                            }

                            // Create a new browser and try again with the same tracker
                            return await this.run(account, retryTracker)
                        }
                    }
                } else {
                    this.bot.log(true, 'MOBILE-FLOW', 'Unable to fetch search points, your account is most likely too "new" for this! Try again later!', 'warn')
                }
            }

            const afterPointAmount = await this.bot.browser.func.getCurrentPoints()

            this.bot.log(true, 'MOBILE-FLOW', `The script collected ${afterPointAmount - initialPoints} points today`)

            return {
                initialPoints: initialPoints,
                collectedPoints: (afterPointAmount - initialPoints) || 0
            }
        } finally {
            if (!keepBrowserOpen && !browserClosed) {
                try {
                    await this.bot.browser.func.closeBrowser(browser, account.email)
                    browserClosed = true
                } catch (closeError) {
                    const message = closeError instanceof Error ? closeError.message : String(closeError)
                    this.bot.log(true, 'MOBILE-FLOW', `Failed to close mobile context: ${message}`, 'warn')
                }
            }
        }
    }
}
