# ABB Source Review

This is a reviewed extraction from the cached official artifact, not an automatic vendor-data parser.

- Artifact: `catalog/r3/abb-s200-datasheet.pdf`
- Artifact ID: `source-abb-2cdc002168d0202-r1`
- SHA256: `e3bd374e5540f76034b0168fdf45742ba88dce7e579e522b01449311de54a7e1`
- Document: ABB `2CDC002168D0202 Rev. F`
- Review date: 2026-09-16

| Field | Value | Source page/section | Review method |
|---|---|---|---|
| width_mm | 17.5 | p.3, Technical data, pole dimensions H x D x W | Direct visual/text cross-check against cached PDF |
| height_mm | 92 | p.3, Technical data, pole dimensions H x D x W | Direct visual/text cross-check against cached PDF |
| depth_mm | 71 | p.3, Technical data, pole dimensions H x D x W | Direct visual/text cross-check against cached PDF |
| mounting | DIN rail | p.3, Technical data, Installation | Direct visual/text cross-check against cached PDF |
| rail_width_mm | 35 | p.3, Technical data, EN 60715 DIN rail | Direct visual/text cross-check against cached PDF |
| vendor_mounting_position | any | p.3, Technical data, Mounting position | Direct visual/text cross-check against cached PDF |
| type_designation | S201U-C6 ... S201U-C63 | pp.5-6, Ordering data characteristic C, Type column | Reviewed row-by-row for all eight selected variants |
| manufacturer_order_code | 2CDS271417R0064, R0104, R0164, R0204, R0254, R0324, R0404, R0634 | pp.5-6, Ordering data characteristic C, Order code column | Reviewed row-by-row; C6, C16 and C63 independently spot-checked |
| rated_current_a | 6, 10, 16, 20, 25, 32, 40, 63 | pp.5-6, Ordering data characteristic C, Rated current column | Reviewed row-by-row |
| characteristic | C | pp.5-6, Ordering data characteristic C | Section heading cross-check |

The datasheet does not provide the product-specific clearance, service-access face/depth, canonical terminal identifiers/count, or exact CAD representation used by this benchmark. Those fields remain `unknown`. `allowed_rotations=[0]` is a CNB layout policy because the current solver is 2D; it is not a claim that ABB's `Mounting position: any` means only zero degrees.
