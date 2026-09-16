# R3 Engineering Truth Report

## Decision

**REPEAT R3 / GO TO R4 WITH CONDITIONS is not justified yet.** The pipeline now has the right evidence boundaries and an authoritative export gate, but the eight exact products are `review_verified`, not live `vendor_verified`, and none has an exact-product CAD representation. The engineering envelope benchmark is useful for rule testing, not a procurement-ready cabinet release.

## Answers

1. Exact commercial MPNs verified: **8**, all Phoenix Contact, status `review_verified`.
2. Unknown/inferred: no identity or envelope field is inferred from DXF; accessory envelope, terminal pitch, cable bend radius and some installation clearances remain unknown.
3. Assumption-based physical dimensions: **none in the authoritative footprint envelope**; the source records explicitly document the evidence boundary.
4. Auto-layout validation: **PASS** for both heuristic and CP-SAT on the recorded benchmark.
5. Invalid layout export: **NO**. The API gate rejects HTTP 422 before DXF/SVG/audit generation.
6. Browser edits round-trip: **PASS** through `/api/eir/revisions` command records and canonical hashes.
7. Lock/regenerate: **PASS**; locked coordinates and orientation remain exact.
8. Heuristic vs solver: heuristic is adequate and faster for this eight-device cabinet; CP-SAT is retained for objective experimentation.
9. Manual corrections: **1** (PS1 reference adjustment).
10. Largest weakness: authoritative source access and exact-product CAD/installation evidence, followed by terminal/service detail.
11. Wire-routing readiness: **not yet**. The model has topology and access corridors, but not terminal-point or duct-node routing evidence.

The correct release posture is **REPEAT R3** until at least five records are upgraded with directly retrievable official documents or an internal traceable document package, and exact-product CAD or a documented decision to use engineering envelopes is supplied.
