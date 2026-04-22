import { describe, expect, it } from 'vitest'
import { createSeededRandom, makeGlyphStream, splitGlyphs } from './random'

describe('seeded random', () => {
  it('returns the same sequence for the same seed', () => {
    const a = createSeededRandom('mask')
    const b = createSeededRandom('mask')

    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
  })

  it('builds deterministic glyph streams', () => {
    expect(makeGlyphStream('same', 'ABC', 16)).toBe(makeGlyphStream('same', 'ABC', 16))
    expect(makeGlyphStream('same', 'ABC', 16)).not.toBe(makeGlyphStream('other', 'ABC', 16))
  })

  it('splits grapheme clusters', () => {
    expect(splitGlyphs('A🙂B')).toEqual(['A', '🙂', 'B'])
  })
})
