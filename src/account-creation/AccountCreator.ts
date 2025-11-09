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

  /**
   * UTILITY: Find first visible element from list of selectors
   * Reserved for future use - simplifies selector fallback logic
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async findFirstVisible(selectors: string[], context: string): Promise<ReturnType<Page['locator']> | null> {
    for (const selector of selectors) {
      try {
        const element = this.page.locator(selector).first()
        const visible = await element.isVisible().catch(() => false)
        
        if (visible) {
          log(false, 'CREATOR', `[${context}] Found element: ${selector}`, 'log', 'green')
          return element
        }
      } catch {
        continue
      }
    }
    
    log(false, 'CREATOR', `[${context}] No visible element found`, 'warn', 'yellow')
    return null
  }

  /**
   * UTILITY: Retry an async operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries: number = 3,
    initialDelayMs: number = 1000
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log(false, 'CREATOR', `[${context}] Attempt ${attempt}/${maxRetries}`, 'log', 'cyan')
        const result = await operation()
        log(false, 'CREATOR', `[${context}] ✅ Success on attempt ${attempt}`, 'log', 'green')
        return result
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        log(false, 'CREATOR', `[${context}] Attempt ${attempt} failed: ${msg}`, 'warn', 'yellow')
        
        if (attempt < maxRetries) {
          const delayMs = initialDelayMs * Math.pow(2, attempt - 1)
          log(false, 'CREATOR', `[${context}] Retrying in ${delayMs}ms...`, 'log', 'yellow')
          await this.page.waitForTimeout(delayMs)
        } else {
          log(false, 'CREATOR', `[${context}] ❌ All attempts failed`, 'error')
          return null
        }
      }
    }
    
    return null
  }

  /**
   * CRITICAL: Wait for dropdown to be fully closed before continuing
   */
  private async waitForDropdownClosed(context: string, maxWaitMs: number = 5000): Promise<boolean> {
    log(false, 'CREATOR', `[${context}] Waiting for dropdown to close...`, 'log', 'cyan')
    
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitMs) {
      // Check if any dropdown menu is visible
      const dropdownSelectors = [
        'div[role="listbox"]',
        'ul[role="listbox"]',
        'div[role="menu"]',
        'ul[role="menu"]',
        '[class*="dropdown"][class*="open"]'
      ]
      
      let anyVisible = false
      for (const selector of dropdownSelectors) {
        const visible = await this.page.locator(selector).first().isVisible().catch(() => false)
        if (visible) {
          anyVisible = true
          break
        }
      }
      
      if (!anyVisible) {
        log(false, 'CREATOR', `[${context}] ✅ Dropdown closed`, 'log', 'green')
        return true
      }
      
      await this.page.waitForTimeout(500)
    }
    
    log(false, 'CREATOR', `[${context}] ⚠️ Dropdown may still be open`, 'warn', 'yellow')
    return false
  }

  /**
   * CRITICAL: Verify input value after filling
   */
  private async verifyInputValue(
    selector: string,
    expectedValue: string,
    context: string
  ): Promise<boolean> {
    try {
      const input = this.page.locator(selector).first()
      const actualValue = await input.inputValue().catch(() => '')
      
      if (actualValue === expectedValue) {
        log(false, 'CREATOR', `[${context}] ✅ Input value verified: ${expectedValue}`, 'log', 'green')
        return true
      } else {
        log(false, 'CREATOR', `[${context}] ⚠️ Value mismatch: expected "${expectedValue}", got "${actualValue}"`, 'warn', 'yellow')
        return false
      }
    } catch (error) {
      log(false, 'CREATOR', `[${context}] ⚠️ Could not verify input value`, 'warn', 'yellow')
      return false
    }
  }

  /**
   * CRITICAL: Verify no errors are displayed on the page
   * Returns true if no errors found, false if errors present
   */
  private async verifyNoErrors(context: string): Promise<boolean> {
    log(false, 'CREATOR', `[${context}] Checking for error messages...`, 'log', 'cyan')
    
    const errorSelectors = [
      'div[id*="Error"]',
      'div[id*="error"]',
      'div[class*="error"]',
      'div[role="alert"]',
      '[aria-invalid="true"]',
      'span[class*="error"]',
      '.error-message',
      '[data-bind*="errorMessage"]'
    ]
    
    for (const selector of errorSelectors) {
      try {
        const errorElement = this.page.locator(selector).first()
        const isVisible = await errorElement.isVisible().catch(() => false)
        
        if (isVisible) {
          const errorText = await errorElement.textContent().catch(() => 'Unknown error')
          log(false, 'CREATOR', `[${context}] ❌ Error detected: ${errorText}`, 'error')
          return false
        }
      } catch {
        continue
      }
    }
    
    log(false, 'CREATOR', `[${context}] ✅ No errors detected`, 'log', 'green')
    return true
  }

  /**
   * CRITICAL: Verify page transition was successful
   * Checks that new elements appeared AND old elements disappeared
   */
  private async verifyPageTransition(
    context: string,
    expectedNewSelectors: string[],
    expectedGoneSelectors: string[],
    timeoutMs: number = 15000
  ): Promise<boolean> {
    log(false, 'CREATOR', `[${context}] Verifying page transition...`, 'log', 'cyan')
    
    const startTime = Date.now()
    
    try {
      // STEP 1: Wait for at least ONE new element to appear
      log(false, 'CREATOR', `[${context}] Waiting for new page elements...`, 'log', 'cyan')
      
      let newElementFound = false
      for (const selector of expectedNewSelectors) {
        try {
          const element = this.page.locator(selector).first()
          await element.waitFor({ timeout: Math.min(5000, timeoutMs), state: 'visible' })
          log(false, 'CREATOR', `[${context}] ✅ New element appeared: ${selector}`, 'log', 'green')
          newElementFound = true
          break
        } catch {
          continue
        }
      }
      
      if (!newElementFound) {
        log(false, 'CREATOR', `[${context}] ❌ No new elements appeared - transition likely failed`, 'error')
        return false
      }
      
      // STEP 2: Verify old elements are gone
      log(false, 'CREATOR', `[${context}] Verifying old elements disappeared...`, 'log', 'cyan')
      
      await this.humanDelay(1000, 2000) // Give time for old elements to disappear
      
      for (const selector of expectedGoneSelectors) {
        try {
          const element = this.page.locator(selector).first()
          const stillVisible = await element.isVisible().catch(() => false)
          
          if (stillVisible) {
            log(false, 'CREATOR', `[${context}] ⚠️ Old element still visible: ${selector}`, 'warn', 'yellow')
            // Don't fail immediately - element might be animating out
          } else {
            log(false, 'CREATOR', `[${context}] ✅ Old element gone: ${selector}`, 'log', 'green')
          }
        } catch {
          // Element not found = good, it's gone
          log(false, 'CREATOR', `[${context}] ✅ Old element not found: ${selector}`, 'log', 'green')
        }
      }
      
      // STEP 3: Verify no errors on new page
      const noErrors = await this.verifyNoErrors(`${context}_TRANSITION`)
      if (!noErrors) {
        log(false, 'CREATOR', `[${context}] ❌ Errors found after transition`, 'error')
        return false
      }
      
      const elapsed = Date.now() - startTime
      log(false, 'CREATOR', `[${context}] ✅ Page transition verified (${elapsed}ms)`, 'log', 'green')
      
      return true
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log(false, 'CREATOR', `[${context}] ❌ Page transition verification failed: ${msg}`, 'error')
      return false
    }
  }

  /**
   * CRITICAL: Verify that a click action was successful
   * Checks that something changed after the click (URL, visible elements, etc.)
   */
  private async verifyClickSuccess(
    context: string,
    urlShouldChange: boolean = false,
    expectedNewSelectors: string[] = []
  ): Promise<boolean> {
    log(false, 'CREATOR', `[${context}] Verifying click was successful...`, 'log', 'cyan')
    
    const startUrl = this.page.url()
    
    // Wait a bit for changes to occur
    await this.humanDelay(2000, 3000)
    
    // Check 1: URL change (if expected)
    if (urlShouldChange) {
      const newUrl = this.page.url()
      if (newUrl === startUrl) {
        log(false, 'CREATOR', `[${context}] ⚠️ URL did not change (might be intentional)`, 'warn', 'yellow')
      } else {
        log(false, 'CREATOR', `[${context}] ✅ URL changed: ${startUrl} → ${newUrl}`, 'log', 'green')
        return true
      }
    }
    
    // Check 2: New elements appeared (if expected)
    if (expectedNewSelectors.length > 0) {
      for (const selector of expectedNewSelectors) {
        try {
          const element = this.page.locator(selector).first()
          const visible = await element.isVisible().catch(() => false)
          
          if (visible) {
            log(false, 'CREATOR', `[${context}] ✅ New element appeared: ${selector}`, 'log', 'green')
            return true
          }
        } catch {
          continue
        }
      }
      
      log(false, 'CREATOR', `[${context}] ⚠️ No expected elements appeared`, 'warn', 'yellow')
    }
    
    // Check 3: No errors appeared
    const noErrors = await this.verifyNoErrors(`${context}_CLICK`)
    if (!noErrors) {
      log(false, 'CREATOR', `[${context}] ❌ Errors appeared after click`, 'error')
      return false
    }
    
    log(false, 'CREATOR', `[${context}] ✅ Click appears successful`, 'log', 'green')
    return true
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
   * Checks for loading spinners, network activity, URL stability, and JS execution
   */
  private async waitForPageStable(context: string, maxWaitMs: number = 30000): Promise<boolean> {
    log(false, 'CREATOR', `[${context}] Waiting for page to be stable...`, 'log', 'cyan')
    
    const startTime = Date.now()
    const startUrl = this.page.url()
    
    try {
      // STEP 1: Wait for network to be idle
      await this.page.waitForLoadState('networkidle', { timeout: maxWaitMs })
      log(false, 'CREATOR', `[${context}] ✅ Network idle`, 'log', 'green')
      
      // STEP 2: Wait for DOM to be fully loaded
      await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {})
      
      // STEP 3: Check document.readyState
      const readyState = await this.page.evaluate(() => document.readyState).catch(() => 'unknown')
      log(false, 'CREATOR', `[${context}] Document readyState: ${readyState}`, 'log', 'cyan')
      
      // STEP 4: Additional delay to ensure everything is rendered and JS executed
      await this.humanDelay(3000, 5000)
      
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
      const passwordNextSuccess = await this.clickNext('password')
      if (!passwordNextSuccess) {
        log(false, 'CREATOR', '❌ Failed to proceed after password step', 'error')
        return null
      }

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
      const birthdateNextSuccess = await this.clickNext('birthdate')
      if (!birthdateNextSuccess) {
        log(false, 'CREATOR', '❌ Failed to proceed after birthdate step', 'error')
        return null
      }

      // Fill name fields
      const names = await this.fillNames(confirmedEmail)
      if (!names) {
        log(false, 'CREATOR', 'Failed to fill names', 'error')
        return null
      }

      // Click Next button
      const namesNextSuccess = await this.clickNext('names')
      if (!namesNextSuccess) {
        log(false, 'CREATOR', '❌ Failed to proceed after names step', 'error')
        return null
      }

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
    
    // CRITICAL: Retry fill with verification
    const emailFillSuccess = await this.retryOperation(
      async () => {
        await emailInput.clear()
        await this.humanDelay(800, 1500) // INCREASED from 500-1000
        await emailInput.fill(email)
        await this.humanDelay(1200, 2500) // INCREASED from 800-2000
        
        // Verify value was filled correctly
        const verified = await this.verifyInputValue('input[type="email"]', email, 'EMAIL_INPUT')
        if (!verified) {
          throw new Error('Email input value not verified')
        }
        
        return true
      },
      'EMAIL_FILL',
      3,
      1000
    )
    
    if (!emailFillSuccess) {
      log(false, 'CREATOR', 'Failed to fill email after retries', 'error')
      return null
    }
    
    log(false, 'CREATOR', 'Clicking Next button...', 'log')
    const nextBtn = this.page.locator('button[data-testid="primaryButton"], button[type="submit"]').first()
    await nextBtn.waitFor({ timeout: 15000 })
    
    // CRITICAL: Get current URL before clicking
    const urlBeforeClick = this.page.url()
    
    await nextBtn.click()
    await this.humanDelay(2000, 3000)
    await this.waitForPageStable('AFTER_EMAIL_SUBMIT', 20000)
    
    // CRITICAL: Verify the click had an effect
    log(false, 'CREATOR', 'Verifying email submission was processed...', 'log', 'cyan')
    const urlAfterClick = this.page.url()
    
    if (urlBeforeClick === urlAfterClick) {
      // URL didn't change - check if there's an error or if we're on password page
      const onPasswordPage = await this.page.locator('input[type="password"]').first().isVisible().catch(() => false)
      const hasError = await this.page.locator('div[id*="Error"], div[role="alert"]').first().isVisible().catch(() => false)
      
      if (!onPasswordPage && !hasError) {
        log(false, 'CREATOR', '⚠️ Email submission may have failed - no password field, no error', 'warn', 'yellow')
        log(false, 'CREATOR', 'Waiting longer for response...', 'log', 'cyan')
        await this.humanDelay(5000, 7000)
      }
    } else {
      log(false, 'CREATOR', `✅ URL changed: ${urlBeforeClick} → ${urlAfterClick}`, 'log', 'green')
    }
    
    const result = await this.handleEmailErrors(email)
    if (!result.success) {
      return null
    }
    
    // CRITICAL: Verify we can actually proceed (password page OR no error)
    const finalCheck = await this.verifyNoErrors('EMAIL_FINAL_CHECK')
    if (!finalCheck) {
      log(false, 'CREATOR', '❌ Email step has errors, cannot proceed', 'error')
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
    
    // CRITICAL: Retry fill with verification
    const retryFillSuccess = await this.retryOperation(
      async () => {
        await emailInput.clear()
        await this.humanDelay(800, 1500) // INCREASED from 500-1000
        await emailInput.fill(newEmail)
        await this.humanDelay(1200, 2500) // INCREASED from 800-2000
        
        // Verify value was filled correctly
        const verified = await this.verifyInputValue('input[type="email"]', newEmail, 'EMAIL_RETRY')
        if (!verified) {
          throw new Error('Email retry input value not verified')
        }
        
        return true
      },
      'EMAIL_RETRY_FILL',
      3,
      1000
    )
    
    if (!retryFillSuccess) {
      log(false, 'CREATOR', 'Failed to fill retry email', 'error')
      return { success: false, email: null }
    }
    
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

  private async clickNext(step: string): Promise<boolean> {
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
    
    // Get current URL and page state before clicking
    const urlBefore = this.page.url()
    
    await nextBtn.click()
    log(false, 'CREATOR', `✅ Clicked Next (${step})`, 'log', 'green')
    
    // CRITICAL: Wait for page to process the click
    await this.humanDelay(3000, 5000)
    
    // CRITICAL: Wait for page to be stable after clicking
    await this.waitForPageStable(`AFTER_NEXT_${step.toUpperCase()}`, 20000)
    
    // CRITICAL: Verify the click was successful
    const urlAfter = this.page.url()
    let clickSuccessful = false
    
    if (urlBefore !== urlAfter) {
      log(false, 'CREATOR', `✅ Navigation detected: ${urlBefore} → ${urlAfter}`, 'log', 'green')
      clickSuccessful = true
    } else {
      log(false, 'CREATOR', `URL unchanged after clicking Next (${step})`, 'log', 'yellow')
      
      // URL didn't change - this might be OK if content changed
      // Wait a bit more and check for errors
      await this.humanDelay(2000, 3000)
      
      const hasErrors = !(await this.verifyNoErrors(`NEXT_${step.toUpperCase()}`))
      if (hasErrors) {
        log(false, 'CREATOR', `❌ Errors detected after clicking Next (${step})`, 'error')
        return false
      }
      
      // No errors - assume success (some pages don't change URL)
      log(false, 'CREATOR', `No errors detected, assuming Next (${step}) was successful`, 'log', 'yellow')
      clickSuccessful = true
    }
    
    return clickSuccessful
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
    
    // CRITICAL: Retry fill with verification
    const passwordFillSuccess = await this.retryOperation(
      async () => {
        await passwordInput.clear()
        await this.humanDelay(800, 1500) // INCREASED from 500-1000
        await passwordInput.fill(password)
        await this.humanDelay(1200, 2500) // INCREASED from 800-2000
        
        // Verify value was filled correctly
        const verified = await this.verifyInputValue('input[type="password"]', password, 'PASSWORD_INPUT')
        if (!verified) {
          throw new Error('Password input value not verified')
        }
        
        return true
      },
      'PASSWORD_FILL',
      3,
      1000
    )
    
    if (!passwordFillSuccess) {
      log(false, 'CREATOR', 'Failed to fill password after retries', 'error')
      return null
    }
    
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
      
      // === DAY DROPDOWN ===
      const dayButton = this.page.locator('button[name="BirthDay"], button#BirthDayDropdown').first()
      await dayButton.waitFor({ timeout: 15000, state: 'visible' })
      
      log(false, 'CREATOR', 'Clicking day dropdown...', 'log')
      
      // CRITICAL: Retry click if it fails
      const dayClickSuccess = await this.retryOperation(
        async () => {
          await dayButton.click({ force: true })
          await this.humanDelay(1500, 2500) // INCREASED delay
          
          // Verify dropdown opened
          const dayOptionsContainer = this.page.locator('div[role="listbox"], ul[role="listbox"]').first()
          const isOpen = await dayOptionsContainer.isVisible().catch(() => false)
          
          if (!isOpen) {
            throw new Error('Day dropdown did not open')
          }
          
          return true
        },
        'DAY_DROPDOWN_OPEN',
        3,
        1000
      )
      
      if (!dayClickSuccess) {
        log(false, 'CREATOR', 'Failed to open day dropdown after retries', 'error')
        return null
      }
      
      log(false, 'CREATOR', '✅ Day dropdown opened', 'log', 'green')
      
      // Select day from dropdown
      log(false, 'CREATOR', `Selecting day: ${birthdate.day}`, 'log')
      const dayOption = this.page.locator(`div[role="option"]:has-text("${birthdate.day}"), li[role="option"]:has-text("${birthdate.day}")`).first()
      await dayOption.waitFor({ timeout: 5000, state: 'visible' })
      await dayOption.click()
      await this.humanDelay(1500, 2500) // INCREASED delay
      
      // CRITICAL: Wait for dropdown to FULLY close
      await this.waitForDropdownClosed('DAY_DROPDOWN', 8000)
      await this.humanDelay(2000, 3000) // INCREASED safety delay
      
      // === MONTH DROPDOWN ===
      const monthButton = this.page.locator('button[name="BirthMonth"], button#BirthMonthDropdown').first()
      await monthButton.waitFor({ timeout: 10000, state: 'visible' })
      
      log(false, 'CREATOR', 'Clicking month dropdown...', 'log')
      
      // CRITICAL: Retry click if it fails
      const monthClickSuccess = await this.retryOperation(
        async () => {
          await monthButton.click({ force: true })
          await this.humanDelay(1500, 2500) // INCREASED delay
          
          // Verify dropdown opened
          const monthOptionsContainer = this.page.locator('div[role="listbox"], ul[role="listbox"]').first()
          const isOpen = await monthOptionsContainer.isVisible().catch(() => false)
          
          if (!isOpen) {
            throw new Error('Month dropdown did not open')
          }
          
          return true
        },
        'MONTH_DROPDOWN_OPEN',
        3,
        1000
      )
      
      if (!monthClickSuccess) {
        log(false, 'CREATOR', 'Failed to open month dropdown after retries', 'error')
        return null
      }
      
      log(false, 'CREATOR', '✅ Month dropdown opened', 'log', 'green')
      
      // Select month by data-value attribute or by position
      log(false, 'CREATOR', `Selecting month: ${birthdate.month}`, 'log')
      const monthOption = this.page.locator(`div[role="option"][data-value="${birthdate.month}"], li[role="option"][data-value="${birthdate.month}"]`).first()
      
      // Fallback: if data-value doesn't work, try by index
      const monthVisible = await monthOption.isVisible().catch(() => false)
      if (monthVisible) {
        await monthOption.click()
        log(false, 'CREATOR', '✅ Month selected by data-value', 'log', 'green')
      } else {
        log(false, 'CREATOR', `Fallback: selecting month by nth-child(${birthdate.month})`, 'warn', 'yellow')
        const monthOptionByIndex = this.page.locator(`div[role="option"]:nth-child(${birthdate.month}), li[role="option"]:nth-child(${birthdate.month})`).first()
        await monthOptionByIndex.click()
      }
      await this.humanDelay(1500, 2500) // INCREASED delay
      
      // CRITICAL: Wait for dropdown to FULLY close
      await this.waitForDropdownClosed('MONTH_DROPDOWN', 8000)
      await this.humanDelay(2000, 3000) // INCREASED safety delay
      
      // === YEAR INPUT ===
      const yearInput = this.page.locator('input[name="BirthYear"], input[type="number"]').first()
      await yearInput.waitFor({ timeout: 10000, state: 'visible' })
      
      log(false, 'CREATOR', `Filling year: ${birthdate.year}`, 'log')
      
      // CRITICAL: Retry fill with verification
      const yearFillSuccess = await this.retryOperation(
        async () => {
          await yearInput.clear()
          await this.humanDelay(500, 1000)
          await yearInput.fill(birthdate.year.toString())
          await this.humanDelay(1000, 2000)
          
          // Verify value was filled correctly
          const verified = await this.verifyInputValue(
            'input[name="BirthYear"], input[type="number"]',
            birthdate.year.toString(),
            'YEAR_INPUT'
          )
          
          if (!verified) {
            throw new Error('Year input value not verified')
          }
          
          return true
        },
        'YEAR_FILL',
        3,
        1000
      )
      
      if (!yearFillSuccess) {
        log(false, 'CREATOR', 'Failed to fill year after retries', 'error')
        return null
      }
      
      log(false, 'CREATOR', `✅ Birthdate filled: ${birthdate.day}/${birthdate.month}/${birthdate.year}`, 'log', 'green')
      
      // CRITICAL: Verify no errors appeared after filling birthdate
      const noErrors = await this.verifyNoErrors('BIRTHDATE_VERIFICATION')
      if (!noErrors) {
        log(false, 'CREATOR', '❌ Errors detected after filling birthdate', 'error')
        return null
      }
      
      // CRITICAL: Verify Next button is enabled (indicates form is valid)
      await this.humanDelay(1000, 2000)
      const nextBtn = this.page.locator('button[data-testid="primaryButton"], button[type="submit"]').first()
      const nextEnabled = await nextBtn.isEnabled().catch(() => false)
      
      if (!nextEnabled) {
        log(false, 'CREATOR', '⚠️ Next button not enabled after filling birthdate', 'warn', 'yellow')
        log(false, 'CREATOR', 'Waiting for form validation...', 'log', 'cyan')
        await this.humanDelay(3000, 5000)
        
        const retryEnabled = await nextBtn.isEnabled().catch(() => false)
        if (!retryEnabled) {
          log(false, 'CREATOR', '❌ Next button still disabled - form may be invalid', 'error')
          return null
        }
      }
      
      log(false, 'CREATOR', '✅ Birthdate form validated successfully', 'log', 'green')
      
      // CRITICAL: Extra safety delay before submitting
      await this.humanDelay(2000, 3000)
      
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
      
      // CRITICAL: Retry fill with verification
      const firstNameFillSuccess = await this.retryOperation(
        async () => {
          await firstNameInput.clear()
          await this.humanDelay(800, 1500) // INCREASED from 500-1000
          await firstNameInput.fill(names.firstName)
          await this.humanDelay(1200, 2500) // INCREASED from 800-2000
          
          return true
        },
        'FIRSTNAME_FILL',
        3,
        1000
      )
      
      if (!firstNameFillSuccess) {
        log(false, 'CREATOR', 'Failed to fill first name after retries', 'error')
        return null
      }
      
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
      
      // CRITICAL: Retry fill with verification
      const lastNameFillSuccess = await this.retryOperation(
        async () => {
          await lastNameInput.clear()
          await this.humanDelay(800, 1500) // INCREASED from 500-1000
          await lastNameInput.fill(names.lastName)
          await this.humanDelay(1200, 2500) // INCREASED from 800-2000
          
          return true
        },
        'LASTNAME_FILL',
        3,
        1000
      )
      
      if (!lastNameFillSuccess) {
        log(false, 'CREATOR', 'Failed to fill last name after retries', 'error')
        return null
      }
      
      log(false, 'CREATOR', `✅ Names filled: ${names.firstName} ${names.lastName}`, 'log', 'green')
      
      // CRITICAL: Verify no errors appeared after filling names
      const noErrors = await this.verifyNoErrors('NAMES_VERIFICATION')
      if (!noErrors) {
        log(false, 'CREATOR', '❌ Errors detected after filling names', 'error')
        return null
      }
      
      // CRITICAL: Verify Next button is enabled (indicates form is valid)
      await this.humanDelay(1000, 2000)
      const nextBtn = this.page.locator('button[data-testid="primaryButton"], button[type="submit"]').first()
      const nextEnabled = await nextBtn.isEnabled().catch(() => false)
      
      if (!nextEnabled) {
        log(false, 'CREATOR', '⚠️ Next button not enabled after filling names', 'warn', 'yellow')
        log(false, 'CREATOR', 'Waiting for form validation...', 'log', 'cyan')
        await this.humanDelay(3000, 5000)
        
        const retryEnabled = await nextBtn.isEnabled().catch(() => false)
        if (!retryEnabled) {
          log(false, 'CREATOR', '❌ Next button still disabled - form may be invalid', 'error')
          return null
        }
      }
      
      log(false, 'CREATOR', '✅ Names form validated successfully', 'log', 'green')
      
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
          
          // CRITICAL: Wait MUCH longer for Microsoft to process
          log(false, 'CREATOR', 'Giving Microsoft extra time to process (15-20s)...', 'log', 'cyan')
          await this.humanDelay(15000, 20000) // INCREASED from 3-5s
          
          // CRITICAL: Wait for Microsoft to finish creating the account
          await this.waitForAccountCreation()
          
          // CRITICAL: Extra delay after account creation
          log(false, 'CREATOR', 'Account creation complete, stabilizing (10-15s)...', 'log', 'cyan')
          await this.humanDelay(10000, 15000)
          
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
    log(false, 'CREATOR', 'Waiting for page to stabilize after account creation...', 'log', 'cyan')
    await this.waitForPageStable('POST_CREATION', 40000) // INCREASED timeout
    
    // CRITICAL: Additional LONG safety delay
    log(false, 'CREATOR', 'Extra stabilization delay (10-15s)...', 'log', 'cyan')
    await this.humanDelay(10000, 15000) // INCREASED from 3-5s
    
    // CRITICAL: Handle passkey prompt - MUST REFUSE
    await this.handlePasskeyPrompt()
    
    // Additional delay between prompts
    await this.humanDelay(3000, 5000)
    
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
    
    // CRITICAL: Wait MUCH longer for passkey prompt to appear
    // Microsoft may show this after several seconds
    log(false, 'CREATOR', 'Waiting for potential passkey prompt (8-12s)...', 'log', 'cyan')
    await this.humanDelay(8000, 12000) // INCREASED from 5-7s
    
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
    await this.waitForPageStable('PRE_VERIFICATION', 20000) // INCREASED
    
    // CRITICAL: MUCH longer delay before navigation
    log(false, 'CREATOR', 'Extra delay before navigation (8-12s)...', 'log', 'cyan')
    await this.humanDelay(8000, 12000) // INCREASED from 3-5s
    
    // Navigate to Bing Rewards
    try {
      log(false, 'CREATOR', 'Navigating to rewards.bing.com...', 'log', 'cyan')
      
      await this.page.goto('https://rewards.bing.com/', { 
        waitUntil: 'networkidle',
        timeout: 60000
      })
      
      // CRITICAL: Wait for page to be fully stable after navigation
      await this.waitForPageStable('REWARDS_PAGE', 40000) // INCREASED
      
      // CRITICAL: MUCH longer safety delay for identity to load
      log(false, 'CREATOR', 'Waiting for user identity to fully load (10-15s)...', 'log', 'cyan')
      await this.humanDelay(10000, 15000) // INCREASED from 5-7s
      
      const currentUrl = this.page.url()
      log(false, 'CREATOR', `Current URL: ${currentUrl}`, 'log', 'cyan')
      
      // CRITICAL: Verify we're actually on rewards page and logged in
      if (!currentUrl.includes('rewards.bing.com')) {
        if (currentUrl.includes('login.live.com')) {
          log(false, 'CREATOR', '⚠️ Still on login page - account may not be fully activated', 'warn', 'yellow')
          
          // CRITICAL: Wait MUCH longer and retry
          log(false, 'CREATOR', 'Waiting longer before retry (15-20s)...', 'log', 'cyan')
          await this.humanDelay(15000, 20000) // INCREASED
          
          await this.page.goto('https://rewards.bing.com/', { 
            waitUntil: 'networkidle',
            timeout: 60000
          })
          await this.waitForPageStable('REWARDS_RETRY', 40000)
          await this.humanDelay(10000, 15000) // Additional delay after retry
        } else {
          log(false, 'CREATOR', `⚠️ Unexpected URL: ${currentUrl}`, 'warn', 'yellow')
        }
      }
      
      log(false, 'CREATOR', '✅ Successfully navigated to rewards.bing.com', 'log', 'green')
      
      // CRITICAL: Wait LONGER for user identity to load before declaring success
      log(false, 'CREATOR', 'Final wait for complete page load (8-12s)...', 'log', 'cyan')
      await this.humanDelay(8000, 12000) // INCREASED from 5-7s
        
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
        
        // CRITICAL: Wait MUCH longer and check again
        log(false, 'CREATOR', 'Waiting longer for identity (10-15s)...', 'log', 'cyan')
        await this.humanDelay(10000, 15000) // INCREASED from 5-7s
        
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
      log(false, 'CREATOR', 'Preparing to handle welcome tour and popups...', 'log', 'cyan')
      await this.humanDelay(5000, 8000) // INCREASED from 3-5s
      
      await this.handleRewardsWelcomeTour()
      
      log(false, 'CREATOR', 'Pausing between tour and popups...', 'log', 'cyan')
      await this.humanDelay(5000, 8000) // INCREASED from 3-5s
      
      await this.handleRewardsPopups()
      
      // If we have a referral URL, ensure we join via it
      if (this.referralUrl) {
        log(false, 'CREATOR', 'Preparing for referral enrollment...', 'log', 'cyan')
        await this.humanDelay(5000, 7000) // INCREASED from 3-4s
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
    await this.waitForPageStable('WELCOME_TOUR', 30000) // INCREASED
    
    // CRITICAL: MUCH longer delay for tour to appear
    log(false, 'CREATOR', 'Waiting for welcome tour to appear (8-12s)...', 'log', 'cyan')
    await this.humanDelay(8000, 12000) // INCREASED from 5-7s
    
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
          await this.humanDelay(4000, 6000) // INCREASED from 3-4s
          await this.waitForPageStable('AFTER_TOUR_NEXT', 20000) // INCREASED
          
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
    await this.waitForPageStable('REWARDS_POPUPS', 30000) // INCREASED
    
    // CRITICAL: Wait MUCH longer for any popups to appear
    log(false, 'CREATOR', 'Waiting for popups to appear (8-12s)...', 'log', 'cyan')
    await this.humanDelay(8000, 12000) // INCREASED from 5-7s
    
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
      // CRITICAL: Wait longer before clicking to ensure popup is fully loaded
      log(false, 'CREATOR', 'Referral popup found, waiting for it to stabilize (3-5s)...', 'log', 'cyan')
      await this.humanDelay(3000, 5000) // INCREASED from 2-3s
      
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
          await this.humanDelay(4000, 6000) // INCREASED from 3-4s
          await this.waitForPageStable('AFTER_GET_STARTED', 20000) // INCREASED
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
      await this.waitForPageStable('REFERRAL_ENROLLMENT', 40000) // INCREASED
      
      // CRITICAL: Longer additional delay
      log(false, 'CREATOR', 'Stabilizing after referral navigation (8-12s)...', 'log', 'cyan')
      await this.humanDelay(8000, 12000) // INCREASED from 5-7s
      
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
          await this.humanDelay(5000, 8000) // INCREASED from 3-5s
          await this.waitForPageStable('AFTER_JOIN', 30000) // INCREASED
          log(false, 'CREATOR', '✅ Clicked Join button', 'log', 'green')
          joined = true
          break
        }
      }
      
      if (!joined) {
        log(false, 'CREATOR', 'Join button not found - account may already be enrolled', 'log', 'yellow')
      }
      
      // CRITICAL: Wait MUCH longer for enrollment to complete and page to stabilize
      log(false, 'CREATOR', 'Waiting for enrollment to complete...', 'log', 'cyan')
      await this.waitForPageStable('POST_ENROLLMENT', 40000) // INCREASED
      await this.humanDelay(10000, 15000) // INCREASED from 5-7s
      
      // Handle any popups after joining - with LONGER delays between
      log(false, 'CREATOR', 'Handling post-enrollment popups...', 'log', 'cyan')
      await this.humanDelay(5000, 8000) // INCREASED from 3-5s
      await this.handleRewardsWelcomeTour()
      await this.humanDelay(5000, 8000) // INCREASED from 3-5s
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
