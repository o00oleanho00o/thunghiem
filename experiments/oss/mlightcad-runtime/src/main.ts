import {
  AcApDocManager,
  AcEdOpenMode,
  ACGI_PAPER_SPACE_BACKGROUND,
  layoutBackgroundColorFromRgb,
} from "@mlightcad/cad-simple-viewer";
import "./runtime.css";

type Box = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
type RuntimeBridge = {
  app_started: boolean;
  browser_loaded: boolean;
  loaded: boolean;
  rendered: boolean;
  asset: string;
  bytes: number;
  entity_count: number;
  rendered_entity_count: number;
  load_ms: number;
  render_ms: number;
  browser_responsive: boolean;
  zoom: number;
  camera: { zoom: number; center?: unknown };
  selection: { ids: string[]; entity?: Record<string, unknown> };
  layers: Array<{ name: string; entity_count: number; visible: boolean }>;
  bounds: Box | null;
  visible_bounds: Box | null;
  blocks: Array<{ name: string; entity_count: number }>;
  errors: string[];
  unsupported_behavior: string;
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = $("fileInputElement") as HTMLInputElement;
const container = $("cad-container") as HTMLDivElement;
const status = $("status");
const started = performance.now();
let lastFile = "";
let lastBytes = 0;
let lastLoadMs = 0;
let lastRenderMs = 0;
let errors: string[] = [];

AcApDocManager.createInstance({
  container,
  autoResize: true,
  baseUrl: "https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/",
  useMainThreadDraw: true,
  notificationCenter: false,
  builtinOpenFileDialog: false,
  openDocumentDefaults: () => ({ mode: AcEdOpenMode.Read, progressiveRendering: false }),
});
const manager = AcApDocManager.instance;
const view = manager.mainView;

function entityMetadata(ids: string[]) {
  const result: Record<string, unknown> = {};
  const db = manager.curDocument.database;
  const model = db.tables.blockTable.modelSpace;
  for (const entity of model.newIterator()) {
    if (ids.includes(String(entity.objectId))) {
      result.id = String(entity.objectId);
      result.type = entity.type;
      result.layer = entity.layerName;
      const b = entity.wcsBbox;
      if (b && Number.isFinite(b.min.x)) result.bounds = { minX: b.min.x, minY: b.min.y, maxX: b.max.x, maxY: b.max.y };
      break;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function snapshot(): RuntimeBridge {
  const db = manager.curDocument.database;
  const model = db.tables.blockTable.modelSpace;
  const active = view.cadScene.activeLayout;
  const ids = view.selectionSet.ids.map(String);
  const box = active?.box;
  const visibleBounds = box && !box.isEmpty() ? { minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y, width: box.max.x - box.min.x, height: box.max.y - box.min.y } : null;
  const bounds = visibleBounds;
  const layers = active ? [...active.layers].map(([name, layer]) => ({ name, entity_count: layer.entityCount, visible: layer.visible })) : [];
  const blocks = [...db.tables.blockTable.newIterator()].filter((b) => !b.isModelSapce && !b.isPaperSapce).map((b) => ({ name: b.name, entity_count: b.newIterator().count }));
  const entityCount = model.newIterator().count;
  const rendered = active?.entityCount ?? 0;
  const zoom = view.internalCamera?.zoom ?? 0;
  let center: unknown;
  try { center = view.center; } catch { center = undefined; }
  return {
    app_started: true, browser_loaded: true, loaded: Boolean(lastFile), rendered: rendered > 0,
    asset: lastFile, bytes: lastBytes, entity_count: entityCount, rendered_entity_count: rendered,
    load_ms: lastLoadMs, render_ms: lastRenderMs, browser_responsive: performance.now() - started < 120000,
    zoom, camera: { zoom, center }, selection: { ids, entity: entityMetadata(ids) },
    layers, bounds, visible_bounds: visibleBounds, blocks, errors, unsupported_behavior: "Invalid or missing files are reported by openDocument and do not replace the last valid scene.",
  };
}

function publish() {
  const bridge = snapshot();
  (window as Window & { MLIGHTCAD_RUNTIME?: RuntimeBridge }).MLIGHTCAD_RUNTIME = bridge;
  $("assetName").textContent = bridge.asset || "none";
  $("entityCount").textContent = String(bridge.entity_count);
  $("renderedCount").textContent = String(bridge.rendered_entity_count);
  $("zoomValue").textContent = bridge.zoom.toFixed(3);
  $("selectionValue").textContent = bridge.selection.ids.join(", ") || "none";
  $("layerCount").textContent = String(bridge.layers.length);
  $("boundsValue").textContent = bridge.bounds ? JSON.stringify(bridge.bounds) : "none";
  $("blockValue").textContent = bridge.blocks.length ? JSON.stringify(bridge.blocks) : "none";
  $("layerList").innerHTML = bridge.layers.map((l) => `<li>${l.name}: ${l.entity_count} ${l.visible ? "visible" : "hidden"}</li>`).join("");
  $("entityMetadata").textContent = bridge.selection.entity ? JSON.stringify(bridge.selection.entity, null, 2) : "none";
}

async function openFile(file: File) {
  const begin = performance.now();
  errors = [];
  status.textContent = `Opening ${file.name}`;
  try {
    const content = await file.arrayBuffer();
    const success = await manager.openDocument(file.name, content, { mode: AcEdOpenMode.Read, progressiveRendering: false });
    if (!success) throw new Error(`mlightcad rejected ${file.name}`);
    lastFile = file.name; lastBytes = file.size; lastLoadMs = +(performance.now() - begin).toFixed(3);
    view.zoomToFitDrawing(5000);
    await view.ensureEntitiesConvertedForExport({ includeInvisibleLayers: true, includeLayouts: false });
    lastRenderMs = +(performance.now() - begin).toFixed(3);
    status.textContent = `Loaded ${file.name}`;
    publish();
  } catch (error) {
    errors.push(String(error));
    status.textContent = `Open failed: ${file.name}`;
    publish();
  }
}

input.addEventListener("change", () => { const file = input.files?.[0]; if (file) void openFile(file); input.value = ""; });
$("fitButton").addEventListener("click", () => { view.zoomToFitDrawing(5000); publish(); });
$("deepZoomButton").addEventListener("click", () => { const camera = view.internalCamera; if (camera) camera.zoom = Math.max(5, camera.zoom * 5); view.requestRender?.(); publish(); });
$("selectButton").addEventListener("click", () => {
  const iterator = manager.curDocument.database.tables.blockTable.modelSpace.newIterator();
  const entity = [...iterator][0];
  if (entity) view.selectionSet.add(entity.objectId);
  publish();
});
$("layersButton").addEventListener("click", publish);
$("toggleLayerButton").addEventListener("click", () => {
  const active = view.cadScene.activeLayout;
  const populated = active ? [...active.layers.values()].find((layer) => layer.entityCount > 0) : undefined;
  if (populated) populated.visible = !populated.visible;
  publish();
});
manager.events.documentActivated.addEventListener(() => publish());
window.setInterval(publish, 250);
publish();
