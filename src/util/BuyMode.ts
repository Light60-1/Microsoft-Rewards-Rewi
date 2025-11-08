import { createInterface } from 'readline'
import type { Account } from '../interface/Account'
import { log } from './Logger'

export interface BuyModeSelection {
  account: Account
  maxMinutes: number
}

export class BuyModeSelector {
  private accounts: Account[]

  constructor(accounts: Account[]) {
    this.accounts = accounts.filter(acc => acc.enabled !== false)
  }

  /**
   * Parse the buy mode argument from CLI.
   * Supports: email, numeric index (1-based), or undefined for interactive selection.
   */
  async selectAccount(
    argument?: string,
    maxMinutes: number = 45
  ): Promise<BuyModeSelection | null> {
    if (this.accounts.length === 0) {
      log('main', 'BUY-MODE', 'No enabled accounts found. Please enable at least one account in accounts.jsonc', 'error')
      return null
    }

    let selectedAccount: Account | null = null

    if (!argument) {
      selectedAccount = await this.promptInteractiveSelection()
    } else if (this.isNumericIndex(argument)) {
      selectedAccount = this.selectByIndex(argument)
    } else if (this.isEmail(argument)) {
      selectedAccount = this.selectByEmail(argument)
    } else {
      log('main', 'BUY-MODE', `Invalid argument: "${argument}". Expected email or numeric index.`, 'error')
      return null
    }

    if (!selectedAccount) {
      return null
    }

    return {
      account: selectedAccount,
      maxMinutes: Math.max(10, maxMinutes)
    }
  }

  private isNumericIndex(value: string): boolean {
    return /^\d+$/.test(value)
  }

  private isEmail(value: string): boolean {
    return /@/.test(value)
  }

  private selectByIndex(indexStr: string): Account | null {
    const index = parseInt(indexStr, 10)
    
    if (index < 1 || index > this.accounts.length) {
      log('main', 'BUY-MODE', `Invalid account index: ${index}. Valid range: 1-${this.accounts.length}`, 'error')
      this.displayAccountList()
      return null
    }

    const account = this.accounts[index - 1]
    log('main', 'BUY-MODE', `Selected account #${index}: ${this.maskEmail(account!.email)}`, 'log', 'green')
    return account!
  }

  private selectByEmail(email: string): Account | null {
    const account = this.accounts.find(acc => acc.email.toLowerCase() === email.toLowerCase())

    if (!account) {
      log('main', 'BUY-MODE', `Account not found: ${email}`, 'error')
      this.displayAccountList()
      return null
    }

    log('main', 'BUY-MODE', `Selected account: ${this.maskEmail(account.email)}`, 'log', 'green')
    return account
  }

  private async promptInteractiveSelection(): Promise<Account | null> {
    log('main', 'BUY-MODE', 'No account specified. Please select an account:', 'log', 'cyan')
    this.displayAccountList()

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    })

    return new Promise<Account | null>((resolve) => {
      rl.question('\nEnter account number (1-' + this.accounts.length + ') or email: ', (answer) => {
        rl.close()

        const trimmed = answer.trim()

        if (!trimmed) {
          log('main', 'BUY-MODE', 'No selection made. Exiting buy mode.', 'warn')
          resolve(null)
          return
        }

        let selected: Account | null = null

        if (this.isNumericIndex(trimmed)) {
          selected = this.selectByIndex(trimmed)
        } else if (this.isEmail(trimmed)) {
          selected = this.selectByEmail(trimmed)
        } else {
          log('main', 'BUY-MODE', `Invalid input: "${trimmed}". Expected number or email.`, 'error')
        }

        resolve(selected)
      })
    })
  }

  private displayAccountList(): void {
    // Note: console.log is intentionally used here for interactive user prompts
    // This is a CLI menu, not system logging - should go directly to stdout
    console.log('\nAvailable accounts:')
    console.log('─'.repeat(60))
    
    this.accounts.forEach((acc, idx) => {
      const num = `[${idx + 1}]`.padEnd(5)
      const email = this.maskEmail(acc.email).padEnd(35)
      const proxy = acc.proxy?.url ? '🔒 Proxy' : 'Direct'
      console.log(`${num} ${email} ${proxy}`)
    })
    
    console.log('─'.repeat(60))
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@')
    if (!local || !domain) return email

    if (local.length <= 3) {
      return `${local[0]}***@${domain}`
    }

    const visibleStart = local.slice(0, 2)
    const visibleEnd = local.slice(-1)
    return `${visibleStart}***${visibleEnd}@${domain}`
  }
}

export class BuyModeMonitor {
  private initialPoints: number = 0
  private lastPoints: number = 0
  private totalSpent: number = 0
  private monitorStartTime: number = 0

  constructor(initialPoints: number) {
    this.initialPoints = initialPoints
    this.lastPoints = initialPoints
    this.monitorStartTime = Date.now()
  }

  /**
   * Update the current points and detect spending.
   * Returns spending info if points decreased, null otherwise.
   */
  checkSpending(currentPoints: number): { spent: number; current: number; total: number } | null {
    if (currentPoints < this.lastPoints) {
      const spent = this.lastPoints - currentPoints
      this.totalSpent += spent
      this.lastPoints = currentPoints

      return {
        spent,
        current: currentPoints,
        total: this.totalSpent
      }
    }

    if (currentPoints > this.lastPoints) {
      this.lastPoints = currentPoints
    }

    return null
  }

  getTotalSpent(): number {
    return this.totalSpent
  }

  getSessionDuration(): number {
    return Date.now() - this.monitorStartTime
  }

  getCurrentPoints(): number {
    return this.lastPoints
  }

  getInitialPoints(): number {
    return this.initialPoints
  }

  getSummary(): {
    initial: number
    current: number
    spent: number
    duration: number
  } {
    return {
      initial: this.initialPoints,
      current: this.lastPoints,
      spent: this.totalSpent,
      duration: this.getSessionDuration()
    }
  }
}
