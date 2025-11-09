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

import type { MicrosoftRewardsBot } from '../index'
import type { Account } from '../interface/Account'
import { createBrowserInstance } from '../util/BrowserFactory'
import { MobileRetryTracker } from '../util/MobileRetryTracker'
import { handleCompromisedMode } from './FlowUtils'

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
     * 
     * Performs the following tasks in sequence:
     * 1. Mobile browser initialization with mobile user agent
     * 2. Microsoft account login
     * 3. OAuth token acquisition for mobile API access
     * 4. Daily check-in via mobile API
     * 5. Read to earn articles
     * 6. Mobile searches with retry logic
     * 
     * @param account Account to process (email, password, totp, proxy)
     * @param retryTracker Retry tracker for mobile search failures (auto-created if not provided)
     * @returns Promise resolving to points collected during mobile flow
     * @throws {Error} If critical operation fails (login, OAuth)
     * 
     * @example
     * ```typescript
     * const flow = new MobileFlow(bot)
     * const result = await flow.run(account)
     * // result.collectedPoints contains mobile points earned
     * ```
     */
    async run(
        account: Account,
        retryTracker = new MobileRetryTracker(this.bot.config.searchSettings.retryMobileSearchAmount)
    ): Promise<MobileFlowResult> {
        this.bot.log(true, 'MOBILE-FLOW', 'Starting mobile automation flow')
        
        // IMPROVED: Use centralized browser factory to eliminate duplication
        const browser = await createBrowserInstance(this.bot, account.proxy, account.email)
        
        let keepBrowserOpen = false
        let browserClosed = false
        
        try {
            this.bot.homePage = await browser.newPage()

            this.bot.log(true, 'MOBILE-FLOW', 'Browser started successfully')

            // Login into MS Rewards, then respect compromised mode
            await this.bot.login.login(this.bot.homePage, account.email, account.password, account.totp)
            
            if (this.bot.compromisedModeActive) {
                const reason = this.bot.compromisedReason || 'security-issue'
                const result = await handleCompromisedMode(this.bot, account.email, reason, true)
                keepBrowserOpen = result.keepBrowserOpen
                return { initialPoints: 0, collectedPoints: 0 }
            }
            
            const accessToken = await this.bot.login.getMobileAccessToken(this.bot.homePage, account.email, account.totp)
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
