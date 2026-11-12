import test from "node:test";
import assert from "node:assert/strict";
import { acquireCardScope, collectionKey } from "../frontend/card-scope.js";

const hass = () => ({ connection: { _energy_dashboard: { native: true } }, config: { location_name: "Original" }, callWS: async message => message });
const collection = () => ({
  start: new Date("2026-11-12"), compare: 0, refreshes: 0,
  setPeriod(start, end) { this.start = start; this.end = end; },
  setCompare(value) { this.compare = value; },
  isActive() { return true; }, refresh() { this.refreshes++; },
});
function attach(lease, source, value) { lease.update(source).connection[`_${lease.key}`] = value; }

test("cards for one location share a collection, other locations never share preferences", async () => {
  const source = hass();
  const a = acquireCardScope(source, {id:"a",name:"Frestia_1"}, "dashboard");
  const again = acquireCardScope(source, {id:"a",name:"Frestia_1"}, "dashboard");
  const b = acquireCardScope(source, {id:"b",name:"Frestia_2"}, "dashboard");
  const ca = collection(), cb = collection(); ca.prefs = {location:"a"}; cb.prefs = {location:"b"};
  attach(a, source, ca); attach(b, source, cb);
  assert.equal(again.update(source).connection[`_${a.key}`], ca);
  assert.notEqual(a.key, b.key);
  assert.equal(a.update(source).config.location_name,"Frestia_1");
  assert.equal(source.config.location_name,"Original");
  assert.equal((await a.update(source).callWS({type:"energy/get_prefs"})).location_id,"a");
  a.release(); await Promise.resolve();
  assert.equal(again.update(source).connection[`_${a.key}`],ca,"Removing one card must not dispose the other card's scope");
  assert.deepEqual(source.connection._energy_dashboard,{native:true});
  again.release(); b.release();
});

test("shared dates and comparison synchronize without mixing data, including late cards", () => {
  const source=hass(), a=acquireCardScope(source,{id:"a",name:"A"},"shared"), b=acquireCardScope(source,{id:"b",name:"B"},"shared");
  const ca=collection(), cb=collection(); attach(a,source,ca); attach(b,source,cb);
  const start=new Date("2026-10-25T00:00:00+01:00"), end=new Date("2026-10-25T23:59:59.999+00:00");
  ca.setPeriod(start,end); ca.setCompare(1);
  assert.equal(cb.start.getTime(),start.getTime()); assert.equal(cb.end.getTime(),end.getTime()); assert.equal(cb.compare,1);
  assert.equal(cb.refreshes,2);
  const late=acquireCardScope(source,{id:"c",name:"C"},"shared"), cc=collection(); attach(late,source,cc);
  assert.equal(cc.start.getTime(),start.getTime()); assert.equal(cc.compare,1);
  cc.setCompare(0); assert.equal(ca.compare,0); assert.equal(cb.compare,0);
  a.release();b.release();late.release();
});

test("independent date groups and real HA connections remain isolated", () => {
  const source=hass(), other=hass();
  const a=acquireCardScope(source,{id:"a",name:"A"},"one"), b=acquireCardScope(source,{id:"b",name:"B"},"two"), c=acquireCardScope(other,{id:"a",name:"A"},"one");
  const ca=collection(),cb=collection(),cc=collection(); attach(a,source,ca);attach(b,source,cb);attach(c,other,cc);
  ca.setPeriod(new Date("2020-01-01"));
  assert.equal(cb.start.getFullYear(),2026); assert.equal(cc.start.getFullYear(),2026);
  assert.notEqual(collectionKey("a:b","c"),collectionKey("a","b:c"));
  a.release();b.release();c.release();
});

test("last card releases timers and restores only its own collection methods", async () => {
  const source=hass(), a=acquireCardScope(source,{id:"a",name:"A"},"cleanup"), ca=collection();
  const original=ca.setPeriod;attach(a,source,ca);assert.notEqual(ca.setPeriod,original);
  a.release();a.release();await Promise.resolve();assert.equal(ca.setPeriod,original);
  const next=acquireCardScope(source,{id:"a",name:"A"},"cleanup");assert.equal(next.update(source).connection[`_${next.key}`],undefined);next.release();
});
