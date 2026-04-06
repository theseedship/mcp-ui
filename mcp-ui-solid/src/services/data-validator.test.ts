/**
 * Tests for validateAgainstSource — anti-hallucination data validator
 */

import { describe, it, expect } from 'vitest'
import { validateAgainstSource } from './data-validator'

const SAMPLE_ROWS = [
  { type: 'Appartement', ventes: 22306, prix_m2: 3337 },
  { type: 'Maison', ventes: 2492, prix_m2: 4230 },
]

describe('validateAgainstSource', () => {
  it('validates text with exact source numbers', () => {
    const text = 'On observe 22 306 ventes appartements et 3 337 EUR/m2 moyen.'
    const result = validateAgainstSource(text, SAMPLE_ROWS)

    expect(result.valid).toBe(true)
    expect(result.hallucinated).toHaveLength(0)
    expect(result.confidence).toBe(1)
  })

  it('detects hallucinated numbers', () => {
    const text = 'On observe 18 245 ventes en 2023, prix moyen 2 850 EUR.'
    const result = validateAgainstSource(text, SAMPLE_ROWS)

    expect(result.valid).toBe(false)
    expect(result.hallucinated.length).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThan(1)
  })

  it('returns hallucinated items with closest source number', () => {
    const text = 'On observe 18 245 ventes.'
    const result = validateAgainstSource(text, SAMPLE_ROWS)

    expect(result.hallucinated).toHaveLength(1)
    expect(result.hallucinated[0].value).toBe(18245)
    expect(result.hallucinated[0].closest).toBeDefined()
    expect(result.hallucinated[0].distance).toBeDefined()
  })

  it('accepts rounding within tolerance', () => {
    // 3337 rounded to 3340 is 0.09% — within 1% tolerance
    const text = 'Le prix moyen est de 3 340 EUR.'
    const result = validateAgainstSource(text, SAMPLE_ROWS, { tolerance: 0.01 })

    expect(result.valid).toBe(true)
  })

  it('rejects rounding beyond tolerance', () => {
    // 3337 vs 3500 is ~4.9% — beyond 1% tolerance
    const text = 'Le prix moyen est de 3 500 EUR.'
    const result = validateAgainstSource(text, SAMPLE_ROWS, { tolerance: 0.01 })

    expect(result.valid).toBe(false)
  })

  it('ignores years by default', () => {
    const text = 'En 2023, on observe 22 306 ventes.'
    const result = validateAgainstSource(text, SAMPLE_ROWS)

    // 2023 should be ignored, 22306 should be verified
    expect(result.valid).toBe(true)
    expect(result.llmNumbers).toHaveLength(1) // only 22306
  })

  it('ignores postal/INSEE codes by default', () => {
    const text = 'Code commune 34172, on observe 22 306 ventes.'
    const result = validateAgainstSource(text, SAMPLE_ROWS)

    // 34172 should be ignored (5-digit pattern)
    expect(result.valid).toBe(true)
  })

  it('ignores specified columns', () => {
    const rows = [
      { code_geo: '34172', ventes: 22306 },
    ]
    const text = 'Le code est 34172 avec 22 306 ventes.'
    const result = validateAgainstSource(text, rows, {
      ignoreColumns: ['code_geo'],
    })

    expect(result.valid).toBe(true)
  })

  it('handles string-encoded numbers in source', () => {
    const rows = [
      { prix: '3 337', total: '22306' },
    ]
    const text = 'Prix 3 337, total 22 306.'
    const result = validateAgainstSource(text, rows)

    expect(result.valid).toBe(true)
  })

  it('returns confidence = 1 for text with no numbers', () => {
    const text = 'Les données sont stables et cohérentes.'
    const result = validateAgainstSource(text, SAMPLE_ROWS)

    expect(result.valid).toBe(true)
    expect(result.confidence).toBe(1)
    expect(result.llmNumbers).toHaveLength(0)
  })

  it('handles empty source rows', () => {
    const text = 'On observe 22 306 ventes.'
    const result = validateAgainstSource(text, [])

    // With empty source, any number in text is hallucinated
    expect(result.valid).toBe(false)
  })

  it('mixes verified and hallucinated', () => {
    const text = 'On observe 22 306 ventes reelles et 15 000 ventes estimees.'
    const result = validateAgainstSource(text, SAMPLE_ROWS)

    expect(result.valid).toBe(false)
    expect(result.hallucinated).toHaveLength(1)
    expect(result.hallucinated[0].value).toBe(15000)
    // 1 hallucinated out of 2 = 50% confidence
    expect(result.confidence).toBe(0.5)
  })

  it('provides context around numbers', () => {
    const text = 'Le prix moyen est de 3 337 EUR/m2 a Montpellier.'
    const result = validateAgainstSource(text, SAMPLE_ROWS)

    expect(result.llmNumbers[0].context).toContain('3 337')
  })

  it('handles custom ignorePatterns', () => {
    const text = 'Parcelle 1234 avec 22 306 ventes.'
    const result = validateAgainstSource(text, SAMPLE_ROWS, {
      ignorePatterns: [/^\d{4}$/], // ignore 4-digit numbers
    })

    expect(result.valid).toBe(true)
    expect(result.llmNumbers).toHaveLength(1) // only 22306
  })

  it('returns sourceNumbers as a Set', () => {
    const result = validateAgainstSource('test', SAMPLE_ROWS)

    expect(result.sourceNumbers).toBeInstanceOf(Set)
    expect(result.sourceNumbers.has(22306)).toBe(true)
    expect(result.sourceNumbers.has(3337)).toBe(true)
    expect(result.sourceNumbers.has(2492)).toBe(true)
    expect(result.sourceNumbers.has(4230)).toBe(true)
  })
})
