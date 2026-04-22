import { describe, expect, it } from 'vitest'
import { clearRunLayoutCache, createMaskRenderPlan, getRunLayoutCacheSize, type ShapePointTester } from './runLayout'
import type { MaskConfig, ParsedSvg } from './types'

const globalWithCanvas = globalThis as typeof globalThis & {
  OffscreenCanvas?: new (width: number, height: number) => {
    getContext(type: '2d'): Pick<CanvasRenderingContext2D, 'font' | 'measureText'> | null
  }
}

globalWithCanvas.OffscreenCanvas ??= class {
  getContext(type: '2d') {
    if (type !== '2d') return null

    return {
      font: '16px sans-serif',
      measureText(text: string) {
        const fontSize = Number.parseFloat(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '16')
        const width = text.length * fontSize * 0.62
        return {
          width,
          actualBoundingBoxLeft: 0,
          actualBoundingBoxRight: width,
        } as TextMetrics
      },
    }
  }
} as never

const parsed: ParsedSvg = {
  viewBox: '0 0 100 100',
  width: 100,
  height: 100,
  paths: [{ id: 'shape', d: 'M0 0H100V100H0Z', sourceTag: 'path', transform: '' }],
}

const config: MaskConfig = {
  seed: 'runs',
  renderMode: 'inside',
  width: 160,
  height: 80,
  fontFamily: 'Georgia',
  fontSize: 12,
  fontWeight: 700,
  glyphSpacing: 0,
  lineHeight: 16,
  padding: 0,
  glitchRate: 0,
  hoverRadius: 40,
  baseColor: '#111111',
  accentColor: '#ff0000',
}

const filledShapeTester: ShapePointTester = {
  isPointInShape() {
    return true
  },
  isPointNearOutline() {
    return true
  },
}

describe('run layout', () => {
  it('generates deterministic render plans for the same seed, config, and SVG', () => {
    const first = createMaskRenderPlan(parsed, filledShapeTester, config)
    const second = createMaskRenderPlan(parsed, filledShapeTester, config)

    expect(first.runs).toEqual(second.runs)
    expect(first.frame).toEqual(second.frame)
    expect(first.font).toBe(second.font)
  })

  it('reuses prepared Pretext streams by stable key', () => {
    clearRunLayoutCache()

    createMaskRenderPlan(parsed, filledShapeTester, config)
    expect(getRunLayoutCacheSize()).toBe(1)

    createMaskRenderPlan(parsed, filledShapeTester, config)
    expect(getRunLayoutCacheSize()).toBe(1)
  })

  it('reuses caller text preparation across frame size changes', () => {
    clearRunLayoutCache()

    const textConfig = { ...config, text: 'The same prepared text can be routed through different SVG bounds.' }
    createMaskRenderPlan(parsed, filledShapeTester, textConfig)
    expect(getRunLayoutCacheSize()).toBe(1)

    createMaskRenderPlan(parsed, filledShapeTester, { ...textConfig, width: 240, height: 120 })
    expect(getRunLayoutCacheSize()).toBe(1)
  })

  it('does not loop caller text after exhaustion', () => {
    const plan = createMaskRenderPlan(parsed, filledShapeTester, { ...config, text: 'abc', width: 220, height: 220 })
    expect(plan.runs.map(run => run.text).join('')).toBe('abc')
  })

  it('stores run-level letter spacing for canvas rendering', () => {
    const plan = createMaskRenderPlan(parsed, filledShapeTester, { ...config, glyphSpacing: 4 })
    expect(plan.letterSpacing).toBe(4)
  })

  it('materializes glyph positions monotonically inside the run width', () => {
    const plan = createMaskRenderPlan(parsed, filledShapeTester, { ...config, width: 220 })
    const run = plan.runs.find(item => item.text.length > 1)
    expect(run).toBeDefined()

    const glyphs = plan.materializeGlyphs(run!)
    expect(glyphs.length).toBeGreaterThan(1)
    expect(glyphs[0].x).toBeGreaterThanOrEqual(run!.x)
    expect(glyphs[glyphs.length - 1].x).toBeLessThanOrEqual(run!.x + run!.width + 0.1)

    for (let i = 1; i < glyphs.length; i++) {
      expect(glyphs[i].x).toBeGreaterThan(glyphs[i - 1].x)
    }
  })
})
