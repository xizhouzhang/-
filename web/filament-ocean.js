(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FilamentOcean=factory();})(globalThis,function(){
'use strict';
const HISTORY=54,MAX=3800,STEP=1/90;
class FilamentOcean{
 constructor(seed=Date.now()){this.seed=seed>>>0||7;this.reset();}
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 reset(){
  this.clock=0;this.accumulator=0;this.tick=0;this.particles=[];this.free=Array.from({length:MAX},(_,i)=>MAX-1-i);this.history=new Float32Array(MAX*HISTORY*3);this.cursor=0;this.rings=[];
  this.emitters=[[-13,-7,.65],[-4,-4,1.25],[6,-7,2.2],[15,-10,2.6]].map((a,i)=>({x:a[0],z:a[1],base:a[2],angle:a[2],next:i*.29,end:0,budget:0,phase:this.random()*6.28,width:4,force:1}));
  this.stats={born:0,impacts:0,rebounds:0,packets:0};this.nextRing=0;this.manual=0;this.energy=.5;
 }
 begin(e,power=1){e.angle=e.base+(this.random()-.5)*1.05;e.dx=Math.cos(e.angle);e.dz=Math.sin(e.angle);e.width=3.2+this.random()*4;e.force=power*(.82+this.random()*.35);e.start=this.clock;e.end=this.clock+.55+this.random()*.95;e.next=e.end+.35+this.random()*1.25;e.phase=this.random()*6.28;e.emitX=e.x+Math.sin(this.clock*.43+e.phase)*2.4;e.emitZ=e.z+Math.cos(this.clock*.34+e.phase)*1.3;this.stats.packets++;}
 pulse(){const e=this.emitters[1+Math.floor(this.random()*2)];this.begin(e,1.35);this.manual=1.4;}
 kick(strength=.5){const e=this.emitters[Math.floor(this.random()*this.emitters.length)];this.begin(e,.85+Math.min(1,strength)*.4);e.end=this.clock+.22+Math.min(1,strength)*.35;e.next=e.end+.25+this.random()*.4;}
 add(e,amplitude){
  if(!this.free.length)return;
  const r=this.random(),across=(this.random()-.5)*e.width,along=(this.random()-.5)*.65;
  const x=e.emitX-e.dz*across+e.dx*along,z=e.emitZ+e.dx*across+e.dz*along;
  const power=Math.sqrt(amplitude)*e.force;
  const pulse=(this.clock-e.start)*2.4;
  const forward=(3.8+Math.sin(across*.5+e.phase)*.55+Math.sin(pulse)*.6)*power;
  const vy=(8.6+Math.sin(across*.65+e.phase)*1.05+Math.sin(pulse+e.phase)*1.6)*(.45+this.energy*.8)*power;
  const p={slot:this.free.pop(),x,y:.025+this.random()*.045,z,vx:e.dx*forward,vz:e.dz*forward,vy,dx:e.dx,dz:e.dz,ox:e.emitX,oz:e.emitZ,phase:e.phase,roll:.76+.08*Math.sin(across*.55),seed:r,width:.45+Math.pow(r,3)*1.25,age:0,life:4.6+this.random()*.8,bounce:0,rest:-1,alpha:1,samples:1};
  const offset=p.slot*HISTORY*3;for(let i=0;i<HISTORY;i++){this.history[offset+i*3]=p.x;this.history[offset+i*3+1]=p.y;this.history[offset+i*3+2]=p.z;}
  this.particles.push(p);this.stats.born++;
 }
 update(delta,options={}){if(!Number.isFinite(delta)||delta<=0)return;this.accumulator+=Math.min(delta,.1);while(this.accumulator>=STEP){this.step(STEP,options);this.accumulator-=STEP;}}
 step(dt,{amplitude=1,energy=.5,density=1}={}){
  this.clock+=dt;this.tick++;this.energy=Math.max(.025,Math.min(1.4,energy));this.manual=Math.max(0,this.manual-dt);
  for(const e of this.emitters){
   if(this.clock>=e.next){if(this.energy>.11||this.manual>0)this.begin(e);else e.next=this.clock+.3;}
   if(this.clock<e.end){
    const rate=(220+this.energy*460)*(this.manual>0?1.1:1)*Math.max(0,Math.min(2.5,density));
    e.budget+=rate*dt;
    while(e.budget>=1){e.budget--;this.add(e,amplitude);}
   }
  }
  const sample=this.tick%4===0;if(sample)this.cursor=(this.cursor+1)%HISTORY;
  const alive=[];
  for(const p of this.particles){
   p.age+=dt;
   if(p.rest>=0){p.rest+=dt;p.x+=p.vx*dt*.14;p.z+=p.vz*dt*.14;p.alpha=Math.max(0,1-p.rest/.85)*.48;}
   else{
    const s=(p.x-p.ox)*p.dx+(p.z-p.oz)*p.dz;
    const a=(p.y-2.7)*p.roll*.94+Math.sin(s*.7-p.y*.55+this.clock*.35+p.phase)*1.35;
    const cross=Math.sin(p.y*.62+s*.38+this.clock*.9+p.phase)*.9;
    p.vx+=(p.dx*a-p.dz*cross-p.vx*.13)*dt;
    p.vz+=(p.dz*a+p.dx*cross-p.vz*.13)*dt;
    p.vy+=(-5.8-(s-1.3)*p.roll*.44-p.vy*.065+Math.sin(s*.65+p.y*.4+this.clock*.5+p.phase)*.85)*dt;
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
    if(p.y<.028&&p.vy<0){
     p.y=.028;this.stats.impacts++;p.bounce++;
     if(p.bounce===1){p.vy=-p.vy*(.23+p.seed*.18);p.vx*=.6;p.vz*=.6;this.stats.rebounds++;if(this.clock>this.nextRing){this.rings.unshift({x:p.x,z:p.z,born:this.clock,strength:.2+p.seed*.25});this.rings.length=Math.min(3,this.rings.length);this.nextRing=this.clock+.17;}}
     else{p.rest=0;p.vy=0;}
    }
    p.alpha=Math.min(1,p.age*7)*Math.min(1,Math.max(0,(p.life-p.age)*1.2));
   }
   if(p.age>=p.life||p.alpha<=0||Math.abs(p.x)>55||Math.abs(p.z)>65||p.y>30){this.free.push(p.slot);continue;}
   if(sample){const k=(p.slot*HISTORY+this.cursor)*3;this.history[k]=p.x;this.history[k+1]=p.y;this.history[k+2]=p.z;p.samples=Math.min(HISTORY,p.samples+1);}
   alive.push(p);
  }
  this.particles=alive;this.rings=this.rings.filter(r=>this.clock-r.born<4);
 }
 get stage(){if(this.manual>0)return '涌起一阵浪';if(this.energy<.13)return '潮汐渐息';return this.energy>.55?'浪群卷起':'光丝回流';}
}
FilamentOcean.HISTORY=HISTORY;FilamentOcean.MAX=MAX;return FilamentOcean;
});
