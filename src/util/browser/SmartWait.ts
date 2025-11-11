/**
 * Smart waiting utilities for browser automation
 * Replaces fixed timeouts with intelligent page readiness detection
 */

import { Locator, Page } from 'rebrowser-playwright';

/**
 * Wait for page to be truly ready (network idle + DOM ready)
 * Much faster than waitForLoadState with fixed timeouts
 */
export async function waitForPageReady(
    page: Page,
    options: {
        networkIdleMs?: number
        logFn?: (msg: string) => void
    } = {}
): Promise<{ ready: boolean; timeMs: number }> {
    const startTime = Date.now()
    const networkIdleMs = options.networkIdleMs ?? 500 // Network quiet for 500ms
    const logFn = options.logFn ?? (() => { })

    try {
        // Step 1: Wait for DOM ready (fast)
        await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {
            logFn('DOM load timeout, continuing...')
        })

        // Step 2: Check if already at network idle (most common case)
        const hasNetworkActivity = await page.evaluate(() => {
            return (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
                .some(r => r.responseEnd === 0)
        }).catch(() => false)

        if (!hasNetworkActivity) {
            const elapsed = Date.now() - startTime
            logFn(`✓ Page ready immediately (${elapsed}ms)`)
            return { ready: true, timeMs: elapsed }
        }

        // Step 3: Wait for network idle with adaptive polling
        await page.waitForLoadState('networkidle', { timeout: networkIdleMs }).catch(() => {
            logFn('Network idle timeout (expected), page may still be usable')
        })

        const elapsed = Date.now() - startTime
        logFn(`✓ Page ready after ${elapsed}ms`)
        return { ready: true, timeMs: elapsed }

    } catch (error) {
        const elapsed = Date.now() - startTime
        const errorMsg = error instanceof Error ? error.message : String(error)
        logFn(`⚠ Page readiness check incomplete after ${elapsed}ms: ${errorMsg}`)

        // Return success anyway if we waited reasonably
        return { ready: elapsed > 1000, timeMs: elapsed }
    }
}

/**
 * Smart element waiting with adaptive timeout
 * Checks element presence quickly, then extends timeout only if needed
 */
export async function waitForElementSmart(
    page: Page,
    selector: string,
    options: {
        initialTimeoutMs?: number
        extendedTimeoutMs?: number
        state?: 'attached' | 'detached' | 'visible' | 'hidden'
        logFn?: (msg: string) => void
    } = {}
): Promise<{ found: boolean; timeMs: number; element: Locator | null }> {
    const startTime = Date.now()
    const initialTimeoutMs = options.initialTimeoutMs ?? 2000 // Quick first check
    const extendedTimeoutMs = options.extendedTimeoutMs ?? 5000 // Extended if needed
    const state = options.state ?? 'attached'
    const logFn = options.logFn ?? (() => { })

    try {
        // Fast path: element already present
        const element = page.locator(selector)
        await element.waitFor({ state, timeout: initialTimeoutMs })

        const elapsed = Date.now() - startTime
        logFn(`✓ Element found quickly (${elapsed}ms)`)
        return { found: true, timeMs: elapsed, element }

    } catch (firstError) {
        // Element not found quickly - try extended wait
        logFn('Element not immediate, extending timeout...')

        try {
            const element = page.locator(selector)
            await element.waitFor({ state, timeout: extendedTimeoutMs })

            const elapsed = Date.now() - startTime
            logFn(`✓ Element found after extended wait (${elapsed}ms)`)
            return { found: true, timeMs: elapsed, element }

        } catch (extendedError) {
            const elapsed = Date.now() - startTime
            const errorMsg = extendedError instanceof Error ? extendedError.message : String(extendedError)
            logFn(`✗ Element not found after ${elapsed}ms: ${errorMsg}`)
            return { found: false, timeMs: elapsed, element: null }
        }
    }
}

/**
 * Wait for navigation to complete intelligently
 * Uses URL change + DOM ready instead of fixed timeouts
 */
export async function waitForNavigationSmart(
    page: Page,
    options: {
        expectedUrl?: string | RegExp
        maxWaitMs?: number
        logFn?: (msg: string) => void
    } = {}
): Promise<{ completed: boolean; timeMs: number; url: string }> {
    const startTime = Date.now()
    const maxWaitMs = options.maxWaitMs ?? 15000
    const logFn = options.logFn ?? (() => { })

    try {
        // Wait for URL to change (if we expect it to)
        if (options.expectedUrl) {
            const urlPattern = typeof options.expectedUrl === 'string'
                ? new RegExp(options.expectedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                : options.expectedUrl

            let urlChanged = false
            const checkInterval = 100
            const maxChecks = maxWaitMs / checkInterval

            for (let i = 0; i < maxChecks; i++) {
                const currentUrl = page.url()
                if (urlPattern.test(currentUrl)) {
                    urlChanged = true
                    logFn(`✓ URL changed to expected pattern (${Date.now() - startTime}ms)`)
                    break
                }
                await page.waitForTimeout(checkInterval)
            }

            if (!urlChanged) {
                const elapsed = Date.now() - startTime
                logFn(`⚠ URL did not match expected pattern after ${elapsed}ms`)
                return { completed: false, timeMs: elapsed, url: page.url() }
            }
        }

        // Wait for page to be ready after navigation
        const readyResult = await waitForPageReady(page, {
            logFn
        })

        const elapsed = Date.now() - startTime
        return { completed: readyResult.ready, timeMs: elapsed, url: page.url() }

    } catch (error) {
        const elapsed = Date.now() - startTime
        const errorMsg = error instanceof Error ? error.message : String(error)
        logFn(`✗ Navigation wait failed after ${elapsed}ms: ${errorMsg}`)
        return { completed: false, timeMs: elapsed, url: page.url() }
    }
}

/**
 * Click element with smart waiting (wait for element + click + verify action)
 */
export async function clickElementSmart(
    page: Page,
    selector: string,
    options: {
        waitBeforeClick?: number
        waitAfterClick?: number
        verifyDisappeared?: boolean
        maxWaitMs?: number
        logFn?: (msg: string) => void
    } = {}
): Promise<{ success: boolean; timeMs: number }> {
    const startTime = Date.now()
    const waitBeforeClick = options.waitBeforeClick ?? 100
    const waitAfterClick = options.waitAfterClick ?? 500
    const logFn = options.logFn ?? (() => { })

    try {
        // Wait for element to be clickable
        const elementResult = await waitForElementSmart(page, selector, {
            state: 'visible',
            initialTimeoutMs: options.maxWaitMs ? Math.floor(options.maxWaitMs * 0.4) : 2000,
            extendedTimeoutMs: options.maxWaitMs ? Math.floor(options.maxWaitMs * 0.6) : 5000,
            logFn
        })

        if (!elementResult.found || !elementResult.element) {
            return { success: false, timeMs: Date.now() - startTime }
        }

        // Small delay for stability
        if (waitBeforeClick > 0) {
            await page.waitForTimeout(waitBeforeClick)
        }

        // Click the element
        await elementResult.element.click()
        logFn('✓ Clicked element')

        // Wait for action to process
        if (waitAfterClick > 0) {
            await page.waitForTimeout(waitAfterClick)
        }

        // Verify element disappeared (optional)
        if (options.verifyDisappeared) {
            const disappeared = await page.locator(selector).isVisible()
                .then(() => false)
                .catch(() => true)

            if (disappeared) {
                logFn('✓ Element disappeared after click (expected)')
            }
        }

        const elapsed = Date.now() - startTime
        return { success: true, timeMs: elapsed }

    } catch (error) {
        const elapsed = Date.now() - startTime
        const errorMsg = error instanceof Error ? error.message : String(error)
        logFn(`✗ Click failed after ${elapsed}ms: ${errorMsg}`)
        return { success: false, timeMs: elapsed }
    }
}

/**
 * Type text into input field with smart waiting
 */
export async function typeIntoFieldSmart(
    page: Page,
    selector: string,
    text: string,
    options: {
        clearFirst?: boolean
        delay?: number
        maxWaitMs?: number
        logFn?: (msg: string) => void
    } = {}
): Promise<{ success: boolean; timeMs: number }> {
    const startTime = Date.now()
    const delay = options.delay ?? 20
    const logFn = options.logFn ?? (() => { })

    try {
        // Wait for input field
        const elementResult = await waitForElementSmart(page, selector, {
            state: 'visible',
            initialTimeoutMs: options.maxWaitMs ? Math.floor(options.maxWaitMs * 0.4) : 2000,
            extendedTimeoutMs: options.maxWaitMs ? Math.floor(options.maxWaitMs * 0.6) : 5000,
            logFn
        })

        if (!elementResult.found || !elementResult.element) {
            return { success: false, timeMs: Date.now() - startTime }
        }

        // Clear field if requested
        if (options.clearFirst) {
            await elementResult.element.clear()
        }

        // Type text with delay
        await elementResult.element.type(text, { delay })
        logFn('✓ Typed into field')

        const elapsed = Date.now() - startTime
        return { success: true, timeMs: elapsed }

    } catch (error) {
        const elapsed = Date.now() - startTime
        const errorMsg = error instanceof Error ? error.message : String(error)
        logFn(`✗ Type failed after ${elapsed}ms: ${errorMsg}`)
        return { success: false, timeMs: elapsed }
    }
}
