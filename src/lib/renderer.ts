import type { MaskDrawDecision, MaskEffect, MaskGlyphDecision, MaskRenderPlan, TextRun, TextRunGlyph } from './types'

type CanvasLetterSpacingContext = CanvasRenderingContext2D & {
  letterSpacing?: string
}

export function drawMaskRenderPlan(
  ctx: CanvasRenderingContext2D,
  plan: MaskRenderPlan,
  effects: readonly MaskEffect[] = [],
) {
  for (const run of plan.runs) {
    const decision = getRunDecision(ctx, plan, effects, run)
    if (decision === 'skip' || decision === 'handled') continue

    if (decision === 'glyphs' || needsGlyphSpacingFallback(ctx, plan)) {
      drawMaterializedRun(ctx, plan, effects, run)
      continue
    }

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
  effects: readonly MaskEffect[],
  run: TextRun,
): MaskDrawDecision {
  let decision: MaskDrawDecision = 'default'

  for (const effect of effects) {
    const nextDecision = effect.drawRun?.({ ctx, plan, run }) ?? 'default'
    if (nextDecision === 'skip' || nextDecision === 'handled') return nextDecision
    if (nextDecision === 'glyphs') decision = 'glyphs'
  }

  return decision
}

function drawMaterializedRun(
  ctx: CanvasRenderingContext2D,
  plan: MaskRenderPlan,
  effects: readonly MaskEffect[],
  run: TextRun,
) {
  const previousAlign = ctx.textAlign
  ctx.textAlign = 'center'
  setCanvasLetterSpacing(ctx, 0)

  for (const glyph of plan.materializeGlyphs(run)) {
    const decision = getGlyphDecision(ctx, plan, effects, run, glyph)
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
  effects: readonly MaskEffect[],
  run: TextRun,
  glyph: TextRunGlyph,
): MaskGlyphDecision {
  for (const effect of effects) {
    const decision = effect.drawGlyph?.({ ctx, plan, run, glyph }) ?? 'default'
    if (decision === 'skip' || decision === 'handled') return decision
  }

  return 'default'
}
