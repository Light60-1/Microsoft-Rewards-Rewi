/**
 * Human Behavior Simulator for Account Creation
 * 
 * CRITICAL: Microsoft detects bots by analyzing:
 * 1. Typing speed (instant .fill() = bot, gradual .type() = human)
 * 2. Mouse movements (no movement = bot, random moves = human)
 * 3. Pauses (fixed delays = bot, variable pauses = human)
 * 4. Click patterns (force clicks = bot, natural clicks = human)
 * 
 * This module ensures account creation is INDISTINGUISHABLE from manual creation.
 */

import type { Page } from 'rebrowser-playwright'
import { log } from '../util/notifications/Logger'

export class HumanBehavior {
    private page: Page

    constructor(page: Page) {
        this.page = page
    }

    /**
     * Human-like delay with natural variance
     * Unlike fixed delays, humans vary greatly in timing
     * 
     * @param minMs Minimum delay
     * @param maxMs Maximum delay
     * @param context Description for logging (optional)
     */
    async humanDelay(minMs: number, maxMs: number, context?: string): Promise<void> {
        // IMPROVEMENT: Add occasional "thinking" pauses (10% chance of 2x delay)
        const shouldThink = Math.random() < 0.1
        const multiplier = shouldThink ? 2 : 1

        const delay = (Math.random() * (maxMs - minMs) + minMs) * multiplier

        if (shouldThink && context) {
            log(false, 'CREATOR', `[${context}] 🤔 Thinking pause (${Math.floor(delay)}ms)`, 'log', 'cyan')
        }

        await this.page.waitForTimeout(Math.floor(delay))
    }

    /**
     * CRITICAL: Type text naturally like a human
     * NEVER use .fill() - it's instant and detectable
     * 
     * @param locator Playwright locator (input field)
     * @param text Text to type
     * @param context Description for logging
     */
    async humanType(locator: import('rebrowser-playwright').Locator, text: string, context: string): Promise<void> {
        // CRITICAL: Clear field first (human would select all + delete)
        await locator.clear()
        await this.humanDelay(300, 800, context)

        // CRITICAL: Type character by character with VARIABLE delays
        // Real humans type at 40-80 WPM = ~150-300ms per character
        // But with natural variation: some characters faster, some slower

        log(false, 'CREATOR', `[${context}] ⌨️ Typing: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`, 'log', 'cyan')

        for (let i = 0; i < text.length; i++) {
            const char: string = text[i] as string

            // CRITICAL: Skip if char is somehow undefined (defensive programming)
            if (!char) continue

            // NATURAL VARIANCE:
            // - Fast keys: common letters (e, a, t, i, o, n) = 80-150ms
            // - Slow keys: numbers, symbols, shift combos = 200-400ms
            // - Occasional typos: 5% chance of longer pause (user correcting)

            let charDelay: number
            const isFastKey = /[eatino]/i.test(char)
            const isSlowKey = /[^a-z]/i.test(char) // Numbers, symbols, etc.
            const hasTyro = Math.random() < 0.05 // 5% typo simulation

            if (hasTyro) {
                charDelay = Math.random() * 400 + 300 // 300-700ms (correcting typo)
            } else if (isFastKey) {
                charDelay = Math.random() * 70 + 80 // 80-150ms
            } else if (isSlowKey) {
                charDelay = Math.random() * 200 + 200 // 200-400ms
            } else {
                charDelay = Math.random() * 100 + 120 // 120-220ms
            }

            await locator.type(char, { delay: 0 }) // Type instantly
            await this.page.waitForTimeout(Math.floor(charDelay))
        }

        log(false, 'CREATOR', `[${context}] ✅ Typing completed`, 'log', 'green')

        // IMPROVEMENT: Random pause after typing (human reviewing input)
        await this.humanDelay(500, 1500, context)
    }

    /**
     * CRITICAL: Simulate micro mouse movements and scrolls
     * Real humans constantly move mouse and scroll while reading/thinking
     * 
     * @param context Description for logging
     */
    async microGestures(context: string): Promise<void> {
        try {
            // 60% chance of mouse movement (humans move mouse A LOT)
            if (Math.random() < 0.6) {
                const x = Math.floor(Math.random() * 200) + 50 // Random x: 50-250px
                const y = Math.floor(Math.random() * 150) + 30 // Random y: 30-180px
                const steps = Math.floor(Math.random() * 5) + 3 // 3-8 steps (smooth movement)

                await this.page.mouse.move(x, y, { steps }).catch(() => {
                    // Mouse move failed - page may be closed or unavailable
                })

                // VERBOSE logging disabled - too noisy
                // log(false, 'CREATOR', `[${context}] 🖱️ Mouse moved to (${x}, ${y})`, 'log', 'gray')
            }

            // 30% chance of scroll (humans scroll to read content)
            if (Math.random() < 0.3) {
                const direction = Math.random() < 0.7 ? 1 : -1 // 70% down, 30% up
                const distance = Math.floor(Math.random() * 200) + 50 // 50-250px
                const dy = direction * distance

                await this.page.mouse.wheel(0, dy).catch(() => {
                    // Scroll failed - page may be closed or unavailable
                })

                // VERBOSE logging disabled - too noisy
                // log(false, 'CREATOR', `[${context}] 📜 Scrolled ${direction > 0 ? 'down' : 'up'} ${distance}px`, 'log', 'gray')
            }
        } catch {
            // Gesture execution failed - not critical for operation
        }
    }

    /**
     * CRITICAL: Natural click with human behavior
     * NEVER use { force: true } - it bypasses visibility checks (bot pattern)
     * 
     * @param locator Playwright locator (button/link)
     * @param context Description for logging
     * @param maxRetries Max click attempts (default: 3)
     * @returns true if click succeeded, false otherwise
     */
    async humanClick(
        locator: import('rebrowser-playwright').Locator,
        context: string,
        maxRetries: number = 3
    ): Promise<boolean> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // CRITICAL: Move mouse to element first (real humans do this)
                const box = await locator.boundingBox().catch(() => null)
                if (box) {
                    // Click at random position within element (not always center)
                    const offsetX = Math.random() * box.width * 0.6 + box.width * 0.2 // 20-80% of width
                    const offsetY = Math.random() * box.height * 0.6 + box.height * 0.2 // 20-80% of height

                    await this.page.mouse.move(
                        box.x + offsetX,
                        box.y + offsetY,
                        { steps: Math.floor(Math.random() * 3) + 2 } // 2-5 steps
                    ).catch(() => { })

                    await this.humanDelay(100, 300, context) // Pause before clicking
                }

                // NATURAL CLICK: No force (respects visibility/interactability)
                await locator.click({ force: false, timeout: 5000 })

                log(false, 'CREATOR', `[${context}] ✅ Clicked successfully`, 'log', 'green')
                await this.humanDelay(300, 800, context) // Pause after clicking
                return true

            } catch (error) {
                if (attempt < maxRetries) {
                    log(false, 'CREATOR', `[${context}] ⚠️ Click failed (attempt ${attempt}/${maxRetries}), retrying...`, 'warn', 'yellow')
                    await this.humanDelay(1000, 2000, context)
                } else {
                    const msg = error instanceof Error ? error.message : String(error)
                    log(false, 'CREATOR', `[${context}] ❌ Click failed after ${maxRetries} attempts: ${msg}`, 'error')
                    return false
                }
            }
        }

        return false
    }

    /**
     * CRITICAL: Simulate human "reading" the page
     * Real humans pause to read content before interacting
     * 
     * @param context Description for logging
     */
    async readPage(context: string): Promise<void> {
        log(false, 'CREATOR', `[${context}] 👀 Reading page...`, 'log', 'cyan')

        // Random scroll movements (humans scroll while reading)
        const scrollCount = Math.floor(Math.random() * 3) + 1 // 1-3 scrolls
        for (let i = 0; i < scrollCount; i++) {
            await this.microGestures(context)
            await this.humanDelay(800, 2000, context)
        }

        // Final reading pause
        await this.humanDelay(1500, 3500, context)
    }

    /**
     * CRITICAL: Simulate dropdown interaction (more complex than simple clicks)
     * Real humans: move mouse → hover → click → wait → select option
     * 
     * @param buttonLocator Dropdown button locator
     * @param optionLocator Option to select locator
     * @param context Description for logging
     * @returns true if interaction succeeded, false otherwise
     */
    async humanDropdownSelect(
        buttonLocator: import('rebrowser-playwright').Locator,
        optionLocator: import('rebrowser-playwright').Locator,
        context: string
    ): Promise<boolean> {
        // STEP 1: Click dropdown button (with human behavior)
        const openSuccess = await this.humanClick(buttonLocator, `${context}_OPEN`)
        if (!openSuccess) return false

        // STEP 2: Wait for dropdown to open (visual feedback)
        await this.humanDelay(500, 1200, context)

        // STEP 3: Move mouse randomly inside dropdown (human reading options)
        await this.microGestures(context)
        await this.humanDelay(300, 800, context)

        // STEP 4: Click selected option (with human behavior)
        const selectSuccess = await this.humanClick(optionLocator, `${context}_SELECT`)
        if (!selectSuccess) return false

        // STEP 5: Wait for dropdown to close
        await this.humanDelay(500, 1200, context)

        return true
    }
}
