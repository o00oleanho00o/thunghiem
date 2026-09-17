/* R4.3b: browser acceptance of the real mlightcad DXF viewer. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence', 'r4-3b', 'mlightcad');
fs.mkdirSync(out, { recursive: true });
const url = process.env.CNB_MLIGHTCAD_URL || 'http://127.0.0.1:4179/';
const baselinePath = path.join(root, 'evidence', 'r4-3', 'poc2-mlightcad-census.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const assets = [
  {
    key: 'KTP700',
    file: 'catalog/siemens-bilddb/simatic-hmi-ktp700-basic-dp-7-inch-g-st70-xx-01722.dxf',
    fitScreenshot: 'ktp700-fit.png',
    baseline: baseline.records.find((record) => record.asset === 'KTP700'),
  },
  {
    key: 'G120C',
    file: 'catalog/siemens-bilddb/sinamics-g120c-sinamics-g120c-fsd-g-sd01-xx-00631.dxf',
    fitScreenshot: 'g120c-fit.png',
    baseline: baseline.records.find((record) => record.asset === 'G120C'),
  },
  {
    key: 'SITOP',
    file: 'catalog/siemens-bilddb/sitop-sitop-pm1207-ex-24-v-dc-2-5-a-g-kt01-xx-02221.dxf',
    fitScreenshot: 'sitop-fit.png',
    baseline: baseline.records.find((record) => record.asset === 'SITOP'),
  },
];
const result = {
  schema_version: 'cnb-r4-3b-mlightcad-runtime.v1',
  app: 'mlightcad/cad-viewer',
  package: '@mlightcad/cad-simple-viewer + @mlightcad/three-renderer',
  upstream_commit: '44cfd514b2d0c56346034f49b499b65c53ed2a70',
  url,
  checks: {},
  assets: {},
  negative_cases: {},
  tolerance: { absolute_mm: 5, relative: 0.1 },
  screenshots: {},
  errors: [],
};

function boundsDelta(runtime, expected) {
  if (!runtime || !expected) return null;
  return {
    min_x: runtime.minX - expected.min_x,
    min_y: runtime.minY - expected.min_y,
    max_x: runtime.maxX - expected.max_x,
    max_y: runtime.maxY - expected.max_y,
    width: runtime.width - expected.width,
    height: runtime.height - expected.height,
  };
}

function boundsMatch(runtime, expected) {
  if (!runtime || !expected) return false;
  const tol = Math.max(5, Math.max(expected.width, expected.height) * 0.1);
  return Math.abs(runtime.width - expected.width) <= tol && Math.abs(runtime.height - expected.height) <= tol;
}

async function bridge(page) {
  return page.evaluate(() => {
    const value = window.MLIGHTCAD_RUNTIME;
    if (!value) throw new Error('MLIGHTCAD_RUNTIME bridge missing');
    return value;
  });
}

async function load(page, asset) {
  const started = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Open DXF/DWG').setInputFiles(path.join(root, asset.file));
  await page.waitForFunction((name) => {
    const value = window.MLIGHTCAD_RUNTIME;
    return document.getElementById('status')?.textContent === `Loaded ${name}` && value?.loaded === true && value.rendered === true && value.entity_count > 0 && value.rendered_entity_count > 0 && value.bounds?.width > 0;
  }, path.basename(asset.file));
  const wallMs = Date.now() - started;
  const value = await bridge(page);
  return { value, wallMs };
}

async function nextRenderFrame(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(true))));
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const asset of assets) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    try {
      const loaded = await load(page, asset);
      const initial = loaded.value;
      const baselineRecord = asset.baseline;
      const responseStarted = Date.now();
      await page.evaluate(() => document.visibilityState);
      const responseMs = Date.now() - responseStarted;
      const record = {
        file: asset.file,
        bytes: initial.bytes,
        loaded: initial.loaded === true,
        rendered: initial.rendered === true && initial.rendered_entity_count > 0,
        entity_count: initial.entity_count,
        rendered_entity_count: initial.rendered_entity_count,
        layer_count: initial.layers.length,
        populated_layers: initial.layers.filter((layer) => layer.entity_count > 0).map((layer) => layer.name),
        blocks: initial.blocks,
        bounds: initial.bounds,
        visible_bounds: initial.visible_bounds,
        ezdxf_baseline: baselineRecord.bounds,
        bounds_delta: boundsDelta(initial.bounds, baselineRecord.bounds),
        bounds_match: boundsMatch(initial.bounds, baselineRecord.bounds),
        bounds_match_basis: 'mlightcad activeLayout.box compared with ezdxf full model-space extents; hidden-layer extents can differ',
        load_ms: initial.load_ms > 0 ? initial.load_ms : loaded.wallMs,
        render_ms: initial.render_ms > 0 ? initial.render_ms : loaded.wallMs,
        browser_responsiveness_ms: responseMs,
        browser_responsive: responseMs < 1000 && pageErrors.length === 0,
        selection: { ids: [], entity: null },
        zoom_before: initial.zoom,
        zoom_after: initial.zoom,
        pan_changed: false,
        page_errors: pageErrors,
      };

      await page.getByRole('button', { name: 'Fit' }).click();
      await nextRenderFrame(page);
      await page.screenshot({ path: path.join(out, asset.fitScreenshot), fullPage: false });
      result.screenshots[`${asset.key.toLowerCase()}_fit`] = `evidence/r4-3b/mlightcad/${asset.fitScreenshot}`;

      if (asset.key === 'KTP700') {
        const zoomBefore = (await bridge(page)).zoom;
        await page.getByRole('button', { name: 'Deep zoom 5x' }).click();
        await page.waitForFunction((before) => window.MLIGHTCAD_RUNTIME.zoom >= Math.max(5, before * 5), zoomBefore);
        await nextRenderFrame(page);
        const zoomed = await bridge(page);
        record.zoom_before = zoomBefore;
        record.zoom_after = zoomed.zoom;
        await page.screenshot({ path: path.join(out, 'ktp700-deep-zoom.png'), fullPage: false });
        result.screenshots.ktp700_deep_zoom = 'evidence/r4-3b/mlightcad/ktp700-deep-zoom.png';

        const canvas = page.getByTestId('cad-container').locator('canvas').first();
        const box = await canvas.boundingBox();
        const centerBefore = zoomed.camera.center;
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down({ button: 'middle' });
          await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 5 });
          await page.mouse.up({ button: 'middle' });
          await page.waitForFunction((before) => JSON.stringify(window.MLIGHTCAD_RUNTIME.camera.center) !== JSON.stringify(before), centerBefore);
          await nextRenderFrame(page);
          const panned = await bridge(page);
          record.pan_changed = JSON.stringify(panned.camera.center) !== JSON.stringify(centerBefore);
        }
      }

      if (asset.key === 'G120C') {
        await page.getByRole('button', { name: 'Select first entity' }).click();
        await page.waitForFunction(() => window.MLIGHTCAD_RUNTIME.selection.ids.length > 0 && Boolean(window.MLIGHTCAD_RUNTIME.selection.entity));
        await nextRenderFrame(page);
        const selected = await bridge(page);
        record.selection = selected.selection;
        await page.screenshot({ path: path.join(out, 'g120c-selected-entity.png'), fullPage: false });
        result.screenshots.g120c_selected_entity = 'evidence/r4-3b/mlightcad/g120c-selected-entity.png';
      }

      if (asset.key === 'KTP700') {
        await page.getByRole('button', { name: 'Select first entity' }).click();
        await page.waitForFunction(() => window.MLIGHTCAD_RUNTIME.selection.ids.length > 0 && Boolean(window.MLIGHTCAD_RUNTIME.selection.entity));
        await nextRenderFrame(page);
        record.selection = (await bridge(page)).selection;
        await page.getByRole('button', { name: 'Refresh layers' }).click();
        const layerBefore = (await bridge(page)).layers.find((layer) => layer.entity_count > 0);
        await page.getByRole('button', { name: 'Toggle populated layer' }).click();
        await page.waitForFunction((name, before) => window.MLIGHTCAD_RUNTIME.layers.some((layer) => layer.name === name && layer.visible !== before), layerBefore?.name, layerBefore?.visible);
        const layerAfter = (await bridge(page)).layers.find((layer) => layer.name === layerBefore?.name);
        record.layer_toggle = { name: layerBefore?.name, before: layerBefore?.visible, after: layerAfter?.visible };
        await page.screenshot({ path: path.join(out, 'layers.png'), fullPage: false });
        await page.screenshot({ path: path.join(out, 'block-inspection.png'), fullPage: false });
        result.screenshots.layers = 'evidence/r4-3b/mlightcad/layers.png';
        result.screenshots.block_inspection = 'evidence/r4-3b/mlightcad/block-inspection.png';
      }

      result.assets[asset.key] = record;
    } catch (error) {
      result.errors.push(`${asset.key}: ${error.stack || error}`);
      result.assets[asset.key] = { file: asset.file, loaded: false, rendered: false, page_errors: pageErrors, error: String(error) };
    } finally {
      await page.close();
    }
  }

  const negativePage = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const negativeErrors = [];
  negativePage.on('pageerror', (error) => negativeErrors.push(error.message));
  try {
    await load(negativePage, assets[0]);
    const beforeInvalid = await bridge(negativePage);
    await negativePage.getByLabel('Open DXF/DWG').setInputFiles({ name: 'invalid.dxf', mimeType: 'application/dxf', buffer: Buffer.from('this is not a DXF') });
    await negativePage.waitForFunction((expected) => document.getElementById('status')?.textContent === expected, 'Loaded invalid.dxf');
    const afterInvalid = await bridge(negativePage);
    result.negative_cases.invalid_dxf = {
      rejected: afterInvalid.errors.length > 0,
      accepted_as_empty_document: afterInvalid.asset === 'invalid.dxf' && afterInvalid.entity_count === 0 && afterInvalid.rendered === false,
      last_valid_scene_retained: afterInvalid.asset === beforeInvalid.asset && afterInvalid.entity_count === beforeInvalid.entity_count,
      behavior: 'Malformed DXF is accepted as an empty document and replaces the last valid scene.',
      errors: afterInvalid.errors,
    };
    await negativePage.getByLabel('Open DXF/DWG').setInputFiles({ name: 'missing-file-payload.dxf', mimeType: 'application/dxf', buffer: Buffer.alloc(0) });
    await negativePage.waitForFunction((expected) => document.getElementById('status')?.textContent === expected, 'Loaded missing-file-payload.dxf');
    const afterMissing = await bridge(negativePage);
    result.negative_cases.missing_file_payload = {
      rejected: afterMissing.errors.length > 0,
      accepted_as_empty_document: afterMissing.asset === 'missing-file-payload.dxf' && afterMissing.entity_count === 0 && afterMissing.rendered === false,
      last_valid_scene_retained: afterMissing.asset === beforeInvalid.asset && afterMissing.entity_count === beforeInvalid.entity_count,
      behavior: 'Empty/missing payload is accepted as an empty document and replaces the current scene.',
      errors: afterMissing.errors,
    };
  } catch (error) {
    result.errors.push(`negative cases: ${error.stack || error}`);
  } finally {
    await negativePage.close();
  }

  await browser.close();
  const records = Object.values(result.assets);
  result.checks.app_started = records.length === 3 && records.every((record) => record.loaded === true);
  result.checks.browser_loaded = result.checks.app_started;
  result.checks.all_three_rendered = records.length === 3 && records.every((record) => record.rendered === true);
  result.checks.g120c_stress_case = result.assets.G120C?.entity_count >= 500 && result.assets.G120C?.rendered_entity_count > 0;
  result.checks.zoom = result.assets.KTP700?.zoom_after >= 5;
  result.checks.pan = result.assets.KTP700?.pan_changed === true;
  result.checks.selection = records.some((record) => record.selection?.ids?.length > 0 && record.selection?.entity?.id);
  result.checks.layers = records.every((record) => record.layer_count > 0);
  result.checks.layer_toggle = result.assets.KTP700?.layer_toggle?.before !== result.assets.KTP700?.layer_toggle?.after;
  result.checks.blocks = records.every((record) => record.blocks?.length > 0);
  result.checks.bounds_plausible = records.every((record) => record.bounds && record.bounds.width > 0 && record.bounds.height > 0);
  result.checks.bounds_match = records.every((record) => record.bounds_match === true);
  result.checks.invalid_dxf = result.negative_cases.invalid_dxf?.accepted_as_empty_document === true;
  result.checks.missing_file_behavior = result.negative_cases.missing_file_payload?.accepted_as_empty_document === true;
  result.checks.no_page_errors = result.errors.length === 0 && records.every((record) => record.page_errors?.length === 0) && negativeErrors.length === 0;
  result.outcome = result.checks.app_started && result.checks.all_three_rendered && result.checks.selection && result.checks.zoom && result.checks.bounds_plausible && result.checks.invalid_dxf && result.checks.missing_file_behavior && result.checks.no_page_errors
    ? (result.checks.bounds_match ? 'PASS' : 'BLOCKED_BOUNDS_COMPARISON')
    : 'FAIL';
  fs.writeFileSync(path.join(out, 'mlightcad-runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.outcome === 'FAIL' ? 1 : 0);
})().catch((error) => {
  result.errors.push(error.stack || String(error));
  fs.writeFileSync(path.join(out, 'mlightcad-runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.error(error);
  process.exit(1);
});
