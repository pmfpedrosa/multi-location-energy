import test from 'node:test';
import assert from 'node:assert/strict';
import {total,efficiency,periodEfficiency,live,balance} from '../frontend/generator-math.js';
test('efficiency uses matched period increments, not meter lifetime totals',()=>{
 const output=[{start:0,end:3600,change:8}],fuel=[{start:0,end:3600,change:2}];
 assert.equal(periodEfficiency(output,fuel,10),40);
 assert.equal(periodEfficiency(output,[{start:3600,end:7200,change:2}],10),null);
 assert.equal(periodEfficiency(output,[],10),null);
 assert.equal(efficiency(0,0),null);
 assert.equal(efficiency(0,2),0);
});
test('missing or invalid history is unavailable, never zero',()=>{
 assert.equal(total([]),null);assert.equal(total([{change:null}]),null);
 assert.equal(total([{change:1},{change:NaN}]),null);
 assert.equal(total([{change:-1}]),null);
 assert.equal(total([{change:0}]),0);
});
test('live unit conversion and missing sensors',()=>{
 const states={p:{state:'2000',attributes:{unit_of_measurement:'W'}},g:{state:'500',attributes:{unit_of_measurement:'L/h'}}};
 assert.equal(live(states,'p','power'),2);assert.equal(live(states,'g','flow'),0.5);
 assert.equal(live(states,'missing','power'),null);
 states.p.state='unavailable';assert.equal(live(states,'p','power'),null);
});
test('electricity balance includes generation, excludes fuel',()=>{
 assert.equal(balance(5,12,11,2,4,2),24);
 assert.equal(balance(0,3,3,0,1,1),4);
 assert.equal(balance(0,3,null,0,1,1),null);
});
