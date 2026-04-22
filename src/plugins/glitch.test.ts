import { describe, expect, it } from 'vitest'
import { createGlitchPlugin, getGlitchedGlyphChar } from './glitch'
import type { TextRunGlyph } from '../lib'

const glyph: TextRunGlyph = {
  id: 'glyph-1',
  index: 0,
  runId: 'run-1',
  runIndex: 0,
  char: 'A',
  x: 10,
  y: 20,
}

describe('glitch plugin', () => {
  it('requests glyph drawing only when active', () => {
    expect(createGlitchPlugin({ seed: 'glitch', bucket: null }).drawRun?.({} as never)).toBe('default')
    expect(createGlitchPlugin({ seed: 'glitch', bucket: 1 }).drawRun?.({} as never)).toBe('glyphs')
  })

  it('substitutes chars without changing glyph position data', () => {
    const changed = getGlitchedGlyphChar(glyph, 'glitch', 1)

    expect(changed).not.toBe(glyph.char)
    expect(glyph.x).toBe(10)
    expect(glyph.y).toBe(20)
  })
})
