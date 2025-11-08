import ms from 'ms'

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class Util {

    wait(ms: number): Promise<void> {
        const MAX_WAIT_MS = 3600000 // 1 hour max to prevent infinite waits
        const MIN_WAIT_MS = 0
        
        // Validate and clamp input - explicit NaN check before isFinite
        if (typeof ms !== 'number' || Number.isNaN(ms) || !Number.isFinite(ms)) {
            throw new Error(`Invalid wait time: ${ms}. Must be a finite number (not NaN or Infinity).`)
        }
        
        const safeMs = Math.min(Math.max(MIN_WAIT_MS, ms), MAX_WAIT_MS)
        
        return new Promise<void>((resolve) => {
            setTimeout(resolve, safeMs)
        })
    }

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

    getFormattedDate(ms = Date.now()): string {
        const today = new Date(ms)
        const month = String(today.getMonth() + 1).padStart(2, '0')  // January is 0
        const day = String(today.getDate()).padStart(2, '0')
        const year = today.getFullYear()

        return `${month}/${day}/${year}`
    }

    shuffleArray<T>(array: T[]): T[] {
        return array.map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value)
    }

    randomNumber(min: number, max: number): number {
        if (!Number.isFinite(min) || !Number.isFinite(max)) {
            throw new Error(`Invalid range: min=${min}, max=${max}. Both must be finite numbers.`)
        }
        
        if (min > max) {
            throw new Error(`Invalid range: min (${min}) cannot be greater than max (${max}).`)
        }
        
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    chunkArray<T>(arr: T[], numChunks: number): T[][] {
        // Validate input to prevent division by zero or invalid chunks
        if (!Number.isFinite(numChunks) || numChunks <= 0) {
            throw new Error(`Invalid numChunks: ${numChunks}. Must be a positive finite number.`)
        }
        
        if (!Array.isArray(arr)) {
            throw new Error('Invalid input: arr must be an array.')
        }
        
        if (arr.length === 0) {
            return []
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