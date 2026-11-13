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
    const targets=[['.circle-container.home .circle','home'],['.circle-container.grid .circle','grid'],['.circle-container.battery .circle','battery']];
    for(const source of root.querySelectorAll('.generator-source .circle')){
      const origin=source.getBoundingClientRect();
      const x=origin.left+origin.width/2-box.left,y=origin.bottom-box.top;
      for(const [selector,destination]of targets){
      const target=root.querySelector(selector);if(!target)continue;
      const dest=target.getBoundingClientRect();
      const isGrid=destination==='grid',isBattery=destination==='battery';
      const sx=x+(isGrid?-3:isBattery?0:3);
      const tx=(isBattery?dest.left+dest.width/2:isGrid?dest.right:dest.left)-box.left;
      const ty=(isBattery?dest.top:dest.top+dest.height/2)-box.top;
      const path=document.createElementNS(overlay.namespaceURI,'path');
      path.dataset.destination=destination;
      // Match the native solar geometry: short vertical stem, curved fork,
      // then horizontal entry at the grid/load circle's connection point.
      const stem=Math.min(y+15,ty),control=tx+(isGrid?20:-20);
      path.setAttribute('d',isBattery?`M ${sx} ${y} C ${sx} ${stem}, ${tx} ${stem}, ${tx} ${ty}`:`M ${sx} ${y} V ${stem} C ${sx} ${ty}, ${control} ${ty}, ${tx} ${ty}`);
      path.style.cssText='stroke:var(--energy-generator-color, #009688);stroke-width:1.5;fill:none';overlay.append(path);
      }
    }
  }
}
