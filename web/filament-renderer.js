(function(root){
'use strict';
root.FilamentRenderer=class{
 constructor(gl){
  this.gl=gl;this.ext=gl.getExtension('ANGLE_instanced_arrays');if(!this.ext)throw Error('浏览器不支持粒子轨迹绘制，请开启硬件加速');
  this.programs=[];
  const vertex=`precision highp float;
attribute vec2 aCorner;
attribute vec3 aStart,aEnd;
attribute vec4 aStyle;
uniform mat4 uVP;
uniform vec2 uResolution;
uniform float uMirror,uScale,uPoints,uHeight;
varying float vAlpha,vSide,vTint;
void main(){
 vec3 a=aStart,b=aEnd;a.y*=uHeight;b.y*=uHeight;if(uMirror>.5){a.y=-a.y;b.y=-b.y;}
 vec4 pa=uVP*vec4(a,1.),pb=uVP*vec4(b,1.);
 vec4 p=mix(pa,pb,aCorner.y);
 float perspective=clamp(32./max(p.w,10.),.45,2.);
 if(uPoints<.5){vec2 d=(pb.xy/pb.w-pa.xy/pa.w)*uResolution;vec2 n=normalize(vec2(-d.y,d.x)+vec2(.0001));p.xy+=n*aCorner.x*aStyle.y*uScale*perspective/uResolution*p.w;}
 else p=pb;
 gl_Position=p;gl_PointSize=clamp((1.45+aStyle.y*1.3)*uScale*perspective,1.,7.);
 vAlpha=aStyle.x*(1.-smoothstep(48.,90.,p.w));vSide=aCorner.x;vTint=aStyle.z;
}`;
  const fragment=`precision highp float;
uniform vec3 uColor;
uniform float uGain,uPoints;
varying float vAlpha,vSide,vTint;
void main(){
 float alpha=vAlpha;
 if(uPoints>.5){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;alpha*=exp(-d*d*4.5);}
 else alpha*=1.-smoothstep(.0,1.,abs(vSide));
 vec3 color=mix(uColor,vec3(.96,.985,1.),vTint*.55);
 gl_FragColor=vec4(color*alpha*uGain,1.);
}`;
  this.fiber=this.link(vertex,fragment);this.fa={};['aCorner','aStart','aEnd','aStyle'].forEach(k=>this.fa[k]=gl.getAttribLocation(this.fiber,k));this.fu=this.uniforms(this.fiber,['VP','Resolution','Mirror','Scale','Points','Color','Gain','Height']);
  this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,0,1,0,-1,1,-1,1,1,0,1,1]),gl.STATIC_DRAW);
  this.capacity=FilamentOcean.MAX*(FilamentOcean.HISTORY-1);this.segments=new Float32Array(this.capacity*10);this.heads=new Float32Array(FilamentOcean.MAX*10);this.segmentBuffer=gl.createBuffer();this.headBuffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,this.segmentBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.segments.byteLength,gl.DYNAMIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,this.headBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.heads.byteLength,gl.DYNAMIC_DRAW);
  this.segmentCount=0;this.headCount=0;
  const screenVertex=`attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
  const waterVertex=`precision highp float;attribute vec2 aPosition;uniform mat4 uVP;varying vec2 vWorld;varying vec4 vClip;void main(){vWorld=aPosition;vClip=uVP*vec4(aPosition.x,0.,aPosition.y,1.);gl_Position=vClip;}`;
  const waterFragment=`precision highp float;
uniform sampler2D uImage;
uniform vec3 uEye,uColor;
uniform vec2 uTexel,uPointer;
uniform vec4 uRings[3];
uniform float uTime,uRipples,uReflection;
varying vec2 vWorld;varying vec4 vClip;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float height(vec2 p){
 float t=uTime;float h=sin(p.x*.8+p.y*2.4+t*.7)*.017+sin(p.x*1.8-p.y*4.3-t*.8)*.008;
 h+=(noise(p*vec2(2.2,5.1)+vec2(t*.15,-t*.25))-.5)*.015;
 float d=distance(p,uPointer);h+=sin(d*4.-t*4.)*exp(-d*.44)*.045;
 for(int i=0;i<3;i++){vec4 r=uRings[i];float d=distance(p,r.xy);float front=d-r.z*3.1;h+=sin(d*6.-r.z*13.)*exp(-front*front*.4-r.z*.8)*r.w*.07;}
 return h*uRipples;
}
void main(){
 vec2 p=vWorld;float h=height(p),e=.045;
 vec2 slope=vec2(height(p+vec2(e,0.))-h,height(p+vec2(0.,e))-h)/e;
 vec3 n=normalize(vec3(-slope.x,1.,-slope.y));vec3 eye=normalize(uEye-vec3(p.x,0.,p.y));
 float fresnel=.20+.8*pow(1.-max(0.,dot(n,eye)),3.);
 vec2 uv=vClip.xy/vClip.w*.5+.5;
 vec2 shift=vec2(slope.x*.022,slope.y*.017)*clamp(30./vClip.w,.4,2.);
 uv+=shift;
 vec2 blur=uTexel*vec2(4.+abs(slope.y)*28.,.8);
 vec3 reflection=texture2D(uImage,clamp(uv,.001,.999)).rgb*.5+texture2D(uImage,clamp(uv+blur,.001,.999)).rgb*.25+texture2D(uImage,clamp(uv-blur,.001,.999)).rgb*.25;
 reflection*=uReflection*(.3+.8*fresnel*fresnel);
 float attenuation=1.-smoothstep(40.,100.,length(uEye-vec3(p.x,0.,p.y)));
 gl_FragColor=vec4((reflection+vec3(.0002,.0006,.0011))*attenuation,1.);
}`;
  this.water=this.link(waterVertex,waterFragment);this.wa=gl.getAttribLocation(this.water,'aPosition');this.wu=this.uniforms(this.water,['VP','Image','Eye','Color','Texel','Pointer','Time','Ripples','Reflection']);this.wu.Rings=gl.getUniformLocation(this.water,'uRings[0]');
  this.plane=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.plane);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-100,-85,100,-85,-100,35,-100,35,100,-85,100,35]),gl.STATIC_DRAW);
  const blurFragment=`precision highp float;uniform sampler2D uImage;uniform vec2 uStep;varying vec2 vUV;void main(){vec3 c=texture2D(uImage,vUV).rgb*.227027;c+=texture2D(uImage,vUV+uStep*1.384615).rgb*.316216;c+=texture2D(uImage,vUV-uStep*1.384615).rgb*.316216;c+=texture2D(uImage,vUV+uStep*3.230769).rgb*.07027;c+=texture2D(uImage,vUV-uStep*3.230769).rgb*.07027;gl_FragColor=vec4(c,1.);}`;
  this.blur=this.link(screenVertex,blurFragment);this.ba=gl.getAttribLocation(this.blur,'aPosition');this.bu=this.uniforms(this.blur,['Image','Step']);
  const finalFragment=`precision highp float;uniform sampler2D uImage,uBloom;uniform float uGlow;varying vec2 vUV;void main(){vec3 c=texture2D(uImage,vUV).rgb;vec3 b=texture2D(uBloom,vUV).rgb;c=c+b*uGlow*.92;c=pow(max(c,vec3(0.)),vec3(.92));gl_FragColor=vec4(c,1.);}`;
  this.finish=this.link(screenVertex,finalFragment);this.ca=gl.getAttribLocation(this.finish,'aPosition');this.cu=this.uniforms(this.finish,['Image','Bloom','Glow']);
  this.screen=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.screen);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  this.targets={mirror:this.target(),scene:this.target(),blurA:this.target(),blurB:this.target()};gl.disable(gl.DEPTH_TEST);gl.blendFunc(gl.ONE,gl.ONE);
 }
 link(v,f){const gl=this.gl,p=gl.createProgram();for(const [type,src] of [[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
 uniforms(p,names){const o={};names.forEach(n=>o[n]=this.gl.getUniformLocation(p,'u'+n));return o;}
 target(){const gl=this.gl,t={texture:gl.createTexture(),fbo:gl.createFramebuffer()};gl.bindTexture(gl.TEXTURE_2D,t.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
 sizeTarget(t,w,h){const gl=this.gl;t.width=w;t.height=h;gl.bindTexture(gl.TEXTURE_2D,t.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('无法创建反射画面');}
 resize(w,h){this.width=w;this.height=h;this.sizeTarget(this.targets.scene,w,h);const s=Math.min(1,1600/w);this.sizeTarget(this.targets.mirror,Math.max(1,Math.round(w*s)),Math.max(1,Math.round(h*s)));for(const k of ['blurA','blurB'])this.sizeTarget(this.targets[k],Math.max(1,Math.round(w/4)),Math.max(1,Math.round(h/4)));this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null);}
 upload(ocean,length,visibility=1){
  const h=ocean.history,N=FilamentOcean.HISTORY;let k=0,head=0;const maxAge=Math.max(2,Math.round((N-1)*length));
  for(const p of ocean.particles){
   // Stable selection adds/removes complete filaments without changing their opacity.
   if((p.seed*73.739)%1>=visibility)continue;
   const i=head*10;this.heads[i]=p.x;this.heads[i+1]=p.y;this.heads[i+2]=p.z;this.heads[i+3]=p.x;this.heads[i+4]=p.y;this.heads[i+5]=p.z;this.heads[i+6]=p.alpha*(p.rest<0?1.1:.15);this.heads[i+7]=p.width;this.heads[i+8]=.5+p.seed*.5;this.heads[i+9]=0;head++;
   if(length<.01)continue;
   const count=Math.min(maxAge,p.samples-1),base=p.slot*N*3;
   let ax=p.x,ay=p.y,az=p.z;
   for(let j=0;j<count;j++){
    const index=base+((ocean.cursor-j+N)%N)*3;
    const bx=h[index],by=h[index+1],bz=h[index+2];
    if(Math.abs(ax-bx)+Math.abs(ay-by)+Math.abs(az-bz)>.0002){
     const fade=Math.pow(1-j/(count+1),1.25),wave=.78+.22*Math.sin(j*.39+p.seed*21.+ocean.clock*.6);
     this.segments[k++]=bx;this.segments[k++]=by;this.segments[k++]=bz;this.segments[k++]=ax;this.segments[k++]=ay;this.segments[k++]=az;
     this.segments[k++]=p.alpha*fade*(.42+p.seed*.42);this.segments[k++]=p.width*(.25+.75*fade)*wave;this.segments[k++]=.2+p.seed*.6;this.segments[k++]=0;
    }
    ax=bx;ay=by;az=bz;
   }
  }
  this.segmentCount=k/10;this.headCount=head;const gl=this.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER,this.segmentBuffer);if(k)gl.bufferSubData(gl.ARRAY_BUFFER,0,this.segments.subarray(0,k));gl.bindBuffer(gl.ARRAY_BUFFER,this.headBuffer);if(head)gl.bufferSubData(gl.ARRAY_BUFFER,0,this.heads.subarray(0,head*10));
 }
 disable(){const gl=this.gl;for(let i=0;i<8;i++){gl.disableVertexAttribArray(i);this.ext.vertexAttribDivisorANGLE(i,0);}}
 drawFibers(vp,mirror,w,h,scale,color,gain,height=1){
  const gl=this.gl,a=this.fa,u=this.fu;this.disable();gl.useProgram(this.fiber);gl.enable(gl.BLEND);gl.uniformMatrix4fv(u.VP,false,vp);gl.uniform2f(u.Resolution,w,h);gl.uniform1f(u.Mirror,mirror);gl.uniform1f(u.Scale,scale);gl.uniform3fv(u.Color,color);gl.uniform1f(u.Gain,gain);
  gl.uniform1f(u.Height,height);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(a.aCorner);gl.vertexAttribPointer(a.aCorner,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.segmentBuffer);for(const [key,size,offset] of [['aStart',3,0],['aEnd',3,12],['aStyle',4,24]]){const loc=a[key];gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,offset);this.ext.vertexAttribDivisorANGLE(loc,1);}
  gl.uniform1f(u.Points,0);if(this.segmentCount)this.ext.drawArraysInstancedANGLE(gl.TRIANGLES,0,6,this.segmentCount);
  this.disable();gl.disableVertexAttribArray(a.aCorner);gl.vertexAttrib2f(a.aCorner,0,1);gl.bindBuffer(gl.ARRAY_BUFFER,this.headBuffer);for(const [key,size,offset] of [['aStart',3,0],['aEnd',3,12],['aStyle',4,24]]){const loc=a[key];gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,offset);}
  gl.uniform1f(u.Points,1);if(this.headCount)gl.drawArrays(gl.POINTS,0,this.headCount);this.disable();
 }
 bind(t){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,t?t.fbo:null);gl.viewport(0,0,t?t.width:this.width,t?t.height:this.height);}
 screenPass(program,loc){const gl=this.gl;this.disable();gl.useProgram(program);gl.disable(gl.BLEND);gl.bindBuffer(gl.ARRAY_BUFFER,this.screen);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);}
 render(vp,eye,params,ocean,pointer,color,drive,dpr){
  const gl=this.gl,t=this.targets,gain=2.6*params.glow,height=params.heightScale??1;
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,null);gl.activeTexture(gl.TEXTURE0);
  this.bind(t.mirror);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);if(params.reflection)this.drawFibers(vp,1,t.mirror.width,t.mirror.height,dpr*t.mirror.width/this.width,color,gain,height);
  this.bind(t.scene);gl.clear(gl.COLOR_BUFFER_BIT);this.disable();gl.useProgram(this.water);gl.disable(gl.BLEND);gl.bindBuffer(gl.ARRAY_BUFFER,this.plane);gl.enableVertexAttribArray(this.wa);gl.vertexAttribPointer(this.wa,2,gl.FLOAT,false,0,0);
  const u=this.wu;gl.uniformMatrix4fv(u.VP,false,vp);gl.uniform3fv(u.Eye,eye);gl.uniform3fv(u.Color,color);gl.uniform2f(u.Texel,1/t.mirror.width,1/t.mirror.height);gl.uniform2fv(u.Pointer,pointer);gl.uniform1f(u.Time,ocean.clock);gl.uniform1f(u.Ripples,params.ripples);gl.uniform1f(u.Reflection,params.reflection?params.reflectivity:0);
  const rings=new Float32Array(12);for(let i=0;i<3;i++){const r=ocean.rings[i];rings.set(r?[r.x,r.z,ocean.clock-r.born,r.strength]:[80,80,100,0],i*4);}gl.uniform4fv(u.Rings,rings);gl.bindTexture(gl.TEXTURE_2D,t.mirror.texture);gl.uniform1i(u.Image,0);gl.drawArrays(gl.TRIANGLES,0,6);
  this.drawFibers(vp,0,this.width,this.height,dpr,color,gain,height);
  this.bind(t.blurA);this.screenPass(this.blur,this.ba);gl.bindTexture(gl.TEXTURE_2D,t.scene.texture);gl.uniform1i(this.bu.Image,0);gl.uniform2f(this.bu.Step,1/t.blurA.width,0);gl.drawArrays(gl.TRIANGLES,0,6);
  this.bind(t.blurB);this.screenPass(this.blur,this.ba);gl.bindTexture(gl.TEXTURE_2D,t.blurA.texture);gl.uniform2f(this.bu.Step,0,1/t.blurB.height);gl.drawArrays(gl.TRIANGLES,0,6);
  this.bind(null);this.screenPass(this.finish,this.ca);gl.bindTexture(gl.TEXTURE_2D,t.scene.texture);gl.uniform1i(this.cu.Image,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,t.blurB.texture);gl.uniform1i(this.cu.Bloom,1);gl.uniform1f(this.cu.Glow,params.glow);gl.drawArrays(gl.TRIANGLES,0,6);gl.activeTexture(gl.TEXTURE0);this.disable();
 }
};
})(globalThis);
