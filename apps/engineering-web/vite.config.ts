import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

export default {
  root,
  server: {
    host: '127.0.0.1',
    port: 4200,
    fs: { allow: [root, projectRoot] },
    proxy: {
      '/api': 'http://127.0.0.1:8200',
      '/docs': 'http://127.0.0.1:8200',
      '/evidence': 'http://127.0.0.1:8200',
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
};
