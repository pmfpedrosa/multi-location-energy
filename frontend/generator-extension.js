/** Isolated native card implementations; never replace global HA definitions. */
export const GENERATOR_CARDS = new Set(['energy-distribution','energy-usage-graph','energy-sources-table','energy-sankey','energy-self-sufficiency-gauge','energy-carbon-consumed-gauge','energy-devices-graph','energy-devices-detail-graph','energy-solar-consumed-gauge','power-sources-graph','power-sankey','energy-date-selection']);
let pending;
export async function loadGeneratorCards(hass, helpers) {
  pending ||= (async()=>{
    for(const type of [...GENERATOR_CARDS,'energy-solar-graph']){
      helpers.createCardElement({type,collection_key:'energy_dashboard'});
      await customElements.whenDefined(`hui-${type}-card`);
    }
    const native=await import('./native-energy.js?v=0.4.0-beta.1');
    const Period=customElements.get('hui-energy-period-selector');
    if(!customElements.get('mle-hui-energy-period-selector'))customElements.define('mle-hui-energy-period-selector',class extends Period {
      _downloadData(){const collection=this._energyCollection.collection;if(collection)native.downloadEnergyData(collection,this._hassConfig.currency);}
    });
    return native;
  })().catch(error=>{pending=undefined;throw error;});
  return pending;
}

export async function generatorDashboard(hass, helpers, hiddenCards, now) {
  const native=await loadGeneratorCards(hass,helpers);
  helpers.createBadgeElement({type:'power-total',collection_key:'energy_dashboard_now'});
  await customElements.whenDefined('hui-power-total-badge');
  const config=await native.EnergyDashboardStrategy.generate({type:'energy',default_collection:now?'energy_dashboard_now':undefined,hidden_cards:hiddenCards},hass);
  const strategies={energy:native.EnergyViewStrategy,'energy-overview':native.EnergyOverviewViewStrategy,power:native.PowerViewStrategy};
  const transform=value=>{
    if(Array.isArray(value))return value.map(transform);
    if(!value||typeof value!=='object')return value;
    const result=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,transform(item)]));
    if(GENERATOR_CARDS.has(result.type)){
      if(result.type==='energy-sources-table'&&result.types)result.types=[...new Set([...result.types,'generator'])];
      result.type=`custom:mle-hui-${result.type}-card`;
    }
    if(result.type==='power-total')result.type='custom:mle-hui-power-total-badge';
    return result;
  };
  for(let i=0;i<config.views.length;i++){
    const view=config.views[i],Strategy=strategies[view.strategy?.type];
    if(!Strategy)continue;
    const generated=await Strategy.generate(view.strategy,hass);
    const {strategy,...metadata}=view;
    const result=transform({...metadata,...generated});
    if(view.path!=='now'){
      result.sections ||= [];
      result.sections.push({type:'grid',column_span:3,cards:[{type:'custom:mle-hui-energy-generator-graph-card',title:'Generator production',collection_key:strategy.collection_key,grid_options:{columns:24}},{type:'custom:mle-hui-energy-generator-contribution-card',collection_key:strategy.collection_key,grid_options:{columns:12}}]});
    }
    config.views[i]=result;
  }
  return config;
}
