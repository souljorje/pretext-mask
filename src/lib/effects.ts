import { splitGlyphs } from './random'
import type { MaskEffect, TextRun } from './types'

export function createTypingEffect(visibleUntil: number): MaskEffect {
  return {
    drawRun({ ctx, run }) {
      const text = getTypingRunText(run, visibleUntil)
      if (text === null) return 'skip'
      if (text === run.text) return 'default'

      ctx.fillText(text, run.x, run.y)
      return 'handled'
    },
  }
}

export function getTypingRunText(run: TextRun, visibleUntil: number): string | null {
  if (visibleUntil >= run.end) return run.text
  if (visibleUntil <= run.start) return null

  return splitGlyphs(run.text)
    .slice(0, visibleUntil - run.start)
    .join('')
}
