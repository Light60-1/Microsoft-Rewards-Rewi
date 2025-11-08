import { AxiosRequestConfig } from 'axios'
import { CheerioAPI, load } from 'cheerio'
import { BrowserContext, Page } from 'rebrowser-playwright'

import { RETRY_LIMITS, SELECTORS, TIMEOUTS, URLS } from '../constants'
import { MicrosoftRewardsBot } from '../index'
import { AppUserData } from '../interface/AppUserData'
import { Counters, DashboardData, MorePromotion, PromotionalItem } from '../interface/DashboardData'
import { EarnablePoints } from '../interface/Points'
import { QuizData } from '../interface/QuizData'
import { saveSessionData } from '../util/Load'
import { logError } from '../util/Logger'


export default class BrowserFunc {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    /**
     * Check if account is suspended using multiple detection methods
     * @param page Playwright page
     * @param iteration Current iteration number for logging
     * @returns true if suspended, false otherwise
     */
    private async checkAccountSuspension(page: Page, iteration: number): Promise<boolean> {
        // Primary check: suspension header element
        const suspendedByHeader = await page.waitForSelector(SELECTORS.SUSPENDED_ACCOUNT, { state: 'visible', timeout: 500 })
            .then(() => true)
            .catch(() => false)
        
        if (suspendedByHeader) {
            this.bot.log(this.bot.isMobile, 'GO-HOME', `Account suspension detected by header selector (iteration ${iteration})`, 'error')
            return true
        }
        
        // Secondary check: look for suspension text in main content area only
        try {
            const mainContent = (await page.locator('#contentContainer, #main, .main-content').first().textContent({ timeout: 500 }).catch(() => '')) || ''
            const suspensionPatterns = [
                /account\s+has\s+been\s+suspended/i,
                /suspended\s+due\s+to\s+unusual\s+activity/i,
                /your\s+account\s+is\s+temporarily\s+suspended/i
            ]
            
            const isSuspended = suspensionPatterns.some(pattern => pattern.test(mainContent))
            if (isSuspended) {
                this.bot.log(this.bot.isMobile, 'GO-HOME', `Account suspension detected by content text (iteration ${iteration})`, 'error')
                return true
            }
        } catch (e) {
            // Ignore errors in text check - not critical
            this.bot.log(this.bot.isMobile, 'GO-HOME', `Suspension text check skipped: ${e}`, 'warn')
        }
        
        return false
    }


    /**
     * Navigate the provided page to rewards homepage
     * @param {Page} page Playwright page
    */
    async goHome(page: Page) {

        try {
            const dashboardURL = new URL(this.bot.config.baseURL)

            if (page.url() === dashboardURL.href) {
                return
            }

            await page.goto(this.bot.config.baseURL)

            for (let iteration = 1; iteration <= RETRY_LIMITS.GO_HOME_MAX; iteration++) {
                await this.bot.utils.wait(TIMEOUTS.LONG)
                await this.bot.browser.utils.tryDismissAllMessages(page)

                try {
                    // If activities are found, exit the loop (SUCCESS - account is OK)
                    await page.waitForSelector(SELECTORS.MORE_ACTIVITIES, { timeout: 1000 })
                    this.bot.log(this.bot.isMobile, 'GO-HOME', 'Visited homepage successfully')
                    break

                } catch (error) {
                    // Activities not found yet - check if it's because account is suspended
                    const isSuspended = await this.checkAccountSuspension(page, iteration)
                    if (isSuspended) {
                        throw new Error('Account has been suspended!')
                    }
                    
                    // Not suspended, just activities not loaded yet - continue to next iteration
                    this.bot.log(this.bot.isMobile, 'GO-HOME', `Activities not found yet (iteration ${iteration}/${RETRY_LIMITS.GO_HOME_MAX}), retrying...`, 'warn')
                }

                // Below runs if the homepage was unable to be visited
                const currentURL = new URL(page.url())

                if (currentURL.hostname !== dashboardURL.hostname) {
                    await this.bot.browser.utils.tryDismissAllMessages(page)

                    await this.bot.utils.wait(TIMEOUTS.MEDIUM_LONG)
                    await page.goto(this.bot.config.baseURL)
                } else {
                    this.bot.log(this.bot.isMobile, 'GO-HOME', 'Visited homepage successfully')
                    break
                }

                await this.bot.utils.wait(TIMEOUTS.VERY_LONG)
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            this.bot.log(this.bot.isMobile, 'GO-HOME', 'An error occurred: ' + errorMessage, 'error')
            throw error
        }
    }

    /**
     * Fetch user dashboard data
     * @returns {DashboardData} Object of user bing rewards dashboard data
    */
    async getDashboardData(page?: Page): Promise<DashboardData> {
        const target = page ?? this.bot.homePage
        const dashboardURL = new URL(this.bot.config.baseURL)
        const currentURL = new URL(target.url())

        try {
            // Should never happen since tasks are opened in a new tab!
            if (currentURL.hostname !== dashboardURL.hostname) {
                this.bot.log(this.bot.isMobile, 'DASHBOARD-DATA', 'Provided page did not equal dashboard page, redirecting to dashboard page')
                await this.goHome(target)
            }
            
            // Reload with retry
            await this.reloadPageWithRetry(target, 2)
            
            // Wait for the more-activities element to ensure page is fully loaded
            await target.waitForSelector(SELECTORS.MORE_ACTIVITIES, { timeout: TIMEOUTS.DASHBOARD_WAIT }).catch((error) => {
                // Continuing is intentional: page may still be functional even if this specific element is missing
                // The script extraction will catch any real issues
                this.bot.log(this.bot.isMobile, 'GET-DASHBOARD-DATA', `Activities element not found after ${TIMEOUTS.DASHBOARD_WAIT}ms timeout, attempting to proceed: ${error instanceof Error ? error.message : String(error)}`, 'warn')
            })

            let scriptContent = await this.extractDashboardScript(target)

            if (!scriptContent) {
                this.bot.log(this.bot.isMobile, 'GET-DASHBOARD-DATA', 'Dashboard script not found on first try, attempting recovery', 'warn')
                
                // Force a navigation retry once before failing hard
                await this.goHome(target)
                await target.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.VERY_LONG }).catch(logError('BROWSER-FUNC', 'Dashboard recovery load failed', this.bot.isMobile))
                await this.bot.utils.wait(this.bot.isMobile ? TIMEOUTS.LONG : TIMEOUTS.MEDIUM)
                
                scriptContent = await this.extractDashboardScript(target)
                
                if (!scriptContent) {
                    this.bot.log(this.bot.isMobile, 'GET-DASHBOARD-DATA', 'Dashboard data not found within script', 'error')
                    throw new Error('Dashboard data not found within script - check page structure')
                }
            }

            // Extract the dashboard object from the script content
            const dashboardData = await this.parseDashboardFromScript(target, scriptContent)

            if (!dashboardData) {
                this.bot.log(this.bot.isMobile, 'GET-DASHBOARD-DATA', 'Unable to parse dashboard script', 'error')
                throw new Error('Unable to parse dashboard script - inspect recent logs and page markup')
            }

            return dashboardData

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            this.bot.log(this.bot.isMobile, 'GET-DASHBOARD-DATA', `Error fetching dashboard data: ${errorMessage}`, 'error')
            throw error
        }

    }

    /**
     * Reload page with retry logic
     * FIXED: Added global timeout to prevent infinite retry loops
     */
    private async reloadPageWithRetry(page: Page, maxAttempts: number): Promise<void> {
        const startTime = Date.now()
        const MAX_TOTAL_TIME_MS = 30000 // 30 seconds max total
        let lastError: unknown = null
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Check global timeout
            if (Date.now() - startTime > MAX_TOTAL_TIME_MS) {
                this.bot.log(this.bot.isMobile, 'GET-DASHBOARD-DATA', `Reload retry exceeded total timeout (${MAX_TOTAL_TIME_MS}ms)`, 'warn')
                break
            }
            
            try {
                await page.reload({ waitUntil: 'domcontentloaded' })
                await this.bot.utils.wait(this.bot.isMobile ? TIMEOUTS.LONG : TIMEOUTS.MEDIUM)
                lastError = null
                break
            } catch (re) {
                lastError = re
                const msg = (re instanceof Error ? re.message : String(re))
                this.bot.log(this.bot.isMobile, 'GET-DASHBOARD-DATA', `Reload failed attempt ${attempt}: ${msg}`, 'warn')
                if (msg.includes('has been closed')) {
                    if (attempt === 1) {
                        this.bot.log(this.bot.isMobile, 'GET-DASHBOARD-DATA', 'Page appears closed; trying one navigation fallback', 'warn')
                        try { await this.goHome(page) } catch {/* ignore */}
                    } else {
                        break
                    }
                }
                if (attempt === maxAttempts) {
                    await this.bot.utils.wait(1000)
                }
            }
        }
        
        if (lastError) throw lastError
    }

    /**
     * Extract dashboard script from page
     */
    private async extractDashboardScript(page: Page): Promise<string | null> {
        return await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script'))
            const dashboardPatterns = ['var dashboard', 'dashboard=', 'dashboard :']
            
            const targetScript = scripts.find(script => {
                const text = script.innerText
                return text && dashboardPatterns.some(pattern => text.includes(pattern))
            })
            
            return targetScript?.innerText || null
        })
    }

    /**
     * Parse dashboard object from script content
     * FIXED: Added format validation before JSON.parse
     */
    private async parseDashboardFromScript(page: Page, scriptContent: string): Promise<DashboardData | null> {
        return await page.evaluate((scriptContent: string) => {
            const patterns = [
                /var\s+dashboard\s*=\s*(\{[\s\S]*?\});/,
                /dashboard\s*=\s*(\{[\s\S]*?\});/,
                /var\s+dashboard\s*:\s*(\{[\s\S]*?\})\s*[,;]/
            ]

            for (const regex of patterns) {
                const match = regex.exec(scriptContent)
                if (match && match[1]) {
                    try {
                        const jsonStr = match[1]
                        // Validate basic JSON structure before parsing
                        if (!jsonStr.trim().startsWith('{') || !jsonStr.trim().endsWith('}')) {
                            continue
                        }
                        const parsed = JSON.parse(jsonStr)
                        // Validate it's actually an object
                        if (typeof parsed !== 'object' || parsed === null) {
                            continue
                        }
                        return parsed
                    } catch (e) {
                        continue
                    }
                }
            }

            return null

        }, scriptContent)
    }

    /**
     * Get search point counters
     * @returns {Counters} Object of search counter data
    */
    async getSearchPoints(): Promise<Counters> {
        const dashboardData = await this.getDashboardData() // Always fetch newest data

        return dashboardData.userStatus.counters
    }

    /**
     * Get total earnable points with web browser
     * @returns {number} Total earnable points
    */
    async getBrowserEarnablePoints(): Promise<EarnablePoints> {
        try {
            let desktopSearchPoints = 0
            let mobileSearchPoints = 0
            let dailySetPoints = 0
            let morePromotionsPoints = 0

            const data = await this.getDashboardData()

            // Desktop Search Points
            if (data.userStatus.counters.pcSearch?.length) {
                data.userStatus.counters.pcSearch.forEach(x => desktopSearchPoints += (x.pointProgressMax - x.pointProgress))
            }

            // Mobile Search Points
            if (data.userStatus.counters.mobileSearch?.length) {
                data.userStatus.counters.mobileSearch.forEach(x => mobileSearchPoints += (x.pointProgressMax - x.pointProgress))
            }

            // Daily Set
            data.dailySetPromotions[this.bot.utils.getFormattedDate()]?.forEach(x => dailySetPoints += (x.pointProgressMax - x.pointProgress))

            // More Promotions
            if (data.morePromotions?.length) {
                data.morePromotions.forEach(x => {
                    // Only count points from supported activities
                    if (['quiz', 'urlreward'].includes(x.promotionType) && x.exclusiveLockedFeatureStatus !== 'locked') {
                        morePromotionsPoints += (x.pointProgressMax - x.pointProgress)
                    }
                })
            }

            const totalEarnablePoints = desktopSearchPoints + mobileSearchPoints + dailySetPoints + morePromotionsPoints

            return {
                dailySetPoints,
                morePromotionsPoints,
                desktopSearchPoints,
                mobileSearchPoints,
                totalEarnablePoints
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            this.bot.log(this.bot.isMobile, 'GET-BROWSER-EARNABLE-POINTS', 'An error occurred: ' + errorMessage, 'error')
            throw error
        }
    }

    /**
     * Get total earnable points with mobile app
     * @returns {number} Total earnable points
    */
    async getAppEarnablePoints(accessToken: string) {
        try {
            const points = {
                readToEarn: 0,
                checkIn: 0,
                totalEarnablePoints: 0
            }

            const eligibleOffers = [
                'ENUS_readarticle3_30points',
                'Gamification_Sapphire_DailyCheckIn'
            ]

            const data = await this.getDashboardData()
            // Guard against missing profile/attributes and undefined settings
            let geoLocale = data?.userProfile?.attributes?.country || 'US'
            const useGeo = !!(this.bot?.config?.searchSettings?.useGeoLocaleQueries)
            geoLocale = (useGeo && typeof geoLocale === 'string' && geoLocale.length === 2)
                ? geoLocale.toLowerCase()
                : 'us'

            const userDataRequest: AxiosRequestConfig = {
                url: URLS.APP_USER_DATA,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Rewards-Country': geoLocale,
                    'X-Rewards-Language': 'en'
                }
            }

            const userDataResponse: AppUserData = (await this.bot.axios.request(userDataRequest)).data
            const userData = userDataResponse.response
            const eligibleActivities = userData.promotions.filter((x) => eligibleOffers.includes(x.attributes.offerid ?? ''))

            for (const item of eligibleActivities) {
                if (item.attributes.type === 'msnreadearn') {
                    points.readToEarn = parseInt(item.attributes.pointmax ?? '', 10) - parseInt(item.attributes.pointprogress ?? '', 10)
                    break
                } else if (item.attributes.type === 'checkin') {
                    const checkInDay = parseInt(item.attributes.progress ?? '', 10) % 7
                    const today = new Date()
                    const lastUpdated = new Date(item.attributes.last_updated ?? '')
                    
                    if (checkInDay < 6 && today.getDate() !== lastUpdated.getDate()) {
                        points.checkIn = parseInt(item.attributes['day_' + (checkInDay + 1) + '_points'] ?? '', 10)
                    }
                    break
                }
            }

            points.totalEarnablePoints = points.readToEarn + points.checkIn

            return points
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            this.bot.log(this.bot.isMobile, 'GET-APP-EARNABLE-POINTS', 'An error occurred: ' + errorMessage, 'error')
            throw error
        }
    }

    /**
     * Get current point amount
     * @returns {number} Current total point amount
    */
    async getCurrentPoints(): Promise<number> {
        try {
            const data = await this.getDashboardData()

            return data.userStatus.availablePoints
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            this.bot.log(this.bot.isMobile, 'GET-CURRENT-POINTS', 'An error occurred: ' + errorMessage, 'error')
            throw error
        }
    }

    /**
     * Parse quiz data from provided page
     * @param {Page} page Playwright page
     * @returns {QuizData} Quiz data object
    */
    async getQuizData(page: Page): Promise<QuizData> {
        try {
            // Wait for page to be fully loaded
            await page.waitForLoadState('domcontentloaded')
            await this.bot.utils.wait(TIMEOUTS.MEDIUM)

            const html = await page.content()
            const $ = load(html)

            // Try multiple possible variable names
            const possibleVariables = [
                '_w.rewardsQuizRenderInfo',
                'rewardsQuizRenderInfo',
                '_w.quizRenderInfo',
                'quizRenderInfo'
            ]

            let scriptContent = ''
            let foundVariable = ''

            for (const varName of possibleVariables) {
                scriptContent = $('script')
                    .toArray()
                    .map(el => $(el).text())
                    .find(t => t.includes(varName)) || ''

                if (scriptContent) {
                    foundVariable = varName
                    break
                }
            }

            if (scriptContent && foundVariable) {
                // Escape dots in variable name for regex
                const escapedVar = foundVariable.replace(/\./g, '\\.')
                const regex = new RegExp(`${escapedVar}\\s*=\\s*({.*?});`, 's')
                const match = regex.exec(scriptContent)

                if (match && match[1]) {
                    const quizData = JSON.parse(match[1])
                    this.bot.log(this.bot.isMobile, 'GET-QUIZ-DATA', `Found quiz data using variable: ${foundVariable}`, 'log')
                    return quizData
                } else {
                    this.bot.log(this.bot.isMobile, 'GET-QUIZ-DATA', `Variable ${foundVariable} found but could not extract JSON data`, 'error')
                    throw new Error(`Quiz data variable ${foundVariable} found but JSON extraction failed`)
                }
            } else {
                // Log available scripts for debugging
                const allScripts = $('script')
                    .toArray()
                    .map(el => $(el).text())
                    .filter(t => t.length > 0)
                    .map(t => t.substring(0, 100))
                
                this.bot.log(this.bot.isMobile, 'GET-QUIZ-DATA', `Script not found. Tried variables: ${possibleVariables.join(', ')}`, 'error')
                this.bot.log(this.bot.isMobile, 'GET-QUIZ-DATA', `Found ${allScripts.length} scripts on page`, 'warn')
                
                this.bot.log(this.bot.isMobile, 'GET-QUIZ-DATA', 'Script containing quiz data not found', 'error')
                throw new Error('Script containing quiz data not found - check page structure')
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            this.bot.log(this.bot.isMobile, 'GET-QUIZ-DATA', 'An error occurred: ' + errorMessage, 'error')
            throw error
        }

    }

    async waitForQuizRefresh(page: Page): Promise<boolean> {
        try {
            await page.waitForSelector(SELECTORS.QUIZ_CREDITS, { state: 'visible', timeout: TIMEOUTS.DASHBOARD_WAIT })
            await this.bot.utils.wait(TIMEOUTS.MEDIUM_LONG)

            return true
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'QUIZ-REFRESH', 'An error occurred:' + error, 'error')
            return false
        }
    }

    async checkQuizCompleted(page: Page): Promise<boolean> {
        try {
            await page.waitForSelector(SELECTORS.QUIZ_COMPLETE, { state: 'visible', timeout: TIMEOUTS.MEDIUM_LONG })
            await this.bot.utils.wait(TIMEOUTS.MEDIUM_LONG)

            return true
        } catch (error) {
            return false
        }
    }

    async loadInCheerio(page: Page): Promise<CheerioAPI> {
        const html = await page.content()
        const $ = load(html)

        return $
    }

    async getPunchCardActivity(page: Page, activity: PromotionalItem | MorePromotion): Promise<string> {
        let selector = ''
        try {
            const html = await page.content()
            const $ = load(html)

                const element = $('.offer-cta').toArray().find((x: unknown) => {
                    const el = x as { attribs?: { href?: string } }
                    return !!el.attribs?.href?.includes(activity.offerId)
                })
            if (element) {
                selector = `a[href*="${element.attribs.href}"]`
            }
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'GET-PUNCHCARD-ACTIVITY', 'An error occurred:' + error, 'error')
        }

        return selector
    }

    async closeBrowser(browser: BrowserContext, email: string) {
        try {
            // Save cookies
            await saveSessionData(this.bot.config.sessionPath, browser, email, this.bot.isMobile)

            await this.bot.utils.wait(TIMEOUTS.MEDIUM_LONG)

            // Close browser
            await browser.close()
            this.bot.log(this.bot.isMobile, 'CLOSE-BROWSER', 'Browser closed cleanly!')
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            this.bot.log(this.bot.isMobile, 'CLOSE-BROWSER', 'An error occurred: ' + errorMessage, 'error')
            throw error
        }
    }
}