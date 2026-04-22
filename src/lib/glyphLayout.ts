import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext'
import type { GlyphInstance, MaskConfig, MaskLayoutConfig } from './types'
import { createSeededRandom, makeGlyphStream, splitGlyphs } from './random'
import { parseViewBox } from './scale'

export const SYMBOL_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789._:-=+*/\\|#@$%&<>[]{}'
export const SYMBOL_GLYPHS = splitGlyphs(SYMBOL_ALPHABET).filter(glyph => glyph.trim().length > 0)

const widthMapCache = new Map<string, Map<string, number>>()
const averageAdvanceCache = new Map<string, number>()
let measureContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined

export function layoutDenseGlyphField(parsedViewBox: string, config: MaskLayoutConfig): GlyphInstance[] {
  const box = parseViewBox(parsedViewBox)
  const lineHeight = Math.max(config.lineHeight, config.fontSize)
  const rowBounds = getRowBounds(box, lineHeight)
  const rowCount = rowBounds.count
  const glyphStep = getGlyphStep(config)
  const charsPerRow = Math.ceil(box.width / glyphStep) + 8
  const stream = makeGlyphStream(`${config.seed}:field`, SYMBOL_ALPHABET, rowCount * charsPerRow * 2)
  const prepared = prepareWithSegments(stream, fontShorthand(config), {
    whiteSpace: 'pre-wrap',
  })
  const lines = layoutWithLines(prepared, box.width + glyphStep * 6, lineHeight).lines
  return layoutDenseGlyphFieldFromLines(parsedViewBox, config, lines.map(line => line.text), stream)
}

export function layoutDenseGlyphFieldFromLines(
  parsedViewBox: string,
  config: MaskLayoutConfig,
  lines: readonly string[],
  fallbackText: string,
): GlyphInstance[] {
  const box = parseViewBox(parsedViewBox)
  const lineHeight = Math.max(config.lineHeight, config.fontSize)
  const rowBounds = getRowBounds(box, lineHeight)
  const rowCount = rowBounds.count
  const glyphStep = getGlyphStep(config)
  const charsPerRow = Math.ceil(box.width / glyphStep) + 8
  const random = createSeededRandom(`${config.seed}:field-offsets`)
  const widthMap = measureGlyphWidthMap(config)
  const fallbackChars = splitGlyphs(fallbackText).filter(char => char.trim().length > 0)
  const rowChars = (lines.length > 0 ? lines : [fallbackText]).map(line => {
    const chars = splitGlyphs(line).filter(char => char.trim().length > 0)
    return chars.length > 0 ? chars : fallbackChars.length > 0 ? fallbackChars : SYMBOL_GLYPHS
  })
  const glyphs: GlyphInstance[] = []

  for (let row = 0; row < rowCount; row++) {
    const chars = rowChars[row % rowChars.length]
    const xOffset = (random.next() - 0.5) * glyphStep * 0.35
    const y = rowBounds.count === 1 ? rowBounds.top : rowBounds.top + row * rowBounds.step
    let x = box.x + xOffset
    let previousWidth = 0

    for (let column = 0; column < charsPerRow; column++) {
      const char = chars[column % Math.max(1, chars.length)] ?? '*'
      const width = widthMap.get(char) ?? glyphStep
      const safetyPad = config.glyphSpacing >= 0 ? config.fontSize * 0.01 : 0
      x += column === 0 ? width / 2 : previousWidth / 2 + width / 2 + config.glyphSpacing
      x += column === 0 ? 0 : safetyPad
      if (x > box.x + box.width + glyphStep * 4) break

      glyphs.push({
        id: `field-${row}-${column}`,
        index: row * charsPerRow + column,
        char,
        x,
        y,
      })

      previousWidth = width
    }
  }

  return glyphs
}

export function glitchGlyphs(glyphs: GlyphInstance[], config: MaskConfig, timeMs: number): GlyphInstance[] {
  const bucket = getGlitchBucket(config, timeMs)
  if (bucket === null) return glyphs

  return glyphs.map(glyph => {
    return {
      ...glyph,
      char: getGlitchedGlyphChar(glyph, config, bucket),
    }
  })
}

export function fontShorthand(config: MaskLayoutConfig): string {
  return `${config.fontWeight} ${config.fontSize}px ${quoteFontFamily(config.fontFamily)}`
}

export function getGlitchBucket(config: MaskConfig, timeMs: number): number | null {
  if (SYMBOL_GLYPHS.length === 0 || config.glitchRate <= 0) return null
  return Math.floor(timeMs / Math.max(40, 1000 / config.glitchRate))
}

export function getGlitchedGlyphChar(glyph: GlyphInstance, config: MaskLayoutConfig, bucket: number | null): string {
  if (bucket === null) return glyph.char
  const random = createSeededRandom(`${config.seed}:glitch:${bucket}:${glyph.id}`)
  return random.pick(SYMBOL_GLYPHS)
}

export function getGlyphStep(config: MaskLayoutConfig): number {
  const naturalAdvance = measureAverageGlyphAdvance(config)
  const minimumAdvance = Math.max(0.1, config.fontSize * 0.01)
  return Math.max(minimumAdvance, naturalAdvance + config.glyphSpacing)
}

export function measureAverageGlyphAdvance(config: MaskLayoutConfig): number {
  const key = measureCacheKey(config)
  const cached = averageAdvanceCache.get(key)
  if (cached !== undefined) return cached

  const widths = [...measureGlyphWidthMap(config).values()]
  if (widths.length === 0) return config.fontSize * 0.82
  const average = widths.reduce((sum, width) => sum + width, 0) / widths.length
  averageAdvanceCache.set(key, average)
  return average
}

export function measureGlyphWidthMap(config: MaskLayoutConfig): Map<string, number> {
  const key = measureCacheKey(config)
  const cached = widthMapCache.get(key)
  if (cached) return cached

  const context = getMeasureContext()
  if (!context || SYMBOL_GLYPHS.length === 0) {
    const fallback = new Map(SYMBOL_GLYPHS.map(glyph => [glyph, config.fontSize * 0.82]))
    widthMapCache.set(key, fallback)
    return fallback
  }

  context.font = fontShorthand(config)
  const widths = new Map(
    SYMBOL_GLYPHS.map(glyph => {
      const metrics = context.measureText(glyph)
      const boundingWidth =
        metrics.actualBoundingBoxLeft && metrics.actualBoundingBoxRight
          ? metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight
          : 0
      return [glyph, Math.max(metrics.width, boundingWidth, config.fontSize * 0.82)]
    }),
  )

  widthMapCache.set(key, widths)
  return widths
}

function getRowBounds(
  box: { y: number; height: number },
  lineHeight: number,
): { top: number; step: number; count: number } {
  const top = box.y
  const bottom = box.y + box.height
  const span = Math.max(0, bottom - top)
  const count = Math.max(1, Math.floor(span / lineHeight) + 1)
  const step = count > 1 ? span / (count - 1) : lineHeight
  return { top, step, count }
}

function getMeasureContext(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  if (measureContext !== undefined) return measureContext

  if (typeof OffscreenCanvas !== 'undefined') {
    measureContext = new OffscreenCanvas(1, 1).getContext('2d')
    return measureContext
  }

  if (typeof document !== 'undefined') {
    measureContext = document.createElement('canvas').getContext('2d')
    return measureContext
  }

  measureContext = null
  return null
}

function measureCacheKey(config: MaskLayoutConfig): string {
  return `${config.fontWeight}|${config.fontSize}|${config.fontFamily}`
}

export function quoteFontFamily(fontFamily: string): string {
  const trimmed = fontFamily.trim() || 'Georgia'
  if (/^["'].*["']$/.test(trimmed)) return trimmed
  if (/^[a-z-]+$/i.test(trimmed)) return trimmed
  return `"${trimmed.replaceAll('"', '\\"')}"`
}
