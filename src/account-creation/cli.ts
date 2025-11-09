import Browser from '../browser/Browser'
import { MicrosoftRewardsBot } from '../index'
import { log } from '../util/Logger'
import { AccountCreator } from './AccountCreator'

async function main(): Promise<void> {
  // Parse command line args
  const args = process.argv.slice(2)
  let referralUrl: string | undefined
  let recoveryEmail: string | undefined
  let autoAccept = false
  let enable2FA = false
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg) continue
    
    if (arg === '-r' && i + 1 < args.length) {
      recoveryEmail = args[++i]
    } else if (arg === '-y') {
      autoAccept = true
    } else if (arg === '--2fa') {
      enable2FA = true
    } else if (arg.startsWith('http')) {
      referralUrl = arg
    }
  }
  
  // Validate recovery email if provided
  if (recoveryEmail && !recoveryEmail.includes('@')) {
    log(false, 'CREATOR-CLI', '❌ Invalid recovery email format', 'error')
    process.exit(1)
  }
  
  // Banner
  console.log('\n' + '='.repeat(60))
  log(false, 'CREATOR-CLI', '🚀 Microsoft Account Creator', 'log', 'cyan')
  console.log('='.repeat(60) + '\n')
  
  if (referralUrl) {
    log(false, 'CREATOR-CLI', `✅ Using referral URL: ${referralUrl}`, 'log', 'green')
  } else {
    log(false, 'CREATOR-CLI', '⚠️  No referral URL provided - account will NOT be linked to rewards', 'warn', 'yellow')
  }
  
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
    const creator = new AccountCreator(referralUrl, recoveryEmail, autoAccept, enable2FA)
    const result = await creator.create(browserContext)
    
    if (result) {
      // Success banner
      console.log('\n' + '='.repeat(60))
      log(false, 'CREATOR-CLI', '✅ ACCOUNT CREATED SUCCESSFULLY!', 'log', 'green')
      console.log('='.repeat(60))
      
      // Display account details
      log(false, 'CREATOR-CLI', `📧 Email: ${result.email}`, 'log', 'cyan')
      log(false, 'CREATOR-CLI', `🔐 Password: ${result.password}`, 'log', 'cyan')
      log(false, 'CREATOR-CLI', `👤 Name: ${result.firstName} ${result.lastName}`, 'log', 'cyan')
      log(false, 'CREATOR-CLI', `🎂 Birthdate: ${result.birthdate.day}/${result.birthdate.month}/${result.birthdate.year}`, 'log', 'cyan')
      
      if (result.referralUrl) {
        log(false, 'CREATOR-CLI', '🔗 Referral: Linked', 'log', 'green')
      }
      
      console.log('='.repeat(60))
      log(false, 'CREATOR-CLI', '💾 Account details saved to accounts-created/ directory', 'log', 'green')
      console.log('='.repeat(60) + '\n')
      
      // Keep browser open - don't close
      log(false, 'CREATOR-CLI', '✅ Account creation complete! Browser will remain open.', 'log', 'green')
      log(false, 'CREATOR-CLI', 'You can now use the account or close the browser manually.', 'log', 'cyan')
      log(false, 'CREATOR-CLI', 'Press Ctrl+C to exit the script.', 'log', 'yellow')
      
      // Keep process alive indefinitely
      await new Promise(() => {}) // Never resolves
    } else {
      // Failure
      console.log('\n' + '='.repeat(60))
      log(false, 'CREATOR-CLI', '❌ ACCOUNT CREATION FAILED', 'error')
      console.log('='.repeat(60) + '\n')
      
      await browserContext.close()
      process.exit(1)
    }
    
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.log('\n' + '='.repeat(60))
    log(false, 'CREATOR-CLI', `❌ Fatal error: ${msg}`, 'error')
    console.log('='.repeat(60) + '\n')
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

