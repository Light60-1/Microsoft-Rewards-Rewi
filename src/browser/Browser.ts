import { FingerprintGenerator } from 'fingerprint-generator'
import { newInjectedContext } from 'fingerprint-injector'
import playwright, { BrowserContext } from 'rebrowser-playwright'

import { MicrosoftRewardsBot } from '../index'
import { AccountProxy } from '../interface/Account'
import { loadSessionData, saveFingerprintData } from '../util/Load'
import { updateFingerprintUserAgent } from '../util/UserAgent'

class Browser {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    async createBrowser(proxy: AccountProxy, email: string): Promise<BrowserContext> {
        if (process.env.AUTO_INSTALL_BROWSERS === '1') {
            try {
                const { execSync } = await import('child_process')
                // FIXED: Add timeout to prevent indefinite blocking
                this.bot.log(this.bot.isMobile, 'BROWSER', 'Auto-installing Chromium...', 'log')
                execSync('npx playwright install chromium', { stdio: 'ignore', timeout: 120000 })
                this.bot.log(this.bot.isMobile, 'BROWSER', 'Chromium installed successfully', 'log')
            } catch (e) { 
                // FIXED: Improved error logging (no longer silent)
                const errorMsg = e instanceof Error ? e.message : String(e)
                this.bot.log(this.bot.isMobile, 'BROWSER', `Auto-install failed: ${errorMsg}`, 'warn')
            }
        }

        let browser: import('rebrowser-playwright').Browser
        try {
            const envForceHeadless = process.env.FORCE_HEADLESS === '1'
            const headless = envForceHeadless ? true : (this.bot.config.browser?.headless ?? false)
            
            const engineName = 'chromium'
            this.bot.log(this.bot.isMobile, 'BROWSER', `Launching ${engineName} (headless=${headless})`)
            const proxyConfig = this.buildPlaywrightProxy(proxy)

            const isLinux = process.platform === 'linux'
            
            // Base arguments for stability
            const baseArgs = [
                '--no-sandbox',
                '--mute-audio',
                '--disable-setuid-sandbox',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list',
                '--ignore-ssl-errors'
            ]
            
            // Linux stability fixes
            const linuxStabilityArgs = isLinux ? [
                '--disable-dev-shm-usage',
                '--disable-software-rasterizer',
                '--disable-http-cache',
                '--disk-cache-size=1'
            ] : []

            // IMPROVED: Add channel option to stabilize rebrowser-playwright
            browser = await playwright.chromium.launch({
                headless,
                ...(proxyConfig && { proxy: proxyConfig }),
                args: [...baseArgs, ...linuxStabilityArgs],
                timeout: isLinux ? 90000 : 60000,
                // Use chromium channel for better stability with rebrowser-playwright
                channel: undefined as unknown as undefined
            })
        } catch (e: unknown) {
            const msg = (e instanceof Error ? e.message : String(e))
            if (/Executable doesn't exist/i.test(msg)) {
                this.bot.log(this.bot.isMobile, 'BROWSER', 'Chromium not installed. Run "npm run pre-build" or set AUTO_INSTALL_BROWSERS=1', 'error')
            } else {
                this.bot.log(this.bot.isMobile, 'BROWSER', 'Failed to launch browser: ' + msg, 'error')
            }
            throw e
        }

        const legacyFp = (this.bot.config as { saveFingerprint?: { mobile: boolean; desktop: boolean } }).saveFingerprint
        const nestedFp = (this.bot.config.fingerprinting as { saveFingerprint?: { mobile: boolean; desktop: boolean } } | undefined)?.saveFingerprint
        const saveFingerprint = legacyFp || nestedFp || { mobile: false, desktop: false }

        const sessionData = await loadSessionData(this.bot.config.sessionPath, email, this.bot.isMobile, saveFingerprint)
        const fingerprint = sessionData.fingerprint ? sessionData.fingerprint : await this.generateFingerprint()
        
        // FIXED: Add error handling and retry logic for fingerprint injection
        let context: BrowserContext | undefined
        let retries = 3
        while (retries > 0) {
            try {
                context = await newInjectedContext(browser as unknown as import('playwright').Browser, { 
                    fingerprint: fingerprint,
                    // Add context options to prevent premature closure
                    newContextOptions: {
                        ignoreHTTPSErrors: true,
                        bypassCSP: true
                    }
                })
                break
            } catch (e) {
                retries--
                if (retries === 0) {
                    this.bot.log(this.bot.isMobile, 'BROWSER', `Fingerprint injection failed after retries: ${e instanceof Error ? e.message : String(e)}`, 'error')
                    throw e
                }
                this.bot.log(this.bot.isMobile, 'BROWSER', `Fingerprint injection failed, retrying... (${retries} left)`, 'warn')
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }

        if (!context) {
            throw new Error('Failed to create browser context')
        }

        const globalTimeout = this.bot.config.browser?.globalTimeout ?? 30000
        context.setDefaultTimeout(typeof globalTimeout === 'number' ? globalTimeout : this.bot.utils.stringToMs(globalTimeout))

        try {
            context.on('page', async (page) => {
                try {
                    const viewport = this.bot.isMobile 
                        ? { width: 390, height: 844 }
                        : { width: 1280, height: 800 }
                    
                    await page.setViewportSize(viewport)

                    // Standard styling
                    await page.addInitScript(() => {
                        try {
                            const style = document.createElement('style')
                            style.id = '__mrs_fit_style'
                            style.textContent = `
                              html, body { overscroll-behavior: contain; }
                              @media (min-width: 1000px) {
                                html { zoom: 0.9 !important; }
                              }
                            `
                            document.documentElement.appendChild(style)
                        } catch {/* ignore */}
                    })
                } catch (e) { 
                    this.bot.log(this.bot.isMobile, 'BROWSER', `Page setup warning: ${e instanceof Error ? e.message : String(e)}`, 'warn')
                }
            })
        } catch (e) { 
            this.bot.log(this.bot.isMobile, 'BROWSER', `Context event handler warning: ${e instanceof Error ? e.message : String(e)}`, 'warn')
        }

        await context.addCookies(sessionData.cookies)

        if (saveFingerprint.mobile || saveFingerprint.desktop) {
            await saveFingerprintData(this.bot.config.sessionPath, email, this.bot.isMobile, fingerprint)
        }

        this.bot.log(this.bot.isMobile, 'BROWSER', `Browser ready with UA: "${fingerprint.fingerprint.navigator.userAgent}"`)

        return context as BrowserContext
    }

    private buildPlaywrightProxy(proxy: AccountProxy): { server: string; username?: string; password?: string } | undefined {
        const { url, port, username, password } = proxy
        if (!url) return undefined

        const trimmed = url.trim()
        const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
        const candidate = hasScheme ? trimmed : `http://${trimmed}`

        let parsed: URL
        try {
            parsed = new URL(candidate)
        } catch (err) {
            this.bot.log(this.bot.isMobile, 'BROWSER', `Invalid proxy URL "${url}": ${err instanceof Error ? err.message : String(err)}`, 'error')
            return undefined
        }

        if (!parsed.port) {
            if (port) {
                parsed.port = String(port)
            } else {
                this.bot.log(this.bot.isMobile, 'BROWSER', `Proxy port missing for "${url}"`, 'error')
                return undefined
            }
        }

        const server = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`

        const auth: { username?: string; password?: string } = {}
        if (username) auth.username = username
        if (password) auth.password = password

        return { server, ...auth }
    }

    async generateFingerprint() {
        const fingerPrintData = new FingerprintGenerator().getFingerprint()

        const updatedFingerPrintData = await updateFingerprintUserAgent(fingerPrintData, this.bot.isMobile)

        return updatedFingerPrintData
    }
}

export default Browser