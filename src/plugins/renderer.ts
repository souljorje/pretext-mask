import type { MaskRenderPlan, TextRun, TextRunGlyph } from '../lib'
import type { MaskDrawDecision, MaskGlyphDecision, MaskRenderPlugin } from './types'

type CanvasLetterSpacingContext = CanvasRenderingContext2D & {
  letterSpacing?: string
}

export type MaskRenderOptions = {
  baseColor: string
  plugins?: readonly MaskRenderPlugin[]
}

export function drawMaskRenderPlan(ctx: CanvasRenderingContext2D, plan: MaskRenderPlan, options: MaskRenderOptions) {
  const plugins = options.plugins ?? []
  ctx.fillStyle = options.baseColor

  for (const run of plan.runs) {
    const decision = getRunDecision(ctx, plan, plugins, run)
    if (decision === 'skip' || decision === 'handled') continue

    if (decision === 'glyphs' || needsGlyphSpacingFallback(ctx, plan)) {
      drawMaterializedRun(ctx, plan, plugins, run)
      continue
    }

    ctx.fillStyle = options.baseColor
    setCanvasLetterSpacing(ctx, plan.letterSpacing)
    ctx.fillText(run.text, run.x, run.y)
  }
}

export function canUseCanvasLetterSpacing(ctx: CanvasRenderingContext2D): boolean {
  return 'letterSpacing' in ctx
}

export function setCanvasLetterSpacing(ctx: CanvasRenderingContext2D, letterSpacing: number) {
  const spacedContext = ctx as CanvasLetterSpacingContext
  if ('letterSpacing' in spacedContext) spacedContext.letterSpacing = `${letterSpacing}px`
}

function getRunDecision(
  ctx: CanvasRenderingContext2D,
  plan: MaskRenderPlan,
  plugins: readonly MaskRenderPlugin[],
  run: TextRun,
): MaskDrawDecision {
  let decision: MaskDrawDecision = 'default'

  for (const plugin of plugins) {
    const nextDecision = plugin.drawRun?.({ ctx, plan, run }) ?? 'default'
    if (nextDecision === 'skip' || nextDecision === 'handled') return nextDecision
    if (nextDecision === 'glyphs') decision = 'glyphs'
  }

  return decision
}

function drawMaterializedRun(
  ctx: CanvasRenderingContext2D,
  plan: MaskRenderPlan,
  plugins: readonly MaskRenderPlugin[],
  run: TextRun,
) {
  const previousAlign = ctx.textAlign
  ctx.textAlign = 'center'
  setCanvasLetterSpacing(ctx, 0)

  for (const glyph of plan.materializeGlyphs(run)) {
    const decision = getGlyphDecision(ctx, plan, plugins, run, glyph)
    if (decision === 'skip' || decision === 'handled') continue
    ctx.fillText(glyph.char, glyph.x, glyph.y)
  }

  ctx.textAlign = previousAlign
}

function needsGlyphSpacingFallback(ctx: CanvasRenderingContext2D, plan: MaskRenderPlan): boolean {
  return plan.letterSpacing !== 0 && !canUseCanvasLetterSpacing(ctx)
}

function getGlyphDecision(
  ctx: CanvasRenderingContext2D,
  plan: MaskRenderPlan,
  plugins: readonly MaskRenderPlugin[],
  run: TextRun,
  glyph: TextRunGlyph,
): MaskGlyphDecision {
  for (const plugin of plugins) {
    const decision = plugin.drawGlyph?.({ ctx, plan, run, glyph }) ?? 'default'
    if (decision === 'skip' || decision === 'handled') return decision
  }

  return 'default'
}
