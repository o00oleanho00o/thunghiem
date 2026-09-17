'use strict';

// Browser-side loader for the pinned mlightcad bundle. The OSS runtime remains
// a component inside the CNB shell; it is never an application entrypoint.
export class CadViewerAdapter {
  constructor({ root, onState } = {}) {
    this.root = root;
    this.onState = onState || (() => {});
    this.loaded = false;
    this.loading = null;
  }

  mount() {
    if (!this.root) throw new Error('CAD adapter root is required');
    if (this.loaded) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = '/vendor/mlightcad-runtime.js';
      script.dataset.cnbMlightcad = 'true';
      script.onload = () => { this.loaded = true; resolve(); };
      script.onerror = () => reject(new Error('Pinned mlightcad bundle failed to load'));
      this.root.appendChild(script);
    });
    return this.loading;
  }

  async open(asset) {
    await this.mount();
    if (!asset?.assetId) throw new Error('CAD asset reference is required');
    const response = await fetch(`/api/cad-assets/${encodeURIComponent(asset.assetId)}`);
    if (!response.ok) throw new Error(`CAD asset unavailable (${response.status})`);
    const buffer = await response.arrayBuffer();
    const disposition = response.headers.get('content-disposition') || '';
    const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const headerName = encodedName ? decodeURIComponent(encodedName) : disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const requestedName = asset.fileName && /\.dxf$/i.test(asset.fileName) ? asset.fileName : `${asset.assetId}.dxf`;
    const fileName = headerName && /\.dxf$/i.test(headerName) ? headerName : requestedName;
    const file = new File([buffer], fileName, { type: 'application/dxf' });
    const input = document.getElementById('fileInputElement');
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const check = () => {
        const state = window.MLIGHTCAD_RUNTIME;
        if (state?.asset === file.name && state.rendered === true) return resolve();
        if (Date.now() - started > 15000) return reject(new Error('CAD asset did not render within 15 seconds'));
        requestAnimationFrame(check);
      };
      check();
    });
    this.onState(window.MLIGHTCAD_RUNTIME);
  }

  async fit() { document.getElementById('fitButton')?.click(); this.onState(window.MLIGHTCAD_RUNTIME); }
  async zoomTo(factor) { for (let index = 0; index < Math.max(1, Math.round(Number(factor))); index += 1) document.getElementById('deepZoomButton')?.click(); this.onState(window.MLIGHTCAD_RUNTIME); }
  async getBounds() { return window.MLIGHTCAD_RUNTIME?.rendered_bounds || null; }
  async getLayers() { return window.MLIGHTCAD_RUNTIME?.layers || []; }
  async getSelection() { const entity = window.MLIGHTCAD_RUNTIME?.selection?.entity; return entity ? [entity] : []; }
  async selectEntity(id) {
    const bridge = window.MLIGHTCAD_RUNTIME;
    if (!bridge) return;
    if (String(id) === String(bridge.selection?.ids?.[0])) return;
    document.getElementById('selectButton')?.click();
    this.onState(window.MLIGHTCAD_RUNTIME);
  }
}

if (typeof window !== 'undefined') window.CnbCadViewerAdapter = CadViewerAdapter;
if (typeof module !== 'undefined') module.exports = { CadViewerAdapter };
