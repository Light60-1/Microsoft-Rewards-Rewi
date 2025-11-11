---
description: Comprehensive development, architecture, and workflow rules for Microsoft Rewards Bot
applyTo: "**"
---

# Microsoft Rewards Bot - GitHub Copilot Instructions

## 📋 Project Overview

**Microsoft Rewards Bot** is a TypeScript-based automation tool that earns Microsoft Rewards points by completing daily tasks, searches, quizzes, and promotional activities. The bot emphasizes **human-like behavior**, **anti-detection measures**, and **long-term reliability**.

### Key Technologies
- **Language:** TypeScript (strict mode, ES2020 target)
- **Browser Automation:** Playwright + rebrowser-playwright (anti-detection)
- **Fingerprinting:** fingerprint-generator + fingerprint-injector
- **Runtime:** Node.js 20+ (22 recommended)
- **Build System:** TypeScript compiler (tsc)
- **Testing:** Node.js native test runner
- **Deployment:** Docker + Docker Compose support

### Project Structure
```
src/
├── index.ts                    # Main entry point + bot orchestration
├── config.jsonc                # User configuration (NOT committed)
├── accounts.jsonc              # User accounts (NOT committed, sensitive)
├── constants.ts                # Global constants (timeouts, URLs, colors)
├── browser/                    # Browser initialization + utilities
│   ├── Browser.ts              # Playwright browser factory
│   ├── BrowserFunc.ts          # Navigation, dashboard scraping
│   └── BrowserUtil.ts          # Tab management, humanization
├── flows/                      # High-level automation workflows
│   ├── DesktopFlow.ts          # Desktop automation sequence
│   ├── MobileFlow.ts           # Mobile automation sequence
│   ├── FlowUtils.ts            # Shared flow utilities
│   └── SummaryReporter.ts      # Run reporting + webhooks
├── functions/                  # Core activity handlers
│   ├── Activities.ts           # Activity type router
│   ├── Login.ts                # Microsoft account authentication
│   ├── Workers.ts              # Task execution (DailySet, Punch Cards, etc.)
│   └── activities/             # Individual activity implementations
│       ├── Search.ts           # Desktop/Mobile search automation
│       ├── Quiz.ts             # Quiz solving logic
│       ├── Poll.ts             # Poll completion
│       ├── ThisOrThat.ts       # This or That game
│       └── ...
├── util/                       # Shared utilities (ORGANIZED BY CATEGORY)
│   ├── core/                   # Core utilities
│   │   ├── Utils.ts            # General-purpose helpers
│   │   └── Retry.ts            # Exponential backoff retry logic
│   ├── network/                # HTTP & API utilities
│   │   ├── Axios.ts            # HTTP client with proxy support
│   │   └── QueryDiversityEngine.ts # Multi-source search query generation
│   ├── browser/                # Browser automation utilities
│   │   ├── BrowserFactory.ts   # Centralized browser creation
│   │   ├── Humanizer.ts        # Random delays, mouse gestures
│   │   └── UserAgent.ts        # User agent generation
│   ├── state/                  # State & persistence
│   │   ├── JobState.ts         # Persistent job state tracking
│   │   ├── Load.ts             # Configuration & session loading
│   │   └── MobileRetryTracker.ts # Mobile search retry tracking
│   ├── validation/             # Validation & detection
│   │   ├── StartupValidator.ts # Comprehensive startup validation
│   │   ├── BanDetector.ts      # Heuristic ban detection
│   │   └── LoginStateDetector.ts # Login state detection
│   ├── security/               # Authentication & security
│   │   └── Totp.ts             # TOTP generation for 2FA
│   └── notifications/          # Logging & notifications
│       ├── Logger.ts           # Centralized logging with redaction
│       ├── ConclusionWebhook.ts # Summary webhook notifications
│       ├── ErrorReportingWebhook.ts # Error reporting
│       ├── Ntfy.ts             # Push notifications
│       └── AdaptiveThrottler.ts # Adaptive delay management
├── dashboard/                  # Real-time web dashboard (Express + WebSocket)
│   ├── server.ts               # Express server + routes
│   ├── routes.ts               # API endpoints
│   ├── BotController.ts        # Bot lifecycle management
│   ├── state.ts                # Shared dashboard state
│   └── SessionLoader.ts        # Account session management
├── interface/                  # TypeScript interfaces
│   ├── Account.ts              # Account structure (email, password, totp, proxy)
│   ├── Config.ts               # Configuration schema
│   ├── DashboardData.ts        # Microsoft Rewards dashboard API types
│   └── ...
└── account-creation/           # Account creation automation
    ├── cli.ts                  # CLI interface
    ├── AccountCreator.ts       # Microsoft account registration (2671 LINES!)
    ├── DataGenerator.ts        # Realistic user data generation
    ├── nameDatabase.ts         # First/last name pool
    ├── types.ts                # Account creation interfaces
    └── README.md               # Account creation guide
docker/                         # Docker deployment files
├── Dockerfile                  # Multi-stage Docker build
├── compose.yaml                # Docker Compose configuration
├── entrypoint.sh               # Container initialization script
├── run_daily.sh                # Daily execution wrapper (cron)
└── crontab.template            # Cron schedule template
scripts/                        # Utility scripts
└── run.sh                      # Nix development environment launcher
setup/
├── setup.bat                   # Windows setup script
├── setup.sh                    # Linux/Mac setup script
├── nix/                        # NixOS configuration
│   ├── flake.nix               # Nix flake definition
│   └── flake.lock              # Nix flake lock file
└── update/
    ├── setup.mjs               # Initial setup automation
    └── update.mjs              # GitHub ZIP-based auto-updater (NO GIT REQUIRED!)
```

---

## 🏗️ Architecture Principles

### 1. Separation of Concerns
- **Flows** orchestrate high-level workflows (Desktop/Mobile sequences)
- **Functions** implement core reusable tasks (login, search, activities)
- **Utils** provide infrastructure (logging, retries, humanization)
- **Browser** handles all Playwright interactions (initialization, navigation, scraping)

### 2. Single Responsibility
- Each class/module has **one clear purpose**
- No "god classes" - split complex logic into focused modules
- Example: `BrowserFactory.ts` centralizes browser creation (was duplicated in flows)

### 3. Error Handling Strategy
- **All async operations MUST have try-catch blocks**
- Use `Retry` utility for transient failures (network, timeouts)
- Use `BanDetector` to identify security-related errors (CAPTCHA, lockouts)
- Log errors with context using `formatDetailedError()` utility
- Never swallow errors silently - always log or propagate

### 4. Type Safety
- **Strict TypeScript mode** enforced via `tsconfig.json`
- No `any` types - use proper types or `unknown` + type guards
- All public APIs MUST have explicit return types
- Use interface type guards for runtime validation (e.g., `isWorkerMessage()`)

### 5. State Management
- Bot state lives in `MicrosoftRewardsBot` class instance
- Job state (completed tasks) persists to disk via `JobState` utility
- Dashboard state managed via `dashboardState` singleton
- No global mutable state outside these systems

---

## 🛠️ Development Workflow

### Build & Run Commands
```bash
# Install dependencies
npm install

# Build TypeScript → JavaScript
npm run build

# Run the bot (production)
npm start

# Development mode (hot reload)
npm run dev

# Run tests
npm run test

# Type checking only
npm run typecheck

# Dashboard mode (standalone)
npm run dashboard

# Account creator
npm run creator
```

### Critical: Always Build Before Running
- Users run `npm install` → installs dependencies
- Users run `npm start` → executes `dist/index.js` (compiled output)
- **NEVER suggest running source files directly** unless in dev mode
- The `prestart` script auto-builds if `dist/` is missing

### Verification Steps After Changes
1. **Type Check:** `npm run typecheck` (must pass with 0 errors)
2. **Build:** `npm run build` (must succeed)
3. **Test:** `npm run test` (if tests exist for changed code)
4. **Manual Test:** Run bot with 1 test account to verify behavior

---

## 📜 Code Style & Standards

### Language & Formatting
- **Language:** All code, comments, and documentation in **English only**
- **Naming Conventions:**
  - Variables/Functions: `camelCase` (e.g., `getCurrentPoints`, `isMobile`)
  - Classes: `PascalCase` (e.g., `MicrosoftRewardsBot`, `BrowserFactory`)
  - Constants: `UPPER_SNAKE_CASE` (e.g., `TIMEOUTS.DASHBOARD_WAIT`)
  - Private methods: prefix with `private` keyword (e.g., `private handleError()`)
- **Indentation:** 4 spaces (configured in `tsconfig.json`)
- **Quotes:** Double quotes for strings (`"hello"`)
- **Semicolons:** Always use semicolons

### Function & Class Design
- **Functions:**
  - Keep functions **small and focused** (max ~50 lines)
  - Extract complex logic into helper functions
  - Use descriptive names that explain behavior (e.g., `shouldSkipAccount()`, not `check()`)
  - Add JSDoc comments for public APIs
- **Classes:**
  - Constructor should initialize state only (no heavy logic)
  - Keep public API surface minimal
  - Use private methods for internal logic
  - Inject dependencies via constructor (e.g., `bot` instance)

### Error Handling Patterns
```typescript
// ✅ GOOD: Explicit error handling with context
try {
    await page.click(selector)
} catch (error) {
    this.bot.log(this.bot.isMobile, 'ACTIVITY', `Failed to click: ${selector}`, 'error')
    throw new Error(`Activity click failed: ${getErrorMessage(error)}`)
}

// ❌ BAD: Silent failure
try {
    await page.click(selector)
} catch {
    // Ignoring error
}

// ✅ GOOD: Using Retry utility for transient failures
const retry = new Retry(this.bot.config.retryPolicy)
await retry.run(async () => {
    return await this.fetchData()
}, (error) => {
    // Only retry on network errors
    return error instanceof NetworkError
})
```

### Logging Standards
```typescript
// ✅ GOOD: Contextual logging with severity
this.bot.log(this.bot.isMobile, 'SEARCH', `Starting desktop search with ${queries.length} queries`)
this.bot.log(this.bot.isMobile, 'SEARCH', `Search completed: +${pointsEarned} points`, 'log', 'green')
this.bot.log(this.bot.isMobile, 'SEARCH', `Network timeout on query "${query}"`, 'warn')

// ❌ BAD: Generic console.log
console.log('Search done')

// ✅ GOOD: Error logging with full context
this.bot.log(this.bot.isMobile, 'ACTIVITY', `Activity failed: ${formatDetailedError('quiz', error, verbose)}`, 'error')
```

---

## 🔒 Security & Privacy

### Sensitive Data Handling
- **NEVER log passwords, TOTP secrets, or recovery codes**
- Email redaction is automatic via `logging.redactEmails` config
- Proxy credentials are sanitized in logs
- Session files (`sessions/`) contain sensitive cookies - never commit
- `accounts.jsonc` and `config.jsonc` are **gitignored** (user data)

### Anti-Detection Measures
- **Humanization MUST always be enabled** (`humanization.enabled: true`)
- Use random delays between actions (configured via `Humanizer`)
- Browser fingerprinting via `fingerprint-generator` (masks automation)
- Natural search patterns via `QueryDiversityEngine` (Google Trends, Reddit)
- Mouse gestures and scrolling via `BrowserUtil.humanizePage()`

### Ban Prevention
- **Never disable humanization** in production code
- Detect bans early via `BanDetector` (CAPTCHA, lockout messages)
- Implement `stopOnBan` to halt automation on first ban
- Use `globalStandby` mode to keep browser open for manual review
- Support proxy rotation per account

---

## 🚀 Feature Development Guidelines

### Before Starting Any Feature
1. **Understand the full codebase context:**
   - Read related modules in `src/flows/`, `src/functions/`, `src/util/`
   - Check existing patterns (e.g., how other activities are implemented)
   - Review interfaces in `src/interface/`
2. **Check configuration:**
   - New features should have corresponding `config.jsonc` flags
   - Default to safe/conservative behavior (e.g., `enabled: false`)
3. **Plan for long-term maintainability:**
   - No quick patches - solve root cause
   - Write reusable utilities, not one-off hacks
   - Consider future extensibility

### Adding a New Activity Type
1. **Create activity handler in `src/functions/activities/`:**
   ```typescript
   // src/functions/activities/MyActivity.ts
   import { Page } from 'rebrowser-playwright'
   import { MicrosoftRewardsBot } from '../../index'
   
   export class MyActivity {
       private bot: MicrosoftRewardsBot
   
       constructor(bot: MicrosoftRewardsBot) {
           this.bot = bot
       }
   
       async complete(page: Page): Promise<void> {
           this.bot.log(this.bot.isMobile, 'MY-ACTIVITY', 'Starting MyActivity')
           // Implementation here
       }
   }
   ```

2. **Register in `Activities.ts`:**
   ```typescript
   case 'myActivityType':
       const myActivity = new MyActivity(this.bot)
       await myActivity.complete(page)
       break
   ```

3. **Add config flag in `interface/Config.ts`:**
   ```typescript
   export interface Workers {
       doMyActivity?: boolean
   }
   ```

4. **Update default config in `src/config.jsonc`:**
   ```jsonc
   "workers": {
       "doMyActivity": true  // Add with sensible default
   }
   ```

5. **Document in appropriate docs file** (e.g., `docs/activities.md`)

### Adding a New Utility
1. **Place in `src/util/` with clear naming**
2. **Export as class or function (prefer functions for stateless utilities)**
3. **Add JSDoc comments for public API**
4. **Write unit tests in `tests/` directory**
5. **Update imports in dependent modules**

### Modifying Core Logic
- **ALWAYS verify no regressions:**
  - Run full test suite: `npm run test`
  - Test with 1-2 real accounts before deploying
  - Check logs for errors/warnings
- **Maintain backwards compatibility:**
  - Don't break existing configs
  - Support legacy config formats with deprecation warnings
- **Update documentation:**
  - Update relevant `docs/*.md` files
  - Update inline JSDoc comments
  - Update README.md if user-facing

---

## 🧪 Testing Standards

### Test Structure
- **Location:** All tests in `tests/` directory (mirrors `src/` structure)
- **Naming:** `filename.test.ts` (e.g., `queryDiversityEngine.test.ts`)
- **Runner:** Node.js native test runner (`node --test`)

### What to Test
- **Utilities:** Pure functions in `src/util/` (high priority)
- **Type Guards:** Runtime type validation functions
- **Complex Logic:** Ban detection, retry policies, query generation
- **Edge Cases:** Empty inputs, malformed data, timeouts

### Example Test
```typescript
// tests/util/utils.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { shortErrorMessage } from '../src/util/Utils'

describe('Utils', () => {
    it('should extract error message from Error instance', () => {
        const error = new Error('Test error')
        const result = shortErrorMessage(error)
        assert.strictEqual(result, 'Test error')
    })

    it('should handle unknown error types', () => {
        const result = shortErrorMessage({ custom: 'object' })
        assert.strictEqual(result, '[object Object]')
    })
})
```

### Running Tests
```bash
# Run all tests
npm run test

# Run specific test file
node --test tests/util/utils.test.ts
```

---

## 📦 Dependencies & Updates

### Core Dependencies
- **playwright** + **rebrowser-playwright:** Browser automation (must match versions)
- **fingerprint-generator** + **fingerprint-injector:** Anti-detection
- **axios:** HTTP client (with proxy support)
- **cheerio:** HTML parsing (dashboard scraping)
- **express** + **ws:** Dashboard server + WebSocket
- **chalk:** Console output colors

### Dependency Management
- **NEVER add dependencies without justification**
- **Check if existing dependencies can solve the problem first**
- **Verify compatibility:**
  - Check `package.json` engines field (Node.js 20+)
  - Test on Windows and Linux
  - Verify Docker compatibility
- **Update dependencies cautiously:**
  - Playwright updates may break anti-detection
  - Test thoroughly after updates

### Adding a New Dependency
1. **Justify the need** (why can't existing code solve this?)
2. **Check package health:**
   - Active maintenance
   - No critical security vulnerabilities
   - Compatible license (MIT, Apache, BSD)
3. **Install with exact version:**
   ```bash
   npm install --save-exact package-name@1.2.3
   ```
4. **Update documentation:**
   - Add to relevant section in README.md
   - Document usage in code comments

---

## 🐛 Debugging & Diagnostics

### Debug Mode
```bash
# Enable verbose logging
DEBUG_REWARDS_VERBOSE=1 npm start

# Force headless mode (useful for debugging in Docker)
FORCE_HEADLESS=1 npm start

# Skip random sleep delays (faster testing)
SKIP_RANDOM_SLEEP=true npm start
```

### Common Issues & Solutions

#### "Browser launch failed"
```bash
# Solution: Install Chromium
npx playwright install chromium
```

#### "Account credentials invalid"
- Check `accounts.jsonc` has correct email/password
- If 2FA enabled, verify `totp` field has correct secret
- Test manual login at https://login.live.com/

#### "Ban detected"
- Check `humanization.enabled: true` in config
- Review logs for CAPTCHA or security messages
- Use `BanDetector` output to identify root cause
- Consider proxies or reduced frequency

#### "Module not found"
```bash
# Solution: Reinstall and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Logging Strategy
- **Console logs:** Real-time monitoring (user-facing)
- **Webhook logs:** Remote monitoring (Discord, Ntfy)
- **Job state:** Persistent completion tracking (resume after crash)
- **Error logs:** Detailed stack traces (verbose mode)

---

## 🔄 Git Workflow & Versioning

### Commit Message Format
Use **Conventional Commits** style:
```
feat: Add support for new quiz type
fix: Resolve mobile search retry loop
refactor: Extract browser factory to centralized utility
docs: Update scheduling guide with cron examples
test: Add unit tests for QueryDiversityEngine
chore: Update dependencies to latest versions
```

### Branching Strategy
- **main:** Production-ready code (always stable)
- **feature/name:** New features (merge to main via PR)
- **fix/issue:** Bug fixes (merge to main via PR)
- **refactor/name:** Code improvements (no behavior change)

### Pull Request Checklist
- [ ] Code follows style guide (English, camelCase, etc.)
- [ ] All tests pass (`npm run test`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Tested manually with real account
- [ ] Documentation updated (README, docs/)
- [ ] No sensitive data in commits (no secrets, keys, emails)

---

## 📖 Documentation Standards

### Code Documentation
- **JSDoc comments for all public APIs:**
  ```typescript
  /**
   * Execute the full desktop automation flow for an account
   * 
   * Performs tasks in sequence: login, daily set, promotions, searches
   * 
   * @param account Account to process (email, password, totp, proxy)
   * @returns Promise resolving to points collected during the flow
   * @throws {Error} If critical operation fails (login, browser init)
   * 
   * @example
   * ```typescript
   * const flow = new DesktopFlow(bot)
   * const result = await flow.run(account)
   * ```
   */
  async run(account: Account): Promise<DesktopFlowResult>
  ```

- **Inline comments for complex logic:**
  ```typescript
  // IMPROVED: Use centralized browser factory to eliminate duplication
  const browser = await createBrowserInstance(this.bot, account.proxy, account.email)
  ```

- **Explain WHY, not WHAT:**
  ```typescript
  // ❌ BAD: Obvious comment
  // Increment counter
  counter++

  // ✅ GOOD: Explains reasoning
  // Retry mobile search due to known Microsoft API instability
  await retry.run(() => doMobileSearch())
  ```

### User Documentation
- **Location:** All user-facing docs in `docs/` directory
- **Style:** Clear, concise, beginner-friendly
- **Structure:**
  - Overview at top
  - Table of contents for long docs
  - Code examples with syntax highlighting
  - Troubleshooting section
  - Related links at bottom

### When to Update Documentation
- **Always:**
  - New config options → Update `docs/config.md` or inline in `config.jsonc`
  - New CLI commands → Update `docs/commands.md`
  - Behavior changes → Update relevant guide
- **Never:**
  - Minor bug fixes (no user-visible change)
  - Refactoring (no API change)
  - Internal implementation details

---

## 🚫 Anti-Patterns & Common Mistakes

### ❌ Don't Do This

1. **Magic Numbers:**
   ```typescript
   // ❌ BAD
   await page.waitForTimeout(5000)
   
   // ✅ GOOD
   await page.waitForTimeout(TIMEOUTS.ACTIVITY_WAIT)
   ```

2. **Hardcoded URLs:**
   ```typescript
   // ❌ BAD
   await page.goto('https://rewards.bing.com')
   
   // ✅ GOOD
   await this.bot.browser.func.goHome(page)
   ```

3. **Silent Failures:**
   ```typescript
   // ❌ BAD
   try {
       await doSomething()
   } catch {
       // Ignore
   }
   
   // ✅ GOOD
   try {
       await doSomething()
   } catch (error) {
       this.bot.log(this.bot.isMobile, 'TASK', `Operation failed: ${getErrorMessage(error)}`, 'error')
       throw error // Re-throw if caller needs to handle
   }
   ```

4. **Using `any` Type:**
   ```typescript
   // ❌ BAD
   function process(data: any) { ... }
   
   // ✅ GOOD
   function process(data: DashboardData) { ... }
   // OR if truly dynamic:
   function process(data: unknown) {
       if (isDashboardData(data)) { ... }
   }
   ```

5. **Duplicate Logic:**
   ```typescript
   // ❌ BAD: Browser creation duplicated in DesktopFlow and MobileFlow
   
   // ✅ GOOD: Extract to centralized utility
   // src/util/BrowserFactory.ts
   export async function createBrowserInstance(bot, proxy, email) { ... }
   ```

6. **Global State:**
   ```typescript
   // ❌ BAD
   let globalPointsEarned = 0
   
   // ✅ GOOD
   class MicrosoftRewardsBot {
       private accountSummaries: AccountSummary[] = []
   }
   ```

7. **Console.log for Logging:**
   ```typescript
   // ❌ BAD
   console.log('Starting search')
   
   // ✅ GOOD
   this.bot.log(this.bot.isMobile, 'SEARCH', 'Starting search')
   ```

---

## 🔍 Code Review Checklist

Before submitting ANY code change:

### Functionality
- [ ] Code solves the stated problem completely
- [ ] No regressions in existing features
- [ ] Edge cases handled (null, undefined, empty arrays)
- [ ] Error handling implemented correctly

### Code Quality
- [ ] Follows project style guide
- [ ] No code duplication (DRY principle)
- [ ] Functions are small and focused
- [ ] Variables have descriptive names
- [ ] No commented-out code (remove or explain)

### Type Safety
- [ ] No `any` types (use proper types or `unknown`)
- [ ] Explicit return types on public functions
- [ ] Type guards for runtime validation
- [ ] Interfaces updated if data structures changed

### Performance
- [ ] No unnecessary loops or redundant operations
- [ ] Async operations handled efficiently
- [ ] Memory leaks prevented (cleanup in `finally` blocks)
- [ ] Timeouts configured to prevent infinite hangs

### Security
- [ ] No sensitive data logged (passwords, TOTP, tokens)
- [ ] User input validated/sanitized
- [ ] Proxy credentials handled securely
- [ ] Anti-detection measures not weakened

### Testing
- [ ] Unit tests added/updated for new logic
- [ ] Existing tests still pass
- [ ] Manual testing performed
- [ ] Verified on both Windows and Linux (if OS-specific)

### Documentation
- [ ] JSDoc comments on public APIs
- [ ] User-facing docs updated (`docs/`)
- [ ] Inline comments for complex logic
- [ ] README.md updated if user-facing change

---

## 🎯 Best Practices Summary

### Always Do This ✅
1. **Use TypeScript strict mode** (already configured)
2. **Log errors with context** (use `formatDetailedError()`)
3. **Keep humanization enabled** (never disable in production)
4. **Extract reusable logic** (avoid duplication)
5. **Write in English** (code, comments, docs)
6. **Test before committing** (build + typecheck + manual test)
7. **Document public APIs** (JSDoc comments)
8. **Handle errors explicitly** (no silent catches)
9. **Use constants** (no magic numbers/strings)
10. **Verify full codebase context** (understand existing patterns)

### Never Do This ❌
1. **Don't commit sensitive data** (`accounts.jsonc`, `sessions/`)
2. **Don't disable humanization** (breaks anti-detection)
3. **Don't use console.log** (use `bot.log()`)
4. **Don't ignore TypeScript errors** (fix them properly)
5. **Don't duplicate code** (extract to utilities)
6. **Don't use `any` type** (use proper types)
7. **Don't create tracking docs** (summarize in chat/commit messages)
8. **Don't hardcode values** (use config or constants)
9. **Don't swallow errors** (log or propagate)
10. **Don't rush patches** (solve root cause)

---

## 🚀 Quick Reference

### Project Commands
```bash
npm install                 # Install dependencies
npm run build               # Compile TypeScript
npm start                   # Run bot (production)
npm run dev                 # Run bot (development)
npm run test                # Run test suite
npm run typecheck           # Type check only
npm run dashboard           # Start dashboard server
npm run creator             # Account creation wizard
```

### Key Files
- **Entry Point:** `src/index.ts` (main bot orchestration)
- **Config:** `src/config.jsonc` (user configuration)
- **Accounts:** `src/accounts.jsonc` (sensitive, gitignored)
- **Build Output:** `dist/` (compiled JavaScript)
- **Documentation:** `docs/` (user guides)
- **Tests:** `tests/` (unit tests)

### Important Utilities
- **Logging:** `src/util/Logger.ts` (`log()` function)
- **Retries:** `src/util/Retry.ts` (exponential backoff)
- **Humanization:** `src/util/Humanizer.ts` (random delays)
- **Ban Detection:** `src/util/BanDetector.ts` (heuristic detection)
- **Browser Factory:** `src/util/BrowserFactory.ts` (centralized creation)
- **Error Formatting:** `src/util/Utils.ts` (`formatDetailedError()`)

### Configuration Flags
```jsonc
{
  "humanization.enabled": true,       // ALWAYS true in production
  "workers.doDesktopSearch": true,    // Enable desktop searches
  "workers.doMobileSearch": true,     // Enable mobile searches
  "workers.doDailySet": true,         // Enable daily activities
  "execution.runOnZeroPoints": false, // Skip if no points available
  "jobState.enabled": true,           // Track completed tasks
  "scheduling.enabled": false         // Auto-schedule (cron/Task Scheduler)
}
```

---

## 📞 Support & Resources

- **Discord:** https://discord.gg/k5uHkx9mne (community support)
- **GitHub Issues:** https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/issues
- **Documentation:** `/docs/index.md` (full guide index)
- **License:** CC BY-NC-SA 4.0 (non-commercial use)

---

## 🔧 Key Utilities Reference

### Core Infrastructure Utilities

**BrowserFactory (`src/util/BrowserFactory.ts`):**
- **Purpose:** Centralized browser instance creation (eliminates Desktop/Mobile duplication)
- **Key Function:** `createBrowserInstance(bot, proxy, email)` → Returns configured Playwright BrowserContext
- **Usage:** All flows use this instead of duplicating browser creation logic

**Humanizer (`src/util/Humanizer.ts`):**
- **Purpose:** Random delays, mouse gestures, scrolling to mimic human behavior
- **Key Methods:**
  - `microGestures(page)`: Random mouse moves (40% prob) and scrolls (20% prob)
  - `actionPause()`: Configurable random delay between actions (default 150-450ms, max 5s)
- **Configuration:** `humanization.enabled` (MUST be true in production), `gestureMoveProb`, `gestureScrollProb`, `actionDelay`

**BrowserUtil (`src/browser/BrowserUtil.ts`):**
- **Purpose:** Dismiss popups, overlays, cookie banners, streak dialogs, terms updates
- **Key Methods:**
  - `tryDismissAllMessages(page)`: One-shot dismissal of 15+ button types
  - `dismissStreakDialog()`, `dismissTermsUpdateDialog()`: Specialized handlers
  - `getLatestTab()`: Get most recently opened tab
  - `reloadBadPage()`: Detect and reload network/HTTP 400 errors
  - `humanizePage(page)`: Combine humanization + action pause
- **Pattern:** Silent failures (popups not present = expected, don't break flow)

**Retry (`src/util/Retry.ts`):**
- **Purpose:** Exponential backoff with jitter for transient failures
- **Configuration:** `retryPolicy` in config (maxAttempts, baseDelay, maxDelay, multiplier, jitter)
- **Key Method:** `run(asyncFn, isRetryable?)` - Only retry if predicate returns true
- **Usage:** Network calls, dashboard scraping, activity completion

**JobState (`src/util/JobState.ts`):**
- **Purpose:** Persistent checkpoint tracking to enable resume-after-crash
- **Storage:** Per-account, per-day JSON files in `sessions/job-state/`
- **Key Methods:**
  - `isDone(activity)` / `markDone(activity)`: Track individual activity completion
  - `isAccountComplete(email)` / `markAccountComplete(email)`: Track full account completion
  - `resetAllAccounts()`: Clear state for new day
- **Integration:** Used by `index.ts` runTasks loop, SummaryReporter, Workers

**QueryDiversityEngine (`src/util/QueryDiversityEngine.ts`):**
- **Purpose:** Generate diverse search queries from multiple sources (avoid pattern detection)
- **Sources:** Google Trends (primary), Reddit trending, news headlines, Wikipedia random, local fallback
- **Key Methods:**
  - `fetchQueries(count, sources)`: Main entry point with caching
  - `getFromSource(source, count)`: Per-source fetcher
  - `interleaveQueries(queries)`: Mix sources for diversity
- **Configuration:** `queryDiversity.enabled`, `sources` (array), `googleTrends.geo`/`category`

**BanDetector (`src/util/BanDetector.ts`):**
- **Purpose:** Heuristic detection of account suspension from error messages
- **Pattern Matching:** Regex array (`BAN_PATTERNS`) matching "suspend", "lock", "restricted", "violation", etc.
- **Key Method:** `detectBanReason(error: Error | string)` → Returns reason string or null
- **Integration:** Used by flows to stop execution on ban detection

**Logger (`src/util/Logger.ts`):**
- **Purpose:** Centralized logging with console, Discord webhook, NTFY push notifications
- **Features:**
  - Email redaction (if `logging.redactEmails: true`)
  - Webhook buffering with rate limiting (debounce 750ms, flush interval 5s)
  - Color-coded console output (chalk)
  - Error formatting with stack traces
- **Key Functions:**
  - `log(isMobile, title, message, level?, color?)`: Main logging function
  - `logError(title, message, isMobile)`: Returns error handler for catch blocks
  - `enqueueWebhookLog()`: Buffered webhook dispatch

**Constants (`src/constants.ts`):**
- **Purpose:** Centralized constants (NO magic numbers)
- **Categories:**
  - `TIMEOUTS`: SHORT (500ms), MEDIUM (1.5s), LONG (3s), DASHBOARD_WAIT (10s), LOGIN_MAX (env: 30s-10min, default 3min)
  - `RETRY_LIMITS`: Dashboard reloads (2), mobile search (3), activity max iterations (15)
  - `DELAYS`: Search delays, typing speed (20ms/char), quiz answer wait (2s)
  - `SELECTORS`: Activity IDs, suspended account header, quiz completion markers
  - `URLS`: Rewards dashboard, sign-in page, mobile API endpoint
  - `DISCORD`: Webhook rate limits, embed length (1900), colors (red, green, blue)

### Specialized Utilities

**LoginStateDetector (`src/util/LoginStateDetector.ts`):**
- **Purpose:** Detect login state (success, 2FA required, blocked, error)
- **Usage:** Called by Login.ts to determine next action

**MobileRetryTracker (`src/util/MobileRetryTracker.ts`):**
- **Purpose:** Track mobile search retry counts per account (mobile is flaky)
- **Usage:** MobileFlow tracks retries, aborts after threshold

**AdaptiveThrottler (`src/util/AdaptiveThrottler.ts`):**
- **Purpose:** Dynamic delay adjustment between activities
- **Usage:** Workers.ts applies throttling between activity attempts

**Totp (`src/util/Totp.ts`):**
- **Purpose:** Generate TOTP codes for 2FA
- **Usage:** Login.ts automatic TOTP submission

---

## 🚨 Known Issues & Technical Debt

### Files Needing Refactoring

**Login.ts (1700+ LINES - CRITICAL):**
- **Issue:** Violates Single Responsibility Principle
- **Internal Comment (lines 17-25):** Suggests splitting into:
  - `LoginFlow.ts` (main orchestration)
  - `TotpHandler.ts` (2FA/TOTP logic)
  - `PasskeyHandler.ts` (passkey/biometric prompts)
  - `RecoveryHandler.ts` (recovery email detection)
  - `SecurityDetector.ts` (ban/block detection)
- **When to Address:** Before adding new login features
- **Priority:** MEDIUM (works reliably, but maintainability suffers)

**Search.ts (600+ LINES):**
- **Status:** Manageable but complex
- **Complexity:** Google Trends API, semantic deduplication (Jaccard similarity), stagnation detection, fallback queries
- **Consideration:** Could split into SearchOrchestrator + QueryGenerator + DeduplicationEngine if further features added
- **Priority:** LOW (currently maintainable)

**index.ts (1700+ LINES):**
- **Status:** Acceptable for main entry point
- **Content:** Bot orchestration, clustering, account loop, job state management
- **Consideration:** Main files are allowed to be large if they're coordinators
- **Priority:** LOW (no action needed)

### Architecture Patterns to Maintain

**Browser Creation Pattern:**
```typescript
// ✅ CORRECT: Use centralized factory
import { createBrowserInstance } from '../util/BrowserFactory'
const browser = await createBrowserInstance(bot, account.proxy, account.email)

// ❌ WRONG: Don't recreate Browser class instances manually
const browserInstance = new Browser(bot)
const browser = await browserInstance.createBrowser(proxy, email)
```

**Error Handling Pattern:**
```typescript
// ✅ CORRECT: Explicit try-catch with context
try {
    await operation()
} catch (error) {
    this.bot.log(this.bot.isMobile, 'OPERATION', `Failed: ${getErrorMessage(error)}`, 'error')
    throw new Error(`Operation failed: ${getErrorMessage(error)}`)
}

// ❌ WRONG: Silent catch (only for non-critical operations like popups)
try {
    await operation()
} catch { /* silent */ }
```

**Semantic Deduplication Pattern (Search.ts):**
```typescript
// Jaccard similarity for word-level comparison (threshold 0.65)
private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/))
    const setB = new Set(b.toLowerCase().split(/\s+/))
    const intersection = new Set([...setA].filter(x => setB.has(x)))
    const union = new Set([...setA, ...setB])
    return union.size === 0 ? 0 : intersection.size / union.size
}

// Combined deduplication: exact + semantic in single pass
private combinedDeduplication(queries: string[], threshold = 0.65): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    
    for (const query of queries) {
        const normalized = query.toLowerCase().trim()
        if (seen.has(normalized)) continue // Exact duplicate
        
        // Semantic similarity check
        if (result.some(existing => this.jaccardSimilarity(existing, query) >= threshold)) {
            continue
        }
        
        seen.add(normalized)
        result.push(query)
    }
    
    return result
}
```

---

## 📚 Additional Context

### Version Management
**Version Source:** Read dynamically from `package.json` (field: `version`)
- **Current Version (as of this writing):** 2.56.5
- **Code Location:** `src/index.ts` line 235-247 (`getVersion()` method)
- **Implementation:**
  ```typescript
  private getVersion(): string {
      const DEFAULT_VERSION = '2.56.0'
      try {
          const pkgPath = path.join(__dirname, '../package.json')
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
          return pkg.version || DEFAULT_VERSION
      } catch {
          // Ignore: Fall back to default version if package.json is unavailable
      }
      return DEFAULT_VERSION
  }
  ```
- **NEVER hardcode version numbers in documentation** - always reference package.json

### Docker & Scheduling Context

**docker/entrypoint.sh:**
- **Purpose:** Docker container initialization script (located in `docker/` directory)
- **Key Features:**
  - Timezone configuration (env: `TZ`, default UTC)
  - Initial run on start (env: `RUN_ON_START=true`)
  - Cron schedule registration (env: `CRON_SCHEDULE` required)
  - Playwright browser preinstallation (`PLAYWRIGHT_BROWSERS_PATH=0`)
- **Usage:** Docker Compose sets `CRON_SCHEDULE`, container runs cron in foreground

**docker/run_daily.sh:**
- **Purpose:** Daily execution wrapper for cron jobs (located in `docker/` directory)
- **Key Features:**
  - Random sleep delay (0-30min) to avoid simultaneous runs across containers
  - Environment variable: `SKIP_RANDOM_SLEEP=true` to disable delay
  - Called by cron and initial run
- **Pattern:** Used in both Docker and native cron setups

### Dashboard Architecture

**BotController (`src/dashboard/BotController.ts`):**
- **Purpose:** Bot lifecycle management for web dashboard
- **Key Methods:**
  - `start()`: Initialize bot instance, run asynchronously, return immediately
  - `stop()`: Cleanup bot instance (note: current task completes first)
  - `restart()`: stop() + wait 2s + start()
  - `getStatus()`: Return running state, PID, uptime, start time
- **Race Condition Fix:** `isStarting` flag prevents multiple simultaneous start() calls
- **State Management:** Updates `dashboardState` singleton for WebSocket broadcast

**Dashboard Features:**
- **Real-time updates:** WebSocket connection for live progress
- **Session management:** Load/save account sessions (cookies, tokens)
- **Manual controls:** Start/stop bot, reset job state, view account status
- **Log streaming:** Buffered webhook logs displayed in UI

### Activity System Details

**Activity Types (9 implementations in `src/functions/activities/`):**
1. **ABC.ts:** "ABC" promotional activity (multi-choice selection)
2. **DailyCheckIn.ts:** Mobile daily check-in (mobile-only API)
3. **Poll.ts:** Single-choice poll (click one option)
4. **Quiz.ts:** Multi-question quiz (8 questions, correctAnswer detection)
5. **ReadToEarn.ts:** Mobile article reading (mobile-only API)
6. **Search.ts:** Bing search automation (600+ lines, Google Trends integration)
7. **SearchOnBing.ts:** "Search on Bing" promotional link (click + wait 5s)
8. **ThisOrThat.ts:** "This or That" game (10 rounds, binary choice)
9. **UrlReward.ts:** Generic URL reward (navigate + wait for points)

**Activity Dispatcher (`Activities.ts`):**
- **Pattern:** Type classification → handler delegation
- **Classification Logic:** Detect activity type from promotionType, title, attributes
- **Fallback:** Unknown types logged as warnings, not errors

### Search Engine Diversity

**QueryDiversityEngine Sources:**
1. **google-trends (PRIMARY):**
   - API: `https://trends.google.com/trends/api/dailytrends`
   - Configuration: `geo` (country code), `category` (optional)
   - Parsing: JSON response with trending queries
   
2. **reddit:**
   - API: `https://www.reddit.com/r/all/hot.json`
   - Extraction: Post titles from hot posts
   
3. **news:**
   - API: `https://news.google.com/rss` (RSS feed)
   - Extraction: Headlines from RSS items
   
4. **wikipedia:**
   - API: `https://en.wikipedia.org/w/api.php?action=query&list=random`
   - Extraction: Random article titles
   
5. **local-fallback:**
   - Source: Embedded `queries.json` file
   - Usage: When all external sources fail
   - Content: Pre-generated generic queries

**Query Interleaving Strategy:**
- Round-robin mixing of sources
- Semantic deduplication (Jaccard similarity ≥ 0.65)
- Exact duplicate removal
- Minimum length filter (4 characters)

---

## 🎨 Advanced Features & Hidden Gems

### Account Creation System (`src/account-creation/`)

**AccountCreator.ts (2671 LINES - MASSIVE FEATURE):**
- **Purpose:** Fully automated Microsoft account registration with CAPTCHA support
- **Features:** Realistic data generation, CAPTCHA detection + human-solving wait, email suggestion handling, domain reservation detection, post-creation 2FA setup, recovery email config, passkey refusal, marketing opt-out, referral link integration, session persistence
- **CLI:** `-y` (auto-accept), `http://...` (referral URL), `email@...` (recovery email)
- **Usage:** `npm run creator`
- **Key Methods:** `generateAndFillEmail()`, `handleEmailTaken()`, `fillBirthdate()`, `fillNames()`, `waitForCaptcha()`, `setup2FA()`, `setupRecoveryEmail()`, `verifyAccountActive()`
- **Patterns:** Smart verification (Microsoft domain separation), retry operations, dropdown handling, page stability checks, error recovery flows

**DataGenerator.ts:**
- **Methods:** `generateEmail()` (8 realistic patterns), `generatePassword()` (14-18 chars), `generateBirthdate()` (age 20-45), `generateNames()` (extracts from email)
- **Pattern:** Uses nameDatabase.ts with 100+ first/last names

### Auto-Update System (`setup/update/update.mjs`)

**update.mjs (600+ LINES - CRITICAL FEATURE):**
- **Purpose:** Git-free update system using GitHub ZIP downloads (NO merge conflicts!)
- **Features:** Version comparison (cache-busting), GitHub API ZIP download, selective file preservation, automatic rollback on build failure, integrity checks, Docker vs Host detection, dependency installation, TypeScript rebuild verification, update marker creation
- **Protected Files:** `src/config.jsonc`, `src/accounts.jsonc`, `sessions/`, `.playwright-chromium-installed`
- **Workflow:** Check version → Create backups → Download ZIP → Extract → Selective copy → Restore protected → npm ci → npm install → npm build → Verify integrity → Create marker → Clean temp
- **Docker Behavior:** Exits cleanly to let orchestrator restart
- **Host Behavior:** Signals restart needed (bot detects `.update-happened` marker)

### Startup Validation System (`src/util/StartupValidator.ts`)

**StartupValidator.ts (500+ LINES - PRODUCTION SAFETY):**
- **Purpose:** Comprehensive configuration validation before bot starts (prevents runtime crashes!)
- **11 Categories:** Accounts, Config, Environment, File System, Browser, Network, Workers, Execution, Search, Humanization, Security
- **Error Types:** Blocking (prevent startup), Non-Blocking (warn), Warnings (best practices)
- **Validations:** Email format, password presence, TOTP Base32 format, Node.js ≥18, webhook URLs (http/https), action delay min≤max, gesture probabilities (0-1), allowed windows format, clusters 1-10, retry counts, etc.
- **Display:** Color-coded (red errors, yellow warnings), fix suggestions, documentation links, 3s pause if errors

### Conclusion Webhook System (`src/util/ConclusionWebhook.ts`)

**Features:** Discord embed format, dual webhook support (deduplicated URLs), retry logic (3 attempts, exponential backoff: 1s, 2s, 4s), optional NTFY integration, avatar + username customization

---

**Last Updated:** 2025-11-09  
**Version:** See `package.json` for current version  
**Maintainer:** Obsidian-wtf + Community Contributors

---

*This file provides comprehensive guidance for GitHub Copilot to maintain code quality, architecture consistency, and long-term maintainability of the Microsoft Rewards Bot project.*
