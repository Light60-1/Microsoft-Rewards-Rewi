import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * SummaryReporter unit tests
 * Validates reporting and notification logic
 */

test('SummaryReporter module exports correctly', async () => {
  const { SummaryReporter } = await import('../../src/flows/SummaryReporter')
  assert.ok(SummaryReporter, 'SummaryReporter should be exported')
  assert.equal(typeof SummaryReporter, 'function', 'SummaryReporter should be a class constructor')
})

test('SummaryReporter creates instance with config', async () => {
  const { SummaryReporter } = await import('../../src/flows/SummaryReporter')

  const mockConfig = {
    webhook: { enabled: false },
    ntfy: { enabled: false },
    sessionPath: './sessions',
    jobState: { enabled: false }
  }

  const reporter = new SummaryReporter(mockConfig as never)
  assert.ok(reporter, 'SummaryReporter instance should be created')
})

test('SummaryReporter creates summary correctly', async () => {
  const { SummaryReporter } = await import('../../src/flows/SummaryReporter')

  const mockConfig = {
    webhook: { enabled: false },
    ntfy: { enabled: false },
    sessionPath: './sessions',
    jobState: { enabled: false }
  }

  const reporter = new SummaryReporter(mockConfig as never)

  const accounts = [
    {
      email: 'test@example.com',
      pointsEarned: 100,
      runDuration: 60000,
      initialPoints: 1000,
      finalPoints: 1100,
      desktopPoints: 60,
      mobilePoints: 40
    },
    {
      email: 'test2@example.com',
      pointsEarned: 150,
      runDuration: 70000,
      initialPoints: 2000,
      finalPoints: 2150,
      desktopPoints: 90,
      mobilePoints: 60,
      errors: ['test error']
    }
  ]

  const startTime = new Date('2025-01-01T10:00:00Z')
  const endTime = new Date('2025-01-01T10:05:00Z')

  const summary = reporter.createSummary(accounts, startTime, endTime)

  assert.equal(summary.totalPoints, 250, 'Total points should be 250')
  assert.equal(summary.successCount, 1, 'Success count should be 1')
  assert.equal(summary.failureCount, 1, 'Failure count should be 1')
  assert.equal(summary.accounts.length, 2, 'Should have 2 accounts')
})

test('SummaryData structure is correct', async () => {
  const { SummaryReporter } = await import('../../src/flows/SummaryReporter')

  const mockConfig = {
    webhook: { enabled: false },
    ntfy: { enabled: false },
    sessionPath: './sessions',
    jobState: { enabled: false }
  }

  const reporter = new SummaryReporter(mockConfig as never)

  const summary = reporter.createSummary(
    [{
      email: 'test@example.com',
      pointsEarned: 50,
      runDuration: 30000,
      initialPoints: 500,
      finalPoints: 550,
      desktopPoints: 30,
      mobilePoints: 20
    }],
    new Date(),
    new Date()
  )

  assert.ok(summary.startTime instanceof Date, 'startTime should be a Date')
  assert.ok(summary.endTime instanceof Date, 'endTime should be a Date')
  assert.equal(typeof summary.totalPoints, 'number', 'totalPoints should be a number')
  assert.equal(typeof summary.successCount, 'number', 'successCount should be a number')
  assert.ok(Array.isArray(summary.accounts), 'accounts should be an array')
})
