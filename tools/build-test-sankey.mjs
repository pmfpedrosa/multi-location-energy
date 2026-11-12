/** Local regression bundle of the unmodified HA 20261028.4 native Sankey. */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const upstream = path.join(root, "dist/frontend-native");
await build({
  stdin: { contents: 'import "./src/panels/lovelace/cards/energy/hui-energy-sankey-card";', resolveDir: upstream, loader: "ts" },
  outfile: path.join(root, "dist/test-sankey.js"), bundle: true, format: "esm", target: "es2022",
  tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } },
  define: { __DEV__: "false", __DEMO__: "false", __BUILD__: '"test"', __STATIC_PATH__: '"/static/"', __HASS_URL__: '""', __SUPERVISOR__: "false" },
  plugins: [{ name: "ha-test-imports", setup(api) {
    // The card editor isn't exercised by this rendering regression.
    api.onResolve({ filter: /hui-energy-sankey-card-editor$/ }, () => ({ path: "editor", namespace: "test-data" }));
    api.onResolve({ filter: /build\/mdi\/iconMetadata\.json$/ }, () => ({ path: "icon-metadata", namespace: "test-data" }));
    api.onLoad({ filter: /.*/, namespace: "test-data" }, () => ({ contents: "export default {};", loader: "js" }));
    api.onLoad({ filter: /\.ts$/ }, args => {
      if (!args.path.startsWith(path.join(upstream, "src"))) return;
      const contents = fs.readFileSync(args.path, "utf8").replace(/(["'])((?:lit\/|echarts\/lib\/|@lit-labs\/observers\/|@home-assistant\/webawesome\/dist\/)[^"'\n]+)(?<!\.js)\1/g, '$1$2.js$1');
      return { contents, loader: "ts" };
    });
  } }], logLimit: 4, logLevel: "warning",
});
console.log("Built unmodified native energy Sankey for local regression testing.");
