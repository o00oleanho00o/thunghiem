'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeModel, exportDxf, exportSvg, auditDxf } = require('../../packages/cad-export');
const { adapt: adaptEir } = require('./eir-adapter.js');

const root = __dirname;
const catalogRoot = path.resolve(__dirname, '../../catalog');
const catalogManifestPath = path.join(catalogRoot, 'generated', 'catalog-assets.json');
const port = Number(process.env.CNB_WEB_PORT || process.argv[2] || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.dxf': 'application/dxf',
};

function send(response, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  response.end(body);
}

function bodyFrom(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; if (body.length > 5_000_000) reject(new Error('request too large')); });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (requestUrl.pathname === '/api/health') return send(response, 200, JSON.stringify({ ok: true, service: 'cnb-electrical-lab-web' }), mime['.json']);
    if (requestUrl.pathname === '/api/catalog' && request.method === 'GET') {
      if (!fs.existsSync(catalogManifestPath)) return send(response, 404, JSON.stringify({ error: 'catalog manifest missing; run scripts/audit_catalog.py catalog' }), mime['.json']);
      return send(response, 200, fs.readFileSync(catalogManifestPath), mime['.json']);
    }
    const previewMatch = requestUrl.pathname.match(/^\/api\/catalog\/preview\/([a-f0-9]{16})$/);
    if (previewMatch && request.method === 'GET') {
      if (!fs.existsSync(catalogManifestPath)) return send(response, 404, 'Catalog manifest missing');
      const manifest = JSON.parse(fs.readFileSync(catalogManifestPath, 'utf8'));
      const record = manifest.records.find((item) => item.id === previewMatch[1]);
      if (!record || !record.preview_ref) return send(response, 404, 'Preview not found');
      const previewPath = path.resolve(catalogRoot, 'generated', record.preview_ref);
      if (!previewPath.startsWith(path.resolve(catalogRoot, 'generated') + path.sep) || !fs.existsSync(previewPath)) return send(response, 404, 'Preview not found');
      return send(response, 200, fs.readFileSync(previewPath), mime['.svg']);
    }
    if (requestUrl.pathname === '/api/export' && request.method === 'POST') {
      const payload = JSON.parse(await bodyFrom(request));
      const candidate = payload.model || payload;
      const model = normalizeModel(candidate && (candidate.devices || candidate.schema_version || candidate.schemaVersion === 'eir.v1') ? adaptEir(candidate) : candidate);
      const format = payload.format || 'dxf';
      if (format === 'dxf') return send(response, 200, exportDxf(model), mime['.dxf']);
      if (format === 'svg') return send(response, 200, exportSvg(model), mime['.svg']);
      if (format === 'audit') return send(response, 200, JSON.stringify(auditDxf(exportDxf(model)), null, 2), mime['.json']);
      return send(response, 400, JSON.stringify({ error: `unsupported format: ${format}` }), mime['.json']);
    }
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/') pathname = '/index.html';
    const resolved = path.resolve(root, `.${pathname}`);
    if (!resolved.startsWith(root + path.sep) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) return send(response, 404, 'Not found');
    return send(response, 200, fs.readFileSync(resolved), mime[path.extname(resolved).toLowerCase()] || 'application/octet-stream');
  } catch (error) {
    return send(response, 500, JSON.stringify({ error: error.message }), mime['.json']);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`CNB Electrical Lab web editor listening at http://127.0.0.1:${port}`);
});

module.exports = server;
