import { describe, expect, it } from 'vitest'
import { buildStaticSvg } from './svgSampler'
import type { AvatarConfig, ParsedSvg } from './types'

const parsed: ParsedSvg = {
  viewBox: '0 0 100 100',
  width: 100,
  height: 100,
  paths: [
    {
      id: 'box',
      d: 'M 10 10 H 90 V 90 H 10 Z',
      sourceTag: 'rect',
      transform: '',
    },
  ],
}

const config: AvatarConfig = {
  seed: 'test',
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

describe('svg export', () => {
  it('exports upright glyphs without rotate transforms', () => {
    const svg = buildStaticSvg(
      parsed,
      [
        {
          id: 'g',
          pathId: 'field',
          index: 0,
          char: 'x',
          baseChar: 'x',
          x: 12,
          y: 20,
          angle: 45,
          color: '#111111',
          opacity: 0.2,
        },
      ],
      config,
    )

    expect(svg).not.toContain('mask=')
    expect(svg).not.toContain('rotate(')
  })
})
