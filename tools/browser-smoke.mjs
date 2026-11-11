/** Browser boundary smoke test with explicit native-component doubles. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(process.env.PLAYWRIGHT_MODULE || "C:/Users/pedro.pedrosa.SA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"); }
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const filename = pathname.startsWith("/frontend/") ? path.join(root, pathname) : path.join(root, pathname === "/generators-fixture" ? "tests/generators-fixture.html" : "tests/browser-fixture.html");
  if (!filename.startsWith(root + path.sep)) {response.writeHead(403).end(); return;}
  response.setHeader("Content-Type", filename.endsWith(".js") ? "text/javascript" : "text/html");
  fs.createReadStream(filename).on("error", () => response.writeHead(404).end()).pipe(response);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await playwright.chromium.launch({headless:true, ...(process.platform === "win32" ? {channel:"msedge"} : {})});
try {
  const page = await browser.newPage({viewport:{width:1280,height:850}});
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/energy-locations/a/electricity`);
  await page.getByText("Dashboard: A",{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.loadedFragments), ["energy", "config"]);
  const selector = await page.getByLabel("Location",{exact:true}).boundingBox();
  const nativeToolbar = await page.getByText("Native toolbar",{exact:true}).boundingBox();
  assert.ok(nativeToolbar.y >= selector.y + selector.height, "Native fixed toolbar must stay below location controls");
  await page.getByRole("button",{name:"Configure",exact:true}).click();
  await page.getByRole("heading",{name:"Translated settings"}).waitFor();
  assert.equal(await page.getByRole("heading",{name:"Generators",exact:true}).count(),0);
  await page.getByRole('button',{name:'Generators',exact:true}).click();
  await page.getByRole('heading',{name:'Generators',exact:true}).waitFor();
  await page.getByRole('button',{name:'Configure',exact:true}).click();
  await page.getByRole('heading',{name:'Translated settings'}).waitFor();
  await page.getByRole("button",{name:"Add grid fixture"}).click();
  await page.getByRole("button",{name:"Save fixture"}).click();
  await page.waitForFunction(()=>window.preferences.a.energy_sources[0].name==='Updated');
  assert.equal(await page.evaluate(()=>window.preferences.b.energy_sources[0].name),'B');
  assert.equal(await page.evaluate(()=>window.nativePrefs.energy_sources[0].name),'Native');
  await page.waitForFunction(()=>window.frontendPrefs.a.hidden_cards?.length===1);
  assert.deepEqual(await page.evaluate(()=>window.frontendPrefs.b),{});
  assert.deepEqual(await page.evaluate(()=>window.escapedContexts),[]);
  await page.getByLabel("Location",{exact:true}).selectOption("b");
  await page.getByText("Dashboard: B",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Add location",exact:true}).click();
  await page.getByRole("textbox",{name:"Location name"}).fill("Home C");
  await page.getByRole("button",{name:"Save",exact:true}).click();
  await page.getByRole("button",{name:"Add grid fixture"}).waitFor();
  assert.equal(await page.evaluate(()=>window.locations.at(-1).name),'Home C');
  assert.equal(await page.evaluate(()=>window.calls.some(call=>call.type.startsWith('energy/'))),false);
  assert.deepEqual(errors,[]);
  // Explicit extension double: test atomic panel publication, not card math.
  await page.route('**/frontend/native-extension.js?*', route=>route.fulfill({
    contentType:'text/javascript',body:'export async function loadGeneratorExtension(){};export async function generateGeneratorDashboard(){return {views:[{path:"electricity",cards:[{type:"custom:generator-fixture"}]}]};}',
  }));
  await page.evaluate(()=>{
    window.fixtureGenerators.a=[{id:'g',name:'Generator',energy:'sensor.generated'}];
    window.publishedDashboards=[];
    const panel=document.querySelector('mle-panel');
    const initial=panel._withTranslations(panel.hass).localize;
    window.translationStable=panel._withTranslations({...panel.hass,states:{changed:{}}}).localize===initial;
  });
  await page.getByLabel('Location',{exact:true}).selectOption('a');
  await page.getByText('Dashboard: Updated',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.translationStable),true,'Sensor updates must not trigger a language-change dashboard rebuild');
  assert.deepEqual(await page.evaluate(()=>window.publishedDashboards.map(value=>value.config?.views[0].cards[0].type)),['custom:generator-fixture'],'Only the final generator config may reach the native view renderer');
  await page.goto(`http://127.0.0.1:${server.address().port}/generators-fixture`);
  await page.waitForFunction(()=>window.ready);
  await page.getByText('24 kWh',{exact:true}).waitFor();
  await page.getByText('40 %',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Now',exact:true}).click();
  await page.getByText('0.5 m³/h',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Configure generators',exact:true}).click();
  for (const width of [1000,550,360]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Generator editor must fit long meter names');
  }
  await page.getByLabel('Name',{exact:true}).first().fill('Test generator');
  await page.getByRole('button',{name:'Save generators',exact:true}).click();
  await page.waitForFunction(()=>window.saved.length===1);
  assert.equal(await page.evaluate(()=>window.saved[0].location_id),'test-location');
  assert.equal(await page.evaluate(()=>window.saved[0].generators[0].name),'Test generator');
  await page.setViewportSize({width:360,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log("Browser boundary smoke passed: native dialog saves stay scoped; switching and creation work; global energy API untouched.");
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
