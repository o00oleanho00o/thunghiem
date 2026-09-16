'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const base = process.env.CNB_WEB_URL || 'http://127.0.0.1:4176';
const out = path.join(root, 'evidence/r3/screenshots'); fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForTimeout(1200);
    await page.selectOption('#scenarioSelect', 'r3'); await page.locator('#loadScenario').click(); await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(out, '04-cabinet-before-auto-layout.png'), fullPage: true });
    await page.locator('#productTab').click(); await page.waitForSelector('#productList .asset-card'); await page.screenshot({ path: path.join(out, '01-r3-verified-product-library.png'), fullPage: true });
    await page.locator('#productList .asset-card').first().click(); await page.screenshot({ path: path.join(out, '02-product-detail-provenance.png'), fullPage: true });
    await page.locator('#componentTab').click(); await page.locator('#autoLayout').click(); await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, '05-heuristic-layout.png'), fullPage: true });
    const component = page.locator('[data-component-id]').first(); await component.click({ force: true }); await page.screenshot({ path: path.join(out, '03-bom-product-resolution.png'), fullPage: true });
    await page.locator('#fitCanvas').click(); const box = await component.boundingBox(); const viewport = await page.locator('#canvasViewport').boundingBox(); const x = box ? box.x + box.width / 2 : viewport.x + viewport.width / 2; const y = box ? box.y + box.height / 2 : viewport.y + viewport.height / 2;
    await page.mouse.move(x, y); await page.mouse.wheel(0, -2200); await page.screenshot({ path: path.join(out, '14-deep-zoom-verified-envelope.png'), fullPage: true });
    await page.mouse.down({ button: 'right' }); await page.mouse.move(x + 90, y + 45); await page.mouse.up({ button: 'right' }); await page.screenshot({ path: path.join(out, '06-pan-after-deep-zoom.png'), fullPage: true });
    await page.locator('#autoLayout').click(); await page.screenshot({ path: path.join(out, '10-final-valid-cabinet.png'), fullPage: true });
    await page.evaluate(() => { const a = window.CNB_APP.state.model.components[0]; const b = window.CNB_APP.state.model.components[1]; a.x = b.x; a.y = b.y; window.CNB_APP.validate(); window.CNB_APP.render(); }); await page.screenshot({ path: path.join(out, '07-clearance-overlap-highlight.png'), fullPage: true });
    await page.evaluate(() => { const a = window.CNB_APP.state.model.components[0]; const b = window.CNB_APP.state.model.components[1]; a.x = b.x - a.width - 10; a.y = b.y; a.metadata.serviceAccessDirection = 'right'; a.metadata.serviceAccessDepthMm = 40; b.x = a.x + a.width + 15; window.CNB_APP.validate(); window.CNB_APP.render(); }); await page.screenshot({ path: path.join(out, '08-accessibility-violation-highlight.png'), fullPage: true });
    await page.locator('#exportMenu').click(); await page.locator('#exportMenuItems button[data-export="dxf"]').click(); await page.waitForTimeout(500); await page.screenshot({ path: path.join(out, '09-invalid-export-blocked.png'), fullPage: true });
    await page.selectOption('#scenarioSelect', 'r3'); await page.locator('#loadScenario').click(); await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, '11-canonical-eir-reload.png'), fullPage: true });
    const report = { ok: true, base, screenshots: fs.readdirSync(out).filter((name) => name.endsWith('.png')).sort(), productCards: await page.locator('#productList .asset-card').count(), componentCount: await page.locator('[data-component-id]').count() };
    fs.writeFileSync(path.join(root, 'evidence/r3/r3-browser-evidence.json'), `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
