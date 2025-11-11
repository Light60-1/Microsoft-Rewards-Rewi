import axios from 'axios'
import { DISCORD } from '../../constants'
import { Config } from '../../interface/Config'

interface ErrorReportPayload {
    error: string
    stack?: string
    context: {
        version: string
        platform: string
        arch: string
        nodeVersion: string
        timestamp: string
    }
}

/**
 * Simple obfuscation/deobfuscation for webhook URL
 * Not for security, just to avoid easy scraping
 */
export function obfuscateWebhookUrl(url: string): string {
    return Buffer.from(url).toString('base64')
}

export function deobfuscateWebhookUrl(encoded: string): string {
    try {
        return Buffer.from(encoded, 'base64').toString('utf-8')
    } catch {
        return ''
    }
}

/**
 * Check if an error should be reported (filter false positives and user configuration errors)
 */
function shouldReportError(errorMessage: string): boolean {
    const lowerMessage = errorMessage.toLowerCase()

    // List of patterns that indicate user configuration errors (not reportable bugs)
    const userConfigPatterns = [
        /accounts\.jsonc.*not found/i,
        /config\.jsonc.*not found/i,
        /invalid.*credentials/i,
        /login.*failed/i,
        /authentication.*failed/i,
        /proxy.*connection.*failed/i,
        /totp.*invalid/i,
        /2fa.*failed/i,
        /incorrect.*password/i,
        /account.*suspended/i,
        /account.*banned/i,
        /no.*accounts.*enabled/i,
        /invalid.*configuration/i,
        /missing.*required.*field/i,
        /port.*already.*in.*use/i,
        /eaddrinuse/i,
        // Rebrowser-playwright expected errors (benign, non-fatal)
        /rebrowser-patches.*cannot get world/i,
        /session closed.*rebrowser/i,
        /addScriptToEvaluateOnNewDocument.*session closed/i
    ]

    // Don't report user configuration errors
    for (const pattern of userConfigPatterns) {
        if (pattern.test(lowerMessage)) {
            return false
        }
    }

    // List of patterns that indicate expected/handled errors (not bugs)
    const expectedErrorPatterns = [
        /no.*points.*to.*earn/i,
        /already.*completed/i,
        /activity.*not.*available/i,
        /daily.*limit.*reached/i,
        /quest.*not.*found/i,
        /promotion.*expired/i,
        // Playwright expected errors (page lifecycle, navigation, timeouts)
        /target page.*context.*browser.*been closed/i,
        /page.*has been closed/i,
        /context.*has been closed/i,
        /browser.*has been closed/i,
        /execution context was destroyed/i,
        /frame was detached/i,
        /navigation.*cancelled/i,
        /timeout.*exceeded/i,
        /waiting.*failed.*timeout/i,
        /net::ERR_ABORTED/i,
        /net::ERR_CONNECTION_REFUSED/i,
        /net::ERR_NAME_NOT_RESOLVED/i
    ]

    // Don't report expected/handled errors
    for (const pattern of expectedErrorPatterns) {
        if (pattern.test(lowerMessage)) {
            return false
        }
    }

    // Report everything else (genuine bugs)
    return true
}

// Hardcoded webhook URL for error reporting (obfuscated)
const ERROR_WEBHOOK_URL = 'aHR0cHM6Ly9kaXNjb3JkLmNvbS9hcGkvd2ViaG9va3MvMTQzNzExMTk2MjM5NDY4OTYyOS90bHZHS1phSDktckppcjR0blpLU1pwUkhTM1liZU40dlpudUN2NTBrNU1wQURZUlBuSG5aNk15YkFsZ0Y1UUZvNktIXw=='

/**
 * Send error report to Discord webhook for community contribution
 * Only sends non-sensitive error information to help improve the project
 */
export async function sendErrorReport(
    config: Config,
    error: Error | string,
    additionalContext?: Record<string, unknown>
): Promise<void> {
    // Check if error reporting is enabled
    if (!config.errorReporting?.enabled) {
        process.stderr.write('[ErrorReporting] Disabled in config (errorReporting.enabled = false)\n')
        return
    }

    try {
        // Deobfuscate webhook URL
        const webhookUrl = deobfuscateWebhookUrl(ERROR_WEBHOOK_URL)
        if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
            process.stderr.write('[ErrorReporting] Invalid webhook URL after deobfuscation\n')
            return
        }

        const errorMessage = error instanceof Error ? error.message : String(error)

        // Filter out false positives and user configuration errors
        if (!shouldReportError(errorMessage)) {
            process.stderr.write(`[ErrorReporting] Filtered error (expected/benign): ${errorMessage.substring(0, 100)}\n`)
            return
        }

        process.stderr.write(`[ErrorReporting] Sending error report: ${errorMessage.substring(0, 100)}\n`)
        const errorStack = error instanceof Error ? error.stack : undefined

        // Sanitize error message and stack - remove any potential sensitive data
        const sanitize = (text: string): string => {
            return text
                // Remove email addresses
                .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]')
                // Remove absolute paths (Windows and Unix)
                .replace(/[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g, '[PATH_REDACTED]')
                .replace(/\/(?:home|Users)\/[^/\s]+(?:\/[^/\s]+)*/g, '[PATH_REDACTED]')
                // Remove IP addresses
                .replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, '[IP_REDACTED]')
                // Remove potential tokens/keys (sequences of 20+ alphanumeric chars)
                .replace(/\b[A-Za-z0-9_-]{20,}\b/g, '[TOKEN_REDACTED]')
        }

        const sanitizedMessage = sanitize(errorMessage)
        const sanitizedStack = errorStack ? sanitize(errorStack).split('\n').slice(0, 10).join('\n') : undefined

        // Build context payload with system information
        const payload: ErrorReportPayload = {
            error: sanitizedMessage,
            stack: sanitizedStack,
            context: {
                version: getProjectVersion(),
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                timestamp: new Date().toISOString()
            }
        }

        // Add additional context if provided (also sanitized)
        if (additionalContext) {
            const sanitizedContext: Record<string, unknown> = {}
            for (const [key, value] of Object.entries(additionalContext)) {
                if (typeof value === 'string') {
                    sanitizedContext[key] = sanitize(value)
                } else {
                    sanitizedContext[key] = value
                }
            }
            Object.assign(payload.context, sanitizedContext)
        }

        // Build Discord embed
        const embed = {
            title: '🐛 Automatic Error Report',
            description: `\`\`\`\n${sanitizedMessage.slice(0, 500)}\n\`\`\``,
            color: DISCORD.COLOR_RED,
            fields: [
                {
                    name: '📦 Version',
                    value: payload.context.version,
                    inline: true
                },
                {
                    name: '💻 Platform',
                    value: `${payload.context.platform} (${payload.context.arch})`,
                    inline: true
                },
                {
                    name: '⚙️ Node.js',
                    value: payload.context.nodeVersion,
                    inline: true
                }
            ],
            timestamp: payload.context.timestamp,
            footer: {
                text: 'Automatic error reporting - Thank you for contributing!',
                icon_url: DISCORD.AVATAR_URL
            }
        }

        // Add stack trace field if available (truncated)
        if (sanitizedStack) {
            embed.fields.push({
                name: '📋 Stack Trace (truncated)',
                value: `\`\`\`\n${sanitizedStack.slice(0, 800)}\n\`\`\``,
                inline: false
            })
        }

        // Add additional context fields if provided
        if (additionalContext) {
            for (const [key, value] of Object.entries(additionalContext)) {
                if (embed.fields.length < 25) { // Discord limit
                    embed.fields.push({
                        name: key,
                        value: String(value).slice(0, 1024),
                        inline: true
                    })
                }
            }
        }

        const discordPayload = {
            username: 'Microsoft-Rewards-Bot Error Reporter',
            avatar_url: DISCORD.AVATAR_URL,
            embeds: [embed]
        }

        // Send to webhook with timeout
        const response = await axios.post(webhookUrl, discordPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        })

        process.stderr.write(`[ErrorReporting] ✅ Error report sent successfully (HTTP ${response.status})\n`)
    } catch (webhookError) {
        // Silent fail - we don't want error reporting to break the application
        // Only log to stderr to avoid recursion
        const errorMsg = webhookError instanceof Error ? webhookError.message : String(webhookError)
        process.stderr.write(`[ErrorReporting] ❌ Failed to send error report: ${errorMsg}\n`)
    }
}

/**
 * Get project version from package.json
 */
function getProjectVersion(): string {
    try {
        // Dynamic import for package.json
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const packageJson = require('../../package.json') as { version?: string }
        return packageJson.version || 'unknown'
    } catch {
        return 'unknown'
    }
}
