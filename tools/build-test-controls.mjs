/** Local-only native HA shared controls for visual regression tests. */
import {build} from "esbuild";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(import.meta.dirname,"..");
const upstream=path.join(root,"dist/frontend-native");
await build({stdin:{contents:["components/ha-card","components/ha-svg-icon","components/ha-icon",
  "components/ha-gauge","components/ha-tooltip","components/chart/ha-chart-base",
  "components/chart/ha-sankey-chart","panels/lovelace/cards/energy/common/hui-energy-graph-chip"]
  .map(file=>`import "./src/${file}";`).join("\n"),resolveDir:upstream,loader:"ts"},
  outfile:path.join(root,"dist/test-controls.js"),bundle:true,format:"esm",target:"es2022",
  tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}},
  define:{__DEV__:"false",__DEMO__:"false",__BUILD__:'"test"',__STATIC_PATH__:'"/static/"',__HASS_URL__:'""',__SUPERVISOR__:"false"},
  plugins:[{name:"ha-module-extensions",setup(api){
    // The generated icon catalogue is unnecessary: test cards use SVG paths.
    api.onResolve({filter:/build\/mdi\/iconMetadata\.json$/},()=>({path:"icon-metadata",namespace:"test-data"}));
    api.onLoad({filter:/.*/,namespace:"test-data"},()=>({contents:"export default {};",loader:"js"}));
    api.onLoad({filter:/\.ts$/},args=>{
      if(!args.path.startsWith(path.join(upstream,"src")))return;
      let contents=fs.readFileSync(args.path,"utf8").replace(/from "((?:lit\/|echarts\/lib\/|@lit-labs\/observers\/|@home-assistant\/webawesome\/dist\/)[^"\n]+)(?<!\.js)"/g,'from "$1.js"');
      return {contents,loader:"ts"};
    });
  }}],logLimit:4,logLevel:"warning"});
console.log("Built local native chart controls.");
