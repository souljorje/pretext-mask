import { describe, expect, it } from 'vitest'
import { chunkGlyphsByMeasuredBudget, getGlyphStep, glitchGlyphs, layoutDenseGlyphFieldFromLines } from './glyphLayout'
import type { AvatarConfig } from './types'

describe('glyph chunking', () => {
  it('does not exceed measured budget', () => {
    const chunk = chunkGlyphsByMeasuredBudget(['A', 'B', 'C', 'D'], 25, glyph => (glyph === 'C' ? 20 : 10))

    expect(chunk).toEqual(['A', 'B'])
  })

  it('generates deterministic dense fields', () => {
    const config: AvatarConfig = {
      seed: 'dense',
      renderMode: 'inside',
      size: 100,
      fontFamily: 'Georgia',
      fontSize: 12,
      fontWeight: 700,
      glyphSpacing: 12,
      letterSpacing: 0,
      lineHeight: 16,
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
    const config: AvatarConfig = {
      seed: 'glitch',
      renderMode: 'inside',
      size: 100,
      fontFamily: 'Georgia',
      fontSize: 12,
      fontWeight: 700,
      glyphSpacing: 12,
      letterSpacing: 0,
      lineHeight: 16,
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
    const baseConfig: AvatarConfig = {
      seed: 'spacing',
      renderMode: 'outline',
      size: 100,
      fontFamily: 'Georgia',
      fontSize: 20,
      fontWeight: 700,
      glyphSpacing: 0,
      letterSpacing: 0,
      lineHeight: 24,
      glitchRate: 0,
      hoverRadius: 40,
      baseColor: '#111111',
      accentColor: '#777777',
    }

    expect(getGlyphStep({ ...baseConfig, glyphSpacing: 8 })).toBeGreaterThan(getGlyphStep(baseConfig))
    expect(getGlyphStep({ ...baseConfig, glyphSpacing: -6 })).toBeLessThan(getGlyphStep(baseConfig))
  })
})
