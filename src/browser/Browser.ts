import playwright, { BrowserContext } from 'rebrowser-playwright'
import { newInjectedContext } from 'fingerprint-injector'
import { FingerprintGenerator } from 'fingerprint-generator'

import { MicrosoftRewardsBot } from '../index'
import { loadSessionData, saveFingerprintData } from '../util/Load'
import { updateFingerprintUserAgent } from '../util/UserAgent'
import { AccountProxy } from '../interface/Account'

class Browser {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    async createBrowser(proxy: AccountProxy, email: string): Promise<BrowserContext> {
        if (process.env.AUTO_INSTALL_BROWSERS === '1') {
            try {
                const { execSync } = await import('child_process')
                execSync('npx playwright install chromium', { stdio: 'ignore' })
            } catch (e) { 
                this.bot.log(this.bot.isMobile, 'BROWSER', `Auto-install failed: ${e instanceof Error ? e.message : String(e)}`, 'warn')
            }
        }

        let browser: import('rebrowser-playwright').Browser
        try {
            const envForceHeadless = process.env.FORCE_HEADLESS === '1'
            let headless = envForceHeadless ? true : (this.bot.config.browser?.headless ?? false)
            
            // Buy/Interactive mode: always visible and with enhanced stealth
            const isBuyMode = this.bot.isBuyModeEnabled()
            if (isBuyMode && !envForceHeadless) {
                if (headless !== false) {
                    const target = this.bot.getBuyModeTarget()
                    this.bot.log(this.bot.isMobile, 'BROWSER', `Interactive mode: forcing headless=false${target ? ` for ${target}` : ''}`, 'warn')
                }
                headless = false
            }
            
            const engineName = 'chromium'
            this.bot.log(this.bot.isMobile, 'BROWSER', `Launching ${engineName} (headless=${headless}${isBuyMode ? ', stealth-mode=ENHANCED' : ''})`)
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

            // ENHANCED STEALTH MODE for Buy/Interactive Mode
            // These arguments help bypass CAPTCHA and automation detection
            const stealthArgs = isBuyMode ? [
                '--disable-blink-features=AutomationControlled', // Critical: Hide automation
                '--disable-features=IsolateOrigins,site-per-process', // Reduce detection surface
                '--disable-site-isolation-trials',
                '--disable-web-security', // Allow cross-origin (may help with CAPTCHA)
                '--disable-features=VizDisplayCompositor', // Reduce GPU fingerprinting
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-infobars',
                '--window-position=0,0',
                '--window-size=1920,1080', // Consistent window size
                '--start-maximized'
            ] : []

            browser = await playwright.chromium.launch({
                headless,
                ...(proxyConfig && { proxy: proxyConfig }),
                args: [...baseArgs, ...linuxStabilityArgs, ...stealthArgs],
                timeout: isLinux ? 90000 : 60000
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
        const context = await newInjectedContext(browser as unknown as import('playwright').Browser, { fingerprint: fingerprint })

        const globalTimeout = this.bot.config.browser?.globalTimeout ?? 30000
        context.setDefaultTimeout(typeof globalTimeout === 'number' ? globalTimeout : this.bot.utils.stringToMs(globalTimeout))

        const isBuyMode = this.bot.isBuyModeEnabled()

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

                    // ENHANCED ANTI-DETECTION for Buy/Interactive Mode
                    if (isBuyMode) {
                        await page.addInitScript(`
                            // Override navigator.webdriver (critical for CAPTCHA bypass)
                            Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
                                get: () => false
                            });

                            // Add chrome runtime (looks more human)
                            Object.defineProperty(window, 'chrome', {
                                writable: true,
                                enumerable: true,
                                configurable: false,
                                value: { runtime: {} }
                            });

                            // Add plugins (looks more human)
                            Object.defineProperty(navigator, 'plugins', {
                                get: () => [
                                    { name: 'Chrome PDF Plugin' },
                                    { name: 'Chrome PDF Viewer' },
                                    { name: 'Native Client' }
                                ]
                            });

                            // Languages
                            Object.defineProperty(navigator, 'languages', {
                                get: () => ['en-US', 'en', 'fr']
                            });

                            // Hide automation markers
                            ['__nightmare', '__playwright', '__pw_manual', '__webdriver_script_fn', 'webdriver'].forEach(prop => {
                                try {
                                    if (prop in window) delete window[prop];
                                } catch {}
                            });

                            // Override permissions to avoid detection
                            const originalPermissionsQuery = window.navigator.permissions.query;
                            window.navigator.permissions.query = function(params) {
                                if (params.name === 'notifications') {
                                    return Promise.resolve({ 
                                        state: Notification.permission,
                                        name: 'notifications',
                                        onchange: null,
                                        addEventListener: () => {},
                                        removeEventListener: () => {},
                                        dispatchEvent: () => true
                                    });
                                }
                                return originalPermissionsQuery.call(this, params);
                            };
                        `)

                        this.bot.log(this.bot.isMobile, 'BROWSER', '🛡️ Enhanced stealth mode activated (anti-CAPTCHA)', 'log', 'green')
                    }
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
        const fingerPrintData = new FingerprintGenerator().getFingerprint({
            devices: this.bot.isMobile ? ['mobile'] : ['desktop'],
            operatingSystems: this.bot.isMobile ? ['android'] : ['windows'],
            browsers: [{ name: 'edge' }]
        })

        const updatedFingerPrintData = await updateFingerprintUserAgent(fingerPrintData, this.bot.isMobile)

        return updatedFingerPrintData
    }
}

export default Browser