export type RenderMode = 'outline' | 'inside' | 'outside'

export type MaskLayoutConfig = {
  seed: string
  text?: string
  renderMode: RenderMode
  width: number
  height: number
  fontFamily: string
  fontSize: number
  fontWeight: number
  glyphSpacing: number
  lineHeight: number
  padding: number
}

export type MaskConfig = MaskLayoutConfig

export type ExtractedPath = {
  id: string
  d: string
  sourceTag: string
  transform: string
}

export type GlyphInstance = {
  id: string
  index: number
  char: string
  x: number
  y: number
}

export type SeededRandom = {
  next(): number
  int(maxExclusive: number): number
  pick<T>(items: readonly T[]): T
}

export type ParsedSvg = {
  viewBox: string
  width: number
  height: number
  paths: ExtractedPath[]
}

export type FrameRect = {
  width: number
  height: number
}

export type RowSegment = {
  rowIndex: number
  segmentIndex: number
  x: number
  y: number
  width: number
}

export type TextRun = {
  id: string
  text: string
  x: number
  y: number
  width: number
  start: number
  end: number
  rowIndex: number
  segmentIndex: number
}

export type TextRunGlyph = GlyphInstance & {
  runId: string
  runIndex: number
}

export type MaskRenderPlan = {
  runs: TextRun[]
  frame: FrameRect
  font: string
  letterSpacing: number
  materializeGlyphs(run: TextRun): TextRunGlyph[]
}
