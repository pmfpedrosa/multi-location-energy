/** Connect generator branches to the actual native distribution nodes. */
export class GeneratorFlowController {
  constructor(host) { this.host=host; host.addController(this); }
  hostConnected() {
    this.observer=new ResizeObserver(()=>this.schedule());
    this.host.updateComplete.then(()=>{if(this.host.isConnected){this.observer?.observe(this.host);this.schedule();}});
  }
  hostUpdated() { this.schedule(); }
  hostDisconnected() { this.observer?.disconnect();cancelAnimationFrame(this.frame); }
  schedule() { cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.draw()); }
  draw() {
    const root=this.host.shadowRoot,container=root?.querySelector('.card-content');
    if(!container)return;
    let overlay=container.querySelector('.generator-flow-overlay');
    if(!root.querySelector('.generator-source')){overlay?.remove();return;}
    if(!overlay){overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.classList.add('generator-flow-overlay');container.prepend(overlay);}
    const box=container.getBoundingClientRect();
    if(!box.width||!box.height)return;
    // Keep HA's own grid/solar/battery flow layer aligned with its native rows.
    // The generator summary is an extra flex row beneath that native diagram.
    const lines=container.querySelector('.lines');
    const summary=container.querySelector('.generator-destinations');
    if(lines)lines.style.bottom=`${(lines.classList.contains('high')?100:0)+(summary?.getBoundingClientRect().height||0)}px`;
    overlay.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
    overlay.replaceChildren();
    const targets=[['.circle-container.home .circle','used_generator'],['.circle-container.grid .circle','generator_to_grid'],['.circle-container.battery .circle','generator_to_battery']];
    for(const source of root.querySelectorAll('.generator-source .circle')){
      const origin=source.getBoundingClientRect();
      const x=origin.left+origin.width/2-box.left,y=origin.bottom-box.top;
      for(const [selector,flow]of targets){
      const target=root.querySelector(selector);if(!target||!(this.host._generatorFlows?.[flow]>0))continue;
      const dest=target.getBoundingClientRect();
      const tx=dest.left+dest.width/2-box.left,ty=dest.top-box.top;
      const path=document.createElementNS(overlay.namespaceURI,'path');
      const middle=y+(ty-y)*0.6;
      path.setAttribute('d',`M ${x} ${y} C ${x} ${middle}, ${tx} ${middle}, ${tx} ${ty}`);
      path.style.cssText='stroke:var(--energy-generator-color, #009688);stroke-width:1.5;fill:none';overlay.append(path);
      }
    }
  }
}
