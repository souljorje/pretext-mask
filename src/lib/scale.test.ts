import { describe, expect, it } from 'vitest'
import { createRenderConfig, fitViewBoxToFrame } from './scale'
import type { MaskLayoutConfig } from './types'

describe('viewBox scaling', () => {
  it('fits a square viewBox into a wide frame without stretching', () => {
    const fit = fitViewBoxToFrame('0 0 50 50', 800, 400)

    expect(fit.scale).toBe(8)
    expect(fit.width).toBe(400)
    expect(fit.height).toBe(400)
    expect(fit.x).toBe(200)
    expect(fit.y).toBe(0)
  })

  it('uses padding as output inset around the fitted viewBox', () => {
    const fit = fitViewBoxToFrame('0 0 50 50', 400, 400, 40)

    expect(fit.scale).toBe(6.4)
    expect(fit.x).toBe(40)
    expect(fit.y).toBe(40)
    expect(fit.width).toBe(320)
    expect(fit.height).toBe(320)
  })

  it('clamps excessive positive padding to keep the fitted viewBox visible', () => {
    const fit = fitViewBoxToFrame('0 0 50 50', 128, 128, 240)

    expect(fit.width).toBe(1)
    expect(fit.height).toBe(1)
    expect(fit.x).toBe(63.5)
    expect(fit.y).toBe(63.5)
  })

  it('keeps pixel-facing controls stable after fitted scaling', () => {
    const config: MaskLayoutConfig = {
      seed: 'scale',
      renderMode: 'outline',
      width: 800,
      height: 400,
      fontFamily: 'Georgia',
      fontSize: 12,
      fontWeight: 700,
      glyphSpacing: 2,
      lineHeight: 16,
      padding: 0,
    }
    const renderConfig = createRenderConfig('0 0 50 50', config)
    const fit = fitViewBoxToFrame('0 0 50 50', config.width, config.height, config.padding)

    expect(renderConfig.fontSize * fit.scale).toBeCloseTo(config.fontSize)
    expect(renderConfig.lineHeight * fit.scale).toBeCloseTo(config.lineHeight)
  })
})
