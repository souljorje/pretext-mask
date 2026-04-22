# Pretext Mask

Seeded glyph mask generator for SVG shapes. Upload an SVG, choose how generated text relates to the shape, preview on canvas, and export PNG.

## Features

- Deterministic seed-based text generation
- Pretext-powered run layout through SVG-derived row segments
- Fast static canvas rendering with one `fillText()` per run
- Lazy glyph materialization for hover/glitch effects
- PNG export
- Modes: `Outline`, `Inside`, `Outside`
- Aspect presets: `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, free sizing
- Font, weight, spacing, line height, padding, color controls

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000/`.

## Build And Test

```bash
npm test
npm run build
npm run smoke
```

## Structure

- `src/lib`: reusable mask-generation core.
- `src/demo`: Vite UI playground.
- `src/lib/index.ts`: public library exports.

Core modules:

- `src/lib/runLayout.ts`: creates `MaskRenderPlan` from SVG geometry, config, and generated/caller text.
- `src/lib/renderer.ts`: run-first canvas renderer with effect hooks.
- `src/lib/effects.ts`: sample effects, including tested typing behavior.
- `src/lib/shapeHitTest.ts`: reusable hidden-SVG path hit tester.
- `src/lib/svgExtract.ts`: parses uploaded SVG into normalized path data.
- `src/lib/glyphLayout.ts`: compatibility glyph APIs, measurement helpers, and glitch helpers.

## How It Works

The current core path is run-first:

1. Parse visible SVG geometry into paths.
2. Fit the SVG viewBox into the requested output frame using width, height, and padding.
3. Sample each text row into horizontal SVG-bounded spans.
4. Prepare generated seeded text with Pretext.
5. Route text through the spans with `layoutNextLine()`.
6. Render unaffected runs with `ctx.fillText(run.text, run.x, run.y)`.
7. Materialize glyphs only when an effect needs per-glyph drawing.

Render modes:

- `Outline`: routes runs through spans near the SVG stroke.
- `Inside`: routes runs through spans overlapping the filled shape.
- `Outside`: routes runs through spans outside the filled shape.

## Controls

- `Width` / `Height`: output PNG size and fitted SVG bounds.
- `Aspect`: quick width/height presets.
- `Font size` / `Weight`: text typography.
- `Letter spacing`: passed to Pretext and canvas run rendering; effects use glyph fallback where needed.
- `Line height`: distance between sampled text rows.
- `Padding`: insets or expands the fitted SVG bounds.
- `Glitch rate`: animation speed, `0` disables.
- `Hover radius`: cursor color influence.
- `Base` / `Accent`: normal and hover colors.

## Notes

Output is PNG only. Same SVG, seed, and layout settings should produce the same static plan.

Seed is internal per image box. The UI does not expose seed editing.

Animations are separate from core layout. Static rendering stays run-level; hover and glitch opt into glyph-level drawing only when needed.
