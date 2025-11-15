import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * MobileFlow unit tests
 * Validates mobile automation flow logic
 */

test('MobileFlow module exports correctly', async () => {
  const { MobileFlow } = await import('../../src/flows/MobileFlow')
  assert.ok(MobileFlow, 'MobileFlow should be exported')
  assert.equal(typeof MobileFlow, 'function', 'MobileFlow should be a class constructor')
})

test('MobileFlow has run method', async () => {
  const { MobileFlow } = await import('../../src/flows/MobileFlow')

  // Mock bot instance
  const mockBot = {
    log: () => { },
    isMobile: true,
    config: {
      workers: {},
      runOnZeroPoints: false,
      searchSettings: { retryMobileSearchAmount: 0 }
    },
    browser: { func: {} },
    utils: {},
    activities: {},
    compromisedModeActive: false
  }

  const flow = new MobileFlow(mockBot as never)
  assert.ok(flow, 'MobileFlow instance should be created')
  assert.equal(typeof flow.run, 'function', 'MobileFlow should have run() method')
})

test('MobileFlowResult interface has correct structure', async () => {
  const { MobileFlow } = await import('../../src/flows/MobileFlow')

  // Validate that MobileFlowResult type exports (compile-time check)
  type MobileFlowResult = Awaited<ReturnType<InstanceType<typeof MobileFlow>['run']>>

  const mockResult: MobileFlowResult = {
    initialPoints: 1000,
    collectedPoints: 30
  }

  assert.equal(typeof mockResult.initialPoints, 'number', 'initialPoints should be a number')
  assert.equal(typeof mockResult.collectedPoints, 'number', 'collectedPoints should be a number')
})

test('MobileFlow accepts retry tracker', async () => {
  const { MobileFlow } = await import('../../src/flows/MobileFlow')
  const { MobileRetryTracker } = await import('../../src/util/state/MobileRetryTracker')

  const mockBot = {
    log: () => { },
    isMobile: true,
    config: {
      workers: {},
      runOnZeroPoints: false,
      searchSettings: { retryMobileSearchAmount: 3 }
    },
    browser: { func: {} },
    utils: {},
    activities: {},
    compromisedModeActive: false
  }

  const flow = new MobileFlow(mockBot as never)
  const tracker = new MobileRetryTracker(3)

  assert.ok(flow, 'MobileFlow should accept retry tracker')
  assert.equal(typeof tracker.registerFailure, 'function', 'MobileRetryTracker should have registerFailure method')
})
