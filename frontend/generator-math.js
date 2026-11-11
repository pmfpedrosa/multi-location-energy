/** Pure calculations. Missing measurements must never become zero. */
export const finite = value => typeof value === "number" && Number.isFinite(value);
export function total(rows) {
  if (!rows?.length || rows.some(row => !finite(row.change) || row.change < 0)) return null;
  return rows.reduce((sum, row) => sum + row.change, 0);
}
export function efficiency(output, input) {
  return finite(output) && finite(input) && output >= 0 && input > 0 ? output / input * 100 : null;
}
export function periodEfficiency(electricity, fuel, factor) {
  // Different coverage makes a ratio misleading, even when both totals exist.
  if (!electricity?.length || electricity.length !== fuel?.length ||
      electricity.some((row, i) => row.start !== fuel[i].start || row.end !== fuel[i].end)) return null;
  const input = total(fuel);
  return efficiency(total(electricity), input === null ? null : input * factor);
}
export function live(states, id, kind) {
  const state = states[id];
  if (!state || state.state === "" || !Number.isFinite(Number(state.state))) return null;
  const units = kind === "flow" ? {"m³/h":1,"L/h":0.001,"L/min":0.06,"ft³/min":1.69901079552} : {W:0.001,kW:1,MW:1000};
  const factor = units[state.attributes.unit_of_measurement];
  return factor === undefined ? null : Number(state.state) * factor;
}
export function add(values) { return values.every(finite) ? values.reduce((a,b)=>a+b,0) : null; }
export function balance(imported, solar, generators, discharge, exported, charge) {
  return [imported,solar,generators,discharge,exported,charge].every(finite)
    ? imported + solar + generators + discharge - exported - charge : null;
}
