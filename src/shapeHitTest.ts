import type { ParsedSvg, RenderMode } from './types'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function filterGlyphsByShape<T extends { x: number; y: number }>(
  parsed: ParsedSvg,
  glyphs: readonly T[],
  mode: RenderMode,
  sampleRadius = 0,
): T[] {
  if (mode === 'outline') return [...glyphs]

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

  const pathElements = parsed.paths.map(path => {
    const element = document.createElementNS(SVG_NS, 'path')
    element.setAttribute('d', path.d)
    if (path.transform) element.setAttribute('transform', path.transform)
    svg.append(element)
    return element
  })

  const filtered = glyphs.filter(glyph => {
    const overlapsShape = getSamplePoints(glyph.x, glyph.y, sampleRadius).some(point =>
      pathElements.some(path => path.isPointInFill(point)),
    )
    return mode === 'inside' ? overlapsShape : !overlapsShape
  })

  requestAnimationFrame(() => svg.remove())
  return filtered
}

function getSamplePoints(x: number, y: number, radius: number): DOMPoint[] {
  if (radius <= 0) return [new DOMPoint(x, y)]

  const half = radius / 2
  return [
    new DOMPoint(x, y),
    new DOMPoint(x - radius, y),
    new DOMPoint(x + radius, y),
    new DOMPoint(x, y - half),
    new DOMPoint(x, y + half),
    new DOMPoint(x - radius, y - half),
    new DOMPoint(x + radius, y - half),
    new DOMPoint(x - radius, y + half),
    new DOMPoint(x + radius, y + half),
  ]
}

export function filterGlyphsNearOutline<T extends { x: number; y: number }>(
  parsed: ParsedSvg,
  glyphs: readonly T[],
  strokeWidth: number,
): T[] {
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

  const pathElements = parsed.paths.map(path => {
    const element = document.createElementNS(SVG_NS, 'path')
    element.setAttribute('d', path.d)
    element.setAttribute('fill', 'none')
    element.setAttribute('stroke', 'black')
    element.setAttribute('stroke-width', String(strokeWidth))
    element.setAttribute('stroke-linecap', 'round')
    element.setAttribute('stroke-linejoin', 'round')
    if (path.transform) element.setAttribute('transform', path.transform)
    svg.append(element)
    return element
  })

  const filtered = glyphs.filter(glyph => {
    const point = new DOMPoint(glyph.x, glyph.y)
    return pathElements.some(path => path.isPointInStroke(point))
  })

  requestAnimationFrame(() => svg.remove())
  return filtered
}
