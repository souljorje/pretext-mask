import './styles.css'
import type { GlyphInstance, MaskConfig, ParsedSvg } from './types'
import { extractPathsFromSvgText } from './svgExtract'
import { glitchGlyphs, layoutDenseGlyphField } from './glyphLayout'
import { makeFallbackSvg } from './svgSampler'
import { createRenderConfig, parseViewBox } from './scale'
import { filterGlyphsByShape, filterGlyphsNearOutline } from './shapeHitTest'

type AspectPreset = 'custom' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16'

type MaskItem = {
  id: number
  seed: string
  svgText: string
  parsed: ParsedSvg
  baseGlyphs: GlyphInstance[]
  displayGlyphs: GlyphInstance[]
  pointer: { x: number; y: number } | null
  lastLayoutKey: string
}

const config: MaskConfig = {
  seed: 'pretext',
  renderMode: 'outline',
  width: 512,
  height: 512,
  fontFamily: 'Georgia',
  fontSize: 18,
  fontWeight: 700,
  glyphSpacing: 0,
  letterSpacing: 0,
  lineHeight: 24,
  padding: 0,
  glitchRate: 8,
  hoverRadius: 86,
  baseColor: '#111111',
  accentColor: '#16a34a',
}

let nextMaskId = 1
let masks: MaskItem[] = [createMaskItem(makeFallbackSvg())]
let aspectPreset: AspectPreset = '1:1'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app root.')
// ${numberInput('padding', 'Padding', config.padding, 0, 240, 1)}
app.innerHTML = `
  <main class="shell">
    <section class="control-panel" aria-label="Mask controls">
      <div class="brand">
        <span class="brand-mark">P</span>
        <div>
          <h1>Pretext Mask</h1>
          <p>Glyph masks from SVG shapes</p>
        </div>
      </div>

      <div class="field-grid">
        ${numberInput('width', 'Width', config.width, 128, 1600, 16)}
        ${numberInput('height', 'Height', config.height, 128, 1600, 16)}
        ${aspectControl(aspectPreset)}
        ${textInput('fontFamily', 'Font', config.fontFamily)}
        ${numberInput('fontSize', 'Font size', config.fontSize, 8, 80, 1)}
        ${numberInput('fontWeight', 'Font weight', config.fontWeight, 100, 900, 100)}
        ${numberInput('glyphSpacing', 'Letter spacing', config.glyphSpacing, -40, 80, 0.5)}
        ${numberInput('lineHeight', 'Line height', config.lineHeight, 4, 120, 1)}
        ${numberInput('hoverRadius', 'Hover radius', config.hoverRadius, 10, 240, 1)}
        ${modeControl(config.renderMode)}
        ${colorInput('baseColor', 'Base', config.baseColor)}
        ${colorInput('accentColor', 'Accent', config.accentColor)}
        ${sliderInput('glitchRate', 'Glitch rate', config.glitchRate, 0, 12, 1)}
      </div>

      <div id="status" class="status" role="status"></div>
    </section>

    <section class="preview-wrap" aria-label="Mask previews">
      <div id="gallery" class="gallery"></div>
      <button id="add-mask" class="add-mask" type="button">Add image box</button>
    </section>
  </main>
`

const gallery = document.querySelector<HTMLDivElement>('#gallery')
const status = document.querySelector<HTMLDivElement>('#status')
if (!gallery || !status) throw new Error('Missing UI nodes.')
const galleryNode = gallery
const statusNode = status

bindControls()
renderGallery()
relayoutAll(true)
requestAnimationFrame(animate)

function createMaskItem(svgText: string): MaskItem {
  const id = nextMaskId++
  return {
    id,
    seed: `pretext-${id}`,
    svgText,
    parsed: extractPathsFromSvgText(svgText),
    baseGlyphs: [],
    displayGlyphs: [],
    pointer: null,
    lastLayoutKey: '',
  }
}

function bindControls() {
  for (const key of Object.keys(config) as Array<keyof MaskConfig>) {
    const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${key}`)
    if (!input) continue

    input.addEventListener('input', () => {
      const current = config[key]
      if (typeof current === 'number') {
        config[key] = Number(input.value) as never
        updateOutputValue(key, input.value)
        if (key === 'width' || key === 'height') {
          aspectPreset = detectAspectPreset(config.width, config.height)
          syncAspectRadios()
        }
      } else {
        config[key] = input.value as never
      }
      relayoutAll()
    })
  }

  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="renderMode"]')) {
    input.addEventListener('change', () => {
      if (!input.checked) return
      config.renderMode = input.value as MaskConfig['renderMode']
      relayoutAll()
    })
  }

  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="aspectPreset"]')) {
    input.addEventListener('change', () => {
      if (!input.checked) return
      aspectPreset = input.value as AspectPreset
      applyAspectPreset(aspectPreset)
      relayoutAll()
    })
  }

  document.querySelector<HTMLButtonElement>('#add-mask')?.addEventListener('click', () => {
    masks.push(createMaskItem(makeFallbackSvg()))
    renderGallery()
    relayoutAll(true)
  })
}

function renderGallery() {
  galleryNode.replaceChildren()

  for (const mask of masks) {
    const card = document.createElement('article')
    card.className = 'mask-card'
    card.dataset.id = String(mask.id)
    card.innerHTML = `
      <canvas class="preview" role="img" aria-label="Generated glyph mask ${mask.id}"></canvas>
      <div class="mask-actions">
        <label class="card-action">
          <input type="file" accept=".svg,image/svg+xml" data-action="upload" />
          <span>Upload SVG</span>
        </label>
        <button class="card-action" type="button" data-action="export">Export PNG</button>
        ${masks.length > 1 ? '<button class="card-action" type="button" data-action="remove">Remove</button>' : ''}
      </div>
    `

    const canvas = card.querySelector<HTMLCanvasElement>('canvas')
    const upload = card.querySelector<HTMLInputElement>('input[data-action="upload"]')
    const exportButton = card.querySelector<HTMLButtonElement>('button[data-action="export"]')
    const removeButton = card.querySelector<HTMLButtonElement>('button[data-action="remove"]')

    canvas?.addEventListener('pointermove', event => {
      mask.pointer = clientPointToCanvasViewBox(mask, canvas, event.clientX, event.clientY)
    })
    canvas?.addEventListener('pointerleave', () => {
      mask.pointer = null
    })

    upload?.addEventListener('change', async event => {
      const input = event.currentTarget as HTMLInputElement
      const file = input.files?.[0]
      if (!file) return

      try {
        mask.svgText = await file.text()
        mask.parsed = extractPathsFromSvgText(mask.svgText)
        mask.lastLayoutKey = ''
        relayoutItem(mask, true)
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not parse SVG.')
      } finally {
        input.value = ''
      }
    })

    exportButton?.addEventListener('click', () => {
      exportMask(mask)
    })

    removeButton?.addEventListener('click', () => {
      masks = masks.filter(item => item.id !== mask.id)
      renderGallery()
      relayoutAll(true)
    })

    galleryNode.append(card)
  }
}

function relayoutAll(force = false) {
  for (const mask of masks) {
    relayoutItem(mask, force)
  }
  setStatus(`${masks.length} ${masks.length === 1 ? 'box' : 'boxes'}`)
}

function relayoutItem(mask: MaskItem, force = false) {
  const layoutKey = JSON.stringify({
    svgText: mask.svgText,
    seed: mask.seed,
    renderMode: config.renderMode,
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    fontWeight: config.fontWeight,
    glyphSpacing: config.glyphSpacing,
    letterSpacing: config.letterSpacing,
    lineHeight: config.lineHeight,
    padding: config.padding,
    width: config.width,
    height: config.height,
  })
  if (!force && layoutKey === mask.lastLayoutKey) return
  mask.lastLayoutKey = layoutKey

  mask.parsed = extractPathsFromSvgText(mask.svgText)
  const itemConfig = getMaskConfig(mask)
  const renderConfig = createRenderConfig(mask.parsed.viewBox, itemConfig)
  const denseGlyphs = layoutDenseGlyphField(mask.parsed.viewBox, renderConfig)

  if (config.renderMode === 'outline') {
    const outlineWidth = Math.max(renderConfig.fontSize * 1.45, renderConfig.lineHeight * 0.72)
    mask.baseGlyphs = filterGlyphsNearOutline(mask.parsed, denseGlyphs, outlineWidth)
  } else {
    mask.baseGlyphs = filterGlyphsByShape(mask.parsed, denseGlyphs, config.renderMode, renderConfig.fontSize * 0.75)
  }

  mask.displayGlyphs = mask.baseGlyphs
  drawMask(mask, mask.displayGlyphs)
}

function animate(timeMs: number) {
  for (const mask of masks) {
    const itemConfig = getMaskConfig(mask)
    const glitched = glitchGlyphs(mask.baseGlyphs, createRenderConfig(mask.parsed.viewBox, itemConfig), timeMs)
    mask.displayGlyphs = applyPointerColors(mask, glitched)
    drawMask(mask, mask.displayGlyphs)
  }
  requestAnimationFrame(animate)
}

function drawMask(mask: MaskItem, glyphs: readonly GlyphInstance[]) {
  const canvas = getMaskCanvas(mask)
  if (!canvas) return

  const pixelRatio = window.devicePixelRatio || 1
  const width = Math.max(1, config.width)
  const height = Math.max(1, config.height)
  canvas.width = Math.round(width * pixelRatio)
  canvas.height = Math.round(height * pixelRatio)
  canvas.style.maxWidth = `${width}px`
  canvas.style.aspectRatio = `${width} / ${height}`

  const context = canvas.getContext('2d')
  if (!context) return

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)

  const itemConfig = getMaskConfig(mask)
  const renderConfig = createRenderConfig(mask.parsed.viewBox, itemConfig)
  const transform = createViewBoxTransform(mask.parsed.viewBox, width, height)
  context.font = `${renderConfig.fontWeight} ${transform.scaleY(renderConfig.fontSize)}px ${renderConfig.fontFamily}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  for (const glyph of glyphs) {
    context.globalAlpha = glyph.opacity
    context.fillStyle = glyph.color
    context.fillText(glyph.char, transform.x(glyph.x), transform.y(glyph.y))
  }
  context.globalAlpha = 1
}

function applyPointerColors(mask: MaskItem, glyphs: readonly GlyphInstance[]): GlyphInstance[] {
  const pointerPosition = mask.pointer
  if (!pointerPosition) return glyphs.map(glyph => ({ ...glyph, color: config.baseColor }))

  return glyphs.map(glyph => {
    const renderConfig = createRenderConfig(mask.parsed.viewBox, getMaskConfig(mask))
    const distance = Math.hypot(glyph.x - pointerPosition.x, glyph.y - pointerPosition.y)
    if (distance > renderConfig.hoverRadius) return { ...glyph, color: config.baseColor }
    return { ...glyph, color: mixHex(config.accentColor, config.baseColor, distance / renderConfig.hoverRadius) }
  })
}

function exportMask(mask: MaskItem) {
  const canvas = getMaskCanvas(mask)
  canvas?.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pretext-mask-${mask.id}.png`
    link.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

function getMaskConfig(mask: MaskItem): MaskConfig {
  return { ...config, seed: mask.seed }
}

function getMaskCanvas(mask: MaskItem): HTMLCanvasElement | null {
  return galleryNode.querySelector<HTMLCanvasElement>(`.mask-card[data-id="${mask.id}"] canvas`)
}

function clientPointToCanvasViewBox(
  mask: MaskItem,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const box = parseViewBox(mask.parsed.viewBox)
  const xRatio = (clientX - rect.left) / rect.width
  const yRatio = (clientY - rect.top) / rect.height
  return {
    x: box.x + xRatio * box.width,
    y: box.y + yRatio * box.height,
  }
}

function createViewBoxTransform(viewBox: string, width: number, height: number) {
  const box = parseViewBox(viewBox)
  return {
    x(value: number) {
      return ((value - box.x) / box.width) * width
    },
    y(value: number) {
      return ((value - box.y) / box.height) * height
    },
    scaleY(value: number) {
      return (value / box.height) * height
    },
  }
}

function mixHex(a: string, b: string, amount: number): string {
  const left = hexToRgb(a)
  const right = hexToRgb(b)
  const t = Math.max(0, Math.min(1, amount))
  const channels = left.map((value, index) => Math.round(value * (1 - t) + right[index] * t))
  return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized.length === 3 ? normalized.split('').map(char => char + char).join('') : normalized, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function setStatus(message: string) {
  statusNode.textContent = message
}

function textInput(id: keyof MaskConfig, label: string, value: string): string {
  return `<label class="field"><span>${label}</span><input id="${id}" type="text" value="${escapeHtml(value)}" /></label>`
}

function numberInput(id: keyof MaskConfig, label: string, value: number, min: number, max: number, step: number): string {
  return `<label class="field"><span>${label}</span><input id="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" /></label>`
}

function sliderInput(id: keyof MaskConfig, label: string, value: number, min: number, max: number, step: number): string {
  return `<label class="field field-slider">
    <span>${label} <output id="${id}-value">${value}</output></span>
    <input id="${id}" type="range" value="${value}" min="${min}" max="${max}" step="${step}" />
  </label>`
}

function colorInput(id: keyof MaskConfig, label: string, value: string): string {
  return `<label class="field field-color"><span>${label}</span><input id="${id}" type="color" value="${value}" /></label>`
}

function updateOutputValue(key: keyof MaskConfig, value: string) {
  document.querySelector<HTMLOutputElement>(`#${key}-value`)?.replaceChildren(value)
}

function modeControl(value: MaskConfig['renderMode']): string {
  const option = (mode: MaskConfig['renderMode'], label: string) => `
    <label class="mode-option">
      <input type="radio" name="renderMode" value="${mode}"${value === mode ? ' checked' : ''} />
      <span>${label}</span>
    </label>`

  return `<div class="field field-block">
    <span>Mode</span>
    <div class="mode-toggle" role="radiogroup" aria-label="Render mode">
      ${option('outline', 'Outline')}
      ${option('inside', 'Inside')}
      ${option('outside', 'Outside')}
    </div>
  </div>`
}

function aspectControl(value: AspectPreset): string {
  const option = (preset: AspectPreset, label: string) => `
    <label class="mode-option">
      <input type="radio" name="aspectPreset" value="${preset}"${value === preset ? ' checked' : ''} />
      <span>${label}</span>
    </label>`

  return `<div class="field field-block">
    <span>Aspect ratio</span>
    <div class="mode-toggle aspect-toggle" role="radiogroup" aria-label="Aspect ratio">
      ${option('custom', 'Free')}
      ${option('1:1', '1:1')}
      ${option('4:3', '4:3')}
      ${option('3:4', '3:4')}
      ${option('16:9', '16:9')}
      ${option('9:16', '9:16')}
    </div>
  </div>`
}

function applyAspectPreset(preset: AspectPreset) {
  if (preset === 'custom') return

  const [widthRatio, heightRatio] = preset.split(':').map(value => Number.parseInt(value, 10))
  const longestSide = Math.max(config.width, config.height)

  if (widthRatio >= heightRatio) {
    config.width = longestSide
    config.height = Math.round((longestSide * heightRatio) / widthRatio)
  } else {
    config.height = longestSide
    config.width = Math.round((longestSide * widthRatio) / heightRatio)
  }

  syncDimensionInputs()
}

function detectAspectPreset(width: number, height: number): AspectPreset {
  const presets: AspectPreset[] = ['1:1', '4:3', '3:4', '16:9', '9:16']
  const ratio = width / height
  return presets.find(preset => {
    const [presetWidth, presetHeight] = preset.split(':').map(value => Number.parseInt(value, 10))
    return Math.abs(ratio - presetWidth / presetHeight) < 0.01
  }) ?? 'custom'
}

function syncDimensionInputs() {
  const widthInput = document.querySelector<HTMLInputElement>('#width')
  const heightInput = document.querySelector<HTMLInputElement>('#height')
  if (widthInput) widthInput.value = String(config.width)
  if (heightInput) heightInput.value = String(config.height)
}

function syncAspectRadios() {
  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="aspectPreset"]')) {
    input.checked = input.value === aspectPreset
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}
