import { PanelLayoutAdapter } from '../../packages/adapters/cabinet-layout/index.js';
import { CadViewerAdapter } from '../../packages/adapters/mlightcad/index.js';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const projectId = 'r5-real-cabinet';
const routeNames = ['overview', 'bom', 'devices', 'panel', 'cad', 'validation', 'export'];
const routePath = {
  overview: `/projects/${projectId}`,
  bom: `/projects/${projectId}/bom`,
  devices: `/projects/${projectId}/devices`,
  panel: `/projects/${projectId}/panel`,
  cad: `/projects/${projectId}/cad`,
  validation: `/projects/${projectId}/validation`,
  export: `/projects/${projectId}/export`,
};
const state = { eir: null, route: 'overview', panel: null, cad: null, selectedCadAsset: null, candidateRevision: null, cadState: null, cadLoadedAssetId: null };

function routeFromLocation() {
  const path = window.location.pathname.replace(/\/$/, '');
  const found = Object.entries(routePath).find(([, value]) => value === path);
  return found ? found[0] : 'overview';
}

function partFor(device) {
  return state.eir?.parts?.find((part) => part.id === device.part_id || part.id === device.partId) || {};
}

function placementFor(device) {
  return state.eir?.placements?.find((placement) => placement.device_id === device.id) || {};
}

function deviceFor(id) {
  return state.eir?.devices?.find((device) => device.id === id) || null;
}

function assetFor(device) {
  const part = partFor(device);
  return { assetId: device?.cad_asset_ref || part.cad_asset_ref || part.source_asset_id, fileName: (part.cad_asset_ref || part.source_asset_id || '').split('/').pop() };
}

function cadSelectionFor(device) {
  if (!device) return null;
  const asset = assetFor(device);
  return asset.assetId ? { ...asset, device } : null;
}

function cadDevices() {
  return (state.eir?.devices || []).filter((device) => cadSelectionFor(device));
}

function workflowLabel() {
  return state.candidateRevision ? `DRAFT · candidate ${state.candidateRevision}` : `${state.eir?.workflow?.state || 'DRAFT'} · candidate`;
}

function setWorkflowStatus() {
  const element = $('#workflowStatus');
  if (element) element.textContent = workflowLabel();
}

function navigate(route, replace = false) {
  if (!routeNames.includes(route)) route = 'overview';
  state.route = route;
  if (replace) history.replaceState({}, '', routePath[route]);
  else history.pushState({}, '', routePath[route]);
  document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === route));
  const workspace = $('.workspace');
  const dashboard = $('#r5-dashboard');
  const cadView = $('#cad-view');
  workspace.hidden = route !== 'panel';
  dashboard.hidden = !['overview', 'bom', 'devices', 'validation', 'export'].includes(route);
  cadView.hidden = route !== 'cad';
  document.body.dataset.r5Route = route;
  if (dashboard.hidden === false) renderDashboard();
  if (route === 'panel') { ensurePanelActions(); state.panel?.requireApp(); state.panel?.app?.render(); syncTruthInspector(); }
  if (route === 'cad') {
    renderCadSourcePicker();
    if (!state.selectedCadAsset) state.selectedCadAsset = cadSelectionFor(cadDevices()[0]);
    if (state.selectedCadAsset) void openCadAsset(state.selectedCadAsset);
    else renderCadEmpty();
  }
}

function renderCadEmpty() {
  const title = $('#cadAssetTitle');
  if (title) title.textContent = 'Chưa chọn CAD';
  const status = $('#status');
  if (status && !state.cadState) status.textContent = 'Chọn CAD từ Product Inspector';
}

function renderOverview() {
  const devices = state.eir.devices || [];
  return `<section class="r5-hero"><span class="eyebrow">CNB ENGINEERING WORKBENCH · R5</span><h1>${esc(state.eir.project.name)}</h1><p>Một project, một EIR và một luồng kỹ thuật từ BOM đến bố trí tủ, review CAD nguồn, kiểm tra và artifact export. OSS chỉ là projection/edit surface.</p><div class="r5-action-row"><a class="button primary" href="${routePath.panel}" data-route="panel">Mở bố trí tủ</a><a class="button subtle" href="${routePath.cad}" data-route="cad">Mở CAD nguồn</a></div></section><section class="r5-card span-4"><h2>Project</h2><div class="r5-kpi"><b>${devices.length}</b><span>thiết bị trong EIR</span></div><div class="r5-kpi"><b>${state.eir.parts?.length || 0}</b><span>part definitions</span></div><div class="r5-kpi"><b>${esc(state.eir.project.revision)}</b><span>revision hiện tại</span></div></section><section class="r5-card span-4"><h2>Workflow</h2><p><span class="r5-status">${esc(workflowLabel())}</span></p><p>Drag và lock chỉ tạo candidate placement. Chỉ engineering review mới được chuyển sang Reviewed/Approved.</p></section><section class="r5-card span-4"><h2>Runtime topology</h2><div class="r5-kpi"><b>1</b><span>frontend · port 4200</span></div><div class="r5-kpi"><b>1</b><span>API · port 8200</span></div><p>4178/4179 chỉ còn là test harness.</p></section><section class="r5-card span-8"><h2>Luồng canonical</h2><p><strong>CNB EIR</strong> → PanelLayoutAdapter → candidate placement → validation → CadViewerAdapter → artifact audit.</p><p>Product identity, footprint, provenance và placement capability đọc từ CNB truth model, không lấy ngược từ OSS.</p></section><section class="r5-card span-4"><h2>OSS policy</h2><p>Cabinet Layout Generator: MIT adapter.</p><p>mlightcad: MIT DXF-only bundle, không DWG/GPL converter.</p></section>`;
}

function renderBom() {
  const rows = (state.eir.parts || []).map((part) => {
    const count = (state.eir.devices || []).filter((device) => device.part_id === part.id).length;
    return `<tr><td>${esc(part.manufacturer)}</td><td><strong>${esc(part.description)}</strong><br><code>${esc(part.mpn)}</code></td><td>${count}</td><td><span class="r5-status">${esc(part.product_identity?.status || 'candidate')}</span></td></tr>`;
  }).join('');
  return `<section class="r5-card span-12"><span class="eyebrow">BILL OF MATERIALS</span><h1>BOM kỹ thuật</h1><p>Danh sách lấy trực tiếp từ EIR. Mã candidate chưa được coi là approved manufacturing BOM.</p><table class="r5-table"><thead><tr><th>Hãng</th><th>Part / order code</th><th>Qty</th><th>Trạng thái</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function renderDevices() {
  const rows = (state.eir.devices || []).map((device) => {
    const part = partFor(device); const placement = placementFor(device); const identity = part.product_identity || {};
    return `<tr><td><strong>${esc(device.tag)}</strong><br>${esc(device.name)}</td><td>${esc(part.manufacturer)}<br>${esc(identity.type_designation || part.description)}</td><td><code>${esc(identity.order_code || part.mpn)}</code></td><td>${esc(part.footprint?.width || placement.width)} × ${esc(part.footprint?.height || placement.height)} mm<br>${esc(part.footprint?.mounting || 'unknown')}</td><td><span class="r5-status">${esc(identity.status || 'candidate')}</span><br><small>placement_capable: false</small></td><td><button class="button subtle compact r5-view-cad" type="button" data-device-id="${esc(device.id)}">Xem CAD</button></td></tr>`;
  }).join('');
  return `<section class="r5-card span-12"><span class="eyebrow">PRODUCT TRUTH</span><h1>Thiết bị</h1><p>Inspector hiển thị identity, footprint và provenance từ EIR/part truth; CAD candidate không tự thành placement-capable.</p><table class="r5-table"><thead><tr><th>Tag</th><th>Identity</th><th>Order code</th><th>Footprint</th><th>Mapping</th><th>Liên kết</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function renderValidation() {
  const issues = state.panel ? state.panel.app.validate() : [];
  const list = issues.length ? issues.map((issue) => `<div class="issue ${issue.severity === 'warn' ? 'warn' : ''}"><span class="issue-code">${esc(issue.code)}</span><div><strong>${esc(issue.message)}</strong><small>${esc(issue.hint || 'CNB validation')}</small></div></div>`).join('') : '<div class="all-clear"><span>✓</span><div><strong>Layout is clear</strong><small>No blocking issues</small></div></div>';
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  const result = errors ? 'BLOCKED' : warnings ? 'REVIEW REQUIRED' : 'PASS';
  return `<section class="r5-card span-8"><span class="eyebrow">CNB VALIDATION</span><h1>Kiểm tra engineering</h1><p>Đây là gate kiểm tra projection hiện tại, không tự duyệt placement. Cảnh báo preview-only là đúng vì ba CAD mapping vẫn là candidate.</p><div class="validation-summary"><span class="r5-status ${errors ? '' : 'ok'}">${result}</span><span>${errors} lỗi · ${warnings} cảnh báo</span></div><div class="validation-list">${list}</div><div class="r5-action-row"><button class="button primary compact" id="r5-run-validation" type="button">Chạy lại kiểm tra</button><span class="validation-run" id="r5-validation-run">${state.validationRunAt ? `Lần chạy cuối: ${esc(state.validationRunAt)}` : 'Chưa chạy thủ công'}</span></div></section><section class="r5-card span-4"><h2>Review gate</h2><p><span class="r5-status">${esc(workflowLabel())}</span></p><p>Candidate placement chưa được duyệt sản xuất.</p><div class="r5-action-row"><a class="button primary" href="${routePath.panel}" data-route="panel">Sửa bố trí</a></div></section>`;
}

function renderExport() {
  return `<section class="r5-card span-8"><span class="eyebrow">EVIDENCE / EXPORT</span><h1>Xuất artifact</h1><p>Mọi export đi qua Engineering API; browser chỉ hiển thị kết quả và metadata audit.</p><div class="r5-action-row"><button class="button primary" id="r5-export-dxf" type="button">Export DXF</button><button class="button export" id="r5-export-svg" type="button">Export SVG</button><button class="button subtle" id="r5-export-audit" type="button">Chạy audit JSON</button></div><pre id="r5-export-output">Chưa có artifact trong phiên này.</pre></section><section class="r5-card span-4"><h2>Artifact contract</h2><div class="r5-kpi"><b>DXF</b><span>canonical format</span></div><div class="r5-kpi"><b>SVG</b><span>visual review</span></div><div class="r5-kpi"><b>JSON</b><span>audit + provenance</span></div><p>Source project: <code>${esc(state.eir.project.id)}</code></p></section>`;
}

function renderDashboard() {
  const target = $('#r5-dashboard-content'); if (!target || !state.eir) return;
  const body = state.route === 'overview' ? renderOverview() : state.route === 'bom' ? renderBom() : state.route === 'devices' ? renderDevices() : state.route === 'validation' ? renderValidation() : renderExport();
  target.innerHTML = body;
  target.querySelectorAll('[data-route]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); navigate(link.dataset.route); }));
  target.querySelectorAll('.r5-view-cad').forEach((button) => button.addEventListener('click', () => { const device = deviceFor(button.dataset.deviceId); if (device) { state.selectedCadAsset = { ...assetFor(device), device }; navigate('cad'); } }));
  $('#r5-run-validation')?.addEventListener('click', () => {
    const issues = state.panel ? state.panel.app.validate() : [];
    state.validationRunAt = new Date().toLocaleTimeString('vi-VN');
    const output = $('#r5-validation-run');
    if (output) output.textContent = `Đã chạy: ${state.validationRunAt} · ${issues.length} mục cần review`;
  });
  $('#r5-export-dxf')?.addEventListener('click', () => void exportArtifact('dxf'));
  $('#r5-export-svg')?.addEventListener('click', () => void exportArtifact('svg'));
  $('#r5-export-audit')?.addEventListener('click', () => void exportArtifact('audit'));
}

async function exportArtifact(format) {
  const output = $('#r5-export-output');
  try {
    const model = state.panel.app.state.model;
    const response = await fetch('/api/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, format }) });
    const content = await response.text();
    if (!response.ok) throw new Error(content);
    const blob = new Blob([content], { type: format === 'dxf' ? 'application/dxf' : format === 'svg' ? 'image/svg+xml' : 'application/json' });
    const href = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = href; link.download = `${projectId}.${format}`; link.click(); URL.revokeObjectURL(href);
    output.textContent = format === 'audit' ? content : JSON.stringify({ format, bytes: blob.size, source_project: state.eir.project.id, revision: state.eir.project.revision, audit: 'Engineering API response' }, null, 2);
  } catch (error) { output.textContent = `Export failed: ${error.message}`; }
}

function renderTruthInspector() {
  let section = $('#r5-truth-inspector');
  if (!section) { section = document.createElement('section'); section.id = 'r5-truth-inspector'; section.className = 'inspector-section r5-truth-section'; $('.right-panel')?.appendChild(section); }
  const component = state.panel?.app?.state?.model?.components?.find((item) => item.id === state.panel.app.state.selectedId);
  if (!component) { section.innerHTML = '<div class="panel-heading"><div><span class="eyebrow">CNB PRODUCT TRUTH</span><h2>No device selected</h2></div></div><p class="empty-state">Chọn một thiết bị trên panel để xem identity và CAD link.</p>'; return; }
  const device = deviceFor(component.id); const part = partFor(device); const identity = part.product_identity || {}; const footprint = part.footprint || {};
  section.innerHTML = `<div class="panel-heading"><div><span class="eyebrow">CNB PRODUCT TRUTH</span><h2>${esc(device?.tag || component.tag)}</h2></div><span class="selection-tag">${esc(identity.status || 'candidate')}</span></div><dl class="r5-truth-list"><div><dt>ProductIdentity</dt><dd>${esc(identity.type_designation || part.description)}</dd></div><div><dt>Manufacturer</dt><dd>${esc(part.manufacturer || 'unknown')}</dd></div><div><dt>Order code</dt><dd class="mono">${esc(identity.order_code || part.mpn || 'unknown')}</dd></div><div><dt>Footprint</dt><dd>${esc(footprint.width || component.width)} × ${esc(footprint.height || component.height)} × ${esc(footprint.depth || component.depth)} mm</dd></div><div><dt>Mounting</dt><dd>${esc(footprint.mounting || 'unknown')}</dd></div><div><dt>CAD representation</dt><dd>${esc(device?.cad_asset_ref || part.source_asset_id || 'none')}</dd></div><div><dt>placement-capable</dt><dd>false · candidate only</dd></div><div><dt>Workflow</dt><dd>${esc(workflowLabel())}</dd></div></dl><button class="button primary compact" id="r5-inspect-cad" type="button">Xem CAD nguồn</button>`;
  $('#r5-inspect-cad')?.addEventListener('click', () => { if (device) { state.selectedCadAsset = { ...assetFor(device), device }; navigate('cad'); } });
}

function renderCadSourcePicker() {
  const select = $('#cadDeviceSelect');
  const openButton = $('#openSelectedCad');
  if (!select || !openButton || !state.eir) return;
  const devices = cadDevices();
  select.innerHTML = devices.map((device) => `<option value="${esc(device.id)}">${esc(device.tag)} · ${esc(device.name)}</option>`).join('');
  const currentId = state.selectedCadAsset?.device?.id;
  select.value = devices.some((device) => device.id === currentId) ? currentId : devices[0]?.id || '';
  select.disabled = devices.length === 0;
  openButton.disabled = devices.length === 0;
  if (select.dataset.bound === 'true') return;
  select.dataset.bound = 'true';
  const openSelection = () => {
    const device = deviceFor(select.value) || devices[0];
    const selection = cadSelectionFor(device);
    if (!selection) return;
    state.selectedCadAsset = selection;
    void openCadAsset(selection);
  };
  select.addEventListener('change', openSelection);
  openButton.addEventListener('click', openSelection);
}

function syncTruthInspector() {
  setWorkflowStatus();
  if (state.route === 'panel') renderTruthInspector();
}

function ensurePanelActions() {
  const tools = $('.canvas-tools'); if (!tools || $('#r5-save-candidate')) return;
  const reflow = document.createElement('button'); reflow.id = 'r5-reflow-candidate'; reflow.className = 'button subtle compact'; reflow.type = 'button'; reflow.textContent = 'Reflow candidate';
  const save = document.createElement('button'); save.id = 'r5-save-candidate'; save.className = 'button primary compact'; save.type = 'button'; save.textContent = 'Lưu candidate';
  tools.append(reflow, save);
  reflow.addEventListener('click', () => { state.panel.app.autoLayout(); syncTruthInspector(); setWorkflowStatus(); });
  save.addEventListener('click', () => void saveCandidate());
}

async function saveCandidate() {
  const output = $('#workflowStatus');
  try {
    const placements = await state.panel.getPlacements();
    const response = await fetch(`/api/projects/${projectId}/placements`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eir: state.eir, placements }) });
    if (!response.ok) throw new Error(await response.text());
    const payload = await response.json(); state.candidateRevision = payload.revision; if (output) output.textContent = workflowLabel();
    window.CNB_APP?.state && (window.CNB_APP.state.candidateRevision = payload.revision);
  } catch (error) { if (output) output.textContent = `DRAFT · save failed`; console.error(error); }
}

async function openCadAsset(selection) {
  const device = selection.device; const title = $('#cadAssetTitle'); if (title) title.textContent = `${device?.tag || ''} · ${device?.name || 'CAD source'}`;
  const picker = $('#cadDeviceSelect'); if (picker && device?.id) picker.value = device.id;
  if (state.cadLoadedAssetId === selection.assetId && window.MLIGHTCAD_RUNTIME?.rendered === true) {
    state.cadState = window.MLIGHTCAD_RUNTIME;
    if ($('#status')) $('#status').textContent = `Loaded ${state.cadState.asset} · linked ${device?.tag || 'device'}`;
    return;
  }
  try {
    await state.cad.open(selection);
    state.cadState = window.MLIGHTCAD_RUNTIME;
    state.cadLoadedAssetId = selection.assetId;
    if ($('#status')) $('#status').textContent = `Loaded ${state.cadState.asset} · linked ${device?.tag || 'device'}`;
  } catch (error) {
    if ($('#status')) $('#status').textContent = `CAD load failed · ${error.message}`;
  }
}

function bindPanelObservers() {
  const svg = $('#panelSvg');
  if (!svg) return;
  const observer = new MutationObserver(() => { if (state.route === 'panel') syncTruthInspector(); });
  observer.observe(svg, { childList: true, subtree: true });
  svg.addEventListener('click', () => requestAnimationFrame(syncTruthInspector));
}

async function boot() {
  const response = await fetch(`/api/projects/${projectId}`);
  if (!response.ok) throw new Error(`Project load failed (${response.status})`);
  state.eir = await response.json();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  state.panel = new PanelLayoutAdapter(window.CNB_APP);
  await state.panel.loadProject(state.eir);
  state.cad = new CadViewerAdapter({ root: $('#cad-view'), onState: (next) => { state.cadState = next; } });
  bindPanelObservers();
  document.querySelectorAll('[data-route]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); navigate(link.dataset.route); }));
  window.addEventListener('popstate', () => navigate(routeFromLocation(), true));
  navigate(routeFromLocation(), true);
}

boot().catch((error) => {
  const target = $('#r5-dashboard-content'); if (target) { $('#r5-dashboard').hidden = false; target.innerHTML = `<section class="r5-card span-12"><h1>Không tải được project</h1><p>${esc(error.message)}</p></section>`; }
});
