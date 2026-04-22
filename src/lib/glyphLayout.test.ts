import { describe, expect, it } from 'vitest'
import { getGlyphStep, layoutDenseGlyphFieldFromLines } from './glyphLayout'
import type { MaskLayoutConfig } from './types'

describe('glyph layout', () => {
  it('generates deterministic dense fields', () => {
    const config: MaskLayoutConfig = {
      seed: 'dense',
      renderMode: 'inside',
      width: 100,
      height: 100,
      fontFamily: 'Georgia',
      fontSize: 12,
      fontWeight: 700,
      glyphSpacing: 12,
      lineHeight: 16,
      padding: 0,
    }

    expect(layoutDenseGlyphFieldFromLines('0 0 100 100', config, ['abc123', 'xyz789'], 'fallback')).toEqual(
      layoutDenseGlyphFieldFromLines('0 0 100 100', config, ['abc123', 'xyz789'], 'fallback'),
    )
  })

  it('treats spacing as an adjustment around natural glyph advance', () => {
    const baseConfig: MaskLayoutConfig = {
      seed: 'spacing',
      renderMode: 'outline',
      width: 100,
      height: 100,
      fontFamily: 'Georgia',
      fontSize: 20,
      fontWeight: 700,
      glyphSpacing: 0,
      lineHeight: 24,
      padding: 0,
    }

    expect(getGlyphStep({ ...baseConfig, glyphSpacing: 8 })).toBeGreaterThan(getGlyphStep(baseConfig))
    expect(getGlyphStep({ ...baseConfig, glyphSpacing: -6 })).toBeLessThan(getGlyphStep(baseConfig))
  })

  it('places dense glyphs with nondecreasing measured spacing at zero', () => {
    const config: MaskLayoutConfig = {
      seed: 'spacing',
      renderMode: 'inside',
      width: 100,
      height: 100,
      fontFamily: 'Georgia',
      fontSize: 20,
      fontWeight: 700,
      glyphSpacing: 0,
      lineHeight: 24,
      padding: 0,
    }
    const glyphs = layoutDenseGlyphFieldFromLines('0 0 240 60', config, ['mmmmmmmmmmmm'], 'mmmmmmmmmmmm')
    const row = glyphs.filter(glyph => glyph.id.startsWith('field-0-'))

    for (let i = 1; i < row.length; i++) {
      expect(row[i].x).toBeGreaterThan(row[i - 1].x)
    }
  })

  it('keeps glyph layout stable when padding changes', () => {
    const config: MaskLayoutConfig = {
      seed: 'padding',
      renderMode: 'inside',
      width: 100,
      height: 100,
      fontFamily: 'Georgia',
      fontSize: 20,
      fontWeight: 700,
      glyphSpacing: 0,
      lineHeight: 24,
      padding: 0,
    }
    const noPadding = layoutDenseGlyphFieldFromLines('0 0 240 120', config, ['mmmmmmmmmmmm'], 'mmmmmmmmmmmm')
    const padded = layoutDenseGlyphFieldFromLines('0 0 240 120', { ...config, padding: 20 }, ['mmmmmmmmmmmm'], 'mmmmmmmmmmmm')

    expect(padded).toEqual(noPadding)
  })
})
