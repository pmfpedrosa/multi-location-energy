import test from "node:test";
import assert from "node:assert/strict";
import { createLocationScope, scopedMessage } from "../frontend/scope.js";

test("generator dashboard enrichment never changes stored or other-location preferences", async () => {
  const prefs={energy_sources:[{type:"grid",stat_energy_from:"sensor.grid"}],device_consumption:[],device_consumption_water:[]};
  const hass={connection:{},config:{location_name:"Native"},callWS:async()=>prefs};
  const a=createLocationScope(hass,"a",{name:"Frestia_1",generators:[{id:"g",name:"Simulation",energy:"sensor.output"}]}).update(hass);
  const b=createLocationScope(hass,"b",{name:"Frestia_2"}).update(hass);
  assert.equal((await a.callWS({type:"energy/get_prefs"})).energy_sources[1].type,"generator");
  assert.equal((await b.callWS({type:"energy/get_prefs"})).energy_sources.length,1);
  assert.equal(prefs.energy_sources.length,1);
  assert.equal(a.config.location_name,"Frestia_1");
  assert.equal(b.config.location_name,"Frestia_2");
  assert.equal(hass.config.location_name,"Native");
});

function fixture() {
  const calls = [];
  const connection = { _energy_dashboard: { prefs: { native: true } }, subscribeMessage: (...args) => { calls.push(args); return Promise.resolve(() => {}); }, addEventListener() { assert.equal(this, connection); } };
  const hass = { connection, config: { version: "2026.11.0" }, callWS: async message => { calls.push(message); return { value: {} }; } };
  return { hass, calls };
}

test("all preferences, cost lookup and forecast commands are location-scoped", () => {
  for (const command of ["get_prefs", "save_prefs", "info", "validate", "solar_forecast"]) {
    const source = { type: `energy/${command}`, energy_sources: [] };
    const result = scopedMessage(source, "home-a");
    assert.equal(result.type, `multi_location_energy/${command}`);
    assert.equal(result.location_id, "home-a");
    assert.equal(source.type, `energy/${command}`);
  }
});

test("a future native energy command fails closed", () => {
  assert.throws(() => scopedMessage({ type: "energy/new_global_save" }, "a"), /Unsupported/);
});

test("statistics queries and explicit fossil calculations retain their parameters", () => {
  for (const type of ["recorder/statistics_during_period", "energy/fossil_energy_consumption"]) {
    const message = { type, statistic_ids: ["sensor.a"], start_time: "2026-10-25T00:00:00+01:00" };
    assert.equal(scopedMessage(message, "a"), message);
  }
});

test("two locations and native dashboard never share collection state", () => {
  const { hass } = fixture();
  const a = createLocationScope(hass, "a"), b = createLocationScope(hass, "b");
  assert.equal(a.connection._energy_dashboard, undefined);
  a.connection._energy_dashboard = { prefs: { home: "a" } };
  b.connection._energy_dashboard = { prefs: { home: "b" } };
  assert.equal(a.connection._energy_dashboard.prefs.home, "a");
  assert.equal(b.connection._energy_dashboard.prefs.home, "b");
  assert.deepEqual(hass.connection._energy_dashboard.prefs, { native: true });
  delete a.connection._energy_dashboard;
  assert.equal(a.connection._energy_dashboard, undefined);
});

test("calls through hass and connection both use the selected home", async () => {
  const { hass, calls } = fixture();
  const scope = createLocationScope(hass, "a");
  const scoped = scope.update(hass);
  await scoped.callWS({ type: "energy/get_prefs" });
  await scoped.connection.sendMessagePromise({ type: "energy/save_prefs", energy_sources: [] });
  assert.ok(calls.every(call => call.location_id === "a"));
  assert.equal(scoped.panelUrl, "energy-locations/a");
  assert.equal(hass.panelUrl, undefined);
  scope.connection.addEventListener();
});

test("latest hass state and connection are used after reconnection", async () => {
  const { hass } = fixture(); const scope = createLocationScope(hass, "a");
  const calls = [];
  const latest = { ...hass, states: { "sensor.a": { state: "42" } }, callWS: async message => calls.push(message) };
  const scoped = scope.update(latest);
  await scoped.callWS({ type: "energy/get_prefs" });
  assert.equal(scoped.states["sensor.a"].state, "42");
  assert.equal(calls[0].location_id, "a");
});

test("card customization is saved for one location and subscribers are isolated", async () => {
  const { hass, calls } = fixture();
  const a = createLocationScope(hass, "a"), b = createLocationScope(hass, "b");
  const receivedA = [], receivedB = [];
  const message = { type: "frontend/subscribe_system_data", key: "energy" };
  const unsubA = await a.connection.subscribeMessage(value => receivedA.push(value), message);
  await b.connection.subscribeMessage(value => receivedB.push(value), message);
  await new Promise(resolve => setImmediate(resolve));
  receivedA.length = receivedB.length = 0;
  await a.connection.sendMessagePromise({ type: "frontend/set_system_data", key: "energy", value: { hidden_cards: ["electricity.energy-sankey"] } });
  assert.equal(receivedA.length, 1); assert.equal(receivedB.length, 0);
  assert.equal(calls.at(-1).type, "multi_location_energy/frontend/set");
  unsubA(); a.dispose(); b.dispose();
});

test("saving one location invalidates its Now and history preferences only", async () => {
  const { hass } = fixture(); const a = createLocationScope(hass, "a"), b = createLocationScope(hass, "b");
  a.connection._energy_dashboard = { prefs: { a: true } };
  a.connection._energy_dashboard_now = { prefs: { now: true } };
  b.connection._energy_dashboard = { prefs: { b: true } };
  await a.update(hass).callWS({ type: "energy/save_prefs" });
  assert.equal(a.connection._energy_dashboard.prefs, undefined);
  assert.equal(a.connection._energy_dashboard_now.prefs, undefined);
  assert.deepEqual(b.connection._energy_dashboard.prefs, { b: true });
  assert.deepEqual(hass.connection._energy_dashboard.prefs, { native: true });
});
