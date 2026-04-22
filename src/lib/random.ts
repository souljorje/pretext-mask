import type { SeededRandom } from './types'

const glyphSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const glyphCache = new Map<string, string[]>()

export function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createSeededRandom(seed: string): SeededRandom {
  let state = hashSeed(seed) || 0x9e3779b9

  return {
    next() {
      state |= 0
      state = (state + 0x6d2b79f5) | 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    int(maxExclusive: number) {
      return Math.floor(this.next() * maxExclusive)
    },
    pick<T>(items: readonly T[]) {
      return items[this.int(items.length)]
    },
  }
}

export function splitGlyphs(value: string): string[] {
  const cached = glyphCache.get(value)
  if (cached) return cached

  const glyphs = [...glyphSegmenter.segment(value)].map(segment => segment.segment)
  glyphCache.set(value, glyphs)
  return glyphs
}

export function makeGlyphStream(seed: string, alphabet: string, length: number): string {
  const glyphs = splitGlyphs(alphabet).filter(glyph => glyph.trim().length > 0)
  const safeGlyphs = glyphs.length > 0 ? glyphs : ['*']
  const random = createSeededRandom(seed)
  const output: string[] = []

  for (let i = 0; i < length; i++) {
    output.push(random.pick(safeGlyphs))
  }

  return output.join('')
}
