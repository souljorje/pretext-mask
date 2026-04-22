import { describe, expect, it } from 'vitest'
import { chunkGlyphsByMeasuredBudget, getGlyphStep, glitchGlyphs, layoutDenseGlyphFieldFromLines } from './glyphLayout'
import type { MaskConfig } from './types'

describe('glyph chunking', () => {
  it('does not exceed measured budget', () => {
    const chunk = chunkGlyphsByMeasuredBudget(['A', 'B', 'C', 'D'], 25, glyph => (glyph === 'C' ? 20 : 10))

    expect(chunk).toEqual(['A', 'B'])
  })

  it('generates deterministic dense fields', () => {
    const config: MaskConfig = {
      seed: 'dense',
      renderMode: 'inside',
      width: 100,
      height: 100,
      fontFamily: 'Georgia',
      fontSize: 12,
      fontWeight: 700,
      glyphSpacing: 12,
      letterSpacing: 0,
      lineHeight: 16,
      padding: 0,
      glitchRate: 0,
      hoverRadius: 40,
      baseColor: '#111111',
      accentColor: '#ff0000',
    }

    expect(layoutDenseGlyphFieldFromLines('0 0 100 100', config, ['abc123', 'xyz789'], 'fallback')).toEqual(
      layoutDenseGlyphFieldFromLines('0 0 100 100', config, ['abc123', 'xyz789'], 'fallback'),
    )
  })

  it('glitches every glyph without canonical fallback', () => {
    const config: MaskConfig = {
      seed: 'glitch',
      renderMode: 'inside',
      width: 100,
      height: 100,
      fontFamily: 'Georgia',
      fontSize: 12,
      fontWeight: 700,
      glyphSpacing: 12,
      letterSpacing: 0,
      lineHeight: 16,
      padding: 0,
      glitchRate: 8,
      hoverRadius: 40,
      baseColor: '#111111',
      accentColor: '#ff0000',
    }
    const glyphs = [
      {
        id: 'glyph-1',
        pathId: 'field',
        index: 0,
        char: 'A',
        baseChar: 'A',
        x: 0,
        y: 0,
        angle: 0,
        color: '#111111',
        opacity: 1,
      },
    ]

    expect(glitchGlyphs(glyphs, config, 100)[0].char).not.toBe('A')
    expect(glitchGlyphs(glyphs, config, 250)[0].char).not.toBe('A')
  })

  it('treats spacing as an adjustment around natural glyph advance', () => {
    const baseConfig: MaskConfig = {
      seed: 'spacing',
      renderMode: 'outline',
      width: 100,
      height: 100,
      fontFamily: 'Georgia',
      fontSize: 20,
      fontWeight: 700,
      glyphSpacing: 0,
      letterSpacing: 0,
      lineHeight: 24,
      padding: 0,
      glitchRate: 0,
      hoverRadius: 40,
      baseColor: '#111111',
      accentColor: '#777777',
    }

    expect(getGlyphStep({ ...baseConfig, glyphSpacing: 8 })).toBeGreaterThan(getGlyphStep(baseConfig))
    expect(getGlyphStep({ ...baseConfig, glyphSpacing: -6 })).toBeLessThan(getGlyphStep(baseConfig))
  })

  it('places dense glyphs with nondecreasing measured spacing at zero', () => {
    const config: MaskConfig = {
      seed: 'spacing',
      renderMode: 'inside',
      width: 100,
      height: 100,
      fontFamily: 'Georgia',
      fontSize: 20,
      fontWeight: 700,
      glyphSpacing: 0,
      letterSpacing: 0,
      lineHeight: 24,
      padding: 0,
      glitchRate: 0,
      hoverRadius: 40,
      baseColor: '#111111',
      accentColor: '#777777',
    }
    const glyphs = layoutDenseGlyphFieldFromLines('0 0 240 60', config, ['mmmmmmmmmmmm'], 'mmmmmmmmmmmm')
    const row = glyphs.filter(glyph => glyph.id.startsWith('field-0-'))

    for (let i = 1; i < row.length; i++) {
      expect(row[i].x).toBeGreaterThan(row[i - 1].x)
    }
  })

  it('moves rows inward when padding increases', () => {
    const config: MaskConfig = {
      seed: 'padding',
      renderMode: 'inside',
      width: 100,
      height: 100,
      fontFamily: 'Georgia',
      fontSize: 20,
      fontWeight: 700,
      glyphSpacing: 0,
      letterSpacing: 0,
      lineHeight: 24,
      padding: 0,
      glitchRate: 0,
      hoverRadius: 40,
      baseColor: '#111111',
      accentColor: '#777777',
    }
    const noPadding = layoutDenseGlyphFieldFromLines('0 0 240 120', config, ['mmmmmmmmmmmm'], 'mmmmmmmmmmmm')
    const padded = layoutDenseGlyphFieldFromLines('0 0 240 120', { ...config, padding: 20 }, ['mmmmmmmmmmmm'], 'mmmmmmmmmmmm')

    expect(padded[0].y).toBeGreaterThan(noPadding[0].y)
  })
})
