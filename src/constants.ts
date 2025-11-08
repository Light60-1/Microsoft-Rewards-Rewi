/**
 * Central constants for the Microsoft Rewards Script
 * All timeouts, retry limits, delays, selectors, and other magic numbers are defined here
 */

/**
 * Parse environment variable as number with validation
 * @param key Environment variable name
 * @param defaultValue Default value if parsing fails or out of range
 * @param min Minimum allowed value
 * @param max Maximum allowed value
 * @returns Parsed number or default value
 */
function parseEnvNumber(key: string, defaultValue: number, min: number, max: number): number {
    const raw = process.env[key]
    if (!raw) return defaultValue
    
    const parsed = Number(raw)
    if (isNaN(parsed) || parsed < min || parsed > max) return defaultValue
    
    return parsed
}

export const TIMEOUTS = {
    SHORT: 500,
    MEDIUM: 1500,
    MEDIUM_LONG: 2000,
    LONG: 3000,
    VERY_LONG: 5000,
    EXTRA_LONG: 10000,
    DASHBOARD_WAIT: 10000,
    LOGIN_MAX: parseEnvNumber('LOGIN_MAX_WAIT_MS', 180000, 30000, 600000),
    NETWORK_IDLE: 5000,
    ONE_MINUTE: 60000,
    ONE_HOUR: 3600000,
    TWO_MINUTES: 120000
} as const

export const RETRY_LIMITS = {
    MAX_ITERATIONS: 5,
    DASHBOARD_RELOAD: 2,
    MOBILE_SEARCH: 3,
    ABC_MAX: 15,
    POLL_MAX: 15,
    QUIZ_MAX: 15,
    QUIZ_ANSWER_TIMEOUT: 10000,
    GO_HOME_MAX: 5
} as const

export const DELAYS = {
    ACTION_MIN: 1000,
    ACTION_MAX: 3000,
    SEARCH_DEFAULT_MIN: 2000,
    SEARCH_DEFAULT_MAX: 5000,
    BROWSER_CLOSE: 2000,
    TYPING_DELAY: 20,
    SEARCH_ON_BING_WAIT: 5000,
    SEARCH_ON_BING_COMPLETE: 3000,
    SEARCH_ON_BING_FOCUS: 200,
    SEARCH_BAR_TIMEOUT: 15000,
    QUIZ_ANSWER_WAIT: 2000,
    THIS_OR_THAT_START: 2000
} as const

export const SELECTORS = {
    MORE_ACTIVITIES: '#more-activities',
    SUSPENDED_ACCOUNT: '#suspendedAccountHeader',
    QUIZ_COMPLETE: '#quizCompleteContainer',
    QUIZ_CREDITS: 'span.rqMCredits'
} as const

export const URLS = {
    REWARDS_BASE: 'https://rewards.bing.com',
    REWARDS_SIGNIN: 'https://www.bing.com/rewards/dashboard',
    APP_USER_DATA: 'https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&options=613'
} as const

export const DISCORD = {
    MAX_EMBED_LENGTH: 1900,
    RATE_LIMIT_DELAY: 500,
    WEBHOOK_TIMEOUT: 10000,
    DEBOUNCE_DELAY: 750,
    COLOR_RED: 0xFF0000,
    COLOR_CRIMSON: 0xDC143C,
    COLOR_ORANGE: 0xFFA500,
    COLOR_BLUE: 0x3498DB,
    COLOR_GREEN: 0x00D26A,
    COLOR_GRAY: 0x95A5A6,
    WEBHOOK_USERNAME: 'Microsoft-Rewards-Bot',
    AVATAR_URL: 'https://raw.githubusercontent.com/Obsidian-wtf/Microsoft-Rewards-Bot/main/assets/logo.png'
} as const