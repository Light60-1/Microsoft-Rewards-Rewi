import ms from 'ms'

/**
 * Extract error message from unknown error type
 * @param error - Error object or unknown value
 * @returns String representation of the error
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Utility class for common operations
 * IMPROVED: Added comprehensive documentation
 */
export class Util {

    /**
     * Wait for a specified number of milliseconds
     * @param ms - Milliseconds to wait (max 1 hour)
     * @throws {Error} If ms is not finite or is NaN/Infinity
     * @example await utils.wait(1000) // Wait 1 second
     */
    wait(ms: number): Promise<void> {
        const MAX_WAIT_MS = 3600000 // 1 hour max to prevent infinite waits
        const MIN_WAIT_MS = 0
        
        // FIXED: Simplified validation - isFinite checks both NaN and Infinity
        if (!Number.isFinite(ms)) {
            throw new Error(`Invalid wait time: ${ms}. Must be a finite number (not NaN or Infinity).`)
        }
        
        const safeMs = Math.min(Math.max(MIN_WAIT_MS, ms), MAX_WAIT_MS)
        
        return new Promise<void>((resolve) => {
            setTimeout(resolve, safeMs)
        })
    }

    /**
     * Wait for a random duration within a range
     * @param minMs - Minimum wait time in milliseconds
     * @param maxMs - Maximum wait time in milliseconds
     * @throws {Error} If parameters are invalid
     * @example await utils.waitRandom(1000, 3000) // Wait 1-3 seconds
     */
    async waitRandom(minMs: number, maxMs: number): Promise<void> {
        if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) {
            throw new Error(`Invalid wait range: min=${minMs}, max=${maxMs}. Both must be finite numbers.`)
        }
        
        if (minMs > maxMs) {
            throw new Error(`Invalid wait range: min (${minMs}) cannot be greater than max (${maxMs}).`)
        }
        
        const delta = this.randomNumber(minMs, maxMs)
        return this.wait(delta)
    }

    /**
     * Format a timestamp as MM/DD/YYYY
     * @param ms - Unix timestamp in milliseconds (defaults to current time)
     * @returns Formatted date string
     * @example utils.getFormattedDate() // '01/15/2025'
     * @example utils.getFormattedDate(1704067200000) // '01/01/2024'
     */
    getFormattedDate(ms = Date.now()): string {
        const today = new Date(ms)
        const month = String(today.getMonth() + 1).padStart(2, '0')  // January is 0
        const day = String(today.getDate()).padStart(2, '0')
        const year = today.getFullYear()

        return `${month}/${day}/${year}`
    }

    /**
     * Randomly shuffle an array using Fisher-Yates algorithm
     * @param array - Array to shuffle
     * @returns New shuffled array (original array is not modified)
     * @example utils.shuffleArray([1, 2, 3, 4]) // [3, 1, 4, 2]
     */
    shuffleArray<T>(array: T[]): T[] {
        return array.map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value)
    }

    /**
     * Generate a random integer between min and max (inclusive)
     * @param min - Minimum value
     * @param max - Maximum value
     * @returns Random integer in range [min, max]
     * @throws {Error} If parameters are invalid
     * @example utils.randomNumber(1, 10) // 7
     */
    randomNumber(min: number, max: number): number {
        if (!Number.isFinite(min) || !Number.isFinite(max)) {
            throw new Error(`Invalid range: min=${min}, max=${max}. Both must be finite numbers.`)
        }
        
        if (min > max) {
            throw new Error(`Invalid range: min (${min}) cannot be greater than max (${max}).`)
        }
        
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    /**
     * Split an array into approximately equal chunks
     * @param arr - Array to split
     * @param numChunks - Number of chunks to create (must be positive integer)
     * @returns Array of chunks (sub-arrays)
     * @throws {Error} If parameters are invalid
     * @example utils.chunkArray([1,2,3,4,5], 2) // [[1,2,3], [4,5]]
     */
    chunkArray<T>(arr: T[], numChunks: number): T[][] {
        // FIXED: Stricter validation with better error messages
        if (!Array.isArray(arr)) {
            throw new Error('Invalid input: arr must be an array.')
        }
        
        if (arr.length === 0) {
            return []
        }
        
        // Check for undefined/null elements which could cause issues downstream
        if (arr.some(item => item === undefined || item === null)) {
            throw new Error('Array contains undefined or null elements which are not allowed.')
        }
        
        if (!Number.isFinite(numChunks) || numChunks <= 0) {
            throw new Error(`Invalid numChunks: ${numChunks}. Must be a positive finite number.`)
        }
        
        if (!Number.isInteger(numChunks)) {
            throw new Error(`Invalid numChunks: ${numChunks}. Must be an integer.`)
        }
        
        const safeNumChunks = Math.max(1, Math.floor(numChunks))
        const chunkSize = Math.ceil(arr.length / safeNumChunks)
        const chunks: T[][] = []

        for (let i = 0; i < arr.length; i += chunkSize) {
            const chunk = arr.slice(i, i + chunkSize)
            chunks.push(chunk)
        }

        return chunks
    }

    /**
     * Convert time string or number to milliseconds
     * @param input - Time string (e.g., '1 min', '5s', '2h') or number
     * @returns Time in milliseconds
     * @throws {Error} If input cannot be parsed
     * @example utils.stringToMs('1 min') // 60000
     * @example utils.stringToMs('5s') // 5000
     * @example utils.stringToMs(1000) // 1000
     */
    stringToMs(input: string | number): number {
        if (typeof input !== 'string' && typeof input !== 'number') {
            throw new Error('Invalid input type. Expected string or number.')
        }
        
        const milisec = ms(input.toString())
        if (!milisec || !Number.isFinite(milisec)) {
            throw new Error('The string provided cannot be parsed to a valid time! Use a format like "1 min", "1m" or "1 minutes"')
        }
        return milisec
    }

}

/**
 * Extract short error message from unknown error type (max 120 chars)
 * @param error - Error object or unknown value
 * @returns Truncated string representation of the error
 * @example shortErrorMessage(new Error('Something went wrong')) // 'Something went wrong'
 * @example shortErrorMessage(null) // 'unknown'
 */
export function shortErrorMessage(error: unknown): string {
    if (error == null) return 'unknown'
    if (error instanceof Error) return error.message.substring(0, 120)
    const str = String(error)
    return str.substring(0, 120)
}

/**
 * Format detailed error message with optional stack trace
 * @param label - Error context label (e.g., 'desktop', 'mobile', 'login')
 * @param error - Error object or unknown value
 * @param includeStack - Whether to include stack trace (default: false)
 * @returns Formatted error string with label and optionally stack trace
 * @example formatDetailedError('desktop', new Error('Failed'), true) // 'desktop:Failed :: at line1 | at line2...'
 * @example formatDetailedError('mobile', 'timeout') // 'mobile:timeout'
 */
export function formatDetailedError(label: string, error: unknown, includeStack: boolean = false): string {
    const baseMessage = shortErrorMessage(error)
    if (includeStack && error instanceof Error && error.stack) {
        const stackLines = error.stack.split('\n').slice(0, 4).join(' | ')
        return `${label}:${baseMessage} :: ${stackLines}`
    }
    return `${label}:${baseMessage}`
}