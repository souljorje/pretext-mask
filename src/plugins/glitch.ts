import { createSeededRandom, SYMBOL_GLYPHS } from '../lib'
import type { MaskRenderPlugin } from './types'
import type { TextRunGlyph } from '../lib'

export type GlitchPluginOptions = {
  seed: string
  bucket: number | null
}

export function createGlitchPlugin(options: GlitchPluginOptions): MaskRenderPlugin {
  return {
    drawRun() {
      return options.bucket === null ? 'default' : 'glyphs'
    },
    drawGlyph({ ctx, glyph }) {
      if (options.bucket === null) return 'default'
      ctx.fillText(getGlitchedGlyphChar(glyph, options.seed, options.bucket), glyph.x, glyph.y)
      return 'handled'
    },
  }
}

export function getGlitchBucket(glitchRate: number, timeMs: number): number | null {
  if (SYMBOL_GLYPHS.length === 0 || glitchRate <= 0) return null
  return Math.floor(timeMs / Math.max(40, 1000 / glitchRate))
}

export function getGlitchedGlyphChar(glyph: TextRunGlyph, seed: string, bucket: number | null): string {
  if (bucket === null) return glyph.char
  const random = createSeededRandom(`${seed}:glitch:${bucket}:${glyph.id}`)
  return random.pick(SYMBOL_GLYPHS)
}
