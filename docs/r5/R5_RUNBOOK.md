# R5 Runbook

## Prerequisites

- Windows PowerShell;
- Node.js with the repository dependencies installed;
- ports `4200` and `8200` available.

## Start the canonical demo

From the repository root:

```powershell
npm run dev:api
npm run dev:web
```

Open [http://127.0.0.1:4200/projects/r5-real-cabinet](http://127.0.0.1:4200/projects/r5-real-cabinet).

The API health endpoint is [http://127.0.0.1:8200/api/health](http://127.0.0.1:8200/api/health).
The expected response identifies `cnb-engineering-api`.

## Demo flow

1. Open `Tổng quan` and confirm the CNB Siemens starter cabinet, `R5-DRAFT`
   revision and `DRAFT · candidate` workflow.
2. Open `BOM` and confirm the three Siemens parts.
3. Open `Bố trí tủ`, select `-HMI1`, and inspect ProductIdentity and the CAD
   source link.
4. Drag the HMI, lock it, and run `Reflow candidate`. The locked x coordinate
   must remain unchanged.
5. Open `CAD nguồn` directly. The first linked asset (KTP700) loads
   automatically; use the device picker and `Mở asset` to switch to G120C or
   SITOP. Verify the source drawing, bounds, layers and selection metadata.
   `Mở DXF` is intentionally a local-file guard test, not the project asset
   loader.
6. Open `Kiểm tra`, click `Chạy lại kiểm tra`, and read the result. The three
   `preview-only` warnings are expected because all R5 physical mappings are
   candidate-only (`placement_capable: false`); this gate does not auto-approve
   manufacturing placement.
7. Open `Xuất file` and run `Chạy audit JSON`; the output must contain
   `"valid": true`.
8. Return to `CAD nguồn`, open a malformed `.dxf` in the file control, and
   verify `last valid scene retained` plus a non-zero rendered count.

## Verification commands

```powershell
npm run build:web
npm run test:r5
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate_r5_contact_sheet.ps1
```

The browser gate starts and stops its own two child processes. It writes:

- `evidence/r5/runtime-result.json`;
- `evidence/r5/visual-index.json`;
- `evidence/r5/01-*.png` through `13-*.png`;
- `evidence/r5/CONTACT_SHEET.png`.

## Troubleshooting

If the gate reports a port conflict, stop stale listeners on 4200/8200 and
rerun the command. Do not use the experimental 4178/4179 hosts as the R5
canonical URL. If CAD fails to load, check that the vendor bundle exists under
`apps/engineering-web/public/vendor` and that the catalog DXF relative paths
exist under `catalog`.

## Acceptance policy

R5 is PASS only when the JSON result is
`PASS_UNIFIED_ENGINEERING_WORKBENCH`, the visual index has 13 entries, the
contact sheet is regenerated, and the visual QA report has no unresolved defect.
