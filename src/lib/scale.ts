import type { MaskConfig } from './types'

export function createRenderConfig(viewBox: string, config: MaskConfig): MaskConfig {
  const box = parseViewBox(viewBox)
  const longestSide = Math.max(box.width, box.height)
  const longestOutputSide = Math.max(config.width, config.height)
  const unitsPerPixel = longestSide / longestOutputSide

  return {
    ...config,
    fontSize: config.fontSize * unitsPerPixel,
    glyphSpacing: config.glyphSpacing * unitsPerPixel,
    lineHeight: config.lineHeight * unitsPerPixel,
    padding: config.padding * unitsPerPixel,
    hoverRadius: config.hoverRadius * unitsPerPixel,
  }
}

export function parseViewBox(viewBox: string): { x: number; y: number; width: number; height: number } {
  const [x = 0, y = 0, width = 512, height = 512] = viewBox
    .split(/[\s,]+/)
    .map(value => Number.parseFloat(value))
    .filter(Number.isFinite)

  return { x, y, width, height }
}
