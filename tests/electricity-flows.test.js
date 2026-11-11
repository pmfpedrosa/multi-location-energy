import test from "node:test";
import assert from "node:assert/strict";
import { computeElectricityFlows, withGeneratorSources } from "../frontend/electricity-flows.js";

test("Frestia_1 simulated generator contributes to loads, never solar", () => {
  const result = computeElectricityFlows({ from_grid: 0.67, to_grid: 0.11, generator: 1 });
  assert.ok(Math.abs(result.used_total - 1.56) < 1e-10);
  assert.equal(result.used_solar, 0);
  assert.equal(result.generator_to_grid, 0.11);
  assert.equal(result.used_generator, 0.89);
});
test("Frestia_2 without generator retains native balance", () => {
  const result = computeElectricityFlows({ from_grid: 0.66, to_grid: 0.11, solar: 17.22, from_battery: 16 });
  assert.ok(Math.abs(result.used_total - 33.77) < 1e-10);
  assert.equal(result.used_generator, 0);
  assert.equal(result.generator_to_grid, 0);
  assert.equal(result.solar_to_grid, 0.11);
});
test("simultaneous solar/generator flows conserve each source", () => {
  for (let solar = 0; solar <= 8; solar += 2) for (let generator = 0; generator <= 8; generator += 2) {
    const result = computeElectricityFlows({ solar, generator, from_grid: 5, from_battery: 2, to_grid: 2, to_battery: 3 });
    assert.ok(Math.abs(result.used_solar + result.solar_to_battery + result.solar_to_grid - solar) < 1e-10);
    assert.ok(Math.abs(result.used_generator + result.generator_to_battery + result.generator_to_grid - generator) < 1e-10);
    assert.ok(Math.abs(result.used_total - result.used_solar - result.used_generator - result.used_grid - result.used_battery) < 1e-10);
  }
});
test("generator preferences are distinct and do not mutate either location", () => {
  const native = { energy_sources: [{ type: "solar", stat_energy_from: "sensor.pv" }] };
  const result = withGeneratorSources(native, [{ id: "g1", name: "Simulation", energy: "sensor.generator" }]);
  assert.equal(native.energy_sources.length, 1);
  assert.equal(result.energy_sources[1].type, "generator");
  assert.deepEqual(withGeneratorSources(native, []).energy_sources, native.energy_sources);
});
