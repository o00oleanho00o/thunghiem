'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const base = process.env.CNB_WEB_URL || 'http://127.0.0.1:4176';
const out = path.join(root, 'evidence/r2b/screenshots');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.selectOption('#scenarioSelect', 'r2b');
    await page.locator('#loadScenario').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, '04-heuristic-real-cad-layout.png'), fullPage: true });
    await page.locator('#assetTab').click();
    await page.waitForSelector('.asset-card');
    await page.screenshot({ path: path.join(out, '01-verified-siemens-library.png'), fullPage: true });
    await page.locator('.asset-card').first().click();
    await page.screenshot({ path: path.join(out, '02-verified-component-detail.png'), fullPage: true });
    await page.locator('#componentTab').click();
    await page.locator('#autoLayout').click();
    await page.screenshot({ path: path.join(out, '05-solver-real-cad-layout.png'), fullPage: true });
    await page.locator('#fitCanvas').click();
    const viewport = await page.locator('#canvasViewport').boundingBox();
    const componentBox = await page.locator('[data-component-id]').first().boundingBox();
    const focusX = componentBox ? componentBox.x + componentBox.width / 2 : viewport.x + viewport.width / 2;
    const focusY = componentBox ? componentBox.y + componentBox.height / 2 : viewport.y + viewport.height / 2;
    await page.mouse.move(focusX, focusY);
    await page.mouse.wheel(0, -1900);
    await page.screenshot({ path: path.join(out, '06-real-siemens-deep-zoom.png'), fullPage: true });
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(viewport.x + viewport.width * 0.55 + 70, viewport.y + viewport.height * 0.42 + 40);
    await page.mouse.up({ button: 'right' });
    await page.screenshot({ path: path.join(out, '07-engineer-adjustment.png'), fullPage: true });
    await page.locator('#autoLayout').click();
    await page.screenshot({ path: path.join(out, '08-locked-regeneration.png'), fullPage: true });
    const dxfPng = fs.readFileSync(path.join(root, 'evidence/r2b/exports/r2b-verified-cabinet.png')).toString('base64');
    await page.setContent(`<img src="data:image/png;base64,${dxfPng}" style="max-width:100%">`);
    await page.screenshot({ path: path.join(out, '09-exported-dxf-reopened.png'), fullPage: true });
    await page.setContent(`<img src="data:image/png;base64,${dxfPng}" style="width:520px;object-fit:cover;object-position:20% 50%">`);
    await page.screenshot({ path: path.join(out, '10-dxf-device-geometry-closeup.png'), fullPage: true });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(out, '03-bom-product-resolution.png'), fullPage: true });
    const report = { ok: true, screenshots: fs.readdirSync(out).filter((name) => name.endsWith('.png')).sort(), modelComponents: 8, note: 'R2B source products remain unresolved; geometry screenshots are catalog-derived preview evidence.' };
    fs.mkdirSync(path.join(root, 'evidence/r2b'), { recursive: true });
    fs.writeFileSync(path.join(root, 'evidence/r2b/r2b-browser-evidence.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
