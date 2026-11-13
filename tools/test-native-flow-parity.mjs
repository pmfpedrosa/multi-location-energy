/** Compare the untouched pinned HA allocation with our generator-free path. */
import fs from 'node:fs';
import {transform} from 'esbuild';
import assert from 'node:assert/strict';
import {computeElectricityFlows} from '../frontend/electricity-flows.js';
const source=fs.readFileSync(new URL('../dist/frontend-native/src/data/energy.ts',import.meta.url),'utf8');
const from=source.indexOf('export const computeConsumptionSingle ='),to=source.indexOf('export const formatConsumptionShort',from);
const {code}=await transform(source.slice(from,to),{loader:'ts',format:'esm'});
const {computeConsumptionSingle}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
let seed=17;
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*20;};
for(let i=0;i<1000;i++){
 const data={from_grid:random(),to_grid:random(),solar:random(),from_battery:random(),to_battery:random()};
 const native=computeConsumptionSingle(data),ours=computeElectricityFlows(data);
 for(const [key,value]of Object.entries(native))assert.ok(Math.abs(ours[key]-value)<1e-10,`${key}: native ${value}, ours ${ours[key]}`);
}
console.log('PASS: 1,000 generator-free balances match the pinned native allocation.');
