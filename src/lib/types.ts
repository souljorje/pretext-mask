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

export type MaskEffectConfig = {
  glitchRate: number
  hoverRadius: number
  baseColor: string
  accentColor: string
}

export type MaskConfig = MaskLayoutConfig & MaskEffectConfig

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

export type MaskDrawDecision = 'default' | 'skip' | 'handled' | 'glyphs'
export type MaskGlyphDecision = 'default' | 'skip' | 'handled'

export type MaskRunContext = {
  ctx: CanvasRenderingContext2D
  plan: MaskRenderPlan
  run: TextRun
}

export type MaskGlyphContext = MaskRunContext & {
  glyph: TextRunGlyph
}

export type MaskEffect = {
  drawRun?(context: MaskRunContext): MaskDrawDecision
  drawGlyph?(context: MaskGlyphContext): MaskGlyphDecision | void
}
