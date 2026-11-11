import {total, efficiency, periodEfficiency, live, add, balance, finite} from './generator-math.js?v=0.2.3-beta.3';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (value, unit) => finite(value) ? `${new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(value)} ${unit}` : 'Unavailable';
const styles = `:host{display:block;padding:20px;max-width:1000px;margin:auto;color:var(--primary-text-color)}*{box-sizing:border-box}ha-card{display:block;background:var(--ha-card-background,var(--card-background-color));border:1px solid var(--divider-color);border-radius:12px;margin-bottom:20px;padding:24px}h2{font-size:22px;font-weight:400;margin:0 0 12px}h3{font-size:16px;margin:0 0 12px}.muted{color:var(--secondary-text-color);font-size:13px;line-height:1.5}button,input,select{font:inherit;color:inherit;background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:9px;max-width:100%}button{cursor:pointer}button[aria-pressed=true]{color:var(--primary-color);border-color:var(--primary-color)}.toolbar{display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin-bottom:20px}label{display:flex;flex-direction:column;gap:6px;font-size:13px}.sources{display:flex;justify-content:center;gap:20px;flex-wrap:wrap;padding:12px 0 22px;border-bottom:2px solid var(--divider-color)}.node{text-align:center;min-width:100px;max-width:150px;overflow-wrap:anywhere}.circle{width:94px;min-height:94px;border:2px solid var(--node);border-radius:50%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;margin:0 auto 8px;font-size:13px}.circle ha-icon{--mdc-icon-size:24px}.flow{display:flex;align-items:center;justify-content:space-around;gap:10px;padding:20px 0}.link{height:2px;flex:1;background:var(--divider-color)}.battery{display:flex;justify-content:center;border-top:2px solid var(--divider-color);padding-top:20px}.fuel{padding:18px 0;border-top:1px solid var(--divider-color)}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.value{font-size:20px;margin:8px 0}.fields{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}.error{color:var(--error-color)}.actions{display:flex;gap:10px;flex-wrap:wrap}@media(max-width:550px){:host{padding:12px}ha-card{padding:16px}.metrics,.fields{grid-template-columns:1fr}.node{min-width:82px}.circle{width:82px;min-height:82px}.flow{gap:4px}}`;

const editorLayout = `:host{width:100%;box-sizing:border-box;min-width:0}.fields{grid-template-columns:repeat(2,minmax(0,1fr))}label{min-width:0}input,select{width:100%;min-width:0;text-overflow:ellipsis}@media(max-width:550px){.fields{grid-template-columns:minmax(0,1fr)}}`;
export class MleGenerators extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.mode='period';this.revision=0;}
  set hass(value){this._hass=value;if(this.ready&&this.mode==='now'&&!this.editing)this.renderDashboard();}
  get hass(){return this._hass;}
  async configure(hass, locationId, prefs){
    this._hass=hass;this.locationId=locationId;this.prefs=prefs;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:hass.config.time_zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const part=type=>parts.find(p=>p.type===type).value;
    this.start=this.end=`${part('year')}-${part('month')}-${part('day')}`;
    this.generators=await this.call('get');this.ready=true;
    if(this.settingsOnly){this.renderSettings();return;}
    await this.refresh();
  }
  connectedCallback(){this.timer=setInterval(()=>{if(this.ready&&!this.settingsOnly&&!this.editing&&this.mode==='period')this.refresh();},60000);}
  disconnectedCallback(){clearInterval(this.timer);this.revision++;}
  call(command,args={}){return this.hass.callWS({type:`multi_location_energy/generators/${command}`,location_id:this.locationId,...args});}
  async refresh(){
    const revision=++this.revision;
    this.error='';this.stats={};this.loading=true;this.renderDashboard();
    try{
      const range=await this.call('period',{start:this.start,end:this.end});
      const ids=[...new Set([...this.generators.flatMap(g=>[g.energy,g.gas]),...this.prefs.energy_sources.filter(s=>['grid','solar','battery','home'].includes(s.type)).flatMap(s=>[s.stat_energy_from,s.stat_energy_to])].filter(Boolean))];
      const stats=ids.length?await this.hass.callWS({type:'recorder/statistics_during_period',start_time:range.start,end_time:range.end,statistic_ids:ids,period:'hour',types:['change'],units:{energy:'kWh',volume:'m³'}}):{};
      if(revision!==this.revision)return;
      this.stats=stats;
    }catch(error){if(revision!==this.revision)return;this.error=error.message||String(error);}
    if(revision!==this.revision)return;
    this.loading=false;this.renderDashboard();
  }
  production(g){return this.mode==='now'?live(this.hass.states,g.power,'power'):total(this.stats?.[g.energy]);}
  gas(g){return this.mode==='now'?live(this.hass.states,g.gas_power,g.gas_unit==='m³'?'flow':'power'):total(this.stats?.[g.gas]);}
  sourceValue(source,key){
    if(this.mode!=='now')return source[key]?total(this.stats?.[source[key]]):0;
    const config=source.power_config;
    let power;
    if(config?.stat_rate_from){const a=live(this.hass.states,config.stat_rate_from,'power'),b=live(this.hass.states,config.stat_rate_to,'power');power=finite(a)&&finite(b)?a-b:null;}
    else if(config?.stat_rate_inverted){const v=live(this.hass.states,config.stat_rate_inverted,'power');power=finite(v)?-v:null;}
    else power=live(this.hass.states,config?.stat_rate||source.stat_rate,'power');
    if(!finite(power))return null;
    if(source.type==='solar'||source.type==='home')return power;
    return key==='stat_energy_from'?Math.max(0,power):Math.max(0,-power);
  }
  node(name,value,icon,color){return `<div class="node" style="--node:${color}"><div class="circle"><ha-icon icon="mdi:${icon}"></ha-icon>${value}</div>${esc(name)}</div>`;}
  renderDashboard(){
    if(this.settingsOnly){this.renderSettings();return;}
    if(this.editing)return;
    const now=this.mode==='now', unit=now?'kW':'kWh';
    const sources=this.prefs.energy_sources;
    const sum=(type,key)=>add(sources.filter(s=>s.type===type).map(s=>this.sourceValue(s,key)));
    const imported=sum('grid','stat_energy_from'),exported=sum('grid','stat_energy_to'),solar=sum('solar','stat_energy_from'),discharge=sum('battery','stat_energy_from'),charge=sum('battery','stat_energy_to');
    const generated=add(this.generators.map(g=>this.production(g)));
    const home=sources.some(s=>s.type==='home')?sum('home','stat_energy_to'):balance(imported,solar,generated,discharge,exported,charge);
    const shared=this.generators.some(g=>sources.some(s=>s.type==='gas'&&s.stat_energy_from===g.gas));
    this.shadowRoot.innerHTML=`<style>${styles}${editorLayout}</style><div class="toolbar"><button id="period" aria-pressed="${!now}">Period</button><button id="now" aria-pressed="${now}">Now</button><label>From<input id="start" type="date" value="${this.start}" ${now?'disabled':''}></label><label>Through<input id="end" type="date" value="${this.end}" ${now?'disabled':''}></label><button id="refresh">Refresh</button><button id="configure">Configure generators</button></div>
    <ha-card><h2>Energy distribution</h2><div class="muted">${now?'Live power':`${esc(this.start)} – ${esc(this.end)} · ${esc(this.hass.config.time_zone)} · Completed Recorder hours`}</div><p role="status" class="${this.error?'error':'muted'}">${esc(this.error|| (this.loading?'Loading statistics…':''))}</p>
    <div class="sources">${sources.some(s=>s.type==='solar')?this.node('Solar',fmt(solar,unit),'solar-power','var(--energy-solar-color,#ff9800)'):''}${this.generators.map((g,i)=>this.node(g.name,fmt(this.production(g),unit),'engine',i%2?'#9575cd':'#009688')).join('')}</div>
    <div class="flow">${this.node('Grid',`<span>→ ${fmt(imported,unit)}</span><span>← ${fmt(exported,unit)}</span>`,'transmission-tower','var(--energy-grid-consumption-color,#488fc2)')}<div class="link"></div>${this.node('Loads',fmt(home,unit),'home','var(--energy-home-color,#e49728)')}</div>
    ${sources.some(s=>s.type==='battery')?`<div class="battery">${this.node('Battery',`<span>↓ ${fmt(charge,unit)}</span><span>↑ ${fmt(discharge,unit)}</span>`,'battery','var(--energy-battery-out-color,#dc719b)')}</div>`:''}
    <p class="muted">Grid: → import · ← export. Battery: ↓ charge · ↑ discharge. Loads ${sources.some(s=>s.type==='home')?'measured directly':'calculated from the electricity balance'}.</p>
    ${finite(home)&&home<0?'<p class="error">Negative load balance: check meter coverage, direction and reporting times.</p>':''}
    ${!this.generators.length?'<p>No generators configured. Add an electricity meter and a dedicated gas meter for each generator.</p>':''}
    ${this.generators.map(g=>{const output=this.production(g),gas=this.gas(g),factor=g.gas_unit==='m³'?g.factor:1,input=finite(gas)?gas*factor:null,eff=now?efficiency(output,input):periodEfficiency(this.stats?.[g.energy],this.stats?.[g.gas],factor);return `<section class="fuel"><h3>${esc(g.name)}</h3><div class="metrics"><div><div class="muted">${now?'Natural gas flow':'Natural gas consumed'}</div><div class="value">${fmt(gas,g.gas_unit==='m³'?(now?'m³/h':'m³'):unit)}</div><div class="muted">${fmt(input,unit)} fuel input</div></div><div><div class="muted">${now?'Electrical output':'Electricity produced'}</div><div class="value">${fmt(output,unit)}</div></div><div><div class="muted">Electrical efficiency · ${esc(g.basis)}</div><div class="value">${fmt(eff,'%')}</div>${finite(eff)&&eff>100?'<div class="error">Check meters and conversion factor</div>':''}</div></div><p class="muted">${g.gas_unit==='m³'?`${esc(g.factor)} kWh fuel/m³ · `:''}${esc(g.basis)} heating-value basis. ${!finite(eff)?'Efficiency requires matching electricity and fuel measurements with positive fuel input.':''}</p></section>`;}).join('')}
    ${shared?'<p class="muted">Existing location gas meters are reused for detail only; generator fuel is not added again to location gas totals.</p>':''}
    </ha-card>`;
    for(const mode of ['period','now'])this.shadowRoot.querySelector(`#${mode}`).onclick=()=>{this.mode=mode;if(mode==='period')this.refresh();else {this.revision++;this.loading=false;this.renderDashboard();}};
    this.shadowRoot.querySelector('#configure').onclick=()=>{if(this.onconfigure){this.onconfigure();return;}this.openEditor();};
    this.shadowRoot.querySelector('#refresh').onclick=()=>{if(now)this.renderDashboard();else{this.start=this.shadowRoot.querySelector('#start').value;this.end=this.shadowRoot.querySelector('#end').value;this.refresh();}};
  }
  openEditor(){this.revision++;this.editing=true;this.draft=structuredClone(this.generators);this.renderEditor();}
  renderSettings(){
    if(this.editing)return;
    this.shadowRoot.innerHTML=`<style>${styles}${editorLayout}</style><ha-card><h2>Generators</h2><p class="muted">Track electricity production, natural gas consumption and electrical efficiency for this location.</p>${this.generators.map(g=>`<p>${esc(g.name)}</p>`).join('')}<button id="manage">${this.generators.length?'Configure generators':'Add generator'}</button></ha-card>`;
    this.shadowRoot.querySelector('#manage').onclick=()=>{this.openEditor();if(!this.draft.length){this.draft.push({id:crypto.randomUUID(),name:'Generator 1',gas_unit:'m³',factor:'',basis:'LHV'});this.renderEditor();}};
  }
  renderEditor(){
    const select=(key,value,units,required)=>`<select data-key="${key}" ${required?'required':''}><option value="">${required?'Select meter':'Not configured'}</option>${Object.values(this.hass.states).filter(s=>s.entity_id.startsWith('sensor.')&&units.includes(s.attributes.unit_of_measurement)).map(s=>`<option value="${esc(s.entity_id)}" ${s.entity_id===value?'selected':''}>${esc(s.attributes.friendly_name||s.entity_id)} (${esc(s.entity_id)})</option>`).join('')}</select>`;
    this.shadowRoot.innerHTML=`<style>${styles}${editorLayout}</style><ha-card><h2>Configure generators</h2><p class="muted">Choose dedicated meters. A shared meter for two generators requires one combined generator entry. Existing location gas meters may be reused. Conversion must match your supplier’s gas measurement conditions and heating-value basis.</p><form>${this.draft.map((g,i)=>`<section class="fuel" data-index="${i}"><h3>Generator ${i+1}</h3><div class="fields"><label>Name<input data-key="name" maxlength="100" required value="${esc(g.name)}"></label><label>Electricity produced (cumulative)${select('energy',g.energy,['Wh','kWh','MWh'],true)}</label><label>Electrical power (optional)${select('power',g.power,['W','kW','MW'])}</label><label>Gas consumed (cumulative)${select('gas',g.gas,['m³','ft³','L','Wh','kWh','MWh'],true)}</label><label>Gas measurement<select data-key="gas_unit"><option value="m³" ${g.gas_unit==='m³'?'selected':''}>Volume (converted to m³)</option><option value="kWh" ${g.gas_unit==='kWh'?'selected':''}>Fuel energy (converted to kWh)</option></select></label><label>Gas flow / fuel power (optional)${select('gas_power',g.gas_power,['m³/h','L/h','L/min','ft³/min','W','kW','MW'])}</label><label>kWh fuel per m³ (volume meters only)<input data-key="factor" type="number" min="0.000001" step="any" required value="${esc(g.factor)}"></label><label>Heating-value basis<select data-key="basis"><option ${g.basis==='LHV'?'selected':''}>LHV</option><option ${g.basis==='HHV'?'selected':''}>HHV</option></select></label></div><button type="button" data-remove="${i}">Remove generator</button></section>`).join('')}<p role="alert" id="error" class="error"></p><div class="actions"><button type="button" id="add">Add generator</button><button type="button" id="cancel">Cancel</button><button type="submit">Save generators</button></div></form></ha-card>`;
    const collect=()=>{this.shadowRoot.querySelectorAll('[data-index]').forEach(section=>section.querySelectorAll('[data-key]').forEach(el=>this.draft[Number(section.dataset.index)][el.dataset.key]=el.dataset.key==='factor'?Number(el.value):el.value));};
    this.shadowRoot.querySelector('#add').onclick=()=>{collect();this.draft.push({id:crypto.randomUUID(),name:`Generator ${this.draft.length+1}`,gas_unit:'m³',factor:'',basis:'LHV'});this.renderEditor();};
    this.shadowRoot.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{collect();this.draft.splice(Number(button.dataset.remove),1);this.renderEditor();});
    this.shadowRoot.querySelector('#cancel').onclick=()=>{this.editing=false;this.refresh();};
    this.shadowRoot.querySelector('form').onsubmit=async event=>{event.preventDefault();collect();const button=event.target.querySelector('[type=submit]');button.disabled=true;try{this.generators=await this.call('set',{generators:this.draft});this.editing=false;await this.refresh();}catch(error){this.shadowRoot.querySelector('#error').textContent=error.message||String(error);button.disabled=false;}};
  }
}
customElements.define('mle-generators',MleGenerators);
