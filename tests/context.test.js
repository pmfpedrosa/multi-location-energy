import test from "node:test";
import assert from "node:assert/strict";
import { createLocationScope, scopedContext } from "../frontend/scope.js";

const groups = {
  hassRegistries: "entities", hassInternationalization: "locale",
  hassApi: "callApi", hassConnection: "connected", hassUi: "themes",
  hassConfig: "config", hassFormatters: "formatEntityName",
};

test("native reactive context groups retain identity across unrelated sensor updates", () => {
  const hass = { connection: {}, config: { location_name: "Main" }, states: {} };
  const scope = createLocationScope(hass, "a", { name: "Frestia_1" });
  const initial = scope.update(hass);
  for (const [context, field] of Object.entries(groups)) {
    const before = scopedContext(initial, context);
    const after = scope.update({ ...hass, states: { "sensor.live": { state: "42" } } });
    assert.equal(scopedContext(after, context, before), before, context);
    const changed = scope.update({ ...hass, [field]: { changed: true } });
    assert.notEqual(scopedContext(changed, context, before), before, context);
  }
});

test("location config is stable, updates when HA config changes, and stays isolated", () => {
  const hass = { connection: {}, config: { location_name: "Main", version: "2026.11.0" } };
  const a = createLocationScope(hass, "a", { name: "Frestia_1" });
  const b = createLocationScope(hass, "b", { name: "Frestia_2" });
  const first = a.update(hass);
  assert.equal(first.config, first.config);
  assert.equal(a.update({ ...hass, states: {} }).config, first.config);
  assert.equal(b.update(hass).config.location_name, "Frestia_2");
  const changed = a.update({ ...hass, config: { ...hass.config, version: "2026.11.1" } });
  assert.notEqual(changed.config, first.config);
  assert.equal(changed.config.version, "2026.11.1");
  assert.equal(changed.config.location_name, "Frestia_1");
  assert.equal(hass.config.location_name, "Main");
});
