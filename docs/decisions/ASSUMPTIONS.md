# Assumptions And Blockers

- The lab uses generic, invented seed parts (`CNB-GENERIC`) rather than vendor
  drawings. This avoids implying a license to redistribute Schneider, Siemens,
  ABB, Phoenix Contact, Rittal, or other manufacturer data.
- Physical coordinates are lower-left origin in millimetres. SVG flips the
  vertical axis once; DXF stays in model coordinates.
- ASCII DXF R12 entities are sufficient for the MVP interchange spike. Native
  DWG, hatches, blocks with full attributes, and manufacturing NC output are
  explicitly out of scope.
- CP-SAT is a bounded placement experiment, not proof of production-scale
  global optimality. Timeouts and capacity failures must remain visible.
- Browser UI is a review/editor surface over EIR, not an independent CAD
  database. The current adapter is transitional until generated types exist.
- Vendor catalog APIs and historical project data require legal/permission
  review; this mission does not scrape or redistribute them.
- Windows checkout of `qelectrotech-elements` hit two filename-length errors;
  source metadata remains usable and the blocker is recorded in the research
  matrix.

