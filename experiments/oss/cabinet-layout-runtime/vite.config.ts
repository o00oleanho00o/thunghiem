import { fileURLToPath, URL } from "node:url";

const upstream = fileURLToPath(new URL("../../../research/cloned-or-scripted-spikes/cabinet-layout-generator/web/src/", import.meta.url));
const upstreamModules = fileURLToPath(new URL("../../../research/cloned-or-scripted-spikes/cabinet-layout-generator/web/node_modules/", import.meta.url));
const runtime = fileURLToPath(new URL(".", import.meta.url));

export default {
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: {
      "@cabinet": upstream,
      react: `${upstreamModules}/react`,
      "react-dom": `${upstreamModules}/react-dom`,
      fabric: `${upstreamModules}/fabric`,
    },
  },
  server: { fs: { allow: [runtime, upstream, upstreamModules] } },
  esbuild: { jsx: "automatic" },
};
