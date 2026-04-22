import { describe, expect, it } from 'vitest'
import { getTypingRunText } from './typing'
import type { TextRun } from '../lib'

const run: TextRun = {
  id: 'run-1',
  text: 'abcdef',
  x: 0,
  y: 0,
  width: 60,
  start: 10,
  end: 16,
  rowIndex: 0,
  segmentIndex: 0,
}

describe('typing plugin', () => {
  it('skips runs after the visible cursor', () => {
    expect(getTypingRunText(run, 10)).toBeNull()
  })

  it('draws a prefix for the partially visible run', () => {
    expect(getTypingRunText(run, 13)).toBe('abc')
  })

  it('draws full runs before the visible cursor', () => {
    expect(getTypingRunText(run, 16)).toBe('abcdef')
    expect(getTypingRunText(run, 20)).toBe('abcdef')
  })
})
