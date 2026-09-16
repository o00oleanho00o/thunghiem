# R3.1b Browser Evidence

Captured with Playwright against `http://127.0.0.1:4177/` after loading the R3.1b ABB engineering-truth benchmark (24 physical devices, 8 type designations and 8 distinct manufacturer order codes).

| Evidence | File |
|---|---|
| R3 verified product library | `screenshots/01-r3-verified-product-library.png` |
| Product detail and provenance | `screenshots/02-product-detail-provenance.png` |
| BOM/product resolution | `screenshots/03-bom-product-resolution.png` |
| Before auto-layout | `screenshots/04-cabinet-before-auto-layout.png` |
| Heuristic layout | `screenshots/05-heuristic-layout.png` |
| Deep zoom | `screenshots/14-deep-zoom-verified-envelope.png` |
| Pan after deep zoom | `screenshots/06-pan-after-deep-zoom.png` |
| Clearance/overlap highlight | `screenshots/07-clearance-overlap-highlight.png` |
| Accessibility highlight | `screenshots/08-accessibility-violation-highlight.png` |
| Invalid export blocked | `screenshots/09-invalid-export-blocked.png` |
| Final valid cabinet | `screenshots/10-final-valid-cabinet.png` |
| Canonical EIR reload | `screenshots/11-canonical-eir-reload.png` |

The independent renderer output is `benchmarks/r3-engineering-truth-cabinet/exports/r3-final.png`; the API and round-trip assertions are in `evidence/test-logs/r3-api.json`.

The product detail screenshot explicitly shows type designation versus manufacturer order code, cached source artifact ID/SHA256, `document_verified` status, `UNKNOWN` clearance/access fields and the separate 5 mm `ENGINEERING DEFAULT` policy.
