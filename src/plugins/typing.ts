import { splitGlyphs } from '../lib'
import { setCanvasLetterSpacing } from './renderer'
import type { MaskRenderPlugin } from './types'
import type { TextRun } from '../lib'

export function createTypingPlugin(visibleUntil: number): MaskRenderPlugin {
  return {
    drawRun({ ctx, plan, run }) {
      const text = getTypingRunText(run, visibleUntil)
      if (text === null) return 'skip'
      if (text === run.text) return 'default'

      setCanvasLetterSpacing(ctx, plan.letterSpacing)
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
