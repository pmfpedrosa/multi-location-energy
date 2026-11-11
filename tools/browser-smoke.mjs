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
  const filename = pathname.startsWith("/frontend/") ? path.join(root, pathname) : path.join(root, "tests/browser-fixture.html");
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
  console.log("Browser boundary smoke passed: native dialog saves stay scoped; switching and creation work; global energy API untouched.");
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
