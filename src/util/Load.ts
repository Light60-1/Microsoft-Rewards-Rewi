import { BrowserFingerprintWithHeaders } from 'fingerprint-generator'
import fs from 'fs'
import path from 'path'
import { BrowserContext, Cookie } from 'rebrowser-playwright'

import { Account } from '../interface/Account'
import { Config, ConfigBrowser, ConfigSaveFingerprint, ConfigScheduling } from '../interface/Config'
import { Util } from './Utils'





const utils = new Util()

let configCache: Config
let configSourcePath = ''

// Basic JSON comment stripper (supports // line and /* block */ comments while preserving strings)
function stripJsonComments(input: string): string {
    let out = ''
    let inString = false
    let stringChar = ''
    let inLine = false
    let inBlock = false
    for (let i = 0; i < input.length; i++) {
        const ch = input[i]!
        const next = input[i + 1]
        if (inLine) {
            if (ch === '\n' || ch === '\r') {
                inLine = false
                out += ch
            }
            continue
        }
        if (inBlock) {
            if (ch === '*' && next === '/') {
                inBlock = false
                i++
            }
            continue
        }
        if (inString) {
            out += ch
            if (ch === '\\') { // escape next char
                i++
                if (i < input.length) out += input[i]
                continue
            }
            if (ch === stringChar) {
                inString = false
            }
            continue
        }
        if (ch === '"' || ch === '\'') {
            inString = true
            stringChar = ch
            out += ch
            continue
        }
        if (ch === '/' && next === '/') {
            inLine = true
            i++
            continue
        }
        if (ch === '/' && next === '*') {
            inBlock = true
            i++
            continue
        }
        out += ch
    }
    return out
}

// Normalize both legacy (flat) and new (nested) config schemas into the flat Config interface
function normalizeConfig(raw: unknown): Config {
    // TYPE SAFETY NOTE: Using `any` here is necessary for backwards compatibility
    // JUSTIFIED USE OF `any`: The config format has evolved from flat → nested structure over time
    // This needs to support BOTH formats for backward compatibility with existing user configs
    // Runtime validation happens through explicit property checks and the Config interface return type ensures type safety at function boundary
    // Alternative approaches (discriminated unions, conditional types) would require extensive runtime checks making code significantly more complex
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = (raw || {}) as any

    // Browser settings
    const browserConfig = n.browser ?? {}
    const headless = process.env.FORCE_HEADLESS === '1' 
        ? true 
        : (typeof browserConfig.headless === 'boolean' 
            ? browserConfig.headless 
            : (typeof n.headless === 'boolean' ? n.headless : false)) // Legacy fallback

    const globalTimeout = browserConfig.globalTimeout ?? n.globalTimeout ?? '30s'
    const browser: ConfigBrowser = {
        headless,
        globalTimeout: utils.stringToMs(globalTimeout)
    }

    // Execution
    const parallel = n.execution?.parallel ?? n.parallel ?? false
    const runOnZeroPoints = n.execution?.runOnZeroPoints ?? n.runOnZeroPoints ?? false
    const clusters = n.execution?.clusters ?? n.clusters ?? 1
    const passesPerRun = n.execution?.passesPerRun ?? n.passesPerRun

    // Search
    const useLocalQueries = n.search?.useLocalQueries ?? n.searchOnBingLocalQueries ?? false
    const searchSettingsSrc = n.search?.settings ?? n.searchSettings ?? {}
    const delaySrc = searchSettingsSrc.delay ?? searchSettingsSrc.searchDelay ?? { min: '3min', max: '5min' }
    const searchSettings = {
        useGeoLocaleQueries: !!(searchSettingsSrc.useGeoLocaleQueries ?? false),
        scrollRandomResults: !!(searchSettingsSrc.scrollRandomResults ?? false),
        clickRandomResults: !!(searchSettingsSrc.clickRandomResults ?? false),
        retryMobileSearchAmount: Number(searchSettingsSrc.retryMobileSearchAmount ?? 2),
        searchDelay: {
            min: delaySrc.min ?? '3min',
            max: delaySrc.max ?? '5min'
        },
        localFallbackCount: Number(searchSettingsSrc.localFallbackCount ?? 25),
        extraFallbackRetries: Number(searchSettingsSrc.extraFallbackRetries ?? 1)
    }

    // Workers
    const workers = n.workers ?? {
        doDailySet: true,
        doMorePromotions: true,
        doPunchCards: true,
        doDesktopSearch: true,
        doMobileSearch: true,
        doDailyCheckIn: true,
        doReadToEarn: true,
        bundleDailySetWithSearch: false
    }
    // Ensure missing flag gets a default
    if (typeof workers.bundleDailySetWithSearch !== 'boolean') workers.bundleDailySetWithSearch = false

    // Logging
    const logging = n.logging ?? {}
    const logExcludeFunc = Array.isArray(logging.excludeFunc) ? logging.excludeFunc : (n.logExcludeFunc ?? [])
    const webhookLogExcludeFunc = Array.isArray(logging.webhookExcludeFunc) ? logging.webhookExcludeFunc : (n.webhookLogExcludeFunc ?? [])

    // Notifications
    const notifications = n.notifications ?? {}
    const webhook = notifications.webhook ?? n.webhook ?? { enabled: false, url: '' }
    const conclusionWebhook = notifications.conclusionWebhook ?? n.conclusionWebhook ?? { enabled: false, url: '' }
    const ntfy = notifications.ntfy ?? n.ntfy ?? { enabled: false, url: '', topic: '', authToken: '' }

    // Buy Mode
    const buyMode = n.buyMode ?? {}
    const buyModeEnabled = typeof buyMode.enabled === 'boolean' ? buyMode.enabled : false
    const buyModeMax = typeof buyMode.maxMinutes === 'number' ? buyMode.maxMinutes : 45

    // Fingerprinting
    const saveFingerprint = (n.fingerprinting?.saveFingerprint ?? n.saveFingerprint) ?? { mobile: false, desktop: false }

    // Humanization defaults (single on/off)
    if (!n.humanization) n.humanization = {}
    if (typeof n.humanization.enabled !== 'boolean') n.humanization.enabled = true
    if (typeof n.humanization.stopOnBan !== 'boolean') n.humanization.stopOnBan = false
    if (typeof n.humanization.immediateBanAlert !== 'boolean') n.humanization.immediateBanAlert = true
    if (typeof n.humanization.randomOffDaysPerWeek !== 'number') {
        n.humanization.randomOffDaysPerWeek = 1
    }
    // Strong default gestures when enabled (explicit values still win)
    if (typeof n.humanization.gestureMoveProb !== 'number') {
        n.humanization.gestureMoveProb = !n.humanization.enabled ? 0 : 0.5
    }
    if (typeof n.humanization.gestureScrollProb !== 'number') {
        n.humanization.gestureScrollProb = !n.humanization.enabled ? 0 : 0.25
    }

    // Vacation mode (monthly contiguous off-days)
    if (!n.vacation) n.vacation = {}
    if (typeof n.vacation.enabled !== 'boolean') n.vacation.enabled = false
    const vMin = Number(n.vacation.minDays)
    const vMax = Number(n.vacation.maxDays)
    n.vacation.minDays = isFinite(vMin) && vMin > 0 ? Math.floor(vMin) : 3
    n.vacation.maxDays = isFinite(vMax) && vMax > 0 ? Math.floor(vMax) : 5
    if (n.vacation.maxDays < n.vacation.minDays) {
        const t = n.vacation.minDays; n.vacation.minDays = n.vacation.maxDays; n.vacation.maxDays = t
    }

    const riskRaw = (n.riskManagement ?? {}) as Record<string, unknown>
    const hasRiskCfg = Object.keys(riskRaw).length > 0
    const riskManagement = hasRiskCfg ? {
        enabled: riskRaw.enabled === true,
        autoAdjustDelays: riskRaw.autoAdjustDelays !== false,
        stopOnCritical: riskRaw.stopOnCritical === true,
        banPrediction: riskRaw.banPrediction === true,
        riskThreshold: typeof riskRaw.riskThreshold === 'number' ? riskRaw.riskThreshold : undefined
    } : undefined

    const queryDiversityRaw = (n.queryDiversity ?? {}) as Record<string, unknown>
    const hasQueryCfg = Object.keys(queryDiversityRaw).length > 0
    const queryDiversity = hasQueryCfg ? {
        enabled: queryDiversityRaw.enabled === true,
        sources: Array.isArray(queryDiversityRaw.sources) && queryDiversityRaw.sources.length
            ? (queryDiversityRaw.sources.filter((s: unknown) => typeof s === 'string') as Array<'google-trends' | 'reddit' | 'news' | 'wikipedia' | 'local-fallback'>)
            : undefined,
        maxQueriesPerSource: typeof queryDiversityRaw.maxQueriesPerSource === 'number' ? queryDiversityRaw.maxQueriesPerSource : undefined,
        cacheMinutes: typeof queryDiversityRaw.cacheMinutes === 'number' ? queryDiversityRaw.cacheMinutes : undefined
    } : undefined

    const dryRun = n.dryRun === true

    const jobStateRaw = (n.jobState ?? {}) as Record<string, unknown>
    const jobState = {
        enabled: jobStateRaw.enabled !== false,
        dir: typeof jobStateRaw.dir === 'string' ? jobStateRaw.dir : undefined,
        skipCompletedAccounts: jobStateRaw.skipCompletedAccounts !== false
    }

    const dashboardRaw = (n.dashboard ?? {}) as Record<string, unknown>
    const dashboard = {
        enabled: dashboardRaw.enabled === true,
        port: typeof dashboardRaw.port === 'number' ? dashboardRaw.port : 3000,
        host: typeof dashboardRaw.host === 'string' ? dashboardRaw.host : '127.0.0.1'
    }

    const scheduling = buildSchedulingConfig(n.scheduling)

    const cfg: Config = {
        baseURL: n.baseURL ?? 'https://rewards.bing.com',
        sessionPath: n.sessionPath ?? 'sessions',
        browser,
        parallel,
        runOnZeroPoints,
        clusters,
        saveFingerprint,
        workers,
        searchOnBingLocalQueries: !!useLocalQueries,
        globalTimeout,
        searchSettings,
        humanization: n.humanization,
        retryPolicy: n.retryPolicy,
        jobState,
        logExcludeFunc,
        webhookLogExcludeFunc,
        logging, // retain full logging object for live webhook usage
        proxy: n.proxy ?? { proxyGoogleTrends: true, proxyBingTerms: true },
        webhook,
        conclusionWebhook,
        ntfy,
        update: n.update,
        passesPerRun: passesPerRun,
        vacation: n.vacation,
        buyMode: { enabled: buyModeEnabled, maxMinutes: buyModeMax },
        crashRecovery: n.crashRecovery || {},
        riskManagement,
        dryRun,
        queryDiversity,
        dashboard,
        scheduling
    }

    return cfg
}

function buildSchedulingConfig(raw: unknown): ConfigScheduling | undefined {
    if (!raw || typeof raw !== 'object') return undefined

    const source = raw as Record<string, unknown>
    const scheduling: ConfigScheduling = {
        enabled: source.enabled === true,
        type: typeof source.type === 'string' ? source.type as ConfigScheduling['type'] : undefined
    }

    const cronRaw = source.cron
    if (cronRaw && typeof cronRaw === 'object') {
        const cronSource = cronRaw as Record<string, unknown>
        scheduling.cron = {
            schedule: typeof cronSource.schedule === 'string' ? cronSource.schedule : undefined,
            workingDirectory: typeof cronSource.workingDirectory === 'string' ? cronSource.workingDirectory : undefined,
            nodePath: typeof cronSource.nodePath === 'string' ? cronSource.nodePath : undefined,
            logFile: typeof cronSource.logFile === 'string' ? cronSource.logFile : undefined,
            user: typeof cronSource.user === 'string' ? cronSource.user : undefined
        }
    }

    const taskRaw = source.taskScheduler
    if (taskRaw && typeof taskRaw === 'object') {
        const taskSource = taskRaw as Record<string, unknown>
        scheduling.taskScheduler = {
            taskName: typeof taskSource.taskName === 'string' ? taskSource.taskName : undefined,
            schedule: typeof taskSource.schedule === 'string' ? taskSource.schedule : undefined,
            frequency: typeof taskSource.frequency === 'string' ? taskSource.frequency as 'daily' | 'weekly' | 'once' : undefined,
            workingDirectory: typeof taskSource.workingDirectory === 'string' ? taskSource.workingDirectory : undefined,
            runAsUser: typeof taskSource.runAsUser === 'boolean' ? taskSource.runAsUser : undefined,
            highestPrivileges: typeof taskSource.highestPrivileges === 'boolean' ? taskSource.highestPrivileges : undefined
        }
    }

    return scheduling
}

export function loadAccounts(): Account[] {
    try {
        // 1) CLI dev override
        let file = 'accounts.json'
        if (process.argv.includes('-dev')) {
            file = 'accounts.dev.json'
        }

        // 2) Docker-friendly env overrides
        const envJson = process.env.ACCOUNTS_JSON
        const envFile = process.env.ACCOUNTS_FILE

        let raw: string | undefined
        if (envJson && envJson.trim().startsWith('[')) {
            raw = envJson
        } else if (envFile && envFile.trim()) {
            const full = path.isAbsolute(envFile) ? envFile : path.join(process.cwd(), envFile)
            if (!fs.existsSync(full)) {
                throw new Error(`ACCOUNTS_FILE not found: ${full}`)
            }
            raw = fs.readFileSync(full, 'utf-8')
        } else {
            // Try multiple locations to support both root mounts and dist mounts
            // Support both .json and .jsonc extensions
            const candidates = [
                path.join(__dirname, '../', file),               // root/accounts.json (preferred)
                path.join(__dirname, '../', file + 'c'),         // root/accounts.jsonc
                path.join(__dirname, '../src', file),            // fallback: file kept inside src/
                path.join(__dirname, '../src', file + 'c'),      // src/accounts.jsonc
                path.join(process.cwd(), file),                  // cwd override
                path.join(process.cwd(), file + 'c'),            // cwd/accounts.jsonc
                path.join(process.cwd(), 'src', file),           // cwd/src/accounts.json
                path.join(process.cwd(), 'src', file + 'c'),     // cwd/src/accounts.jsonc
                path.join(__dirname, file),                      // dist/accounts.json (legacy)
                path.join(__dirname, file + 'c')                 // dist/accounts.jsonc
            ]
            let chosen: string | null = null
            for (const p of candidates) {
                try { 
                    if (fs.existsSync(p)) { 
                        chosen = p
                        break 
                    } 
                } catch (e) { 
                    // Filesystem check failed for this path, try next
                    continue
                }
            }
            if (!chosen) throw new Error(`accounts file not found in: ${candidates.join(' | ')}`)
            raw = fs.readFileSync(chosen, 'utf-8')
        }

        // Support comments in accounts file (same as config)
        const cleaned = stripJsonComments(raw)
        const parsedUnknown = JSON.parse(cleaned)
        // Accept either a root array or an object with an `accounts` array, ignore `_note`
        const parsed = Array.isArray(parsedUnknown) ? parsedUnknown : (parsedUnknown && typeof parsedUnknown === 'object' && Array.isArray((parsedUnknown as { accounts?: unknown }).accounts) ? (parsedUnknown as { accounts: unknown[] }).accounts : null)
        if (!Array.isArray(parsed)) throw new Error('accounts must be an array')
        // minimal shape validation
        for (const entry of parsed) {
            // JUSTIFIED USE OF `any`: Accounts come from untrusted user JSON with unpredictable structure
            // We perform explicit runtime validation of each property below (typeof checks, regex validation, etc.)
            // This is safer than trusting a type assertion to a specific interface
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const a = entry as any
            if (!a || typeof a.email !== 'string' || typeof a.password !== 'string') {
                throw new Error('each account must have email and password strings')
            }
            a.email = String(a.email).trim()
            a.password = String(a.password)
            const recoveryRequired = a.recoveryRequired !== false
            a.recoveryRequired = recoveryRequired

            if (recoveryRequired) {
                if (typeof a.recoveryEmail !== 'string') {
                    throw new Error(`account ${a.email || '<unknown>'} must include a recoveryEmail string`)
                }
                a.recoveryEmail = String(a.recoveryEmail).trim()
                if (!a.recoveryEmail || !/@/.test(a.recoveryEmail)) {
                    throw new Error(`account ${a.email} recoveryEmail must be a valid email address`)
                }
            } else {
                if (typeof a.recoveryEmail === 'string' && a.recoveryEmail.trim() !== '') {
                    const trimmed = a.recoveryEmail.trim()
                    if (!/@/.test(trimmed)) {
                        throw new Error(`account ${a.email} recoveryEmail must be a valid email address`)
                    }
                    a.recoveryEmail = trimmed
                } else {
                    a.recoveryEmail = undefined
                }
            }

            if (!a.proxy || typeof a.proxy !== 'object') {
                a.proxy = { proxyAxios: true, url: '', port: 0, username: '', password: '' }
            } else {
                a.proxy.proxyAxios = a.proxy.proxyAxios !== false
                a.proxy.url = typeof a.proxy.url === 'string' ? a.proxy.url : ''
                a.proxy.port = typeof a.proxy.port === 'number' ? a.proxy.port : 0
                a.proxy.username = typeof a.proxy.username === 'string' ? a.proxy.username : ''
                a.proxy.password = typeof a.proxy.password === 'string' ? a.proxy.password : ''
            }
        }
        // Filter out disabled accounts (enabled: false)
        const allAccounts = parsed as Account[]
        const enabledAccounts = allAccounts.filter(acc => acc.enabled !== false)
        return enabledAccounts
    } catch (error) {
        throw new Error(error as string)
    }
}

export function getConfigPath(): string { return configSourcePath }

export function loadConfig(): Config {
    try {
        if (configCache) {
            return configCache
        }

        // Resolve configuration file from common locations (supports .jsonc and .json)
        const names = ['config.jsonc', 'config.json']
        const bases = [
            path.join(__dirname, '../'),       // dist root when compiled
            path.join(__dirname, '../src'),    // fallback: running dist but config still in src
            process.cwd(),                     // repo root
            path.join(process.cwd(), 'src'),   // repo/src when running ts-node
            __dirname                          // dist/util
        ]
        const candidates: string[] = []
        for (const base of bases) {
            for (const name of names) {
                candidates.push(path.join(base, name))
            }
        }
        
        let cfgPath: string | null = null
        for (const p of candidates) {
            try { 
                if (fs.existsSync(p)) { 
                    cfgPath = p
                    break 
                } 
            } catch (e) { 
                // Filesystem check failed for this path, try next
                continue
            }
        }
        if (!cfgPath) throw new Error(`config.json not found in: ${candidates.join(' | ')}`)
        const config = fs.readFileSync(cfgPath, 'utf-8')
        const text = config.replace(/^\uFEFF/, '')
        const raw = JSON.parse(stripJsonComments(text))
        const normalized = normalizeConfig(raw)
        configCache = normalized
        configSourcePath = cfgPath

        return normalized
    } catch (error) {
        throw new Error(error as string)
    }
}

interface SessionData {
    cookies: Cookie[]
    fingerprint?: BrowserFingerprintWithHeaders
}

export async function loadSessionData(sessionPath: string, email: string, isMobile: boolean, saveFingerprint: ConfigSaveFingerprint): Promise<SessionData> {
    try {
        // Fetch cookie file
        const cookieFile = path.join(__dirname, '../browser/', sessionPath, email, `${isMobile ? 'mobile_cookies' : 'desktop_cookies'}.json`)

        let cookies: Cookie[] = []
        if (fs.existsSync(cookieFile)) {
            const cookiesData = await fs.promises.readFile(cookieFile, 'utf-8')
            cookies = JSON.parse(cookiesData)
        }

        // Fetch fingerprint file
        const baseDir = path.join(__dirname, '../browser/', sessionPath, email)
        const fingerprintFile = path.join(baseDir, `${isMobile ? 'mobile_fingerprint' : 'desktop_fingerprint'}.json`)

        let fingerprint!: BrowserFingerprintWithHeaders
        const shouldLoad = (saveFingerprint.desktop && !isMobile) || (saveFingerprint.mobile && isMobile)
        if (shouldLoad && fs.existsSync(fingerprintFile)) {
            const fingerprintData = await fs.promises.readFile(fingerprintFile, 'utf-8')
            fingerprint = JSON.parse(fingerprintData)
        }

        return {
            cookies: cookies,
            fingerprint: fingerprint
        }

    } catch (error) {
        throw new Error(error as string)
    }
}

export async function saveSessionData(sessionPath: string, browser: BrowserContext, email: string, isMobile: boolean): Promise<string> {
    try {
        const cookies = await browser.cookies()

        // Fetch path
        const sessionDir = path.join(__dirname, '../browser/', sessionPath, email)

        // Create session dir
        if (!fs.existsSync(sessionDir)) {
            await fs.promises.mkdir(sessionDir, { recursive: true })
        }

        // Save cookies to a file
        await fs.promises.writeFile(
            path.join(sessionDir, `${isMobile ? 'mobile_cookies' : 'desktop_cookies'}.json`), 
            JSON.stringify(cookies, null, 2)
        )

        return sessionDir
    } catch (error) {
        throw new Error(error as string)
    }
}

export async function saveFingerprintData(sessionPath: string, email: string, isMobile: boolean, fingerprint: BrowserFingerprintWithHeaders): Promise<string> {
    try {
        // Fetch path
        const sessionDir = path.join(__dirname, '../browser/', sessionPath, email)

        // Create session dir
        if (!fs.existsSync(sessionDir)) {
            await fs.promises.mkdir(sessionDir, { recursive: true })
        }

        // Save fingerprint to file
        const fingerprintPath = path.join(sessionDir, `${isMobile ? 'mobile_fingerprint' : 'desktop_fingerprint'}.json`)
        const payload = JSON.stringify(fingerprint)
        await fs.promises.writeFile(fingerprintPath, payload)

        return sessionDir
    } catch (error) {
        throw new Error(error as string)
    }
}