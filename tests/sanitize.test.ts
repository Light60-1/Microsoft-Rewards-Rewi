import assert from 'node:assert/strict'
import test from 'node:test'

import { replaceUntilStable } from '../src/util/core/Utils'

test('remove HTML comments with repeated replacement', () => {
    const input = '<!<!--- comment --->>'
    const out = replaceUntilStable(input, /<!--|--!?>/g, '')
    assert.equal(out.includes('<!--'), false)
    assert.equal(out.includes('-->'), false)
    // Remaining string should not contain full HTML comment delimiters
    assert.equal(/<!--|-->/g.test(out), false)
})

test('path traversal: repeated removal of ../ sequences', () => {
    const input = '/./.././'
    const out = replaceUntilStable(input, /\.\.\//, '')
    assert.equal(out.includes('..'), false)
})

test('enforces global flag if missing', () => {
    const input = 'a<script>b</script>c<script>d</script>'
    // remove tag brackets to neutralize tags (illustrative only)
    const out = replaceUntilStable(input, /<|>/, '')
    assert.equal(out.includes('<'), false)
    assert.equal(out.includes('>'), false)
})
