/** Electricity allocation for the native dashboard extension.
 * Production remains separate from solar. Where meters cannot distinguish
 * destination, simultaneous solar/generator production is allocated in
 * proportion to production in each statistics bucket. These flows are estimates.
 * With no generator the allocation order matches HA frontend 20261028.4.
 */
export function computeElectricityFlows(data) {
  const positive = value => Number.isFinite(value) ? Math.max(0, value) : 0;
  let grid = positive(data.from_grid);
  let battery = positive(data.from_battery);
  let charge = positive(data.to_battery);
  let exported = positive(data.to_grid);
  let solar = positive(data.solar);
  let generator = positive(data.generator);
  const used_total = grid + battery + solar + generator - charge - exported;
  let remaining = Math.max(0, used_total);
  const flows = { used_total, used_solar: 0, used_generator: 0, used_grid: 0,
    used_battery: 0, grid_to_battery: 0, battery_to_grid: 0,
    solar_to_battery: 0, generator_to_battery: 0,
    solar_to_grid: 0, generator_to_grid: 0 };
  flows.grid_to_battery = Math.max(0, Math.min(charge, grid - remaining));
  grid -= flows.grid_to_battery;
  charge -= flows.grid_to_battery;
  const allocateProduction = (demand, solarKey, generatorKey) => {
    const production = solar + generator;
    const allocated = Math.min(demand, production);
    const solarPart = production ? allocated * solar / production : 0;
    flows[solarKey] = solarPart;
    flows[generatorKey] = allocated - solarPart;
    solar -= solarPart;
    generator -= allocated - solarPart;
    return allocated;
  };
  charge -= allocateProduction(charge, "solar_to_battery", "generator_to_battery");
  exported -= allocateProduction(exported, "solar_to_grid", "generator_to_grid");
  flows.battery_to_grid = Math.min(battery, exported);
  battery -= flows.battery_to_grid;
  const gridCharge = Math.min(grid, charge);
  flows.grid_to_battery += gridCharge;
  grid -= gridCharge;
  remaining -= allocateProduction(remaining, "used_solar", "used_generator");
  flows.used_battery = Math.min(battery, remaining);
  remaining -= flows.used_battery;
  flows.used_grid = Math.min(grid, remaining);
  return flows;
}

/** Enrich a dashboard response only; never save generator sources as native prefs. */
export function withGeneratorSources(prefs, generators) {
  return { ...prefs, energy_sources: [...prefs.energy_sources,
    ...generators.map(generator => ({ type: "generator", id: generator.id,
      name: generator.name, stat_energy_from: generator.energy,
      stat_rate: generator.power || null }))] };
}
