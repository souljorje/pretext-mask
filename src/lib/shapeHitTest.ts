import type { ParsedSvg, RenderMode } from './types'

const SVG_NS = 'http://www.w3.org/2000/svg'

export type ShapeHitTester = {
  filterByShape<T extends { x: number; y: number }>(glyphs: readonly T[], mode: Exclude<RenderMode, 'outline'>, sampleRadius?: number): T[]
  filterNearOutline<T extends { x: number; y: number }>(glyphs: readonly T[], strokeWidth: number): T[]
  dispose(): void
}

export function createShapeHitTester(parsed: ParsedSvg): ShapeHitTester {
  const svg = createHiddenSvg(parsed)
  const pathElements = parsed.paths.map(path => {
    const element = createPathElement(svg, path.d, path.transform)
    element.setAttribute('fill', 'black')
    element.setAttribute('stroke', 'black')
    element.setAttribute('stroke-linecap', 'round')
    element.setAttribute('stroke-linejoin', 'round')
    return element
  })

  return {
    filterByShape(glyphs, mode, sampleRadius = 0) {
      return glyphs.filter(glyph => {
        const overlapsShape = getSamplePoints(glyph.x, glyph.y, sampleRadius).some(point =>
          pathElements.some(path => path.isPointInFill(point)),
        )
        return mode === 'inside' ? overlapsShape : !overlapsShape
      })
    },
    filterNearOutline(glyphs, strokeWidth) {
      for (const path of pathElements) {
        path.setAttribute('stroke-width', String(strokeWidth))
      }

      return glyphs.filter(glyph => {
        const point = new DOMPoint(glyph.x, glyph.y)
        return pathElements.some(path => path.isPointInStroke(point))
      })
    },
    dispose() {
      svg.remove()
    },
  }
}

export function filterGlyphsByShape<T extends { x: number; y: number }>(
  parsed: ParsedSvg,
  glyphs: readonly T[],
  mode: RenderMode,
  sampleRadius = 0,
): T[] {
  if (mode === 'outline') return [...glyphs]

  const tester = createShapeHitTester(parsed)
  try {
    return tester.filterByShape(glyphs, mode, sampleRadius)
  } finally {
    tester.dispose()
  }
}

export function filterGlyphsNearOutline<T extends { x: number; y: number }>(
  parsed: ParsedSvg,
  glyphs: readonly T[],
  strokeWidth: number,
): T[] {
  const tester = createShapeHitTester(parsed)
  try {
    return tester.filterNearOutline(glyphs, strokeWidth)
  } finally {
    tester.dispose()
  }
}

function createHiddenSvg(parsed: ParsedSvg): SVGSVGElement {
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
  svg.dataset.pretextHitTest = 'true'
  document.body.append(svg)
  return svg
}

function createPathElement(svg: SVGSVGElement, d: string, transform: string): SVGPathElement {
  const element = document.createElementNS(SVG_NS, 'path')
  element.setAttribute('d', d)
  if (transform) element.setAttribute('transform', transform)
  svg.append(element)
  return element
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
