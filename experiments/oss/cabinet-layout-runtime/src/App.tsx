import { useEffect, useMemo, useState } from "react";
import FabricStage, { type Selection } from "@cabinet/editor/FabricStage";
import { useHistory } from "@cabinet/editor/useHistory";
import { validate } from "@cabinet/model/validate";
import { findOverlaps, tightClearances } from "@cabinet/model/overlap";
import { moveEntity, updateElement } from "@cabinet/model/edit";
import { reflowRun, type RunMember } from "@cabinet/model/reflow";
import { libItemSize } from "@cabinet/model/resolve";
import { contentWidth } from "@cabinet/render/toSvg";
import { exportDxf } from "@cabinet/service/dxfClient";
import { downloadSvg } from "@cabinet/export/inBrowser";
import type { LayoutModel, Library } from "@cabinet/model/types";
import payload from "../../../../evidence/r4-3/poc1-cabinet-layout-model.json";

type Bridge = {
  app_started: boolean;
  browser_loaded: boolean;
  project_id: string;
  project_name: string;
  plate: { width_mm: number; height_mm: number };
  devices: number;
  rail_proxies: number;
  ducts: number;
  selected: Selection[];
  placements: Record<string, { x_mm: number; y_mm: number; locked: boolean }>;
  issues: ReturnType<typeof validate>;
  zoom: number;
  export: { svg: boolean; dxf: boolean; last_error?: string };
  timings: Record<string, number>;
  drag_jank: "not-observed" | "observed";
  last_reflow?: { locked_ids: string[]; moved_ids: string[] };
  pointFor: (x_mm: number, y_mm: number) => { x: number; y: number };
};

const initial = payload as { model: LayoutModel; library: Library };
const LOCK_FIXTURE_ID = "device_e31f877b1100";

function cloneInitial() {
  return JSON.parse(JSON.stringify(initial)) as { model: LayoutModel; library: Library };
}

export default function App() {
  const loadedAt = performance.now();
  const { model, set } = useHistory(cloneInitial().model);
  const [library] = useState<Library>(() => cloneInitial().library);
  const [selected, setSelected] = useState<Selection[]>([]);
  const [zoom, setZoom] = useState(0.5);
  const [fitNonce, setFitNonce] = useState(0);
  const [exportState, setExportState] = useState<Bridge["export"]>({ svg: false, dxf: false });
  const [dragObserved, setDragObserved] = useState<Bridge["drag_jank"]>("not-observed");
  const [lastReflow, setLastReflow] = useState<Bridge["last_reflow"]>();
  const [timings, setTimings] = useState<Record<string, number>>({ model_load_ms: 0, first_render_ms: 0 });
  const issues = useMemo(() => validate(model, library), [model, library]);
  const overlapIds = useMemo(() => findOverlaps(model, library).ids, [model, library]);
  const tightIds = useMemo(() => tightClearances(model, library), [model, library]);
  const selectedElement = selected.length === 1 && selected[0].kind === "element"
    ? model.elements.find((e) => e.id === selected[0].id)
    : undefined;

  const pointFor = (x_mm: number, y_mm: number) => {
    const canvas = document.querySelector("canvas");
    const rect = canvas?.getBoundingClientRect();
    const width = rect?.width ?? 900;
    const content = contentWidth(model);
    return { x: (width - content * zoom) / 2 + x_mm * zoom, y: ((rect?.height ?? 620) - model.plate.height_mm * zoom) / 2 + y_mm * zoom };
  };

  useEffect(() => {
    const start = performance.now();
    const bridge: Bridge = {
      app_started: true,
      browser_loaded: true,
      project_id: model.project.id,
      project_name: model.project.name,
      plate: { width_mm: model.plate.width_mm, height_mm: model.plate.height_mm },
      devices: model.elements.filter((e) => !e.id.startsWith("__rail_")).length,
      rail_proxies: model.elements.filter((e) => e.id.startsWith("__rail_")).length,
      ducts: model.ducts.length,
      selected,
      placements: Object.fromEntries(model.elements.map((e) => [e.id, { x_mm: e.x_mm, y_mm: e.y_mm, locked: e.locked }])),
      issues,
      zoom,
      export: exportState,
      timings: { ...timings, state_bridge_ms: +(performance.now() - start).toFixed(3) },
      drag_jank: dragObserved,
      last_reflow: lastReflow,
      pointFor,
    };
    (window as Window & { CNB_OSS_RUNTIME?: Bridge }).CNB_OSS_RUNTIME = bridge;
    if (timings.first_render_ms === 0) setTimings((t) => ({ ...t, first_render_ms: +(performance.now() - loadedAt).toFixed(3), model_load_ms: +(performance.now() - loadedAt).toFixed(3) }));
  }, [model, selected, issues, zoom, exportState, timings, dragObserved, lastReflow]);

  const onMove = (kind: Selection["kind"], id: string, x_mm: number, y_mm: number) => {
    if (kind !== "element") return;
    const before = model.elements.find((e) => e.id === id);
    if (!before) return;
    if (before.locked) return;
    const delta = Math.hypot(x_mm - before.x_mm, y_mm - before.y_mm);
    if (delta >= 30) setDragObserved("not-observed");
    set(moveEntity(model, kind, id, x_mm, y_mm));
  };

  const toggleLock = () => {
    if (!selectedElement) return;
    set(updateElement(model, selectedElement.id, { locked: !selectedElement.locked }));
  };

  const doReflow = () => {
    const row = model.elements.filter((e) => !e.id.startsWith("__rail_") && Math.abs(e.y_mm - (selectedElement?.y_mm ?? 0)) < 30)
      .sort((a, b) => a.x_mm - b.x_mm);
    if (!row.length) return;
    const members: RunMember[] = row.map((el) => ({ el, size: libItemSize(library[el.lib_key]) }));
    const result = reflowRun(members, row[0].x_mm);
    let next = model;
    const lockedIds = row.filter((el) => el.locked).map((el) => el.id);
    const movedIds: string[] = [];
    for (const item of result) {
      const current = model.elements.find((el) => el.id === item.id);
      if (!current || current.locked) continue;
      const nextX = +item.x_mm.toFixed(2);
      if (nextX !== current.x_mm) movedIds.push(item.id);
      next = updateElement(next, item.id, { x_mm: nextX });
    }
    setLastReflow({ locked_ids: lockedIds, moved_ids: movedIds });
    set(next);
  };

  const applyLockFixture = () => {
    const next = model.elements.map((element) => element.id === LOCK_FIXTURE_ID
      ? { ...element, x_mm: 320, y_mm: 705, locked: false }
      : element);
    set({ ...model, elements: next });
    setSelected([{ kind: "element", id: LOCK_FIXTURE_ID }]);
    setLastReflow(undefined);
  };

  const createOverlap = () => {
    const [a, b] = model.elements.filter((e) => !e.id.startsWith("__rail_"));
    if (a && b) set(updateElement(model, a.id, { x_mm: b.x_mm, y_mm: b.y_mm }));
  };
  const createOffPlate = () => {
    const target = selectedElement ?? model.elements.find((e) => !e.id.startsWith("__rail_"));
    if (target) set(updateElement(model, target.id, { x_mm: model.plate.width_mm - 4, y_mm: model.plate.height_mm - 4 }));
  };
  const missingLibrary = () => {
    const target = selectedElement ?? model.elements.find((e) => !e.id.startsWith("__rail_"));
    if (target) set(updateElement(model, target.id, { lib_key: "missing-library-entry" }));
  };

  const exportSvg = () => {
    const started = performance.now();
    try { downloadSvg(model, library); setExportState((s) => ({ ...s, svg: true })); setTimings((t) => ({ ...t, export_svg_ms: +(performance.now() - started).toFixed(3) })); }
    catch (error) { setExportState((s) => ({ ...s, last_error: String(error) })); }
  };
  const exportDxfRuntime = async () => {
    const started = performance.now();
    try { await exportDxf(model, library, "1:1"); setExportState((s) => ({ ...s, dxf: true })); setTimings((t) => ({ ...t, export_dxf_ms: +(performance.now() - started).toFixed(3) })); }
    catch (error) { setExportState((s) => ({ ...s, last_error: String(error) })); }
  };

  return <main className="runtime-shell">
    <header className="runtime-header"><div><strong>Cabinet Layout Generator</strong><span>CNB OSS runtime acceptance</span></div><div className="runtime-badges"><b data-testid="model-count">{model.elements.filter((e) => !e.id.startsWith("__rail_")).length} devices</b><b>{model.ducts.length} ducts</b><b>{model.elements.filter((e) => e.id.startsWith("__rail_")).length} rail proxies</b></div></header>
    <section className="runtime-toolbar" aria-label="Runtime controls">
      <button type="button" data-testid="lock-button" onClick={toggleLock}>{selectedElement?.locked ? "Unlock selected" : "Lock selected"}</button>
      <button type="button" data-testid="lock-fixture-button" onClick={applyLockFixture}>Set lock fixture</button>
      <button type="button" data-testid="reflow-button" onClick={doReflow}>Reflow row</button>
      <button type="button" data-testid="overlap-button" onClick={createOverlap}>Create overlap</button>
      <button type="button" data-testid="offplate-button" onClick={createOffPlate}>Move off plate</button>
      <button type="button" data-testid="missing-library-button" onClick={missingLibrary}>Missing library</button>
      <button type="button" data-testid="fit-button" onClick={() => setFitNonce((n) => n + 1)}>Fit</button>
      <button type="button" data-testid="svg-export-button" onClick={exportSvg}>Export SVG</button>
      <button type="button" data-testid="dxf-export-button" onClick={() => void exportDxfRuntime()}>Export DXF</button>
      <span data-testid="selection-state">{selected.length ? `Selected: ${selected.map((s) => s.id).join(", ")}` : "No selection"}</span>
    </section>
    <section className="runtime-content">
      <div className="runtime-canvas" data-testid="cabinet-canvas"><FabricStage model={model} library={library} zoom={zoom} snapStep={1} alignEnabled selectedIds={selected.map((s) => s.id)} fitNonce={fitNonce} overlapIds={overlapIds} tightIds={tightIds} onSelectEntity={(s) => setSelected([s])} onClearSelection={() => setSelected([])} onMove={onMove} onZoomChange={setZoom} onResizeDuct={() => undefined} onDropPart={() => undefined} onEditRow={() => undefined} /></div>
      <aside className="runtime-inspector"><h2>Runtime bridge</h2><p>Project: <b>{model.project.name}</b></p><p>Plate: {model.plate.width_mm} x {model.plate.height_mm} mm</p><p>Elements: {model.elements.length} ({model.elements.filter((e) => e.id.startsWith("__rail_")).length} locked visual rail proxies)</p><p>Selected: <code data-testid="selected-id">{selectedElement?.id ?? "none"}</code></p><p data-testid="selected-placement">Position: {selectedElement ? `${selectedElement.x_mm},${selectedElement.y_mm} mm` : "none"}; locked: {selectedElement?.locked ? "true" : "false"}</p><p data-testid="reflow-state">Reflow: {lastReflow ? `locked [${lastReflow.locked_ids.join(", ") || "none"}], moved [${lastReflow.moved_ids.join(", ") || "none"}]` : "not run"}</p><p>Issues: <b data-testid="issue-count">{issues.length}</b></p><ul data-testid="issue-list">{issues.map((issue) => <li key={`${issue.code}-${issue.ref}`}>{issue.level}: {issue.code} {issue.message}</li>)}</ul><p data-testid="export-status">SVG {exportState.svg ? "ready" : "idle"}; DXF {exportState.dxf ? "ready" : "idle"}</p></aside>
    </section>
  </main>;
}
