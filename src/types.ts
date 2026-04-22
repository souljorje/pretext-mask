export type RenderMode = 'outline' | 'inside' | 'outside'

export type AvatarConfig = {
  seed: string
  renderMode: RenderMode
  size: number
  fontFamily: string
  fontSize: number
  fontWeight: number
  glyphSpacing: number
  letterSpacing: number
  lineHeight: number
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
  pathId: string
  index: number
  char: string
  baseChar: string
  x: number
  y: number
  angle: number
  color: string
  opacity: number
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
