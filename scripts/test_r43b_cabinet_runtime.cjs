/* R4.3b: browser acceptance of the real Cabinet Layout Generator editor. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence', 'r4-3b', 'cabinet');
fs.mkdirSync(out, { recursive: true });
const url = process.env.CNB_CABINET_URL || 'http://127.0.0.1:4178/';
const targetId = 'device_e31f877b1100';
const railIds = ['__rail_rail_5294e7104596', '__rail_rail_5135d0e2abe6'];
const result = {
  schema_version: 'cnb-r4-3b-cabinet-runtime.v1',
  app: 'Taam4142/cabinet-layout-generator',
  upstream_commit: '0633b013dc65d13055b8f3765a27425cb58ec510',
  url,
  checks: {},
  actions: {},
  timings: {},
  artifacts: {},
  errors: [],
};

async function bridge(page) {
  return page.evaluate(() => {
    const b = window.CNB_OSS_RUNTIME;
    if (!b) throw new Error('CNB_OSS_RUNTIME bridge missing');
    return {
      app_started: b.app_started,
      browser_loaded: b.browser_loaded,
      project_id: b.project_id,
      project_name: b.project_name,
      plate: b.plate,
      devices: b.devices,
      rail_proxies: b.rail_proxies,
      ducts: b.ducts,
      selected: b.selected,
      placements: b.placements,
      issues: b.issues,
      zoom: b.zoom,
      export: b.export,
      timings: b.timings,
      drag_jank: b.drag_jank,
    };
  });
}

async function point(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const b = window.CNB_OSS_RUNTIME;
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const p = b.pointFor(x, y);
    return { x: rect.left + p.x, y: rect.top + p.y };
  }, { x, y });
}

async function waitBridge(page, predicate, message) {
  await page.waitForFunction(predicate, undefined, message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  page.on('pageerror', (error) => result.errors.push(`pageerror: ${error.message}`));
  const startupAt = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas').first().waitFor();
  await page.getByTestId('model-count').waitFor();
  const initial = await bridge(page);
  result.timings.startup_ms = Date.now() - startupAt;
  result.timings.model_load_ms = initial.timings.model_load_ms;
  result.timings.first_render_ms = initial.timings.first_render_ms;
  result.checks.app_started = initial.app_started === true;
  result.checks.browser_loaded = initial.browser_loaded === true;
  result.checks.cnb_model_loaded = initial.project_id === 'project_4de34d02badc' && initial.devices === 9;
  result.checks.plate_visible = initial.plate.width_mm === 500 && initial.plate.height_mm === 1100;
  result.checks.device_visibility = initial.devices === 9;
  result.checks.duct_visibility = initial.ducts === 3;
  result.checks.rail_proxy_visibility = initial.rail_proxies === 2 && railIds.every((id) => initial.placements[id]);
  await page.screenshot({ path: path.join(out, '01-loaded-cnb-project.png'), fullPage: true });

  const device = initial.placements[targetId];
  if (!device) throw new Error(`target placement missing: ${targetId}`);
  const selectedPoint = await point(page, device.x_mm + 45, device.y_mm + 50);
  await page.mouse.click(selectedPoint.x, selectedPoint.y);
  await waitBridge(page, () => window.CNB_OSS_RUNTIME.selected.some((s) => s.id === 'device_e31f877b1100'), 'selection');
  result.checks.selection = (await bridge(page)).selected.some((s) => s.id === targetId);
  await page.screenshot({ path: path.join(out, '02-selected-component.png'), fullPage: true });

  await page.evaluate(() => {
    window.__frameSamples = [];
    let last = performance.now();
    const tick = (now) => { window.__frameSamples.push(now - last); last = now; if (window.__frameSamples.length < 80) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const beforeDrag = (await bridge(page)).placements[targetId];
  const from = await point(page, beforeDrag.x_mm + 45, beforeDrag.y_mm + 50);
  const to = await point(page, beforeDrag.x_mm + 85, beforeDrag.y_mm + 50);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await waitBridge(page, () => Math.abs(window.CNB_OSS_RUNTIME.placements['device_e31f877b1100'].x_mm - 90) >= 30, 'drag placement delta');
  const afterDrag = await bridge(page);
  const deltaMm = afterDrag.placements[targetId].x_mm - beforeDrag.x_mm;
  const frames = await page.evaluate(() => window.__frameSamples || []);
  result.actions.drag_delta_mm = deltaMm;
  result.actions.drag_frame_max_gap_ms = frames.length ? Math.max(...frames) : null;
  result.checks.drag = Math.abs(deltaMm) >= 30 && Math.abs(deltaMm) <= 50;
  result.checks.drag_jank = result.actions.drag_frame_max_gap_ms === null || result.actions.drag_frame_max_gap_ms < 100;
  await page.screenshot({ path: path.join(out, '03-after-drag.png'), fullPage: true });

  await page.getByTestId('lock-button').click();
  await waitBridge(page, () => window.CNB_OSS_RUNTIME.placements['device_e31f877b1100'].locked === true, 'lock state');
  const lockedBeforeReflow = (await bridge(page)).placements[targetId];
  result.checks.lock = lockedBeforeReflow.locked === true;
  await page.screenshot({ path: path.join(out, '04-lock-state.png'), fullPage: true });

  await page.getByTestId('reflow-button').click();
  await page.locator('[data-testid="selection-state"]').waitFor();
  const afterReflow = await bridge(page);
  result.actions.locked_position_before_reflow = { x_mm: lockedBeforeReflow.x_mm, y_mm: lockedBeforeReflow.y_mm };
  result.actions.locked_position_after_reflow = { x_mm: afterReflow.placements[targetId].x_mm, y_mm: afterReflow.placements[targetId].y_mm };
  result.checks.snap_or_reflow = afterReflow.placements[targetId].x_mm === lockedBeforeReflow.x_mm && afterReflow.placements[targetId].y_mm === lockedBeforeReflow.y_mm;
  await page.screenshot({ path: path.join(out, '05-snap-or-reflow.png'), fullPage: true });

  await page.getByTestId('overlap-button').click();
  await waitBridge(page, () => window.CNB_OSS_RUNTIME.issues.some((i) => i.code === 'OVERLAP'), 'overlap warning');
  const overlap = await bridge(page);
  result.checks.validation = overlap.issues.some((i) => i.code === 'OVERLAP');
  result.actions.overlap_issue_codes = overlap.issues.map((i) => i.code);
  await page.screenshot({ path: path.join(out, '06-overlap-warning.png'), fullPage: true });

  await page.getByTestId('offplate-button').click();
  await waitBridge(page, () => window.CNB_OSS_RUNTIME.issues.some((i) => i.code === 'OFF_PLATE'), 'off plate warning');
  result.checks.off_plate_warning = (await bridge(page)).issues.some((i) => i.code === 'OFF_PLATE');
  await page.getByTestId('missing-library-button').click();
  await waitBridge(page, () => window.CNB_OSS_RUNTIME.issues.some((i) => i.code === 'UNRESOLVED_LIB_KEY'), 'missing library error');
  result.checks.missing_library_behavior = (await bridge(page)).issues.some((i) => i.code === 'UNRESOLVED_LIB_KEY');

  // Reset to the original POC before export so the export result is a valid
  // runtime artifact, not an offline adapter artifact or an invalid fixture.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('canvas').first().waitFor();
  await waitBridge(page, () => window.CNB_OSS_RUNTIME.browser_loaded === true, 'reset');
  const svgDownload = page.waitForEvent('download');
  await page.getByTestId('svg-export-button').click();
  const svg = await svgDownload;
  const svgPath = path.join(out, 'runtime-export.svg');
  await svg.saveAs(svgPath);
  await waitBridge(page, () => window.CNB_OSS_RUNTIME.export.svg === true, 'svg export');
  const dxfDownload = page.waitForEvent('download');
  await page.getByTestId('dxf-export-button').click();
  const dxf = await dxfDownload;
  const dxfPath = path.join(out, 'runtime-export.dxf');
  await dxf.saveAs(dxfPath);
  await waitBridge(page, () => window.CNB_OSS_RUNTIME.export.dxf === true, 'dxf export');
  const exported = await bridge(page);
  result.checks.export = exported.export.svg === true && exported.export.dxf === true && fs.statSync(svgPath).size > 100 && fs.statSync(dxfPath).size > 100;
  result.actions.export_bytes = { svg: fs.statSync(svgPath).size, dxf: fs.statSync(dxfPath).size };
  result.timings.export_svg_ms = exported.timings.export_svg_ms || null;
  result.timings.export_dxf_ms = exported.timings.export_dxf_ms || null;
  result.artifacts.runtime_svg = path.relative(root, svgPath).replaceAll('\\', '/');
  result.artifacts.runtime_dxf = path.relative(root, dxfPath).replaceAll('\\', '/');
  await page.screenshot({ path: path.join(out, '07-export-result.png'), fullPage: true });

  const auditPath = path.join(out, 'runtime-export.audit.json');
  execFileSync(process.env.CNB_PYTHON || 'python', [path.join(root, 'scripts', 'audit_dxf_ezdxf.py'), dxfPath], { stdio: ['ignore', fs.openSync(auditPath, 'w'), 'inherit'] });
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  result.checks.dxf_ezdxf_audit = audit.valid === true && audit.entityCount > 0;
  result.artifacts.dxf_ezdxf_audit = path.relative(root, auditPath).replaceAll('\\', '/');
  const bundleDir = path.resolve(root, 'research/cloned-or-scripted-spikes/cabinet-layout-generator/web/dist/assets');
  result.timings.production_bundle_bytes = fs.existsSync(bundleDir) ? fs.readdirSync(bundleDir).filter((f) => /\.js$/.test(f)).reduce((n, f) => n + fs.statSync(path.join(bundleDir, f)).size, 0) : null;
  result.checks.all_required = Object.entries(result.checks).filter(([key]) => !['all_required'].includes(key)).every(([, value]) => value === true);
  fs.writeFileSync(path.join(out, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  await browser.close();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.checks.app_started && result.checks.browser_loaded && result.checks.cnb_model_loaded && result.checks.selection && result.checks.drag && result.checks.lock && result.checks.snap_or_reflow && result.checks.validation && result.checks.export && result.checks.dxf_ezdxf_audit ? 0 : 1);
})().catch((error) => { result.errors.push(error.stack || String(error)); fs.writeFileSync(path.join(out, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`); console.error(error); process.exit(1); });
