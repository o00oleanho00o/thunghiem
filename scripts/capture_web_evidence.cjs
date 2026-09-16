'use strict';

// Uses Chrome's local DevTools protocol so the evidence is produced by the
// running browser UI without adding a browser automation dependency to the lab.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const screenshotDir = path.join(root, 'evidence', 'screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9237;
const profile = path.join(root, '.chrome-evidence-profile');
const webUrl = process.env.CNB_WEB_URL || 'http://127.0.0.1:4173/';

function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
async function getTab() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      const tabs = await response.json();
      const tab = tabs.find((item) => item.type === 'page');
      if (tab && tab.webSocketDebuggerUrl) return tab;
    } catch (_) { /* Chrome is still starting. */ }
    await delay(100);
  }
  throw new Error('Chrome DevTools endpoint did not start');
}

function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map(); let sequence = 0;
  const ready = new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', (event) => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const item = pending.get(message.id); pending.delete(message.id); if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result); } });
  return { ready, command(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }, close() { socket.close(); } };
}

async function evaluate(cdp, expression) {
  const result = await cdp.command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  return result.result?.value;
}
async function screenshot(cdp, filename) {
  const result = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(screenshotDir, filename), Buffer.from(result.data, 'base64'));
}
async function click(cdp, selector) {
  await evaluate(cdp, `document.querySelector(${JSON.stringify(selector)}).click()`);
}
async function waitForReady(cdp) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await evaluate(cdp, 'document.readyState') === 'complete' && await evaluate(cdp, 'Boolean(window.CNB_APP)')) return;
    await delay(100);
  }
  throw new Error('web editor did not become ready');
}

(async () => {
  const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1600,1000', webUrl], { windowsHide: true, stdio: 'ignore' });
  try {
    const tab = await getTab(); const cdp = connect(tab.webSocketDebuggerUrl); await cdp.ready; await cdp.command('Page.enable'); await cdp.command('Runtime.enable'); await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false }); await waitForReady(cdp);
    await screenshot(cdp, '01-panel-initial.png');

    // Exercise a real toolbar action and capture the resulting layout.
    await click(cdp, '#autoLayout');
    const afterLayout = await evaluate(cdp, '({ issues: window.CNB_APP.state.issues.length, components: window.CNB_APP.state.model.components.length, issueCodes: window.CNB_APP.state.issues.map(i=>i.code), first: window.CNB_APP.state.model.components.slice(0,3).map(c=>({id:c.id,x:c.x,y:c.y,w:c.width,h:c.height})) })');
    await screenshot(cdp, '02-panel-auto-layout.png');

    // Exercise the library's actual drag/drop path, then select and move a
    // device via CDP mouse events (the same pointer path used by a human drag).
    const beforeDrop = await evaluate(cdp, 'window.CNB_APP.state.model.components.length');
    await evaluate(cdp, '(() => { const source=document.querySelector("[data-kind=\\"terminal\\"]"); const target=document.querySelector("#panelSvg"); const data=new DataTransfer(); data.setData("text/cnb-component", "terminal"); source.dispatchEvent(new DragEvent("dragstart", { bubbles:true, dataTransfer:data })); const r=target.getBoundingClientRect(); target.dispatchEvent(new DragEvent("dragover", { bubbles:true, clientX:r.left+r.width*.55, clientY:r.top+r.height*.5, dataTransfer:data })); target.dispatchEvent(new DragEvent("drop", { bubbles:true, clientX:r.left+r.width*.55, clientY:r.top+r.height*.5, dataTransfer:data })); })()');
    const afterDrop = await evaluate(cdp, 'window.CNB_APP.state.model.components.length');
    const targetBox = await evaluate(cdp, '(() => { const e=document.querySelector("[data-component-id=\\"device-001\\"] rect"); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()');
    await cdp.command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: targetBox.x, y: targetBox.y });
    await cdp.command('Input.dispatchMouseEvent', { type: 'mousePressed', x: targetBox.x, y: targetBox.y, button: 'left', clickCount: 1 });
    await cdp.command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: targetBox.x + 42, y: targetBox.y + 18, button: 'left', buttons: 1 });
    await cdp.command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: targetBox.x + 42, y: targetBox.y + 18, button: 'left', clickCount: 1 });
    const afterMove = await evaluate(cdp, '({ selected: window.CNB_APP.state.selectedId, components: window.CNB_APP.state.model.components.length, issues: window.CNB_APP.state.issues.length, emptyHidden: document.querySelector("#inspectorEmpty").hidden, formHidden: document.querySelector("#inspectorForm").hidden })');
    await screenshot(cdp, '03-panel-manual-placement.png');

    await evaluate(cdp, 'document.querySelector("#exportMenu").click(); document.querySelector("[data-export=\\"json\\"]").click();');
    const report = { generatedAt: new Date().toISOString(), beforeDrop, afterDrop, dragAdded: afterDrop === beforeDrop + 1, afterLayout, afterMove, url: webUrl };
    fs.writeFileSync(path.join(root, 'evidence', 'test-logs', 'web-ui-evidence.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    cdp.close();
  } finally {
    child.kill();
  }
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
