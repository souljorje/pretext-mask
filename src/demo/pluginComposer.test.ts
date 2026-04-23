import { describe, expect, it } from 'vitest'
import { createDemoPlugins, getDemoGlitchBucket, type AnimationConfig, type StyleConfig } from './pluginComposer'
import type { MaskLayoutConfig } from '../lib'

const layoutConfig: MaskLayoutConfig = {
  seed: 'demo',
  renderMode: 'inside',
  width: 100,
  height: 100,
  fontFamily: 'Georgia',
  fontSize: 12,
  fontWeight: 700,
  glyphSpacing: 0,
  lineHeight: 16,
  padding: 0,
}

const styleConfig: StyleConfig = {
  baseColor: '#111111',
  accentColor: '#16a34a',
}

const animationConfig: AnimationConfig = {
  hoverEnabled: true,
  hoverRadius: 40,
  glitchEnabled: true,
  glitchRate: 4,
}

describe('demo plugin composer', () => {
  it('creates one plugin per enabled animation control', () => {
    expect(
      createDemoPlugins(layoutConfig, styleConfig, animationConfig, {
        pointer: { x: 0, y: 0 },
        seed: 'demo',
        glitchBucket: 1,
      }),
    ).toHaveLength(3)
  })

  it('omits disabled plugins', () => {
    expect(
      createDemoPlugins(
        layoutConfig,
        styleConfig,
        {
          ...animationConfig,
          hoverEnabled: false,
          glitchEnabled: false,
        },
        {
          pointer: { x: 0, y: 0 },
          seed: 'demo',
          glitchBucket: 1,
        },
      ),
    ).toHaveLength(0)
  })

  it('disables glitch buckets when the glitch plugin is off', () => {
    expect(getDemoGlitchBucket({ ...animationConfig, glitchEnabled: false }, 100)).toBeNull()
    expect(getDemoGlitchBucket(animationConfig, 100)).not.toBeNull()
  })
})
