# AGENTS.md

Project: Pretext Mask. Vite + TypeScript core library plus browser demo for seeded glyph masks from SVG shapes.

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm test`
- Build: `npm run build`

Run tests/build before final handoff after code changes.

## Architecture

- `src/lib/`: reusable core parsing, layout, scaling, hit-testing, seeded randomness, fallback SVG, and exported types.
- `src/lib/index.ts`: public library barrel.
- `src/demo/main.ts`: shared settings UI, multi-box gallery state, canvas render loop, per-box PNG export.
- `src/demo/styles.css`: demo-only styling.
- `src/lib/glyphLayout.ts`: seeded glyph stream, Pretext measurement/layout, row placement, glitch remapping.
- `src/lib/svgExtract.ts`: parses uploaded SVG and normalizes visible geometry to path data.
- `src/lib/shapeHitTest.ts`: reusable SVG-based hit tester for `outline`, `inside`, `outside`.
- `src/lib/scale.ts`: converts pixel-facing controls into SVG viewBox units.
- `src/lib/random.ts`: deterministic seeded PRNG and glyph stream helpers.
- `src/lib/types.ts`: shared config/data types.

Preview/export are canvas/PNG only. SVG is still used internally for parsing and path hit-testing.

## Current Behavior

- Default SVG: GitHub icon from Icons8-style SVG.
- Users can add multiple image boxes; all boxes share the same settings.
- Each box has its own SVG upload and PNG export controls in the preview area.
- Render modes:
  - `outline`: horizontal glyph rows filtered near the SVG stroke.
  - `inside`: horizontal glyph rows kept when sampled glyph area overlaps filled shape.
  - `outside`: horizontal glyph rows kept outside filled shape.
- Glyphs are upright, not tangent-rotated.
- Glitch animation remaps every glyph each bucket; no canonical fallback.
- Hover color uses pointer distance in SVG viewBox coordinates.
- `Letter spacing = 0` means natural measured glyph spacing; positive spreads; negative overlaps.
- `Padding` controls row top/bottom bounds manually.
- Seed is internal per box, not exposed in the UI.

## Implementation Notes

- Keep repo style: vanilla TypeScript modules, no framework.
- Prefer canvas drawing for preview. Avoid adding one DOM/SVG node per glyph.
- Keep exported format PNG unless explicitly requested otherwise.
- Preserve deterministic output for same internal seed/config/SVG.
- Control values are user-facing pixels. Use `createRenderConfig` before layout/hit radius math.
- SVG upload should remain client-side only.
- Hit-testing uses hidden SVG path APIs; do not replace with clipping masks unless requested.

## Design Notes

- UI is intentionally minimal black/white/grey.
- Sidebar is on the right on desktop, top on mobile.
- SVG upload belongs in each preview card, not the sidebar.
- Avoid decorative UI effects; keep controls dense and direct.

## Caution

- This project has evolved through visual tuning. Before changing row placement/filtering, inspect:
  - default GitHub SVG `viewBox="0 0 50 50"`
  - canvas coordinate transform in `src/demo/main.ts`
  - glyph placement in `layoutDenseGlyphFieldFromLines`
  - hit-test sampling in `createShapeHitTester`
