# Account Creation Module

Automatically create new Microsoft accounts with **realistic email generation**, **human-like delays**, **interactive mode**, and **referral link support**.

## 🎯 Key Features

### ✨ Stealth & Realism
- **200+ Name Database**: Generates natural emails like `james.wilson1995@outlook.com`
- **Human-like Delays**: Random 0.5-4s delays between actions to avoid bot detection
- **Interactive Mode**: Choose auto-generate or enter your own email
- **Microsoft Suggestions**: Automatically handles "email taken" with Microsoft's alternatives
- **Badge Reading**: Always reads final email from identity badge for accuracy

### 🔧 Technical Features
- **Referral Support**: Create accounts from your referral links
- **Language-Independent**: CSS selectors work in any language
- **CAPTCHA Detection**: Pauses automatically, waits for human solving
- **Auto-Save**: Organized daily JSONC files in `accounts-created/`

## 📦 Installation

Already integrated - no additional setup needed!

## 🚀 Usage

### Command Line

```bash
# Without referral (standalone account)
npm run creator

# With referral link (earns you referral credit)
npm run creator https://rewards.bing.com/welcome?rh=YOUR_CODE&ref=rafsrchae
```

### Interactive Flow

When you run the creator:

```
=== Email Configuration ===
Generate email automatically? (Y/n): 
```

**Press Y or Enter**: Auto-generates realistic email
- Example: `sarah.martinez1998@hotmail.com`
- Uses 200+ names from database
- Multiple formats (firstname.lastname, firstnamelastname, etc.)

**Press n**: Manual email input
- You type the email you want
- Example: `mycoolemail@outlook.com`

## 📧 Email Generation

### Auto-Generation System

The system creates **realistic, human-like emails**:

```javascript
// Old (obvious bot pattern):
user1730970000abc@outlook.com  ❌

// New (looks like real person):
james.wilson@outlook.com       ✅
emily.brown95@hotmail.com      ✅
alex_taylor@outlook.fr         ✅
michael.garcia1998@outlook.com ✅
```

### Name Database

- **150+ First Names**: Male, female, gender-neutral
- **90+ Last Names**: Common surnames worldwide
- **Smart Formatting**: Varies patterns to look natural

### Email Formats

The system randomly uses these patterns:
- `firstname.lastname@domain.com`
- `firstnamelastname@domain.com`
- `firstname_lastname@domain.com`
- `firstnamelastname95@domain.com` (random number 0-99)
- `firstname.lastname1995@domain.com` (birth year style)

### Domains

Randomly selects from:
- `outlook.com`
- `hotmail.com`
- `outlook.fr`

## 🎭 Human-like Delays

All actions have **random delays** to mimic human behavior:

| Action | Delay Range |
|--------|-------------|
| After navigation | 1.5-3s |
| After button click | 2-4s |
| After dropdown select | 0.8-1.5s |
| After text input | 0.8-2s |
| Waiting for page load | 2-4s |

This prevents Microsoft's bot detection from flagging your accounts.

## 🔄 Microsoft Suggestions Handling

**Problem**: Email already exists
**Microsoft's Response**: Shows alternative suggestions (e.g., `john.smith247@outlook.com`)

**How the system handles it**:
1. ✅ Detects error message automatically
2. ✅ Finds suggestion toolbar
3. ✅ Clicks first suggestion
4. ✅ Reads final email from identity badge
5. ✅ Saves correct email to file

**Example Flow**:
```
You input:     john.smith@outlook.com
Microsoft:     ❌ Email taken
Microsoft:     💡 Suggestions: john.smith247@outlook.com, john.smith89@hotmail.com
System:        ✅ Clicks first suggestion
Identity Badge: john.smith247@outlook.com
Saved Account: john.smith247@outlook.com  ← Correct!
```

## 🔧 Complete Process Flow

1. **Navigation**
   - With referral: Goes to your referral URL → Clicks "Join Microsoft Rewards"
   - Without referral: Goes directly to `https://login.live.com/`

2. **Email Configuration** (Interactive)
   - Asks: Auto-generate or manual?
   - Auto: Generates realistic email from name database
   - Manual: You type the email

3. **Email Submission**
   - Fills email with human delays
   - Clicks Next button
   - Checks for "email taken" error

4. **Suggestion Handling** (if needed)
   - Detects error automatically
   - Clicks Microsoft's first suggestion
   - Continues smoothly

5. **Identity Badge Reading**
   - Reads final email from badge
   - Ensures accuracy (especially after suggestions)

6. **Password Generation**
   - 12-16 characters
   - Uppercase, lowercase, numbers, symbols
   - Meets all Microsoft requirements

7. **Birthdate**
   - Random age: 18-50 years old
   - Realistic distribution

8. **Names**
   - Extracted from email OR
   - Generated from name database
   - Capitalized properly

9. **CAPTCHA Detection**
   - Automatically detects CAPTCHA page
   - Pauses and waits for human solving
   - Up to 10 minutes timeout
   - Logs progress every 30 seconds

10. **Save Account**
    - Saves to `accounts-created/created_accounts_YYYY-MM-DD.jsonc`
    - Daily files for organization
    - All details preserved

## 📄 Output Format

```jsonc
// accounts-created/created_accounts_2025-01-09.jsonc
[
  {
    "email": "james.wilson1995@outlook.com",
    "password": "Xyz789!@#AbcDef",
    "birthdate": {
      "day": 17,
      "month": 5,
      "year": 1995
    },
    "firstName": "James",
    "lastName": "Wilson",
    "createdAt": "2025-01-09T10:30:00.000Z",
    "referralUrl": "https://rewards.bing.com/welcome?rh=YOUR_CODE&ref=rafsrchae"
  }
]
```

## 📂 File Structure

```
src/account-creation/
├── AccountCreator.ts    # Main orchestration with delays & interaction
├── DataGenerator.ts     # Generates realistic data
├── nameDatabase.ts      # 200+ names for email generation
├── cli.ts               # Command-line interface with banner
├── types.ts             # TypeScript interfaces
└── README.md            # This file
```

## 🔍 Technical Selectors (Language-Independent)

| Element | Selector |
|---------|----------|
| Create Account | `span[role="button"].fui-Link, a[id*="signup"]` |
| Email Input | `input[type="email"]` |
| Password Input | `input[type="password"]` |
| Next Button | `button[data-testid="primaryButton"], button[type="submit"]` |
| Birth Day | `button[name="BirthDay"]` |
| Birth Month | `button[name="BirthMonth"]` |
| Birth Year | `input[name="BirthYear"]` |
| First Name | `input[id*="firstName"]` |
| Last Name | `input[id*="lastName"]` |
| Identity Badge | `#bannerText, div[data-testid="identityBanner"]` |
| Error Message | `div[id*="Error"], div[class*="error"]` |
| Suggestions | `div[role="toolbar"][data-testid="suggestions"]` |
| CAPTCHA Title | `h1[data-testid="title"]` |

## ⚠️ Important Notes

- **Browser stays open** during CAPTCHA - intentional (human solving required)
- **No CAPTCHA automation** - Microsoft detects and bans bots
- **Referral URL must be full URL** starting with `https://`
- **Multiple runs** append to same daily file
- **Badge reading is critical** - final email may differ from input (suggestions)
- **Human delays are mandatory** - prevents bot detection

## 🎯 Why This Approach?

### Old System (Bot-Like)
```
❌ Email: user1730970000abc@outlook.com (obvious timestamp)
❌ Speed: Instant form filling (< 1 second)
❌ Errors: Didn't handle email-taken scenarios
❌ Badge: Ignored identity badge (wrong email saved)
```

### New System (Human-Like)
```
✅ Email: james.wilson1995@outlook.com (looks real)
✅ Speed: 0.5-4s delays between actions (natural)
✅ Errors: Handles suggestions automatically
✅ Badge: Always reads final email (accurate)
✅ Choice: User can choose auto or manual
```

## 📊 Success Tips

1. **Use auto-generate** for fastest creation
2. **Use manual mode** if you have specific email format requirements
3. **Let the script handle suggestions** - don't worry about "email taken" errors
4. **Solve CAPTCHA within 10 minutes** when prompted
5. **Check accounts-created/ folder** for all saved accounts

## 🐛 Troubleshooting

**Q: Email generation too fast?**
A: System uses 0.8-2s delays after each input - looks human.

**Q: Email already taken?**
A: System automatically clicks Microsoft's suggestion and reads from badge.

**Q: Want specific email format?**
A: Press 'n' when asked "Generate automatically?" and type your email.

**Q: CAPTCHA timeout?**
A: You have 10 minutes to solve it. If timeout, run script again.

**Q: Where are accounts saved?**
A: `accounts-created/created_accounts_YYYY-MM-DD.jsonc` (auto-created folder).

---

**Made with ❤️ for Microsoft Rewards automation**
