# OSS Composition Architecture

## Boundary

CNB owns engineering intelligence and decisions. OSS owns generic drawing,
editing, viewport, and file-format mechanics. The boundary is a one-way projection
from the canonical EIR into an editor document, followed by an explicit, reviewed
patch back into EIR placements or artifacts.

```text
                    CNB ELECTRICAL CORE
  Requirements / BOQ / AI intent / EIR / Product Truth
  ManufacturerPart / PhysicalFootprint / Provenance
  Engineering Rules / BOM Intelligence / Cabinet Selection
  Validation Policy / Approval Workflow / ERP adapters
                              |
                         Adapter layer
        +---------------------+----------------------+
        |                     |                      |
        v                     v                      v
  Panel layout OSS       CAD viewer OSS        Schematic OSS
  cabinet-layout         mlightcad DXF          sldeditor
        |                     |                      |
        +---------------------+----------------------+
                              v
                     DXF / SVG / PDF artifacts

  Later, isolated adapters: PartCAD catalog, WireViz harness docs,
  FreeCAD/Cables 3D, and ERPNext or other ERP.
```

The CNB domain does not import Fabric.js, Three.js, React, ezdxf service types,
or an upstream editor's JSON types. Those dependencies terminate in adapters.

## Canonical data flow

1. CNB validates EIR, product identity, footprint provenance, topology, and rules.
2. An adapter creates a disposable OSS document with stable `eir_*` IDs and a
   source revision hash.
3. OSS performs viewport interaction, local snapping/reflow, routing, or export.
4. The adapter returns placements and artifacts plus warnings and the OSS commit.
5. CNB validates the returned patch against EIR rules and records an approval;
   an unapproved OSS document is never manufacturing truth.

## Adapter contracts

The following language-neutral TypeScript contracts describe the minimum seam.
Implementations may be Python services or React packages, but the core sees only
these DTOs.

```ts
type ArtifactFormat = "dxf" | "svg" | "pdf" | "png";

interface Artifact {
  id: string;
  format: ArtifactFormat;
  uri: string;
  sha256: string;
  sourceEirRevision: string;
  warnings: string[];
}

interface Placement {
  eirDeviceId: string;
  xMm: number;
  yMm: number;
  rotationDeg: number;
  locked: boolean;
  railId?: string | null;
}

interface CadViewerAdapter {
  openDxf(input: { uri: string; expectedSha256?: string }): Promise<{ documentId: string }>;
  fit(documentId: string): Promise<void>;
  setLayerVisibility(documentId: string, layer: string, visible: boolean): Promise<void>;
  selectEntity(documentId: string, entityId: string): Promise<void>;
  inspectEntity(documentId: string, entityId: string): Promise<Record<string, unknown>>;
  exportView(documentId: string, format: "svg" | "png"): Promise<Artifact>;
  close(documentId: string): Promise<void>;
}

interface PanelLayoutAdapter {
  loadProject(eir: ElectricalDesignModel): Promise<{ sessionId: string; unsupported: string[] }>;
  getPlacements(sessionId: string): Promise<Placement[]>;
  setPlacements(sessionId: string, input: Placement[]): Promise<void>;
  runLocalLayout(sessionId: string, options?: { rowId?: string }): Promise<Placement[]>;
  validateView(sessionId: string): Promise<{ code: string; severity: "warning" | "error"; ref?: string }[]>;
  export(sessionId: string, format: "dxf" | "svg" | "pdf"): Promise<Artifact>;
  close(sessionId: string): Promise<void>;
}

interface SchematicAdapter {
  loadEir(eir: ElectricalDesignModel, pageId: string): Promise<{ documentId: string }>;
  getTopology(documentId: string): Promise<{ nodeId: string; deviceId?: string; terminal?: string }[]>;
  setWireRoute(documentId: string, wireId: string, points: { x: number; y: number }[]): Promise<void>;
  validate(documentId: string): Promise<{ code: string; message: string }[]>;
  export(documentId: string, format: "svg" | "png" | "dxf"): Promise<Artifact>;
}

interface CadExportAdapter {
  exportPanel(eir: ElectricalDesignModel, format: ArtifactFormat): Promise<Artifact>;
  audit(artifact: Artifact): Promise<{ valid: boolean; entityCount?: number; layers?: string[]; errors: string[] }>;
}

interface ProductCatalogAdapter {
  resolve(identity: { manufacturer: string; orderCode: string }): Promise<{
    productId: string; footprintRef?: string; sourceArtifacts: string[]; revision: string;
  }>;
  publishArtifact(productId: string, artifact: Artifact): Promise<void>;
}

interface WiringDocumentationAdapter {
  renderHarness(input: { eir: ElectricalDesignModel; harnessId: string }): Promise<Artifact[]>;
}
```

`ElectricalDesignModel` is the CNB EIR DTO, not an OSS type. Every adapter must
preserve an ID map, source revision, units, and unsupported capability list.
Unknown geometry or topology is an explicit warning, never an invented default.

## Composition choices

### Panel layout

Use Cabinet Layout Generator through `PanelLayoutAdapter`. Its JSON model,
Fabric view binding, tested local reflow, duct snapping, overlap warnings, and
ezdxf exporter are a strong 2D foundation. Rails remain CNB semantics and are
projected as locked visual proxies until an upstream rail model exists. Start with
dual-run; a fork is allowed only if the parity gate passes and upstream activity
does not make a long-lived fork cheaper than a thin wrapper.

### DXF viewer

Use the MIT DXF path of `@mlightcad/cad-simple-viewer` and
`@mlightcad/three-renderer` behind `CadViewerAdapter`. It provides Three.js
rendering, INSERT/block identity, effective layers, selection metadata, camera
controls, and spatial indexing. Do not register the GPL LibreDWG converter in a
closed CNB distribution. DWG support requires a separately approved commercial
converter or a future license decision.

### Schematic

Use sldeditor behind `SchematicAdapter` in a later milestone. Map EIR devices,
terminals, and connections into its compiler/store model; keep EIR topology as the
authority. Do not create a parallel CNB schematic canvas.

### Catalog and wiring

PartCAD is an experiment for package/revision/source/BOM mechanics, not the CNB
catalog core. WireViz is an optional external adapter for harness documentation;
its GPL-3.0 license and narrower harness scope preclude a core dependency.

## AI boundary

AI may call typed intent tools such as `select_product`, `create_panel`,
`place_device`, `move_device`, `lock_device`, `run_layout`, `validate_layout`,
`select_enclosure`, `create_schematic`, and `export_artifact`. It must never emit
DXF primitives, thousands of lines, arcs, or renderer-specific calls. CNB resolves
the intent, OSS executes deterministic interaction/geometry, and CNB rules decide
whether the result is acceptable. AI-CAD's planner/critic/repair/evidence loop is
borrowed as a pattern for proposals and regression checks, not as a replacement
for EIR validation.

## Runtime and ownership

The browser may host the panel and viewer adapters, while export/audit services may
run in Python. Each adapter pins its upstream package version and records a commit
in artifact metadata. OSS state is disposable and can be regenerated from EIR;
only approved placements, artifact hashes, and review findings are persisted in
CNB.
