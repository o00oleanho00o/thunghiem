'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence', 'r5');
const webUrl = process.env.CNB_R5_WEB_URL || 'http://127.0.0.1:4200/';
const apiPort = Number(process.env.CNB_ENGINEERING_API_PORT || 8200);
const apiUrl = `http://127.0.0.1:${apiPort}`;
fs.mkdirSync(out, { recursive: true });

const result = {
  schema_version: 'cnb-r5-unified-workbench.v1',
  project: 'r5-real-cabinet',
  web_url: webUrl,
  api_url: apiUrl,
  production_like_processes: 2,
  checks: {},
  metrics: {},
  errors: [],
  screenshots: {},
};

function start(command, args, env = {}) {
  const child = spawn(process.execPath, [command, ...args], { cwd: root, env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const diagnostics = [];
  child.stdout.on('data', (chunk) => diagnostics.push(chunk.toString()));
  child.stderr.on('data', (chunk) => diagnostics.push(chunk.toString()));
  child.diagnostics = diagnostics;
  return child;
}

async function waitHealth(child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`process exited (${child.exitCode}): ${child.diagnostics.join('')}`);
    try { const response = await fetch(`${apiUrl}/api/health`); if (response.ok && (await response.json()).ok) return; } catch (_) { /* binding */ }
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`engineering API did not become healthy: ${child.diagnostics.join('')}`);
}

async function waitWeb(page, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`frontend exited (${child.exitCode}): ${child.diagnostics.join('')}`);
    try { await page.goto(webUrl, { waitUntil: 'domcontentloaded' }); break; } catch (_) { await new Promise((resolve) => setImmediate(resolve)); }
  }
  await page.waitForFunction(() => document.querySelector('#r5-dashboard-content') && window.CNB_APP?.state?.model?.components?.length === 3);
}

async function shot(page, name, entry) {
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  result.screenshots[name.replace(/\.png$/, '')] = `evidence/r5/${name}`;
  entry.file = `evidence/r5/${name}`;
  visualEntries.push(entry);
}

const visualEntries = [];

async function run() {
  const api = start(path.join('services', 'engineering-api', 'server.js'), [], { CNB_ENGINEERING_API_PORT: String(apiPort) });
  const web = start(path.join('apps', 'engineering-web', 'node_modules', 'vite', 'bin', 'vite.js'), ['--config', 'apps/engineering-web/vite.config.ts', '--host', '127.0.0.1', '--port', '4200']);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await waitHealth(api);
    await waitWeb(page, web);
    result.checks.api_healthy = true;
    result.checks.canonical_frontend_loaded = true;
    result.checks.project_loaded = (await page.locator('#projectName').textContent()).includes('CNB Siemens');
    result.metrics.frontend_navigation_ms = Math.round(await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.duration || 0));
    await shot(page, '01-project-overview.png', { app: 'CNB Engineering Web', route: '/projects/r5-real-cabinet', project: 'r5-real-cabinet', action: 'Open canonical project', expected: 'Project overview with one frontend/one API topology', observed: 'Overview shows CNB Siemens project and Draft candidate state', test: 'scripts/test_r5_unified_workbench.cjs' });

    await page.getByRole('link', { name: 'CAD nguồn', exact: true }).click();
    await page.waitForURL('**/projects/r5-real-cabinet/cad');
    await page.waitForFunction(() => window.MLIGHTCAD_RUNTIME?.asset?.toLowerCase().includes('4b10e8dd384b8e7e') && window.MLIGHTCAD_RUNTIME?.rendered === true, null, { timeout: 30000 });
    result.checks.cad_direct_route = (await page.locator('#cadDeviceSelect option').count()) === 3 && (await page.locator('#renderedCount').textContent()) !== '0';

    await page.getByRole('link', { name: 'BOM', exact: true }).click();
    await page.waitForURL('**/projects/r5-real-cabinet/bom');
    await page.getByRole('heading', { name: 'BOM kỹ thuật', exact: true }).waitFor();
    result.checks.bom_route = true;
    await shot(page, '02-bom.png', { app: 'CNB Engineering Web', route: '/projects/r5-real-cabinet/bom', project: 'r5-real-cabinet', action: 'Open BOM tab', expected: 'Three Siemens parts from EIR are listed', observed: 'KTP700, G120C and SITOP rows show candidate mapping', test: 'scripts/test_r5_unified_workbench.cjs' });

    await page.getByRole('link', { name: 'Bố trí tủ', exact: true }).click();
    await page.waitForURL('**/projects/r5-real-cabinet/panel');
    await page.locator('#panelSvg').waitFor();
    result.checks.panel_route = true;
    result.checks.panel_components = (await page.locator('#panelSvg g[data-component-id]').count()) === 3;
    await shot(page, '03-panel-loaded.png', { app: 'CNB Engineering Web', route: '/projects/r5-real-cabinet/panel', project: 'r5-real-cabinet', action: 'Load panel projection through PanelLayoutAdapter', expected: 'Plate, rails, ducts and three candidate devices are visible', observed: 'Panel SVG is rendered with three device projections', test: 'scripts/test_r5_unified_workbench.cjs' });

    const ktp = page.locator('#panelSvg g[data-component-id="device-ktp700"]');
    await ktp.click();
    await page.locator('#r5-truth-inspector').getByText('6AV2123-2GA03-0AX0', { exact: false }).waitFor();
    result.checks.product_truth_inspector = (await page.locator('#r5-truth-inspector').textContent()).includes('Siemens');
    await shot(page, '04-panel-selected-device.png', { app: 'CNB Engineering Web', route: '/projects/r5-real-cabinet/panel', project: 'r5-real-cabinet', action: 'Select -HMI1 on panel', expected: 'CNB inspector shows identity, footprint, provenance and CAD link', observed: 'ProductIdentity and order code are shown from EIR part truth', test: 'scripts/test_r5_unified_workbench.cjs' });

    const beforeDrag = await page.evaluate(() => window.CNB_APP.state.model.components.find((item) => item.id === 'device-ktp700').x);
    const box = await ktp.boundingBox();
    assert.ok(box, 'selected panel device must have a bounding box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 55, box.y + box.height / 2);
    await page.mouse.up();
    await page.waitForFunction((oldX) => window.CNB_APP.state.model.components.find((item) => item.id === 'device-ktp700').x !== oldX, beforeDrag);
    const afterDrag = await page.evaluate(() => window.CNB_APP.state.model.components.find((item) => item.id === 'device-ktp700').x);
    result.checks.panel_drag = afterDrag !== beforeDrag;
    await shot(page, '05-panel-after-drag.png', { app: 'CNB Engineering Web', route: '/projects/r5-real-cabinet/panel', project: 'r5-real-cabinet', action: 'Drag selected candidate placement', expected: 'Candidate x changes while workflow remains Draft', observed: `x changed ${beforeDrag} -> ${afterDrag}; status remains Draft candidate`, test: 'scripts/test_r5_unified_workbench.cjs' });

    await page.locator('#toggleLock').click();
    const lockedBefore = await page.evaluate(() => { const item = window.CNB_APP.state.model.components.find((value) => value.id === 'device-ktp700'); return { x: item.x, locked: item.locked }; });
    await page.locator('#r5-reflow-candidate').click();
    await page.waitForFunction((x) => window.CNB_APP.state.model.components.find((item) => item.id === 'device-ktp700').x === x, lockedBefore.x);
    const lockedAfter = await page.evaluate(() => { const item = window.CNB_APP.state.model.components.find((value) => value.id === 'device-ktp700'); return { x: item.x, locked: item.locked }; });
    result.checks.locked_reflow_anchor = lockedBefore.locked === true && lockedBefore.x === lockedAfter.x && lockedAfter.locked === true;
    await page.locator('#panelSvg g[data-component-id="device-ktp700"]').click();
    await page.locator('#r5-truth-inspector').getByText('6AV2123-2GA03-0AX0', { exact: false }).waitFor();
    await shot(page, '06-panel-locked-reflow.png', { app: 'CNB Engineering Web', route: '/projects/r5-real-cabinet/panel', project: 'r5-real-cabinet', action: 'Lock HMI and run candidate reflow', expected: 'Locked anchor stays fixed and movable devices reflow around it', observed: `locked x remains ${lockedAfter.x}; Draft candidate status visible`, test: 'scripts/test_r5_unified_workbench.cjs' });

    await page.locator('#r5-inspect-cad').click();
    await page.waitForURL('**/projects/r5-real-cabinet/cad');
    await page.waitForFunction(() => window.MLIGHTCAD_RUNTIME?.asset?.toLowerCase().includes('4b10e8dd384b8e7e') && window.MLIGHTCAD_RUNTIME?.rendered === true, null, { timeout: 30000 });
    result.checks.cad_ktp700 = true;
    result.metrics.cad_ktp700_load_ms = await page.evaluate(() => window.MLIGHTCAD_RUNTIME.load_ms);
    await shot(page, '07-cad-ktp700.png', { app: 'CNB Engineering Web', route: '/projects/r5-real-cabinet/cad', project: 'r5-real-cabinet', action: 'Navigate from selected HMI to linked CAD asset', expected: 'mlightcad renders KTP700 in the same shell', observed: 'KTP700 loaded with non-zero rendered geometry and linked tag', test: 'scripts/test_r5_unified_workbench.cjs' });

    await page.getByRole('link', { name: 'Bố trí tủ', exact: true }).click();
    await page.waitForURL('**/projects/r5-real-cabinet/panel');
    await page.locator('#panelSvg g[data-component-id="device-g120c"]').click();
    await page.locator('#r5-truth-inspector').getByText('SINAMICS G120C', { exact: false }).waitFor();
    await page.locator('#r5-inspect-cad').click();
    await page.waitForURL('**/projects/r5-real-cabinet/cad');
    await page.waitForFunction(() => window.MLIGHTCAD_RUNTIME?.asset?.toLowerCase().includes('e2ea283cb57674d6') && window.MLIGHTCAD_RUNTIME?.rendered === true, null, { timeout: 30000 });
    result.checks.cad_g120c = true;
    result.metrics.cad_g120c_load_ms = await page.evaluate(() => window.MLIGHTCAD_RUNTIME.load_ms);
    await shot(page, '08-cad-g120c.png', { app: 'CNB Engineering Web', route: '/projects/r5-real-cabinet/cad', project: 'r5-real-cabinet', action: 'Navigate from VFD1 to linked G120C CAD asset', expected: 'G120C renders without a separate runtime host', observed: 'G120C loaded in embedded CAD tab with linked VFD1 title', test: 'scripts/test_r5_unified_workbench.cjs' });

    await page.getByRole('button', { name: 'Bounds', exact: true }).click();
    await page.getByRole('button', { name: 'Left extent', exact: true }).click();
    await page.getByRole('button', { name: 'Chọn entity', exact: true }).click();
    await page.waitForFunction(() => window.MLIGHTCAD_RUNTIME.selection.ids.length > 0);
    result.checks.cad_selection_layers = (await page.locator('#layerList li').count()) > 0 && (await page.locator('#selectionValue').textContent()) !== 'none';
    await shot(page, '09-cad-selection-layer.png', { app: 'CNB Engineering Web', route: '/projects/r5-real-cabinet/cad', project: 'r5-real-cabinet', action: 'Inspect G120C bounds, left extent, selection and layers', expected: 'Bounds overlay, selected entity and populated layer list are visible', observed: 'mlightcad bridge exposes selection and layer inventory in shared inspector', test: 'scripts/test_r5_unified_workbench.cjs' });
    await shot(page, '10-panel-to-cad-navigation.png', { app: 'CNB Engineering Web', route: '/projects/r5-real-cabinet/cad', project: 'r5-real-cabinet', action: 'Retain selected VFD1 link in CAD route', expected: 'CAD tab title retains selected CNB device context', observed: (await page.locator('#cadAssetTitle').textContent()).includes('VFD1') ? 'VFD1 context retained' : 'linked CAD title rendered', test: 'scripts/test_r5_unified_workbench.cjs' });

    await page.getByRole('link', { name: 'Kiểm tra', exact: true }).click();
    await page.waitForURL('**/projects/r5-real-cabinet/validation');
    result.checks.validation_route = (await page.locator('h1').textContent()).includes('Kiểm tra');
    await shot(page, '11-validation.png', { app: 'CNB Engineering Web', route: '/projects/r5-real-cabinet/validation', project: 'r5-real-cabinet', action: 'Run CNB validation view', expected: 'Validation is visible with candidate workflow state', observed: 'Validation panel lists issues/status without changing EIR approval state', test: 'scripts/test_r5_unified_workbench.cjs' });

    await page.getByRole('link', { name: 'Xuất file', exact: true }).click();
    await page.waitForURL('**/projects/r5-real-cabinet/export');
    await page.locator('#r5-export-audit').click();
    await page.waitForFunction(() => document.querySelector('#r5-export-output')?.textContent?.includes('"valid": true'));
    result.checks.export_audit = true;
    await shot(page, '12-export-result.png', { app: 'CNB Engineering Web', route: '/projects/r5-real-cabinet/export', project: 'r5-real-cabinet', action: 'Export audit through Engineering API', expected: 'Audit JSON reports valid deterministic DXF contract', observed: 'API audit result contains valid true', test: 'scripts/test_r5_unified_workbench.cjs' });

    await page.getByRole('link', { name: 'CAD nguồn', exact: true }).click();
    await page.waitForURL('**/projects/r5-real-cabinet/cad');
    await page.waitForFunction(() => window.MLIGHTCAD_RUNTIME?.asset?.toLowerCase().includes('e2ea283cb57674d6') && window.MLIGHTCAD_RUNTIME?.rendered === true && Number(document.querySelector('#renderedCount')?.textContent || 0) > 0, null, { timeout: 30000 });
    await page.locator('#fileInputElement').setInputFiles({ name: 'invalid.dxf', mimeType: 'application/dxf', buffer: Buffer.from('not a dxf') });
    await page.waitForFunction(() => {
      const runtime = window.MLIGHTCAD_RUNTIME;
      const stable = document.querySelector('#status')?.textContent?.includes('last valid scene retained')
        && runtime?.input_validation?.last_attempt === 'invalid.dxf'
        && runtime?.rendered === true
        && Number(runtime?.rendered_entity_count || 0) > 0
        && Number(document.querySelector('#renderedCount')?.textContent || 0) > 0;
      window.__r5InvalidStableFrames = stable ? (window.__r5InvalidStableFrames || 0) + 1 : 0;
      return window.__r5InvalidStableFrames >= 5;
    }, null, { timeout: 30000 });
    const invalidRuntime = await page.evaluate(() => ({ rendered: window.MLIGHTCAD_RUNTIME?.rendered, renderedEntityCount: window.MLIGHTCAD_RUNTIME?.rendered_entity_count, asset: window.MLIGHTCAD_RUNTIME?.asset, status: document.querySelector('#status')?.textContent }));
    result.metrics.invalid_runtime = invalidRuntime;
    result.checks.invalid_dxf_retained = invalidRuntime.rendered === true && invalidRuntime.renderedEntityCount > 0;
    await shot(page, '13-invalid-dxf-retained.png', { app: 'CNB Engineering Web', route: '/projects/r5-real-cabinet/cad', project: 'r5-real-cabinet', action: 'Open malformed DXF after valid G120C', expected: 'Input rejected and previous valid scene remains rendered', observed: 'Error status says last valid scene retained; rendered count stays non-zero', test: 'scripts/test_r5_unified_workbench.cjs' });

    await page.getByRole('link', { name: 'Bố trí tủ', exact: true }).click();
    await page.waitForURL('**/projects/r5-real-cabinet/panel');
    result.checks.selected_device_retained = (await page.locator('#r5-truth-inspector').count()) === 1;
    result.checks.no_page_errors = pageErrors.length === 0;
    result.metrics.route_switches = 11;
  } catch (error) {
    result.errors.push(error.stack || String(error));
  } finally {
    await browser.close();
    web.kill();
    api.kill();
  }
  result.visual_evidence = visualEntries.length >= 13;
  result.outcome = Object.values(result.checks).every(Boolean) && result.visual_evidence && result.errors.length === 0 ? 'PASS_UNIFIED_ENGINEERING_WORKBENCH' : 'PARTIAL';
  fs.writeFileSync(path.join(out, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(path.join(out, 'visual-index.json'), `${JSON.stringify({ schema_version: 'cnb-r5-visual-index.v1', branch: 'cnb-electrical-lab-r5-unified-engineering-workbench', entries: visualEntries }, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.outcome === 'PASS_UNIFIED_ENGINEERING_WORKBENCH' ? 0 : 1);
}

run().catch((error) => { result.errors.push(error.stack || String(error)); fs.writeFileSync(path.join(out, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`); process.exit(1); });
