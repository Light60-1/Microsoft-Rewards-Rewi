import * as readline from 'readline'
import Browser from '../browser/Browser'
import { MicrosoftRewardsBot } from '../index'
import { log } from '../util/notifications/Logger'
import { AccountCreator } from './AccountCreator'

async function main(): Promise<void> {
  // Parse command line args
  const args = process.argv.slice(2)
  let referralUrl: string | undefined
  let recoveryEmail: string | undefined
  let autoAccept = false

  // Parse arguments - ULTRA SIMPLE
  for (const arg of args) {
    if (!arg) continue

    if (arg === '-y' || arg === '--yes' || arg === 'y' || arg === 'Y') {
      autoAccept = true
    } else if (arg.startsWith('http')) {
      referralUrl = arg
    } else if (arg.includes('@')) {
      // Auto-detect email addresses
      recoveryEmail = arg
    }
  }

  // CRITICAL: Detect truncated URLs (PowerShell/CMD cut at & character)
  // If URL detected but no -y flag AND no email, likely the URL was cut
  if (referralUrl && !autoAccept && !recoveryEmail && args.length === 1) {
    // Check if URL looks truncated (ends with parameter but no value after &)
    if (referralUrl.includes('?') && !referralUrl.includes('&')) {
      log(false, 'CREATOR-CLI', '', 'log')
      log(false, 'CREATOR-CLI', '⚠️  WARNING: URL may be truncated!', 'warn', 'yellow')
      log(false, 'CREATOR-CLI', '   The & character is special in CMD/PowerShell and cuts the URL.', 'warn', 'yellow')
      log(false, 'CREATOR-CLI', '', 'log')
      log(false, 'CREATOR-CLI', '✅ SOLUTION: Put the URL in quotes:', 'log', 'green')
      log(false, 'CREATOR-CLI', '   npm run creator -- "https://rewards.bing.com/...full-url..." -y email@gmail.com', 'log', 'cyan')
      log(false, 'CREATOR-CLI', '', 'log')
      log(false, 'CREATOR-CLI', '💡 TIP: Only the rh= code matters. You can simplify to:', 'log', 'gray')
      log(false, 'CREATOR-CLI', '   npm run creator -- https://rewards.bing.com/welcome?rh=YOUR_CODE -y email@gmail.com', 'log', 'cyan')
      log(false, 'CREATOR-CLI', '', 'log')

      // Ask user if they want to continue anyway
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })

      await new Promise<void>((resolve) => {
        rl.question('Continue with this URL anyway? (y/N): ', (answer: string) => {
          rl.close()
          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            log(false, 'CREATOR-CLI', '❌ Aborted. Please retry with the URL in quotes.', 'error')
            process.exit(0)
          }
          resolve()
        })
      })
    }
  }

  // Banner
  log(false, 'CREATOR-CLI', '', 'log') // Empty line
  log(false, 'CREATOR-CLI', '='.repeat(60), 'log', 'cyan')
  log(false, 'CREATOR-CLI', '🚀 Microsoft Account Creator', 'log', 'cyan')
  log(false, 'CREATOR-CLI', '='.repeat(60), 'log', 'cyan')
  log(false, 'CREATOR-CLI', '⚠️  DO NOT INTERACT WITH THE BROWSER DURING AUTOMATION', 'warn', 'yellow')
  log(false, 'CREATOR-CLI', '   Everything is fully automated. Any interaction may break the process.', 'warn', 'yellow')
  log(false, 'CREATOR-CLI', '   Only interact when explicitly asked (e.g., CAPTCHA solving).', 'warn', 'yellow')
  log(false, 'CREATOR-CLI', '='.repeat(60), 'log', 'cyan')
  log(false, 'CREATOR-CLI', '', 'log') // Empty line

  // Show usage help if no arguments passed
  if (args.length === 0) {
    log(false, 'CREATOR-CLI', '📖 Usage Examples:', 'log', 'cyan')
    log(false, 'CREATOR-CLI', '   npm run creator -- -y                                    # Auto mode', 'log', 'gray')
    log(false, 'CREATOR-CLI', '   npm run creator -- -y email@gmail.com                     # With recovery email', 'log', 'gray')
    log(false, 'CREATOR-CLI', '   npm run creator -- https://rewards.bing.com/... -y        # With referral URL', 'log', 'gray')
    log(false, 'CREATOR-CLI', '', 'log')
    log(false, 'CREATOR-CLI', '⚠️  IMPORTANT: The -- is required to pass arguments via npm!', 'warn', 'yellow')
    log(false, 'CREATOR-CLI', '', 'log')
  }

  // Display detected arguments
  if (referralUrl) {
    log(false, 'CREATOR-CLI', `✅ Referral URL: ${referralUrl}`, 'log', 'green')
  } else {
    log(false, 'CREATOR-CLI', '⚠️  No referral URL - account will NOT be linked to rewards', 'warn', 'yellow')
  }

  if (recoveryEmail) {
    log(false, 'CREATOR-CLI', `✅ Recovery email: ${recoveryEmail}`, 'log', 'green')
  }

  if (autoAccept) {
    log(false, 'CREATOR-CLI', '⚡ Auto-accept mode ENABLED (-y flag detected)', 'log', 'green')
    log(false, 'CREATOR-CLI', '🤖 All prompts will be auto-accepted', 'log', 'cyan')
  } else {
    log(false, 'CREATOR-CLI', '🤖 Interactive mode: you will be asked for options', 'log', 'cyan')
    log(false, 'CREATOR-CLI', '💡 Tip: Use -y flag to auto-accept all prompts', 'log', 'gray')
  }

  log(false, 'CREATOR-CLI', '', 'log') // Empty line

  // Create a temporary bot instance to access browser creation
  const bot = new MicrosoftRewardsBot(false)
  const browserFactory = new Browser(bot)

  try {
    // Create browser (non-headless for user interaction with CAPTCHA)
    log(false, 'CREATOR-CLI', 'Opening browser (required for CAPTCHA solving)...', 'log')

    // Create empty proxy config (no proxy for account creation)
    const emptyProxy = {
      proxyAxios: false,
      url: '',
      port: 0,
      password: '',
      username: ''
    }

    const browserContext = await browserFactory.createBrowser(emptyProxy, 'account-creator')

    log(false, 'CREATOR-CLI', '✅ Browser opened successfully', 'log', 'green')

    // Create account
    const creator = new AccountCreator(referralUrl, recoveryEmail, autoAccept)
    const result = await creator.create(browserContext)

    if (result) {
      // Success banner
      log(false, 'CREATOR-CLI', '', 'log') // Empty line
      log(false, 'CREATOR-CLI', '='.repeat(60), 'log', 'green')
      log(false, 'CREATOR-CLI', '✅ ACCOUNT CREATED SUCCESSFULLY!', 'log', 'green')
      log(false, 'CREATOR-CLI', '='.repeat(60), 'log', 'green')

      // Display account details
      log(false, 'CREATOR-CLI', `📧 Email: ${result.email}`, 'log', 'cyan')
      log(false, 'CREATOR-CLI', `🔐 Password: ${result.password}`, 'log', 'cyan')
      log(false, 'CREATOR-CLI', `👤 Name: ${result.firstName} ${result.lastName}`, 'log', 'cyan')
      log(false, 'CREATOR-CLI', `🎂 Birthdate: ${result.birthdate.day}/${result.birthdate.month}/${result.birthdate.year}`, 'log', 'cyan')

      if (result.referralUrl) {
        log(false, 'CREATOR-CLI', '🔗 Referral: Linked', 'log', 'green')
      }

      log(false, 'CREATOR-CLI', '='.repeat(60), 'log', 'green')
      log(false, 'CREATOR-CLI', '💾 Account details saved to accounts-created/ directory', 'log', 'green')
      log(false, 'CREATOR-CLI', '='.repeat(60), 'log', 'green')
      log(false, 'CREATOR-CLI', '', 'log') // Empty line

      // Keep browser open - don't close
      log(false, 'CREATOR-CLI', '✅ Account creation complete! Browser will remain open.', 'log', 'green')
      log(false, 'CREATOR-CLI', 'You can now use the account or close the browser manually.', 'log', 'cyan')
      log(false, 'CREATOR-CLI', 'Press Ctrl+C to exit the script.', 'log', 'yellow')

      // Keep process alive indefinitely
      await new Promise(() => { }) // Never resolves
    } else {
      // Failure
      log(false, 'CREATOR-CLI', '', 'log') // Empty line
      log(false, 'CREATOR-CLI', '='.repeat(60), 'error')
      log(false, 'CREATOR-CLI', '❌ ACCOUNT CREATION FAILED', 'error')
      log(false, 'CREATOR-CLI', '='.repeat(60), 'error')
      log(false, 'CREATOR-CLI', '', 'log') // Empty line

      await browserContext.close()
      process.exit(1)
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    log(false, 'CREATOR-CLI', '', 'log') // Empty line
    log(false, 'CREATOR-CLI', '='.repeat(60), 'error')
    log(false, 'CREATOR-CLI', `❌ Fatal error: ${msg}`, 'error')
    log(false, 'CREATOR-CLI', '='.repeat(60), 'error')
    log(false, 'CREATOR-CLI', '', 'log') // Empty line
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    log(false, 'CREATOR-CLI', `Unhandled error: ${error}`, 'error')
    process.exit(1)
  })
}

export { main as createAccountCLI }

