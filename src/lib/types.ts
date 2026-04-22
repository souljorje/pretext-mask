export type RenderMode = 'outline' | 'inside' | 'outside'

export type MaskConfig = {
  seed: string
  renderMode: RenderMode
  width: number
  height: number
  fontFamily: string
  fontSize: number
  fontWeight: number
  glyphSpacing: number
  lineHeight: number
  padding: number
  glitchRate: number
  hoverRadius: number
  baseColor: string
  accentColor: string
}

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
