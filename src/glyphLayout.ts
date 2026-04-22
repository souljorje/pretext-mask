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
  const rowCount = Math.ceil(box.height / lineHeight) + 3
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
  const rowCount = Math.ceil(box.height / lineHeight) + 3
  const glyphStep = getGlyphStep(config)
  const charsPerRow = Math.ceil(box.width / glyphStep) + 8
  const random = createSeededRandom(`${config.seed}:field-offsets`)
  const glyphs: GlyphInstance[] = []

  for (let row = 0; row < rowCount; row++) {
    const line = lines[row % Math.max(1, lines.length)]
    const chars = splitGlyphs(line ?? fallbackText).filter(char => char.trim().length > 0)
    const xOffset = (random.next() - 0.5) * glyphStep * 1.7
    const y = box.y + row * lineHeight + config.fontSize

    for (let column = 0; column < charsPerRow; column++) {
      glyphs.push({
        id: `field-${row}-${column}`,
        pathId: 'field',
        index: row * charsPerRow + column,
        char: chars[column % Math.max(1, chars.length)] ?? '*',
        baseChar: chars[column % Math.max(1, chars.length)] ?? '*',
        x: box.x + column * glyphStep + xOffset,
        y,
        angle: 0,
        color: config.baseColor,
        opacity: 1,
      })
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
  const naturalAdvance = config.fontSize * 0.62
  const minimumAdvance = Math.max(0.1, config.fontSize * 0.18)
  return Math.max(minimumAdvance, naturalAdvance + config.glyphSpacing)
}

function quoteFontFamily(fontFamily: string): string {
  const trimmed = fontFamily.trim() || 'Georgia'
  if (/^["'].*["']$/.test(trimmed)) return trimmed
  if (/^[a-z-]+$/i.test(trimmed)) return trimmed
  return `"${trimmed.replaceAll('"', '\\"')}"`
}
