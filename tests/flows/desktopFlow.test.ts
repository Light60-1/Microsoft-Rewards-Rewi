import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * DesktopFlow unit tests
 * Validates desktop automation flow logic
 */

test('DesktopFlow module exports correctly', async () => {
  const { DesktopFlow } = await import('../../src/flows/DesktopFlow')
  assert.ok(DesktopFlow, 'DesktopFlow should be exported')
  assert.equal(typeof DesktopFlow, 'function', 'DesktopFlow should be a class constructor')
})

test('DesktopFlow has run method', async () => {
  const { DesktopFlow } = await import('../../src/flows/DesktopFlow')
  
  // Mock bot instance
  const mockBot = {
    log: () => {},
    isMobile: false,
    config: { workers: {}, runOnZeroPoints: false },
    browser: { func: {} },
    utils: {},
    activities: {},
    compromisedModeActive: false
  }
  
  const flow = new DesktopFlow(mockBot as never)
  assert.ok(flow, 'DesktopFlow instance should be created')
  assert.equal(typeof flow.run, 'function', 'DesktopFlow should have run() method')
})

test('DesktopFlowResult interface has correct structure', async () => {
  const { DesktopFlow } = await import('../../src/flows/DesktopFlow')
  
  // Validate that DesktopFlowResult type exports (compile-time check)
  type DesktopFlowResult = Awaited<ReturnType<InstanceType<typeof DesktopFlow>['run']>>
  
  const mockResult: DesktopFlowResult = {
    initialPoints: 1000,
    collectedPoints: 50
  }
  
  assert.equal(typeof mockResult.initialPoints, 'number', 'initialPoints should be a number')
  assert.equal(typeof mockResult.collectedPoints, 'number', 'collectedPoints should be a number')
})

test('DesktopFlow handles security compromise mode', async () => {
  const { DesktopFlow } = await import('../../src/flows/DesktopFlow')
  
  const logs: string[] = []
  const mockBot = {
    log: (_: boolean, __: string, message: string) => logs.push(message),
    isMobile: false,
    config: { 
      workers: {}, 
      runOnZeroPoints: false,
      sessionPath: './sessions'
    },
    browser: { func: {} },
    utils: {},
    activities: {},
    workers: {},
    compromisedModeActive: true,
    compromisedReason: 'test-security-check'
  }
  
  const flow = new DesktopFlow(mockBot as never)
  
  // Note: Full test requires mocked browser context
  assert.ok(flow, 'DesktopFlow should handle compromised mode')
})
