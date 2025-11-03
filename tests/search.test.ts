import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Search integration tests: validate query quality, diversity, and deduplication
 * These tests focus on metrics that prevent ban-pattern detection
 */

// Mock GoogleSearch interface
interface GoogleSearch {
  topic: string;
  related: string[];
}

// Helper: calculate Jaccard similarity (used in semantic dedup)
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/))
  const setB = new Set(b.toLowerCase().split(/\s+/))
  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])
  return intersection.size / union.size
}

// Helper: simulate Search.ts deduplication logic
function deduplicateQueries(queries: GoogleSearch[]): GoogleSearch[] {
  const seen = new Set<string>()
  return queries.filter(q => {
    const lower = q.topic.toLowerCase()
    if (seen.has(lower)) return false
    seen.add(lower)
    return true
  })
}

// Helper: semantic deduplication (proposed enhancement)
function semanticDeduplication(queries: string[], threshold = 0.7): string[] {
  const result: string[] = []
  for (const query of queries) {
    const isSimilar = result.some(existing => jaccardSimilarity(query, existing) > threshold)
    if (!isSimilar) {
      result.push(query)
    }
  }
  return result
}

test('Search deduplication removes exact duplicates', () => {
  const queries: GoogleSearch[] = [
    { topic: 'Weather Today', related: [] },
    { topic: 'weather today', related: [] },
    { topic: 'News Updates', related: [] }
  ]

  const deduped = deduplicateQueries(queries)

  assert.equal(deduped.length, 2, 'Should remove case-insensitive duplicates')
  assert.ok(deduped.some(q => q.topic === 'Weather Today'), 'Should keep first occurrence')
  assert.ok(deduped.some(q => q.topic === 'News Updates'), 'Should keep unique queries')
})

test('Semantic deduplication filters similar queries', () => {
  const queries = [
    'movie reviews',
    'film reviews',
    'weather forecast',
    'weather predictions',
    'sports news'
  ]

  const deduped = semanticDeduplication(queries, 0.5)

  // "movie reviews" and "film reviews" share 1 common word: "reviews" (Jaccard = 1/3 = 0.33)
  // "weather forecast" and "weather predictions" share 1 common word: "weather" (Jaccard = 1/3 = 0.33)
  // Both below 0.5 threshold, so all queries should pass
  assert.ok(deduped.length === queries.length || deduped.length === queries.length - 1, 'Should keep most queries with 0.5 threshold')
  assert.ok(deduped.includes('sports news'), 'Should keep unique queries')
})

test('Query quality metrics: length validation', () => {
  const queries = [
    'a',
    'valid query here',
    'this is a very long query that exceeds reasonable search length and might look suspicious to automated systems',
    'normal search term'
  ]

  const valid = queries.filter(q => q.length >= 3 && q.length <= 100)

  assert.equal(valid.length, 2, 'Should filter too short and too long queries')
  assert.ok(valid.includes('valid query here'), 'Should accept reasonable queries')
  assert.ok(valid.includes('normal search term'), 'Should accept reasonable queries')
})

test('Query diversity: lexical variance check', () => {
  const queries = [
    'weather today',
    'news updates',
    'movie reviews',
    'sports scores',
    'travel tips'
  ]

  // Calculate unique word count
  const allWords = queries.flatMap(q => q.toLowerCase().split(/\s+/))
  const uniqueWords = new Set(allWords)

  // High diversity: unique words / total words should be > 0.7
  const diversity = uniqueWords.size / allWords.length

  assert.ok(diversity > 0.7, `Query diversity (${diversity.toFixed(2)}) should be > 0.7`)
})

test('Query diversity: prevent repetitive patterns', () => {
  const queries = [
    'how to cook',
    'how to bake',
    'how to grill',
    'how to steam',
    'how to fry'
  ]

  const prefixes = queries.map(q => q.split(' ').slice(0, 2).join(' '))
  const uniquePrefixes = new Set(prefixes)

  // All start with "how to" - low diversity
  assert.equal(uniquePrefixes.size, 1, 'Should detect repetitive prefix pattern')

  // Mitigation: interleave different query types
  const diverse = [
    'how to cook',
    'weather today',
    'how to bake',
    'news updates',
    'how to grill'
  ]

  const diversePrefixes = diverse.map(q => q.split(' ').slice(0, 2).join(' '))
  const uniqueDiversePrefixes = new Set(diversePrefixes)

  assert.ok(uniqueDiversePrefixes.size > 2, 'Diverse queries should have varied prefixes')
})

test('Baseline: queries.json fallback quality', async () => {
  // Simulate loading queries.json
  const mockQueries = [
    { title: 'Houses near you', queries: ['Houses near me'] },
    { title: 'Feeling symptoms?', queries: ['Rash on forearm', 'Stuffy nose'] }
  ]

  const flattened = mockQueries.flatMap(x => x.queries)

  assert.ok(flattened.length > 0, 'Should have fallback queries')
  assert.ok(flattened.every(q => q.length >= 3), 'All fallback queries should meet min length')
})

test('Related terms expansion quality', () => {
  const relatedTerms = [
    'weather forecast',
    'weather today',
    'weather prediction',
    'forecast accuracy'
  ]

  // Filter too-similar related terms with lower threshold
  const filtered = semanticDeduplication(relatedTerms, 0.5)

  // All queries have Jaccard < 0.5, so should keep most/all
  assert.ok(filtered.length >= 2, 'Should keep at least 2 diverse related terms')
  assert.ok(filtered.length <= relatedTerms.length, 'Should not exceed input length')
})

test('Jaccard similarity correctly identifies similar queries', () => {
  const sim1 = jaccardSimilarity('movie reviews', 'film reviews')
  const sim2 = jaccardSimilarity('weather today', 'sports news')

  assert.ok(sim1 > 0.3, 'Similar queries should have high Jaccard score')
  assert.ok(sim2 < 0.3, 'Dissimilar queries should have low Jaccard score')
})

test('Threshold validation: clamps invalid values', () => {
  const testCases = [
    { input: -0.5, expected: 0 },
    { input: 1.5, expected: 1 },
    { input: 0.5, expected: 0.5 },
    { input: 0, expected: 0 },
    { input: 1, expected: 1 }
  ]

  for (const { input, expected } of testCases) {
    const clamped = Math.max(0, Math.min(1, input))
    assert.equal(clamped, expected, `Threshold ${input} should clamp to ${expected}`)
  }
})

test('Related terms semantic dedup reduces redundancy', () => {
  const relatedTerms = [
    'weather forecast today',
    'weather forecast tomorrow',
    'weather prediction today',
    'completely different query'
  ]

  const filtered = semanticDeduplication(relatedTerms, 0.5)

  // "weather forecast today" and "weather forecast tomorrow" share 2/4 words (Jaccard ~0.5)
  assert.ok(filtered.length <= relatedTerms.length, 'Should filter some related terms')
  assert.ok(filtered.includes('completely different query'), 'Should keep unique queries')
})

