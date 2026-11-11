/** Rebuild the isolated native Energy extension against the reviewed upstream pin.
 * The source checkout belongs in dist/frontend-native. It is not shipped.
 * No native/global custom-element registrations are replaced.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const upstream = path.join(root, "dist/frontend-native");
const revision = "a67b691a451e0b3fc469679b07158f963a61842c";
if (execFileSync("git", ["rev-parse", "HEAD"], { cwd: upstream, encoding: "utf8" }).trim() !== revision) {
  throw new Error("Native frontend checkout does not match the reviewed revision");
}
const patches = new Map();
function edit(file, fn) {
  let source = fs.readFileSync(path.join(upstream, "src", file), "utf8").replaceAll("\r\n", "\n");
  const replace = (before, after) => {
    if (!source.includes(before)) throw new Error(`Patch anchor missing in ${file}: ${before}`);
    source = source.replaceAll(before, after);
  };
  fn(replace, () => source, value => source = value);
  patches.set(file, source);
}
const cards = "panels/lovelace/cards/energy/";
const strategies = "panels/energy/strategies/";

edit("data/energy.ts", (replace, read, write) => {
  replace('const getStatisticsRange =', 'export const getStatisticsRange =');
  replace('export type EnergySource =', 'export interface GeneratorSourceTypeEnergyPreference { type:"generator"; id:string; name:string; stat_energy_from:string; stat_rate?:string; }\n\nexport type EnergySource =\n  | GeneratorSourceTypeEnergyPreference');
  replace('export interface EnergySourceByType {', 'export interface EnergySourceByType {\n  generator?: GeneratorSourceTypeEnergyPreference[];');
  replace('  solar?: Record<number, number>;', '  generator?: Record<number, number>;\n  solar?: Record<number, number>;');
  replace('    solar?: number;', '    generator?: number;\n    solar?: number;');
  replace('    solar?: string[];', '    generator?: string[];\n    solar?: string[];');
  replace('  used_total: Record<number, number>;', '  used_generator: Record<number,number>; generator_to_grid: Record<number,number>; generator_to_battery: Record<number,number>;\n  used_total: Record<number, number>;');
  replace('    used_total: number;', '    used_generator: number; generator_to_grid: number; generator_to_battery: number;\n    used_total: number;');
  replace('if (source.type === "solar") {\n      statIDs.push', 'if (source.type === "solar" || source.type === "generator") {\n      statIDs.push');
  replace('"grid",\n    "solar",', '"grid",\n    "generator",\n    "solar",');
  // Source collection and power lookup both keep the new type distinct.
  replace('source.type === "solar" || source.type === "home"', 'source.type === "generator" || source.type === "solar" || source.type === "home"');
  replace('    if (source.type === "solar") {\n      if (statIds.solar)', '    if (source.type === "generator") {\n      (statIds.generator ??= []).push(source.stat_energy_from);\n      continue;\n    }\n    if (source.type === "solar") {\n      if (statIds.solar)');
  replace('    used_total: {},', '    used_generator: {}, generator_to_battery: {}, generator_to_grid: {},\n    used_total: {},');
  replace('      used_total: 0,', '      used_generator: 0, generator_to_battery: 0, generator_to_grid: 0,\n      used_total: 0,');
  replace('      grid_to_battery,\n      battery_to_grid,', '      used_generator, generator_to_battery, generator_to_grid,\n      grid_to_battery,\n      battery_to_grid,');
  replace('      solar: solarData && (solarData[t] ?? 0),', '      generator: data.generator?.[t] ?? 0,\n      solar: solarData && (solarData[t] ?? 0),');
  replace('    outData.used_total[t] = usedTotal;', '    for (const [key, value] of Object.entries({used_generator, generator_to_battery, generator_to_grid})) {\n      outData[key][t] = value; total[key] += value;\n    }\n    outData.used_total[t] = usedTotal;');
  replace('  printCategory("solar_production", solar_productions, electricUnit);', '  printCategory("solar_production", solar_productions, electricUnit);\n  printCategory("generator_production", energy_sources.filter(s => s.type === "generator").map(s => s.stat_energy_from), electricUnit);');
  replace('  if (hasSolar) {\n    processConsumptionData(', '  if (energy_sources.some(s=>s.type==="generator")) {\n    processConsumptionData("calculated_consumed_generator",electricUnit,consumption.used_generator);\n    processConsumptionData("calculated_generator_to_grid",electricUnit,consumption.generator_to_grid);\n    processConsumptionData("calculated_generator_to_battery",electricUnit,consumption.generator_to_battery);\n  }\n  if (hasSolar) {\n    processConsumptionData(');
  replace('    let batteryToGrid = consumption.battery_to_grid[t] ?? 0;', '    if (consumption.generator_to_battery[t]) batteryLifo.push({type:"generator",value:consumption.generator_to_battery[t]});\n    let batteryToGrid = consumption.battery_to_grid[t] ?? 0;');
  const source = read();
  const start = source.indexOf("export const computeConsumptionSingle =");
  const end = source.indexOf("export const formatConsumptionShort", start);
  if (start < 0 || end < 0) throw new Error("Missing native allocation function");
  write('import { computeElectricityFlows } from "mle:flows";\n' + source.slice(0,start) +
    'export const computeConsumptionSingle = computeElectricityFlows;\n\n' + source.slice(end));
});

edit(cards + "energy-distribution-home-circle.ts", replace => {
  replace('  usedSolar = 0,', '  usedGenerator = 0,\n  usedSolar = 0,');
  replace('const ringTotal = solar + battery + grid;', 'const generator = Math.max(usedGenerator, 0);\n  const ringTotal = solar + generator + battery + grid;');
  replace('  if (hasSolar) {', '  if (generator > 0) arcs.generator = share(generator);\n  if (hasSolar) {');
});
edit(cards + "hui-energy-distribution-card.ts", replace => {
  replace('  mdiArrowDown,', '  mdiEngine,\n  mdiArrowDown,');
  replace('      solar: homeSolarCircumference,', '      generator: homeGeneratorCircumference,\n      solar: homeSolarCircumference,');
  replace('      usedSolar: solarConsumption ?? 0,', '      usedGenerator: consumption.total.used_generator,\n      usedSolar: solarConsumption ?? 0,');
  replace('(returnedToGrid ?? 0) - (solarToGrid ?? 0) - (batteryToGrid ?? 0)', '(returnedToGrid ?? 0) - (solarToGrid ?? 0) - (batteryToGrid ?? 0) - consumption.total.generator_to_grid');
  replace('homeSolarCircumference === undefined &&', 'homeGeneratorCircumference === undefined && homeSolarCircumference === undefined &&');
  replace('homeSolarCircumference !== undefined ||', 'homeGeneratorCircumference !== undefined || homeSolarCircumference !== undefined ||');
  replace('CIRCLE_CIRCUMFERENCE - homeSolarCircumference\n                            }"', 'CIRCLE_CIRCUMFERENCE - homeSolarCircumference - (homeGeneratorCircumference || 0)\n                            }"');
  replace('(homeSolarCircumference || 0)', '(homeSolarCircumference || 0) - (homeGeneratorCircumference || 0)');
  replace('? html`<svg>\n', '? html`<svg>\n ${homeGeneratorCircumference ? svg`<circle class="generator" cx="40" cy="40" r="38" stroke-dasharray="${homeGeneratorCircumference} ${CIRCLE_CIRCUMFERENCE-homeGeneratorCircumference}" stroke-dashoffset="-${CIRCLE_CIRCUMFERENCE-homeGeneratorCircumference}" />` : nothing}\n');
  replace('<div class="card-content">', `<div class="card-content">
          \${types.generator?.length ? html\`<div class="generator-sources">
            \${types.generator.map(source => html\`<div class="generator-source">
              <span class="label">\${source.name || "Generator"}</span>
              <div class="circle generator"><ha-svg-icon .path=\${mdiEngine}></ha-svg-icon>
                \${formatConsumptionShort(this._i18n.locale,
                  calculateStatisticsSumGrowth(this._data.stats,[source.stat_energy_from]), "kWh",targetEnergyUnit)}
              </div><span class="generator-connector">↓</span></div>\`)}
            </div><div class="generator-destinations">Generator electricity · estimated allocation<br>
              Home \${formatConsumptionShort(this._i18n.locale,consumption.total.used_generator,"kWh")}
              · Grid \${formatConsumptionShort(this._i18n.locale,consumption.total.generator_to_grid,"kWh")}
              · Battery \${formatConsumptionShort(this._i18n.locale,consumption.total.generator_to_battery,"kWh")}
            </div>\` : nothing}`);
  replace('    ha-card {', `    .generator-sources {display:flex;flex-wrap:wrap;justify-content:center;gap:16px}
    .generator-source {display:flex;flex-direction:column;align-items:center;max-width:140px;text-align:center}
    .generator-source .label {overflow-wrap:anywhere;white-space:normal;width:auto;max-width:140px;overflow:visible;text-overflow:clip;height:auto;min-height:20px;margin-bottom:6px}
    .generator-source .circle {border-color:var(--energy-generator-color);color:var(--primary-text-color)}
    .generator {color:var(--energy-generator-color);border-color:var(--energy-generator-color);stroke:var(--energy-generator-color)}
    .generator-connector {color:var(--energy-generator-color);font-size:24px}
    .generator-destinations {border-top:1px solid var(--energy-generator-color);padding:8px 0 16px;text-align:center;font-size:12px;color:var(--secondary-text-color)}
    ha-card {`);
});

edit(cards + "power-sources-graph-data.ts", replace => {
  replace('(source.type === "solar" ||', '(source.type === "generator" || source.type === "solar" ||');
  replace('  const statIds = {', '  const statIds = {\n    generator: {stats: [] as string[],color:"--energy-generator-color",name:"Generators"},');
  replace('    if (source.type === "solar") {', '    if (source.type === "generator") { if (source.stat_rate) statIds.generator.stats.push(source.stat_rate); continue; }\n    if (source.type === "solar") {');
  replace('["solar", "battery", "grid"]', '["generator", "solar", "battery", "grid"]');
  replace('key !== "solar" ?', '!["solar", "generator"].includes(key) ?');
});

edit(cards + "hui-energy-usage-graph-card.ts", replace => {
  replace('  used_solar: "--energy-solar-color",', '  used_generator: "--energy-generator-color",\n  used_solar: "--energy-solar-color",');
  replace('  used_solar: 3,', '  used_generator: 3.5,\n  used_solar: 3,');
  replace('    const typeLabels = {', '    const typeLabels = {\n      used_generator: "Generator consumption",');
  replace('    if (summedData.home) {', '    if (summedData.generator) combinedData.used_generator = {used_generator: consumptionData.used_generator};\n    if (summedData.home) {');
  replace('consumptionData.used_solar[start] -', 'consumptionData.used_solar[start] - consumptionData.used_generator[start] -');
});
edit(cards + "hui-energy-sources-table-card.ts", replace => {
  replace('  solar: "--energy-solar-color",', '  generator: "--energy-generator-color",\n  solar: "--energy-solar-color",');
  replace('      solar: 0,', '      generator: 0,\n      solar: 0,');
  replace('      solar: "kWh",', '      generator: "kWh",\n      solar: "kWh",');
  replace('${_renderSimpleCategory("solar")}', '${_renderSimpleCategory("generator")} ${_renderSimpleCategory("solar")}');
  replace('this._i18n.localize(\n                `ui.panel.lovelace.cards.energy.energy_sources_table.${type}_total`\n              )', 'type === "generator" ? "Generator production" : this._i18n.localize(\n                `ui.panel.lovelace.cards.energy.energy_sources_table.${type}_total`\n              )');
});
edit("panels/lovelace/badges/energy/hui-power-total-badge.ts",replace=>{
  replace('(source.type === "solar" ||', '(source.type === "generator" || source.type === "solar" ||');
  replace('    let solar = 0;', '    let generator = 0;\n    let solar = 0;');
  replace('      if (source.type === "solar" && source.stat_rate) {', '      if (source.type === "generator" && source.stat_rate) { generator += Math.max(0,this._getCurrentPower(source.stat_rate)); }\n      else if (source.type === "solar" && source.stat_rate) {');
  replace('fromGrid + solar + fromBattery', 'fromGrid + solar + generator + fromBattery');
});
edit(cards+"hui-energy-date-selection-card.ts",replace=>{
  replace("hui-energy-period-selector","mle-hui-energy-period-selector");
});
edit(cards+"hui-energy-carbon-consumed-gauge-card.ts",replace=>{
  replace('  getSummedData,', '  computeConsumptionData,\n  getSummedData,');
  replace('      const totalSolarProduction = summedData.total.solar ?? 0;', '      const totalSolarProduction = summedData.total.solar ?? 0;\n      const generator = summedData.total.generator ?? 0;\n      const {consumption} = computeConsumptionData(summedData);');
  replace('Math.max(0, totalSolarProduction - totalGridReturned)', 'Math.max(0, totalSolarProduction + generator - totalGridReturned)');
  replace('1 - highCarbonEnergy / totalEnergyConsumed', '1 - (highCarbonEnergy + consumption.total.used_generator + consumption.total.generator_to_battery) / totalEnergyConsumed');
});
edit(cards + "hui-power-sankey-card.ts", (replace,read,write) => {
  replace('    // Add grid return if available', `    if (powerData.generator > 0) {
      nodes.push({id:"generator", label:"Generators", value:powerData.generator,
        color:computedStyle.getPropertyValue("--energy-generator-color").trim(),index:0});
      links.push({source:"generator",target:"home"});
      if (powerData.generator_to_battery > 0) links.push({source:"generator",target:"battery_in"});
      if (powerData.generator_to_grid > 0) links.push({source:"generator",target:"grid_return"});
    }
    // Add grid return if available`);
  const source=read();
  const start=source.indexOf('    const used_total =',source.indexOf('private _computePowerData'));
  const end=source.indexOf('\n  /**\n   * Get current power value',start);
  if(start<0||end<0) throw new Error("Power allocation anchor missing");
  write('import {computeElectricityFlows} from "mle:flows";\n'+source.slice(0,start)+`
    const generator = prefs.energy_sources.filter(s=>s.type==="generator")
      .reduce((sum,s)=>sum+Math.max(0,s.stat_rate?this._getCurrentPower(s.stat_rate):0),0);
    const flows=computeElectricityFlows({solar,generator,from_grid,to_grid,from_battery,to_battery});
    return {...flows,solar,generator,from_grid,to_grid,from_battery,to_battery,
      used_total: Math.max(0,homePower ?? flows.used_total)};
  }
`+source.slice(end));
});
edit(cards + "hui-energy-sankey-card.ts", replace => {
  replace('    // Add grid return if available', `    if (types.generator) {
      nodes.push({id:"generator", label:"Generators", value:summedData.total.generator ?? 0,
        color:computedStyle.getPropertyValue("--energy-generator-color").trim(), index:0});
      links.push({source:"generator", target:"home", value:consumption.total.used_generator});
      if (types.battery && consumption.total.generator_to_battery > 0)
        links.push({source:"generator", target:"battery_in", value:consumption.total.generator_to_battery});
      if (types.grid?.some(g => g.stat_energy_to) && consumption.total.generator_to_grid > 0)
        links.push({source:"generator", target:"grid_return", value:consumption.total.generator_to_grid});
    }
    // Add grid return if available`);
});
edit(strategies + "energy-cards.ts", replace => {
  replace('  hasGridSource(prefs) ||', '  prefs.energy_sources.some(s => s.type === "generator") || hasGridSource(prefs) ||');
  replace('if (source.type === "solar" && source.stat_rate)', 'if ((source.type === "solar" || source.type === "generator") && source.stat_rate)');
  replace('(p) => hasGridSource(p) || hasBattery(p)', '(p) => p.energy_sources.some(s => s.type === "generator") || hasGridSource(p) || hasBattery(p)');
  replace('(p) => hasGridSource(p) || hasSolar(p)', '(p) => p.energy_sources.some(s => s.type === "generator") || hasGridSource(p) || hasSolar(p)');
  replace('(p) => hasSolar(p) && hasGridSource(p)', '(p) => (hasSolar(p) || p.energy_sources.some(s=>s.type==="generator")) && hasGridSource(p)');
});
for(const file of ["hui-energy-devices-graph-card.ts","energy-devices-detail-graph-data.ts"]) {
  edit(cards+file,replace=>replace('"solar" in summedData ||', '"generator" in summedData || "solar" in summedData ||'));
}

const entry = `
export { getEnergyDataCollection, getSummedData, computeConsumptionData, downloadEnergyData, getSuggestedPeriod, getStatisticsRange } from "./src/data/energy";
export { EnergyDashboardStrategy } from "./src/panels/energy/strategies/energy-dashboard-strategy";
export { EnergyViewStrategy } from "./src/panels/energy/strategies/energy-view-strategy";
export { EnergyOverviewViewStrategy } from "./src/panels/energy/strategies/energy-overview-view-strategy";
export { PowerViewStrategy } from "./src/panels/energy/strategies/power-view-strategy";
import "mle:generator-graph";
import "./src/panels/lovelace/badges/energy/hui-power-total-badge";
${fs.readdirSync(path.join(upstream, "src", cards)).filter(name=>name.startsWith("hui-") && name.endsWith(".ts")).map(name=>`import "./src/${cards}${name}";`).join("\n")}
`;
const result = await build({ stdin: { contents: entry, resolveDir: upstream, loader:"ts" },
  outfile:path.join(root,"frontend/native-energy.js"), bundle:true, format:"esm", target:"es2022",
  minify:true, sourcemap:false, metafile:true, legalComments:"eof",
  banner:{js:"/* Adapted Home Assistant Frontend 20261028.4. Apache-2.0. See NOTICE and native-licenses.txt. */"},
  tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}},
  define:{__DEV__:"false",__DEMO__:"false",__BUILD__:'"mle-dev"',__STATIC_PATH__:'"/static/"',__HASS_URL__:'""',__SUPERVISOR__:"false"},
  plugins:[{name:"isolated-native-energy",setup(api){
    api.onResolve({filter:/^mle:flows$/},()=>({path:path.join(root,"frontend/electricity-flows.js")}));
    api.onResolve({filter:/^mle:generator-(graph|graph-data)$/},args=>({path:args.path,namespace:"generator-chart"}));
    api.onLoad({filter:/.*/,namespace:"generator-chart"},args=>{
      const data=args.path.endsWith("graph-data");
      let contents=fs.readFileSync(path.join(upstream,"src",cards,data?"energy-solar-graph-data.ts":"hui-energy-solar-graph-card.ts"),"utf8");
      contents=contents.replaceAll('source.type === "solar"','source.type === "generator"')
        .replaceAll('--energy-solar-color','--energy-generator-color')
        .replaceAll('"./energy-solar-graph-data"','"mle:generator-graph-data"')
        .replaceAll('@customElement("hui-energy-solar-graph-card")','@customElement("mle-hui-energy-generator-graph-card")')
        .replaceAll('source.config_entry_solar_forecast?.length','false')
        .replace(/^import\s+"[^"\n]+";\s*$/gm, "")
        .replace(/import\("[^"\n]+"\)/g,'Promise.resolve({})')
        .replace(/from "(lit\/[^"\n]+)(?<!\.js)"/g,'from "$1.js"');
      return {contents,loader:"ts",resolveDir:path.join(upstream,"src",cards)};
    });
    api.onLoad({filter:/\.ts$/},async args=>{
      if (!args.path.startsWith(path.join(upstream,"src"))) return;
      const file=path.relative(path.join(upstream,"src"),args.path).replaceAll("\\","/");
      let contents=patches.get(file) ?? fs.readFileSync(args.path,"utf8");
      contents=contents.replace(/^import\s+"[^"\n]+";\s*$/gm, "");
      contents=contents.replace(/from "((?:lit\/|echarts\/lib\/)[^"\n]+)(?<!\.js)"/g, 'from "$1.js"');
      // Native HA owns shared components. Load those using HA's card helpers
      // before mounting these isolated cards. Strategy classes are called directly.
      contents=contents.replace(/@customElement\("([^"\n]+)"\)/g,(_,tag)=>
        (file.startsWith(cards) || file.endsWith("hui-power-total-badge.ts")) && tag.startsWith("hui-") ? `@customElement("mle-${tag}")` : "");
      // Editors remain HA's own editors; our cards are generated, not user-editable.
      contents=contents.replace(/import\("[^"\n]+"\)/g,'Promise.resolve({})');
      return {contents,loader:"ts"};
    });
  }}], logLevel:"warning", logLimit:6 });
const packageRoots=new Set();
for(const input of Object.keys(result.metafile.inputs)) {
  const absolute=path.resolve(root,input);
  if(!absolute.includes(`${path.sep}node_modules${path.sep}`))continue;
  let directory=path.dirname(absolute);
  while(directory!==path.dirname(directory)) {
    if(fs.existsSync(path.join(directory,"package.json"))) {packageRoots.add(directory);break;}
    directory=path.dirname(directory);
  }
}
let notices="Home Assistant Frontend\n"+fs.readFileSync(path.join(upstream,"LICENSE.md"),"utf8");
for(const directory of [...packageRoots].sort()) {
  const pkg=JSON.parse(fs.readFileSync(path.join(directory,"package.json"),"utf8"));
  notices+=`\n\n===== ${pkg.name} ${pkg.version} (${pkg.license || "see package license"}) =====\n`;
  for(const file of fs.readdirSync(directory).filter(name=>/^(license|licence|copying|notice)(\.|$)/i.test(name))) {
    if(fs.statSync(path.join(directory,file)).isFile())notices+=fs.readFileSync(path.join(directory,file),"utf8")+"\n";
  }
}
fs.writeFileSync(path.join(root,"frontend/native-licenses.txt"),notices);
fs.writeFileSync(path.join(root,"upstream/frontend-extension.json"),JSON.stringify({revision,
  patches:[...patches.keys()].sort().map(file=>({file,sha256:crypto.createHash("sha256").update(fs.readFileSync(path.join(upstream,"src",file))).digest("hex")}))},null,2)+"\n");
console.log("Development bundle only: frontend/native-energy.js. Not release-ready.");
