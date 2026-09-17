'use strict';

// The adapter is the only R5 shell dependency on the proven panel composer.
// It exposes CNB-shaped data while keeping the renderer implementation private.
export class PanelLayoutAdapter {
  constructor(app = globalThis.CNB_APP) {
    this.app = app;
  }

  requireApp() {
    if (!this.app?.state?.model) throw new Error('Cabinet Layout Generator is not mounted');
    return this.app;
  }

  async loadProject(eir) {
    this.requireApp().loadModel(eir, eir?.project?.name || 'CNB project');
  }

  async getPlacements() {
    const model = this.requireApp().state.model;
    return model.components.map((component) => ({
      deviceId: component.id,
      x: component.x,
      y: component.y,
      width: component.width,
      height: component.height,
      rotation: component.rotation,
      locked: component.locked,
      status: component.status || 'candidate',
    }));
  }

  async applyPlacements(input) {
    const app = this.requireApp();
    const byId = new Map(input.map((item) => [item.deviceId, item]));
    app.state.model.components.forEach((component) => {
      const next = byId.get(component.id);
      if (!next || component.locked) return;
      if (Number.isFinite(Number(next.x))) component.x = Number(next.x);
      if (Number.isFinite(Number(next.y))) component.y = Number(next.y);
      if (Number.isFinite(Number(next.rotation))) component.rotation = Number(next.rotation);
    });
    app.validate();
    app.render();
  }

  async lockDevice(deviceId, locked) {
    const app = this.requireApp();
    const component = app.state.model.components.find((item) => item.id === deviceId);
    if (!component) throw new Error(`Unknown device ${deviceId}`);
    component.locked = Boolean(locked);
    app.render();
  }

  async validateView() {
    const app = this.requireApp();
    return app.validate().map((issue) => ({
      code: issue.code,
      entityId: issue.entity || issue.entity_id,
      severity: issue.severity || (String(issue.code || '').startsWith('E') ? 'error' : 'warn'),
      message: issue.message,
    }));
  }

  async export(format) {
    const model = this.requireApp().state.model;
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, format }),
    });
    if (!response.ok) throw new Error(`Engineering API export failed (${response.status})`);
    const body = await response.arrayBuffer();
    return {
      format,
      bytes: body.byteLength,
      href: URL.createObjectURL(new Blob([body], { type: format === 'dxf' ? 'application/dxf' : 'image/svg+xml' })),
    };
  }
}

if (typeof window !== 'undefined') window.CnbPanelLayoutAdapter = PanelLayoutAdapter;
if (typeof module !== 'undefined') module.exports = { PanelLayoutAdapter };
