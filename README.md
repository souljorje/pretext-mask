# Pretext Mask

Seeded glyph mask generator for SVG shapes. Upload an SVG, choose how glyphs relate to the shape, preview on canvas, and export PNG.

## Features

- Deterministic seed-based glyph generation
- Canvas rendering for high glyph counts
- PNG export
- Modes: `Outline`, `Inside`, `Outside`
- Aspect presets: `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, free sizing
- Glitch animation
- Cursor-proximity accent color
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
```

## How It Works

The app parses visible SVG geometry into paths, generates deterministic glyph rows from a seed, then filters glyph positions against the shape:

- `Outline`: keeps glyphs near the SVG outline.
- `Inside`: keeps glyphs overlapping the filled shape.
- `Outside`: keeps glyphs outside the filled shape.

Rendering happens on one canvas. SVG is used only for parsing and hit-testing.

## Controls

- `Width` / `Height`: output PNG size.
- `Aspect`: quick width/height presets.
- `Font size` / `Weight`: glyph typography.
- `Letter spacing`: `0` is natural measured spacing; positive spreads; negative overlaps.
- `Line height`: distance between glyph rows.
- `Padding`: pushes rows inward; negative values allow bleed.
- `Glitch rate`: animation speed, `0` disables.
- `Hover radius`: cursor color influence.
- `Base` / `Accent`: normal and hover colors.

## Notes

Output is PNG only. Same SVG, seed, and settings should produce the same static layout.

Seed is internal per image box. The UI does not expose seed editing.
