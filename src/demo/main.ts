import './styles.css'
import type { MaskConfig, MaskRenderPlan, ParsedSvg, ShapeHitTester, TextRun, TextRunGlyph } from '../lib'
import {
  createMaskRenderPlan,
  createShapeHitTester,
  extractPathsFromSvgText,
  canUseCanvasLetterSpacing,
  getGlitchBucket,
  getGlitchedGlyphChar,
  makeFallbackSvg,
  quoteFontFamily,
  setCanvasLetterSpacing,
} from '../lib'

type AspectPreset = 'custom' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16'
type ThemeMode = 'light' | 'dark'
type Point = { x: number; y: number }
type CanvasState = {
  pixelRatio: number
  pixelWidth: number
  pixelHeight: number
  width: number
  height: number
}

type MaskItem = {
  id: number
  seed: string
  svgText: string
  svgVersion: number
  parsed: ParsedSvg
  hitTester: ShapeHitTester
  renderPlan: MaskRenderPlan | null
  pointer: Point | null
  canvas: HTMLCanvasElement | null
  canvasState: CanvasState | null
  lastLayoutKey: string
  lastGlitchBucket: number | null
  dirty: boolean
}

const RELAYOUT_DEBOUNCE_MS = 80
const THEME_STORAGE_KEY = 'pretext-mask-theme'
const DEFAULT_LIGHT_BASE_COLOR = '#111111'
const DEFAULT_DARK_BASE_COLOR = '#eeeeee'
const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

const config: MaskConfig = {
  seed: 'pretext',
  renderMode: 'outline',
  width: 512,
  height: 512,
  fontFamily: 'Georgia',
  fontSize: 12,
  fontWeight: 700,
  glyphSpacing: 0,
  lineHeight: 16,
  padding: 0,
  glitchRate: 4,
  hoverRadius: 100,
  baseColor: DEFAULT_LIGHT_BASE_COLOR,
  accentColor: '#16a34a',
}

const layoutKeys = new Set<keyof MaskConfig>([
  'width',
  'height',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'glyphSpacing',
  'lineHeight',
  'padding',
])

let nextMaskId = 1
let masks: MaskItem[] = [createMaskItem(makeFallbackSvg())]
let aspectPreset: AspectPreset = '1:1'
let relayoutTimer: number | null = null
let pendingRelayoutForce = false
let activeTheme: ThemeMode | null = null

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app root.')

initTheme()

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

      <button id="theme-toggle" class="theme-toggle" type="button" aria-pressed="false">
        <span class="theme-toggle-label">Dark mode</span>
        <span class="theme-toggle-track" aria-hidden="true"><span></span></span>
      </button>

      <div class="field-grid">
        ${numberInput('width', 'Width', config.width, 128, 1600, 16)}
        ${numberInput('height', 'Height', config.height, 128, 1600, 16)}
        ${aspectControl(aspectPreset)}
        ${textInput('fontFamily', 'Font', config.fontFamily)}
        ${numberInput('fontSize', 'Font size', config.fontSize, 1, 80, 1)}
        ${numberInput('glyphSpacing', 'Letter spacing', config.glyphSpacing, -40, 80, 0.5)}
        ${numberInput('lineHeight', 'Line height', config.lineHeight, 1, 120, 1)}
        ${numberInput('fontWeight', 'Font weight', config.fontWeight, 100, 900, 100)}
        ${numberInput('padding', 'Padding', config.padding, -240, 240, 1)}
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

syncThemeToggle()
bindControls()
renderGallery()
relayoutAll(true)
requestAnimationFrame(animate)
window.addEventListener('beforeunload', () => masks.forEach(mask => mask.hitTester.dispose()))

function initTheme() {
  applyTheme(readStoredTheme() ?? getSystemTheme())
  themeMediaQuery.addEventListener('change', event => {
    if (readStoredTheme()) return
    applyTheme(event.matches ? 'dark' : 'light')
  })
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  syncThemeDefaultColors(theme)
  activeTheme = theme
  syncThemeToggle()
}

function storeTheme(theme: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    return
  }
}

function readStoredTheme(): ThemeMode | null {
  try {
    const theme = localStorage.getItem(THEME_STORAGE_KEY)
    return theme === 'light' || theme === 'dark' ? theme : null
  } catch {
    return null
  }
}

function getSystemTheme(): ThemeMode {
  return themeMediaQuery.matches ? 'dark' : 'light'
}

function toggleTheme() {
  const nextTheme: ThemeMode = activeTheme === 'dark' ? 'light' : 'dark'
  applyTheme(nextTheme)
  storeTheme(nextTheme)
  markAllDirty()
}

function syncThemeToggle() {
  const toggle = document.querySelector<HTMLButtonElement>('#theme-toggle')
  if (!toggle || !activeTheme) return

  const isDark = activeTheme === 'dark'
  toggle.setAttribute('aria-pressed', String(isDark))
}

function syncThemeDefaultColors(theme: ThemeMode) {
  const previousDefault = activeTheme === 'dark' ? DEFAULT_DARK_BASE_COLOR : DEFAULT_LIGHT_BASE_COLOR
  const nextDefault = theme === 'dark' ? DEFAULT_DARK_BASE_COLOR : DEFAULT_LIGHT_BASE_COLOR
  if (activeTheme !== null && config.baseColor.toLowerCase() !== previousDefault) return

  config.baseColor = nextDefault
  const input = document.querySelector<HTMLInputElement>('#baseColor')
  if (input) input.value = nextDefault
  markAllDirty()
}

function createMaskItem(svgText: string): MaskItem {
  const id = nextMaskId++
  const parsed = extractPathsFromSvgText(svgText)
  return {
    id,
    seed: `pretext-${id}`,
    svgText,
    svgVersion: 0,
    parsed,
    hitTester: createShapeHitTester(parsed),
    renderPlan: null,
    pointer: null,
    canvas: null,
    canvasState: null,
    lastLayoutKey: '',
    lastGlitchBucket: null,
    dirty: true,
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

      if (layoutKeys.has(key)) {
        scheduleRelayoutAll()
      } else {
        markAllDirty()
      }
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

  document.querySelector<HTMLButtonElement>('#theme-toggle')?.addEventListener('click', toggleTheme)
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

    mask.canvas = canvas
    mask.canvasState = null

    canvas?.addEventListener('pointermove', event => {
      setPointer(mask, clientPointToCanvasPoint(canvas, event.clientX, event.clientY))
    })
    canvas?.addEventListener('pointerleave', () => {
      setPointer(mask, null)
    })

    upload?.addEventListener('change', async event => {
      const input = event.currentTarget as HTMLInputElement
      const file = input.files?.[0]
      if (!file) return

      try {
        const svgText = await file.text()
        const parsed = extractPathsFromSvgText(svgText)
        mask.hitTester.dispose()
        mask.svgText = svgText
        mask.svgVersion += 1
        mask.parsed = parsed
        mask.hitTester = createShapeHitTester(parsed)
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
      mask.hitTester.dispose()
      masks = masks.filter(item => item.id !== mask.id)
      renderGallery()
      relayoutAll(true)
    })

    galleryNode.append(card)
  }
}

function relayoutAll(force = false) {
  clearPendingRelayout()
  for (const mask of masks) {
    relayoutItem(mask, force)
  }
  setStatus(`${masks.length} ${masks.length === 1 ? 'box' : 'boxes'}`)
}

function scheduleRelayoutAll(force = false) {
  pendingRelayoutForce ||= force
  if (relayoutTimer !== null) window.clearTimeout(relayoutTimer)

  relayoutTimer = window.setTimeout(() => {
    const shouldForce = pendingRelayoutForce
    clearPendingRelayout()
    relayoutAll(shouldForce)
  }, RELAYOUT_DEBOUNCE_MS)
}

function clearPendingRelayout() {
  if (relayoutTimer !== null) {
    window.clearTimeout(relayoutTimer)
    relayoutTimer = null
  }
  pendingRelayoutForce = false
}

function relayoutItem(mask: MaskItem, force = false) {
  const layoutKey = JSON.stringify({
    svgVersion: mask.svgVersion,
    seed: mask.seed,
    renderMode: config.renderMode,
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    fontWeight: config.fontWeight,
    glyphSpacing: config.glyphSpacing,
    lineHeight: config.lineHeight,
    padding: config.padding,
    width: config.width,
    height: config.height,
  })
  if (!force && layoutKey === mask.lastLayoutKey) return
  mask.lastLayoutKey = layoutKey

  mask.renderPlan = createMaskRenderPlan(mask.parsed, mask.hitTester, getMaskConfig(mask))
  markDirty(mask)
}

function animate(timeMs: number) {
  for (const mask of masks) {
    const bucket = getGlitchBucket(getMaskConfig(mask), timeMs)
    if (bucket !== mask.lastGlitchBucket) {
      mask.lastGlitchBucket = bucket
      if (bucket !== null) markDirty(mask)
    }

    if (!mask.dirty) continue
    drawMask(mask, bucket)
    mask.dirty = false
  }

  requestAnimationFrame(animate)
}

function drawMask(mask: MaskItem, glitchBucket: number | null) {
  const canvas = mask.canvas
  if (!canvas) return

  const context = prepareCanvas(mask, canvas)
  if (!context) return

  const width = Math.max(1, config.width)
  const height = Math.max(1, config.height)
  context.clearRect(0, 0, width, height)
  context.fillStyle = getCanvasBackgroundColor()
  context.fillRect(0, 0, width, height)

  const renderConfig = getMaskConfig(mask)
  const plan = mask.renderPlan
  if (!plan) return

  context.font = plan.font || `${renderConfig.fontWeight} ${renderConfig.fontSize}px ${quoteFontFamily(renderConfig.fontFamily)}`
  context.textAlign = 'left'
  context.textBaseline = 'middle'

  const pointer = mask.pointer
  const baseRgb = hexToRgb(config.baseColor)
  const accentRgb = hexToRgb(config.accentColor)
  const canDrawSpacedRuns = renderConfig.glyphSpacing === 0 || canUseCanvasLetterSpacing(context)

  if (!pointer && glitchBucket === null && canDrawSpacedRuns) {
    setCanvasLetterSpacing(context, plan.letterSpacing)
    context.fillStyle = config.baseColor
    for (const run of plan.runs) {
      context.fillText(run.text, run.x, run.y)
    }
    return
  }

  for (const run of plan.runs) {
    if (glitchBucket === null && pointer && canDrawSpacedRuns && !runIntersectsPointer(run, pointer, renderConfig)) {
      context.textAlign = 'left'
      setCanvasLetterSpacing(context, plan.letterSpacing)
      context.fillStyle = config.baseColor
      context.fillText(run.text, run.x, run.y)
      continue
    }

    drawGlyphRun(context, plan.materializeGlyphs(run), renderConfig, pointer, baseRgb, accentRgb, glitchBucket)
  }
}

function prepareCanvas(mask: MaskItem, canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const pixelRatio = window.devicePixelRatio || 1
  const width = Math.max(1, config.width)
  const height = Math.max(1, config.height)
  const pixelWidth = Math.round(width * pixelRatio)
  const pixelHeight = Math.round(height * pixelRatio)
  const nextState = { pixelRatio, pixelWidth, pixelHeight, width, height }

  if (!sameCanvasState(mask.canvasState, nextState)) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
    canvas.style.width = `min(100%, ${width}px)`
    canvas.style.aspectRatio = `${width} / ${height}`
    mask.canvasState = nextState
  }

  const context = canvas.getContext('2d')
  if (!context) return null
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  return context
}

function sameCanvasState(left: CanvasState | null, right: CanvasState): boolean {
  return (
    !!left &&
    left.pixelRatio === right.pixelRatio &&
    left.pixelWidth === right.pixelWidth &&
    left.pixelHeight === right.pixelHeight &&
    left.width === right.width &&
    left.height === right.height
  )
}

function exportMask(mask: MaskItem) {
  if (relayoutTimer !== null) {
    const shouldForce = pendingRelayoutForce
    clearPendingRelayout()
    relayoutAll(shouldForce)
  }

  drawMask(mask, getGlitchBucket(getMaskConfig(mask), performance.now()))
  mask.dirty = false
  mask.canvas?.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pretext-mask-${mask.id}.png`
    link.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

function getCanvasBackgroundColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#ffffff'
}

function getMaskConfig(mask: MaskItem): MaskConfig {
  return { ...config, seed: mask.seed }
}

function setPointer(mask: MaskItem, pointer: Point | null) {
  if (samePoint(mask.pointer, pointer)) return
  mask.pointer = pointer
  markDirty(mask)
}

function samePoint(left: Point | null, right: Point | null): boolean {
  return left?.x === right?.x && left?.y === right?.y
}

function markDirty(mask: MaskItem) {
  mask.dirty = true
}

function markAllDirty() {
  for (const mask of masks) {
    markDirty(mask)
  }
}

function clientPointToCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect()
  const xRatio = (clientX - rect.left) / rect.width
  const yRatio = (clientY - rect.top) / rect.height
  return {
    x: xRatio * config.width,
    y: yRatio * config.height,
  }
}

function runIntersectsPointer(run: TextRun, pointer: Point, renderConfig: MaskConfig): boolean {
  const radius = renderConfig.hoverRadius
  const halfLine = renderConfig.lineHeight / 2
  return (
    pointer.x >= run.x - radius &&
    pointer.x <= run.x + run.width + radius &&
    pointer.y >= run.y - radius - halfLine &&
    pointer.y <= run.y + radius + halfLine
  )
}

function drawGlyphRun(
  context: CanvasRenderingContext2D,
  glyphs: readonly TextRunGlyph[],
  renderConfig: MaskConfig,
  pointer: Point | null,
  baseRgb: [number, number, number],
  accentRgb: [number, number, number],
  glitchBucket: number | null,
) {
  context.textAlign = 'center'
  setCanvasLetterSpacing(context, 0)

  for (const glyph of glyphs) {
    if (!pointer) {
      context.fillStyle = config.baseColor
    } else {
      const distance = Math.hypot(glyph.x - pointer.x, glyph.y - pointer.y)
      context.fillStyle =
        distance > renderConfig.hoverRadius
          ? config.baseColor
          : mixRgb(accentRgb, baseRgb, distance / renderConfig.hoverRadius)
    }

    context.fillText(getGlitchedGlyphChar(glyph, renderConfig, glitchBucket), glyph.x, glyph.y)
  }
}

function mixRgb(a: [number, number, number], b: [number, number, number], amount: number): string {
  const t = Math.max(0, Math.min(1, amount))
  const channels = a.map((value, index) => Math.round(value * (1 - t) + b[index] * t))
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
