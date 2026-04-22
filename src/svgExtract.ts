import type { ExtractedPath, ParsedSvg } from './types'

const GEOMETRY_SELECTOR = 'path,circle,ellipse,rect,line,polyline,polygon'

export function extractPathsFromSvgText(svgText: string): ParsedSvg {
  const parser = new DOMParser()
  const document = parser.parseFromString(svgText, 'image/svg+xml')
  const svg = document.querySelector('svg')

  if (!svg) {
    throw new Error('Input does not contain an <svg> root.')
  }

  const width = readNumber(svg.getAttribute('width'), 512)
  const height = readNumber(svg.getAttribute('height'), 512)
  const viewBox = svg.getAttribute('viewBox') ?? `0 0 ${width} ${height}`
  const elements = [...svg.querySelectorAll<SVGElement>(GEOMETRY_SELECTOR)]
  const paths: ExtractedPath[] = []

  for (const [index, element] of elements.entries()) {
    if (!isVisibleElement(element)) continue

    const d = elementToPathData(element)
    if (!d) continue

    paths.push({
      id: element.getAttribute('id') || `${element.tagName.toLowerCase()}-${index + 1}`,
      d,
      sourceTag: element.tagName.toLowerCase(),
      transform: collectTransform(element),
    })
  }

  return {
    viewBox,
    width,
    height,
    paths,
  }
}

export function elementToPathData(element: Element): string | null {
  const tag = element.tagName.toLowerCase()

  if (tag === 'path') {
    const d = element.getAttribute('d')
    return d?.trim() || null
  }

  if (tag === 'circle') {
    const cx = num(element, 'cx')
    const cy = num(element, 'cy')
    const r = num(element, 'r')
    if (r <= 0) return null
    return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`
  }

  if (tag === 'ellipse') {
    const cx = num(element, 'cx')
    const cy = num(element, 'cy')
    const rx = num(element, 'rx')
    const ry = num(element, 'ry')
    if (rx <= 0 || ry <= 0) return null
    return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`
  }

  if (tag === 'rect') {
    const x = num(element, 'x')
    const y = num(element, 'y')
    const width = num(element, 'width')
    const height = num(element, 'height')
    if (width <= 0 || height <= 0) return null

    const rx = Math.min(num(element, 'rx'), width / 2)
    const ry = Math.min(num(element, 'ry'), height / 2)
    if (rx > 0 || ry > 0) {
      const cornerX = rx || ry
      const cornerY = ry || rx
      return [
        `M ${x + cornerX} ${y}`,
        `H ${x + width - cornerX}`,
        `A ${cornerX} ${cornerY} 0 0 1 ${x + width} ${y + cornerY}`,
        `V ${y + height - cornerY}`,
        `A ${cornerX} ${cornerY} 0 0 1 ${x + width - cornerX} ${y + height}`,
        `H ${x + cornerX}`,
        `A ${cornerX} ${cornerY} 0 0 1 ${x} ${y + height - cornerY}`,
        `V ${y + cornerY}`,
        `A ${cornerX} ${cornerY} 0 0 1 ${x + cornerX} ${y}`,
        'Z',
      ].join(' ')
    }

    return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`
  }

  if (tag === 'line') {
    return `M ${num(element, 'x1')} ${num(element, 'y1')} L ${num(element, 'x2')} ${num(element, 'y2')}`
  }

  if (tag === 'polyline' || tag === 'polygon') {
    const points = parsePoints(element.getAttribute('points') ?? '')
    if (points.length === 0) return null
    const commands = [`M ${points[0][0]} ${points[0][1]}`]
    for (let i = 1; i < points.length; i++) {
      commands.push(`L ${points[i][0]} ${points[i][1]}`)
    }
    if (tag === 'polygon') commands.push('Z')
    return commands.join(' ')
  }

  return null
}

export function parsePoints(points: string): Array<[number, number]> {
  const values = points
    .trim()
    .split(/[\s,]+/)
    .map(value => Number.parseFloat(value))
    .filter(Number.isFinite)
  const output: Array<[number, number]> = []

  for (let i = 0; i < values.length - 1; i += 2) {
    output.push([values[i], values[i + 1]])
  }

  return output
}

export function isVisibleElement(element: Element): boolean {
  const display = attrOrStyle(element, 'display')
  const visibility = attrOrStyle(element, 'visibility')
  const opacity = attrOrStyle(element, 'opacity')

  return display !== 'none' && visibility !== 'hidden' && opacity !== '0'
}

function collectTransform(element: Element): string {
  const transforms: string[] = []
  let current: Element | null = element

  while (current && current.tagName.toLowerCase() !== 'svg') {
    const transform = current.getAttribute('transform')
    if (transform) transforms.unshift(transform)
    current = current.parentElement
  }

  return transforms.join(' ')
}

function attrOrStyle(element: Element, name: string): string | null {
  const direct = element.getAttribute(name)
  if (direct) return direct

  const style = element.getAttribute('style')
  if (!style) return null

  const match = style.match(new RegExp(`${name}\\s*:\\s*([^;]+)`, 'i'))
  return match?.[1]?.trim() ?? null
}

function num(element: Element, attribute: string): number {
  return readNumber(element.getAttribute(attribute), 0)
}

function readNumber(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
