/**
 * Browser Factory Utility
 * Eliminates code duplication between Desktop and Mobile flows
 * 
 * Centralized browser instance creation logic
 */

import type { BrowserContext } from 'rebrowser-playwright'
import type { MicrosoftRewardsBot } from '../index'
import type { AccountProxy } from '../interface/Account'

/**
 * Create a browser instance for the given account
 * IMPROVEMENT: Extracted from DesktopFlow and MobileFlow to eliminate duplication
 * 
 * @param bot Bot instance
 * @param proxy Account proxy configuration
 * @param email Account email for session naming
 * @returns Browser context ready to use
 * 
 * @example
 * const browser = await createBrowserInstance(bot, account.proxy, account.email)
 */
export async function createBrowserInstance(
    bot: MicrosoftRewardsBot, 
    proxy: AccountProxy, 
    email: string
): Promise<BrowserContext> {
    const browserModule = await import('../browser/Browser')
    const Browser = browserModule.default
    const browserInstance = new Browser(bot)
    return await browserInstance.createBrowser(proxy, email)
}
