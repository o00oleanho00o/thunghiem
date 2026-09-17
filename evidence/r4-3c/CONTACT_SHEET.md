# R4.3c Visual Evidence Contact Sheet

Branch: `cnb-electrical-lab-r4-3c-runtime-correctness-visual-gate`
Commit under test: `800fce7`
Generated: 2026-09-17

`CONTACT_SHEET.png` contains the key browser-runtime screenshots, grouped by
Cabinet and mlightcad. Thumbnails are intentionally large enough to inspect the
runtime panel and the main geometry at a glance.

## Cabinet

1. `cabinet/01-before-reflow-unlocked.png` - unlocked fixture baseline.
2. `cabinet/02-after-reflow-unlocked-moved.png` - unlocked differential move.
3. `cabinet/03-before-reflow-locked.png` - lock state before reflow.
4. `cabinet/04-after-reflow-locked-unchanged.png` - locked differential proof.
5. `cabinet/05-export-result.png` - runtime SVG/DXF export status.

## mlightcad

1. `mlightcad/01-g120c-runtime-fit.png` - full G120C runtime fit.
2. `mlightcad/02-g120c-bounds-overlay.png` - apples-to-apples bounds overlay.
3. `mlightcad/03-g120c-left-extent-highlight.png` - MTEXT handle 80 highlight.
4. `mlightcad/04-g120c-deep-zoom-left-side.png` - deep zoom left extent.
5. `mlightcad/05-invalid-dxf-rejected.png` - malformed input rejection/retention.
6. `mlightcad/06-valid-scene-retained.png` - valid SITOP load after invalid.

Machine-readable metadata for each image is in `visual-index.json`.
