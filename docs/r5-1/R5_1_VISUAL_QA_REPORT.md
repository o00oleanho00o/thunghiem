# R5.1 Visual QA report

## Scope

One long-lived demo process and one URL: npm run demo → http://127.0.0.1:8080/demo.

## Verified

- Static demo page is served directly even when Vite dist is absent.
- BOM fixture contains 18 unplaced components.
- Auto-layout returns measured duration_ms, 18 placements, rail/duct metrics and validation output.
- Product Truth inspector exposes identity and candidate CAD mapping.
- CAD modal uses the bundled mlightcad runtime and a real catalog DXF File; no iframe/srcdoc or raw DXF-as-HTML.
- Lock + re-layout preserves locked coordinates.
- Export returns DXF + BOM CSV + audit; gate observed 274 entities and valid HEADER/ENTITIES sections.

## Environment note

The Codex computer-use connector was unavailable in this run (unsupported Codex auth method: apikey). The repository gate is deterministic and the same URL is intended for visible Chrome click-through.