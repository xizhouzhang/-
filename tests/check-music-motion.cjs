const assert=require('node:assert/strict');
const path='../web/';
const Motion=require(path+'music-motion.js'),Ocean=require(path+'filament-ocean.js');
global.FilamentOcean=Ocean;require(path+'filament-renderer.js');
const base={amplitude:1,speed:1,trail:.92,density:1,glow:1.2,ripples:.8,reflectivity:1.25,reflection:true};
const quiet={energy:.04,bass:.03,treble:.02,beat:0},strong={energy:1,bass:.85,treble:.7,beat:0};
function settle(f,hz=60){const m=new Motion();let out;for(let i=0;i<hz*3;i++)out=m.update(f,base,1/hz);return out;}
const low=settle(quiet),high=settle(strong),m=new Motion();
for(const k of ['speed','trail','density'])assert(high[k]>low[k]*1.8,k+' must respond materially');
for(const x of [low,high]){assert.equal(x.heightScale,1);assert.equal(x.amplitude,base.amplitude);assert.equal(x.waveEnergy,.65);assert.equal(x.glow,base.glow);assert.equal(x.reflectivity,base.reflectivity);assert(x.fixedBrightness);}
for(const k of ['speed','trail','density'])assert(Math.abs(settle(strong,30)[k]-settle(strong,120)[k])<.005,k+' frame-rate independent');
let before;for(let i=0;i<180;i++)before=m.update(quiet,base,1/60);const hit=m.update({...strong,beat:1},base,1/60);assert.equal(hit.heightScale,1);assert.equal(hit.amplitude,base.amplitude);assert.equal(hit.waveEnergy,before.waveEnergy);assert(hit.speed>before.speed);
const lowOcean=new Ocean(42),highOcean=new Ocean(42);
for(let i=0;i<180;i++){lowOcean.update(1/90,{energy:.7,density:.2});highOcean.update(1/90,{energy:.7,density:1.5});}
assert(highOcean.stats.born>lowOcean.stats.born*3,'density must create more filaments');
const gl={ARRAY_BUFFER:1,bindBuffer(){},bufferSubData(){}};
const renderer=Object.create(global.FilamentRenderer.prototype);Object.assign(renderer,{gl,segments:new Float32Array(Ocean.MAX*53*10),heads:new Float32Array(Ocean.MAX*10)});
renderer.upload(highOcean,.3,.3);const sparseHeads=renderer.headCount,sparseSegments=renderer.segmentCount,alphas=new Map();for(let i=0;i<sparseHeads;i++)alphas.set(renderer.heads[i*10],renderer.heads[i*10+6]);
renderer.upload(highOcean,.95,1);assert(renderer.headCount>sparseHeads*2);assert(renderer.segmentCount>sparseSegments*2);for(let i=0;i<renderer.headCount;i++){const x=renderer.heads[i*10];if(alphas.has(x))assert.equal(renderer.heads[i*10+6],alphas.get(x),'visibility must not dim selected filaments');}
const gains=[],heights=[];Object.assign(renderer,{gl:new Proxy({uniform4fv(){},uniformMatrix4fv(){}},{get:(o,k)=>o[k]||(()=>{})}),targets:{mirror:{width:1,height:1},scene:{},light:{},blurA:{width:1,height:1},blurB:{width:1,height:1}},wu:{},bu:{},cu:{},drawFibers(...args){gains.push(args[6]);heights.push(args[7]);},bind(){},disable(){},screenPass(){}});
renderer.render([],[],low,lowOcean,[0,0],[1,1,1],.03,1);renderer.render([],[],high,highOcean,[0,0],[1,1,1],1.2,1);
assert.equal(gains[0],gains[2],'reflection gain must remain constant across music dynamics');assert.equal(gains[1],gains[3],'filament light gain must remain constant across music dynamics');assert(heights.every(x=>x===1));
console.log(JSON.stringify({result:'passed',quiet:low,strong:high,spawned:{quiet:lowOcean.stats.born,strong:highOcean.stats.born},visible:{sparse:sparseHeads,dense:renderer.headCount},lightGain:gains[0]}));
