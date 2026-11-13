import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeGeneratorCollection} from '../frontend/generator-extension.js';
import {acquireCardScope} from '../frontend/card-scope.js';

test('generator collection is seeded in the shared scoped cache before a date selector uses it',()=>{
 const hass={connection:{},callWS:async()=>({}),config:{},states:{},entities:{},locale:{},panelUrl:'combined'};
 const a=acquireCardScope(hass,{id:'a',name:'Frestia_1'},'all-homes');
 const b=acquireCardScope(hass,{id:'b',name:'Frestia_2'},'all-homes');
 const collection={start:new Date('2026-11-12'),compare:0,setPeriod(){},setCompare(){}};
 const native={getEnergyDataCollection(connection,options){
   assert.equal(options.callWS,a.update(hass).callWS);
   assert.equal(options.key,a.key);
   connection['_'+options.key]=collection;return collection;
 }};
 assert.equal(initializeGeneratorCollection(native,a.update(hass),a.key),collection);
 assert.equal(a.update(hass).connection['_'+a.key],collection);
 assert.equal(b.update(hass).connection['_'+a.key],undefined);
 assert.equal(hass.connection['_'+a.key],undefined);
 a.release();b.release();
});
