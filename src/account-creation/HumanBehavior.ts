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

        // IMPROVED: Generate per-session typing personality (consistent across field)
        const typingSpeed = 0.7 + Math.random() * 0.6 // 0.7-1.3x speed multiplier
        const errorRate = Math.random() * 0.08 // 0-8% error rate
        const burstTyping = Math.random() < 0.3 // 30% chance of burst typing

        for (let i = 0; i < text.length; i++) {
            const char: string = text[i] as string

            // CRITICAL: Skip if char is somehow undefined (defensive programming)
            if (!char) continue

            // IMPROVED: More realistic variance based on typing personality
            let charDelay: number
            const isFastKey = /[eatino]/i.test(char)
            const isSlowKey = /[^a-z]/i.test(char) // Numbers, symbols, etc.
            const hasTypo = Math.random() < errorRate // Dynamic typo rate
            const isBurst = burstTyping && i > 0 && Math.random() < 0.4 // Burst typing pattern

            if (hasTypo) {
                // Typo: pause, backspace, retype
                charDelay = Math.random() * 500 + 400 // 400-900ms (correcting)
                log(false, 'CREATOR', `[${context}] 🔄 Typo correction simulation`, 'log', 'gray')
            } else if (isBurst) {
                // Burst typing: very fast
                charDelay = (Math.random() * 50 + 40) * typingSpeed // 40-90ms * speed
            } else if (isFastKey) {
                charDelay = (Math.random() * 80 + 70) * typingSpeed // 70-150ms * speed
            } else if (isSlowKey) {
                charDelay = (Math.random() * 250 + 180) * typingSpeed // 180-430ms * speed
            } else {
                charDelay = (Math.random() * 120 + 100) * typingSpeed // 100-220ms * speed
            }

            // IMPROVED: Random micro-pauses (thinking)
            if (Math.random() < 0.05 && i > 0) {
                const thinkPause = Math.random() * 800 + 500 // 500-1300ms
                await this.page.waitForTimeout(Math.floor(thinkPause))
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
     * IMPROVED: Natural variance per session (not every gesture is identical)
     * 
     * @param context Description for logging
     */
    async microGestures(context: string): Promise<void> {
        try {
            const gestureNotes: string[] = []

            // IMPROVED: Variable mouse movement probability (not always 60%)
            const mouseMoveProb = 0.45 + Math.random() * 0.3 // 45-75% chance

            if (Math.random() < mouseMoveProb) {
                // IMPROVED: Wider movement range (more natural)
                const x = Math.floor(Math.random() * 400) + 30 // Random x: 30-430px
                const y = Math.floor(Math.random() * 300) + 20 // Random y: 20-320px
                const steps = Math.floor(Math.random() * 8) + 2 // 2-10 steps (variable smoothness)

                await this.page.mouse.move(x, y, { steps }).catch(() => {
                    // Mouse move failed - page may be closed or unavailable
                })

                gestureNotes.push(`mouse→(${x},${y})`)

                // IMPROVED: Sometimes double-move (human overshoots then corrects)
                if (Math.random() < 0.15) {
                    await this.humanDelay(100, 300, context)
                    const x2 = x + (Math.random() * 40 - 20) // ±20px correction
                    const y2 = y + (Math.random() * 40 - 20)
                    await this.page.mouse.move(x2, y2, { steps: 2 }).catch(() => { })
                    gestureNotes.push(`correct→(${x2},${y2})`)
                }
            }

            // IMPROVED: Variable scroll probability (not always 30%)
            const scrollProb = 0.2 + Math.random() * 0.25 // 20-45% chance

            if (Math.random() < scrollProb) {
                const direction = Math.random() < 0.65 ? 1 : -1 // 65% down, 35% up
                const distance = Math.floor(Math.random() * 300) + 40 // 40-340px (more variance)
                const dy = direction * distance

                await this.page.mouse.wheel(0, dy).catch(() => {
                    // Scroll failed - page may be closed or unavailable
                })

                gestureNotes.push(`scroll ${direction > 0 ? '↓' : '↑'} ${distance}px`)
            }

            // IMPROVED: Sometimes NO gesture at all (humans sometimes just stare)
            // Already handled by caller's random probability

            if (gestureNotes.length > 0) {
                log(false, 'CREATOR', `[${context}] ${gestureNotes.join(', ')}`, 'log', 'gray')
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
