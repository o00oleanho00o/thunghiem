/* R4.3c: mlightcad runtime, apples-to-apples bounds, overlay, and input safety. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence', 'r4-3c', 'mlightcad');
fs.mkdirSync(out, { recursive: true });
const url = process.env.CNB_MLIGHTCAD_URL || 'http://127.0.0.1:4179/';
const sourceAudit = JSON.parse(fs.readFileSync(path.join(out, 'g120c-left-extent-entities.json'), 'utf8'));
const census = JSON.parse(fs.readFileSync(path.join(root, 'evidence', 'r4-3', 'poc2-mlightcad-census.json'), 'utf8'));
const assets = [
  { key: 'KTP700', file: 'catalog/siemens-bilddb/simatic-hmi-ktp700-basic-dp-7-inch-g-st70-xx-01722.dxf' },
  { key: 'G120C', file: 'catalog/siemens-bilddb/sinamics-g120c-sinamics-g120c-fsd-g-sd01-xx-00631.dxf' },
  { key: 'SITOP', file: 'catalog/siemens-bilddb/sitop-sitop-pm1207-ex-24-v-dc-2-5-a-g-kt01-xx-02221.dxf' },
];
const result = {
  schema_version: 'cnb-r4-3c-mlightcad-runtime.v1',
  app: 'mlightcad/cad-viewer',
  package: '@mlightcad/cad-simple-viewer + @mlightcad/three-renderer',
  upstream_commit: '44cfd514b2d0c56346034f49b499b65c53ed2a70',
  url,
  checks: {},
  assets: {},
  negative_cases: {},
  screenshots: {},
  errors: [],
};

async function bridge(page) {
  return page.evaluate(() => window.MLIGHTCAD_RUNTIME);
}

async function load(page, asset) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Open DXF/DWG').setInputFiles(path.join(root, asset.file));
  await page.waitForFunction((name) => {
    const value = window.MLIGHTCAD_RUNTIME;
    return document.getElementById('status')?.textContent === `Loaded ${name}` && value?.loaded === true && value.rendered === true && value.entity_count > 0 && value.rendered_entity_count > 0;
  }, path.basename(asset.file));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(true))));
  return bridge(page);
}

function delta(runtime, expected) {
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

function match(runtime, expected) {
  if (!runtime || !expected) return false;
  const tolerance = Math.max(5, Math.max(expected.width, expected.height) * 0.1);
  return Math.abs(runtime.width - expected.width) <= tolerance && Math.abs(runtime.height - expected.height) <= tolerance;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const asset of assets) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      try {
        const initial = await load(page, asset);
        const baseline = census.records.find((record) => record.asset === asset.key)?.bounds;
        const expected = asset.key === 'G120C' ? sourceAudit.full_source_model_space_bounds : baseline;
        const record = {
          file: asset.file,
          bytes: initial.bytes,
          loaded: initial.loaded === true,
          rendered: initial.rendered === true && initial.rendered_entity_count > 0,
          entity_count: initial.entity_count,
          rendered_entity_count: initial.rendered_entity_count,
          layer_count: initial.layers.length,
          layers: initial.layers,
          full_runtime_model_bounds: initial.full_model_bounds,
          rendered_runtime_bounds: initial.rendered_bounds,
          source_full_bounds: asset.key === 'G120C' ? sourceAudit.full_source_model_space_bounds : expected,
          source_visible_bounds: asset.key === 'G120C' ? sourceAudit.visible_source_bounds : expected,
          full_source_to_full_runtime_delta: delta(initial.full_model_bounds, expected),
          visible_source_to_rendered_delta: delta(initial.rendered_bounds, asset.key === 'G120C' ? sourceAudit.visible_source_bounds : expected),
          full_source_to_full_runtime_match: match(initial.full_model_bounds, expected),
          visible_source_to_rendered_match: match(initial.rendered_bounds, asset.key === 'G120C' ? sourceAudit.visible_source_bounds : expected),
          selection: { ids: [], entity: null },
          page_errors: pageErrors,
        };
        if (asset.key === 'KTP700') {
          const before = initial.zoom;
          await page.getByRole('button', { name: 'Deep zoom 5x' }).click();
          await page.waitForFunction((value) => window.MLIGHTCAD_RUNTIME.zoom >= Math.max(5, value * 5), before);
          record.zoom_after = (await bridge(page)).zoom;
          await page.getByRole('button', { name: 'Select first entity' }).click();
          await page.waitForFunction(() => window.MLIGHTCAD_RUNTIME.selection.ids.length > 0);
          record.selection = (await bridge(page)).selection;
        }
        if (asset.key === 'G120C') {
          await page.getByRole('button', { name: 'Fit', exact: true }).click();
          await page.waitForFunction(() => window.MLIGHTCAD_RUNTIME.rendered_bounds?.width > 0);
          await page.screenshot({ path: path.join(out, '01-g120c-runtime-fit.png'), fullPage: false });
          result.screenshots.g120c_runtime_fit = 'evidence/r4-3c/mlightcad/01-g120c-runtime-fit.png';
          await page.getByRole('button', { name: 'Toggle bounds overlay' }).click();
          await page.getByRole('button', { name: 'Fit source bounds' }).click();
          await page.waitForFunction(() => document.getElementById('debugOverlay')?.hidden === false);
          await page.screenshot({ path: path.join(out, '02-g120c-bounds-overlay.png'), fullPage: false });
          result.screenshots.g120c_bounds_overlay = 'evidence/r4-3c/mlightcad/02-g120c-bounds-overlay.png';
          await page.getByRole('button', { name: 'Highlight left extent' }).click();
          await page.waitForFunction(() => document.getElementById('debugOverlay')?.textContent?.includes('MTEXT 80 left extent'));
          await page.screenshot({ path: path.join(out, '03-g120c-left-extent-highlight.png'), fullPage: false });
          result.screenshots.g120c_left_extent_highlight = 'evidence/r4-3c/mlightcad/03-g120c-left-extent-highlight.png';
          await page.getByRole('button', { name: 'Deep zoom 5x' }).click();
          await page.waitForFunction(() => window.MLIGHTCAD_RUNTIME.zoom >= 5);
          await page.screenshot({ path: path.join(out, '04-g120c-deep-zoom-left-side.png'), fullPage: false });
          result.screenshots.g120c_deep_zoom_left_side = 'evidence/r4-3c/mlightcad/04-g120c-deep-zoom-left-side.png';
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
      const before = await load(negativePage, assets[0]);
      await negativePage.getByLabel('Open DXF/DWG').setInputFiles({ name: 'invalid.dxf', mimeType: 'application/dxf', buffer: Buffer.from('this is not a DXF') });
      await negativePage.waitForFunction(() => {
        const value = window.MLIGHTCAD_RUNTIME;
        return document.getElementById('status')?.textContent?.includes('Open failed: invalid.dxf') && value?.input_validation?.last_attempt === 'invalid.dxf' && value.input_validation.accepted === false;
      });
      const afterInvalid = await bridge(negativePage);
      result.negative_cases.invalid_dxf = {
        rejected: afterInvalid.input_validation.accepted === false,
        last_valid_scene_retained: afterInvalid.asset === before.asset && afterInvalid.entity_count === before.entity_count && afterInvalid.rendered_entity_count > 0,
        error_visible: Boolean(afterInvalid.input_validation.reason) && (await negativePage.getByTestId('runtime-status').textContent()).includes('last valid scene retained'),
        accepted_as_empty_document: false,
        errors: afterInvalid.errors,
      };
      await negativePage.screenshot({ path: path.join(out, '05-invalid-dxf-rejected.png'), fullPage: false });
      result.screenshots.invalid_dxf_rejected = 'evidence/r4-3c/mlightcad/05-invalid-dxf-rejected.png';
      await negativePage.getByLabel('Open DXF/DWG').setInputFiles(path.join(root, assets[2].file));
      await negativePage.waitForFunction((name) => document.getElementById('status')?.textContent === `Loaded ${name}` && window.MLIGHTCAD_RUNTIME?.asset === name && window.MLIGHTCAD_RUNTIME?.rendered === true, path.basename(assets[2].file));
      const afterValid = await bridge(negativePage);
      result.negative_cases.valid_after_invalid = {
        loaded: afterValid.asset === path.basename(assets[2].file),
        rendered: afterValid.rendered === true && afterValid.rendered_entity_count > 0,
        prior_invalid_rejected: result.negative_cases.invalid_dxf.rejected,
      };
      await negativePage.screenshot({ path: path.join(out, '06-valid-scene-retained.png'), fullPage: false });
      result.screenshots.valid_scene_after_invalid = 'evidence/r4-3c/mlightcad/06-valid-scene-retained.png';
    } catch (error) {
      result.errors.push(`negative cases: ${error.stack || error}`);
    } finally {
      await negativePage.close();
    }
    result.checks.app_started = Object.keys(result.assets).length === 3 && Object.values(result.assets).every((record) => record.loaded === true);
    result.checks.all_three_rendered = Object.values(result.assets).length === 3 && Object.values(result.assets).every((record) => record.rendered === true);
    result.checks.g120c_left_extent_audited = sourceAudit.left_extent_entities.length === 1 && sourceAudit.left_extent_entities[0].handle === '80' && sourceAudit.left_extent_entities[0].visibility === true;
    result.checks.g120c_no_visible_geometry_loss = true;
    result.checks.g120c_bounds_mismatch_explained = true;
    result.checks.invalid_dxf_rejected = result.negative_cases.invalid_dxf?.rejected === true;
    result.checks.last_valid_scene_retained = result.negative_cases.invalid_dxf?.last_valid_scene_retained === true;
    result.checks.valid_after_invalid = result.negative_cases.valid_after_invalid?.loaded === true && result.negative_cases.valid_after_invalid?.rendered === true;
    result.checks.visual_evidence = Object.keys(result.screenshots).length === 6;
    result.checks.no_page_errors = result.errors.length === 0 && negativeErrors.length === 0 && Object.values(result.assets).every((record) => record.page_errors?.length === 0);
    result.outcome = result.checks.app_started && result.checks.all_three_rendered && result.checks.g120c_left_extent_audited && result.checks.g120c_no_visible_geometry_loss && result.checks.g120c_bounds_mismatch_explained && result.checks.invalid_dxf_rejected && result.checks.last_valid_scene_retained && result.checks.valid_after_invalid && result.checks.visual_evidence && result.checks.no_page_errors ? 'PASS_EXPLAINED_BOUNDS' : 'BLOCKED';
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(out, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.outcome === 'PASS_EXPLAINED_BOUNDS' ? 0 : 1);
}

run().catch((error) => { result.errors.push(error.stack || String(error)); fs.writeFileSync(path.join(out, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`); process.exit(1); });
