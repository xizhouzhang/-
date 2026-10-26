(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.OceanMusicMotion=factory();})(globalThis,function(){
'use strict';
const clamp=(v,max=1)=>Math.max(0,Math.min(max,Number.isFinite(v)?v:0));
class OceanMusicMotion{
 constructor(){this.reset();}
 reset(){this.state={speed:1,trail:1,density:1};}
 update(features,base,dt){
  const level=clamp(features.energy/1.05),high=clamp(features.treble),beat=clamp(features.beat);
  const target={speed:.28+level*.95+beat*.45,trail:.16+level*.75+high*.24+beat*.25,density:.12+level*1.2+beat*.65};
  for(const key of Object.keys(target)){
   const tau=target[key]>this.state[key]?(key==='density'?.13:.09):(key==='density'?.48:.34);
   this.state[key]+=(target[key]-this.state[key])*(1-Math.exp(-Math.min(.1,Math.max(0,dt))/tau));
  }
  // Keep launch energy and vertical scale independent of the incoming music.
  return {...base,heightScale:1,waveEnergy:.65,speed:base.speed*this.state.speed,trail:clamp(base.trail*this.state.trail),density:clamp(base.density*this.state.density,2.5),fixedBrightness:true};
 }
}
return OceanMusicMotion;
});
