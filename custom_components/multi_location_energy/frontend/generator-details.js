import { total, periodEfficiency, efficiency, live, finite } from "./generator-math.js?v=0.2.3-beta.1";
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

/** Subscribes to the native date/compare collection; no independent date picker. */
export function registerGeneratorDetails(native) {
  if (customElements.get("mle-generator-details-card")) return;
  customElements.define("mle-generator-details-card", class extends HTMLElement {
    constructor() { super(); this.attachShadow({mode:"open"}); this._revision=0; }
    setConfig(config) { this._revision++; this._unsubscribe?.(); this._unsubscribe=undefined; this._config=config; this._connect(); }
    set hass(hass) { this._hass=hass; this._connect(); if(this._config?.mode==="now") this._render(); }
    connectedCallback() { this._connect(); }
    disconnectedCallback() { this._unsubscribe?.(); this._unsubscribe=undefined; this._revision++; }
    getCardSize() { return 3 * (this._config?.generators.length || 1); }
    getGridOptions() { return {columns:36,min_columns:6}; }
    _connect() {
      if(!this.isConnected || !this._hass || !this._config || this._unsubscribe) return;
      const hass=this._hass;
      const collection=native.getEnergyDataCollection(hass.connection,{callWS:hass.callWS,
        entities:hass.entities,states:hass.states,locale:hass.locale,config:hass.config,
        panelUrl:hass.panelUrl,key:this._config.collection_key});
      this._unsubscribe=collection.subscribe(data=>this._refresh(data));
    }
    async _refresh(data) {
      this._data=data;
      if(this._config.mode==="now") { this._render(); return; }
      const revision=++this._revision;
      this._error=""; this._stats=undefined; this._compare=undefined; this._render();
      const ids=[...new Set(this._config.generators.flatMap(g=>[g.energy,g.gas]))];
      const period=native.getSuggestedPeriod(data.start,data.end);
      const fetch=async(start,end)=>{
        const range=native.getStatisticsRange(this._hass.locale,this._hass.config,period,start,end);
        return this._hass.callWS({type:"recorder/statistics_during_period",statistic_ids:ids,
          start_time:range[0].toISOString(),end_time:range[1]?.toISOString(),
          period,types:["change"],units:{energy:"kWh",volume:"m³"}});
      };
      try {
        const [stats,compare]=await Promise.all([fetch(data.start,data.end),
          data.startCompare?fetch(data.startCompare,data.endCompare):undefined]);
        if(revision!==this._revision)return;
        this._stats=stats; this._compare=compare;
      } catch(error) { if(revision!==this._revision)return; this._error=error.message||String(error); }
      this._render();
    }
    _render() {
      if(!this._config || !this._hass)return;
      const now=this._config.mode==="now";
      const format=(value,unit)=>finite(value)?`${new Intl.NumberFormat(this._hass.locale?.language,{maximumFractionDigits:2}).format(value)} ${unit}`:"Unavailable";
      const metrics=(g,stats)=>{
        const factor=g.gas_unit==="m³"?g.factor:1;
        const output=now?live(this._hass.states,g.power,"power"):total(stats?.[g.energy]);
        const gas=now?live(this._hass.states,g.gas_power,g.gas_unit==="m³"?"flow":"power"):total(stats?.[g.gas]);
        return {output,gas,ratio:now?efficiency(output,finite(gas)?gas*factor:null):periodEfficiency(stats?.[g.energy],stats?.[g.gas],factor)};
      };
      this.shadowRoot.innerHTML=`<style>
        :host{display:block;color:var(--primary-text-color)}ha-card{display:block;padding:20px;background:var(--ha-card-background,var(--card-background-color));border:1px solid var(--ha-card-border-color,var(--divider-color));border-radius:var(--ha-card-border-radius,12px)}
        h2{margin:0 0 16px;font-size:24px;font-weight:400}h3{font-size:16px;overflow-wrap:anywhere}section+section{border-top:1px solid var(--divider-color);margin-top:20px}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.label,p{color:var(--secondary-text-color);font-size:13px}.value{font-size:22px;padding:8px 0}.compare{font-size:12px;color:var(--secondary-text-color)}.error{color:var(--error-color)}@media(max-width:500px){.metrics{grid-template-columns:1fr}.value{padding:4px 0}}
      </style><ha-card><h2>Generator fuel and efficiency</h2>
      ${this._error?`<p class="error" role="alert">${escape(this._error)}</p>`:""}
      ${!now&&!this._stats&&!this._error?'<p role="status">Loading selected period…</p>':""}
      ${this._config.generators.map(g=>{
        const values=metrics(g,this._stats),compare=this._compare?metrics(g,this._compare):undefined;
        const unit=now?"kW":"kWh",gasUnit=g.gas_unit==="m³"?(now?"m³/h":"m³"):unit;
        return `<section><h3>${escape(g.name)}</h3><div class="metrics">${[
          [now?"Electrical output":"Electricity produced","output",unit],
          [now?"Natural gas flow":"Natural gas consumed","gas",gasUnit],
          [`Electrical efficiency · ${g.basis}`,"ratio","%"]
        ].map(([label,key,unit])=>`<div><div class="label">${escape(label)}</div><div class="value">${format(values[key],unit)}</div>${compare?`<div class="compare">Comparison: ${format(compare[key],unit)}</div>`:""}</div>`).join("")}</div>
        <p>${g.gas_unit==="m³"?`${escape(g.factor)} kWh fuel/m³ · `:""}${escape(g.basis)} heating-value basis. Fuel detail is not added again to location gas totals.</p>
        ${!finite(values.ratio)?'<p>Efficiency requires matching electricity and fuel measurements and positive fuel input.</p>':values.ratio>100?'<p class="error">Efficiency exceeds 100%. Check simulated meters or the conversion factor.</p>':""}</section>`;
      }).join("")}</ha-card>`;
    }
  });
}
