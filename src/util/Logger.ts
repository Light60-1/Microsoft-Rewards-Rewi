import axios from 'axios'
import chalk from 'chalk'

import { Ntfy } from './Ntfy'
import { loadConfig } from './Load'
import { DISCORD } from '../constants'

const WEBHOOK_USERNAME = 'MS Rewards - Live Logs'

/**
 * Safe error logger for catch blocks
 * Use in .catch() to log errors without breaking flow
 * @example await action().catch(logError('ACTION', 'Failed to do something'))
 */
export function logError(title: string, message: string, isMobile: boolean | 'main' = 'main') {
    return (error: unknown) => {
        const errMsg = error instanceof Error ? error.message : String(error)
        log(isMobile, title, `${message}: ${errMsg}`, 'warn')
    }
}

type WebhookBuffer = {
    lines: string[]
    sending: boolean
    timer?: NodeJS.Timeout
}

const webhookBuffers = new Map<string, WebhookBuffer>()

// Periodic cleanup of old/idle webhook buffers to prevent memory leaks
const BUFFER_MAX_AGE_MS = 3600000 // 1 hour
const BUFFER_CLEANUP_INTERVAL_MS = 600000 // 10 minutes

const cleanupInterval = setInterval(() => {
    const now = Date.now()
    
    for (const [url, buf] of webhookBuffers.entries()) {
        if (!buf.sending && buf.lines.length === 0) {
            const lastActivity = (buf as unknown as { lastActivity?: number }).lastActivity || 0
            if (now - lastActivity > BUFFER_MAX_AGE_MS) {
                webhookBuffers.delete(url)
            }
        }
    }
}, BUFFER_CLEANUP_INTERVAL_MS)

// Allow cleanup to be stopped (prevents process from hanging)
if (cleanupInterval.unref) {
    cleanupInterval.unref()
}

function getBuffer(url: string): WebhookBuffer {
    let buf = webhookBuffers.get(url)
    if (!buf) {
        buf = { lines: [], sending: false }
        webhookBuffers.set(url, buf)
    }
    // Track last activity for cleanup
    (buf as unknown as { lastActivity: number }).lastActivity = Date.now()
    return buf
}

async function sendBatch(url: string, buf: WebhookBuffer) {
    if (buf.sending) return
    buf.sending = true
    while (buf.lines.length > 0) {
        const chunk: string[] = []
        let currentLength = 0
        while (buf.lines.length > 0) {
            const next = buf.lines[0]!
            const projected = currentLength + next.length + (chunk.length > 0 ? 1 : 0)
            if (projected > DISCORD.MAX_EMBED_LENGTH && chunk.length > 0) break
            buf.lines.shift()
            chunk.push(next)
            currentLength = projected
        }

        const content = chunk.join('\n').slice(0, DISCORD.MAX_EMBED_LENGTH)
        if (!content) {
            continue
        }

        // Enhanced webhook payload with embed, username and avatar
        const payload = {
            username: WEBHOOK_USERNAME,
            avatar_url: DISCORD.AVATAR_URL,
            embeds: [{
                description: `\`\`\`\n${content}\n\`\`\``,
                color: determineColorFromContent(content),
                timestamp: new Date().toISOString()
            }]
        }

        try {
            await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: DISCORD.WEBHOOK_TIMEOUT })
            await new Promise(resolve => setTimeout(resolve, DISCORD.RATE_LIMIT_DELAY))
        } catch (error) {
            // Re-queue failed batch at front and exit loop
            buf.lines = chunk.concat(buf.lines)
            console.error('[Webhook] live log delivery failed:', error)
            break
        }
    }
    buf.sending = false
}

function determineColorFromContent(content: string): number {
    const lower = content.toLowerCase()
    
    // Priority order: most critical first
    if (lower.includes('[banned]') || lower.includes('[security]') || lower.includes('suspended') || lower.includes('compromised')) {
        return DISCORD.COLOR_RED
    }
    if (lower.includes('[error]') || lower.includes('✗')) {
        return DISCORD.COLOR_CRIMSON
    }
    if (lower.includes('[warn]') || lower.includes('⚠')) {
        return DISCORD.COLOR_ORANGE
    }
    if (lower.includes('[ok]') || lower.includes('✓') || lower.includes('complet')) {
        return DISCORD.COLOR_GREEN
    }
    if (lower.includes('[main]')) {
        return DISCORD.COLOR_BLUE
    }
    
    return 0x95A5A6
}

function enqueueWebhookLog(url: string, line: string) {
    const buf = getBuffer(url)
    buf.lines.push(line)
    if (!buf.timer) {
        buf.timer = setTimeout(() => {
            buf.timer = undefined
            void sendBatch(url, buf)
        }, DISCORD.DEBOUNCE_DELAY)
    }
}

// Synchronous logger that returns an Error when type === 'error' so callers can `throw log(...)` safely.
export function log(isMobile: boolean | 'main', title: string, message: string, type: 'log' | 'warn' | 'error' = 'log', color?: keyof typeof chalk): Error | void {
    const configData = loadConfig()

    // Access logging config with fallback for backward compatibility
    const configAny = configData as unknown as Record<string, unknown>
    const logging = configAny.logging as { excludeFunc?: string[]; logExcludeFunc?: string[] } | undefined
    const logExcludeFunc = logging?.excludeFunc ?? (configData as { logExcludeFunc?: string[] }).logExcludeFunc ?? []

    if (logExcludeFunc.some((x: string) => x.toLowerCase() === title.toLowerCase())) {
        return
    }

    const currentTime = new Date().toLocaleString()
    const platformText = isMobile === 'main' ? 'MAIN' : isMobile ? 'MOBILE' : 'DESKTOP'
    
    // Clean string for notifications (no chalk, structured)
    type LoggingCfg = { excludeFunc?: string[]; webhookExcludeFunc?: string[]; redactEmails?: boolean }
    const loggingCfg: LoggingCfg = (configAny.logging || {}) as LoggingCfg
    const shouldRedact = !!loggingCfg.redactEmails
    const redact = (s: string) => shouldRedact ? s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, (m) => {
        const [u, d] = m.split('@'); return `${(u||'').slice(0,2)}***@${d||''}`
    }) : s
    const cleanStr = redact(`[${currentTime}] [PID: ${process.pid}] [${type.toUpperCase()}] ${platformText} [${title}] ${message}`)

    // Define conditions for sending to NTFY 
    const ntfyConditions = {
        log: [
            message.toLowerCase().includes('started tasks for account'),
            message.toLowerCase().includes('press the number'),
            message.toLowerCase().includes('no points to earn')
        ],
        error: [], 
        warn: [
            message.toLowerCase().includes('aborting'),
            message.toLowerCase().includes('didn\'t gain')
        ]
    }

    // Check if the current log type and message meet the NTFY conditions
    try {
        if (type in ntfyConditions && ntfyConditions[type as keyof typeof ntfyConditions].some(condition => condition)) {
            // Fire-and-forget
            Promise.resolve(Ntfy(cleanStr, type)).catch(() => { /* ignore ntfy errors */ })
        }
    } catch { /* ignore */ }

    // Console output with better formatting and contextual icons
    const typeIndicator = type === 'error' ? '✗' : type === 'warn' ? '⚠' : '✓'
    const platformColor = isMobile === 'main' ? chalk.cyan : isMobile ? chalk.blue : chalk.magenta
    const typeColor = type === 'error' ? chalk.red : type === 'warn' ? chalk.yellow : chalk.green
    
    // Add contextual icon based on title/message (ASCII-safe for Windows PowerShell)
    const titleLower = title.toLowerCase()
    const msgLower = message.toLowerCase()
    
    // ASCII-safe icons for Windows PowerShell compatibility
    const iconMap: Array<[RegExp, string]> = [
        [/security|compromised/i, '[SECURITY]'],
        [/ban|suspend/i, '[BANNED]'],
        [/error/i, '[ERROR]'],
        [/warn/i, '[WARN]'],
        [/success|complet/i, '[OK]'],
        [/login/i, '[LOGIN]'],
        [/point/i, '[POINTS]'],
        [/search/i, '[SEARCH]'],
        [/activity|quiz|poll/i, '[ACTIVITY]'],
        [/browser/i, '[BROWSER]'],
        [/main/i, '[MAIN]']
    ]
    
    let icon = ''
    for (const [pattern, symbol] of iconMap) {
        if (pattern.test(titleLower) || pattern.test(msgLower)) {
            icon = chalk.dim(symbol)
            break
        }
    }
    
    const iconPart = icon ? icon + ' ' : ''
    
    const formattedStr = [
        chalk.gray(`[${currentTime}]`),
        chalk.gray(`[${process.pid}]`),
        typeColor(`${typeIndicator}`),
        platformColor(`[${platformText}]`),
        chalk.bold(`[${title}]`),
        iconPart + redact(message)
    ].join(' ')

    const applyChalk = color && typeof chalk[color] === 'function' ? chalk[color] as (msg: string) => string : null

    // Log based on the type
    switch (type) {
        case 'warn':
            applyChalk ? console.warn(applyChalk(formattedStr)) : console.warn(formattedStr)
            break

        case 'error':
            applyChalk ? console.error(applyChalk(formattedStr)) : console.error(formattedStr)
            break

        default:
            applyChalk ? console.log(applyChalk(formattedStr)) : console.log(formattedStr)
            break
    }

    // Webhook streaming (live logs)
    try {
        const loggingCfg: Record<string, unknown> = (configAny.logging || {}) as Record<string, unknown>
        const webhookCfg = configData.webhook
        const liveUrlRaw = typeof loggingCfg.liveWebhookUrl === 'string' ? loggingCfg.liveWebhookUrl.trim() : ''
        const liveUrl = liveUrlRaw || (webhookCfg?.enabled && webhookCfg.url ? webhookCfg.url : '')
        const webhookExclude = Array.isArray(loggingCfg.webhookExcludeFunc) ? loggingCfg.webhookExcludeFunc : configData.webhookLogExcludeFunc || []
        const webhookExcluded = Array.isArray(webhookExclude) && webhookExclude.some((x: string) => x.toLowerCase() === title.toLowerCase())
        if (liveUrl && !webhookExcluded) {
            enqueueWebhookLog(liveUrl, cleanStr)
        }
    } catch (error) {
        console.error('[Logger] Failed to enqueue webhook log:', error)
    }

    // Return an Error when logging an error so callers can `throw log(...)`
    if (type === 'error') {
        return new Error(cleanStr)
    }
}