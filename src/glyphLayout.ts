import {
  layoutWithLines,
  layoutNextLineRange,
  materializeLineRange,
  prepareWithSegments,
  type LayoutCursor,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'
import type { AvatarConfig, ExtractedPath, GlyphInstance } from './types'
import { createSeededRandom, makeGlyphStream, splitGlyphs } from './random'
import { parseViewBox } from './scale'

export const SYMBOL_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789._:-=+*/\\|#@$%&<>[]{}'

export type PathSampler = {
  id: string
  length: number
  pointAt(distance: number): { x: number; y: number }
}

export type GlyphTextSource = {
  prepared: PreparedTextWithSegments
  cursor: LayoutCursor
}

export function createGlyphTextSource(config: AvatarConfig, pathCount: number): GlyphTextSource {
  const streamLength = Math.max(2000, pathCount * 900)
  const stream = makeGlyphStream(`${config.seed}:glyphs`, SYMBOL_ALPHABET, streamLength)
  const prepared = prepareWithSegments(stream, fontShorthand(config), {
    whiteSpace: 'pre-wrap',
    letterSpacing: config.letterSpacing,
  })

  return {
    prepared,
    cursor: { segmentIndex: 0, graphemeIndex: 0 },
  }
}

export function layoutGlyphsOnSamplers(
  paths: ExtractedPath[],
  samplers: PathSampler[],
  config: AvatarConfig,
): GlyphInstance[] {
  const source = createGlyphTextSource(config, paths.length)
  const glyphs: GlyphInstance[] = []
  const glyphStep = getGlyphStep(config)

  for (const sampler of samplers) {
    const line = layoutNextLineRange(source.prepared, source.cursor, sampler.length)
    if (!line) break

    const materialized = materializeLineRange(source.prepared, line)
    const chars = splitGlyphs(materialized.text)
    const count = Math.max(0, Math.floor(sampler.length / glyphStep))
    const usableChars = chars.slice(0, count)

    for (let i = 0; i < usableChars.length; i++) {
      const distance = Math.min(sampler.length, (i + 0.5) * glyphStep)
      const point = sampler.pointAt(distance)

      glyphs.push({
        id: `${sampler.id}-${i}`,
        pathId: sampler.id,
        index: i,
        char: usableChars[i],
        baseChar: usableChars[i],
        x: point.x,
        y: point.y,
        angle: 0,
        color: config.baseColor,
        opacity: 1,
      })
    }

    source.cursor = line.end
  }

  return glyphs
}

export function layoutDenseGlyphField(parsedViewBox: string, config: AvatarConfig): GlyphInstance[] {
  const box = parseViewBox(parsedViewBox)
  const lineHeight = Math.max(config.lineHeight, config.fontSize)
  const rowBounds = getRowBounds(box, config, lineHeight)
  const rowCount = rowBounds.count
  const glyphStep = getGlyphStep(config)
  const charsPerRow = Math.ceil(box.width / glyphStep) + 8
  const stream = makeGlyphStream(`${config.seed}:field`, SYMBOL_ALPHABET, rowCount * charsPerRow * 2)
  const prepared = prepareWithSegments(stream, fontShorthand(config), {
    whiteSpace: 'pre-wrap',
    letterSpacing: config.letterSpacing,
  })
  const lines = layoutWithLines(prepared, box.width + glyphStep * 6, lineHeight).lines
  return layoutDenseGlyphFieldFromLines(parsedViewBox, config, lines.map(line => line.text), stream)
}

export function layoutDenseGlyphFieldFromLines(
  parsedViewBox: string,
  config: AvatarConfig,
  lines: readonly string[],
  fallbackText: string,
): GlyphInstance[] {
  const box = parseViewBox(parsedViewBox)
  const lineHeight = Math.max(config.lineHeight, config.fontSize)
  const rowBounds = getRowBounds(box, config, lineHeight)
  const rowCount = rowBounds.count
  const glyphStep = getGlyphStep(config)
  const charsPerRow = Math.ceil(box.width / glyphStep) + 8
  const random = createSeededRandom(`${config.seed}:field-offsets`)
  const widthMap = measureGlyphWidthMap(config)
  const glyphs: GlyphInstance[] = []

  for (let row = 0; row < rowCount; row++) {
    const line = lines[row % Math.max(1, lines.length)]
    const chars = splitGlyphs(line ?? fallbackText).filter(char => char.trim().length > 0)
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
        pathId: 'field',
        index: row * charsPerRow + column,
        char,
        baseChar: char,
        x,
        y,
        angle: 0,
        color: config.baseColor,
        opacity: 1,
      })

      previousWidth = width
    }
  }

  return glyphs
}

export function chunkGlyphsByMeasuredBudget(
  glyphs: readonly string[],
  maxAdvance: number,
  measure: (glyph: string) => number,
): string[] {
  const output: string[] = []
  let advance = 0

  for (const glyph of glyphs) {
    const nextAdvance = measure(glyph)
    if (advance + nextAdvance > maxAdvance) break
    output.push(glyph)
    advance += nextAdvance
  }

  return output
}

export function glitchGlyphs(glyphs: GlyphInstance[], config: AvatarConfig, timeMs: number): GlyphInstance[] {
  const alphabet = splitGlyphs(SYMBOL_ALPHABET).filter(glyph => glyph.trim().length > 0)
  if (alphabet.length === 0 || config.glitchRate <= 0) return glyphs

  const bucket = Math.floor(timeMs / Math.max(40, 1000 / config.glitchRate))

  return glyphs.map(glyph => {
    const random = createSeededRandom(`${config.seed}:glitch:${bucket}:${glyph.id}`)
    return {
      ...glyph,
      char: random.pick(alphabet),
    }
  })
}

export function fontShorthand(config: AvatarConfig): string {
  return `${config.fontWeight} ${config.fontSize}px ${quoteFontFamily(config.fontFamily)}`
}

export function getGlyphStep(config: AvatarConfig): number {
  const naturalAdvance = measureAverageGlyphAdvance(config)
  const minimumAdvance = Math.max(0.1, config.fontSize * 0.01)
  return Math.max(minimumAdvance, naturalAdvance + config.glyphSpacing)
}

export function measureAverageGlyphAdvance(config: AvatarConfig): number {
  const widths = [...measureGlyphWidthMap(config).values()]
  if (widths.length === 0) return config.fontSize * 0.82
  return widths.reduce((sum, width) => sum + width, 0) / widths.length
}

export function measureGlyphWidthMap(config: AvatarConfig): Map<string, number> {
  const glyphs = splitGlyphs(SYMBOL_ALPHABET).filter(glyph => glyph.trim().length > 0)
  const context = getMeasureContext()
  if (!context || glyphs.length === 0) {
    return new Map(glyphs.map(glyph => [glyph, config.fontSize * 0.82]))
  }

  context.font = fontShorthand(config)
  return new Map(
    glyphs.map(glyph => {
      const metrics = context.measureText(glyph)
      const boundingWidth =
        metrics.actualBoundingBoxLeft && metrics.actualBoundingBoxRight
          ? metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight
          : 0
      return [glyph, Math.max(metrics.width, boundingWidth, config.fontSize * 0.82)]
    }),
  )
}

export function measureVerticalMetrics(config: AvatarConfig): { ascent: number; descent: number } {
  const context = getMeasureContext()
  if (!context) return { ascent: config.fontSize * 0.8, descent: config.fontSize * 0.2 }

  context.font = fontShorthand(config)
  const metrics = context.measureText(SYMBOL_ALPHABET)
  return {
    ascent: metrics.actualBoundingBoxAscent || config.fontSize * 0.8,
    descent: metrics.actualBoundingBoxDescent || config.fontSize * 0.2,
  }
}

function getRowBounds(
  box: { y: number; height: number },
  config: AvatarConfig,
  lineHeight: number,
): { top: number; step: number; count: number } {
  const top = box.y + config.padding
  const bottom = box.y + box.height - config.padding
  const span = Math.max(0, bottom - top)
  const count = Math.max(1, Math.floor(span / lineHeight) + 1)
  const step = count > 1 ? span / (count - 1) : lineHeight
  return { top, step, count }
}

function getMeasureContext(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(1, 1).getContext('2d')
  }

  if (typeof document !== 'undefined') {
    return document.createElement('canvas').getContext('2d')
  }

  return null
}

function quoteFontFamily(fontFamily: string): string {
  const trimmed = fontFamily.trim() || 'Georgia'
  if (/^["'].*["']$/.test(trimmed)) return trimmed
  if (/^[a-z-]+$/i.test(trimmed)) return trimmed
  return `"${trimmed.replaceAll('"', '\\"')}"`
}
