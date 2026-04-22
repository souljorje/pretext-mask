import { layoutNextLine, prepareWithSegments, type LayoutCursor, type PreparedTextWithSegments } from '@chenglou/pretext'
import { fontShorthand, getGlyphStep, measureGlyphWidthMap, SYMBOL_ALPHABET } from './glyphLayout'
import { hashSeed, makeGlyphStream, splitGlyphs } from './random'
import { fitViewBoxToFrame } from './scale'
import type { MaskLayoutConfig, MaskRenderPlan, ParsedSvg, RowSegment, TextRun, TextRunGlyph } from './types'

export type ShapePointTester = {
  isPointInShape(point: { x: number; y: number }, mode: Exclude<MaskLayoutConfig['renderMode'], 'outline'>, sampleRadius?: number): boolean
  isPointNearOutline(point: { x: number; y: number }, strokeWidth: number): boolean
}

type PreparedStream = {
  prepared: PreparedTextWithSegments
  loop: boolean
}

type FrameToSvgTransform = {
  x(value: number): number
  y(value: number): number
  unitsPerPixel: number
}

const INITIAL_CURSOR: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
const preparedStreamCache = new Map<string, PreparedStream>()

export function createMaskRenderPlan(
  parsed: ParsedSvg,
  hitTester: ShapePointTester,
  config: MaskLayoutConfig,
): MaskRenderPlan {
  const frame = {
    width: Math.max(1, config.width),
    height: Math.max(1, config.height),
  }
  const font = fontShorthand(config)
  const glyphStep = getGlyphStep(config)
  const segments = createShapeRowSegments(parsed, hitTester, config)
  const streamLength = estimateStreamLength(segments, glyphStep)
  const preparedStream = getPreparedGlyphStream(config, streamLength)
  const runs = routeRunsThroughSegments(segments, preparedStream.prepared, preparedStream.loop)
  const materializedGlyphs = new Map<string, TextRunGlyph[]>()

  return {
    runs,
    frame,
    font,
    letterSpacing: config.glyphSpacing,
    materializeGlyphs(run) {
      const cached = materializedGlyphs.get(run.id)
      if (cached) return cached

      const glyphs = materializeRunGlyphs(run, config)
      materializedGlyphs.set(run.id, glyphs)
      return glyphs
    },
  }
}

export function createShapeRowSegments(
  parsed: ParsedSvg,
  hitTester: ShapePointTester,
  config: MaskLayoutConfig,
): RowSegment[] {
  const frameWidth = Math.max(1, config.width)
  const frameHeight = Math.max(1, config.height)
  const lineHeight = Math.max(config.lineHeight, config.fontSize, 1)
  const glyphStep = getGlyphStep(config)
  const sampleStep = Math.max(1, glyphStep * 0.5)
  const rowCount = Math.max(1, Math.floor(frameHeight / lineHeight) + 1)
  const rowStep = rowCount > 1 ? frameHeight / (rowCount - 1) : lineHeight
  const transform = createFrameToSvgTransform(parsed.viewBox, frameWidth, frameHeight, config.padding)
  const sampleRadius = config.fontSize * 0.75 * transform.unitsPerPixel
  const strokeWidth = Math.max(config.fontSize * 1.45, config.lineHeight * 0.72) * transform.unitsPerPixel
  const segments: RowSegment[] = []

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const y = rowCount === 1 ? 0 : rowIndex * rowStep
    let start: number | null = null
    let segmentIndex = 0
    const sampleCount = Math.ceil(frameWidth / sampleStep)

    for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex++) {
      const x = Math.min(frameWidth, sampleIndex * sampleStep)
      const accepted =
        sampleIndex < sampleCount && isAcceptedSample(hitTester, config.renderMode, transform, x, y, sampleRadius, strokeWidth)

      if (accepted && start === null) {
        start = x
        continue
      }

      if (!accepted && start !== null) {
        const width = x - start
        if (width >= glyphStep) {
          segments.push({ rowIndex, segmentIndex, x: start, y, width })
          segmentIndex += 1
        }
        start = null
      }
    }
  }

  return segments
}

export function clearRunLayoutCache() {
  preparedStreamCache.clear()
}

export function getRunLayoutCacheSize(): number {
  return preparedStreamCache.size
}

function routeRunsThroughSegments(
  segments: readonly RowSegment[],
  prepared: PreparedTextWithSegments,
  loop: boolean,
): TextRun[] {
  const runs: TextRun[] = []
  let cursor: LayoutCursor = INITIAL_CURSOR
  let globalStart = 0

  for (const segment of segments) {
    let line = layoutNextLine(prepared, cursor, segment.width)

    if (line === null && loop) {
      cursor = INITIAL_CURSOR
      line = layoutNextLine(prepared, cursor, segment.width)
    }

    if (line === null || line.text.length === 0) continue

    const length = splitGlyphs(line.text).length
    runs.push({
      id: `run-${segment.rowIndex}-${segment.segmentIndex}-${runs.length}`,
      text: line.text,
      x: segment.x,
      y: segment.y,
      width: line.width,
      start: globalStart,
      end: globalStart + length,
      rowIndex: segment.rowIndex,
      segmentIndex: segment.segmentIndex,
    })

    globalStart += length
    cursor = line.end
  }

  return runs
}

function getPreparedGlyphStream(config: MaskLayoutConfig, streamLength: number): PreparedStream {
  const text = getConfigText(config)
  const key = preparedCacheKey(config, streamLength, text)
  const cached = preparedStreamCache.get(key)
  if (cached) return cached

  const loop = text === null
  const stream = text ?? makeGlyphStream(`${config.seed}:runs`, SYMBOL_ALPHABET, streamLength)
  const prepared = prepareWithSegments(stream, fontShorthand(config), {
    whiteSpace: 'pre-wrap',
    letterSpacing: config.glyphSpacing,
  })
  const preparedStream = { prepared, loop }
  preparedStreamCache.set(key, preparedStream)
  return preparedStream
}

function materializeRunGlyphs(run: TextRun, config: MaskLayoutConfig): TextRunGlyph[] {
  const chars = splitGlyphs(run.text)
  const widthMap = measureGlyphWidthMap(config)
  const fallbackWidth = getGlyphStep(config)
  const glyphs: TextRunGlyph[] = []
  let x = run.x

  for (let index = 0; index < chars.length; index++) {
    const char = chars[index]
    const width = widthMap.get(char) ?? fallbackWidth
    const centerX = x + width / 2
    glyphs.push({
      id: `${run.id}-${index}`,
      index: run.start + index,
      runId: run.id,
      runIndex: index,
      char,
      x: centerX,
      y: run.y,
    })
    x += width + config.glyphSpacing
  }

  fitGlyphsToRunWidth(glyphs, run)
  return glyphs
}

function fitGlyphsToRunWidth(glyphs: TextRunGlyph[], run: TextRun) {
  if (glyphs.length === 0) return

  const lastGlyph = glyphs[glyphs.length - 1]
  const lastOffset = lastGlyph.x - run.x
  if (lastOffset <= run.width && glyphs[0].x >= run.x) return
  if (lastOffset <= 0) return

  const scale = Math.max(0, run.width) / lastOffset
  for (const glyph of glyphs) {
    glyph.x = run.x + (glyph.x - run.x) * scale
  }
}

function estimateStreamLength(segments: readonly RowSegment[], glyphStep: number): number {
  const slots = segments.reduce((sum, segment) => sum + Math.ceil(segment.width / glyphStep) + 2, 0)
  return Math.max(128, slots * 2)
}

function getConfigText(config: MaskLayoutConfig): string | null {
  const text = config.text
  return text && text.length > 0 ? text : null
}

function preparedCacheKey(config: MaskLayoutConfig, streamLength: number, text: string | null): string {
  const fontKey = `${fontShorthand(config)}|${config.glyphSpacing}`
  if (text !== null) return `text|${fontKey}|${text.length}|${hashSeed(text)}`
  return `seed|${fontKey}|${config.seed}|${streamLength}`
}

function createFrameToSvgTransform(
  viewBox: string,
  frameWidth: number,
  frameHeight: number,
  padding: number,
): FrameToSvgTransform {
  const fit = fitViewBoxToFrame(viewBox, frameWidth, frameHeight, padding)
  return {
    x(value) {
      return fit.box.x + (value - fit.x) / fit.scale
    },
    y(value) {
      return fit.box.y + (value - fit.y) / fit.scale
    },
    unitsPerPixel: fit.unitsPerPixel,
  }
}

function isAcceptedSample(
  hitTester: ShapePointTester,
  mode: MaskLayoutConfig['renderMode'],
  transform: FrameToSvgTransform,
  x: number,
  y: number,
  sampleRadius: number,
  strokeWidth: number,
): boolean {
  const point = { x: transform.x(x), y: transform.y(y) }
  if (mode === 'outline') return hitTester.isPointNearOutline(point, strokeWidth)
  return hitTester.isPointInShape(point, mode, sampleRadius)
}
