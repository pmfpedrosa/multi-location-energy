import test from 'node:test';
import assert from 'node:assert/strict';
import {computeElectricityFlows as flows,generatorAllocations} from '../frontend/electricity-flows.js';

test('grid + generator + load conserves the mockup electricity balance',()=>{
  const result=flows({from_grid:18,generator:12,to_grid:3});
  assert.equal(result.used_total,27);assert.equal(result.used_generator,9);
  assert.equal(result.used_grid,18);assert.equal(result.generator_to_grid,3);
  assert.equal(result.used_solar,0);
});
test('simultaneous solar and generators stay separate while charging and exporting',()=>{
  const result=flows({from_grid:2,solar:8,generator:4,to_battery:3,to_grid:3});
  assert.equal(result.used_total,8);
  assert.equal(result.solar_to_battery,2);assert.equal(result.generator_to_battery,1);
  assert.equal(result.solar_to_grid,2);assert.equal(result.generator_to_grid,1);
  assert.equal(result.used_solar,4);assert.equal(result.used_generator,2);
});
test('multiple generators are allocated in their own time buckets',()=>{
  const sources=[{id:'night',name:'Night',stat_energy_from:'sensor.a'},{id:'day',name:'Day',stat_energy_from:'sensor.b'}];
  const result=generatorAllocations(sources,{'sensor.a':[{start:1,change:10}],'sensor.b':[{start:2,change:10}]},
    {used_generator:{1:10,2:0},generator_to_grid:{1:0,2:10},generator_to_battery:{}});
  assert.equal(result[0].used,10);assert.equal(result[0].to_grid,0);
  assert.equal(result[1].used,0);assert.equal(result[1].to_grid,10);
});
test('absent and invalid generator readings never become solar generation',()=>{
  const result=flows({from_grid:5,generator:NaN});
  assert.equal(result.used_total,5);assert.equal(result.used_generator,0);assert.equal(result.used_solar,0);
});
