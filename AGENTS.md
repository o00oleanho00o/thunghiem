# cnb-electrical-lab

This repository is intentionally independent from `cnberp`. Do not import from,
modify, or write generated output into `cnberp`.

## Engineering rules

- The canonical source of truth is the versioned Electrical Intermediate
  Representation (EIR), not drawing geometry.
- Use millimetres for physical dimensions and state units explicitly at API
  boundaries.
- Keep exports deterministic and auditable.
- Prefer reproducible scripts and tests over hand-authored screenshots.
- Record assumptions and blockers in `docs/` and `evidence/`.

