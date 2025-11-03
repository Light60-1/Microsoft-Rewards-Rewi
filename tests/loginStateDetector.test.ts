import test from 'node:test'
import assert from 'node:assert/strict'

import { LoginState, LoginStateDetector } from '../src/util/LoginStateDetector'

/**
 * Tests for LoginStateDetector - login flow state machine
 */

test('LoginState enum contains expected states', () => {
  assert.ok(LoginState.EmailPage, 'Should have EmailPage state')
  assert.ok(LoginState.PasswordPage, 'Should have PasswordPage state')
  assert.ok(LoginState.TwoFactorRequired, 'Should have TwoFactorRequired state')
  assert.ok(LoginState.LoggedIn, 'Should have LoggedIn state')
  assert.ok(LoginState.Blocked, 'Should have Blocked state')
})

test('detectState returns LoginStateDetection structure', async () => {
  // Mock page object
  const mockPage = {
    url: () => 'https://rewards.bing.com/',
    locator: (selector: string) => ({
      first: () => ({
        isVisible: () => Promise.resolve(true),
        textContent: () => Promise.resolve('Test')
      })
    }),
    evaluate: () => Promise.resolve(150)
  }

  const detection = await LoginStateDetector.detectState(mockPage as any)

  assert.ok(detection, 'Should return detection object')
  assert.ok(typeof detection.state === 'string', 'Should have state property')
  assert.ok(['high', 'medium', 'low'].includes(detection.confidence), 'Should have valid confidence')
  assert.ok(typeof detection.url === 'string', 'Should have url property')
  assert.ok(Array.isArray(detection.indicators), 'Should have indicators array')
})

test('detectState identifies LoggedIn state on rewards domain', async () => {
  const mockPage = {
    url: () => 'https://rewards.bing.com/dashboard',
    locator: (selector: string) => {
      if (selector.includes('RewardsPortal') || selector.includes('dashboard')) {
        return {
          first: () => ({
            isVisible: () => Promise.resolve(true)
          })
        }
      }
      return {
        first: () => ({
          isVisible: () => Promise.resolve(false)
        })
      }
    },
    evaluate: () => Promise.resolve(200)
  }

  const detection = await LoginStateDetector.detectState(mockPage as any)

  assert.equal(detection.state, LoginState.LoggedIn, 'Should detect LoggedIn state')
  assert.equal(detection.confidence, 'high', 'Should have high confidence')
  assert.ok(detection.indicators.length > 0, 'Should have indicators')
})

test('detectState identifies EmailPage state on login.live.com', async () => {
  const mockPage = {
    url: () => 'https://login.live.com/login.srf',
    locator: (selector: string) => {
      if (selector.includes('email') || selector.includes('loginfmt')) {
        return {
          first: () => ({
            isVisible: () => Promise.resolve(true)
          })
        }
      }
      return {
        first: () => ({
          isVisible: () => Promise.resolve(false),
          textContent: () => Promise.resolve(null)
        })
      }
    },
    evaluate: () => Promise.resolve(100)
  }

  const detection = await LoginStateDetector.detectState(mockPage as any)

  assert.equal(detection.state, LoginState.EmailPage, 'Should detect EmailPage state')
  assert.equal(detection.confidence, 'high', 'Should have high confidence')
})

test('detectState identifies PasswordPage state', async () => {
  const mockPage = {
    url: () => 'https://login.live.com/ppsecure/post.srf',
    locator: (selector: string) => {
      if (selector.includes('password') || selector.includes('passwd')) {
        return {
          first: () => ({
            isVisible: () => Promise.resolve(true)
          })
        }
      }
      return {
        first: () => ({
          isVisible: () => Promise.resolve(false),
          textContent: () => Promise.resolve(null)
        })
      }
    },
    evaluate: () => Promise.resolve(100)
  }

  const detection = await LoginStateDetector.detectState(mockPage as any)

  assert.equal(detection.state, LoginState.PasswordPage, 'Should detect PasswordPage state')
  assert.equal(detection.confidence, 'high', 'Should have high confidence')
})

test('detectState identifies TwoFactorRequired state', async () => {
  const mockPage = {
    url: () => 'https://login.live.com/proofs.srf',
    locator: (selector: string) => {
      if (selector.includes('otc') || selector.includes('one-time-code')) {
        return {
          first: () => ({
            isVisible: () => Promise.resolve(true)
          })
        }
      }
      return {
        first: () => ({
          isVisible: () => Promise.resolve(false),
          textContent: () => Promise.resolve(null)
        })
      }
    },
    evaluate: () => Promise.resolve(100)
  }

  const detection = await LoginStateDetector.detectState(mockPage as any)

  assert.equal(detection.state, LoginState.TwoFactorRequired, 'Should detect TwoFactorRequired state')
  assert.equal(detection.confidence, 'high', 'Should have high confidence')
})

test('detectState identifies PasskeyPrompt state', async () => {
  const mockPage = {
    url: () => 'https://login.live.com/login.srf',
    locator: (selector: string) => {
      if (selector.includes('[data-testid="title"]')) {
        return {
          first: () => ({
            isVisible: () => Promise.resolve(false),
            textContent: () => Promise.resolve('Sign in faster with passkey')
          })
        }
      }
      return {
        first: () => ({
          isVisible: () => Promise.resolve(false),
          textContent: () => Promise.resolve(null)
        })
      }
    },
    evaluate: () => Promise.resolve(100)
  }

  const detection = await LoginStateDetector.detectState(mockPage as any)

  assert.equal(detection.state, LoginState.PasskeyPrompt, 'Should detect PasskeyPrompt state')
  assert.equal(detection.confidence, 'high', 'Should have high confidence')
})

test('detectState identifies Blocked state', async () => {
  const mockPage = {
    url: () => 'https://login.live.com/err.srf',
    locator: (selector: string) => {
      if (selector.includes('[data-testid="title"]') || selector.includes('h1')) {
        return {
          first: () => ({
            isVisible: () => Promise.resolve(false),
            textContent: () => Promise.resolve("We can't sign you in")
          })
        }
      }
      return {
        first: () => ({
          isVisible: () => Promise.resolve(false),
          textContent: () => Promise.resolve(null)
        })
      }
    },
    evaluate: () => Promise.resolve(100)
  }

  const detection = await LoginStateDetector.detectState(mockPage as any)

  assert.equal(detection.state, LoginState.Blocked, 'Should detect Blocked state')
  assert.equal(detection.confidence, 'high', 'Should have high confidence')
})

test('detectState returns Unknown for ambiguous pages', async () => {
  const mockPage = {
    url: () => 'https://login.live.com/unknown.srf',
    locator: () => ({
      first: () => ({
        isVisible: () => Promise.resolve(false),
        textContent: () => Promise.resolve(null)
      })
    }),
    evaluate: () => Promise.resolve(50)
  }

  const detection = await LoginStateDetector.detectState(mockPage as any)

  assert.equal(detection.state, LoginState.Unknown, 'Should return Unknown for ambiguous pages')
  assert.equal(detection.confidence, 'low', 'Should have low confidence')
})

test('detectState handles errors gracefully', async () => {
  const mockPage = {
    url: () => { throw new Error('Network error') },
    locator: () => ({
      first: () => ({
        isVisible: () => Promise.reject(new Error('Element not found'))
      })
    }),
    evaluate: () => Promise.reject(new Error('Evaluation failed'))
  }

  try {
    await LoginStateDetector.detectState(mockPage as any)
    assert.fail('Should throw error')
  } catch (e) {
    assert.ok(e instanceof Error, 'Should throw Error instance')
  }
})
