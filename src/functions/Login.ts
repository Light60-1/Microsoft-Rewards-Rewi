import { AxiosRequestConfig } from 'axios'
import * as crypto from 'crypto'
import type { Locator, Page } from 'playwright'
import readline from 'readline'

import { MicrosoftRewardsBot } from '../index'
import { OAuth } from '../interface/OAuth'
import { waitForElementSmart, waitForPageReady } from '../util/browser/SmartWait'
import { Retry } from '../util/core/Retry'
import { logError } from '../util/notifications/Logger'
import { generateTOTP } from '../util/security/Totp'
import { saveSessionData } from '../util/state/Load'
import { LoginState, LoginStateDetector } from '../util/validation/LoginStateDetector'

// -------------------------------
// REFACTORING NOTE (1700+ lines)
// -------------------------------
// This file violates Single Responsibility Principle. Consider splitting into:
// - LoginFlow.ts (main orchestration)
// - TotpHandler.ts (2FA/TOTP logic)
// - PasskeyHandler.ts (passkey/biometric prompts)
// - RecoveryHandler.ts (recovery email detection)
// - SecurityDetector.ts (ban/block detection)
// This will improve maintainability and testability.
// -------------------------------

// -------------------------------
// Constants / Tunables
// -------------------------------
const SELECTORS = {
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  submitBtn: 'button[type="submit"]',
  passkeySecondary: 'button[data-testid="secondaryButton"]',
  passkeyPrimary: 'button[data-testid="primaryButton"]',
  passkeyTitle: '[data-testid="title"]',
  kmsiVideo: '[data-testid="kmsiVideo"]',
  biometricVideo: '[data-testid="biometricVideo"]'
} as const

const LOGIN_TARGET = { host: 'rewards.bing.com', path: '/' }

// Centralized timeouts to replace magic numbers throughout the file
const DEFAULT_TIMEOUTS = {
  loginMaxMs: (() => {
    const val = Number(process.env.LOGIN_MAX_WAIT_MS || 180000)
    return (!Number.isFinite(val) || val < 10000 || val > 600000) ? 180000 : val
  })(),
  short: 200,
  medium: 800,
  long: 1500,
  veryLong: 2000,
  extraLong: 3000,
  oauthMaxMs: 180000,
  portalWaitMs: 15000,
  elementCheck: 100,
  fastPoll: 500,
  emailFieldWait: 8000,
  passwordFieldWait: 4000,
  rewardsPortalCheck: 8000,
  navigationTimeout: 30000,
  navigationTimeoutLinux: 60000,
  totpThrottle: 5000,
  totpWait: 1200,
  passkeyNoPromptLog: 10000,
  twoFactorTimeout: 120000,
  bingVerificationMaxIterations: 10,
  bingVerificationMaxIterationsMobile: 8
} as const

// Security pattern bundle
const SIGN_IN_BLOCK_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /we can['’`]?t sign you in/i, label: 'cant-sign-in' },
  { re: /incorrect account or password too many times/i, label: 'too-many-incorrect' },
  { re: /used an incorrect account or password too many times/i, label: 'too-many-incorrect-variant' },
  { re: /sign-in has been blocked/i, label: 'sign-in-blocked-phrase' },
  { re: /your account has been locked/i, label: 'account-locked' }
]

interface SecurityIncident {
  kind: string
  account: string
  details?: string[]
  next?: string[]
  docsUrl?: string
}

export class Login {
  private bot: MicrosoftRewardsBot
  private clientId = '0000000040170455'
  private authBaseUrl = 'https://login.live.com/oauth20_authorize.srf'
  private redirectUrl = 'https://login.live.com/oauth20_desktop.srf'
  private tokenUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
  private scope = 'service::prod.rewardsplatform.microsoft.com::MBI_SSL'

  private currentTotpSecret?: string
  private compromisedInterval?: NodeJS.Timeout
  private passkeyHandled = false
  private noPromptIterations = 0
  private lastNoPromptLog = 0
  private lastTotpSubmit = 0
  private totpAttempts = 0

  constructor(bot: MicrosoftRewardsBot) {
    this.bot = bot
    this.cleanupCompromisedInterval()
  }

  /**
   * Reusable navigation with retry logic and chrome-error recovery
   * Eliminates duplicate navigation code throughout the file
   */
  private async navigateWithRetry(
    page: Page,
    url: string,
    context: string,
    maxAttempts = 3
  ): Promise<{ success: boolean; recoveryUsed: boolean }> {
    const isLinux = process.platform === 'linux'
    const navigationTimeout = isLinux ? DEFAULT_TIMEOUTS.navigationTimeoutLinux : DEFAULT_TIMEOUTS.navigationTimeout

    let navigationSucceeded = false
    let recoveryUsed = false
    let attempts = 0

    while (!navigationSucceeded && attempts < maxAttempts) {
      attempts++
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: navigationTimeout
        })
        navigationSucceeded = true
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)

        // Chrome-error recovery pattern
        if (errorMsg.includes('chrome-error://chromewebdata/')) {
          this.bot.log(this.bot.isMobile, context, `Navigation interrupted by chrome-error (attempt ${attempts}/${maxAttempts}), attempting recovery...`, 'warn')

          await this.bot.utils.wait(DEFAULT_TIMEOUTS.long)

          try {
            await page.reload({ waitUntil: 'domcontentloaded', timeout: navigationTimeout })
            navigationSucceeded = true
            recoveryUsed = true
            this.bot.log(this.bot.isMobile, context, '✓ Recovery successful via reload')
          } catch (reloadError) {
            if (attempts < maxAttempts) {
              this.bot.log(this.bot.isMobile, context, `Reload failed (attempt ${attempts}/${maxAttempts}), trying fresh navigation...`, 'warn')
              await this.bot.utils.wait(DEFAULT_TIMEOUTS.veryLong)
            } else {
              throw reloadError
            }
          }
        } else if (errorMsg.includes('ERR_PROXY_CONNECTION_FAILED') || errorMsg.includes('ERR_TUNNEL_CONNECTION_FAILED')) {
          this.bot.log(this.bot.isMobile, context, `Proxy connection failed (attempt ${attempts}/${maxAttempts}): ${errorMsg}`, 'warn')
          if (attempts < maxAttempts) {
            await this.bot.utils.wait(DEFAULT_TIMEOUTS.extraLong * attempts)
          } else {
            throw new Error(`Proxy connection failed for ${context} - check proxy configuration`)
          }
        } else if (attempts < maxAttempts) {
          this.bot.log(this.bot.isMobile, context, `Navigation failed (attempt ${attempts}/${maxAttempts}): ${errorMsg}`, 'warn')
          await this.bot.utils.wait(DEFAULT_TIMEOUTS.veryLong * attempts)
        } else {
          throw error
        }
      }
    }

    return { success: navigationSucceeded, recoveryUsed }
  }

  // --------------- Public API ---------------
  async login(page: Page, email: string, password: string, totpSecret?: string) {
    try {
      this.cleanupCompromisedInterval()

      this.bot.log(this.bot.isMobile, 'LOGIN', 'Starting login process')
      this.currentTotpSecret = (totpSecret && totpSecret.trim()) || undefined
      this.lastTotpSubmit = 0
      this.totpAttempts = 0

      const resumed = await this.tryReuseExistingSession(page)
      if (resumed) {
        const needsVerification = !page.url().includes('rewards.bing.com')
        if (needsVerification) {
          await this.verifyBingContext(page)
        }
        await saveSessionData(this.bot.config.sessionPath, page.context(), email, this.bot.isMobile)
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Session restored')
        this.currentTotpSecret = undefined
        return
      }

      // IMPROVEMENT: Use centralized navigation retry logic
      const { success: navigationSucceeded, recoveryUsed } = await this.navigateWithRetry(
        page,
        'https://www.bing.com/rewards/dashboard',
        'LOGIN'
      )

      if (!navigationSucceeded) {
        throw new Error('Failed to navigate to dashboard after multiple attempts')
      }

      // Only check for HTTP 400 if recovery was NOT used (to avoid double reload)
      if (!recoveryUsed) {
        await this.bot.utils.wait(DEFAULT_TIMEOUTS.fastPoll)
        const content = await page.content().catch(() => '')
        const hasHttp400 = content.includes('HTTP ERROR 400') ||
          content.includes('This page isn\'t working') ||
          content.includes('This page is not working')

        if (hasHttp400) {
          this.bot.log(this.bot.isMobile, 'LOGIN', 'HTTP 400 detected in content, reloading...', 'warn')
          const isLinux = process.platform === 'linux'
          const timeout = isLinux ? DEFAULT_TIMEOUTS.navigationTimeoutLinux : DEFAULT_TIMEOUTS.navigationTimeout
          await page.reload({ waitUntil: 'domcontentloaded', timeout })
          await this.bot.utils.wait(DEFAULT_TIMEOUTS.medium)
        }
      }

      await this.disableFido(page)

      const [reloadResult, totpResult, portalCheck] = await Promise.allSettled([
        this.bot.browser.utils.reloadBadPage(page),
        this.tryAutoTotp(page, 'initial landing'),
        page.waitForSelector('html[data-role-name="RewardsPortal"]', { timeout: 3000 })
      ])

      // Log any failures for debugging (non-critical)
      if (reloadResult.status === 'rejected') {
        this.bot.log(this.bot.isMobile, 'LOGIN', `Reload check failed (non-critical): ${reloadResult.reason}`, 'warn')
      }
      if (totpResult.status === 'rejected') {
        this.bot.log(this.bot.isMobile, 'LOGIN', `Auto-TOTP check failed (non-critical): ${totpResult.reason}`, 'warn')
      }

      await this.checkAccountLocked(page)

      const alreadyAuthenticated = portalCheck.status === 'fulfilled'
      if (!alreadyAuthenticated) {
        await this.performLoginFlow(page, email, password)
      } else {
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Already authenticated')
      }

      const needsBingVerification = !page.url().includes('rewards.bing.com')
      if (needsBingVerification) {
        await this.verifyBingContext(page)
      }

      await saveSessionData(this.bot.config.sessionPath, page.context(), email, this.bot.isMobile)
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Login complete')
      this.currentTotpSecret = undefined
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      const stackTrace = e instanceof Error ? e.stack : undefined
      this.bot.log(this.bot.isMobile, 'LOGIN', `Failed login: ${errorMessage}${stackTrace ? '\nStack: ' + stackTrace.split('\n').slice(0, 3).join(' | ') : ''}`, 'error')
      throw new Error(`Login failed for ${email}: ${errorMessage}`)
    } finally {
      // Always cleanup compromised interval to prevent memory leaks
      // The interval is only used during active login sessions
      this.cleanupCompromisedInterval()
    }
  }

  async getMobileAccessToken(page: Page, email: string, totpSecret?: string) {
    this.currentTotpSecret = (totpSecret && totpSecret.trim()) || undefined
    this.lastTotpSubmit = 0
    this.totpAttempts = 0

    await this.disableFido(page)
    const url = new URL(this.authBaseUrl)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', this.clientId)
    url.searchParams.set('redirect_uri', this.redirectUrl)
    url.searchParams.set('scope', this.scope)
    url.searchParams.set('state', crypto.randomBytes(16).toString('hex'))
    url.searchParams.set('access_type', 'offline_access')
    url.searchParams.set('login_hint', email)

    // Use centralized navigation retry logic
    const { success: navigationSucceeded, recoveryUsed } = await this.navigateWithRetry(
      page,
      url.href,
      'LOGIN-APP'
    )

    if (!navigationSucceeded) {
      throw new Error('Failed to navigate to OAuth page after multiple attempts')
    }

    if (!recoveryUsed) {
      await this.bot.utils.wait(DEFAULT_TIMEOUTS.fastPoll)
      const content = await page.content().catch((err) => {
        this.bot.log(this.bot.isMobile, 'LOGIN-APP', `Failed to get page content for HTTP 400 check: ${err}`, 'warn')
        return ''
      })
      const hasHttp400 = content.includes('HTTP ERROR 400') ||
        content.includes('This page isn\'t working') ||
        content.includes('This page is not working')

      if (hasHttp400) {
        this.bot.log(this.bot.isMobile, 'LOGIN-APP', 'HTTP 400 detected, reloading...', 'warn')
        const isLinux = process.platform === 'linux'
        const timeout = isLinux ? DEFAULT_TIMEOUTS.navigationTimeoutLinux : DEFAULT_TIMEOUTS.navigationTimeout
        await page.reload({ waitUntil: 'domcontentloaded', timeout })
        await this.bot.utils.wait(DEFAULT_TIMEOUTS.medium)
      }
    }
    const start = Date.now()
    this.bot.log(this.bot.isMobile, 'LOGIN-APP', 'Authorizing mobile scope...')
    let code = ''
    let lastLogTime = start
    let checkCount = 0

    while (Date.now() - start < DEFAULT_TIMEOUTS.oauthMaxMs) {
      checkCount++

      const u = new URL(page.url())
      if (u.hostname === 'login.live.com' && u.pathname === '/oauth20_desktop.srf') {
        code = u.searchParams.get('code') || ''
        if (code) break
      }

      if (checkCount % 3 === 0) {
        await Promise.allSettled([
          this.handlePasskeyPrompts(page, 'oauth'),
          this.tryAutoTotp(page, 'mobile-oauth')
        ])
      }

      const now = Date.now()
      if (now - lastLogTime > 30000) {
        const elapsed = Math.round((now - start) / 1000)
        this.bot.log(this.bot.isMobile, 'LOGIN-APP', `Waiting for OAuth code... (${elapsed}s, URL: ${u.hostname}${u.pathname})`, 'warn')
        lastLogTime = now
      }

      const pollDelay = Date.now() - start < 30000 ? 800 : 1500
      await this.bot.utils.wait(pollDelay)
    }
    if (!code) {
      const elapsed = Math.round((Date.now() - start) / 1000)
      const currentUrl = page.url()
      this.bot.log(this.bot.isMobile, 'LOGIN-APP', `OAuth code not received after ${elapsed}s. Current URL: ${currentUrl}`, 'error')
      throw new Error(`OAuth code not received within ${DEFAULT_TIMEOUTS.oauthMaxMs / 1000}s`)
    }

    this.bot.log(this.bot.isMobile, 'LOGIN-APP', `OAuth code received in ${Math.round((Date.now() - start) / 1000)}s`)

    const form = new URLSearchParams()
    form.append('grant_type', 'authorization_code')
    form.append('client_id', this.clientId)
    form.append('code', code)
    form.append('redirect_uri', this.redirectUrl)

    const isRetryable = (e: unknown): boolean => {
      if (!e || typeof e !== 'object') return false
      const err = e as { response?: { status?: number }; code?: string }
      const status = err.response?.status
      // IMPROVED: More comprehensive retry conditions for OAuth token exchange
      return status === 502 || status === 503 || status === 504 || status === 429 ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNREFUSED'
    }

    const req: AxiosRequestConfig = {
      url: this.tokenUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: form.toString()
    }

    // IMPROVED: Use more aggressive retry policy for OAuth token exchange (critical operation)
    const oauthRetryPolicy = {
      maxAttempts: 5,           // Increased from default 3
      baseDelay: 2000,          // Increased from default 1000ms
      maxDelay: 60000,          // 60 seconds max delay
      multiplier: 2,
      jitter: 0.3               // More jitter to avoid thundering herd
    }
    const retry = new Retry(oauthRetryPolicy)
    try {
      const resp = await retry.run(
        () => this.bot.axios.request(req),
        isRetryable
      )
      const data: OAuth = resp.data
      this.bot.log(this.bot.isMobile, 'LOGIN-APP', `Authorized in ${Math.round((Date.now() - start) / 1000)}s`)
      this.currentTotpSecret = undefined
      return data.access_token
    } catch (error) {
      this.currentTotpSecret = undefined
      const err = error as { response?: { status?: number }; message?: string }
      const statusCode = err.response?.status
      const errMsg = err.message || String(error)
      if (statusCode) {
        this.bot.log(this.bot.isMobile, 'LOGIN-APP', `Token exchange failed after ${oauthRetryPolicy.maxAttempts} retries with status ${statusCode}: ${errMsg}`, 'error')
      } else {
        this.bot.log(this.bot.isMobile, 'LOGIN-APP', `Token exchange failed after ${oauthRetryPolicy.maxAttempts} retries (network error): ${errMsg}`, 'error')
      }
      throw new Error(`OAuth token exchange failed: ${statusCode ? `HTTP ${statusCode}` : 'Network error'} - ${errMsg}`)
    } finally {
      // Always cleanup compromised interval to prevent memory leaks
      this.cleanupCompromisedInterval()
    }
  }

  // --------------- Main Flow ---------------
  private async tryReuseExistingSession(page: Page): Promise<boolean> {
    const homeUrl = 'https://rewards.bing.com/'
    try {
      // Use centralized navigation retry logic
      const { success: navigationSucceeded, recoveryUsed } = await this.navigateWithRetry(
        page,
        homeUrl,
        'LOGIN'
      )

      if (!navigationSucceeded) return false

      await page.waitForLoadState('domcontentloaded').catch(logError('LOGIN', 'DOMContentLoaded timeout', this.bot.isMobile))

      // Only check HTTP 400 if recovery was NOT used
      if (!recoveryUsed) {
        await this.bot.utils.wait(DEFAULT_TIMEOUTS.fastPoll)
        const content = await page.content().catch(() => '')
        const hasHttp400 = content.includes('HTTP ERROR 400') ||
          content.includes('This page isn\'t working') ||
          content.includes('This page is not working')

        if (hasHttp400) {
          this.bot.log(this.bot.isMobile, 'LOGIN', 'HTTP 400 on session check, reloading...', 'warn')
          const isLinux = process.platform === 'linux'
          const timeout = isLinux ? DEFAULT_TIMEOUTS.navigationTimeoutLinux : DEFAULT_TIMEOUTS.navigationTimeout
          await page.reload({ waitUntil: 'domcontentloaded', timeout })
          await this.bot.utils.wait(DEFAULT_TIMEOUTS.medium)
        }
      }
      await this.bot.browser.utils.reloadBadPage(page)
      await this.bot.utils.wait(250)

      // IMPROVED: Increased timeout from 3.5s to 8s for slow connections
      let portalSelector = await this.waitForRewardsRoot(page, 8000)

      // IMPROVED: Retry once if initial check failed
      if (!portalSelector) {
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Portal not detected (8s), retrying once...', 'warn')
        await this.bot.utils.wait(1000)
        await this.bot.browser.utils.reloadBadPage(page)
        portalSelector = await this.waitForRewardsRoot(page, 5000)
      }

      if (portalSelector) {
        // Additional validation: make sure we're not just on the page but actually logged in
        // Check if we're redirected to login
        const currentUrl = page.url()
        if (currentUrl.includes('login.live.com') || currentUrl.includes('login.microsoftonline.com')) {
          this.bot.log(this.bot.isMobile, 'LOGIN', 'Detected redirect to login page - session not valid', 'warn')
          return false
        }

        this.bot.log(this.bot.isMobile, 'LOGIN', `✅ Existing session still valid (${portalSelector}) — saved 2-3 minutes!`)
        await this.checkAccountLocked(page)
        return true
      }

      if (await this.tryAutoTotp(page, 'session reuse probe')) {
        await this.bot.utils.wait(900)
        const postTotp = await this.waitForRewardsRoot(page, 5000)
        if (postTotp) {
          this.bot.log(this.bot.isMobile, 'LOGIN', `Existing session unlocked via TOTP (${postTotp})`)
          await this.checkAccountLocked(page)
          return true
        }
      }

      // Check for passkeys AFTER TOTP attempt (correct order)
      const currentUrl = page.url()
      if (currentUrl.includes('login.live.com') || currentUrl.includes('login.microsoftonline.com')) {
        await this.handlePasskeyPrompts(page, 'main')
      }
    } catch { /* Expected: Session reuse attempt may fail if expired/invalid */ }
    return false
  }

  private async performLoginFlow(page: Page, email: string, password: string) {
    // Step 0: Check if we're already past email entry (TOTP, passkey, or logged in)
    const currentState = await LoginStateDetector.detectState(page)
    
    if (currentState.state === LoginState.TwoFactorRequired) {
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Already at 2FA page, skipping email entry')
      await this.inputPasswordOr2FA(page, password)
      await this.checkAccountLocked(page)
      await this.awaitRewardsPortal(page)
      return
    }
    
    if (currentState.state === LoginState.LoggedIn) {
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Already logged in, skipping login flow')
      return
    }

    // Step 1: Input email (only if on email page)
    await this.inputEmail(page, email)

    // Step 2: Wait for transition to password page (silent - no spam)
    // FIXED: Use timeoutMs parameter with 10s timeout
    await waitForPageReady(page, {
      timeoutMs: 10000
    })

    const passwordPageReached = await LoginStateDetector.waitForAnyState(
      page,
      [LoginState.PasswordPage, LoginState.TwoFactorRequired, LoginState.LoggedIn],
      8000
    )

    if (passwordPageReached === LoginState.LoggedIn) {
      // Double-check: verify we're actually on rewards portal with activities
      const actuallyLoggedIn = await page.locator('#more-activities, html[data-role-name*="RewardsPortal"]')
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)

      if (actuallyLoggedIn) {
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Already authenticated after email (fast path)')
        return
      } else {
        this.bot.log(this.bot.isMobile, 'LOGIN', 'False positive on LoggedIn state, continuing with password entry', 'warn')
        // Continue to password entry
      }
    }

    if (!passwordPageReached) {
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Password page not reached, continuing...', 'warn')
    } else if (passwordPageReached !== LoginState.LoggedIn) {
      this.bot.log(this.bot.isMobile, 'LOGIN', `State: ${passwordPageReached}`)
    }

    // OPTIMIZED: Remove unnecessary wait, reloadBadPage is already slow
    await this.bot.browser.utils.reloadBadPage(page)

    // Step 3: Recovery mismatch check
    await this.tryRecoveryMismatchCheck(page, email)
    if (this.bot.compromisedModeActive && this.bot.compromisedReason === 'recovery-mismatch') {
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Recovery mismatch detected – stopping before password entry', 'warn')
      return
    }

    // Step 4: Try switching to password if needed
    await this.switchToPasswordLink(page)

    // Step 5: Input password or handle 2FA
    await this.inputPasswordOr2FA(page, password)
    if (this.bot.compromisedModeActive && this.bot.compromisedReason === 'sign-in-blocked') {
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Blocked sign-in detected — halting.', 'warn')
      return
    }

    // Step 6: Final checks
    await this.checkAccountLocked(page)
    await this.awaitRewardsPortal(page)
  }

  // --------------- Input Steps ---------------
  private async inputEmail(page: Page, email: string) {
    // CRITICAL FIX: Check if we're actually on the email page first
    const currentUrl = page.url()
    if (!currentUrl.includes('login.live.com') && !currentUrl.includes('login.microsoftonline.com')) {
      this.bot.log(this.bot.isMobile, 'LOGIN', `Not on login page (URL: ${currentUrl}), skipping email entry`, 'warn')
      return
    }

    // IMPROVED: Smart page readiness check (silent - no spam logs)
    // Using default 10s timeout
    const readyResult = await waitForPageReady(page)

    // Only log if REALLY slow (>5s indicates a problem)
    if (readyResult.timeMs > 5000) {
      this.bot.log(this.bot.isMobile, 'LOGIN', `Page load slow: ${readyResult.timeMs}ms`, 'warn')
    }

    // CRITICAL FIX: Check for TOTP/Passkey prompts BEFORE looking for email field
    const state = await LoginStateDetector.detectState(page)
    if (state.state === LoginState.TwoFactorRequired) {
      this.bot.log(this.bot.isMobile, 'LOGIN', 'TOTP/2FA detected before email entry, handling...', 'warn')
      if (await this.tryAutoTotp(page, 'pre-email TOTP')) {
        await this.bot.utils.wait(500)
        return // Email already submitted, skip to next step
      }
    }

            if (state.state === LoginState.LoggedIn) {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Already logged in, skipping email entry')
                return
            }    // IMPROVED: Smart element waiting (silent)
    let emailResult = await waitForElementSmart(page, SELECTORS.emailInput, {
      initialTimeoutMs: 2000,
      extendedTimeoutMs: 5000,
      state: 'visible'
    })

    if (!emailResult.found) {
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Email field not found, retrying...', 'warn')

      const totpHandled = await this.tryAutoTotp(page, 'pre-email challenge')
      if (totpHandled) {
        await this.bot.utils.wait(500) // REDUCED: 800ms → 500ms
        emailResult = await waitForElementSmart(page, SELECTORS.emailInput, {
          initialTimeoutMs: 2000,
          extendedTimeoutMs: 5000,
          state: 'visible'
        })
      }
    }

    if (!emailResult.found) {
      // Try one more time with page reload if needed
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Email field missing, checking page state...', 'warn')
      await this.bot.utils.wait(100)

      // IMPROVED: Smart page content check and conditional reload
      const content = await page.content().catch(() => '')
      if (content.length < 1000) {
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Reloading page...', 'warn')
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { })
        await waitForPageReady(page) // Silent - using default 10s timeout
      }

      const totpRetry = await this.tryAutoTotp(page, 'pre-email retry')
      if (totpRetry) {
        await this.bot.utils.wait(500) // REDUCED: 800ms → 500ms
      }

      emailResult = await waitForElementSmart(page, SELECTORS.emailInput, {
        initialTimeoutMs: 2000,
        extendedTimeoutMs: 5000,
        state: 'visible'
      })

      if (!emailResult.found) {
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Email field not present after all retries', 'error')
        throw new Error('Login form email field not found after multiple attempts')
      }
    }

    // IMPROVED: Smart check for prefilled email
    const prefilledResult = await waitForElementSmart(page, '#userDisplayName', {
      initialTimeoutMs: 500,
      extendedTimeoutMs: 1000,
      state: 'visible'
    })

    if (!prefilledResult.found) {
      await page.fill(SELECTORS.emailInput, '')
      await page.fill(SELECTORS.emailInput, email)
    } else {
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Email prefilled')
    }

    // IMPROVED: Smart submit button wait
    const submitResult = await waitForElementSmart(page, SELECTORS.submitBtn, {
      initialTimeoutMs: 500,
      extendedTimeoutMs: 1500,
      state: 'visible'
    })

    if (submitResult.found && submitResult.element) {
      await submitResult.element.click().catch(e => this.bot.log(this.bot.isMobile, 'LOGIN', `Email submit click failed: ${e}`, 'warn'))
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Submitted email')
    }
  }

  private async inputPasswordOr2FA(page: Page, password: string) {
    // IMPROVED: Smart check for password switch button
    const switchResult = await waitForElementSmart(page, '#idA_PWD_SwitchToPassword', {
      initialTimeoutMs: 500,
      extendedTimeoutMs: 1000,
      state: 'visible'
    })

    if (switchResult.found && switchResult.element) {
      await switchResult.element.click().catch(e => this.bot.log(this.bot.isMobile, 'LOGIN', `Switch to password failed: ${e}`, 'warn'))
      await this.bot.utils.wait(300) // REDUCED: 500ms → 300ms
    }

    // Early TOTP check - if totpSecret is configured, check for TOTP challenge before password
    if (this.currentTotpSecret) {
      const totpDetected = await this.tryAutoTotp(page, 'pre-password TOTP check')
      if (totpDetected) {
        this.bot.log(this.bot.isMobile, 'LOGIN', 'TOTP challenge appeared before password entry')
        return
      }
    }

    // IMPROVED: Smart password field waiting
    let passwordResult = await waitForElementSmart(page, SELECTORS.passwordInput, {
      initialTimeoutMs: 1500,
      extendedTimeoutMs: 3000,
      state: 'visible'
    })

    if (!passwordResult.found) {
      // Wait a bit and retry (page might still be loading)
      await this.bot.utils.wait(500)
      passwordResult = await waitForElementSmart(page, SELECTORS.passwordInput, {
        initialTimeoutMs: 1500,
        extendedTimeoutMs: 2500,
        state: 'visible'
      })
    }

    if (!passwordResult.found) {
      const blocked = await this.detectSignInBlocked(page)
      if (blocked) return
      // If still no password field -> likely 2FA (approvals) first
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Password field absent — invoking 2FA handler', 'warn')
      await this.handle2FA(page)
      return
    }

    const blocked = await this.detectSignInBlocked(page)
    if (blocked) return

    await page.fill(SELECTORS.passwordInput, '')
    await page.fill(SELECTORS.passwordInput, password)

    // IMPROVED: Smart submit button wait
    const submitResult = await waitForElementSmart(page, SELECTORS.submitBtn, {
      initialTimeoutMs: 500,
      extendedTimeoutMs: 1500,
      state: 'visible'
    })

    if (submitResult.found && submitResult.element) {
      await submitResult.element.click().catch(e => this.bot.log(this.bot.isMobile, 'LOGIN', `Password submit failed: ${e}`, 'warn'))
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Password submitted')
    }
  }

  // --------------- 2FA Handling ---------------
  private async handle2FA(page: Page) {
    try {
      // Dismiss any popups/dialogs before checking 2FA (Terms Update, etc.)
      await this.bot.browser.utils.tryDismissAllMessages(page)
      await this.bot.utils.wait(500)

      const usedTotp = await this.tryAutoTotp(page, '2FA initial step')
      if (usedTotp) return

      const number = await this.fetchAuthenticatorNumber(page)
      if (number) { await this.approveAuthenticator(page, number); return }
      await this.handleSMSOrTotp(page)
    } catch (e) {
      this.bot.log(this.bot.isMobile, 'LOGIN', '2FA error: ' + e, 'warn')
    }
  }

  private async fetchAuthenticatorNumber(page: Page): Promise<string | null> {
    try {
      const el = await page.waitForSelector('#displaySign, div[data-testid="displaySign"]>span', { timeout: 2500 })
      return (await el.textContent())?.trim() || null
    } catch {
      // Attempt resend loop in parallel mode
      if (this.bot.config.parallel) {
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Parallel mode: throttling authenticator push requests', 'log', 'yellow')
        for (let attempts = 0; attempts < 6; attempts++) { // max 6 minutes retry window
          const resend = await page.waitForSelector('button[aria-describedby="pushNotificationsTitle errorDescription"]', { timeout: 1500 }).catch(() => null)
          if (!resend) break
          await this.bot.utils.wait(60000)
          await resend.click().catch(logError('LOGIN', 'Resend click failed', this.bot.isMobile))
        }
      }
      await page.click('button[aria-describedby="confirmSendTitle"]').catch(logError('LOGIN', 'Confirm send click failed', this.bot.isMobile))
      await this.bot.utils.wait(1500)
      try {
        const el = await page.waitForSelector('#displaySign, div[data-testid="displaySign"]>span', { timeout: 2000 })
        return (await el.textContent())?.trim() || null
      } catch { return null }
    }
  }

  private async approveAuthenticator(page: Page, numberToPress: string) {
    for (let cycle = 0; cycle < 6; cycle++) { // max ~6 refresh cycles
      try {
        this.bot.log(this.bot.isMobile, 'LOGIN', `Approve login in Authenticator (press ${numberToPress})`)
        await page.waitForSelector('form[name="f1"]', { state: 'detached', timeout: 60000 })
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Authenticator approval successful')
        return
      } catch {
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Authenticator code expired – refreshing')
        const retryBtn = await page.waitForSelector(SELECTORS.passkeyPrimary, { timeout: 3000 }).catch(() => null)
        if (retryBtn) await retryBtn.click().catch(logError('LOGIN-AUTH', 'Refresh button click failed', this.bot.isMobile))
        const refreshed = await this.fetchAuthenticatorNumber(page)
        if (!refreshed) { this.bot.log(this.bot.isMobile, 'LOGIN', 'Could not refresh authenticator code', 'warn'); return }
        numberToPress = refreshed
      }
    }
    this.bot.log(this.bot.isMobile, 'LOGIN', 'Authenticator approval loop exited (max cycles reached)', 'warn')
  }

  private async handleSMSOrTotp(page: Page) {
    // TOTP auto entry (second chance if ensureTotpInput needed longer)
    const usedTotp = await this.tryAutoTotp(page, 'manual 2FA entry')
    if (usedTotp) return

    // Manual prompt with 120s timeout
    this.bot.log(this.bot.isMobile, 'LOGIN', 'Waiting for user 2FA code (SMS / Email / App fallback)')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

    try {
      // FIXED: Add 120s timeout with proper cleanup to prevent memory leak
      let timeoutHandle: NodeJS.Timeout | undefined
      const code = await Promise.race([
        new Promise<string>(res => {
          rl.question('Enter 2FA code:\n', ans => {
            if (timeoutHandle) clearTimeout(timeoutHandle)
            rl.close()
            res(ans.trim())
          })
        }),
        new Promise<string>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            rl.close()
            reject(new Error('2FA code input timeout after 120s'))
          }, 120000)
        })
      ])

      // Check if input field still exists before trying to fill
      const inputExists = await page.locator('input[name="otc"]').first().isVisible({ timeout: 1000 }).catch(() => false)
      if (!inputExists) {
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Page changed while waiting for code (user progressed manually)', 'warn')
        return
      }

      // Fill code and submit
      await page.fill('input[name="otc"]', code)
      await page.keyboard.press('Enter')
      this.bot.log(this.bot.isMobile, 'LOGIN', '2FA code submitted')
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        this.bot.log(this.bot.isMobile, 'LOGIN', '2FA code input timeout (120s) - user AFK', 'error')
        throw error
      }
      // Other errors, just log and continue
      this.bot.log(this.bot.isMobile, 'LOGIN', '2FA code entry error: ' + error, 'warn')
    } finally {
      try {
        rl.close()
      } catch {
        // Intentionally silent: readline interface already closed or error during cleanup
        // This is a cleanup operation that shouldn't throw
      }
    }
  }

  private async ensureTotpInput(page: Page): Promise<string | null> {
    const selector = await this.findFirstTotpInput(page)
    if (selector) return selector

    const attempts = 4
    for (let i = 0; i < attempts; i++) {
      let acted = false

      // Step 1: expose alternative verification options if hidden
      if (!acted) {
        acted = await this.clickFirstVisibleSelector(page, Login.TOTP_SELECTORS.altOptions)
        if (acted) await this.bot.utils.wait(900)
      }

      // Step 2: choose authenticator code option if available
      if (!acted) {
        acted = await this.clickFirstVisibleSelector(page, Login.TOTP_SELECTORS.challenge)
        if (acted) await this.bot.utils.wait(900)
      }

      const ready = await this.findFirstTotpInput(page)
      if (ready) return ready

      if (!acted) break
    }

    return null
  }

  private async submitTotpCode(page: Page, selector: string) {
    try {
      const code = generateTOTP(this.currentTotpSecret!.trim())
      const input = page.locator(selector).first()
      if (!await input.isVisible().catch(() => false)) {
        this.bot.log(this.bot.isMobile, 'LOGIN', 'TOTP input unexpectedly hidden', 'warn')
        return
      }
      await input.fill('')
      await input.fill(code)
      // Use unified selector system
      const submit = await this.findFirstVisibleLocator(page, Login.TOTP_SELECTORS.submit)
      if (submit) {
        await submit.click().catch(logError('LOGIN-TOTP', 'Auto-submit click failed', this.bot.isMobile))
      } else {
        await page.keyboard.press('Enter').catch(logError('LOGIN-TOTP', 'Auto-submit Enter failed', this.bot.isMobile))
      }
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Submitted TOTP automatically')
    } catch (error) {
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Failed to submit TOTP automatically: ' + error, 'warn')
    }
  }

  // Unified selector system - DRY principle
  private static readonly TOTP_SELECTORS = {
    input: [
      'input[name="otc"]',
      '#idTxtBx_SAOTCC_OTC',
      '#idTxtBx_SAOTCS_OTC',
      'input[data-testid="otcInput"]',
      'input[autocomplete="one-time-code"]',
      'input[type="tel"][name="otc"]',
      'input[id^="floatingLabelInput"]'
    ],
    altOptions: [
      '#idA_SAOTCS_ProofPickerChange',
      '#idA_SAOTCC_AlternateLogin',
      'a:has-text("Use a different verification option")',
      'a:has-text("Sign in another way")',
      'a:has-text("I can\'t use my Microsoft Authenticator app right now")',
      'button:has-text("Use a different verification option")',
      'button:has-text("Sign in another way")'
    ],
    challenge: [
      '[data-value="PhoneAppOTP"]',
      '[data-value="OneTimeCode"]',
      'button:has-text("Use a verification code")',
      'button:has-text("Enter code manually")',
      'button:has-text("Enter a code from your authenticator app")',
      'button:has-text("Use code from your authentication app")',
      'button:has-text("Utiliser un code de vérification")',
      'button:has-text("Entrer un code depuis votre application")',
      'button:has-text("Entrez un code")',
      'div[role="button"]:has-text("Use a verification code")',
      'div[role="button"]:has-text("Enter a code")'
    ],
    submit: [
      '#idSubmit_SAOTCC_Continue',
      '#idSubmit_SAOTCC_OTC',
      'button[type="submit"]:has-text("Verify")',
      'button[type="submit"]:has-text("Continuer")',
      'button:has-text("Verify")',
      'button:has-text("Continuer")',
      'button:has-text("Submit")',
      'button[type="submit"]:has-text("Next")',
      'button:has-text("Next")',
      'button[data-testid="primaryButton"]:has-text("Next")'
    ]
  } as const

  // Locate the most likely authenticator input on the page using heuristics
  private async findFirstTotpInput(page: Page): Promise<string | null> {
    const headingHint = await this.detectTotpHeading(page)
    for (const sel of Login.TOTP_SELECTORS.input) {
      const loc = page.locator(sel).first()
      if (await loc.isVisible().catch(() => false)) {
        if (await this.isLikelyTotpInput(page, loc, sel, headingHint)) {
          if (sel.includes('floatingLabelInput')) {
            const idAttr = await loc.getAttribute('id')
            if (idAttr) return `#${idAttr}`
          }
          return sel
        }
      }
    }
    return null
  }

  private async isLikelyTotpInput(page: Page, locator: Locator, selector: string, headingHint: string | null): Promise<boolean> {
    try {
      if (!await locator.isVisible().catch(() => false)) return false

      const attr = async (name: string) => (await locator.getAttribute(name) || '').toLowerCase()
      const type = await attr('type')

      // Explicit exclusions: never treat email or password fields as TOTP
      if (type === 'email' || type === 'password') return false

      const nameAttr = await attr('name')
      // Explicit exclusions: login/email/password field names
      if (nameAttr.includes('loginfmt') || nameAttr.includes('passwd') || nameAttr.includes('email') || nameAttr.includes('login')) return false

      // Strong positive signals for TOTP
      if (nameAttr.includes('otc') || nameAttr.includes('otp') || nameAttr.includes('code')) return true

      const autocomplete = await attr('autocomplete')
      if (autocomplete.includes('one-time')) return true

      const inputmode = await attr('inputmode')
      if (inputmode === 'numeric') return true

      const pattern = await locator.getAttribute('pattern') || ''
      if (pattern && /\d/.test(pattern)) return true

      const aria = await attr('aria-label')
      if (aria.includes('code') || aria.includes('otp') || aria.includes('authenticator')) return true

      const placeholder = await attr('placeholder')
      if (placeholder.includes('code') || placeholder.includes('security') || placeholder.includes('authenticator')) return true

      if (/otc|otp/.test(selector)) return true

      const idAttr = await attr('id')
      if (idAttr.startsWith('floatinglabelinput')) {
        if (headingHint || await this.detectTotpHeading(page)) return true
      }
      if (selector.toLowerCase().includes('floatinglabelinput')) {
        if (headingHint || await this.detectTotpHeading(page)) return true
      }

      const maxLength = await locator.getAttribute('maxlength')
      if (maxLength && Number(maxLength) > 0 && Number(maxLength) <= 8) return true

      const dataTestId = await attr('data-testid')
      if (dataTestId.includes('otc') || dataTestId.includes('otp')) return true

      const labelText = await locator.evaluate(node => {
        const label = node.closest('label')
        if (label && label.textContent) return label.textContent
        const describedBy = node.getAttribute('aria-describedby')
        if (!describedBy) return ''
        const parts = describedBy.split(/\s+/).filter(Boolean)
        const texts: string[] = []
        parts.forEach(id => {
          const el = document.getElementById(id)
          if (el && el.textContent) texts.push(el.textContent)
        })
        return texts.join(' ')
      }).catch(() => '')

      if (labelText && /code|otp|authenticator|sécurité|securité|security/i.test(labelText)) return true
      if (headingHint && /code|otp|authenticator/i.test(headingHint.toLowerCase())) return true
    } catch {/* fall through to false */ }

    return false
  }

  private async detectTotpHeading(page: Page): Promise<string | null> {
    const headings = page.locator('[data-testid="title"], h1, h2, div[role="heading"]')
    const count = await headings.count().catch(() => 0)
    const max = Math.min(count, 6)
    for (let i = 0; i < max; i++) {
      const text = (await headings.nth(i).textContent().catch(() => null))?.trim()
      if (!text) continue
      const lowered = text.toLowerCase()
      if (/authenticator/.test(lowered) && /code/.test(lowered)) return text
      if (/code de vérification|code de verification|code de sécurité|code de securité/.test(lowered)) return text
      if (/enter your security code|enter your code/.test(lowered)) return text
    }
    return null
  }

  private async clickFirstVisibleSelector(page: Page, selectors: readonly string[]): Promise<boolean> {
    for (const sel of selectors) {
      const loc = page.locator(sel).first()
      if (await loc.isVisible().catch(() => false)) {
        await loc.click().catch(logError('LOGIN', `Click failed for selector: ${sel}`, this.bot.isMobile))
        return true
      }
    }
    return false
  }

  private async findFirstVisibleLocator(page: Page, selectors: readonly string[]): Promise<Locator | null> {
    for (const sel of selectors) {
      const loc = page.locator(sel).first()
      if (await loc.isVisible().catch(() => false)) return loc
    }
    return null
  }

  private async waitForRewardsRoot(page: Page, timeoutMs: number): Promise<string | null> {
    const selectors = [
      'html[data-role-name="RewardsPortal"]',
      'html[data-role-name*="RewardsPortal"]',
      'body[data-role-name*="RewardsPortal"]',
      '[data-role-name*="RewardsPortal"]',
      '[data-bi-name="rewards-dashboard"]',
      'main[data-bi-name="dashboard"]',
      '#more-activities',
      '#dashboard',
      '[class*="rewards"]',
      '[id*="rewards-dashboard"]',
      'main.dashboard-container',
      '.dashboard-content',
      '[data-bi-area="rewards"]',
      '.rewards-container',
      '#rewards-app',
      '[role="main"]'
    ]

    const start = Date.now()
    let lastLogTime = start
    let checkCount = 0

    while (Date.now() - start < timeoutMs) {
      checkCount++

      // OPTIMIZATION: Fast URL check first (no DOM query needed)
      const url = page.url()
      const isRewardsDomain = url.includes('rewards.bing.com') || url.includes('rewards.microsoft.com')

      if (isRewardsDomain) {
        // OPTIMIZATION: Parallel checks for authenticated state
        const [hasContent, notLoggedIn, hasAuthIndicators] = await Promise.all([
          page.evaluate(() => document.body && document.body.innerText.length > 100).catch(() => false),
          page.evaluate(() => {
            const signInSelectors = ['a[href*="signin"]', 'button:has-text("Sign in")', '[data-bi-id*="signin"]']
            for (const sel of signInSelectors) {
              try {
                const elements = document.querySelectorAll(sel)
                for (const el of elements) {
                  const text = el.textContent?.toLowerCase() || ''
                  if (text.includes('sign in') && (el as HTMLElement).offsetParent !== null) {
                    return true
                  }
                }
              } catch { /* DOM query may fail if element structure changes */ }
            }
            return false
          }).catch(() => false),
          page.evaluate(() => {
            const authSelectors = ['#id_n', '[id*="point"]', '[class*="userProfile"]', '#more-activities']
            for (const sel of authSelectors) {
              try {
                const el = document.querySelector(sel)
                if (el && (el as HTMLElement).offsetParent !== null) return true
              } catch { /* DOM query may fail if element structure changes */ }
            }
            return false
          }).catch(() => false)
        ])

        if (hasContent && !notLoggedIn && hasAuthIndicators) {
          this.bot.log(this.bot.isMobile, 'LOGIN', 'Rewards page detected (authenticated)')
          return 'rewards-url-authenticated'
        }

        if (hasContent && notLoggedIn) {
          this.bot.log(this.bot.isMobile, 'LOGIN', 'On rewards page but not authenticated yet', 'warn')
        }
      }

      // OPTIMIZATION: Check selectors in batches for speed
      if (checkCount % 2 === 0) { // Every other iteration
        for (const sel of selectors) {
          const loc = page.locator(sel).first()
          if (await loc.isVisible().catch(() => false)) {
            return sel
          }
        }
      }

      // Progress logging
      const now = Date.now()
      if (now - lastLogTime > 5000) {
        const elapsed = Math.round((now - start) / 1000)
        this.bot.log(this.bot.isMobile, 'LOGIN', `Still waiting for portal... (${elapsed}s, URL: ${url})`, 'warn')
        lastLogTime = now
      }

      // OPTIMIZATION: Adaptive polling
      const pollDelay = Date.now() - start < 5000 ? DEFAULT_TIMEOUTS.elementCheck : DEFAULT_TIMEOUTS.short
      await this.bot.utils.wait(pollDelay)
    }
    return null
  }

  // --------------- Verification / State ---------------
  private async awaitRewardsPortal(page: Page) {
    const start = Date.now()
    let lastUrl = ''
    let checkCount = 0

    // EARLY EXIT: Check if already logged in immediately
    const initialState = await LoginStateDetector.detectState(page)
    if (initialState.state === LoginState.LoggedIn) {
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Already on rewards portal (early exit)')
      return
    }

    while (Date.now() - start < DEFAULT_TIMEOUTS.loginMaxMs) {
      checkCount++

      const currentUrl = page.url()
      if (currentUrl !== lastUrl) {
        // REMOVED: Navigation logs are spam, only log if debug mode
        if (process.env.DEBUG_REWARDS_VERBOSE === '1') {
          this.bot.log(this.bot.isMobile, 'LOGIN', `Navigation: ${currentUrl}`)
        }
        lastUrl = currentUrl
      }

      // SMART CHECK: Use LoginStateDetector every 5 iterations for fast detection
      if (checkCount % 5 === 0) {
        const state = await LoginStateDetector.detectState(page)
        if (state.state === LoginState.LoggedIn) {
          this.bot.log(this.bot.isMobile, 'LOGIN', `State detector confirmed: ${state.state} (confidence: ${state.confidence})`)
          break
        }
        if (state.state === LoginState.Blocked) {
          this.bot.log(this.bot.isMobile, 'LOGIN', 'Blocked state detected during portal wait', 'error')
          throw new Error('Account blocked during login')
        }
      }

      // OPTIMIZATION: Quick URL check first
      const u = new URL(currentUrl)
      const isRewardsHost = u.hostname === LOGIN_TARGET.host
      const isKnownPath = u.pathname === LOGIN_TARGET.path
        || u.pathname === '/dashboard'
        || u.pathname === '/rewardsapp/dashboard'
        || u.pathname.startsWith('/?')
      if (isRewardsHost && isKnownPath) break

      // OPTIMIZATION: Handle prompts only every 3rd check
      if (checkCount % 3 === 0) {
        await Promise.allSettled([
          this.handlePasskeyPrompts(page, 'main'),
          this.tryAutoTotp(page, 'post-password wait')
        ])
      } else {
        await this.handlePasskeyPrompts(page, 'main')
      }

      // OPTIMIZATION: Adaptive wait
      const waitTime = Date.now() - start < 10000 ? DEFAULT_TIMEOUTS.fastPoll : 1000
      await this.bot.utils.wait(waitTime)
    }

    this.bot.log(this.bot.isMobile, 'LOGIN', 'Checking for portal elements...')
    const portalSelector = await this.waitForRewardsRoot(page, DEFAULT_TIMEOUTS.portalWaitMs)

    if (!portalSelector) {
      this.bot.log(this.bot.isMobile, 'LOGIN', 'Portal not found, trying goHome() fallback...', 'warn')

      try {
        await this.bot.browser.func.goHome(page)
        await this.bot.utils.wait(1500) // Reduced from 2000ms
      } catch (e) {
        this.bot.log(this.bot.isMobile, 'LOGIN', `goHome() failed: ${e instanceof Error ? e.message : String(e)}`, 'warn')
      }

      this.bot.log(this.bot.isMobile, 'LOGIN', 'Retry: checking for portal elements...')
      const fallbackSelector = await this.waitForRewardsRoot(page, DEFAULT_TIMEOUTS.portalWaitMs)

      if (!fallbackSelector) {
        const currentUrl = page.url()
        this.bot.log(this.bot.isMobile, 'LOGIN', `Current URL: ${currentUrl}`, 'error')

        // OPTIMIZATION: Get page info in one evaluation
        const pageContent = await page.evaluate(() => {
          return {
            title: document.title,
            bodyLength: document.body?.innerText?.length || 0,
            hasRewardsText: document.body?.innerText?.toLowerCase().includes('rewards') || false,
            visibleElements: document.querySelectorAll('*[data-role-name], *[data-bi-name], main, #dashboard').length
          }
        }).catch(() => ({ title: 'unknown', bodyLength: 0, hasRewardsText: false, visibleElements: 0 }))

        this.bot.log(this.bot.isMobile, 'LOGIN', `Page info: ${JSON.stringify(pageContent)}`, 'error')
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Portal element missing', 'error')
        throw new Error(`Rewards portal not detected. URL: ${currentUrl}. Check reports/ folder`)
      }
      this.bot.log(this.bot.isMobile, 'LOGIN', `Portal found via fallback (${fallbackSelector})`)
      return
    }

    this.bot.log(this.bot.isMobile, 'LOGIN', `Portal found (${portalSelector})`)
  }

  private async tryAutoTotp(page: Page, context: string): Promise<boolean> {
    if (!this.currentTotpSecret) return false
    const throttleMs = 5000
    if (Date.now() - this.lastTotpSubmit < throttleMs) return false

    const selector = await this.ensureTotpInput(page)
    if (!selector) return false

    if (this.totpAttempts >= 3) {
      const errMsg = 'TOTP challenge still present after multiple attempts; verify authenticator secret or approvals.'
      this.bot.log(this.bot.isMobile, 'LOGIN', errMsg, 'error')
      throw new Error(errMsg)
    }

    this.bot.log(this.bot.isMobile, 'LOGIN', `Detected TOTP challenge during ${context}; submitting code automatically`)
    await this.submitTotpCode(page, selector)
    this.totpAttempts += 1
    this.lastTotpSubmit = Date.now()
    await this.bot.utils.wait(1200)
    return true
  }

  private async verifyBingContext(page: Page) {
    try {
      this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'Verifying Bing auth context')

      const verificationUrl = 'https://www.bing.com/fd/auth/signin?action=interactive&provider=windows_live_id&return_url=https%3A%2F%2Fwww.bing.com%2F'

      // Use centralized navigation retry logic
      const { success: navigationSucceeded } = await this.navigateWithRetry(
        page,
        verificationUrl,
        'LOGIN-BING'
      )

      if (!navigationSucceeded) {
        this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'Bing verification navigation failed after multiple attempts', 'warn')
        return
      }

      await this.bot.utils.wait(DEFAULT_TIMEOUTS.medium)
      const content = await page.content().catch(() => '')
      const hasHttp400 = content.includes('HTTP ERROR 400') ||
        content.includes('This page isn\'t working') ||
        content.includes('This page is not working')

      if (hasHttp400) {
        this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'HTTP 400 detected during Bing verification, reloading...', 'warn')
        const isLinux = process.platform === 'linux'
        const timeout = isLinux ? DEFAULT_TIMEOUTS.navigationTimeoutLinux : DEFAULT_TIMEOUTS.navigationTimeout
        await page.reload({ waitUntil: 'domcontentloaded', timeout }).catch(logError('LOGIN-BING', 'Reload after HTTP 400 failed', this.bot.isMobile))
        await this.bot.utils.wait(DEFAULT_TIMEOUTS.medium)
      }

      const maxIterations = this.bot.isMobile ? DEFAULT_TIMEOUTS.bingVerificationMaxIterationsMobile : DEFAULT_TIMEOUTS.bingVerificationMaxIterations
      for (let i = 0; i < maxIterations; i++) {
        const u = new URL(page.url())

        if (u.hostname === 'www.bing.com' && u.pathname === '/') {
          await this.bot.browser.utils.tryDismissAllMessages(page)

          const ok = await page.waitForSelector('#id_n', { timeout: 3000 }).then(() => true).catch(() => false)
          if (ok) {
            this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'Bing verification passed (user profile detected)')
            return
          }

          if (this.bot.isMobile) {
            this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'Bing verification passed (mobile mode - profile check skipped)')
            return
          }
        }

        if (u.hostname.includes('login.live.com') || u.hostname.includes('login.microsoftonline.com')) {
          await this.handlePasskeyPrompts(page, 'main')
          await this.tryAutoTotp(page, 'bing-verification')
        }

        const waitTime = i < 3 ? 1000 : 1500
        await this.bot.utils.wait(waitTime)
      }

      const finalUrl = page.url()
      if (finalUrl.includes('www.bing.com')) {
        this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'Bing verification completed (on Bing domain, assuming success)')
      } else {
        this.bot.log(this.bot.isMobile, 'LOGIN-BING', `Bing verification uncertain - final URL: ${finalUrl}`, 'warn')
      }

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      this.bot.log(this.bot.isMobile, 'LOGIN-BING', `Bing verification error: ${errorMsg}`, 'warn')

      if (errorMsg.includes('Proxy connection failed')) {
        this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'Skipping Bing verification due to proxy issues - continuing anyway', 'warn')
      } else {
        this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'Bing verification failed but continuing login process', 'warn')
      }
    }
  }

  private async checkAccountLocked(page: Page) {
    const locked = await page.waitForSelector('#serviceAbuseLandingTitle', { timeout: 1200 }).then(() => true).catch(() => false)
    if (locked) {
      this.bot.log(this.bot.isMobile, 'CHECK-LOCKED', 'Account locked by Microsoft (serviceAbuseLandingTitle)', 'error')
      throw new Error('Account locked by Microsoft - please review account status')
    }
  }

  // --------------- Passkey / Dialog Handling ---------------
  private async handlePasskeyPrompts(page: Page, context: 'main' | 'oauth') {
    let did = false

    // IMPROVED: Use smart element detection with very short timeouts (passkey prompts are rare)
    // Priority 1: Direct detection of "Skip for now" button by data-testid
    const skipBtnResult = await waitForElementSmart(page, 'button[data-testid="secondaryButton"]', {
      initialTimeoutMs: 300,
      extendedTimeoutMs: 500,
      state: 'visible'
    })

    if (skipBtnResult.found && skipBtnResult.element) {
      const text = (await skipBtnResult.element.textContent() || '').trim()
      // Check if it's actually a skip button (could be other secondary buttons)
      if (/skip|later|not now|non merci|pas maintenant/i.test(text)) {
        await skipBtnResult.element.click().catch(logError('LOGIN-PASSKEY', 'Skip button click failed', this.bot.isMobile))
        did = true
        this.logPasskeyOnce('data-testid secondaryButton')
      }
    }

    // Priority 2: Video heuristic (biometric prompt)
    if (!did) {
      const biometricResult = await waitForElementSmart(page, SELECTORS.biometricVideo, {
        initialTimeoutMs: 300,
        extendedTimeoutMs: 500,
        state: 'visible'
      })

      if (biometricResult.found) {
        const btnResult = await waitForElementSmart(page, SELECTORS.passkeySecondary, {
          initialTimeoutMs: 200,
          extendedTimeoutMs: 300,
          state: 'visible'
        })
        if (btnResult.found && btnResult.element) {
          await btnResult.element.click().catch(logError('LOGIN-PASSKEY', 'Video heuristic click failed', this.bot.isMobile))
          did = true
          this.logPasskeyOnce('video heuristic')
        }
      }
    }

    // Priority 3: Title + secondary button detection
    if (!did) {
      const titleResult = await waitForElementSmart(page, SELECTORS.passkeyTitle, {
        initialTimeoutMs: 300,
        extendedTimeoutMs: 500,
        state: 'attached'
      })

      if (titleResult.found && titleResult.element) {
        const title = (await titleResult.element.textContent() || '').trim()
        const looksLike = /sign in faster|passkey|fingerprint|face|pin|empreinte|visage|windows hello|hello/i.test(title)

        if (looksLike) {
          const secBtnResult = await waitForElementSmart(page, SELECTORS.passkeySecondary, {
            initialTimeoutMs: 200,
            extendedTimeoutMs: 300,
            state: 'visible'
          })

          if (secBtnResult.found && secBtnResult.element) {
            await secBtnResult.element.click().catch(logError('LOGIN-PASSKEY', 'Title heuristic click failed', this.bot.isMobile))
            did = true
            this.logPasskeyOnce('title heuristic ' + title)
          }
        }
      }

      // Check secondary button text if title heuristic didn't work
      if (!did) {
        const secBtnResult = await waitForElementSmart(page, SELECTORS.passkeySecondary, {
          initialTimeoutMs: 200,
          extendedTimeoutMs: 300,
          state: 'visible'
        })

        if (secBtnResult.found && secBtnResult.element) {
          const text = (await secBtnResult.element.textContent() || '').trim()
          if (/skip for now|not now|later|passer|plus tard/i.test(text)) {
            await secBtnResult.element.click().catch(logError('LOGIN-PASSKEY', 'Secondary button text click failed', this.bot.isMobile))
            did = true
            this.logPasskeyOnce('secondary button text')
          }
        }
      }
    }

    // Priority 4: XPath fallback (includes Windows Hello specific patterns)
    if (!did) {
      const textBtn = await page.locator('xpath=//button[contains(normalize-space(.),"Skip for now") or contains(normalize-space(.),"Not now") or contains(normalize-space(.),"Passer") or contains(normalize-space(.),"No thanks")]').first()
      // FIXED: Add explicit timeout to isVisible
      if (await textBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await textBtn.click().catch(logError('LOGIN-PASSKEY', 'XPath fallback click failed', this.bot.isMobile))
        did = true
        this.logPasskeyOnce('xpath fallback')
      }
    }

    // Priority 4.5: Windows Hello specific detection
    if (!did) {
      // FIXED: Add explicit timeout
      const windowsHelloTitle = await page.locator('text=/windows hello/i').first().isVisible({ timeout: 500 }).catch(() => false)
      if (windowsHelloTitle) {
        // Try common Windows Hello skip patterns
        const skipPatterns = [
          'button:has-text("Skip")',
          'button:has-text("No thanks")',
          'button:has-text("Maybe later")',
          'button:has-text("Cancel")',
          '[data-testid="secondaryButton"]',
          'button[class*="secondary"]'
        ]
        for (const pattern of skipPatterns) {
          const btn = await page.locator(pattern).first()
          // FIXED: Add explicit timeout
          if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
            await btn.click().catch(logError('LOGIN-PASSKEY', 'Windows Hello skip failed', this.bot.isMobile))
            did = true
            this.logPasskeyOnce('Windows Hello skip')
            break
          }
        }
      }
    }

    // Priority 5: Close button fallback (FIXED: Add explicit timeout instead of using page.$)
    if (!did) {
      const closeResult = await waitForElementSmart(page, '#close-button', {
        initialTimeoutMs: 300,
        extendedTimeoutMs: 500,
        state: 'visible'
      })

      if (closeResult.found && closeResult.element) {
        await closeResult.element.click().catch(logError('LOGIN-PASSKEY', 'Close button fallback failed', this.bot.isMobile))
        did = true
        this.logPasskeyOnce('close button')
      }
    }

    // KMSI prompt
    const kmsi = await page.waitForSelector(SELECTORS.kmsiVideo, { timeout: 400 }).catch(() => null)
    if (kmsi) {
      const yes = await page.$(SELECTORS.passkeyPrimary)
      if (yes) {
        await yes.click().catch(logError('LOGIN-KMSI', 'KMSI accept click failed', this.bot.isMobile))
        did = true
        this.bot.log(this.bot.isMobile, 'LOGIN-KMSI', 'Accepted KMSI prompt')
      }
    }

    if (!did && context === 'main') {
      this.noPromptIterations++
      const now = Date.now()
      if (this.noPromptIterations === 1 || now - this.lastNoPromptLog > 10000) {
        this.lastNoPromptLog = now
        this.bot.log(this.bot.isMobile, 'LOGIN-NO-PROMPT', `No dialogs (x${this.noPromptIterations})`)
        if (this.noPromptIterations > 50) this.noPromptIterations = 0
      }
    } else if (did) {
      this.noPromptIterations = 0
    }
  }

  private logPasskeyOnce(reason: string) {
    if (this.passkeyHandled) return
    this.passkeyHandled = true
    this.bot.log(this.bot.isMobile, 'LOGIN-PASSKEY', `Dismissed passkey prompt (${reason})`)
  }

  // --------------- Security Detection ---------------
  private async detectSignInBlocked(page: Page): Promise<boolean> {
    if (this.bot.compromisedModeActive && this.bot.compromisedReason === 'sign-in-blocked') return true
    try {
      let text = ''
      for (const sel of ['[data-testid="title"]', 'h1', 'div[role="heading"]', 'div.text-title']) {
        const el = await page.waitForSelector(sel, { timeout: 600 }).catch(() => null)
        if (el) {
          const t = (await el.textContent() || '').trim()
          if (t && t.length < 300) text += ' ' + t
        }
      }
      const lower = text.toLowerCase()
      let matched: string | null = null
      for (const p of SIGN_IN_BLOCK_PATTERNS) { if (p.re.test(lower)) { matched = p.label; break } }
      if (!matched) return false
      const email = this.bot.currentAccountEmail || 'unknown'
      const docsUrl = this.getDocsUrl('we-cant-sign-you-in')
      const incident: SecurityIncident = {
        kind: 'We can\'t sign you in (blocked)',
        account: email,
        details: [matched ? `Pattern: ${matched}` : 'Pattern: unknown'],
        next: ['Manual recovery required before continuing'],
        docsUrl
      }
      await this.sendIncidentAlert(incident, 'warn')
      this.bot.compromisedModeActive = true
      this.bot.compromisedReason = 'sign-in-blocked'
      this.startCompromisedInterval()
      await this.bot.engageGlobalStandby('sign-in-blocked', email).catch(logError('LOGIN-SECURITY', 'Global standby engagement failed', this.bot.isMobile))
      // Open security docs for immediate guidance (best-effort)
      await this.openDocsTab(page, docsUrl).catch(logError('LOGIN-SECURITY', 'Failed to open docs tab', this.bot.isMobile))
      return true
    } catch { return false }
  }

  private async tryRecoveryMismatchCheck(page: Page, email: string) {
    try {
      await this.detectAndHandleRecoveryMismatch(page, email)
    } catch {
      // Intentionally silent: Recovery mismatch check is a best-effort security check
      // Failure here should not break the login flow as the page may simply not have recovery info
    }
  }
  private async detectAndHandleRecoveryMismatch(page: Page, email: string) {
    try {
      const recoveryEmail: string | undefined = this.bot.currentAccountRecoveryEmail
      if (!recoveryEmail || !/@/.test(recoveryEmail)) return
      const accountEmail = email
      const parseRef = (val: string) => { const [l, d] = val.split('@'); return { local: l || '', domain: (d || '').toLowerCase(), prefix2: (l || '').slice(0, 2).toLowerCase() } }
      const refs = [parseRef(recoveryEmail), parseRef(accountEmail)].filter(r => r.domain && r.prefix2)
      if (refs.length === 0) return

      const candidates: string[] = []
      // Direct selectors (Microsoft variants + French spans)
      const sel = '[data-testid="recoveryEmailHint"], #recoveryEmail, [id*="ProofEmail"], [id*="EmailProof"], [data-testid*="Email"], span:has(span.fui-Text)'
      const el = await page.waitForSelector(sel, { timeout: 1500 }).catch(() => null)
      if (el) { const t = (await el.textContent() || '').trim(); if (t) candidates.push(t) }

      // List items
      const li = page.locator('[role="listitem"], li')
      const liCount = await li.count().catch(() => 0)
      for (let i = 0; i < liCount && i < 12; i++) { const t = (await li.nth(i).textContent().catch(() => ''))?.trim() || ''; if (t && /@/.test(t)) candidates.push(t) }

      // XPath generic masked patterns
      const xp = page.locator('xpath=//*[contains(normalize-space(.), "@") and (contains(normalize-space(.), "*") or contains(normalize-space(.), "•"))]')
      const xpCount = await xp.count().catch(() => 0)
      for (let i = 0; i < xpCount && i < 12; i++) { const t = (await xp.nth(i).textContent().catch(() => ''))?.trim() || ''; if (t && t.length < 300) candidates.push(t) }

      // Normalize
      const seen = new Set<string>()
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
      const uniq = candidates.map(norm).filter(t => t && !seen.has(t) && seen.add(t))
      // Masked filter
      let masked = uniq.filter(t => /@/.test(t) && /[*•]/.test(t))

      if (masked.length === 0) {
        // Fallback full HTML scan
        try {
          const html = await page.content()
          const generic = /[A-Za-z0-9]{1,4}[*•]{2,}[A-Za-z0-9*•._-]*@[A-Za-z0-9.-]+/g
          const frPhrase = /Nous\s+enverrons\s+un\s+code\s+à\s+([^<@]*[A-Za-z0-9]{1,4}[*•]{2,}[A-Za-z0-9*•._-]*@[A-Za-z0-9.-]+)[^.]{0,120}?Pour\s+vérifier/gi
          const found = new Set<string>()
          let m: RegExpExecArray | null
          while ((m = generic.exec(html)) !== null) found.add(m[0])
          while ((m = frPhrase.exec(html)) !== null) { const raw = m[1]?.replace(/<[^>]+>/g, '').trim(); if (raw) found.add(raw) }
          if (found.size > 0) masked = Array.from(found)
        } catch { /* HTML parsing may fail on malformed content */ }
      }
      if (masked.length === 0) return

      // Prefer one mentioning email/adresse
      const preferred = masked.find(t => /email|courriel|adresse|mail/i.test(t)) || masked[0]!
      // Extract the masked email: Microsoft sometimes shows only first 1 char (k*****@domain) or 2 chars (ko*****@domain).
      // We ONLY compare (1 or 2) leading visible alphanumeric chars + full domain (case-insensitive).
      // This avoids false positives when the displayed mask hides the 2nd char.
      const maskRegex = /([a-zA-Z0-9]{1,2})[a-zA-Z0-9*•._-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
      const m = maskRegex.exec(preferred)
      // Fallback: try to salvage with looser pattern if first regex fails
      const loose = !m ? /([a-zA-Z0-9])[*•][a-zA-Z0-9*•._-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.exec(preferred) : null
      const use = m || loose
      const extracted = use ? use[0] : preferred
      const extractedLower = extracted.toLowerCase()
      let observedPrefix = ((use && use[1]) ? use[1] : '').toLowerCase()
      let observedDomain = ((use && use[2]) ? use[2] : '').toLowerCase()
      if (!observedDomain && extractedLower.includes('@')) {
        const parts = extractedLower.split('@')
        observedDomain = parts[1] || ''
      }
      if (!observedPrefix && extractedLower.includes('@')) {
        const parts = extractedLower.split('@')
        observedPrefix = (parts[0] || '').replace(/[^a-z0-9]/gi, '').slice(0, 2)
      }

      // Determine if any reference (recoveryEmail or accountEmail) matches observed mask logic
      const matchRef = refs.find(r => {
        if (r.domain !== observedDomain) return false
        // If only one char visible, only enforce first char; if two, enforce both.
        if (observedPrefix.length === 1) {
          return r.prefix2.startsWith(observedPrefix)
        }
        return r.prefix2 === observedPrefix
      })

      if (!matchRef) {
        const docsUrl = this.getDocsUrl('recovery-email-mismatch')
        const incident: SecurityIncident = {
          kind: 'Recovery email mismatch',
          account: email,
          details: [
            `MaskedShown: ${preferred}`,
            `Extracted: ${extracted}`,
            `Observed => ${observedPrefix || '??'}**@${observedDomain || '??'}`,
            `Expected => ${refs.map(r => `${r.prefix2}**@${r.domain}`).join(' OR ')}`
          ],
          next: [
            'Automation halted globally (standby engaged).',
            'Verify account security & recovery email in Microsoft settings.',
            'Update accounts.json if the change was legitimate before restart.'
          ],
          docsUrl
        }
        await this.sendIncidentAlert(incident, 'critical')
        this.bot.compromisedModeActive = true
        this.bot.compromisedReason = 'recovery-mismatch'
        this.startCompromisedInterval()
        await this.bot.engageGlobalStandby('recovery-mismatch', email).catch(logError('LOGIN-RECOVERY', 'Global standby failed', this.bot.isMobile))
        await this.openDocsTab(page, docsUrl).catch(logError('LOGIN-RECOVERY', 'Failed to open docs tab', this.bot.isMobile))
      } else {
        const mode = observedPrefix.length === 1 ? 'lenient' : 'strict'
        this.bot.log(this.bot.isMobile, 'LOGIN-RECOVERY', `Recovery OK (${mode}): ${extracted} matches ${matchRef.prefix2}**@${matchRef.domain}`)
      }
    } catch { /* Non-critical: Recovery email validation is best-effort */ }
  }

  private async switchToPasswordLink(page: Page) {
    try {
      const link = await page.locator('xpath=//span[@role="button" and (contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"use your password") or contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"utilisez votre mot de passe"))]').first()
      if (await link.isVisible().catch(() => false)) {
        await link.click().catch(logError('LOGIN', 'Use password link click failed', this.bot.isMobile))
        await this.bot.utils.wait(800)
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Clicked "Use your password" link')
      }
    } catch { /* Link may not be present - expected on password-first flows */ }
  }

  // --------------- Incident Helpers ---------------
  private async sendIncidentAlert(incident: SecurityIncident, severity: 'warn' | 'critical' = 'warn') {
    const lines = [`[Incident] ${incident.kind}`, `Account: ${incident.account}`]
    if (incident.details?.length) lines.push(`Details: ${incident.details.join(' | ')}`)
    if (incident.next?.length) lines.push(`Next: ${incident.next.join(' -> ')}`)
    if (incident.docsUrl) lines.push(`Docs: ${incident.docsUrl}`)
    const level: 'warn' | 'error' = severity === 'critical' ? 'error' : 'warn'
    this.bot.log(this.bot.isMobile, 'SECURITY', lines.join(' | '), level)
    try {
      const { ConclusionWebhook } = await import('../util/notifications/ConclusionWebhook')
      const fields = [
        { name: 'Account', value: incident.account },
        ...(incident.details?.length ? [{ name: 'Details', value: incident.details.join('\n') }] : []),
        ...(incident.next?.length ? [{ name: 'Next steps', value: incident.next.join('\n') }] : []),
        ...(incident.docsUrl ? [{ name: 'Docs', value: incident.docsUrl }] : [])
      ]
      await ConclusionWebhook(
        this.bot.config,
        `🔐 ${incident.kind}`,
        Array.isArray(incident.details) ? incident.details.join('\n') : (incident.details || 'Security check detected unusual activity'),
        fields,
        severity === 'critical' ? 0xFF0000 : 0xFFAA00
      )
    } catch { /* Non-critical: Webhook notification failures don't block login flow */ }
  }

  private getDocsUrl(anchor?: string) {
    const base = process.env.DOCS_BASE?.trim() || 'https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/blob/main/docs/security.md'
    const map: Record<string, string> = {
      'recovery-email-mismatch': '#recovery-email-mismatch',
      'we-cant-sign-you-in': '#we-cant-sign-you-in-blocked'
    }
    return anchor && map[anchor] ? `${base}${map[anchor]}` : base
  }

  private startCompromisedInterval() {
    // FIXED: Always cleanup existing interval before creating new one
    if (this.compromisedInterval) {
      clearInterval(this.compromisedInterval)
      this.compromisedInterval = undefined
    }
    this.compromisedInterval = setInterval(() => {
      try {
        this.bot.log(this.bot.isMobile, 'SECURITY', 'Security standby active. Manual review required before proceeding.', 'warn')
      } catch {
        // Intentionally silent: If logging fails in interval, don't crash the timer
        // The interval will try again in 5 minutes
      }
    }, 300000) // 5 minutes = 300000ms
  }

  private cleanupCompromisedInterval() {
    if (this.compromisedInterval) {
      clearInterval(this.compromisedInterval)
      this.compromisedInterval = undefined
    }
  }

  private async openDocsTab(page: Page, url: string) {
    try {
      const ctx = page.context()
      const tab = await ctx.newPage()
      await tab.goto(url, { waitUntil: 'domcontentloaded' })
    } catch { /* Non-critical: Documentation tab opening is best-effort */ }
  }

  // --------------- Infrastructure ---------------
  private async disableFido(page: Page) {
    await page.route('**/GetCredentialType.srf*', route => {
      try {
        const body = JSON.parse(route.request().postData() || '{}')
        body.isFidoSupported = false
        route.continue({ postData: JSON.stringify(body) })
      } catch { /* Route continue on parse failure */ route.continue() }
    }).catch(logError('LOGIN-FIDO', 'Route interception setup failed', this.bot.isMobile))
  }
}
