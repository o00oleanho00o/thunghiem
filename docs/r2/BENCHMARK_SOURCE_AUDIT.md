# R2 Benchmark Source Audit

Date: 2026-09-16. The R2 benchmark source boundary is intentionally strict:
only `catalog/` is a valid DXF source. No DXF from research spikes, cloned
repositories, or `cnberp` is used.

The catalog manifest reports 58 files (36 `radica-dxf`, 16
`siemens-batch-w33`, 6 `siemens-bilddb`), all 58 parsed with ezdxf. The source
files are read-only and are not copied into the benchmark. The frozen
selection is recorded by path and SHA256 in
`benchmarks/r2-real-cabinet/source-manifest.json`.

The selection contains 15 Siemens filename candidates spanning SIMATIC S7-1200,
S7-1500, ET200S/ET200SP, S7-300/S7-400, SIRIUS, SITOP, SINAMICS, HMI and
Top-Connect. Product resolution is `resolved-family` only when the family is
explicit in the filename; otherwise it is `needs-review`. No manufacturer
order number is inferred.

The benchmark converts each source bounding box to a bounded panel envelope
for solver stress testing. These are `source-unverified` dimensions, not
vendor-approved footprints. The benchmark is therefore **REFERENCE / SEMI-REAL
BENCHMARK — NOT A HUMAN PRODUCTION CABINET**. It measures pipeline behavior and
does not claim production equivalence.
