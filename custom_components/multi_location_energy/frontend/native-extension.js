/** Per-instance native dashboard extension. Never modifies HA's global classes. */
import * as native from "./native-energy.js?v=0.2.3-beta.2";
import { registerGeneratorDetails } from "./generator-details.js?v=0.2.3-beta.2";

const extendedCards = ["energy-distribution", "energy-usage-graph", "energy-sources-table",
  "energy-sankey", "energy-self-sufficiency-gauge", "energy-carbon-consumed-gauge",
  "energy-devices-graph", "energy-devices-detail-graph",
  "energy-solar-consumed-gauge", "power-sources-graph", "power-sankey", "energy-date-selection"];
let loaded;
export async function loadGeneratorExtension(hass) {
  loaded ||= (async () => {
    if (!window.loadCardHelpers) {
      const resolver=document.createElement("partial-panel-resolver");
      resolver.hass=hass;
      const routes=resolver._getRoutes(hass.panels).routes;
      const lovelace=routes.lovelace || Object.values(routes).find(route=>route.tag==="ha-panel-lovelace");
      if(!lovelace?.load) throw new Error("Native dashboard card loader is unavailable");
      await lovelace.load();
    }
    const helpers = await window.loadCardHelpers();
    // These native definitions own the shared charts, controls and dialogs.
    for (const type of [...extendedCards,"energy-solar-graph"]) {
      await helpers.createCardElement({ type, collection_key: "energy_dashboard" });
      await customElements.whenDefined(`hui-${type}-card`);
    }
    await helpers.createBadgeElement({type:"power-total",collection_key:"energy_dashboard_now"});
    await customElements.whenDefined("hui-power-total-badge");
    const PeriodSelector = customElements.get("hui-energy-period-selector");
    if (!PeriodSelector) throw new Error("Native energy date controls are unavailable");
    if (!customElements.get("mle-hui-energy-period-selector")) {
      customElements.define("mle-hui-energy-period-selector", class extends PeriodSelector {
        _downloadData() {
          const collection = this._energyCollection.collection;
          if (collection) native.downloadEnergyData(collection, this._hassConfig.currency);
        }
      });
    }
    registerGeneratorDetails(native);
  })().catch(error => { loaded=undefined; throw error; });
  return loaded;
}

export async function generateGeneratorDashboard(hass, generators, hiddenCards, now) {
  const config = await native.EnergyDashboardStrategy.generate({type:"energy",
    default_collection:now?"energy_dashboard_now":undefined,hidden_cards:hiddenCards},hass);
  const strategies = {energy:native.EnergyViewStrategy,
    "energy-overview":native.EnergyOverviewViewStrategy,power:native.PowerViewStrategy};
  const transform = value => {
    if (Array.isArray(value)) return value.map(transform);
    if (!value || typeof value !== "object") return value;
    const result=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,transform(item)]));
    if (extendedCards.includes(result.type)) {
      if(result.type === "energy-sources-table" && result.types) result.types=[...result.types,"generator"];
      result.type=`custom:mle-hui-${result.type}-card`;
    }
    if(result.type === "power-total") result.type="custom:mle-hui-power-total-badge";
    return result;
  };
  for (let i=0;i<config.views.length;i++) {
    const view=config.views[i];
    const Strategy=strategies[view.strategy?.type];
    if (!Strategy) continue; // Unmodified native gas/water view strategies.
    const generated=await Strategy.generate(view.strategy,hass);
    const {strategy,...metadata}=view;
    const result=transform({...metadata,...generated});
    result.sections ||= [];
    const cards=[];
    if(view.path!=="now") cards.push({type:"custom:mle-hui-energy-generator-graph-card",
      title:"Generator electricity production",collection_key:strategy.collection_key,
      grid_options:{columns:36}});
    cards.push({type:"custom:mle-generator-details-card",generators,
      collection_key:strategy.collection_key,mode:view.path==="now"?"now":"period",
      grid_options:{columns:36}});
    result.sections.push({type:"grid",column_span:3,cards});
    config.views[i]=result;
  }
  return config;
}
