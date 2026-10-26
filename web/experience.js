(() => {
'use strict';
const $=id=>document.getElementById(id),canvas=$('ocean');
const gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
if(!gl){$('failure').hidden=false;return;}
let renderer;try{renderer=new FilamentRenderer(gl);}catch(e){$('failure').hidden=false;$('failure').textContent='画面启动失败：'+e.message;return;}
const ocean=new FilamentOcean();
const params={amplitude:1,speed:1,trail:.92,density:1,glow:1.2,ripples:.8,reflectivity:1.25,reflection:true};
let color=[.42,.69,.91],mode='silver',paused=false,last=performance.now(),frames=0,lastFps=last;
let width=1,height=1,dpr=1,yaw=0,targetYaw=0,pitch=.08,targetPitch=.08,zoom=31,targetZoom=31,pointer=[80,80],screenPointer=null;
const audioInput=new OceanAudioInput({onState:audioState});
const musicMotion=new OceanMusicMotion();
let liveParams=params;
let lastMeter=0,silenceShown=false;
function rhythm(t){const values=REFERENCE_RHYTHM,n=values.length;const x=(t*10)%n,i=Math.floor(x),f=x-i;return values[i]*(1-f)+values[(i+1)%n]*f;}
for(let i=0;i<216;i++)ocean.update(1/90,{amplitude:1,energy:rhythm(ocean.clock)});
function resize(){width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);try{renderer.resize(canvas.width,canvas.height);}catch(e){$('failure').hidden=false;$('failure').textContent=e.message;}}
addEventListener('resize',resize);resize();
function normalize(v){const l=Math.hypot(...v);return v.map(x=>x/l);}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function perspective(fov,aspect){const f=1/Math.tan(fov/2),near=.1,far=160,nf=1/(near-far);return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0];}
function lookAt(eye,target){const z=normalize(eye.map((v,i)=>v-target[i])),x=normalize(cross([0,1,0],z)),y=cross(z,x),dot=a=>-a.reduce((s,v,i)=>s+v*eye[i],0);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,dot(x),dot(y),dot(z),1];}
function multiply(a,b){const c=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c;}
function camera(){const fit=Math.max(1,1.5/(width/height)),z=zoom*fit;return [Math.sin(yaw)*z,0.3+Math.sin(pitch)*zoom,Math.cos(yaw)*z];}
function hit(px,py,eye){const f=normalize([-eye[0],5.4-eye[1],-6-eye[2]]),r=normalize(cross(f,[0,1,0])),u=cross(r,f),rx=(px/width*2-1)*width/height*Math.tan(.33),ry=(1-py/height*2)*Math.tan(.33),ray=normalize(f.map((v,i)=>v+r[i]*rx+u[i]*ry));if(ray[1]>-.02)return [80,80];const d=-eye[1]/ray[1];return [eye[0]+ray[0]*d,eye[2]+ray[2]*d];}
function animate(now){
 const dt=Math.min((now-last)/1000,.05);last=now;
 const features=audioInput.read(dt);
 let drive=features?features.energy:rhythm(ocean.clock);
 if(!features){if(mode==='storm')drive=Math.max(.55,drive*1.3);if(mode==='dream')drive*=.65;}
 if(ocean.manual>0)drive=Math.max(drive,.7);
 if(!paused)liveParams=features?musicMotion.update(features,params,dt):params;
 if(!paused){if(features?.onset)ocean.kick();ocean.update(dt*liveParams.speed,{amplitude:liveParams.amplitude,energy:liveParams.waveEnergy??drive,density:liveParams.density});}
 yaw+=(targetYaw-yaw)*.07;pitch+=(targetPitch-pitch)*.07;zoom+=(targetZoom-zoom)*.07;
 const eye=camera(),vp=multiply(perspective(.66,width/height),lookAt(eye,[0,5.4,-6]));if(screenPointer)pointer=hit(screenPointer[0],screenPointer[1],eye);
 renderer.upload(ocean,liveParams.trail,features?Math.min(1,.18+liveParams.density*.68):1);renderer.render(vp,eye,liveParams,ocean,pointer,color,drive,dpr);
 if(features&&now-lastMeter>90){lastMeter=now;const level=Math.round(features.level*100);$('audio-meter').setAttribute('aria-valuenow',String(level));$('audio-meter-fill').style.transform='scaleX('+features.level+')';$('audio-dock').style.setProperty('--beat',features.beat);const silent=features.silentFor>2.5;if(silent!==silenceShown){silenceShown=silent;$('audio-status').textContent=audioInput.element?.paused?'音乐已暂停':silent?'未检测到声音：检查播放与共享音频选项':'音乐驱动流速 · 丝长 · 密度';}}
 if(now-lastFps>700){$('fps').textContent=Math.round(++frames*1000/(now-lastFps))+' fps';$('particle-count').textContent=renderer.headCount.toLocaleString()+' 条流光';$('splash-status').textContent=ocean.stage;frames=0;lastFps=now;}else frames++;
 requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
let dragging=false,origin;
canvas.addEventListener('pointerdown',e=>{dragging=true;origin=[e.clientX,e.clientY,targetYaw,targetPitch];canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{screenPointer=[e.clientX,e.clientY];if(dragging){targetYaw=origin[2]-(e.clientX-origin[0])*.003;targetPitch=Math.max(.035,Math.min(.4,origin[3]+(e.clientY-origin[1])*.0015));}});
canvas.addEventListener('pointerup',e=>{if(origin&&Math.hypot(e.clientX-origin[0],e.clientY-origin[1])<7){const p=hit(e.clientX,e.clientY,camera());ocean.rings.unshift({x:p[0],z:p[1],born:ocean.clock,strength:1});ocean.rings.length=Math.min(3,ocean.rings.length);}dragging=false;});
canvas.addEventListener('pointercancel',()=>dragging=false);canvas.addEventListener('pointerleave',()=>{screenPointer=null;pointer=[80,80];});
canvas.addEventListener('wheel',e=>{e.preventDefault();targetZoom=Math.max(23,Math.min(52,targetZoom+e.deltaY*.018));},{passive:false});
const keys=['amplitude','speed','trail','density','glow','ripples','reflectivity'];
function range(key){const el=$(key);el.value=params[key];$(key+'-out').textContent=params[key].toFixed(2);el.style.setProperty('--fill',((params[key]-Number(el.min))/(Number(el.max)-Number(el.min))*100)+'%');}
keys.forEach(k=>{range(k);$(k).addEventListener('input',e=>{params[k]=+e.target.value;range(k);document.querySelectorAll('.preset').forEach(b=>b.classList.remove('active'));});});
const presets={silver:{amplitude:1,speed:1,trail:.92,density:1,glow:1.2,ripples:.8,reflectivity:1.25,color:[.42,.69,.91]},storm:{amplitude:1.3,speed:1.1,trail:1,density:1.25,glow:1.35,ripples:1.1,reflectivity:1.3,color:[.52,.72,.92]},dream:{amplitude:.75,speed:.65,trail:1,density:.75,glow:1.1,ripples:.5,reflectivity:1.1,color:[.23,.49,.8]}};
function preset(name){mode=name;Object.assign(params,presets[name]);color=presets[name].color;keys.forEach(range);document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));}
document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click',()=>preset(b.dataset.preset)));
$('reflection').addEventListener('change',e=>params.reflection=e.target.checked);
function pause(){paused=!paused;$('pause-icon').textContent=paused?'▶':'Ⅱ';$('pause-text').textContent=paused?'继续':'暂停';$('pause').setAttribute('aria-label',paused?'继续海浪':'暂停海浪');$('state').textContent=paused?'时间已暂停':audioInput.mode==='system'?'系统音乐驱动':audioInput.mode==='file'?'本地音乐驱动':'实时演算中';}
$('pause').addEventListener('click',pause);
$('splash-trigger').addEventListener('click',()=>{ocean.pulse();if(paused)pause();});
let timeout;function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(timeout);timeout=setTimeout(()=>$('toast').classList.remove('visible'),2300);}
$('reset').addEventListener('click',()=>{preset('silver');ocean.reset();for(let i=0;i<216;i++)ocean.update(1/90,{amplitude:1,energy:rhythm(ocean.clock)});params.reflection=true;$('reflection').checked=true;targetYaw=0;targetPitch=.08;targetZoom=31;pointer=[80,80];screenPointer=null;toast('已恢复参考节奏');});
function chromeState(hidden){document.querySelectorAll('.chrome').forEach(el=>el.inert=hidden);$('show').hidden=!hidden;}
function immersive(){const hidden=document.body.classList.toggle('immersive');chromeState(hidden);}
chromeState(document.body.classList.contains('immersive'));
$('hide').addEventListener('click',immersive);$('show').addEventListener('click',immersive);
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前窗口不支持全屏，可按 H 隐藏控制面板');}}
$('fullscreen').addEventListener('click',fullscreen);
addEventListener('keydown',e=>{if(['INPUT','BUTTON'].includes(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();pause();}if(e.key.toLowerCase()==='h')immersive();if(e.key.toLowerCase()==='f')fullscreen();});
$('snapshot').addEventListener('click',()=>canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='银潮-参考重制-'+new Date().toISOString().replace(/[:.]/g,'-')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('已保存纯净海浪画面');},'image/png'));
function audioState(state){
 const system=state.mode==='system',active=state.mode!=='demo';silenceShown=false;
 $('system-audio').disabled=state.connecting;$('system-audio').textContent=state.connecting?'选择声音来源…':system?'■ 停止跟随':'♫ 跟随电脑音乐';$('audio-dock').classList.toggle('connected',system);
 $('audio-name').firstChild.textContent=active?state.label:'让海浪跟随音乐';$('audio-status').textContent=state.mode==='demo'?'默认跟随参考视频的强弱节奏':state.paused?'音乐已暂停':'音乐驱动流速 · 丝长 · 密度';
 $('audio-actions').hidden=!active;$('audio-toggle').hidden=state.mode!=='file';$('audio-toggle').textContent=state.paused?'播放音乐':'暂停音乐';$('audio-clear').textContent=system?'断开系统音乐':'移除';$('audio-meter').hidden=!active;$('audio-gain-controls').hidden=!active;
 if(!active){$('audio-file').value='';$('audio-meter-fill').style.transform='scaleX(0)';$('audio-dock').style.setProperty('--beat',0);}
 if(!paused)$('state').textContent=system?'系统音乐驱动':state.mode==='file'?'本地音乐驱动':'实时演算中';
 if(state.error){$('audio-help-message').textContent=state.error;$('audio-help').hidden=false;}
 else $('audio-help-message').textContent='声音仅在本机分析。连接成功后立即停止画面轨道，只分析音频。';
 if(state.notice)toast(state.notice);
}
$('system-audio').addEventListener('click',async()=>{if(audioInput.mode==='system'){audioInput.stop();return;}const connected=await audioInput.connectSystem();if(connected){$('audio-help').hidden=true;if(paused)pause();toast('已连接电脑声音，海浪正在跟随音乐');}});
$('audio-file').addEventListener('change',async e=>{const file=e.target.files[0];if(file)await audioInput.connectFile(file);});
$('audio-toggle').addEventListener('click',()=>audioInput.toggleFile());$('audio-clear').addEventListener('click',()=>audioInput.stop());
$('audio-help-toggle').addEventListener('click',()=>{$('audio-help').hidden=!$('audio-help').hidden;});$('audio-help-close').addEventListener('click',()=>$('audio-help').hidden=true);
$('copy-audio-link').addEventListener('click',async()=>{const url=location.protocol==='https:'?location.href:'https://silver-particle-tide-20261023.zhangzhenhao20.chatgpt.site/';try{await navigator.clipboard.writeText(url);toast('链接已复制，请粘贴到 Chrome 或 Edge 地址栏');}catch{$('audio-page-link').hidden=false;$('audio-page-link').value=url;$('audio-page-link').focus();$('audio-page-link').select();}});
function gainRange(){const el=$('audio-gain');audioInput.features.gain=+el.value;$('audio-gain-out').textContent=(+el.value).toFixed(2);el.style.setProperty('--fill',((+el.value-.5)/2.5*100)+'%');}gainRange();$('audio-gain').addEventListener('input',gainRange);
document.querySelector('.upload').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('audio-file').click();}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('failure').hidden=false;$('failure').textContent='图形渲染已中断，请刷新页面恢复。';});
addEventListener('pagehide',()=>audioInput.stop());
})();
