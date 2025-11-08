/**
 * Buy Mode Handler Module
 * Extracted from index.ts to improve maintainability and testability
 * 
 * Handles automated Microsoft Store purchases:
 * - Browse available gift cards
 * - Select and purchase items
 * - Confirm transactions
 * - Track purchase history
 */

import type { BrowserContext, Page } from 'playwright'
import type { MicrosoftRewardsBot } from '../index'
import type { Account } from '../interface/Account'

export interface PurchaseResult {
    success: boolean
    itemName?: string
    pointsSpent?: number
    error?: string
}

export class BuyModeHandler {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    /**
     * Execute buy mode workflow
     * @param account Account to use for purchases
     * @returns Purchase result details
     */
    async execute(account: Account): Promise<PurchaseResult> {
        this.bot.log(true, 'BUY-MODE', 'Starting buy mode workflow')

        const browserFactory = (this.bot as unknown as { browserFactory: { createBrowser: (proxy: Account['proxy'], email: string) => Promise<BrowserContext> } }).browserFactory
        const browser = await browserFactory.createBrowser(account.proxy, account.email)

        try {
            this.bot.homePage = await browser.newPage()

            this.bot.log(true, 'BUY-MODE', 'Browser started successfully')

            // Login
            const login = (this.bot as unknown as { login: { login: (page: Page, email: string, password: string, totp?: string) => Promise<void> } }).login
            await login.login(this.bot.homePage, account.email, account.password, account.totp)

            if (this.bot.compromisedModeActive) {
                this.bot.log(true, 'BUY-MODE', 'Account security check failed. Buy mode cancelled for safety.', 'warn', 'red')
                return {
                    success: false,
                    error: 'Security check failed'
                }
            }

            // Navigate to rewards store
            this.bot.log(true, 'BUY-MODE', 'Navigating to Microsoft Rewards store...')
            await this.bot.homePage.goto('https://rewards.microsoft.com/redeem/shop', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            })

            await this.bot.homePage.waitForTimeout(3000)

            // Get current points balance
            const pointsBalance = await this.getCurrentPoints()
            this.bot.log(true, 'BUY-MODE', `Current points balance: ${pointsBalance}`)

            // Find available items
            const availableItems = await this.getAvailableItems(pointsBalance)

            if (availableItems.length === 0) {
                this.bot.log(true, 'BUY-MODE', 'No items available within points budget', 'warn', 'yellow')
                return {
                    success: false,
                    error: 'No items available'
                }
            }

            // Select first affordable item
            const selectedItem = availableItems[0]
            if (!selectedItem) {
                this.bot.log(true, 'BUY-MODE', 'No valid item found', 'warn', 'yellow')
                return {
                    success: false,
                    error: 'No valid item'
                }
            }

            this.bot.log(true, 'BUY-MODE', `Attempting to purchase: ${selectedItem.name} (${selectedItem.points} points)`)

            // Execute purchase
            const purchaseSuccess = await this.purchaseItem(selectedItem)

            if (purchaseSuccess) {
                this.bot.log(true, 'BUY-MODE', `✅ Successfully purchased: ${selectedItem.name}`, 'log', 'green')
                return {
                    success: true,
                    itemName: selectedItem.name,
                    pointsSpent: selectedItem.points
                }
            } else {
                this.bot.log(true, 'BUY-MODE', `❌ Failed to purchase: ${selectedItem.name}`, 'warn', 'red')
                return {
                    success: false,
                    error: 'Purchase confirmation failed'
                }
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            this.bot.log(true, 'BUY-MODE', `Error during buy mode: ${message}`, 'error', 'red')
            return {
                success: false,
                error: message
            }
        } finally {
            try {
                await this.bot.browser.func.closeBrowser(browser, account.email)
            } catch (closeError) {
                const message = closeError instanceof Error ? closeError.message : String(closeError)
                this.bot.log(true, 'BUY-MODE', `Failed to close browser: ${message}`, 'warn')
            }
        }
    }

    /**
     * Get current points balance from the page
     */
    private async getCurrentPoints(): Promise<number> {
        try {
            const pointsText = await this.bot.homePage?.locator('[data-bi-id="RewardsHeader.CurrentPointsText"]').textContent()
            if (pointsText) {
                const points = parseInt(pointsText.replace(/[^0-9]/g, ''), 10)
                return isNaN(points) ? 0 : points
            }
        } catch {
            this.bot.log(true, 'BUY-MODE', 'Could not retrieve points balance, defaulting to 0', 'warn')
        }
        return 0
    }

    /**
     * Get list of available items within budget
     */
    private async getAvailableItems(maxPoints: number): Promise<Array<{ name: string; points: number; selector: string }>> {
        const items: Array<{ name: string; points: number; selector: string }> = []

        try {
            const rewardCards = await this.bot.homePage?.locator('[data-bi-id^="RewardCard"]').all()

            if (!rewardCards || rewardCards.length === 0) {
                this.bot.log(true, 'BUY-MODE', 'No reward cards found on page', 'warn')
                return items
            }

            for (const card of rewardCards) {
                try {
                    const nameElement = await card.locator('.reward-card-title').textContent()
                    const pointsElement = await card.locator('.reward-card-points').textContent()

                    if (nameElement && pointsElement) {
                        const name = nameElement.trim()
                        const points = parseInt(pointsElement.replace(/[^0-9]/g, ''), 10)

                        if (!isNaN(points) && points <= maxPoints) {
                            items.push({
                                name,
                                points,
                                selector: `[data-bi-id="RewardCard"][data-title="${name}"]`
                            })
                        }
                    }
                } catch {
                    // Skip invalid cards
                    continue
                }
            }

            // Sort by points (cheapest first)
            items.sort((a, b) => a.points - b.points)

        } catch (error) {
            this.bot.log(true, 'BUY-MODE', `Error finding available items: ${error}`, 'warn')
        }

        return items
    }

    /**
     * Execute purchase for selected item
     */
    private async purchaseItem(item: { name: string; points: number; selector: string }): Promise<boolean> {
        try {
            // Click on item card
            await this.bot.homePage?.locator(item.selector).click()
            await this.bot.homePage?.waitForTimeout(2000)

            // Click redeem button
            const redeemButton = this.bot.homePage?.locator('[data-bi-id="RedeemButton"]')
            if (!redeemButton) {
                this.bot.log(true, 'BUY-MODE', 'Redeem button not found', 'warn')
                return false
            }

            await redeemButton.click()
            await this.bot.homePage?.waitForTimeout(2000)

            // Confirm purchase
            const confirmButton = this.bot.homePage?.locator('[data-bi-id="ConfirmRedeemButton"]')
            if (confirmButton) {
                await confirmButton.click()
                await this.bot.homePage?.waitForTimeout(3000)
            }

            // Check for success message
            const successMessage = await this.bot.homePage?.locator('[data-bi-id="RedeemSuccess"]').isVisible({ timeout: 5000 })

            return successMessage === true

        } catch (error) {
            this.bot.log(true, 'BUY-MODE', `Error during purchase: ${error}`, 'warn')
            return false
        }
    }
}
