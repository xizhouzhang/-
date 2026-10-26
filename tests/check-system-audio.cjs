const assert=require('node:assert/strict');
const {OceanAudioFeatures,OceanAudioInput}=require('../web/audio-input.js');
class Track{
 constructor(kind){this.kind=kind;this.readyState='live';this.muted=false;this.listeners=[];this.stops=0;}
 stop(){this.readyState='ended';this.stops++;}
 addEventListener(name,fn){this.listeners.push(fn);}
 removeEventListener(name,fn){this.listeners=this.listeners.filter(x=>x!==fn);}
 end(){this.readyState='ended';for(const fn of [...this.listeners])fn();}
}
class Stream{constructor(tracks){this.tracks=tracks;}getTracks(){return this.tracks;}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}}
let contexts=[];
class Context{
 constructor(){this.sampleRate=48000;this.state='running';this.destination={type:'speaker'};this.nodes=[];contexts.push(this);}
 resume(){return Promise.resolve();}
 createAnalyser(){const node={type:'analyser',fftSize:2048,frequencyBinCount:1024,disconnect(){},getFloatTimeDomainData(a){a.fill(0);},getByteFrequencyData(a){a.fill(0);}};return node;}
 createMediaStreamSource(stream){const node={type:'stream',connections:[],connect(x){this.connections.push(x);},disconnect(){this.disconnected=true;}};this.nodes.push(node);return node;}
}
const envFor=fn=>({AudioContext:Context,MediaStream:Stream,navigator:{mediaDevices:{getDisplayMedia:fn}}});
(async()=>{
 const audio=new Track('audio'),video=new Track('video');let constraints;
 const input=new OceanAudioInput({env:envFor(async options=>{constraints=options;return new Stream([video,audio]);})});
 assert(await input.connectSystem());assert.equal(input.mode,'system');assert.equal(video.readyState,'ended');assert.equal(audio.readyState,'live');
 assert.equal(constraints.systemAudio,'include');assert.equal(constraints.audio.echoCancellation,false);
 assert.equal(contexts[0].nodes[0].connections.length,1);assert.equal(contexts[0].nodes[0].connections[0].type,'analyser','system sound must not replay into the speakers');
 assert.equal(input.read(.05).energy,0,'silent input must stay silent');
 audio.end();assert.equal(input.mode,'demo');assert.equal(input.active,false);
 const noSound=new Track('video'),empty=new OceanAudioInput({env:envFor(async()=>new Stream([noSound]))});
 assert.equal(await empty.connectSystem(),false);assert.equal(empty.mode,'demo');assert(empty.error.includes('共享系统音频'));assert.equal(noSound.readyState,'ended');
 const unsupported=new OceanAudioInput({env:{}});assert.equal(await unsupported.connectSystem(),false);assert(unsupported.error.includes('Chrome'));
 const canceled=new OceanAudioInput({env:envFor(async()=>{const e=Error('denied');e.name='NotAllowedError';throw e;})});assert.equal(await canceled.connectSystem(),false);assert.equal(canceled.active,false);
 let resolve;const pending=new OceanAudioInput({env:envFor(()=>new Promise(r=>resolve=r))});const promise=pending.connectSystem();pending.stop();const late=new Track('audio');resolve(new Stream([late,new Track('video')]));await promise;assert.equal(late.readyState,'ended');assert.equal(pending.mode,'demo');
 const feature=new OceanAudioFeatures(),wave=new Float32Array(2048),bins=new Uint8Array(1024);for(let i=0;i<30;i++)assert.equal(feature.process(wave,bins,48000,1/60).energy,0);
 for(let i=0;i<wave.length;i++)wave[i]=Math.sin(i*2*Math.PI*90/48000)*.1;for(let i=2;i<13;i++)bins[i]=220;
 const first=feature.process(wave,bins,48000,1/60);assert(first.onset);let maxEnergy=first.energy;
 for(let i=0;i<20;i++)maxEnergy=Math.max(maxEnergy,feature.process(wave,bins,48000,1/60).energy);
 assert(maxEnergy>.65);wave.fill(0);bins.fill(0);let value;for(let i=0;i<120;i++)value=feature.process(wave,bins,48000,1/60);assert(value.energy<.001);assert(value.silentFor>1.9);
 console.log(JSON.stringify({result:'passed',systemTrackOnly:true,noPlaybackFeedback:true,videoStopped:true,sourceCleanup:true,noAudioRejected:true,cancelHandled:true,beatDetected:first.onset,peakResponse:+maxEnergy.toFixed(3),silentEnergy:+value.energy.toFixed(6)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
