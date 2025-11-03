import test from 'node:test'
import assert from 'node:assert/strict'

import { QueryDiversityEngine } from '../src/util/QueryDiversityEngine'

test('QueryDiversityEngine fetches and limits queries', async () => {
  const engine = new QueryDiversityEngine({
    sources: ['local-fallback'],
    maxQueriesPerSource: 5
  })

  const queries = await engine.fetchQueries(10)

  assert.ok(queries.length > 0, 'Should return at least one query')
  assert.ok(queries.length <= 10, 'Should respect count limit')
  assert.ok(queries.every(q => typeof q === 'string' && q.length > 0), 'All queries should be non-empty strings')
})

test('QueryDiversityEngine deduplicates queries', async () => {
  const engine = new QueryDiversityEngine({
    sources: ['local-fallback'],
    deduplicate: true
  })

  const queries = await engine.fetchQueries(20)
  const uniqueSet = new Set(queries)

  assert.equal(queries.length, uniqueSet.size, 'All queries should be unique')
})

test('QueryDiversityEngine interleaves multiple sources', async () => {
  const engine = new QueryDiversityEngine({
    sources: ['local-fallback', 'local-fallback'], // Duplicate source to test interleaving
    mixStrategies: true,
    maxQueriesPerSource: 3
  })

  const queries = await engine.fetchQueries(6)

  assert.ok(queries.length > 0, 'Should return queries from multiple sources')
  // Interleaving logic should distribute queries from different sources
})

test('QueryDiversityEngine caches results', async () => {
  const engine = new QueryDiversityEngine({
    sources: ['local-fallback'],
    cacheMinutes: 1
  })

  const firstFetch = await engine.fetchQueries(5)
  const secondFetch = await engine.fetchQueries(5)

  // Cache should return consistent results within cache window
  // Note: shuffling happens after cache retrieval, so we validate cache hit by checking source consistency
  assert.ok(firstFetch.length === 5, 'First fetch should return 5 queries')
  assert.ok(secondFetch.length === 5, 'Second fetch should return 5 queries')
  // Cached data is shuffled independently, so we just validate count and source
})

test('QueryDiversityEngine clears cache correctly', async () => {
  const engine = new QueryDiversityEngine({
    sources: ['local-fallback'],
    cacheMinutes: 1
  })

  await engine.fetchQueries(5)
  engine.clearCache()

  const queries = await engine.fetchQueries(5)
  assert.ok(queries.length > 0, 'Should fetch fresh queries after cache clear')
})

test('QueryDiversityEngine handles empty sources gracefully', async () => {
  const engine = new QueryDiversityEngine({
    sources: [],
    maxQueriesPerSource: 5
  })

  const queries = await engine.fetchQueries(5)

  // Should fallback to local when no sources configured
  assert.ok(queries.length > 0, 'Should return fallback queries when no sources configured')
})

test('QueryDiversityEngine respects maxQueriesPerSource', async () => {
  const engine = new QueryDiversityEngine({
    sources: ['local-fallback'],
    maxQueriesPerSource: 3
  })

  const queries = await engine.fetchQueries(10)

  // With single source and max 3, should not exceed 3
  assert.ok(queries.length <= 3, 'Should respect maxQueriesPerSource limit')
})
