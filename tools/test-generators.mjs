/** Real patched native card classes with supplied HA contexts and Recorder fixtures.
 * Shared HA chart controls are not emulated: inspect the series passed to them.
 * This is a component regression test, not a live HA acceptance test.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require("playwright");}catch{playwright=require(process.env.PLAYWRIGHT_MODULE||"C:/Users/pedro.pedrosa.SA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");}
const root=path.resolve(import.meta.dirname,"..");
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,"http://localhost").pathname;
  if(pathname==="/"){res.setHeader("Content-Type","text/html");res.end('<!doctype html><body><script type="module">await import("/dist/test-controls.js");window.native=await import("/frontend/native-energy.js?v=0.4.0-beta.1");window.ready=true;</script>');return;}
  const file=path.resolve(root,"."+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  res.setHeader("Content-Type","text/javascript");fs.createReadStream(file).on("error",()=>res.writeHead(404).end()).pipe(res);
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const browser=await playwright.chromium.launch({headless:true,...(process.platform==="win32"?{channel:"msedge"}:{})});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>window.ready || window.loadError,{},{timeout:15000}).catch(error=>{throw new Error(errors.join("\n")||error.message);});
  const results=await page.evaluate(async()=>{
    const locale={language:"en",number_format:"comma_decimal",time_format:"24",date_format:"DMY",time_zone:"server",first_weekday:"monday"};
    const hass={locale,localize:(key,args)=>{const label=key.split(".").at(-1).replaceAll("_"," ");return args?.num?`${label}: ${args.num}`:label;},
      config:{time_zone:"Europe/Lisbon",location_name:"Fixture",currency:"EUR",unit_system:{length:"km"}},
      states:{},entities:{},areas:{},devices:{},floors:{},labels:{},themes:{darkMode:false},panels:{energy:{}},
      formatEntityName:state=>state.attributes?.friendly_name||state.entity_id,
      formatEntityState:state=>state.state};
    const contexts={hassInternationalization:hass,hassConfig:hass,hassUi:hass,hassFormatters:hass,
      states:hass.states,entities:hass.entities,hassRegistries:hass,reducedMotion:true};
    document.addEventListener("context-request",event=>{if(event.context in contexts){event.stopPropagation();event.callback(contexts[event.context],()=>{});}});
    document.body.style.cssText="--state-unavailable-color:#aaa;--ha-border-radius-circle:50%;--ha-card-border-radius:12px;--ha-space-4:16px;--ha-space-6:24px;--energy-generator-color:#009688;--energy-solar-color:#ff9800;--energy-grid-consumption-color:#488fc2;--energy-grid-return-color:#8353d1;--energy-battery-in-color:#a84baf;--energy-battery-out-color:#dc719b;--primary-color:#03a9f4;--primary-text-color:#212121;--secondary-text-color:#777;--divider-color:#ddd;--card-background-color:#fff;font:14px Roboto,Arial";
    const start=Date.UTC(2026,10,10),end=start+3600000;
    const sources=[{type:"grid",stat_energy_from:"sensor.import",stat_energy_to:"sensor.export",stat_rate:'sensor.grid_power'}];
    for(const [id,value]of [['sensor.grid_power',1],['sensor.generator_power',3]])hass.states[id]={entity_id:id,state:String(value),attributes:{device_class:'power',unit_of_measurement:'kW'}};
    const stat=(change,t=start)=>[{start:t,end:t+3600000,change}];
    const base={start:new Date(start),end:new Date(end),statsMetadata:{},info:{cost_sensors:{}},
      prefs:{energy_sources:sources,device_consumption:[],device_consumption_water:[]},gasUnit:"m³",waterUnit:"m³"};
    const first={...base,prefs:{...base.prefs,energy_sources:[...sources,{type:"generator",id:"g1",name:"SIMULATION - Frestia_1 generator",stat_energy_from:"sensor.generator",stat_rate:'sensor.generator_power'}]},
      stats:{"sensor.import":stat(.67),"sensor.export":stat(.11),"sensor.generator":stat(1)}};
    const second={...base,prefs:{...base.prefs,energy_sources:[...sources,{type:"solar",stat_energy_from:"sensor.pv"},
      {type:"battery",stat_energy_from:"sensor.discharge",stat_energy_to:"sensor.charge"}]},
      stats:{"sensor.import":stat(.66),"sensor.export":stat(.11),"sensor.pv":stat(17.22),"sensor.discharge":stat(16),"sensor.charge":stat(0)}};
    let target=document.body;
    const make=async(type,data)=>{
      const card=document.createElement(`mle-hui-${type}-card`);
      card.setConfig({type:`custom:mle-hui-${type}-card`,collection_key:"energy_dashboard",title:type});
      card.style.cssText="display:block;max-width:500px;min-height:200px;margin:20px";
      target.append(card);
      if(card._getStatistics) await card._getStatistics(data); else card._data=data;
      await card.updateComplete;
      return card;
    };
    const output=[];
    for(const [name,data] of [["Frestia_1",first],["Frestia_2",second]]){
      hass.config.location_name=name;
      target=document.createElement("section");target.id=name;target.style.cssText="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px";document.body.append(target);
      const {summedData}=window.native.getSummedData(data);
      const {consumption}=window.native.computeConsumptionData(summedData);
      const distribution=await make("energy-distribution",data);
      const chart=await make("energy-usage-graph",data);
      const table=await make("energy-sources-table",data);
      const sankey=await make("energy-sankey",data);
      const production=await make("energy-generator-graph",data);
      const contribution=await make('energy-generator-contribution',data);
      const power=await make('power-sankey',data);
      await new Promise(resolve=>setTimeout(resolve,600));
      output.push({name,total:consumption.total.used_total,
        distribution:distribution.shadowRoot.textContent,
        table:table.shadowRoot.textContent,
        series:chart._chartData.map(s=>({name:s.name,id:s.id,data:s.data})),
        sankey:sankey.shadowRoot.querySelector("ha-sankey-chart")?.data,
        contribution:contribution.shadowRoot.querySelector('ha-gauge')?.value,
        power:power.shadowRoot.querySelector('ha-sankey-chart')?.data,
        production:production._chartData.map(s=>({name:s.name,id:s.id,data:s.data}))});
    }
    // Comparison periods use the same generator allocation and distinct series.
    const compared={...first,startCompare:new Date(start-86400000),endCompare:new Date(end-86400000),
      statsCompare:Object.fromEntries(Object.entries(first.stats).map(([key,rows])=>[key,rows.map(row=>({...row,start:row.start-86400000,end:row.end-86400000,change:row.change*2}))]))};
    const compareCard=await make("energy-usage-graph",compared);
    const comprehensive={...second.prefs,device_consumption:[{stat_consumption:'sensor.device',stat_rate:'sensor.device_power'}],energy_sources:[...second.prefs.energy_sources,first.prefs.energy_sources.at(-1),{type:'gas',stat_energy_from:'sensor.gas'},{type:'water',stat_energy_from:'sensor.water'}]};
    const collection={prefs:comprehensive,subscribe(callback){queueMicrotask(()=>callback({prefs:comprehensive}));return()=>{};}};
    hass.connection={_energy_dashboard:collection,_energy_dashboard_now:collection};
    const helpers={createCardElement(config){const tag=`hui-${config.type}-card`;if(!customElements.get(tag))customElements.define(tag,class extends HTMLElement{});if(!customElements.get('hui-energy-period-selector'))customElements.define('hui-energy-period-selector',class extends HTMLElement{});},createBadgeElement(){if(!customElements.get('hui-power-total-badge'))customElements.define('hui-power-total-badge',class extends HTMLElement{});}};
    const extension=await import('/frontend/generator-extension.js');
    const dashboard=await extension.generatorDashboard(hass,helpers,[],false);
    return {locations:output,compareSeries:compareCard._chartData.map(s=>({id:s.id,data:s.data})),dashboard};
  });
  assert.equal(errors.length,0,errors.join("\n"));
  const [first,second]=results.locations;
  assert.ok(Math.abs(first.total-1.56)<1e-9);
  assert.ok(Math.abs(second.total-33.77)<1e-9);
  assert.match(first.distribution,/SIMULATION - Frestia_1 generator/);
  assert.match(first.table,/Generator production/);
  assert.ok(first.series.some(s=>s.name==="Generator consumption"));
  assert.ok(!second.series.some(s=>s.name==="Generator consumption"));
  assert.ok(first.sankey.nodes.some(n=>n.id.startsWith("generator_")));
  assert.ok(!second.sankey.nodes.some(n=>n.id.startsWith("generator_")));
  assert.ok(Math.abs(first.contribution-100*.89/1.56)<1e-8);
  assert.equal(first.power.nodes.find(n=>n.id==='home').value,4000);
  assert.equal(first.power.nodes.find(n=>n.id==='generator_g1').value,3000);
  assert.ok(first.production.some(s=>s.data?.some(point=>(point.value || point)[1]===1)),JSON.stringify(first.production));
  assert.ok(results.compareSeries.some(s=>s.id?.startsWith("compare-")&&s.id.includes("used_generator")));
  assert.deepEqual(results.dashboard.views.map(v=>v.path),['overview','electricity','gas','water','now']);
  const config=JSON.stringify(results.dashboard);
  for(const type of ['energy-solar-graph','energy-devices-graph','energy-devices-detail-graph','energy-grid-balance','energy-grid-neutrality-gauge','energy-solar-consumed-gauge','energy-self-sufficiency-gauge','energy-date-selection','energy-compare','power-sankey','energy-generator-graph','energy-generator-contribution'])assert.ok(config.includes(type),`${type} must be retained`);
  await page.locator("#Frestia_1 ha-chart-base canvas").first().waitFor({timeout:15000});
  for(const location of ["Frestia_1","Frestia_2"]) await page.locator(`#${location}`).screenshot({path:path.join(root,`dist/${location}-native-draft.png`)});
  assert.equal(errors.length,0,errors.join("\n"));
  console.log("PASS: both location balances, native distribution, source totals, usage chart, production chart, Sankey and comparison series.");
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
