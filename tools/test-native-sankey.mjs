/** Uses unmodified native HA energy Sankey + real Lit/ECharts, fixed data. */
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
 const file=pathname.startsWith('/frontend/')||pathname.startsWith('/dist/')?path.join(root,pathname):path.join(root,'tests/native-sankey-fixture.html');
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(file).on('error',()=>res.writeHead(404).end()).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/test`);
 await page.waitForFunction(()=>Array.isArray(window.cards)&&cards.every(card=>card._child));
 await page.evaluate(async()=>{for(const [i,card]of cards.entries()){card._child._data=makeData(i?37.8843:4.3513);await card._child.updateComplete;}});
 await page.waitForFunction(()=>cards.every(card=>card._child.shadowRoot.querySelector('ha-sankey-chart')?.data));
 // Allow the real chart's initial resize/layout to settle before measurement.
 await page.waitForTimeout(700);
 const stable=await page.evaluate(async()=>{
  const before=cards.map(card=>card._child.shadowRoot.querySelector('ha-sankey-chart').data);
  for(let i=0;i<40;i++){
   window.hass={...hass,states:{'sensor.unrelated':{state:String(i)}}};
   for(const card of cards)card.hass=hass;
   await new Promise(requestAnimationFrame);
  }
  return cards.map((card,i)=>({stable:card._child.shadowRoot.querySelector('ha-sankey-chart').data===before[i],home:before[i].nodes.find(n=>n.id==='home').value}));
 });
 assert.deepEqual(stable,[{stable:true,home:4.3513},{stable:true,home:37.8843}]);
 assert.equal(await page.evaluate(async()=>{
  const child=cards[0]._child,before=child.shadowRoot.querySelector('ha-sankey-chart').data;
  child._data=makeData(12);await child.updateComplete;
  return child.shadowRoot.querySelector('ha-sankey-chart').data!==before&&child.shadowRoot.querySelector('ha-sankey-chart').data.nodes.find(n=>n.id==='home').value===12;
 }),true,'Changing selected-period data must still update the native chart');
 assert.deepEqual(errors,[]);
 console.log('PASS: real native Sankey data/layout stays stable during 40 sensor updates in two locations; changed period data still renders.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
