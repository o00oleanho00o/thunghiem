# Docs Evidence

Captured from the running web app at `http://127.0.0.1:4177/docs.html` after the R3.1b truth-closure branch was loaded.

| File | View | Evidence |
|---|---|---|
| `01-docs-overview-desktop.png` | 1440 × 1000, full page | Product overview, navigation, all sections |
| `02-vision-diagram.png` | desktop section crop | Input → AI → engineering → CAD → engineer |
| `03-dh-project-to-factory.png` | desktop section crop | M&E / factory bridge and ERPNext handoff |
| `04-real-component-model.png` | desktop section crop | Product identity, footprint, DXF, provenance, rules |
| `05-roadmap.png` | desktop section crop | R3.1b through R9 and Not now boundary |
| `06-docs-mobile.png` | 390 × 844, full page | Responsive docs navigation and stacked content |

Automated browser checks:

- page title: `CNB Electrical Lab · Tài liệu`;
- eight anchored documentation sections and thirteen navigation links rendered;
- four diagrams rendered as HTML/CSS components without an extra dependency;
- eleven linked Markdown/evidence artefacts returned HTTP 200;
- current-status documentation keeps the historical vendor cleanup out of the active product story;
- current status explicitly says engineering-layout-grade and not manufacturing-ready.
