const fs=require('fs'),path=require('path');
const Ocean=require('../web/filament-ocean.js');
const out=path.resolve(__dirname,'../rive');
let next=1000;const id=()=>`0:${next++}`,esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const n=x=>Number(x.toFixed(4));const a=o=>Object.entries(o).map(([k,v])=>`${k}="${esc(v)}"`).join(' ');
const e=(tag,attrs={},children='')=>`<${tag} ${a(attrs)}>${Array.isArray(children)?children.join('\n'):children}</${tag}>`;
const root=[],listeners=[],events={},textChars=[];
const vm='0:100',inst='0:101',font='0:200',anim='0:300',wave='0:301',sm='0:7';
const props={amplitude:[1,.2,2],speed:[1,.05,2],trail:[.92,0,1],density:[1,.15,1.5],glow:[1.2,.3,2],ripples:[.8,0,2],reflectivity:[1.25,0,1.8],reflection:[1,0,1],panelVisible:[1,0,1],helpVisible:[0,0,1]};
const propIds=Object.fromEntries(Object.keys(props).map(k=>[k,id()]));propIds.playing=id();
function bind(prop,key,converter,extra={}){return e('DataBindContext',{sourcePathIds:`${vm}-${propIds[prop]}`,propertyKey:key,...(converter?{converterId:converter}:{}),...extra});}
function range(lo,hi,toLo,toHi,name='Map'){const i=id();root.push(e('DataConverterRangeMapper',{id:i,name,minInput:lo,maxInput:hi,minOutput:toLo,maxOutput:toHi,clampLower:true,clampUpper:true}));return i;}
const inverse=range(0,1,1,0,'Inverse');const negate=id();root.push(e('DataConverterBooleanNegate',{id:negate,name:'Negate'}));
const asString=id();root.push(e('DataConverterToString',{id:asString,name:'Two decimals',decimals:2,round:true,trailingZeros:true}));
function fill(color){return e('Fill',{name:'Fill'},e('SolidColor',{colorValue:color}));}
function gradient(stops,x1,y1,x2,y2){return e('Fill',{name:'Glass'},e('LinearGradient',{startX:x1,startY:y1,endX:x2,endY:y2},stops.map(([p,c])=>e('GradientStop',{position:p,colorValue:c}))));}
function stroke(color,width=1,more=''){return e('Stroke',{name:'Stroke',thickness:width,cap:'round',join:'round'},e('SolidColor',{colorValue:color})+more);}
function rect(x,y,w,h,r,color,name='Rect',extra={},paint){const i=id();return {id:i,xml:e('Shape',{id:i,name,x,y,...extra},e('Rectangle',{width:w,height:h,originX:0,originY:0,cornerRadiusTL:r})+(paint||fill(color)))};}
function text(str,x,y,size=12,color='FFE5EDF5',extra={}){
 if(['≋','↻','⛶'].includes(str)){
  const side=str==='≋'?25:17,ox=extra.originX===.5?x-side/2:x,oy=extra.originY===.5?y-side/2:y,paths=[];
  if(str==='≋')for(let r=0;r<3;r++){paths.push(Array.from({length:25},(_,k)=>[k,4+r*7+Math.sin(k/24*Math.PI*2)*2.1]));}
  if(str==='⛶')paths.push([[5,1],[1,1],[1,5]],[[12,1],[16,1],[16,5]],[[1,12],[1,16],[5,16]],[[12,16],[16,16],[16,12]]);
  if(str==='↻'){paths.push(Array.from({length:33},(_,k)=>{const t=-2.5+k/32*5.7;return [8.5+6.4*Math.cos(t),8.5+6.4*Math.sin(t)];}));paths.push([[1,1],[1,6],[6,6]]);}
  return paths.map(pts=>e('Shape',{id:id(),name:'Vector '+str,x:ox,y:oy},e('PointsPath',{isClosed:false},pts.map(([x,y])=>e('StraightVertex',{x:n(x),y:n(y)})))+stroke(color,1.5))).join('');
 }
 textChars.push(str);const i=id(),s=id();return e('Text',{id:i,name:str,x,y,originValue:'top',...extra},e('TextStylePaint',{id:s,name:'UI type',fontSize:size,fontAssetId:font},fill(color))+e('TextValueRun',{styleId:s,text:str}));
}
function node(items,attrs={},bindings=''){return e('Node',{id:id(),...attrs},bindings+items.slice().reverse().join('\n'));}
function actionSet(prop,value){const bool=typeof value==='boolean';return e('ListenerViewModelChange',{},e(bool?'BindablePropertyBoolean':'BindablePropertyNumber',{propertyValue:value},bind(prop,bool?634:636,null,{direction:true})));}
function listen(target,kind,actions,name){listeners.push(e('StateMachineListenerSingle',{targetId:target,listenerTypeValue:kind,name:name||kind},actions));}
function toggle(target,prop){const read=id(),bool=prop==='playing';listen(target,'click',e('ListenerViewModelChange',{fromViewModelProperty:true,fromDataBindId:read},e(bool?'BindablePropertyBoolean':'BindablePropertyNumber',{},bind(prop,bool?634:636,bool?negate:inverse,{id:read})+bind(prop,bool?634:636,null,{direction:true}))),`Toggle ${prop}`);}
function event(target,name){if(!events[name]){events[name]=id();}listen(target,'click',e('ListenerFireEvent',{eventId:events[name]}),name);}
function glass(x,y,w,h,r=28){return rect(x,y,w,h,r,'','Glass',{},gradient([[0,'B948535F'],[.38,'A5262F39'],[1,'B933424F']],0,0,w,h)+stroke('63E5EFFB',.8)).xml;}
function button(label,x,y,w,h=36,white=false){const items=[rect(x,y,w,h,h/2,'',label+' button',{},gradient([[0,white?'FFF4F8FC':'354B5968'],[1,white?'FFDDE8F3':'1C4F5E6D']],0,0,0,h)+stroke(white?'CCFFFFFF':'30E2EDF8',.7))];const s=items[0];items.push({xml:text(label,x+w/2,y+h/2,11,white?'FF202E3E':'FFF1F6FB',{originX:.5,originY:.5})});return {id:s.id,xml:items.map(x=>x.xml).reverse().join('')};}
// Native glass controls, with separate shapes, text, bindings and hit targets.
const ui=[],panel=[];const px=1248,py=100,pw=324;
panel.push(glass(px,py,pw,868,32));
panel.push(text('流光海浪',px+24,py+22,21,'FFF5F7FA'));panel.push(text('实时调节海浪与水面',px+24,py+53,11,'FFB2BECA'));
const reset=button('↻',px+268,py+21,32,32);panel.push(reset.xml);listen(reset.id,'click',Object.entries(props).map(([k,v])=>actionSet(k,v[0])).join('')+actionSet('playing',true),'Reset defaults');
panel.push(rect(px+24,py+84,276,40,16,'40000000','Preset well').xml);
for(const [i,label,vals] of [[0,'参考节奏',{amplitude:1,speed:1,trail:.92,density:1,glow:1.2}],[1,'强浪',{amplitude:1.3,speed:1.1,trail:1,density:1.25,glow:1.35}],[2,'缓流',{amplitude:.75,speed:.65,trail:1,density:.75,glow:1.1}]]){const b=button(label,px+28+i*90,py+88,88,32);panel.push(b.xml);listen(b.id,'click',Object.entries(vals).map(([k,v])=>actionSet(k,v)).join(''),'Preset '+label);}
let sy=py+143;
for(const [key,label] of [['amplitude','波浪高度'],['speed','流动速度'],['trail','光丝长度'],['density','光丝密度'],['glow','粒子亮度'],['ripples','涟漪强度'],['reflectivity','倒影强度']]){
 if(key==='ripples'){panel.push(rect(px+24,sy-6,276,1,0,'26FFFFFF','Divider').xml);panel.push(text('水面与倒影',px+24,sy+7,12));panel.push(text('流光随波纹散开',px+182,sy+9,9,'FFACBBC9'));sy+=40;}
 panel.push(text(label,px+24,sy,12));
 const st=id();textChars.push('0123456789.');panel.push(e('Text',{x:px+250,y:sy,name:key+' value'},e('TextStylePaint',{id:st,fontSize:11,fontAssetId:font},fill('FFC7D3DF'))+e('TextValueRun',{styleId:st,text:props[key][0].toFixed(2)},bind(key,268,asString))));
 const track=rect(px+24,sy+24,276,24,9,'01000000',key+' hit');panel.push(track.xml);
 panel.push(rect(px+24,sy+33,276,5,3,'26FFFFFF',key+' track').xml);
 const width=range(props[key][1],props[key][2],0,276,key+' to width');
 panel.push(e('Shape',{name:key+' fill',x:px+24,y:sy+33},e('Rectangle',{width:150,height:5,originX:0,originY:0,cornerRadiusTL:3},bind(key,20,width))+fill('FFE9F2FC')));
 const xpos=range(props[key][1],props[key][2],px+24,px+300,key+' to x');
 panel.push(e('Shape',{name:key+' thumb',x:px+164,y:sy+35.5},bind(key,13,xpos)+e('Ellipse',{width:18,height:18})+fill('FFF8FCFF')+stroke('80FFFFFF',.5)));
 const pointerValue=range(px+24,px+300,props[key][1],props[key][2],key+' pointer to value');
 for(const gesture of ['click','drag'])listen(track.id,gesture,e('ListenerViewModelChange',{inputValue:'pointerX'},e('BindablePropertyNumber',{},bind(key,636,pointerValue,{direction:true}))),`Slide ${key} ${gesture}`);
 sy+=58;
}
panel.push(text('水面倒影',px+24,sy+4,12));const sw=rect(px+258,sy,42,26,13,'FF34C759','Reflection toggle');panel.push(sw.xml);toggle(sw.id,'reflection');
panel.push(e('Shape',{x:px+271,y:sy+13,name:'Reflection knob'},bind('reflection',13,range(0,1,px+271,px+287))+e('Ellipse',{width:20,height:20})+fill('FFFFFFFF')));sy+=43;
panel.push(text('光丝回流',px+24,sy+7,11,'FFBAC8D4'));const splash=button('涌起一阵浪',px+214,sy,86,30);panel.push(splash.xml);event(splash.id,'splash');sy+=46;
panel.push(rect(px+24,sy,276,1,0,'26FFFFFF').xml);panel.push(text('♫',px+26,sy+13,22));panel.push(text('让海浪跟随音乐',px+66,sy+13,11));panel.push(text('音乐输入由宿主程序连接',px+66,sy+32,10,'FFAEBdCB'.toUpperCase()));const upload=button('+',px+271,sy+14,28,28);panel.push(upload.xml);event(upload.id,'openAudioFile');sy+=68;
panel.push(text('音乐带动流速、丝长与密度',px+24,sy,10,'FFAEBdCB'.toUpperCase()));panel.push(text('浪高与亮度由滑块独立控制',px+24,sy+17,10,'FFAEBdCB'.toUpperCase()));sy+=48;
const pause=button('暂停 / 继续',px+24,sy,133,42,true);panel.push(pause.xml);toggle(pause.id,'playing');const save=button('保存画面',px+166,sy,134,42);panel.push(save.xml);event(save.id,'saveFrame');panel.push(text('原生 Rive 光丝动画',px+24,sy+56,10,'FF9EAFBF'));panel.push(text('60 fps',px+264,sy+56,10,'FF9EAFBF'));
ui.push(node(panel,{name:'Glass control panel'},bind('panelVisible',18)+bind('panelVisible',16)));
const brand=[glass(28,26,136,62,26),text('≋',43,40,29),text('银潮',85,36,18),text('粒子海浪实验',85,62,9,'FFC1CCD7')];ui.push(node(brand,{name:'Brand'}));
const tools=[glass(1428,26,144,46,25)];const show=button('调节效果',1434,31,83,36);tools.push(show.xml);toggle(show.id,'panelVisible');const full=button('⛶',1524,31,40,36);tools.push(full.xml);event(full.id,'fullscreen');ui.push(node(tools,{name:'Window controls'}));
const dock=[glass(1218,26,192,46,25)];const audio=button('♫ 跟随电脑音乐',1223,31,144,36);dock.push(audio.xml);event(audio.id,'connectSystemAudio');const help=button('?',1371,34,28,28);dock.push(help.xml);toggle(help.id,'helpVisible');ui.push(node(dock,{name:'Audio controls'}));
const helpPane=[glass(1218,84,354,304,27),text('跟随正在播放的音乐',1240,106,15),text('在宿主程序中接收音乐后，将音量与节拍',1240,148,11),text('映射到 speed、trail、density 参数。',1240,170,11),text('波浪高度与粒子亮度保持手动控制。',1240,204,11),text('连接音乐、导入音频、截图和全屏按钮',1240,248,11),text('会向宿主程序发送对应的 Rive 事件。',1240,270,11),text('关闭此说明，请再次点击问号。',1240,326,10,'FFB2BECA')];ui.push(node(helpPane,{name:'Music help'},bind('helpVisible',18)+bind('helpVisible',16)));
ui.push(text('光与引力之间，一场无声的潮汐。',30,968,11,'FFB7C5D2'));
// Convert coherent paths sampled from the original ocean physics to vector motion.
// A moving trim reveals a travelling filament; no runtime scripts or video are used.
const effects=[],timeline=[],groups=Array.from({length:12},()=>[]),mirrors=Array.from({length:12},()=>[]);
const FPS=60,DURATION=480;
const norm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);},dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const eye=[0,3.5,31],target=[0,5.4,-6],forward=norm(target.map((v,i)=>v-eye[i])),right=norm(cross(forward,[0,1,0])),up=cross(right,forward);
function project(p,mirror=false,index=0){const q=[p.x,p.y*(mirror?-1:1),p.z].map((v,i)=>v-eye[i]);const depth=dot(q,forward),f=500/Math.tan(.33);let x=800+dot(q,right)*f/depth,y=500-dot(q,up)*f/depth;if(mirror)x+=Math.sin(y*.19+index*.41)*Math.max(0,y-570)*.016;return [n(x),n(y-585)];}
function keys(object,key,values){return e('KeyedObject',{objectId:object},e('KeyedProperty',{propertyKey:key},values.map(([frame,value])=>e('KeyFrameDouble',{frame:n(frame),value:n(value),interpolationType:'linear'}))));}
const count=960;
for(let i=0;i<count;i++){
 const o=new Ocean(7103+i*19),em=o.emitters[Math.floor(i/(count/4))];o.clock=(i%240)/240*.5;o.energy=.65;
 o.begin(em);em.angle=em.base+Math.sin(Math.floor(i/240)*3.7)*.23;em.dx=Math.cos(em.angle);em.dz=Math.sin(em.angle);em.force=.95;em.phase=Math.floor(i/240)*1.3;em.emitX=em.x;em.emitZ=em.z;em.width=6;
 o.add(em,1);o.emitters.forEach(x=>{x.end=-1;x.next=Infinity;});const p=o.particles[0],points=[{x:p.x,y:p.y,z:p.z}],times=[0];
 for(let j=1;j<=210;j++){o.step(1/45,{amplitude:1,energy:.65,density:0});if(!o.particles.length)break;if(j%3===0){points.push({x:p.x,y:p.y,z:p.z});times.push(j/45);}}
 const main=points.map(p=>project(p)),mirror=points.map(p=>project(p,true,i));let cumulative=[0];for(let j=1;j<main.length;j++)cumulative.push(cumulative[j-1]+Math.hypot(main[j][0]-main[j-1][0],main[j][1]-main[j-1][1]));const total=cumulative.at(-1)||1;const progress=cumulative.map(x=>x/total);
 const trim=id(),effect=id(),delay=((i%240)/240*.85+Math.floor(i/240)*1.75)%8;
 effects.push(e('GroupEffect',{id:effect,name:'Filament reveal '+i},e('TrimPath',{id:trim,name:'Travelling head',start:0,end:0,modeValue:'synchronized'})+e('TrimPath',{start:0,end:1,modeValue:'synchronized',name:'User trail length'},bind('trail',114,range(0,1,.99,0,'Trail '+i)))));
 const starts=[],ends=[];for(let f=0;f<=DURATION;f+=4){const age=((f/FPS-delay)%8+8)%8;let j=Math.min(times.length-2,Math.floor(age*15));let head=age>=times.at(-1)?1:progress[j]+(progress[j+1]-progress[j])*Math.max(0,Math.min(1,(age-times[j])/(times[j+1]-times[j])));ends.push([f,head]);starts.push([f,Math.max(0,head-.46)]);if(age>=times.at(-1)+.15)starts[starts.length-1][1]=1;}
 timeline.push(keys(trim,114,starts),keys(trim,115,ends));
 const g=i%12,thick=.45+Math.pow(p.seed,3)*1.35;
 function filament(pts,reflection){const effectRef=e('TargetEffect',{targetId:effect});return e('Shape',{id:id(),name:(reflection?'Reflection ':'Filament ')+i,blendModeValue:'additive'},e('PointsPath',{isClosed:false,isClockwise:true},pts.map(([x,y])=>e('StraightVertex',{x,y,radius:1.8})))+stroke(reflection?'3676A9C9':'447EBBDD',n(thick*2),effectRef+e('Feather',{strength:reflection?2.5:1.4},reflection?bind('ripples',749,range(0,2,.2,4,'Water softness '+i)):''))+stroke(reflection?'78BAD5EA':'D9DDEFFB',n(thick),effectRef));}
 groups[g].push(filament(main,false));mirrors[g].push(filament(mirror,true));
}
const oceanParts=[],mirrorParts=[];for(let i=0;i<12;i++){const visibility=range(.15+i*.105,.151+i*.105,0,1,'Density bucket '+i);oceanParts.push(node(groups[i],{name:'Density '+i},bind('density',18,visibility)));mirrorParts.push(node(mirrors[i],{name:'Mirror density '+i},bind('density',18,visibility)));}
const oceanLayer=node(oceanParts,{y:585,name:'Wave height'},bind('amplitude',17)+bind('glow',18,range(.3,2,.15,1)));
const mirrorLayer=node([node(mirrorParts,{name:'Reflection intensity'},bind('reflectivity',18,range(0,1.8,0,.8)))],{y:585,name:'Water reflection'},bind('amplitude',17)+bind('reflection',18));
const waveRml=e('Artboard',{id:wave,name:'Ocean',isComponent:true,width:1600,height:1000,x:1800,styleId:'0:302'},e('LayoutComponentStyle',{id:'0:302'})+effects.join('')+oceanLayer+mirrorLayer+e('LinearAnimation',{id:anim,name:'Ocean loop',fps:FPS,duration:DURATION,loopValue:'loop'},timeline));
root.push(e('ComponentAsset',{artboardId:wave,name:'Ocean'}));
const nested=e('NestedArtboard',{id:id(),name:'Animated ocean',artboardId:wave},e('NestedSimpleAnimation',{name:'Playback',animationId:anim,isPlaying:true,speed:1},bind('speed',199)+bind('playing',201)));
const mainRml=e('Artboard',{id:'0:2',name:'Silver Tide',width:1600,height:1000,clip:true,styleId:'0:5',defaultStateMachineId:sm,viewModelId:vm,viewModelInstanceId:inst},e('LayoutComponentStyle',{id:'0:5'})+ui.reverse().join('\n')+nested+e('Fill',{name:'Background'},e('SolidColor',{colorValue:'FF020406'}))+e('StateMachine',{id:sm,name:'Ocean Controls'},listeners.join('')+e('StateMachineLayer',{name:'Controls',id:'0:8'},e('AnyState',{x:200,y:-120})+e('ExitState',{x:400,y:-120})+e('EntryState',{x:0,y:0}))));
const vmRml=e('ViewModel',{id:vm,name:'OceanControls',defaultInstanceId:inst},Object.entries(props).map(([key])=>e('ViewModelPropertyNumber',{id:propIds[key],name:key})).join('')+e('ViewModelPropertyBoolean',{id:propIds.playing,name:'playing'})+e('ViewModelInstance',{id:inst,name:'Default',exports:true},Object.entries(props).map(([key,v])=>e('ViewModelInstanceNumber',{viewModelPropertyId:propIds[key],propertyValue:v[0]})).join('')+e('ViewModelInstanceBoolean',{viewModelPropertyId:propIds.playing,propertyValue:true})));
// Events must belong to the host artboard, not the root.
const eventRml=Object.entries(events).map(([name,i])=>e('Event',{id:i,name})).join('');
fs.writeFileSync(path.join(out,'scene.rml'),e('Rive',{version:1,kind:'fragment'},mainRml.replace('</Artboard>',eventRml+'</Artboard>')+waveRml+root.join('\n')+vmRml+e('FontAsset',{id:font,file:'assets/UI.ttf',name:'Noto Sans SC UI'})));
fs.writeFileSync(path.join(out,'rive.yaml'),'name: silver-tide\nmain: Silver Tide\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n');
fs.writeFileSync(path.join(out,'assets/glyphs.txt'),[...new Set(textChars.join('')+'0123456789. +?/↻≋⛶♫')].join(''));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({artboard:'Silver Tide',stateMachine:'Ocean Controls',viewModel:'OceanControls',size:[1600,1000],filaments:count,loopSeconds:8,parameters:Object.fromEntries(Object.entries(props).map(([k,v])=>[k,{default:v[0],min:v[1],max:v[2]}])),events:Object.keys(events),scriptFree:true},null,2));
console.log(JSON.stringify({out,objects:next,filaments:count,rmlBytes:fs.statSync(path.join(out,'scene.rml')).size,panelBottom:sy+73}));
