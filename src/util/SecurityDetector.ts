import type { Page } from 'playwright'

/**
 * Security incident detected during login/authentication
 */
export interface SecurityIncident {
  kind: string
  account: string
  details?: string[]
  next?: string[]
  docsUrl?: string
}

/**
 * SecurityDetector: Centralized detection of login security blocks and anomalies
 * Extracted from Login.ts for testability and separation of concerns
 */
export class SecurityDetector {
  // Sign-in block patterns (Microsoft security messages)
  private static readonly SIGN_IN_BLOCK_PATTERNS: { re: RegExp; label: string }[] = [
    { re: /we can[''`]?t sign you in/i, label: 'cant-sign-in' },
    { re: /incorrect account or password too many times/i, label: 'too-many-incorrect' },
    { re: /used an incorrect account or password too many times/i, label: 'too-many-incorrect-variant' },
    { re: /sign-in has been blocked/i, label: 'sign-in-blocked-phrase' },
    { re: /your account has been locked/i, label: 'account-locked' },
    { re: /your account or password is incorrect too many times/i, label: 'incorrect-too-many-times' }
  ]

  /**
   * Check if page contains sign-in blocked message
   * Returns matched pattern label or null
   */
  static async detectSignInBlocked(page: Page): Promise<string | null> {
    try {
      let text = ''
      const selectors = ['[data-testid="title"]', 'h1', 'div[role="heading"]', 'div.text-title']
      
      for (const sel of selectors) {
        const el = await page.waitForSelector(sel, { timeout: 600 }).catch(() => null)
        if (el) {
          const t = (await el.textContent() || '').trim()
          if (t && t.length < 300) text += ' ' + t
        }
      }
      
      const lower = text.toLowerCase()
      for (const p of SecurityDetector.SIGN_IN_BLOCK_PATTERNS) {
        if (p.re.test(lower)) {
          return p.label
        }
      }
      
      return null
    } catch {
      return null
    }
  }

  /**
   * Parse masked email from Microsoft recovery prompts
   * Returns { prefix: string, domain: string } or null
   * Examples: "k*****@domain.com" → { prefix: "k", domain: "domain.com" }
   *           "ko****@domain.com" → { prefix: "ko", domain: "domain.com" }
   */
  static parseMaskedEmail(masked: string): { prefix: string; domain: string } | null {
    // Pattern: 1-2 visible chars, then masked chars, then @domain
    const regex = /([a-zA-Z0-9]{1,2})[a-zA-Z0-9*•._-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
    const match = regex.exec(masked)
    
    if (!match) {
      // Fallback: try looser pattern
      const loose = /([a-zA-Z0-9])[*•][a-zA-Z0-9*•._-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.exec(masked)
      if (!loose) return null
      return {
        prefix: (loose[1] || '').toLowerCase(),
        domain: (loose[2] || '').toLowerCase()
      }
    }
    
    return {
      prefix: (match[1] || '').toLowerCase(),
      domain: (match[2] || '').toLowerCase()
    }
  }

  /**
   * Check if masked email matches expected recovery email
   * Lenient matching: only compare visible prefix (1-2 chars) + domain
   */
  static matchesMaskedEmail(
    observed: { prefix: string; domain: string },
    expected: { prefix: string; domain: string }
  ): boolean {
    if (observed.domain !== expected.domain) return false
    
    // If only 1 char visible, match first char only
    if (observed.prefix.length === 1) {
      return expected.prefix.startsWith(observed.prefix)
    }
    
    // If 2 chars visible, both must match
    return expected.prefix === observed.prefix
  }

  /**
   * Extract all masked emails from page (candidates for recovery email check)
   * Returns array of masked email strings found in DOM
   */
  static async extractRecoveryCandidates(page: Page): Promise<string[]> {
    const candidates: string[] = []
    
    // Priority 1: Direct selectors (Microsoft variants + French)
    const directSelectors = [
      '[data-testid="recoveryEmailHint"]',
      '#recoveryEmail',
      '[id*="ProofEmail"]',
      '[id*="EmailProof"]',
      '[data-testid*="Email"]',
      'span:has(span.fui-Text)'
    ]
    
    for (const sel of directSelectors) {
      const el = await page.waitForSelector(sel, { timeout: 1000 }).catch(() => null)
      if (el) {
        const t = (await el.textContent() || '').trim()
        if (t) candidates.push(t)
      }
    }
    
    // Priority 2: List items
    const listItems = page.locator('[role="listitem"], li')
    const count = await listItems.count().catch(() => 0)
    for (let i = 0; i < Math.min(count, 12); i++) {
      const t = (await listItems.nth(i).textContent().catch(() => ''))?.trim() || ''
      if (t && /@/.test(t)) candidates.push(t)
    }
    
    // Priority 3: XPath generic masked patterns
    const xpath = page.locator('xpath=//*[contains(normalize-space(.), "@") and (contains(normalize-space(.), "*") or contains(normalize-space(.), "•"))]')
    const xpCount = await xpath.count().catch(() => 0)
    for (let i = 0; i < Math.min(xpCount, 12); i++) {
      const t = (await xpath.nth(i).textContent().catch(() => ''))?.trim() || ''
      if (t && t.length < 300) candidates.push(t)
    }
    
    // Priority 4: Full HTML scan fallback
    if (candidates.length === 0) {
      try {
        const html = await page.content()
        const generic = /[A-Za-z0-9]{1,4}[*•]{2,}[A-Za-z0-9*•._-]*@[A-Za-z0-9.-]+/g
        const frPhrase = /Nous\s+enverrons\s+un\s+code\s+à\s+([^<@]*[A-Za-z0-9]{1,4}[*•]{2,}[A-Za-z0-9*•._-]*@[A-Za-z0-9.-]+)[^.]{0,120}?Pour\s+vérifier/gi
        
        const found = new Set<string>()
        let m: RegExpExecArray | null
        while ((m = generic.exec(html)) !== null) found.add(m[0])
        while ((m = frPhrase.exec(html)) !== null) {
          const raw = m[1]?.replace(/<[^>]+>/g, '').trim()
          if (raw) found.add(raw)
        }
        
        candidates.push(...Array.from(found))
      } catch {
        /* ignore HTML scan errors */
      }
    }
    
    // Deduplicate
    const seen = new Set<string>()
    return candidates
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(t => t && !seen.has(t) && seen.add(t))
      .filter(t => /@/.test(t) && /[*•]/.test(t)) // Must be masked email
  }

  /**
   * Check if page contains account locked indicator
   */
  static async detectAccountLocked(page: Page): Promise<boolean> {
    return await page.waitForSelector('#serviceAbuseLandingTitle', { timeout: 1200 })
      .then(() => true)
      .catch(() => false)
  }

  /**
   * Parse email into { prefix: first 2 chars, domain }
   */
  static parseEmailReference(email: string): { prefix: string; domain: string } | null {
    if (!email || !/@/.test(email)) return null
    
    const [local, domain] = email.split('@')
    if (!local || !domain) return null
    
    return {
      prefix: local.slice(0, 2).toLowerCase(),
      domain: domain.toLowerCase()
    }
  }

  /**
   * Get documentation URL for security incident
   */
  static getDocsUrl(anchor?: string): string {
    const base = process.env.DOCS_BASE?.trim() || 'https://github.com/Obsidian-wtf/Microsoft-Rewards-Bot/blob/main/docs/security.md'
    const map: Record<string, string> = {
      'recovery-email-mismatch': '#recovery-email-mismatch',
      'we-cant-sign-you-in': '#we-cant-sign-you-in-blocked'
    }
    return anchor && map[anchor] ? `${base}${map[anchor]}` : base
  }
}
