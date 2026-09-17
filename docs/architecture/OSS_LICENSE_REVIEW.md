# OSS License Review

This is a practical engineering screen, not legal advice. Before shipping a
distributed product, generate a complete third-party notice/SBOM from the exact
lockfiles and have counsel review copyleft and symbol terms.

| Repository / portion | License observed in checkout | Commercial use | Modification / attribution | Copyleft impact | CNB decision |
|---|---|---|---|---|---|
| `Taam4142/cabinet-layout-generator` | MIT (`LICENSE`, commit `0633b013`) | Allowed | Preserve notice in copied portions | None | Safe to wrap; fork only with notices and upstream history |
| `mlightcad/cad-viewer` main repo and `@mlightcad/cad-simple-viewer`, `@mlightcad/three-renderer` | MIT (`LICENSE`, package manifests, commit `44cfd514`) | Allowed | Preserve copyright/license | None | Adopt DXF packages behind adapter |
| mlightcad optional `@mlightcad/libredwg-converter` | GPL-3.0 (documented by `AcApWorkerAssets.ts` and package boundary) | Allowed only with GPL obligations | Source disclosure, notice, same-license distribution for derivative work | Strong copyleft | Do not bundle for closed CNB; evaluate commercial DWG converter separately |
| mlightcad private `@mlight-cad/dwg-converter` | Proprietary/commercial terms | Contract-dependent | Follow vendor EULA; no source assumptions | Contract-dependent | Keep optional and procurement-gated |
| `NovaShang/sldeditor` | MIT (`LICENSE`, commit `c03dff4d`) | Allowed | Preserve notice | None | Safe adapter candidate |
| sldeditor embedded QElectroTech symbols | CC-BY-3.0 per `THIRD_PARTY_NOTICES.md` | Generally allowed with attribution | Preserve attribution and license link | No copyleft, but attribution mandatory | Ship notices and audit symbol provenance |
| `partcad/partcad` | Apache-2.0 (`LICENSE`, commit `2a1326ba`) | Allowed | Preserve notice, state modifications, include NOTICE if present | None; patent terms apply | Experiment behind catalog adapter |
| `ai-cad-labs/ai-cad` | Apache-2.0 (`LICENSE`, commit `c7503b4f`) | Allowed | Preserve notice and modification statement | None; patent terms apply | Borrow patterns or isolated tooling |
| `backkem/codecad` | MIT (`LICENSE`, commit `c578b737`) | Allowed | Preserve notice | None | Reference; no R4.3 runtime dependency |
| `WireViz` | GPL-3.0 (`LICENSE`, commit `e4fe099f`) | Allowed with GPL compliance | Source/notice and corresponding-source obligations | Strong copyleft | Use as an external process or adapter only; no linked core dependency |
| QElectroTech application | GPLv2 (`qelectrotech-source/README.md`, commit `395c6f6`) | Allowed with GPLv2 obligations | Source/notice and derivative distribution rules | Strong copyleft | Survey semantics; do not embed in CNB |
| QElectroTech element collection | Separate CC-BY terms in collection metadata | Allowed with attribution | Credit collection authors and comply with collection terms | None, attribution required | Use as reference or separately packaged assets |

## Dependency caveats

- MIT or Apache at the top-level repository does not relicense transitive npm,
  Python, Rust, Qt, GraphViz, or CAD-kernel dependencies. Lockfile scanning is a
  release gate.
- `sldeditor` is MIT but its bundled symbols are a separate attribution surface;
  replacing the library with CNB-authored symbols avoids that obligation but is a
  product decision, not a license shortcut.
- mlightcad's DXF path is distinct from the optional DWG converters. Selecting a
  DWG feature after adopting the viewer must trigger a new legal review.
- PartCAD providers may fetch external CAD files. CNB must retain source URL,
  revision/hash, and the provider's license metadata before putting an artifact in
  a manufacturing package.
- WireViz and QElectroTech GPL code/data must not cross the CNB process boundary
  through copied source or linked libraries. A separately installed executable
  with user-supplied input is the preferred risk-minimizing integration shape,
  subject to counsel review.

## Required notice practice

For any fork or copied module, retain the upstream URL, commit, license file,
copyright notices, and a `THIRD_PARTY_NOTICES` entry. Record the exact package
versions and generated SBOM in the release evidence. This spike keeps all clones
under `research/cloned-or-scripted-spikes/`; no source was vendored into the CNB
runtime.
