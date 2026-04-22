import type { MaskRenderPlan, TextRun, TextRunGlyph } from '../lib'

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

export type MaskRenderPlugin = {
  drawRun?(context: MaskRunContext): MaskDrawDecision
  drawGlyph?(context: MaskGlyphContext): MaskGlyphDecision | void
}
