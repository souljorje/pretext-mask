import type { AvatarConfig, GlyphInstance, ParsedSvg } from './types'
import type { PathSampler } from './glyphLayout'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function createPathSamplers(parsed: ParsedSvg): PathSampler[] {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', parsed.viewBox)
  svg.setAttribute('width', String(parsed.width))
  svg.setAttribute('height', String(parsed.height))
  svg.style.position = 'fixed'
  svg.style.left = '-10000px'
  svg.style.top = '-10000px'
  svg.style.width = '0'
  svg.style.height = '0'
  svg.setAttribute('aria-hidden', 'true')
  document.body.append(svg)

  const samplers: PathSampler[] = []

  for (const path of parsed.paths) {
    const pathElement = document.createElementNS(SVG_NS, 'path')
    pathElement.setAttribute('d', path.d)
    if (path.transform) pathElement.setAttribute('transform', path.transform)
    svg.append(pathElement)

    const rawLength = pathElement.getTotalLength()
    const length = estimateDisplayLength(pathElement, rawLength)
    if (!Number.isFinite(rawLength) || !Number.isFinite(length) || rawLength <= 0 || length <= 0) continue

    samplers.push({
      id: path.id,
      length,
      pointAt(distance: number) {
        const rawDistance = (Math.max(0, Math.min(length, distance)) / length) * rawLength
        const point = pathElement.getPointAtLength(rawDistance)
        return transformPoint(pathElement, point.x, point.y)
      },
    })
  }

  requestAnimationFrame(() => svg.remove())
  return samplers
}

function estimateDisplayLength(pathElement: SVGPathElement, rawLength: number): number {
  const steps = Math.max(16, Math.ceil(rawLength / 12))
  let total = 0
  let previous = transformPoint(pathElement, 0, 0)

  for (let i = 0; i <= steps; i++) {
    const rawDistance = (i / steps) * rawLength
    const point = pathElement.getPointAtLength(rawDistance)
    const transformed = transformPoint(pathElement, point.x, point.y)
    if (i > 0) total += Math.hypot(transformed.x - previous.x, transformed.y - previous.y)
    previous = transformed
  }

  return total
}

function transformPoint(pathElement: SVGPathElement, x: number, y: number): { x: number; y: number } {
  const matrix = pathElement.transform.baseVal.consolidate()?.matrix
  if (!matrix) return { x, y }
  const transformed = new DOMPoint(x, y).matrixTransform(matrix)
  return { x: transformed.x, y: transformed.y }
}

export function makeFallbackSvg(): string {
  return `<svg viewBox="0 0 512 512" width="512" height="512" xmlns="http://www.w3.org/2000/svg">
    <circle id="orbit" cx="256" cy="256" r="176" fill="none" stroke="black"/>
    <path id="wave" d="M104 284 C156 160 236 368 304 232 S416 224 420 352" fill="none" stroke="black"/>
    <polygon id="spark" points="256,86 292,198 410,198 314,266 350,378 256,310 162,378 198,266 102,198 220,198" fill="none" stroke="black"/>
  </svg>`
}

export function buildStaticSvg(parsed: ParsedSvg, glyphs: readonly GlyphInstance[], config: AvatarConfig): string {
  const texts = glyphs
    .map(glyph => {
      const safeChar = escapeXml(glyph.char)
      return `<text x="${round(glyph.x)}" y="${round(glyph.y)}" fill="${escapeXml(glyph.color)}" opacity="${round(glyph.opacity)}">${safeChar}</text>`
    })
    .join('\n  ')

  return `<svg xmlns="${SVG_NS}" viewBox="${escapeXml(parsed.viewBox)}" width="${config.width}" height="${config.height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g font-family="${escapeXml(config.fontFamily)}" font-size="${config.fontSize}" font-weight="${config.fontWeight}" text-anchor="middle" dominant-baseline="middle">
  ${texts}
  </g>
</svg>`
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
