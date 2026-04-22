import type { MaskConfig } from './types'

export function createRenderConfig(viewBox: string, config: MaskConfig): MaskConfig {
  const fit = fitViewBoxToFrame(viewBox, config.width, config.height, config.padding)
  const unitsPerPixel = fit.unitsPerPixel

  return {
    ...config,
    fontSize: config.fontSize * unitsPerPixel,
    glyphSpacing: config.glyphSpacing * unitsPerPixel,
    lineHeight: config.lineHeight * unitsPerPixel,
    padding: config.padding * unitsPerPixel,
    hoverRadius: config.hoverRadius * unitsPerPixel,
  }
}

export function fitViewBoxToFrame(viewBox: string, frameWidth: number, frameHeight: number, padding = 0) {
  const box = parseViewBox(viewBox)
  const outputWidth = Math.max(1, frameWidth)
  const outputHeight = Math.max(1, frameHeight)
  const effectivePadding =
    padding > 0 ? Math.min(padding, (outputWidth - 1) / 2, (outputHeight - 1) / 2) : padding
  const availableWidth = Math.max(1, outputWidth - effectivePadding * 2)
  const availableHeight = Math.max(1, outputHeight - effectivePadding * 2)
  const scale = Math.min(availableWidth / box.width, availableHeight / box.height)
  const width = box.width * scale
  const height = box.height * scale
  const x = effectivePadding + (availableWidth - width) / 2
  const y = effectivePadding + (availableHeight - height) / 2

  return {
    box,
    x,
    y,
    width,
    height,
    scale,
    unitsPerPixel: 1 / scale,
  }
}

export function parseViewBox(viewBox: string): { x: number; y: number; width: number; height: number } {
  const [x = 0, y = 0, width = 512, height = 512] = viewBox
    .split(/[\s,]+/)
    .map(value => Number.parseFloat(value))
    .filter(Number.isFinite)

  return { x, y, width, height }
}
