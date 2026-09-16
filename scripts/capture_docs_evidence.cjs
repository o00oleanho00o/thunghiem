const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.CNB_DOCS_URL || 'http://127.0.0.1:4177';
const out = path.resolve(__dirname, '../evidence/docs');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const response = await page.goto(`${base}/docs.html`, { waitUntil: 'networkidle' });
  if (!response || !response.ok()) throw new Error(`docs page returned ${response?.status()}`);
  const checks = {
    title: await page.title(),
    h1: await page.locator('h1').textContent(),
    diagrams: await page.locator('.flow-diagram, .bridge-diagram, .component-diagram, .roadmap').count(),
    sections: await page.locator('main section[id]').count(),
    nav: await page.locator('.docs-nav a').count(),
  };
  const links = await page.locator('a[href^="/docs/"], a[href^="/evidence/"]').evaluateAll((items) => items.map((item) => item.getAttribute('href')));
  const linkResults = [];
  for (const href of links) {
    const linkResponse = await page.request.get(`${base}${href}`);
    linkResults.push({ href, status: linkResponse.status(), ok: linkResponse.ok() });
  }
  if (linkResults.some((item) => !item.ok)) throw new Error(`broken docs link: ${JSON.stringify(linkResults)}`);
  await page.screenshot({ path: path.join(out, '01-docs-overview-desktop.png'), fullPage: true });
  for (const [id, name] of [['vision', '02-vision-diagram'], ['dh-company', '03-dh-project-to-factory'], ['architecture', '04-real-component-model'], ['roadmap', '05-roadmap']]) {
    await page.locator(`#${id}`).screenshot({ path: path.join(out, `${name}.png`) });
  }
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto(`${base}/docs.html#vision`, { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: path.join(out, '06-docs-mobile.png'), fullPage: true });
  console.log(JSON.stringify({ ...checks, links: linkResults, screenshots: fs.readdirSync(out).filter((file) => file.endsWith('.png')).sort() }, null, 2));
  await browser.close();
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
