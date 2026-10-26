const assert=require('node:assert/strict');
const Ocean=require('../web/filament-ocean.js');
const o=new Ocean(83);
let peak=0,maxY=0;
for(let i=0;i<5400;i++){
 o.update(1/60,{amplitude:1.2,energy:.5+.45*Math.sin(i/133)});
 peak=Math.max(peak,o.particles.length);
 assert.equal(o.free.length+o.particles.length,Ocean.MAX);
 if(i%90===0){const slots=new Set(o.particles.map(p=>p.slot));assert.equal(slots.size,o.particles.length);for(const p of o.particles){assert([p.x,p.y,p.z,p.vx,p.vy,p.vz,p.alpha].every(Number.isFinite));assert(p.y>=0);assert(p.samples<=Ocean.HISTORY);maxY=Math.max(maxY,p.y);}}
}
assert(o.stats.packets>50);assert(o.stats.impacts>100);assert(o.stats.rebounds>100);assert(peak<=Ocean.MAX);assert(maxY>4);
const still=o.clock;o.update(0);assert.equal(o.clock,still);
o.pulse();assert(o.manual>0);
for(let i=0;i<1000;i++){o.emitters.forEach(e=>{e.end=-1;e.next=Infinity;});o.update(1/90,{energy:.03});}
assert.equal(o.particles.length,0);assert.equal(o.free.length,Ocean.MAX);
console.log(JSON.stringify({result:'passed',peakFilaments:peak,maxHeight:+maxY.toFixed(2),packets:o.stats.packets,impacts:o.stats.impacts,rebounds:o.stats.rebounds}));
