import assert from 'node:assert/strict'
import test from 'node:test'

import { extractBalancedObject } from '../src/util/core/Utils'

const wrap = (before: string, obj: string, after = ';') => `${before}${obj}${after}`

test('extractBalancedObject extracts simple object after string anchor', () => {
    const obj = '{"a":1,"b":2}'
    const text = wrap('var dashboard = ', obj)
    const out = extractBalancedObject(text, 'var dashboard = ')
    assert.equal(out, obj)
})

test('extractBalancedObject extracts with regex anchor and whitespace', () => {
    const obj = '{"x": {"y": 3}}'
    const text = wrap('dashboard   =    ', obj)
    const out = extractBalancedObject(text, /dashboard\s*=\s*/)
    assert.equal(out, obj)
})

test('extractBalancedObject handles nested braces and strings safely', () => {
    const obj = '{"t":"{ not a brace }","n": {"inner": {"v": "} in string"}}}'
    const text = wrap('var dashboard = ', obj)
    const out = extractBalancedObject(text, 'var dashboard = ')
    assert.equal(out, obj)
})

test('extractBalancedObject handles escaped quotes inside strings', () => {
    const obj = '{"s":"\\"quoted\\" braces { }","k":1}'
    const text = wrap('dashboard = ', obj)
    const out = extractBalancedObject(text, 'dashboard = ')
    assert.equal(out, obj)
})

test('extractBalancedObject returns null when anchor missing', () => {
    const text = 'no object here'
    const out = extractBalancedObject(text, 'var dashboard = ')
    assert.equal(out, null)
})

test('extractBalancedObject returns null on imbalanced braces or limit', () => {
    const start = 'var dashboard = '
    const text = `${start}{"a": {"b": 1}` // missing final brace
    const out = extractBalancedObject(text, start)
    assert.equal(out, null)
})
