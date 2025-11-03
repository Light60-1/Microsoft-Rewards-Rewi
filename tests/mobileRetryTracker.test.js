const test = require('node:test')
const assert = require('node:assert/strict')

const { MobileRetryTracker } = require('../dist/util/MobileRetryTracker.js')

test('MobileRetryTracker stops retries after configured limit', () => {
  const tracker = new MobileRetryTracker(2)

  assert.equal(tracker.registerFailure(), true)
  assert.equal(tracker.hasExceeded(), false)
  assert.equal(tracker.getAttemptCount(), 1)

  assert.equal(tracker.registerFailure(), true)
  assert.equal(tracker.hasExceeded(), false)
  assert.equal(tracker.getAttemptCount(), 2)

  assert.equal(tracker.registerFailure(), false)
  assert.equal(tracker.hasExceeded(), true)
  assert.equal(tracker.getAttemptCount(), 3)
})

test('MobileRetryTracker normalizes invalid configuration', () => {
  const tracker = new MobileRetryTracker(-3)

  assert.equal(tracker.registerFailure(), false)
  assert.equal(tracker.hasExceeded(), true)
  assert.equal(tracker.getAttemptCount(), 1)
})
