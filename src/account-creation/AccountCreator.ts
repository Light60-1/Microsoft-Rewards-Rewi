import fs from 'fs'
import path from 'path'
import * as readline from 'readline'
import type { BrowserContext, Page } from 'rebrowser-playwright'
import { log } from '../util/Logger'
import { DataGenerator } from './DataGenerator'
import { CreatedAccount } from './types'

export class AccountCreator {
  private page!: Page
  private dataGenerator: DataGenerator
  private referralUrl?: string
  private rl: readline.Interface
  private rlClosed = false

  constructor(referralUrl?: string) {
    this.referralUrl = referralUrl
    this.dataGenerator = new DataGenerator()
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    this.rlClosed = false
  }

  // Human-like delay helper
  private async humanDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.random() * (maxMs - minMs) + minMs
    await this.page.waitForTimeout(Math.floor(delay))
  }

  private async askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim())
      })
    })
  }

  /**
   * CRITICAL: Wait for page to be completely stable before continuing
   * Checks for loading spinners, network activity, and URL stability
   */
  private async waitForPageStable(context: string, maxWaitMs: number = 30000): Promise<boolean> {
    log(false, 'CREATOR', `[${context}] Waiting for page to be stable...`, 'log', 'cyan')
    
    const startTime = Date.now()
    const startUrl = this.page.url()
    
    try {
      // Wait for network to be idle
      await this.page.waitForLoadState('networkidle', { timeout: maxWaitMs })
      log(false, 'CREATOR', `[${context}] ✅ Network idle`, 'log', 'green')
      
      // Additional delay to ensure everything is rendered
      await this.humanDelay(2000, 3000)
      
      // Check for loading indicators
      const loadingSelectors = [
        '.loading',
        '[class*="spinner"]',
        '[class*="loading"]',
        '[aria-busy="true"]',
        'div:has-text("Loading")',
        'div:has-text("Chargement")',
        'div:has-text("Please wait")',
        'div:has-text("Veuillez patienter")',
        'div:has-text("Creating")',
        'div:has-text("Création")'
      ]
      
      // Wait for all loading indicators to disappear
      for (const selector of loadingSelectors) {
        const element = this.page.locator(selector).first()
        const visible = await element.isVisible().catch(() => false)
        
        if (visible) {
          log(false, 'CREATOR', `[${context}] Loading indicator detected: ${selector}`, 'log', 'yellow')
          
          try {
            await element.waitFor({ state: 'hidden', timeout: maxWaitMs - (Date.now() - startTime) })
            log(false, 'CREATOR', `[${context}] ✅ Loading indicator gone`, 'log', 'green')
          } catch {
            log(false, 'CREATOR', `[${context}] ⚠️ Loading indicator still present`, 'warn', 'yellow')
          }
        }
      }
      
      // Verify URL hasn't changed during wait (unless we expect it to)
      const endUrl = this.page.url()
      if (startUrl !== endUrl) {
        log(false, 'CREATOR', `[${context}] URL changed: ${startUrl} → ${endUrl}`, 'log', 'yellow')
      }
      
      const elapsed = Date.now() - startTime
      log(false, 'CREATOR', `[${context}] ✅ Page is stable (waited ${elapsed}ms)`, 'log', 'green')
      
      return true
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log(false, 'CREATOR', `[${context}] ⚠️ Page stability check failed: ${msg}`, 'warn', 'yellow')
      return false
    }
  }

  /**
   * CRITICAL: Wait for Microsoft account creation to complete
   * This happens AFTER CAPTCHA and can take several seconds
   */
  private async waitForAccountCreation(): Promise<boolean> {
    log(false, 'CREATOR', '⏳ Waiting for Microsoft to create the account...', 'log', 'cyan')
    
    const maxWaitTime = 60000 // 60 seconds
    const startTime = Date.now()
    
    try {
      // STEP 1: Wait for any "Creating account" messages to appear AND disappear
      const creationMessages = [
        'text="Creating your account"',
        'text="Création de votre compte"',
        'text="Setting up your account"',
        'text="Configuration de votre compte"',
        'text="Please wait"',
        'text="Veuillez patienter"'
      ]
      
      for (const messageSelector of creationMessages) {
        const element = this.page.locator(messageSelector).first()
        const visible = await element.isVisible().catch(() => false)
        
        if (visible) {
          log(false, 'CREATOR', `Account creation message detected: "${messageSelector}"`, 'log', 'yellow')
          
          // Wait for this message to disappear
          try {
            await element.waitFor({ state: 'hidden', timeout: 45000 })
            log(false, 'CREATOR', '✅ Account creation message gone', 'log', 'green')
          } catch {
            log(false, 'CREATOR', '⚠️ Creation message still present after 45s', 'warn', 'yellow')
          }
        }
      }
      
      // STEP 2: Wait for URL to stabilize or change to expected page
      log(false, 'CREATOR', 'Waiting for navigation to complete...', 'log', 'cyan')
      
      let urlStableCount = 0
      let lastUrl = this.page.url()
      
      while (Date.now() - startTime < maxWaitTime) {
        await this.humanDelay(1000, 1500)
        
        const currentUrl = this.page.url()
        
        if (currentUrl === lastUrl) {
          urlStableCount++
          
          // URL has been stable for 3 consecutive checks
          if (urlStableCount >= 3) {
            log(false, 'CREATOR', `✅ URL stable at: ${currentUrl}`, 'log', 'green')
            break
          }
        } else {
          log(false, 'CREATOR', `URL changed: ${lastUrl} → ${currentUrl}`, 'log', 'yellow')
          lastUrl = currentUrl
          urlStableCount = 0
        }
      }
      
      // STEP 3: Wait for page to be fully loaded
      await this.waitForPageStable('ACCOUNT_CREATION', 15000)
      
      // STEP 4: Additional safety delay
      await this.humanDelay(3000, 5000)
      
      const elapsed = Date.now() - startTime
      log(false, 'CREATOR', `✅ Account creation complete (waited ${elapsed}ms)`, 'log', 'green')
      
      return true
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log(false, 'CREATOR', `⚠️ Account creation wait failed: ${msg}`, 'warn', 'yellow')
      return false
    }
  }

  /**
   * CRITICAL: Verify that an element exists, is visible, and is interactable
   */
  private async verifyElementReady(
    selector: string, 
    context: string, 
    timeoutMs: number = 10000
  ): Promise<boolean> {
    try {
      const element = this.page.locator(selector).first()
      
      // Wait for element to exist
      await element.waitFor({ timeout: timeoutMs, state: 'attached' })
      
      // Wait for element to be visible
      await element.waitFor({ timeout: 5000, state: 'visible' })
      
      // Check if element is enabled (for buttons/inputs)
      const isEnabled = await element.isEnabled().catch(() => true)
      
      if (!isEnabled) {
        log(false, 'CREATOR', `[${context}] Element found but disabled: ${selector}`, 'warn', 'yellow')
        return false
      }
      
      log(false, 'CREATOR', `[${context}] ✅ Element ready: ${selector}`, 'log', 'green')
      return true
      
    } catch (error) {
      log(false, 'CREATOR', `[${context}] Element not ready: ${selector}`, 'warn', 'yellow')
      return false
    }
  }

  async create(context: BrowserContext): Promise<CreatedAccount | null> {
    try {
      this.page = await context.newPage()

      log(false, 'CREATOR', 'Starting account creation process...', 'log', 'cyan')

      // Navigate to signup page
      await this.navigateToSignup()

      // Click "Create account" button
      await this.clickCreateAccount()

      // Generate email and fill it (handles suggestions automatically)
      const emailResult = await this.generateAndFillEmail()
      if (!emailResult) {
        log(false, 'CREATOR', 'Failed to configure email', 'error')
        return null
      }

      log(false, 'CREATOR', `Email accepted: ${emailResult}`, 'log', 'green')

      // Wait for password page and fill it
      const password = await this.fillPassword()
      if (!password) {
        log(false, 'CREATOR', 'Failed to generate password', 'error')
        return null
      }

      // Click Next button
      await this.clickNext('password')

      // Extract final email from identity badge to confirm
      const finalEmail = await this.extractEmail()
      const confirmedEmail = finalEmail || emailResult
      
      log(false, 'CREATOR', `Using email: ${confirmedEmail}`, 'log', 'green')

      // Fill birthdate
      const birthdate = await this.fillBirthdate()
      if (!birthdate) {
        log(false, 'CREATOR', 'Failed to fill birthdate', 'error')
        return null
      }

      // Click Next button
      await this.clickNext('birthdate')

      // Fill name fields
      const names = await this.fillNames(confirmedEmail)
      if (!names) {
        log(false, 'CREATOR', 'Failed to fill names', 'error')
        return null
      }

      // Click Next button
      await this.clickNext('names')

      // Wait for CAPTCHA page
      const captchaDetected = await this.waitForCaptcha()
      if (captchaDetected) {
        log(false, 'CREATOR', '⚠️  CAPTCHA detected - waiting for human to solve it...', 'warn', 'yellow')
        log(false, 'CREATOR', 'Please solve the CAPTCHA in the browser. The script will wait...', 'log', 'yellow')
        
        await this.waitForCaptchaSolved()
        
        log(false, 'CREATOR', '✅ CAPTCHA solved! Continuing...', 'log', 'green')
      }

      // Handle post-CAPTCHA questions (Stay signed in, etc.)
      await this.handlePostCreationQuestions()

      // Navigate to Bing Rewards and verify connection
      await this.verifyAccountActive()

      // Create account object
      const createdAccount: CreatedAccount = {
        email: confirmedEmail,
        password: password,
        birthdate: {
          day: birthdate.day,
          month: birthdate.month,
          year: birthdate.year
        },
        firstName: names.firstName,
        lastName: names.lastName,
        createdAt: new Date().toISOString(),
        referralUrl: this.referralUrl
      }

      // Save to file
      await this.saveAccount(createdAccount)

      log(false, 'CREATOR', `✅ Account created successfully: ${confirmedEmail}`, 'log', 'green')

      return createdAccount

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log(false, 'CREATOR', `Error during account creation: ${msg}`, 'error')
      log(false, 'CREATOR', '⚠️  Browser left open for inspection. Press Ctrl+C to exit.', 'warn', 'yellow')
      return null
    } finally {
      try {
        if (!this.rlClosed) {
          this.rl.close()
          this.rlClosed = true
        }
      } catch {/* ignore */}
    }
  }

  private async navigateToSignup(): Promise<void> {
    if (this.referralUrl) {
      log(false, 'CREATOR', `Navigating to referral URL: ${this.referralUrl}`, 'log', 'cyan')
      await this.page.goto(this.referralUrl, { waitUntil: 'networkidle', timeout: 60000 })
      
      await this.waitForPageStable('REFERRAL_PAGE', 20000)
      await this.humanDelay(2000, 3000)
      
      log(false, 'CREATOR', 'Looking for "Join Microsoft Rewards" button...', 'log')
      
      const joinButtonSelectors = [
        'a#start-earning-rewards-link',
        'a.cta.learn-more-btn',
        'a[href*="signup"]',
        'button[class*="join"]'
      ]
      
      let clicked = false
      for (const selector of joinButtonSelectors) {
        const button = this.page.locator(selector).first()
        const visible = await button.isVisible().catch(() => false)
        
        if (visible) {
          await button.click()
          await this.humanDelay(2000, 3000)
          await this.waitForPageStable('AFTER_JOIN_CLICK', 15000)
          log(false, 'CREATOR', `✅ Clicked join button with selector: ${selector}`, 'log', 'green')
          clicked = true
          break
        }
      }
      
      if (!clicked) {
        log(false, 'CREATOR', 'Could not find join button, continuing anyway...', 'warn', 'yellow')
      }
    } else {
      const url = 'https://login.live.com/'
      log(false, 'CREATOR', `No referral URL - navigating to: ${url}`, 'log', 'cyan')
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
      
      await this.waitForPageStable('LOGIN_PAGE', 20000)
      await this.humanDelay(2000, 3000)
    }
  }

  private async clickCreateAccount(): Promise<void> {
    log(false, 'CREATOR', 'Looking for "Create account" button...', 'log')
    
    await this.waitForPageStable('BEFORE_CREATE_ACCOUNT', 15000)
    
    const createAccountSelectors = [
      'a[id*="signup"]',
      'a[href*="signup"]',
      'span[role="button"].fui-Link',
      'button[id*="signup"]',
      'a[data-testid*="signup"]'
    ]
    
    for (const selector of createAccountSelectors) {
      const button = this.page.locator(selector).first()
      
      try {
        await button.waitFor({ timeout: 5000 })
        await button.click()
        await this.humanDelay(2000, 3000)
        await this.waitForPageStable('AFTER_CREATE_ACCOUNT', 15000)
        
        log(false, 'CREATOR', `✅ Clicked "Create account" with selector: ${selector}`, 'log', 'green')
        return
      } catch {
        continue
      }
    }
    
    throw new Error('Could not find "Create account" button with any selector')
  }

  private async generateAndFillEmail(): Promise<string | null> {
    log(false, 'CREATOR', '\n=== Email Configuration ===', 'log', 'cyan')
    
    await this.waitForPageStable('EMAIL_PAGE', 15000)
    
    const useAutoGenerate = await this.askQuestion('Generate email automatically? (Y/n): ')
    
    let email: string
    
    if (useAutoGenerate.toLowerCase() === 'n' || useAutoGenerate.toLowerCase() === 'no') {
      email = await this.askQuestion('Enter your email: ')
      log(false, 'CREATOR', `Using custom email: ${email}`, 'log', 'cyan')
    } else {
      email = this.dataGenerator.generateEmail()
      log(false, 'CREATOR', `Generated realistic email: ${email}`, 'log', 'cyan')
    }

    const emailInput = this.page.locator('input[type="email"]').first()
    await emailInput.waitFor({ timeout: 15000 })
    await emailInput.clear()
    await this.humanDelay(500, 1000)
    await emailInput.fill(email)
    await this.humanDelay(800, 2000)
    
    log(false, 'CREATOR', 'Clicking Next button...', 'log')
    const nextBtn = this.page.locator('button[data-testid="primaryButton"], button[type="submit"]').first()
    await nextBtn.waitFor({ timeout: 15000 })
    await nextBtn.click()
    await this.humanDelay(2000, 3000)
    await this.waitForPageStable('AFTER_EMAIL_SUBMIT', 20000)
    
    const result = await this.handleEmailErrors(email)
    if (!result.success) {
      return null
    }
    
    return result.email
  }

  private async handleEmailErrors(originalEmail: string): Promise<{ success: boolean; email: string | null }> {
    await this.humanDelay(1000, 1500)
    
    const errorLocator = this.page.locator('div[id*="Error"], div[role="alert"]').first()
    const errorVisible = await errorLocator.isVisible().catch(() => false)
    
    if (!errorVisible) {
      log(false, 'CREATOR', `✅ Email accepted: ${originalEmail}`, 'log', 'green')
      return { success: true, email: originalEmail }
    }
    
    const errorText = await errorLocator.textContent().catch(() => '') || ''
    log(false, 'CREATOR', `Email error: ${errorText}`, 'warn', 'yellow')
    
    // Check for reserved domain error
    if (errorText && (errorText.toLowerCase().includes('reserved') || errorText.toLowerCase().includes('réservé'))) {
      return await this.handleReservedDomain(originalEmail)
    }
    
    // Check for email taken error
    if (errorText && (errorText.toLowerCase().includes('taken') || errorText.toLowerCase().includes('pris') || 
        errorText.toLowerCase().includes('already') || errorText.toLowerCase().includes('déjà'))) {
      return await this.handleEmailTaken()
    }
    
    log(false, 'CREATOR', 'Unknown error type, pausing for inspection', 'error')
    log(false, 'CREATOR', '⚠️  Browser left open. Press Ctrl+C to exit.', 'warn', 'yellow')
    await new Promise(() => {})
    return { success: false, email: null }
  }

  private async handleReservedDomain(originalEmail: string): Promise<{ success: boolean; email: string | null }> {
    log(false, 'CREATOR', `Domain blocked: ${originalEmail.split('@')[1]}`, 'warn', 'yellow')
    
    const username = originalEmail.split('@')[0]
    const newEmail = `${username}@outlook.com`
    
    log(false, 'CREATOR', `Retrying with: ${newEmail}`, 'log', 'cyan')
    
    const emailInput = this.page.locator('input[type="email"]').first()
    await emailInput.clear()
    await this.humanDelay(500, 1000)
    await emailInput.fill(newEmail)
    await this.humanDelay(800, 2000)
    
    const nextBtn = this.page.locator('button[data-testid="primaryButton"], button[type="submit"]').first()
    await nextBtn.click()
    await this.humanDelay(2000, 3000)
    await this.waitForPageStable('RETRY_EMAIL', 15000)
    
    return await this.handleEmailErrors(newEmail)
  }

  private async handleEmailTaken(): Promise<{ success: boolean; email: string | null }> {
    log(false, 'CREATOR', 'Email taken, looking for Microsoft suggestions...', 'log', 'yellow')
    
    await this.humanDelay(2000, 3000)
    await this.waitForPageStable('EMAIL_SUGGESTIONS', 10000)
    
    // Multiple selectors for suggestions container
    const suggestionSelectors = [
      'div[data-testid="suggestions"]',
      'div[role="toolbar"]',
      'div.fui-TagGroup',
      'div[class*="suggestions"]'
    ]
    
    let suggestionsContainer = null
    for (const selector of suggestionSelectors) {
      const container = this.page.locator(selector).first()
      const visible = await container.isVisible().catch(() => false)
      if (visible) {
        suggestionsContainer = container
        log(false, 'CREATOR', `Found suggestions with selector: ${selector}`, 'log', 'green')
        break
      }
    }
    
    if (!suggestionsContainer) {
      log(false, 'CREATOR', 'No suggestions found', 'warn', 'yellow')
      
      // Debug: check HTML content
      const pageContent = await this.page.content()
      const hasDataTestId = pageContent.includes('data-testid="suggestions"')
      const hasToolbar = pageContent.includes('role="toolbar"')
      log(false, 'CREATOR', `Debug - suggestions in HTML: ${hasDataTestId}, toolbar: ${hasToolbar}`, 'warn', 'yellow')
      
      log(false, 'CREATOR', '⚠️  Browser left open. Press Ctrl+C to exit.', 'warn', 'yellow')
      await new Promise(() => {})
      return { success: false, email: null }
    }
    
    // Find all suggestion buttons
    const suggestionButtons = await suggestionsContainer.locator('button').all()
    log(false, 'CREATOR', `Found ${suggestionButtons.length} suggestion buttons`, 'log', 'cyan')
    
    if (suggestionButtons.length === 0) {
      log(false, 'CREATOR', 'Suggestions container found but no buttons inside', 'error')
      log(false, 'CREATOR', '⚠️  Browser left open. Press Ctrl+C to exit.', 'warn', 'yellow')
      await new Promise(() => {})
      return { success: false, email: null }
    }
    
    // Get text from first suggestion before clicking
    const firstButton = suggestionButtons[0]
    if (!firstButton) {
      log(false, 'CREATOR', 'First button is undefined', 'error')
      log(false, 'CREATOR', '⚠️  Browser left open. Press Ctrl+C to exit.', 'warn', 'yellow')
      await new Promise(() => {})
      return { success: false, email: null }
    }
    
    const suggestedEmail = await firstButton.textContent().catch(() => '') || ''
    let cleanEmail = suggestedEmail.trim()
    
    // If suggestion doesn't have @domain, it's just the username - add @outlook.com
    if (cleanEmail && !cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@outlook.com`
      log(false, 'CREATOR', `Suggestion is username only, adding domain: ${cleanEmail}`, 'log', 'cyan')
    }
    
    if (!cleanEmail) {
      log(false, 'CREATOR', 'Could not extract email from suggestion button', 'error')
      log(false, 'CREATOR', '⚠️  Browser left open. Press Ctrl+C to exit.', 'warn', 'yellow')
      await new Promise(() => {})
      return { success: false, email: null }
    }
    
    log(false, 'CREATOR', `Selecting suggestion: ${cleanEmail}`, 'log', 'cyan')
    
    // Click the suggestion
    await firstButton.click()
    await this.humanDelay(1500, 2500)
    
    // Verify the email input was updated
    const emailInput = this.page.locator('input[type="email"]').first()
    const inputValue = await emailInput.inputValue().catch(() => '')
    
    if (inputValue) {
      log(false, 'CREATOR', `✅ Suggestion applied: ${inputValue}`, 'log', 'green')
    }
    
    // Check if error is gone
    const errorLocator = this.page.locator('div[id*="Error"], div[role="alert"]').first()
    const errorStillVisible = await errorLocator.isVisible().catch(() => false)
    
    if (errorStillVisible) {
      log(false, 'CREATOR', 'Error still visible after clicking suggestion', 'warn', 'yellow')
      
      // Try clicking Next to submit
      const nextBtn = this.page.locator('button[data-testid="primaryButton"], button[type="submit"]').first()
      const nextEnabled = await nextBtn.isEnabled().catch(() => false)
      
      if (nextEnabled) {
        log(false, 'CREATOR', 'Clicking Next to submit suggestion', 'log')
        await nextBtn.click()
        await this.humanDelay(2000, 3000)
        
        // Final check
        const finalError = await errorLocator.isVisible().catch(() => false)
        if (finalError) {
          log(false, 'CREATOR', 'Failed to resolve error', 'error')
          log(false, 'CREATOR', '⚠️  Browser left open. Press Ctrl+C to exit.', 'warn', 'yellow')
          await new Promise(() => {})
          return { success: false, email: null }
        }
      }
    } else {
      // Error is gone, click Next to continue
      log(false, 'CREATOR', 'Suggestion accepted, clicking Next', 'log', 'green')
      const nextBtn = this.page.locator('button[data-testid="primaryButton"], button[type="submit"]').first()
      await nextBtn.click()
      await this.humanDelay(2000, 3000)
    }
    
    log(false, 'CREATOR', `✅ Using suggested email: ${cleanEmail}`, 'log', 'green')
    return { success: true, email: cleanEmail }
  }

  private async clickNext(step: string): Promise<void> {
    log(false, 'CREATOR', `Clicking Next button (${step})...`, 'log')
    
    // CRITICAL: Ensure page is stable before clicking
    await this.waitForPageStable(`BEFORE_NEXT_${step.toUpperCase()}`, 15000)
    
    // Find button by test id or type submit
    const nextBtn = this.page.locator('button[data-testid="primaryButton"], button[type="submit"]').first()
    
    // CRITICAL: Verify button is ready
    const isReady = await this.verifyElementReady(
      'button[data-testid="primaryButton"], button[type="submit"]',
      `NEXT_BUTTON_${step.toUpperCase()}`,
      15000
    )
    
    if (!isReady) {
      log(false, 'CREATOR', 'Next button not ready, waiting longer...', 'warn', 'yellow')
      await this.humanDelay(3000, 5000)
    }
    
    // Ensure button is enabled
    const isEnabled = await nextBtn.isEnabled()
    if (!isEnabled) {
      log(false, 'CREATOR', 'Waiting for Next button to be enabled...', 'warn')
      await this.humanDelay(3000, 5000)
    }
    
    // Get current URL before clicking
    const urlBefore = this.page.url()
    
    await nextBtn.click()
    log(false, 'CREATOR', `✅ Clicked Next (${step})`, 'log', 'green')
    
    // CRITICAL: Wait for page to process the click
    await this.humanDelay(3000, 5000)
    
    // CRITICAL: Wait for page to be stable after clicking
    await this.waitForPageStable(`AFTER_NEXT_${step.toUpperCase()}`, 20000)
    
    // Verify navigation happened (if expected)
    const urlAfter = this.page.url()
    if (urlBefore !== urlAfter) {
      log(false, 'CREATOR', `Navigation detected: ${urlBefore} → ${urlAfter}`, 'log', 'cyan')
    }
  }

  private async fillPassword(): Promise<string | null> {
    log(false, 'CREATOR', 'Waiting for password page...', 'log')
    
    await this.page.locator('h1[data-testid="title"]').first().waitFor({ timeout: 20000 })
    await this.waitForPageStable('PASSWORD_PAGE', 15000)
    await this.humanDelay(1000, 2000)
    
    log(false, 'CREATOR', 'Generating strong password...', 'log')
    const password = this.dataGenerator.generatePassword()
    
    const passwordInput = this.page.locator('input[type="password"]').first()
    await passwordInput.waitFor({ timeout: 15000 })
    
    await passwordInput.clear()
    await this.humanDelay(500, 1000)
    await passwordInput.fill(password)
    await this.humanDelay(800, 2000)
    
    log(false, 'CREATOR', '✅ Password filled (hidden for security)', 'log', 'green')
    
    return password
  }

  private async extractEmail(): Promise<string | null> {
    log(false, 'CREATOR', 'Extracting email from identity badge...', 'log')
    
    // Multiple selectors for identity badge (language-independent)
    const badgeSelectors = [
      '#bannerText',
      'div[id="identityBadge"] div',
      'div[data-testid="identityBanner"] div',
      'div[class*="identityBanner"]',
      'span[class*="identityText"]'
    ]
    
    for (const selector of badgeSelectors) {
      try {
        const badge = this.page.locator(selector).first()
        await badge.waitFor({ timeout: 5000 })
        
        const email = await badge.textContent()
        
        if (email && email.includes('@')) {
          const cleanEmail = email.trim()
          log(false, 'CREATOR', `✅ Email extracted: ${cleanEmail}`, 'log', 'green')
          return cleanEmail
        }
      } catch {
        // Try next selector
        continue
      }
    }
    
    log(false, 'CREATOR', 'Could not find identity badge (not critical)', 'warn')
    return null
  }

  private async fillBirthdate(): Promise<{ day: number; month: number; year: number } | null> {
    log(false, 'CREATOR', 'Filling birthdate...', 'log')
    
    await this.waitForPageStable('BIRTHDATE_PAGE', 15000)
    
    const birthdate = this.dataGenerator.generateBirthdate()
    
    try {
      await this.humanDelay(2000, 3000)
      
      const dayButton = this.page.locator('button[name="BirthDay"], button#BirthDayDropdown').first()
      await dayButton.waitFor({ timeout: 15000, state: 'visible' })
      
      log(false, 'CREATOR', 'Clicking day dropdown...', 'log')
      
      // Use force:true in case label intercepts pointer events
      await dayButton.click({ force: true })
      await this.humanDelay(1000, 1500)
      
      // Wait for dropdown menu to open and be visible
      log(false, 'CREATOR', 'Waiting for day dropdown to open...', 'log')
      const dayOptionsContainer = this.page.locator('div[role="listbox"], ul[role="listbox"]').first()
      
      try {
        await dayOptionsContainer.waitFor({ timeout: 10000, state: 'visible' })
        log(false, 'CREATOR', '✅ Day dropdown opened', 'log', 'green')
      } catch (error) {
        log(false, 'CREATOR', 'Day dropdown did not open, retrying click...', 'warn', 'yellow')
        await dayButton.click({ force: true })
        await this.humanDelay(1000, 1500)
        await dayOptionsContainer.waitFor({ timeout: 10000, state: 'visible' })
      }
      
      // Select day from dropdown - the options appear as li/div with role="option"
      log(false, 'CREATOR', `Selecting day: ${birthdate.day}`, 'log')
      const dayOption = this.page.locator(`div[role="option"]:has-text("${birthdate.day}"), li[role="option"]:has-text("${birthdate.day}")`).first()
      await dayOption.waitFor({ timeout: 5000, state: 'visible' })
      await dayOption.click()
      await this.humanDelay(1000, 1500)
      
      // CRITICAL: Wait for day dropdown menu to fully close before opening month
      log(false, 'CREATOR', 'Waiting for day dropdown to close...', 'log')
      await this.humanDelay(1000, 1500)
      
      // Verify day dropdown is closed
      const dayMenuClosed = await this.page.locator('div[role="listbox"], ul[role="listbox"]').isVisible().catch(() => false)
      if (dayMenuClosed) {
        log(false, 'CREATOR', 'Day menu still open, waiting more...', 'warn', 'yellow')
        await this.humanDelay(1000, 2000)
      }
      
      // Fill month dropdown
      const monthButton = this.page.locator('button[name="BirthMonth"], button#BirthMonthDropdown').first()
      await monthButton.waitFor({ timeout: 10000, state: 'visible' })
      
      log(false, 'CREATOR', 'Clicking month dropdown...', 'log')
      
      // CRITICAL: Use force:true because label intercepts pointer events
      await monthButton.click({ force: true })
      await this.humanDelay(1000, 1500)
      
      // Wait for month dropdown menu to open and be visible
      log(false, 'CREATOR', 'Waiting for month dropdown to open...', 'log')
      const monthOptionsContainer = this.page.locator('div[role="listbox"], ul[role="listbox"]').first()
      
      try {
        await monthOptionsContainer.waitFor({ timeout: 10000, state: 'visible' })
        log(false, 'CREATOR', '✅ Month dropdown opened', 'log', 'green')
      } catch (error) {
        log(false, 'CREATOR', 'Month dropdown did not open, retrying click...', 'warn', 'yellow')
        await monthButton.click({ force: true })
        await this.humanDelay(1000, 1500)
        await monthOptionsContainer.waitFor({ timeout: 10000, state: 'visible' })
      }
      
      // Select month by data-value attribute or by position
      log(false, 'CREATOR', `Selecting month: ${birthdate.month}`, 'log')
      const monthOption = this.page.locator(`div[role="option"][data-value="${birthdate.month}"], li[role="option"][data-value="${birthdate.month}"]`).first()
      
      // Fallback: if data-value doesn't work, try by index (month - 1)
      const monthVisible = await monthOption.isVisible().catch(() => false)
      if (monthVisible) {
        await monthOption.click()
        log(false, 'CREATOR', '✅ Month selected by data-value', 'log', 'green')
      } else {
        log(false, 'CREATOR', `Fallback: selecting month by nth-child(${birthdate.month})`, 'warn', 'yellow')
        const monthOptionByIndex = this.page.locator(`div[role="option"]:nth-child(${birthdate.month}), li[role="option"]:nth-child(${birthdate.month})`).first()
        await monthOptionByIndex.click()
      }
      await this.humanDelay(1000, 1500)
      
      // Wait for month dropdown to close
      log(false, 'CREATOR', 'Waiting for month dropdown to close...', 'log')
      await this.humanDelay(1000, 1500)
      
      // Fill year input
      const yearInput = this.page.locator('input[name="BirthYear"], input[type="number"]').first()
      await yearInput.waitFor({ timeout: 10000, state: 'visible' })
      
      log(false, 'CREATOR', `Filling year: ${birthdate.year}`, 'log')
      await yearInput.clear()
      await this.humanDelay(500, 1000)
      await yearInput.fill(birthdate.year.toString())
      await this.humanDelay(800, 2000)
      
      log(false, 'CREATOR', `✅ Birthdate filled: ${birthdate.day}/${birthdate.month}/${birthdate.year}`, 'log', 'green')
      
      return birthdate
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log(false, 'CREATOR', `Error filling birthdate: ${msg}`, 'error')
      return null
    }
  }

  private async fillNames(email: string): Promise<{ firstName: string; lastName: string } | null> {
    log(false, 'CREATOR', 'Filling first and last name...', 'log')
    
    await this.waitForPageStable('NAMES_PAGE', 15000)
    
    const names = this.dataGenerator.generateNames(email)
    
    try {
      await this.humanDelay(1000, 2000)
      
      const firstNameSelectors = [
        'input[id*="firstName"]',
        'input[name*="firstName"]',
        'input[id*="first"]',
        'input[name*="first"]',
        'input[aria-label*="First"]',
        'input[placeholder*="First"]'
      ]
      
      let firstNameInput = null
      for (const selector of firstNameSelectors) {
        const input = this.page.locator(selector).first()
        const visible = await input.isVisible().catch(() => false)
        if (visible) {
          firstNameInput = input
          break
        }
      }
      
      if (!firstNameInput) {
        log(false, 'CREATOR', 'Could not find first name input', 'error')
        return null
      }
      
      await firstNameInput.clear()
      await this.humanDelay(500, 1000)
      await firstNameInput.fill(names.firstName)
      await this.humanDelay(800, 2000)
      
      // Fill last name with multiple selector fallbacks
      const lastNameSelectors = [
        'input[id*="lastName"]',
        'input[name*="lastName"]',
        'input[id*="last"]',
        'input[name*="last"]',
        'input[aria-label*="Last"]',
        'input[placeholder*="Last"]'
      ]
      
      let lastNameInput = null
      for (const selector of lastNameSelectors) {
        const input = this.page.locator(selector).first()
        const visible = await input.isVisible().catch(() => false)
        if (visible) {
          lastNameInput = input
          break
        }
      }
      
      if (!lastNameInput) {
        log(false, 'CREATOR', 'Could not find last name input', 'error')
        return null
      }
      
      await lastNameInput.clear()
      await this.humanDelay(500, 1000)
      await lastNameInput.fill(names.lastName)
      await this.humanDelay(800, 2000)
      
      log(false, 'CREATOR', `✅ Names filled: ${names.firstName} ${names.lastName}`, 'log', 'green')
      
      return names
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log(false, 'CREATOR', `Error filling names: ${msg}`, 'error')
      return null
    }
  }

  private async waitForCaptcha(): Promise<boolean> {
    try {
      // Wait a bit to let the page load
      await this.humanDelay(1500, 2500)
      
      // Check for CAPTCHA iframe (most reliable indicator)
      const captchaIframe = this.page.locator('iframe[data-testid="humanCaptchaIframe"]').first()
      const iframeVisible = await captchaIframe.isVisible().catch(() => false)
      
      if (iframeVisible) {
        log(false, 'CREATOR', 'CAPTCHA detected via iframe', 'warn', 'yellow')
        return true
      }
      
      // Check multiple indicators for CAPTCHA
      const captchaIndicators = [
        'h1[data-testid="title"]',
        'div[id*="captcha"]',
        'div[class*="captcha"]',
        'div[id*="enforcement"]',
        'img[data-testid="accessibleImg"]'
      ]
      
      for (const selector of captchaIndicators) {
        const element = this.page.locator(selector).first()
        const visible = await element.isVisible().catch(() => false)
        
        if (visible) {
          const text = await element.textContent().catch(() => '')
          
          // Check for CAPTCHA-related keywords
          if (text && (
            text.toLowerCase().includes('vérif') || 
            text.toLowerCase().includes('verify') || 
            text.toLowerCase().includes('human') ||
            text.toLowerCase().includes('humain') ||
            text.toLowerCase().includes('puzzle') ||
            text.toLowerCase().includes('captcha') ||
            text.toLowerCase().includes('prove you')
          )) {
            log(false, 'CREATOR', `CAPTCHA detected with text: ${text.substring(0, 50)}`, 'warn', 'yellow')
            return true
          }
        }
      }
      
      return false
    } catch {
      return false
    }
  }

  private async waitForCaptchaSolved(): Promise<void> {
    const maxWaitTime = 10 * 60 * 1000 // 10 minutes
    const startTime = Date.now()
    let lastLogTime = startTime
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Log progress every 30 seconds
        if (Date.now() - lastLogTime > 30000) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000)
          log(false, 'CREATOR', `Still waiting for CAPTCHA... (${elapsed}s elapsed)`, 'log', 'yellow')
          lastLogTime = Date.now()
        }
        
        // Check if CAPTCHA is still present
        const captchaStillPresent = await this.waitForCaptcha()
        
        if (!captchaStillPresent) {
          // CAPTCHA solved! But account creation may still be in progress
          log(false, 'CREATOR', '✅ CAPTCHA solved! Waiting for account creation...', 'log', 'green')
          
          // CRITICAL: Wait for Microsoft to finish creating the account
          await this.waitForAccountCreation()
          
          return
        }
        
        // Wait before checking again
        await this.page.waitForTimeout(2000)
        
      } catch {
        // Error checking, assume CAPTCHA is solved
        return
      }
    }
    
    throw new Error('CAPTCHA solving timeout - waited 10 minutes')
  }

  private async handlePostCreationQuestions(): Promise<void> {
    log(false, 'CREATOR', 'Handling post-creation questions...', 'log', 'cyan')
    
    // CRITICAL: Ensure page is fully loaded and stable before proceeding
    await this.waitForPageStable('POST_CREATION', 30000)
    
    // Additional safety delay
    await this.humanDelay(3000, 5000)
    
    // CRITICAL: Handle passkey prompt - MUST REFUSE
    await this.handlePasskeyPrompt()
    
    // Handle "Stay signed in?" (KMSI) prompt
    const kmsiSelectors = [
      '[data-testid="kmsiVideo"]',
      'div:has-text("Stay signed in?")',
      'div:has-text("Rester connecté")',
      'button[data-testid="primaryButton"]'
    ]
    
    for (let i = 0; i < 3; i++) {
      let found = false
      
      for (const selector of kmsiSelectors) {
        const element = this.page.locator(selector).first()
        const visible = await element.isVisible().catch(() => false)
        
        if (visible) {
          log(false, 'CREATOR', 'Stay signed in prompt detected', 'log', 'yellow')
          
          // Click "Yes" button
          const yesButton = this.page.locator('button[data-testid="primaryButton"]').first()
          const yesVisible = await yesButton.isVisible().catch(() => false)
          
          if (yesVisible) {
            await yesButton.click()
            await this.humanDelay(2000, 3000)
            await this.waitForPageStable('AFTER_KMSI', 15000)
            log(false, 'CREATOR', '✅ Accepted "Stay signed in"', 'log', 'green')
            found = true
            break
          }
        }
      }
      
      if (!found) break
      await this.humanDelay(1000, 2000)
    }
    
    // Handle any other prompts (biometric, etc.)
    const genericPrompts = [
      '[data-testid="biometricVideo"]',
      'button[id*="close"]',
      'button[aria-label*="Close"]'
    ]
    
    for (const selector of genericPrompts) {
      const element = this.page.locator(selector).first()
      const visible = await element.isVisible().catch(() => false)
      
      if (visible) {
        log(false, 'CREATOR', `Closing prompt: ${selector}`, 'log', 'yellow')
        
        // Try to close it
        const closeButton = this.page.locator('button[data-testid="secondaryButton"], button[id*="close"]').first()
        const closeVisible = await closeButton.isVisible().catch(() => false)
        
        if (closeVisible) {
          await closeButton.click()
          await this.humanDelay(1500, 2500)
          log(false, 'CREATOR', '✅ Closed prompt', 'log', 'green')
        }
      }
    }
    
    log(false, 'CREATOR', '✅ Post-creation questions handled', 'log', 'green')
  }
  
  private async handlePasskeyPrompt(): Promise<void> {
    log(false, 'CREATOR', 'Checking for passkey setup prompt...', 'log', 'cyan')
    
    // CRITICAL: Wait longer for passkey prompt to appear
    // Microsoft may show this after several seconds
    await this.humanDelay(5000, 7000)
    
    // Ensure page is stable before checking
    await this.waitForPageStable('PASSKEY_CHECK', 15000)
    
    // Multiple selectors for passkey prompt detection
    const passkeyDetectionSelectors = [
      'div:has-text("passkey")',
      'div:has-text("clé d\'accès")',
      'div:has-text("Set up a passkey")',
      'div:has-text("Configurer une clé")',
      '[data-testid*="passkey"]',
      'button:has-text("Skip")',
      'button:has-text("Not now")',
      'button:has-text("Ignorer")',
      'button:has-text("Plus tard")'
    ]
    
    let passkeyPromptFound = false
    
    for (const selector of passkeyDetectionSelectors) {
      const element = this.page.locator(selector).first()
      const visible = await element.isVisible().catch(() => false)
      
      if (visible) {
        passkeyPromptFound = true
        log(false, 'CREATOR', '⚠️  Passkey setup prompt detected - REFUSING', 'warn', 'yellow')
        break
      }
    }
    
    if (!passkeyPromptFound) {
      log(false, 'CREATOR', 'No passkey prompt detected', 'log', 'green')
      return
    }
    
    // Try to click refuse/skip buttons
    const refuseButtonSelectors = [
      'button:has-text("Skip")',
      'button:has-text("Not now")',
      'button:has-text("No")',
      'button:has-text("Cancel")',
      'button:has-text("Ignorer")',
      'button:has-text("Plus tard")',
      'button:has-text("Non")',
      'button:has-text("Annuler")',
      'button[data-testid="secondaryButton"]',
      'button[id*="cancel"]',
      'button[id*="skip"]'
    ]
    
    for (const selector of refuseButtonSelectors) {
      const button = this.page.locator(selector).first()
      const visible = await button.isVisible().catch(() => false)
      
      if (visible) {
        log(false, 'CREATOR', `Clicking refuse button: ${selector}`, 'log', 'cyan')
        await button.click()
        await this.humanDelay(2000, 3000)
        log(false, 'CREATOR', '✅ Passkey setup REFUSED', 'log', 'green')
        return
      }
    }
    
    log(false, 'CREATOR', '⚠️  Could not find refuse button for passkey prompt', 'warn', 'yellow')
  }

  private async verifyAccountActive(): Promise<void> {
    log(false, 'CREATOR', 'Verifying account is active...', 'log', 'cyan')
    
    // CRITICAL: Ensure current page is stable before navigating
    await this.waitForPageStable('PRE_VERIFICATION', 15000)
    
    // Additional delay before navigation
    await this.humanDelay(3000, 5000)
    
    // Navigate to Bing Rewards
    try {
      log(false, 'CREATOR', 'Navigating to rewards.bing.com...', 'log', 'cyan')
      
      await this.page.goto('https://rewards.bing.com/', { 
        waitUntil: 'networkidle',
        timeout: 60000
      })
      
      // CRITICAL: Wait for page to be fully stable after navigation
      await this.waitForPageStable('REWARDS_PAGE', 30000)
      
      // Additional safety delay
      await this.humanDelay(5000, 7000)
      
      const currentUrl = this.page.url()
      log(false, 'CREATOR', `Current URL: ${currentUrl}`, 'log', 'cyan')
      
      // CRITICAL: Verify we're actually on rewards page and logged in
      if (!currentUrl.includes('rewards.bing.com')) {
        if (currentUrl.includes('login.live.com')) {
          log(false, 'CREATOR', '⚠️ Still on login page - account may not be fully activated', 'warn', 'yellow')
          
          // Wait longer and retry
          await this.humanDelay(10000, 15000)
          await this.page.goto('https://rewards.bing.com/', { 
            waitUntil: 'networkidle',
            timeout: 60000
          })
          await this.waitForPageStable('REWARDS_RETRY', 30000)
        } else {
          log(false, 'CREATOR', `⚠️ Unexpected URL: ${currentUrl}`, 'warn', 'yellow')
        }
      }
      
      log(false, 'CREATOR', '✅ Successfully navigated to rewards.bing.com', 'log', 'green')
      
      // CRITICAL: Wait for user identity to load before declaring success
      await this.humanDelay(5000, 7000)
        
      // CRITICAL: Verify user identity is loaded
      log(false, 'CREATOR', 'Verifying user identity...', 'log', 'cyan')
      
      const identitySelectors = [
        '[data-bi-id="userIdentity"]',
        '[id*="user"]',
        'button[aria-label*="Account"]',
        '#id_n', // User dropdown
        '.mee_header_profile' // Profile area
      ]
      
      let identityVerified = false
      for (const selector of identitySelectors) {
        const element = this.page.locator(selector).first()
        const visible = await element.isVisible().catch(() => false)
        
        if (visible) {
          const text = await element.textContent().catch(() => '')
          if (text && text.trim().length > 0) {
            log(false, 'CREATOR', `✅ Verified identity: ${text.substring(0, 50)}`, 'log', 'green')
            identityVerified = true
            break
          }
        }
      }
      
      if (!identityVerified) {
        log(false, 'CREATOR', '⚠️ Could not verify user identity on page', 'warn', 'yellow')
        
        // Wait longer and check again
        await this.humanDelay(5000, 7000)
        
        for (const selector of identitySelectors) {
          const element = this.page.locator(selector).first()
          const visible = await element.isVisible().catch(() => false)
          
          if (visible) {
            log(false, 'CREATOR', '✅ Identity verified on retry', 'log', 'green')
            identityVerified = true
            break
          }
        }
      }
      
      if (identityVerified) {
        log(false, 'CREATOR', '✅ Account is active and logged in!', 'log', 'green')
      } else {
        log(false, 'CREATOR', '⚠️ Account state uncertain - proceeding anyway', 'warn', 'yellow')
      }
      
      // NOW handle popups and tour - AFTER confirming we're logged in
      await this.humanDelay(3000, 5000)
      await this.handleRewardsWelcomeTour()
      await this.humanDelay(3000, 5000)
      await this.handleRewardsPopups()
      
      // If we have a referral URL, ensure we join via it
      if (this.referralUrl) {
        await this.humanDelay(3000, 4000)
        await this.ensureRewardsEnrollment()
      }
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log(false, 'CREATOR', `Warning: Could not verify account: ${msg}`, 'warn', 'yellow')
    }
  }
  
  private async handleRewardsWelcomeTour(): Promise<void> {
    log(false, 'CREATOR', 'Checking for Microsoft Rewards welcome tour...', 'log', 'cyan')
    
    // CRITICAL: Ensure page is stable before checking for tour
    await this.waitForPageStable('WELCOME_TOUR', 20000)
    
    // Additional delay for tour to appear
    await this.humanDelay(5000, 7000)
    
    // Try to handle the welcome tour (multiple Next buttons)
    const maxClicks = 5
    for (let i = 0; i < maxClicks; i++) {
      // Check for welcome tour indicators
      const welcomeIndicators = [
        'img[src*="Get%20cool%20prizes"]',
        'img[alt*="Welcome to Microsoft Rewards"]',
        'div.welcome-tour',
        'a#fre-next-button',
        'a.welcome-tour-button.next-button',
        'a.next-button.c-call-to-action'
      ]
      
      let tourFound = false
      for (const selector of welcomeIndicators) {
        const element = this.page.locator(selector).first()
        const visible = await element.isVisible().catch(() => false)
        
        if (visible) {
          tourFound = true
          log(false, 'CREATOR', `Welcome tour detected (step ${i + 1})`, 'log', 'yellow')
          break
        }
      }
      
      if (!tourFound) {
        log(false, 'CREATOR', 'No more welcome tour steps', 'log', 'green')
        break
      }
      
      // Try to click Next button
      const nextButtonSelectors = [
        'a#fre-next-button',
        'a.welcome-tour-button.next-button',
        'a.next-button.c-call-to-action',
        'button:has-text("Next")',
        'a:has-text("Next")',
        'button:has-text("Suivant")',
        'a:has-text("Suivant")'
      ]
      
      let clickedNext = false
      for (const selector of nextButtonSelectors) {
        const button = this.page.locator(selector).first()
        const visible = await button.isVisible().catch(() => false)
        
        if (visible) {
          log(false, 'CREATOR', `Clicking Next button: ${selector}`, 'log', 'cyan')
          await button.click()
          await this.humanDelay(3000, 4000)
          await this.waitForPageStable('AFTER_TOUR_NEXT', 15000)
          
          clickedNext = true
          log(false, 'CREATOR', `✅ Clicked Next (step ${i + 1})`, 'log', 'green')
          break
        }
      }
      
      if (!clickedNext) {
        const pinButtonSelectors = [
          'a#claim-button',
          'a:has-text("Pin and start earning")',
          'a:has-text("Épingler et commencer")',
          'a.welcome-tour-button[href*="pin=true"]'
        ]
        
        for (const selector of pinButtonSelectors) {
          const button = this.page.locator(selector).first()
          const visible = await button.isVisible().catch(() => false)
          
          if (visible) {
            log(false, 'CREATOR', 'Clicking "Pin and start earning" button', 'log', 'cyan')
            await button.click()
            await this.humanDelay(3000, 4000)
            await this.waitForPageStable('AFTER_PIN', 15000)
            log(false, 'CREATOR', '✅ Clicked Pin button', 'log', 'green')
            break
          }
        }
        
        break
      }
      
      // Wait between steps to avoid spamming
      await this.humanDelay(2000, 3000)
    }
    
    log(false, 'CREATOR', '✅ Welcome tour handled', 'log', 'green')
  }
  
  private async handleRewardsPopups(): Promise<void> {
    log(false, 'CREATOR', 'Checking for Microsoft Rewards popups...', 'log', 'cyan')
    
    // CRITICAL: Ensure page is stable before checking for popups
    await this.waitForPageStable('REWARDS_POPUPS', 20000)
    
    // Wait longer for any popups to appear
    await this.humanDelay(5000, 7000)
    
    // Handle ReferAndEarn popup
    const referralPopupSelectors = [
      'img[src*="ReferAndEarnPopUpImgUpdated"]',
      'div.dashboardPopUp',
      'a.dashboardPopUpPopUpSelectButton',
      'a#reward_pivot_earn'
    ]
    
    let referralPopupFound = false
    for (const selector of referralPopupSelectors) {
      const element = this.page.locator(selector).first()
      const visible = await element.isVisible().catch(() => false)
      
      if (visible) {
        referralPopupFound = true
        log(false, 'CREATOR', 'Referral popup detected', 'log', 'yellow')
        break
      }
    }
    
    if (referralPopupFound) {
      // Wait before clicking to ensure popup is fully loaded
      await this.humanDelay(2000, 3000)
      
      // Click "Get started" button
      const getStartedSelectors = [
        'a.dashboardPopUpPopUpSelectButton',
        'a#reward_pivot_earn',
        'a:has-text("Get started")',
        'a:has-text("Commencer")',
        'button:has-text("Get started")',
        'button:has-text("Commencer")'
      ]
      
      for (const selector of getStartedSelectors) {
        const button = this.page.locator(selector).first()
        const visible = await button.isVisible().catch(() => false)
        
        if (visible) {
          log(false, 'CREATOR', 'Clicking "Get started" button', 'log', 'cyan')
          await button.click()
          await this.humanDelay(3000, 4000)
          await this.waitForPageStable('AFTER_GET_STARTED', 15000)
          log(false, 'CREATOR', '✅ Clicked Get started', 'log', 'green')
          break
        }
      }
    }
    
    const genericCloseSelectors = [
      'button[aria-label*="Close"]',
      'button[aria-label*="Fermer"]',
      'button.close',
      'a.close'
    ]
    
    for (const selector of genericCloseSelectors) {
      const button = this.page.locator(selector).first()
      const visible = await button.isVisible().catch(() => false)
      
      if (visible) {
        log(false, 'CREATOR', `Closing popup with selector: ${selector}`, 'log', 'cyan')
        await button.click()
        await this.humanDelay(2000, 3000)
        await this.waitForPageStable('AFTER_CLOSE_POPUP', 10000)
      }
    }
    
    log(false, 'CREATOR', '✅ Popups handled', 'log', 'green')
  }
  
  private async ensureRewardsEnrollment(): Promise<void> {
    log(false, 'CREATOR', 'Ensuring Microsoft Rewards enrollment via referral URL...', 'log', 'cyan')
    
    if (!this.referralUrl) {
      log(false, 'CREATOR', 'No referral URL provided, skipping enrollment check', 'warn', 'yellow')
      return
    }
    
    try {
      // Navigate to referral URL
      log(false, 'CREATOR', `Navigating to referral URL: ${this.referralUrl}`, 'log', 'cyan')
      await this.page.goto(this.referralUrl, { 
        waitUntil: 'networkidle',
        timeout: 60000
      })
      
      // CRITICAL: Wait for page to be stable after navigation
      await this.waitForPageStable('REFERRAL_ENROLLMENT', 30000)
      
      // Additional delay
      await this.humanDelay(5000, 7000)
      
      // Look for "Join Microsoft Rewards" button
      const joinButtonSelectors = [
        'a#start-earning-rewards-link',
        'a.cta.learn-more-btn',
        'a[href*="createNewUser"]',
        'a:has-text("Join Microsoft Rewards")',
        'a:has-text("Rejoindre Microsoft Rewards")',
        'button:has-text("Join")',
        'button:has-text("Rejoindre")'
      ]
      
      let joined = false
      for (const selector of joinButtonSelectors) {
        const button = this.page.locator(selector).first()
        const visible = await button.isVisible().catch(() => false)
        
        if (visible) {
          log(false, 'CREATOR', `Clicking "Join Microsoft Rewards" button: ${selector}`, 'log', 'cyan')
          await button.click()
          await this.humanDelay(3000, 5000)
          await this.waitForPageStable('AFTER_JOIN', 20000)
          log(false, 'CREATOR', '✅ Clicked Join button', 'log', 'green')
          joined = true
          break
        }
      }
      
      if (!joined) {
        log(false, 'CREATOR', 'Join button not found - account may already be enrolled', 'log', 'yellow')
      }
      
      // CRITICAL: Wait for enrollment to complete and page to stabilize
      await this.waitForPageStable('POST_ENROLLMENT', 30000)
      await this.humanDelay(5000, 7000)
      
      // Handle any popups after joining - with delays between
      await this.humanDelay(3000, 5000)
      await this.handleRewardsWelcomeTour()
      await this.humanDelay(3000, 5000)
      await this.handleRewardsPopups()
      
      log(false, 'CREATOR', '✅ Rewards enrollment completed', 'log', 'green')
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log(false, 'CREATOR', `Warning: Could not complete enrollment: ${msg}`, 'warn', 'yellow')
    }
  }

  private async saveAccount(account: CreatedAccount): Promise<void> {
    try {
      const accountsDir = path.join(process.cwd(), 'accounts-created')
      
      // Ensure directory exists
      if (!fs.existsSync(accountsDir)) {
        log(false, 'CREATOR', 'Creating accounts-created directory...', 'log', 'cyan')
        fs.mkdirSync(accountsDir, { recursive: true })
      }
      
      // Create a unique filename for THIS account using timestamp and email
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-')
      const emailPrefix = (account.email.split('@')[0] || 'account').substring(0, 20) // First 20 chars of email
      const filename = `account_${emailPrefix}_${timestamp}.jsonc`
      const filepath = path.join(accountsDir, filename)
      
      log(false, 'CREATOR', `Saving account to NEW file: ${filename}`, 'log', 'cyan')
      
      // Create account data with metadata
      const accountData = {
        ...account,
        savedAt: new Date().toISOString(),
        filename: filename
      }
      
      // Create output with comments
      const output = `// Microsoft Rewards - Account Created
// Email: ${account.email}
// Created: ${account.createdAt}
// Saved: ${accountData.savedAt}

${JSON.stringify(accountData, null, 2)}`
      
      // Write to NEW file (never overwrites existing files)
      fs.writeFileSync(filepath, output, 'utf-8')
      
      // Verify the file was written correctly
      if (fs.existsSync(filepath)) {
        const verifySize = fs.statSync(filepath).size
        log(false, 'CREATOR', `✅ File written successfully (${verifySize} bytes)`, 'log', 'green')
        
        // Double-check we can read it back
        const verifyContent = fs.readFileSync(filepath, 'utf-8')
        const verifyJsonStartIndex = verifyContent.indexOf('{')
        const verifyJsonEndIndex = verifyContent.lastIndexOf('}')
        
        if (verifyJsonStartIndex !== -1 && verifyJsonEndIndex !== -1) {
          const verifyJsonContent = verifyContent.substring(verifyJsonStartIndex, verifyJsonEndIndex + 1)
          const verifyAccount = JSON.parse(verifyJsonContent)
          
          if (verifyAccount.email === account.email) {
            log(false, 'CREATOR', `✅ Verification passed: Account ${account.email} saved correctly`, 'log', 'green')
          } else {
            log(false, 'CREATOR', '⚠️  Verification warning: Email mismatch', 'warn', 'yellow')
          }
        }
      } else {
        log(false, 'CREATOR', '❌ File verification failed - file does not exist!', 'error')
      }
      
      log(false, 'CREATOR', `✅ Account saved successfully to: ${filepath}`, 'log', 'green')
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log(false, 'CREATOR', `❌ Error saving account: ${msg}`, 'error')
      
      // Try to save to a fallback file
      try {
        const fallbackPath = path.join(process.cwd(), `account-backup-${Date.now()}.jsonc`)
        fs.writeFileSync(fallbackPath, JSON.stringify(account, null, 2), 'utf-8')
        log(false, 'CREATOR', `⚠️  Account saved to fallback file: ${fallbackPath}`, 'warn', 'yellow')
      } catch (fallbackError) {
        const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        log(false, 'CREATOR', `❌ Failed to save fallback: ${fallbackMsg}`, 'error')
      }
    }
  }

  async close(): Promise<void> {
    if (!this.rlClosed) {
      this.rl.close()
      this.rlClosed = true
    }
    if (this.page && !this.page.isClosed()) {
      await this.page.close()
    }
  }
}
