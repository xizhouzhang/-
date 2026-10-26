(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else Object.assign(root,factory());})(globalThis,function(){
'use strict';
class OceanAudioFeatures{
 constructor(){this.reset();this.gain=1.25;}
 reset(){this.peak=.045;this.fluxMean=.008;this.previous=null;this.cooldown=0;this.pulse=0;this.smoothEnergy=0;this.silentFor=0;}
 process(wave,bins,sampleRate,dt){
  dt=Math.max(.001,Math.min(dt,.15));let squares=0;for(const x of wave)squares+=x*x;const rms=Math.sqrt(squares/Math.max(1,wave.length));
  this.peak=Math.max(.035,rms,this.peak*Math.exp(-dt*.65));
  const band=(lo,hi)=>{const start=Math.max(1,Math.floor(lo/(sampleRate/(bins.length*2)))),end=Math.min(bins.length,Math.ceil(hi/(sampleRate/(bins.length*2))));let total=0;for(let i=start;i<end;i++)total+=bins[i]/255;return total/Math.max(1,end-start);};
  const audible=rms>.0013,bass=audible?band(45,240):0,treble=audible?band(2000,8000):0;
  const binHz=sampleRate/(bins.length*2),limit=Math.min(bins.length,Math.ceil(2000/binHz));let flux=0,weight=0;
  for(let i=1;i<limit;i++){const w=i*binHz<280?2:1;weight+=w;if(this.previous)flux+=Math.max(0,bins[i]-this.previous[i])/255*w;}
  flux/=Math.max(1,weight);if(!this.previous||this.previous.length!==bins.length)this.previous=new Uint8Array(bins.length);this.previous.set(bins);
  this.cooldown=Math.max(0,this.cooldown-dt);
  const onset=audible&&this.cooldown===0&&flux>Math.max(.022,this.fluxMean*1.65)&&bass>.14;
  this.fluxMean+=(flux-this.fluxMean)*(1-Math.exp(-dt*1.8));
  this.pulse*=Math.exp(-dt*7.5);if(onset){this.pulse=1;this.cooldown=.19;}
  this.silentFor=audible?0:this.silentFor+dt;
  const loudness=audible?Math.min(1.1,rms/Math.max(.035,this.peak*.92)):0;
  const target=audible?Math.min(1.3,(loudness*.55+bass*.28+this.pulse*.32)*this.gain):0;
  this.smoothEnergy+=(target-this.smoothEnergy)*(1-Math.exp(-dt*(target>this.smoothEnergy?16:6)));
  return {energy:this.smoothEnergy,bass,treble,loudness,beat:this.pulse,onset,rms,silentFor:this.silentFor,level:Math.min(1,rms/Math.max(.035,this.peak))};
 }
}
class OceanAudioInput{
 constructor(options={}){this.env=options.env||globalThis;this.onState=options.onState||(()=>{});this.features=new OceanAudioFeatures();this.mode='demo';this.connecting=false;this.request=0;this.context=null;this.source=null;this.analyser=null;this.stream=null;this.element=null;this.url=null;this.label='参考节奏';this.error='';this.endedHandler=null;}
 get active(){return this.mode==='system'||this.mode==='file';}
 get supportsSystem(){return !!this.env.navigator?.mediaDevices?.getDisplayMedia;}
 notify(extra={}){this.onState({mode:this.mode,connecting:this.connecting,label:this.label,error:this.error,paused:!!this.element?.paused,...extra});}
 ensureContext(){if(!this.context){const Context=this.env.AudioContext||this.env.webkitAudioContext;if(!Context)throw Error('当前浏览器不支持音频分析，请用 Chrome 或 Edge 打开');this.context=new Context();}return this.context;}
 makeAnalyser(){const a=this.context.createAnalyser();a.fftSize=2048;a.smoothingTimeConstant=.38;a.minDecibels=-85;a.maxDecibels=-12;return a;}
 release(){
  if(this.source)this.source.disconnect();if(this.analyser)this.analyser.disconnect();
  if(this.stream){for(const track of this.stream.getTracks()){if(this.endedHandler)track.removeEventListener('ended',this.endedHandler);track.stop();}}
  if(this.element){this.element.pause();this.element.src='';}if(this.url)this.env.URL.revokeObjectURL(this.url);
  this.source=null;this.analyser=null;this.stream=null;this.element=null;this.url=null;this.endedHandler=null;this.features.reset();
 }
 stop(){this.request++;this.release();this.mode='demo';this.connecting=false;this.label='参考节奏';this.error='';this.notify();}
 async connectSystem(){
  if(this.connecting)return false;
  if(!this.supportsSystem){this.error='当前浏览器无法读取系统声音。请复制网页链接，在桌面版 Chrome 或 Edge 中打开。';this.notify();return false;}
  const request=++this.request;this.connecting=true;this.error='';this.notify();let stream=null;
  try{
   const ctx=this.ensureContext();const resume=ctx.resume().then(()=>null,error=>error);
   // Start the picker in the same user gesture, before awaiting any promises.
   const capture=this.env.navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'monitor',frameRate:1},audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,suppressLocalAudioPlayback:false},systemAudio:'include',windowAudio:'system',selfBrowserSurface:'exclude',surfaceSwitching:'exclude',monitorTypeSurfaces:'include'});
   stream=await capture;const resumeError=await resume;if(resumeError)throw resumeError;
   if(request!==this.request){stream.getTracks().forEach(t=>t.stop());return false;}
   const tracks=stream.getAudioTracks().filter(t=>t.readyState!=='ended');
   if(!tracks.length){const error=Error('没有收到声音轨道。请重新连接，在弹窗选择“整个屏幕”并勾选“共享系统音频”。');error.code='no-audio';throw error;}
   const audioStream=new this.env.MediaStream(tracks),source=ctx.createMediaStreamSource(audioStream),analyser=this.makeAnalyser();source.connect(analyser);
   // Keep only system audio; never render or retain a screen-video stream.
   stream.getVideoTracks().forEach(t=>t.stop());
   this.release();this.source=source;this.analyser=analyser;this.stream=stream;this.mode='system';this.label='电脑正在播放的音乐';this.error='';this.setupBuffers();
   this.endedHandler=()=>{if(this.mode!=='system'||this.stream!==stream)return;this.stop();this.notify({notice:'声音共享已结束，已恢复参考节奏。'});};
   tracks.forEach(t=>t.addEventListener('ended',this.endedHandler));
   if(tracks.every(t=>t.readyState==='ended'))throw Error('浏览器结束了音频共享，请用桌面版 Chrome 或 Edge 重新连接。');
   return true;
  }catch(error){
   if(stream&&stream!==this.stream)stream.getTracks().forEach(t=>t.stop());
   if(stream===this.stream){this.release();this.mode='demo';this.label='参考节奏';}
   if(request===this.request){this.error=error.code==='no-audio'?error.message:error.name==='NotAllowedError'?'未完成声音授权。可再次点击连接，选择“整个屏幕”并打开系统音频。':error.name==='NotReadableError'?'浏览器暂时无法读取电脑声音。请在 Chrome 或 Edge 中重试，并确认音乐软件正在播放。':error.name==='InvalidStateError'?'请在当前可见页面中点击“跟随电脑音乐”，再选择声音来源。':error.message||'连接未成功，请重试。';}
   return false;
  }finally{if(request===this.request){this.connecting=false;this.notify();}}
 }
 async connectFile(file){
  const request=++this.request;let element=null,url=null,source=null,analyser=null;
  try{
   const ctx=this.ensureContext();await ctx.resume();url=this.env.URL.createObjectURL(file);element=new this.env.Audio(url);element.loop=true;
   source=ctx.createMediaElementSource(element);analyser=this.makeAnalyser();source.connect(analyser);source.connect(ctx.destination);await element.play();
   if(request!==this.request){element.pause();source.disconnect();analyser.disconnect();this.env.URL.revokeObjectURL(url);return false;}
   this.release();this.element=element;this.url=url;this.source=source;this.analyser=analyser;this.mode='file';this.label=file.name;this.error='';this.connecting=false;this.setupBuffers();
   element.addEventListener('error',()=>{if(this.element===element){this.stop();this.error='无法播放此音频，请尝试 MP3 或 WAV。';this.notify();}});this.notify();return true;
  }catch(error){if(element){element.pause();element.src='';}if(source)source.disconnect();if(analyser)analyser.disconnect();if(url)this.env.URL.revokeObjectURL(url);this.connecting=false;this.error='音频未能播放，请尝试 MP3 或 WAV。';this.notify();return false;}
 }
 setupBuffers(){this.wave=new Float32Array(this.analyser.fftSize);this.bins=new Uint8Array(this.analyser.frequencyBinCount);this.features.reset();}
 async toggleFile(){if(!this.element)return;try{if(this.element.paused){await this.context.resume();await this.element.play();}else this.element.pause();this.notify();}catch{this.error='音乐播放失败，请重新选择文件。';this.notify();}}
 read(dt){
  if(!this.active||!this.analyser)return null;
  const muted=this.mode==='file'?this.element.paused:this.stream.getAudioTracks().every(t=>t.muted||t.readyState==='ended');
  if(muted||this.context.state==='suspended'){this.wave.fill(0);this.bins.fill(0);}else{this.analyser.getFloatTimeDomainData(this.wave);this.analyser.getByteFrequencyData(this.bins);}
  return this.features.process(this.wave,this.bins,this.context.sampleRate,dt);
 }
}
return {OceanAudioFeatures,OceanAudioInput};
});
