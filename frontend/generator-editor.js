/** Generator setup preserves every other native energy source and device. */
export async function mountGeneratorEditor(container,hass,onSaved) {
  const prefs=await hass.callWS({type:'energy/get_prefs'});
  const initial=prefs.energy_sources.filter(source=>source.type==='generator');
  const generators=structuredClone(initial);
  const shell=document.createElement('section');shell.className='message';
  shell.style.cssText='max-width:900px;width:100%;box-sizing:border-box';
  const title=document.createElement('h2');title.textContent='Generators';
  const intro=document.createElement('p');intro.textContent='Add electricity production meters (kWh) and optional live power sensors (W or kW). Source-to-load, export and battery allocations are estimates when separate destination meters are unavailable.';
  const list=document.createElement('div'),status=document.createElement('p');status.setAttribute('role','alert');
  const options=document.createElement('datalist');options.id='generator-meter-options';
  let metadata=[];
  try{metadata=await hass.callWS({type:'recorder/list_statistic_ids',statistic_type:'sum'});}catch{}
  for(const item of metadata){const option=document.createElement('option');option.value=item.statistic_id;option.label=item.name||item.statistic_id;options.append(option);}
  const powerOptions=document.createElement('datalist');powerOptions.id='generator-power-options';
  for(const [id,state] of Object.entries(hass.states||{}))if(state.attributes?.device_class==='power'){
    const option=document.createElement('option');option.value=id;option.label=state.attributes.friendly_name||id;powerOptions.append(option);
  }
  const render=()=>{
    list.replaceChildren();
    for(const [index,generator]of generators.entries()){
      const box=document.createElement('fieldset');box.style.cssText='min-width:0;margin:16px 0;padding:16px;border:1px solid var(--divider-color);border-radius:12px';
      const legend=document.createElement('legend');legend.textContent=`Generator ${index+1}`;box.append(legend);
      for(const [key,labelText,required,listId]of [['name','Name',true],['stat_energy_from','Electricity production meter (kWh)',true,options.id],['stat_rate','Live power sensor (optional)',false,powerOptions.id]]){
        const label=document.createElement('label');label.style.cssText='display:block;margin:12px 0';label.textContent=labelText;
        const input=document.createElement('input');input.value=generator[key]||'';input.required=required;input.style.cssText='display:block;width:100%;box-sizing:border-box;margin-top:6px';input.setAttribute('aria-label',`${legend.textContent}: ${labelText}`);
        if(listId)input.setAttribute('list',listId);if(key==='name')input.maxLength=100;
        input.oninput=()=>{if(input.value.trim())generator[key]=input.value.trim();else delete generator[key];};label.append(input);box.append(label);
      }
      const remove=document.createElement('button');remove.type='button';remove.textContent='Remove generator';remove.onclick=()=>{generators.splice(index,1);render();};box.append(remove);list.append(box);
    }
  };
  const form=document.createElement('form'),add=document.createElement('button'),save=document.createElement('button');
  add.type='button';add.textContent='Add generator';add.onclick=()=>{
    // randomUUID is restricted to secure contexts; HA also supports LAN HTTP.
    const id=crypto.randomUUID?.() || 'generator_'+Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
    generators.push({type:'generator',id,name:`Generator ${generators.length+1}`,stat_energy_from:''});render();
  };
  save.type='submit';save.textContent='Save generators';save.style.marginLeft='12px';
  form.onsubmit=async event=>{
    event.preventDefault();save.disabled=true;status.textContent='';
    try{
      const latest=await hass.callWS({type:'energy/get_prefs'});
      if(JSON.stringify(latest.energy_sources.filter(s=>s.type==='generator'))!==JSON.stringify(initial))throw Error('Generator settings changed in another window. Reopen this page before saving.');
      const sources=[...latest.energy_sources.filter(s=>s.type!=='generator'),...generators];
      await hass.callWS({type:'energy/save_prefs',energy_sources:sources});await onSaved();
    }catch(error){status.textContent=error.message||String(error);save.disabled=false;}
  };
  form.append(list,add,save,status);shell.append(title,intro,options,powerOptions,form);container.replaceChildren(shell);render();
}
