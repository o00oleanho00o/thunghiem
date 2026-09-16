# R3 Product Verification Matrix

> R3.1 supersedes this Phoenix review-only matrix for authoritative use. The R3.1 source of truth is `catalog/r3/products.json`, backed by `catalog/r3/source-artifacts/manifest.json`; see `R3_1_PROVENANCE_MATRIX.md`. Phoenix records below remain historical R3 evidence and are not authoritative.

The mini-catalog contains eight exact Phoenix Contact order numbers. They are `review_verified`: the identity and envelope are recorded against an official manufacturer URL and a second-pass internal review. They are not labelled `vendor_verified` because live manufacturer endpoints were not reliably retrievable in this environment.

| Manufacturer | Series | MPN | Description | Source | Width x height x depth (mm) | Mounting | Terminals | CAD | Status | Known unknowns |
|---|---|---|---|---|---:|---|---|---|---|---|
| Phoenix Contact | QUINT POWER | 2866750 | QUINT4-PS/1AC/24DC/2.5 | official product page | 32 x 130 x 125 | DIN 35 | L/N/PE/+24V/0V | no | review-verified | terminal pitch, installation clearance |
| Phoenix Contact | PLC-INTERFACE | 2966171 | PLC-RSC-24DC/21 | official product page | 6.2 x 80 x 94 | DIN 35 | A1/A2/11/14/12 | no | review-verified | socket variant |
| Phoenix Contact | PLC-INTERFACE | 2903149 | PLC-INTERFACE relay module | official product page | 14 x 80 x 94 | DIN 35 | A1/A2/11/14/12 | no | review-verified | coil variant |
| Phoenix Contact | CLIPLINE complete | 3209510 | UK 5 N terminal block | official product page | 5.2 x 42.5 x 42.5 | DIN 35 | 1 | no | review-verified | accessories |
| Phoenix Contact | CLIPLINE complete | 3209577 | PT 2,5-QUATTRO terminal block | official product page | 5.2 x 56 x 46 | DIN 35 | 1/2/3/4 | no | review-verified | comb bridge envelope |
| Phoenix Contact | FL SWITCH 1000 | 1085036 | FL SWITCH 1005N | official product page | 29 x 130 x 115 | DIN 35 | 24V/0V/PE | no | review-verified | cable bend radius |
| Phoenix Contact | QUINT POWER | 2866776 | QUINT4-PS/1AC/24DC/5 | official product page | 48 x 130 x 125 | DIN 35 | L/N/PE/+24V/0V | no | review-verified | terminal pitch, installation clearance |
| Phoenix Contact | VALVETRAB | 2904627 | VAL-MS 230 ST | official product page | 17.7 x 90 x 75 | DIN 35 | L/N/PE | no | review-verified | coordination study |

Machine-readable source: `catalog/r3/products.json`. Every dimension and mounting field has a provenance entry; no field is inferred from the supplied Siemens DXF catalog.
