import { describe, expect, it } from 'vitest'
import { createHoverColorPlugin } from './hoverColor'
import type { TextRun } from '../lib'

const run: TextRun = {
  id: 'run-1',
  text: 'abc',
  x: 10,
  y: 20,
  width: 50,
  start: 0,
  end: 3,
  rowIndex: 0,
  segmentIndex: 0,
}

describe('hover color plugin', () => {
  it('materializes only runs that intersect the hover radius', () => {
    const plugin = createHoverColorPlugin({
      pointer: { x: 25, y: 20 },
      radius: 20,
      lineHeight: 12,
      baseColor: '#111111',
      accentColor: '#16a34a',
    })

    expect(plugin.drawRun?.({ run } as never)).toBe('glyphs')
    expect(plugin.drawRun?.({ run: { ...run, x: 100, y: 100 } } as never)).toBe('default')
  })

  it('does not request glyphs without a pointer', () => {
    const plugin = createHoverColorPlugin({
      pointer: null,
      radius: 20,
      lineHeight: 12,
      baseColor: '#111111',
      accentColor: '#16a34a',
    })

    expect(plugin.drawRun?.({ run } as never)).toBe('default')
  })
})
