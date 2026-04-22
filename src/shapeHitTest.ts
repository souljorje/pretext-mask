import type { ParsedSvg, RenderMode } from './types'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function filterGlyphsByShape<T extends { x: number; y: number }>(
  parsed: ParsedSvg,
  glyphs: readonly T[],
  mode: RenderMode,
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
    const point = new DOMPoint(glyph.x, glyph.y)
    const isInside = pathElements.some(path => path.isPointInFill(point))
    return mode === 'inside' ? isInside : !isInside
  })

  requestAnimationFrame(() => svg.remove())
  return filtered
}
