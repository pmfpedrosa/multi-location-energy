/** Native boundary doubles: routing, lifecycle, date sharing and the visual editor. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/pedro.pedrosa.SA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const root=path.resolve(import.meta.dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=pathname.startsWith('/frontend/')?path.join(root,pathname):path.join(root,'tests/location-cards-fixture.html');
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(file).on('error',()=>res.writeHead(404).end()).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1100,height:900}}), errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/dashboard`);
 await page.waitForFunction(()=>window.ready);
 await page.getByText('Frestia_1: 0.56 kWh',{exact:false}).first().waitFor();
 await page.getByText('Frestia_2: 33.77 kWh',{exact:false}).first().waitFor();
 assert.equal(await page.evaluate(()=>a._child.contexts.hassConfig.config.location_name),'Frestia_1');
 assert.equal(await page.evaluate(()=>b._child.contexts.hassConnection.connection===b._child._hass.connection),true);
 assert.equal(await page.evaluate(()=>a._child._hass.connection===date._child._hass.connection),true);
 assert.equal(await page.evaluate(()=>a._child._hass.connection===b._child._hass.connection),false);
 assert.deepEqual(await page.evaluate(()=>window.hass.connection._energy_dashboard),{native:true});
 // Fixed historical dates: unrelated state traffic must not invalidate the
 // reactive contexts used by native Sankey cards. Live hass.states still flows.
 assert.deepEqual(await page.evaluate(()=>{
   const before={...b._child.notifications},collection=b._child.collection;
   for(let i=0;i<100;i++){
     window.hass={...window.hass,states:{'sensor.unrelated':{state:String(i)}}};
     for(const card of [a,b,date,independent])card.hass=window.hass;
   }
   return {unchanged:JSON.stringify(before)===JSON.stringify(b._child.notifications),
     live:b._child._hass.states['sensor.unrelated'].state,collection:b._child.collection===collection};
 }),{unchanged:true,live:'99',collection:true});
 assert.equal(await page.evaluate(()=>{
   const before=b._child.notifications.hassInternationalization;
   window.hass={...window.hass,locale:{language:'pt'}};b.hass=window.hass;
   return b._child.notifications.hassInternationalization-before;
 }),1);
 await page.evaluate(()=>date._child.shadowRoot.querySelector('button').click());
 await page.waitForFunction(()=>b._child.collection.start.toISOString().startsWith('2026-11-11'));
 assert.equal(await page.evaluate(()=>independent._child.collection.start.toISOString().slice(0,10)),'2026-11-12');
 await page.evaluate(()=>date._child.shadowRoot.querySelectorAll('button')[1].click());
 await page.waitForFunction(()=>b._child.collection.compare===1);
 assert.equal(await page.evaluate(()=>independent._child.collection.compare),0);
 await page.evaluate(()=>{window.late=addCard('b','energy-sources-table');});
 await page.waitForFunction(()=>late._child?.collection.compare===1);
 assert.equal(await page.evaluate(()=>late._child.collection.start.toISOString().slice(0,10)),'2026-11-11');
 await page.evaluate(()=>{a.setConfig({type:'custom:multi-location-energy-card',location_id:'b',card_type:'energy-distribution'});});
 await page.waitForFunction(()=>a._child?._hass.config.location_name==='Frestia_2');
 assert.equal(await page.evaluate(()=>a._child.collection===b._child.collection),true);
 // Card editor uses immutable IDs but presents readable location names.
 await page.evaluate(async()=>{const Card=customElements.get('multi-location-energy-card');window.editor=await Card.getConfigElement();editor.hass=window.hass;editor.setConfig({type:'custom:multi-location-energy-card',location_id:'a',card_type:'energy-distribution'});editor.addEventListener('config-changed',event=>window.edited=event.detail.config);document.body.append(editor);});
 await page.getByLabel('Location',{exact:true}).selectOption('b');
 assert.equal(await page.evaluate(()=>window.edited.location_id),'b');
 await page.getByLabel('Native card',{exact:true}).selectOption('energy-date-selection');
 assert.equal(await page.evaluate(()=>window.edited.card_type),'energy-date-selection');
 await page.evaluate(()=>{window.unknown=addCard('missing');});
 await page.getByRole('alert').filter({hasText:'no longer exists'}).waitFor();
 await page.evaluate(()=>{window.denied=document.createElement('multi-location-energy-card');denied.setConfig({location_id:'a'});denied.hass={...window.hass,user:{id:'nonadmin',is_admin:false}};document.body.append(denied);});
 await page.getByRole('alert').filter({hasText:'administrator'}).waitFor();
 assert.equal(await page.evaluate(()=>window.calls.some(call=>call.type==='energy/get_prefs')),false);
 assert.deepEqual(await page.evaluate(()=>window.escapeContexts),[]);
 // Detaching a selector must leave its sibling's collection functional.
 await page.evaluate(()=>{date.remove();window.bCollection=b._child.collection;});
 assert.equal(await page.evaluate(()=>b._child.collection===window.bCollection),true);
 for(const width of [1100,360]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.deepEqual(errors,[]);
 console.log('PASS: two-location native card boundaries, shared/independent dates, comparison, late joins, reconfiguration, editor, permissions and lifecycle.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
