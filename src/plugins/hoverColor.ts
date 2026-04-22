import type { MaskRenderPlugin } from './types'
import type { TextRun } from '../lib'

export type Point = {
  x: number
  y: number
}

export type HoverColorPluginOptions = {
  pointer: Point | null
  radius: number
  lineHeight: number
  baseColor: string
  accentColor: string
}

export function createHoverColorPlugin(options: HoverColorPluginOptions): MaskRenderPlugin {
  const baseRgb = hexToRgb(options.baseColor)
  const accentRgb = hexToRgb(options.accentColor)

  return {
    drawRun({ run }) {
      if (!options.pointer) return 'default'
      return runIntersectsPointer(run, options.pointer, options.radius, options.lineHeight) ? 'glyphs' : 'default'
    },
    drawGlyph({ ctx, glyph }) {
      if (!options.pointer) return 'default'

      const distance = Math.hypot(glyph.x - options.pointer.x, glyph.y - options.pointer.y)
      ctx.fillStyle =
        distance > options.radius ? options.baseColor : mixRgb(accentRgb, baseRgb, distance / options.radius)
      return 'default'
    },
  }
}

export function runIntersectsPointer(run: TextRun, pointer: Point, radius: number, lineHeight: number): boolean {
  const halfLine = lineHeight / 2
  return (
    pointer.x >= run.x - radius &&
    pointer.x <= run.x + run.width + radius &&
    pointer.y >= run.y - radius - halfLine &&
    pointer.y <= run.y + radius + halfLine
  )
}

function mixRgb(a: [number, number, number], b: [number, number, number], amount: number): string {
  const t = Math.max(0, Math.min(1, amount))
  const channels = a.map((value, index) => Math.round(value * (1 - t) + b[index] * t))
  return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized.length === 3 ? normalized.split('').map(char => char + char).join('') : normalized, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}
