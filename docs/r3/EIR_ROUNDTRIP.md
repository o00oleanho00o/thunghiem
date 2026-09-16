# Canonical EIR Round-trip

The web API exposes `/api/eir/revisions`. A POST accepts a canonical EIR plus one command (`move`, `lock`, or `set-tag`), writes an immutable revision record in the process store, and returns the revised EIR and canonical hash. The browser is therefore a view/editor that emits commands; it is not a second source of truth.

The R3 lock test moves one device, locks it, regenerates the layout and asserts exact coordinates and orientation are preserved. The remaining devices are regenerated deterministically.
