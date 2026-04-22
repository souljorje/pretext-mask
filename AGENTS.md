# AGENTS.md

Project: Pretext Mask. Vite + TypeScript core library plus browser demo for seeded text masks from SVG shapes.

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm test`
- Smoke: `npm run smoke`
- Build: `npm run build`

Run tests/build before final handoff after code changes.

## Architecture

- `src/lib/`: reusable core parsing, run layout, canvas rendering, scaling, hit-testing, seeded randomness, fallback SVG, and exported types.
- `src/lib/index.ts`: public library barrel.
- `src/demo/main.ts`: shared settings UI, multi-box gallery state, canvas render loop, per-box PNG export.
- `src/demo/styles.css`: demo-only styling.
- `src/lib/runLayout.ts`: run-first core planner. Fits SVG bounds into the output frame, samples row spans, prepares generated/caller text with Pretext, and routes text through spans.
- `src/lib/renderer.ts`: canvas renderer for `MaskRenderPlan`; draws static runs directly and materializes glyphs only when effects request it.
- `src/lib/effects.ts`: sample effect helpers such as typing behavior.
- `src/lib/glyphLayout.ts`: compatibility glyph APIs, Pretext measurement helpers, glyph spacing, and glitch remapping.
- `src/lib/svgExtract.ts`: parses uploaded SVG and normalizes visible geometry to path data.
- `src/lib/shapeHitTest.ts`: reusable hidden-SVG path hit tester for `outline`, `inside`, `outside`; exposes point predicates and legacy glyph filters.
- `src/lib/scale.ts`: converts pixel-facing controls into SVG viewBox units.
- `src/lib/random.ts`: deterministic seeded PRNG and glyph stream helpers.
- `src/lib/types.ts`: shared config/data types.

Preview/export are canvas/PNG only. SVG is still used internally for parsing and path hit-testing.

## Current Behavior

- Default SVG: GitHub icon from Icons8-style SVG.
- Users can add multiple image boxes; all boxes share the same settings.
- Each box has its own SVG upload and PNG export controls in the preview area.
- Render modes:
  - `outline`: text runs routed through sampled spans near the SVG stroke.
  - `inside`: text runs routed through sampled spans overlapping the filled shape.
  - `outside`: text runs routed through sampled spans outside the filled shape.
- Glyphs are upright, not tangent-rotated.
- Static rendering is run-level: `fillText(run.text, run.x, run.y)`.
- Hover/glitch are effect concerns. They materialize glyphs only for affected runs, or all runs while global glitch is active.
- `Letter spacing = 0` means natural measured spacing; positive spreads; negative overlaps. It is passed to Pretext and canvas run rendering.
- `Padding` affects fitted SVG bounds inside the output frame.
- Seed is internal per box, not exposed in the UI.

## Implementation Notes

- Keep repo style: vanilla TypeScript modules, no framework.
- Prefer canvas drawing for preview. Avoid adding one DOM/SVG node per glyph.
- Prefer the `MaskRenderPlan` path for new behavior. Keep legacy glyph APIs exported for compatibility, but do not route demo work through them.
- Keep exported format PNG unless explicitly requested otherwise.
- Preserve deterministic output for same internal seed/config/SVG.
- Control values are user-facing pixels. `createMaskRenderPlan` fits SVG bounds into the output frame and converts hit-test samples internally.
- SVG upload should remain client-side only.
- Hit-testing uses hidden SVG path APIs; do not replace with clipping masks unless requested.
- Animation should stay separate from core layout. Use renderer/effect hooks instead of relayouting for hover, typing, or glitch.

## Design Notes

- UI is intentionally minimal black/white/grey.
- Sidebar is on the right on desktop, top on mobile.
- SVG upload belongs in each preview card, not the sidebar.
- Avoid decorative UI effects; keep controls dense and direct.

## Caution

- This project has evolved through visual tuning. Before changing row placement/filtering, inspect:
  - default GitHub SVG `viewBox="0 0 50 50"`
  - canvas coordinate transform in `src/demo/main.ts`
  - SVG fitting and row sampling in `createShapeRowSegments`
  - Pretext run routing in `createMaskRenderPlan`
  - glyph materialization fallback in `MaskRenderPlan.materializeGlyphs`
  - hit-test sampling in `createShapeHitTester`
