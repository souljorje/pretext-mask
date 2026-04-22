import './styles.css'
import type { GlyphInstance, MaskConfig, ParsedSvg } from './types'
import { extractPathsFromSvgText } from './svgExtract'
import { glitchGlyphs, layoutDenseGlyphField } from './glyphLayout'
import { makeFallbackSvg } from './svgSampler'
import { createRenderConfig } from './scale'
import { parseViewBox } from './scale'
import { filterGlyphsByShape, filterGlyphsNearOutline } from './shapeHitTest'

type AspectPreset = 'custom' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16'

const config: MaskConfig = {
  seed: 'pretext-001',
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

let svgText = makeFallbackSvg()
let parsed: ParsedSvg = extractPathsFromSvgText(svgText)
let baseGlyphs: GlyphInstance[] = []
let displayGlyphs: GlyphInstance[] = []
let pointer: { x: number; y: number } | null = null
let lastLayoutKey = ''
let aspectPreset: AspectPreset = '1:1'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app root.')

app.innerHTML = `
  <main class="shell">
    <section class="control-panel" aria-label="Mask controls">
      <div class="brand">
        <span class="brand-mark">P</span>
        <div>
          <h1>Pretext Mask</h1>
          <p>Seeded glyph masks for SVGs</p>
        </div>
      </div>

      <label class="file-picker">
        <input id="svg-upload" type="file" accept=".svg,image/svg+xml" />
        <span>Upload SVG</span>
      </label>

      <div class="field-grid">
        ${modeControl(config.renderMode)}
        ${aspectControl(aspectPreset)}
        ${textInput('seed', 'Seed', config.seed)}
        ${numberInput('width', 'Width', config.width, 128, 1600, 16)}
        ${numberInput('height', 'Height', config.height, 128, 1600, 16)}
        ${textInput('fontFamily', 'Font', config.fontFamily)}
        ${numberInput('fontSize', 'Font size', config.fontSize, 8, 80, 1)}
        ${numberInput('fontWeight', 'Weight', config.fontWeight, 100, 900, 100)}
        ${numberInput('glyphSpacing', 'Letter spacing', config.glyphSpacing, -40, 80, 0.5)}
        ${numberInput('lineHeight', 'Line height', config.lineHeight, 4, 120, 1)}
        ${numberInput('padding', 'Padding', config.padding, -120, 240, 1)}
        ${sliderInput('glitchRate', 'Glitch rate', config.glitchRate, 0, 12, 1)}
        ${numberInput('hoverRadius', 'Hover radius', config.hoverRadius, 10, 240, 1)}
        ${colorInput('baseColor', 'Base', config.baseColor)}
        ${colorInput('accentColor', 'Accent', config.accentColor)}
      </div>

      <button id="export-png" class="primary-action" type="button">Export PNG</button>
      <div id="status" class="status" role="status"></div>
    </section>

    <section class="preview-wrap" aria-label="Mask preview">
      <canvas id="preview" class="preview" role="img" aria-label="Generated glyph mask"></canvas>
    </section>
  </main>
`

const preview = document.querySelector<HTMLCanvasElement>('#preview')
const status = document.querySelector<HTMLDivElement>('#status')
if (!preview || !status) throw new Error('Missing UI nodes.')
const previewCanvas = preview
const statusNode = status

bindControls()
relayout()
requestAnimationFrame(animate)

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
      relayout()
    })
  }

  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="renderMode"]')) {
    input.addEventListener('change', () => {
      if (!input.checked) return
      config.renderMode = input.value as MaskConfig['renderMode']
      relayout()
    })
  }

  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="aspectPreset"]')) {
    input.addEventListener('change', () => {
      if (!input.checked) return
      aspectPreset = input.value as AspectPreset
      applyAspectPreset(aspectPreset)
      relayout()
    })
  }

  document.querySelector<HTMLInputElement>('#svg-upload')?.addEventListener('change', async event => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    svgText = await file.text()
    try {
      parsed = extractPathsFromSvgText(svgText)
      relayout(true)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not parse SVG.')
    }
  })

  document.querySelector<HTMLButtonElement>('#export-png')?.addEventListener('click', () => {
    previewCanvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pretext-mask-${config.seed || 'seed'}.png`
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  })

  previewCanvas.addEventListener('pointermove', event => {
    const point = clientPointToCanvasViewBox(event.clientX, event.clientY)
    pointer = point
  })
  previewCanvas.addEventListener('pointerleave', () => {
    pointer = null
  })
}

function relayout(force = false) {
  const layoutKey = JSON.stringify({
    parsed,
    seed: config.seed,
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
  if (!force && layoutKey === lastLayoutKey) return
  lastLayoutKey = layoutKey

  parsed = extractPathsFromSvgText(svgText)
  const renderConfig = createRenderConfig(parsed.viewBox, config)
  if (config.renderMode === 'outline') {
    const outlineWidth = Math.max(renderConfig.fontSize * 1.45, renderConfig.lineHeight * 0.72)
    baseGlyphs = filterGlyphsNearOutline(parsed, layoutDenseGlyphField(parsed.viewBox, renderConfig), outlineWidth)
  } else {
    baseGlyphs = filterGlyphsByShape(
      parsed,
      layoutDenseGlyphField(parsed.viewBox, renderConfig),
      config.renderMode,
      renderConfig.fontSize * 0.75,
    )
  }
  displayGlyphs = baseGlyphs
  draw(displayGlyphs)
  setStatus(`${config.renderMode}, ${parsed.paths.length} paths, ${baseGlyphs.length} glyphs`)
}

function animate(timeMs: number) {
  const glitched = glitchGlyphs(baseGlyphs, createRenderConfig(parsed.viewBox, config), timeMs)
  displayGlyphs = applyPointerColors(glitched)
  draw(displayGlyphs)
  requestAnimationFrame(animate)
}

function draw(glyphs: readonly GlyphInstance[]) {
  const pixelRatio = window.devicePixelRatio || 1
  const width = Math.max(1, config.width)
  const height = Math.max(1, config.height)
  previewCanvas.width = Math.round(width * pixelRatio)
  previewCanvas.height = Math.round(height * pixelRatio)
  previewCanvas.style.maxWidth = `${width}px`
  previewCanvas.style.aspectRatio = `${width} / ${height}`

  const context = previewCanvas.getContext('2d')
  if (!context) return

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)

  const renderConfig = createRenderConfig(parsed.viewBox, config)
  const transform = createViewBoxTransform(parsed.viewBox, width, height)
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

function applyPointerColors(glyphs: readonly GlyphInstance[]): GlyphInstance[] {
  const pointerPosition = pointer
  if (!pointerPosition) return glyphs.map(glyph => ({ ...glyph, color: config.baseColor }))

  return glyphs.map(glyph => {
    const renderConfig = createRenderConfig(parsed.viewBox, config)
    const distance = Math.hypot(glyph.x - pointerPosition.x, glyph.y - pointerPosition.y)
    if (distance > renderConfig.hoverRadius) return { ...glyph, color: config.baseColor }
    return { ...glyph, color: mixHex(config.accentColor, config.baseColor, distance / renderConfig.hoverRadius) }
  })
}

function clientPointToCanvasViewBox(clientX: number, clientY: number): { x: number; y: number } {
  const rect = previewCanvas.getBoundingClientRect()
  const box = parseViewBox(parsed.viewBox)
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

  return `<div class="field field-mode">
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

  return `<div class="field field-mode">
    <span>Aspect</span>
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
