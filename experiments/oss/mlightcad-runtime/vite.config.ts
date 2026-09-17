import { fileURLToPath, URL } from "node:url";

const upstream = fileURLToPath(new URL("../../../research/cloned-or-scripted-spikes/mlightcad/", import.meta.url));
const example = `${upstream}/packages/cad-simple-viewer-example`;
const exampleModules = `${example}/node_modules`;
const runtime = fileURLToPath(new URL(".", import.meta.url));

export default {
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: {
      "@mlightcad/cad-simple-viewer": `${upstream}/packages/cad-simple-viewer/src/index.ts`,
      "@mlightcad/data-model": `${exampleModules}/@mlightcad/data-model`,
      "@mlightcad/mtext-renderer": `${exampleModules}/@mlightcad/mtext-renderer`,
      "@mlightcad/three-renderer": `${upstream}/packages/three-renderer/src/index.ts`,
    },
  },
  server: { fs: { allow: [runtime, upstream, example] } },
};
