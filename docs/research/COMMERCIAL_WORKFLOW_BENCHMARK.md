# Commercial workflow benchmark

This benchmark reverse-engineers publicly documented workflow boundaries; it does not copy proprietary code or treat marketing claims as independently verified performance. Pages were fetched on 2026-09-15. Where a vendor page was inaccessible (robots/403/locale redirect), that is recorded rather than filled with assumptions.

## Comparison at a glance

| Product/ecosystem | Public workflow evidence | What it implies for CNB | Evidence quality / caveat |
|---|---|---|---|
| [EPLAN Electric P8](https://www.eplan.com/de-en/products/eplan-electric-p8/) | Schematic design with standard symbols, auto wire connecting, automated numbering and cross-referencing; device/component/cable data; predefined device data from Data Portal; reports, wire/parts lists and online checks. | A semantic electrical project is the system of record, not a drawing. Device data and reports are generated from it. | Direct vendor page; feature claims are not an independent benchmark. |
| [EPLAN Pro Panel](https://www.eplan.com/de-en/products/eplan-pro-panel/) | 3D digital twin of cabinet/control system; positioning of wiring ducts, DIN rails, components, drill holes and housing cut-outs; exact wire lengths/routing; parts, cutting and wiring lists. | Panel model, routing and manufacturing outputs are one linked data graph. This is the commercial north star for the data model, not an MVP scope. | Direct vendor page; no source access. |
| [EPLAN Data Portal](https://www.eplan.com/de-en/products/eplan-data-portal/) | Central manufacturer data: commercial/technical data, schematic macros, 3D graphics, images and links; EPLAN Data Standard; 3D panel-layout support. | Component catalog normalization/provenance is a product moat and a prerequisite for automation. | Direct vendor page; availability/terms vary by manufacturer. |
| [EPLAN panel design in 3D](https://www.eplan.com/de-en/industry-solutions/panel-building/panel-designs-in-3d/) | Standardized schematic creation is presented as foundation for 3D cabinet design; digital twin supports integrated assembly layouts. | Standardization and change propagation matter more than a flashy 3D canvas. | Direct vendor page, vendor case-study language. |
| [EPLAN automated panel production](https://www.eplan.com/de-en/industry-solutions/panel-building/automated-panel-production/) | Digital twin supplies drilling/cutting lists, 3D routing and wire lengths, labeling/crimping preparation, step-by-step cabling/component placement; references Rittal Wire Terminal. | The valuable handoff is production-ready structured output, not only DXF. | Direct vendor page; automation equipment integrations are ecosystem-specific. |
| [WSCAD ELECTRIX AI](https://www.wscad.com/en/electrix/) | Vendor describes AI Copilot for operational/design tasks, AI requirements/error checks, translations, complete BOM generation and faster schematic work; integrated electrical, cabinet, fluid and building domains. | AI is an assistant over a mature deterministic model; it executes commands/updates attributes rather than being trusted with raw geometry. | Direct vendor page; "up to 99%" is a marketing claim, not accepted as evidence. |
| [WSCAD Cabinet Engineering add-ons](https://www.wscad.com/en/electrix/addons/) | Precise/optimized component placement, collision checks, wire length/routes, drilling data, 3D view; CE Expert Wire Routing calculates lengths, duct fill/separation, routing tags and imports wiring from Excel; third-party cabinet data import. | Excel/BOM import and duct-aware routing are practical wedge features; rule checks should be headless. | Direct vendor page; implementation details proprietary. |
| Zuken E3.series | Canonical product is publicly documented, but the site returned 403 for this environment on 2026-09-15. | Keep E3.schematic/E3.panel as a workflow benchmark to validate later with a licensed demo or customer interview. | Blocked by site access; no unverified feature claims added. |
| AutoCAD Electrical | Autodesk page returned 403 in this environment. | Treat DWG-native compatibility and project standards as integration requirements, not a reason to build a DWG editor. | Blocked by site access. |
| SEE Electrical / 3D Panel+ | IGE+XAO page routing changed/returned 404 for guessed URLs; homepage was reachable. | Benchmark separately when canonical product URL is confirmed; preserve no-claim status now. | URL discovery blocked; no invented feature list. |
| SOLIDWORKS Electrical | Product URLs tried returned 404/redirect in this environment. | Useful adjacent mechanical/electrical integration benchmark; not required for first wedge. | Blocked URL, no unverified claims. |
| Phoenix Contact CLIPX ENGINEERING | Page returned 403 (Akamai) from this environment. | Manufacturer ecosystem likely valuable for terminal/part data and engineering export; validate through official downloadable docs/partner access. | Access blocked; no scrape. |
| Rittal ecosystem | Rittal homepage reachable; guessed engineering-specialist URL returned 404. EPLAN page directly references Rittal Wire Terminal as a production handoff. | Keep enclosure, rail, duct, drilling and machine handoff as a future adapter boundary. | Direct EPLAN reference; Rittal product details not independently enumerated here. |
| ABB / Schneider / Siemens tooling | Guessed public URLs returned redirects/403/404; no stable feature evidence captured in this pass. | Build a neutral catalog schema and adapter interfaces rather than vendor-specific assumptions. | Access/URL ambiguity recorded. |

## Workflow decomposition

The common commercial sequence is:

```text
engineering requirement / template
  -> schematic + functions/locations
  -> device/part assignment and manufacturer master data
  -> BOM/reports and cross references
  -> 2D/3D panel placement (rails, ducts, terminals, clearances)
  -> collision/online checks + wire routing/length
  -> drilling, cutting, labelling, wiring and production lists
  -> ERP/manufacturing/machine handoff
```

EPLAN's public wording explicitly connects schematic data to cabinet design and production documents. WSCAD's public wording similarly links symbols to corresponding components/manufacturer data and says BOMs can be generated from that link. This is strong evidence against a geometry-first architecture.

## What commercial systems appear to keep deterministic

Public pages repeatedly attach automation to bounded operations: auto-connecting, numbering, cross-references, online checks, collision checking, wire length calculation, duct fill/separation, drilling lists and BOM generation. WSCAD's AI page says an AI Copilot can execute commands such as placing a macro or setting a wire attribute, while the product still contains explicit cabinet/engineering modules. The defensible architecture inference is:

```text
AI / copilot proposes intent or invokes a command
  -> project/domain model mutates through typed commands
  -> deterministic rules and geometry checks run
  -> layout/router/export produce artifacts
  -> engineer reviews issues and approves
```

This is materially different from `LLM -> DXF entities`.

## SME 20% that likely creates 80% of value

The smallest credible wedge is **BOM/structured intent -> panel layout -> audited DXF/SVG + BOM/validation**, with optional SLD linking. It targets the repeated value signals in both EPLAN and WSCAD:

1. Assign known parts/footprints and stable device tags.
2. Place main protection, feeders, control/PLC and terminals into rail/duct zones.
3. Enforce inside/no-overlap/mounting/clearance/accessibility rules.
4. Produce a reproducible panel drawing and machine-readable BOM/placements.
5. Preserve links so a schematic click resolves the physical instance.

Wire length, drilling and 3D can follow once this graph is stable. Full DWG editing, power-flow, PLC programming and photorealistic 3D are not required to test the wedge.

## Benchmark questions for a licensed product trial

The public pages do not answer these implementation questions. A commercial evaluation should measure them against the CNB prototype:

| Question | Why it matters |
|---|---|
| Does changing one MPN update symbol, footprint, BOM, 3D model and reports without manual re-entry? | Tests single-source-of-truth behavior. |
| Can the system flag a wrong rail type, duct collision, insufficient clearance or inaccessible terminal headlessly? | Separates engineering validation from visual plausibility. |
| Can it import Excel/BOM and preserve stable IDs across regeneration? | Directly tests the wedge workflow. |
| Are wire routes topological paths with lengths and duct fill, or only graphic polylines? | Determines whether manufacturing output is trustworthy. |
| Can historical project layouts be used as suggestions without silently overriding rules? | Tests AI/learning safety. |
| Which exports are truly machine-ready (DXF/DWG, drilling, cutting, labels, crimp/wire lists)? | Prevents confusing "export exists" with production handoff. |
| What part/catalog fields are guaranteed and what is user-maintained? | Determines data acquisition cost and moat. |

## Claims we deliberately reject as evidence

- WSCAD "up to 99% faster" is not accepted as a measured CNB benchmark.
- A vendor's "integrated 3D view" does not prove a BREP kernel, clash correctness or STEP fidelity.
- "AI-powered" does not prove the model changes a validated project safely.
- A downloadable manufacturer model does not grant redistribution rights.
- An output file with `.dxf` extension does not prove entity validity, units, layer semantics or downstream interoperability.

## Implication for recommendation

Commercial workflow evidence strengthens the case for a narrow product, but also raises the quality bar: the moat is not a canvas or chatbot. It is normalized component data, stable cross-representation identity, deterministic constraints, repeatable layout/routing and production-oriented exports. The prototype should therefore report **GO WITH CONDITIONS** only after those invariants pass its own tests; a feature checklist alone is insufficient.
