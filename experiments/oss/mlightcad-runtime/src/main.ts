import {
  AcApDocManager,
  AcEdOpenMode,
  ACGI_PAPER_SPACE_BACKGROUND,
  layoutBackgroundColorFromRgb,
} from "@mlightcad/cad-simple-viewer";
import { AcGeBox2d } from "@mlightcad/data-model";
import sourceAudit from "../../../../evidence/r4-3c/mlightcad/g120c-left-extent-entities.json";
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
  full_model_bounds: Box | null;
  rendered_bounds: Box | null;
  source_full_bounds: Box | null;
  source_visible_bounds: Box | null;
  blocks: Array<{ name: string; entity_count: number }>;
  errors: string[];
  unsupported_behavior: string;
  input_validation: { last_attempt: string; accepted: boolean; reason?: string };
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
let lastValidPayload: { name: string; content: ArrayBuffer } | undefined;
let inputValidation: RuntimeBridge["input_validation"] = { last_attempt: "none", accepted: false };
let overlayBounds = false;
let overlayLeftExtent = false;
let restoringLastValid = false;

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
view.backgroundColor = ACGI_PAPER_SPACE_BACKGROUND;

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

function boxFrom(value: any): Box | null {
  const min = value?.min ?? value?.extmin;
  const max = value?.max ?? value?.extmax;
  if (!min || !max || ![min.x, min.y, max.x, max.y].every(Number.isFinite)) return null;
  return { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y, width: max.x - min.x, height: max.y - min.y };
}

function unionBoxes(values: Array<Box | null>): Box | null {
  const boxes = values.filter((value): value is Box => Boolean(value));
  if (!boxes.length) return null;
  const minX = Math.min(...boxes.map((value) => value.minX));
  const minY = Math.min(...boxes.map((value) => value.minY));
  const maxX = Math.max(...boxes.map((value) => value.maxX));
  const maxY = Math.max(...boxes.map((value) => value.maxY));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function modelBounds(db: any): Box | null {
  const model = db.tables.blockTable.modelSpace;
  return unionBoxes([...model.newIterator()].map((entity: any) => boxFrom(entity.geometricExtents ?? entity.wcsBbox)));
}

function g120cSourceBounds(): { full: Box; visible: Box; left: Box } | null {
  const source = sourceAudit as any;
  const full = source.full_source_model_space_bounds;
  const visible = source.visible_source_bounds;
  const left = source.left_extent_entities?.[0]?.world_bbox;
  if (!full || !visible || !left) return null;
  const toBox = (value: any): Box => ({ minX: value.min_x, minY: value.min_y, maxX: value.max_x, maxY: value.max_y, width: value.width, height: value.height });
  return { full: toBox(full), visible: toBox(visible), left: toBox(left) };
}

function sourceBoundsForAsset(): { full: Box; visible: Box; left: Box } | null {
  return /g120c/i.test(lastFile) ? g120cSourceBounds() : null;
}

function validateDxfPayload(fileName: string, content: ArrayBuffer): string | undefined {
  if (!/\.dxf$/i.test(fileName)) return "Only ASCII DXF input is accepted by this runtime gate.";
  if (content.byteLength < 64) return `DXF payload is too small (${content.byteLength} bytes).`;
  const lines = new TextDecoder("utf-8", { fatal: false }).decode(content).split(/\r?\n/).map((line) => line.trim().toUpperCase());
  const hasPair = (code: string, value: string) => lines.some((line, index) => line === code && lines[index + 1] === value);
  if (!hasPair("0", "SECTION") || !hasPair("2", "ENTITIES") || !hasPair("0", "EOF")) {
    return "DXF section/header markers are incomplete.";
  }
  if (validateCandidate(fileName, content) <= 0) return "DXF has no meaningful model-space drawing entities.";
  return undefined;
}

function validateCandidate(_fileName: string, content: ArrayBuffer): number {
  const lines = new TextDecoder("utf-8", { fatal: false }).decode(content).split(/\r?\n/).map((line) => line.trim().toUpperCase());
  const known = new Set(["LINE", "LWPOLYLINE", "POLYLINE", "CIRCLE", "ARC", "ELLIPSE", "SPLINE", "HATCH", "TEXT", "MTEXT", "INSERT", "POINT", "SOLID", "3DFACE", "ATTDEF", "ATTRIB"]);
  const entitiesPair = lines.findIndex((line, index) => line === "2" && lines[index + 1] === "ENTITIES");
  if (entitiesPair < 0) return 0;
  const end = lines.findIndex((line, index) => index > entitiesPair && line === "0" && lines[index + 1] === "ENDSEC");
  if (end < 0) return 0;
  let count = 0;
  for (let index = entitiesPair + 2; index < end - 1; index += 1) if (lines[index] === "0" && known.has(lines[index + 1])) count += 1;
  return count;
}

function overlayRect(box: Box, stroke: string, label: string, dashed = false) {
  const svg = $("debugOverlay") as unknown as SVGSVGElement;
  const points = [view.worldToScreen({ x: box.minX, y: box.minY }), view.worldToScreen({ x: box.minX, y: box.maxY }), view.worldToScreen({ x: box.maxX, y: box.minY }), view.worldToScreen({ x: box.maxX, y: box.maxY })];
  const left = Math.min(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const right = Math.max(...points.map((point) => point.x));
  const bottom = Math.max(...points.map((point) => point.y));
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", String(left)); rect.setAttribute("y", String(top)); rect.setAttribute("width", String(right - left)); rect.setAttribute("height", String(bottom - top)); rect.setAttribute("fill", "none"); rect.setAttribute("stroke", stroke); rect.setAttribute("stroke-width", "2");
  if (dashed) rect.setAttribute("stroke-dasharray", "8 5");
  svg.appendChild(rect);
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", String(Math.max(4, left + 4))); text.setAttribute("y", String(Math.max(16, top + 16))); text.setAttribute("fill", stroke); text.setAttribute("font-size", "13"); text.setAttribute("font-weight", "700"); text.textContent = label;
  svg.appendChild(text);
}

function drawOverlay(bridge: RuntimeBridge) {
  const svg = $("debugOverlay") as unknown as SVGSVGElement;
  svg.innerHTML = "";
  const source = sourceBoundsForAsset();
  if (!source || (!overlayBounds && !overlayLeftExtent)) { svg.hidden = true; return; }
  svg.hidden = false;
  if (overlayBounds) {
    if (bridge.rendered_bounds) overlayRect(bridge.rendered_bounds, "#16a3ff", "mlightcad rendered");
    overlayRect(source.full, "#ff5b5b", "ezdxf full", true);
    overlayRect(source.visible, "#ffbf3f", "ezdxf visible", true);
  }
  if (overlayLeftExtent) overlayRect(source.left, "#ff2ac3", "MTEXT 80 left extent");
}

function snapshot(): RuntimeBridge {
  const db = manager.curDocument.database;
  const model = db.tables.blockTable.modelSpace;
  const active = view.cadScene.activeLayout;
  const ids = view.selectionSet.ids.map(String);
  const box = active?.box;
  const renderedBounds = box && !box.isEmpty() ? { minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y, width: box.max.x - box.min.x, height: box.max.y - box.min.y } : null;
  const fullModelBounds = modelBounds(db);
  const source = sourceBoundsForAsset();
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
    layers, bounds: fullModelBounds, visible_bounds: renderedBounds, full_model_bounds: fullModelBounds, rendered_bounds: renderedBounds,
    source_full_bounds: source?.full ?? null, source_visible_bounds: source?.visible ?? null,
    blocks, errors, unsupported_behavior: "Invalid input is preflighted and candidate-parsed before openDocument; failed candidates retain the last valid scene.", input_validation: inputValidation,
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
  $("renderedBoundsValue").textContent = bridge.rendered_bounds ? JSON.stringify(bridge.rendered_bounds) : "none";
  $("sourceBoundsValue").textContent = bridge.source_full_bounds ? `full ${JSON.stringify(bridge.source_full_bounds)}; visible ${JSON.stringify(bridge.source_visible_bounds)}` : "none";
  $("blockValue").textContent = bridge.blocks.length ? JSON.stringify(bridge.blocks) : "none";
  $("layerList").innerHTML = bridge.layers.map((l) => `<li>${l.name}: ${l.entity_count} ${l.visible ? "visible" : "hidden"}</li>`).join("");
  $("entityMetadata").textContent = bridge.selection.entity ? JSON.stringify(bridge.selection.entity, null, 2) : "none";
  $("inputValidationValue").textContent = bridge.input_validation.accepted ? `accepted: ${bridge.input_validation.last_attempt}` : `${bridge.input_validation.last_attempt}: ${bridge.input_validation.reason ?? "rejected"}`;
  drawOverlay(bridge);
}

async function openFile(file: File) {
  const begin = performance.now();
  errors = [];
  inputValidation = { last_attempt: file.name, accepted: false };
  status.textContent = `Opening ${file.name}`;
  try {
    const content = await file.arrayBuffer();
    const preflightError = validateDxfPayload(file.name, content);
    if (preflightError) throw new Error(preflightError);
    const candidateEntityCount = validateCandidate(file.name, content);
    if (candidateEntityCount <= 0) throw new Error("Candidate contains no meaningful model content.");
    const success = await manager.openDocument(file.name, content, { mode: AcEdOpenMode.Read, progressiveRendering: false });
    if (!success) throw new Error(`mlightcad rejected ${file.name}`);
    const modelEntityCount = manager.curDocument.database.tables.blockTable.modelSpace.newIterator().count;
    if (modelEntityCount <= 0) throw new Error("mlightcad candidate scene is empty after open.");
    view.backgroundColor = ACGI_PAPER_SPACE_BACKGROUND;
    lastFile = file.name; lastBytes = file.size; lastLoadMs = +(performance.now() - begin).toFixed(3);
    lastValidPayload = { name: file.name, content: content.slice(0) };
    inputValidation = { last_attempt: file.name, accepted: true };
    view.zoomToFitDrawing(5000);
    await view.ensureEntitiesConvertedForExport({ includeInvisibleLayers: true, includeLayouts: false });
    lastRenderMs = +(performance.now() - begin).toFixed(3);
    status.textContent = `Loaded ${file.name}`;
    publish();
  } catch (error) {
    errors.push(String(error));
    status.textContent = lastValidPayload ? `Open failed: ${file.name}; last valid scene retained` : `Open failed: ${file.name}`;
    inputValidation = { last_attempt: file.name, accepted: false, reason: String(error) };
    if (lastValidPayload) {
      restoringLastValid = true;
      try {
        const restored = await manager.openDocument(lastValidPayload.name, lastValidPayload.content.slice(0), { mode: AcEdOpenMode.Read, progressiveRendering: false });
        if (restored) {
          view.backgroundColor = ACGI_PAPER_SPACE_BACKGROUND;
          view.zoomToFitDrawing(5000);
          await view.ensureEntitiesConvertedForExport({ includeInvisibleLayers: true, includeLayouts: false });
        }
      } catch (restoreError) {
        errors.push(`restore failed: ${String(restoreError)}`);
      } finally {
        restoringLastValid = false;
      }
    }
    publish();
  }
}

input.addEventListener("change", () => { const file = input.files?.[0]; if (file) void openFile(file); input.value = ""; });
$("fitButton").addEventListener("click", () => { view.zoomToFitDrawing(5000); publish(); });
$("deepZoomButton").addEventListener("click", () => { const camera = view.internalCamera; if (camera) camera.zoom = Math.max(5, camera.zoom * 5); view.requestRender?.(); publish(); });
$("boundsButton").addEventListener("click", () => { overlayBounds = !overlayBounds; publish(); });
$("leftExtentButton").addEventListener("click", () => { overlayLeftExtent = !overlayLeftExtent; publish(); });
$("sourceFitButton").addEventListener("click", () => { const source = sourceBoundsForAsset(); if (!source) return; const box = new AcGeBox2d(); box.min.set(source.full.minX, source.full.minY); box.max.set(source.full.maxX, source.full.maxY); view.zoomTo(box, 1.05); publish(); });
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
manager.events.documentActivated.addEventListener(() => { if (!restoringLastValid) publish(); });
(window as Window & { AcApDocManager?: typeof AcApDocManager }).AcApDocManager = AcApDocManager;
publish();
