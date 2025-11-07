import Browser from '../browser/Browser'
import { AccountCreator } from './AccountCreator'
import { log } from '../util/Logger'
import { MicrosoftRewardsBot } from '../index'

async function main() {
  // Get referral URL from command line args
  const args = process.argv.slice(2)
  const referralUrl = args[0] // Optional referral URL
  
  // Validate URL format if provided
  if (referralUrl && !referralUrl.startsWith('http')) {
    log(false, 'CREATOR-CLI', '❌ Invalid URL format', 'error')
    log(false, 'CREATOR-CLI', 'Usage: npm run creator [referralUrl]', 'log')
    log(false, 'CREATOR-CLI', 'Example: npm run creator https://rewards.bing.com/welcome?rh=E3DCB441&ref=rafsrchae', 'log', 'cyan')
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
    const creator = new AccountCreator(referralUrl)
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
