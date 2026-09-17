/* R4.3c: differential lock/reflow evidence against the real browser runtime. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence', 'r4-3c', 'cabinet');
fs.mkdirSync(out, { recursive: true });
const url = process.env.CNB_CABINET_URL || 'http://127.0.0.1:4178/';
const targetId = 'device_e31f877b1100';
const result = {
  schema_version: 'cnb-r4-3c-cabinet-runtime.v1',
  app: 'Taam4142/cabinet-layout-generator',
  upstream_commit: '0633b013dc65d13055b8f3765a27425cb58ec510',
  url,
  checks: {},
  actions: {},
  screenshots: {},
  errors: [],
};

async function bridge(page) {
  return page.evaluate(() => {
    const value = window.CNB_OSS_RUNTIME;
    if (!value) throw new Error('CNB_OSS_RUNTIME bridge missing');
    return {
      app_started: value.app_started,
      browser_loaded: value.browser_loaded,
      project_id: value.project_id,
      plate: value.plate,
      devices: value.devices,
      ducts: value.ducts,
      rail_proxies: value.rail_proxies,
      selected: value.selected,
      placements: value.placements,
      issues: value.issues,
      last_reflow: value.last_reflow,
      export: value.export,
      timings: value.timings,
    };
  });
}

async function ready(page) {
  await page.locator('canvas').first().waitFor();
  await page.getByTestId('model-count').waitFor();
  await page.waitForFunction(() => window.CNB_OSS_RUNTIME?.browser_loaded === true);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  page.on('pageerror', (error) => result.errors.push(`pageerror: ${error.message}`));
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await ready(page);
    const initial = await bridge(page);
    result.checks.app_started = initial.app_started === true;
    result.checks.browser_loaded = initial.browser_loaded === true;
    result.checks.cnb_model_loaded = initial.project_id === 'project_4de34d02badc' && initial.devices === 9;
    result.checks.plate_visible = initial.plate.width_mm === 500 && initial.plate.height_mm === 1100;
    result.checks.duct_visibility = initial.ducts === 3;
    result.checks.rail_proxy_visibility = initial.rail_proxies === 2;

    await page.getByTestId('lock-fixture-button').click();
    await page.waitForFunction((id) => {
      const value = window.CNB_OSS_RUNTIME;
      return value?.selected?.some((selection) => selection.id === id) && value.placements[id]?.x_mm === 320 && value.placements[id]?.locked === false;
    }, targetId);
    const unlockedBefore = await bridge(page);
    await page.screenshot({ path: path.join(out, '01-before-reflow-unlocked.png'), fullPage: true });
    result.screenshots.before_reflow_unlocked = 'evidence/r4-3c/cabinet/01-before-reflow-unlocked.png';

    await page.getByTestId('reflow-button').click();
    await page.waitForFunction((id) => {
      const value = window.CNB_OSS_RUNTIME;
      return value?.last_reflow?.moved_ids?.includes(id) && Math.abs(value.placements[id].x_mm - 320) >= 30;
    }, targetId);
    const unlockedAfter = await bridge(page);
    const unlockedDelta = Math.hypot(unlockedAfter.placements[targetId].x_mm - unlockedBefore.placements[targetId].x_mm, unlockedAfter.placements[targetId].y_mm - unlockedBefore.placements[targetId].y_mm);
    result.actions.unlocked_before = unlockedBefore.placements[targetId];
    result.actions.unlocked_after = unlockedAfter.placements[targetId];
    result.actions.unlocked_delta_mm = +unlockedDelta.toFixed(2);
    result.checks.unlocked_branch_moved = unlockedDelta >= 30;
    await page.screenshot({ path: path.join(out, '02-after-reflow-unlocked-moved.png'), fullPage: true });
    result.screenshots.after_reflow_unlocked = 'evidence/r4-3c/cabinet/02-after-reflow-unlocked-moved.png';

    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    await page.getByTestId('lock-fixture-button').click();
    await page.waitForFunction((id) => window.CNB_OSS_RUNTIME?.placements[id]?.x_mm === 320 && window.CNB_OSS_RUNTIME?.placements[id]?.locked === false, targetId);
    await page.getByTestId('lock-button').click();
    await page.waitForFunction((id) => window.CNB_OSS_RUNTIME?.placements[id]?.x_mm === 320 && window.CNB_OSS_RUNTIME?.placements[id]?.locked === true, targetId);
    const lockedBefore = await bridge(page);
    await page.screenshot({ path: path.join(out, '03-before-reflow-locked.png'), fullPage: true });
    result.screenshots.before_reflow_locked = 'evidence/r4-3c/cabinet/03-before-reflow-locked.png';

    await page.getByTestId('reflow-button').click();
    await page.waitForFunction((id) => window.CNB_OSS_RUNTIME?.last_reflow?.locked_ids?.includes(id), targetId);
    const lockedAfter = await bridge(page);
    const lockedDelta = Math.hypot(lockedAfter.placements[targetId].x_mm - lockedBefore.placements[targetId].x_mm, lockedAfter.placements[targetId].y_mm - lockedBefore.placements[targetId].y_mm);
    result.actions.locked_before = lockedBefore.placements[targetId];
    result.actions.locked_after = lockedAfter.placements[targetId];
    result.actions.locked_delta_mm = +lockedDelta.toFixed(2);
    result.checks.locked_branch_unchanged = lockedDelta === 0 && lockedAfter.placements[targetId].x_mm === lockedBefore.placements[targetId].x_mm && lockedAfter.placements[targetId].y_mm === lockedBefore.placements[targetId].y_mm;
    await page.screenshot({ path: path.join(out, '04-after-reflow-locked-unchanged.png'), fullPage: true });
    result.screenshots.after_reflow_locked = 'evidence/r4-3c/cabinet/04-after-reflow-locked-unchanged.png';

    result.actions.unlocked_delta_mm = +unlockedDelta.toFixed(2);
    result.actions.locked_delta_mm = +lockedDelta.toFixed(2);
    result.actions.lock_semantics_pass = result.checks.unlocked_branch_moved && result.checks.locked_branch_unchanged;
    result.checks.lock_semantics_pass = result.actions.lock_semantics_pass;

    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    const svgDownload = page.waitForEvent('download');
    await page.getByTestId('svg-export-button').click();
    const svg = await svgDownload;
    const svgPath = path.join(out, 'runtime-export.svg');
    await svg.saveAs(svgPath);
    const dxfDownload = page.waitForEvent('download');
    await page.getByTestId('dxf-export-button').click();
    const dxf = await dxfDownload;
    const dxfPath = path.join(out, 'runtime-export.dxf');
    await dxf.saveAs(dxfPath);
    await page.waitForFunction(() => window.CNB_OSS_RUNTIME?.export?.svg === true && window.CNB_OSS_RUNTIME?.export?.dxf === true);
    result.checks.export = true;
    result.actions.export_bytes = { svg: fs.statSync(svgPath).size, dxf: fs.statSync(dxfPath).size };
    result.screenshots.export = 'evidence/r4-3c/cabinet/05-export-result.png';
    await page.screenshot({ path: path.join(out, '05-export-result.png'), fullPage: true });
  } catch (error) {
    result.errors.push(error.stack || String(error));
  } finally {
    await browser.close();
  }
  result.checks.no_page_errors = result.errors.length === 0;
  result.outcome = result.checks.app_started && result.checks.cnb_model_loaded && result.checks.lock_semantics_pass && result.checks.export && result.checks.no_page_errors ? 'PASS' : 'FAIL';
  fs.writeFileSync(path.join(out, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.outcome === 'PASS' ? 0 : 1);
}

run().catch((error) => { result.errors.push(error.stack || String(error)); fs.writeFileSync(path.join(out, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`); process.exit(1); });
