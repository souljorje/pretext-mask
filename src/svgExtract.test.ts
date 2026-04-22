import { describe, expect, it } from 'vitest'
import { elementToPathData, parsePoints } from './svgExtract'

function element(tag: string, attrs: Record<string, string>): Element {
  return {
    tagName: tag,
    getAttribute(name: string) {
      return attrs[name] ?? null
    },
  } as Element
}

describe('svg extraction helpers', () => {
  it('converts circles to path data', () => {
    expect(elementToPathData(element('circle', { cx: '20', cy: '30', r: '10' }))).toContain('a 10 10')
  })

  it('converts rects to path data', () => {
    expect(elementToPathData(element('rect', { x: '1', y: '2', width: '30', height: '40' }))).toBe('M 1 2 H 31 V 42 H 1 Z')
  })

  it('converts polygons to closed paths', () => {
    expect(elementToPathData(element('polygon', { points: '0,0 10,0 10,10' }))).toBe('M 0 0 L 10 0 L 10 10 Z')
  })

  it('parses point lists', () => {
    expect(parsePoints('0,0 12 7 20,30')).toEqual([
      [0, 0],
      [12, 7],
      [20, 30],
    ])
  })
})
