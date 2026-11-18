// ============================================================
// WORLD — cena 3D: terreno procedural, céu de Marte, iluminação, pós-processamento,
// partículas, construções e astronautas. Só lê o estado da simulação.
// ============================================================
var World = (function () {
  var T = THREE, G = Gfx, TS = G.TS, N = Sim.N, BD = DATA.buildings, MD = Models;
  var W = { cam: { x: N / 2, z: N / 2 + 1, dist: 34, yaw: 0.5, pitch: 0.82, lookUp: 0 }, landerY: 0, flame: false, arkY: 0, arkFlame: false, loading: 0, hideChars: false, shake: 0, overlayOn: false, selected: {}, selB: null, nf: 0, q: 'high' };
  var renderer, scene, cam, composer, bloom, grade, sunL, hemi, skyMat, envScene, pmrem, envRT = null, envAt = { h: -99, k: -1 }, terrMat, terrain, outer, fogTex, fogData, trod, hTex, playTex, playData;
  var ghost = null, ghostType = null, arkMesh = null, ghostHolo, footDecal, selDecal, overlay, pool = [], spots = [], dust, glow, flameMesh, mapSeed = null, map = null;
  var bMesh = {}, cRig = {}, dMesh = {}, pickables = [], time = 0, occSig = '', lastFog = 0, sunDir = new T.Vector3(0, 1, 0);

  // ---------------- ruído em JS (relevo fino e montanhas) ----------------
  function h2(x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vn(x, y) { var i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j; f = f * f * (3 - 2 * f); g = g * g * (3 - 2 * g); var a = h2(i, j), b = h2(i + 1, j), c = h2(i, j + 1), d = h2(i + 1, j + 1); return a + (b - a) * f + (c - a) * g + (a - b - c + d) * f * g; }
  function fbm(x, y, o) { var s = 0, a = 0.5, n = 0; for (var i = 0; i < o; i++) { s += a * vn(x, y); n += a; x = x * 2.03 + 17; y = y * 2.03 + 5; a *= 0.5; } return s / n; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sm(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  // altura renderizada (coordenadas em tiles): relevo da simulação + microrrelevo
  function Hr(x, z) { if (!map) return 0; var e = Math.min(x, z, N - x, N - z); return map.hAt(x, z) + ((vn(x * 0.9, z * 0.9) - 0.5) * 0.24 + (vn(x * 2.6 + 5, z * 2.6) - 0.5) * 0.08) * sm(0, 2, e); }
  function Hout(x, z) { var cx = clamp(x, 0, N), cz = clamp(z, 0, N), d = Math.max(Math.abs(x - cx), Math.abs(z - cz)), base = map.hAt(cx, cz), f = sm(0, 60, d);
    var m = fbm(x * 0.011 + 3, z * 0.011, 5), mesa = sm(0.5, 0.58, m) * 0.6 + sm(0.62, 0.66, m) * 0.4, rid = 1 - Math.abs(fbm(x * 0.03, z * 0.03 + 9, 4) * 2 - 1);
    return base + f * (mesa * 34 + rid * rid * 12 + (fbm(x * 0.08, z * 0.08, 3) - 0.5) * 4) + sm(0, 8, d) * (fbm(x * 0.2, z * 0.2, 3) - 0.5) * 1.5; }
  W.Hr = Hr;

  // ---------------- inicialização ----------------
  W.init = function (canvas, q) { W.q = q || 'high';
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, W.q === 'high' ? 2 : W.q === 'mid' ? 1.25 : 1));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.localClippingEnabled = true;
    scene = new T.Scene(); scene.fog = new T.FogExp2(0xc9a27a, 0.004); cam = new T.PerspectiveCamera(36, 1, 0.3, 3000);
    G.init(renderer, W.q);
    G.U.uFog = { value: null }; G.U.uPlay = { value: null }; G.U.uN = { value: N }; G.U.uTS = { value: TS };
    hemi = new T.HemisphereLight(0xffe2c4, 0x5a3220, 0.25); scene.add(hemi);
    sunL = new T.DirectionalLight(0xfff0dc, 3); sunL.castShadow = true; var ss = W.q === 'high' ? 4096 : W.q === 'mid' ? 2048 : 1024; sunL.shadow.mapSize.set(ss, ss);
    sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.04; scene.add(sunL); scene.add(sunL.target);
    for (var i = 0; i < 8; i++) { var pl = new T.PointLight(0xffb070, 0, 16, 2); scene.add(pl); pool.push(pl); }
    for (i = 0; i < 2; i++) { var sp = new T.SpotLight(0xe8f2ff, 0, 22, 0.42, 0.5, 1.6); scene.add(sp); scene.add(sp.target); spots.push(sp); }
    initSky(); initPost(); initFx();
    footDecal = decal(0x55ff99); selDecal = decal(0x7ad0ff); overlay = new T.Group(); scene.add(overlay);
    ghostHolo = G.holoMat(); W.resize(); };

  // ---------------- céu de Marte ----------------
  function initSky() {
    skyMat = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new T.Color() }, uHor: { value: new T.Color() }, uSun: { value: new T.Color() }, uGround: { value: new T.Color() }, uDir: { value: new T.Vector3(0, 1, 0) }, uGlow: { value: 1 }, uStars: { value: 0 }, uStorm: { value: 0 }, uTime: G.U.uTime },
      vertexShader: 'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: G.NOISE + '\nvarying vec3 vD;uniform vec3 uTop,uHor,uSun,uGround,uDir;uniform float uGlow,uStars,uStorm,uTime;void main(){vec3 d=normalize(vD);float y=d.y;' +
        'float h=clamp(y*1.25+.03,0.,1.);vec3 c=mix(uHor,uTop,pow(h,.55));c=mix(c,uGround,smoothstep(.0,-.12,y));float s=max(dot(d,normalize(uDir)),0.);' +
        'c+=uSun*(smoothstep(.99965,.99985,s)*14.+pow(s,60.)*.45+pow(s,7.)*.16)*uGlow;' +
        'vec2 cp=d.xz/(max(y,0.)+.12)*1.4+vec2(uTime*.004,0.);float cl=smoothstep(.56,.86,fbm(cp*vec2(1.,3.4),vec2(1e4),5.))*smoothstep(.0,.3,y)*(1.-uStorm);c=mix(c,c*1.18+uSun*.06*uGlow,cl*.55);' +
        'vec3 sd=d*420.;vec3 ci=floor(sd);float st=step(.9965,h31(ci))*smoothstep(.0,.18,y)*smoothstep(.5,.15,length(fract(sd)-.5));c+=vec3(.9,.92,1.)*st*uStars*(.4+.8*h31(ci+3.));' +
        'float ph=smoothstep(.99992,.99995,dot(d,normalize(vec3(-.6,.45,.3))));float dm=smoothstep(.999993,.999996,dot(d,normalize(vec3(.4,.6,-.5))));c+=vec3(.75,.68,.6)*(ph*.8+dm*.6)*uStars;' +
        'gl_FragColor=vec4(c,1.);gl_FragColor=linearToOutputTexel(gl_FragColor);}' });
    var sky = new T.Mesh(new T.SphereGeometry(1500, 48, 24), skyMat); sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky); W.sky = sky;
    envScene = new T.Scene(); var es = new T.Mesh(new T.SphereGeometry(90, 32, 16), skyMat); envScene.add(es);
    W.envGround = new T.Mesh(new T.CircleGeometry(80, 32), new T.MeshBasicMaterial({ color: 0x5a3220, side: T.DoubleSide })); W.envGround.rotation.x = -Math.PI / 2; W.envGround.position.y = -3; envScene.add(W.envGround);
    pmrem = new T.PMREMGenerator(renderer); pmrem.compileCubemapShader(); }

  // ---------------- pós-processamento ----------------
  var GradeShader = { uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uNight: { value: 0 }, uStorm: { value: 0 }, uVig: { value: 0.9 }, uGrain: { value: 0.025 }, uFade: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D tDiffuse;uniform float uTime,uNight,uStorm,uVig,uGrain,uFade;varying vec2 vUv;' +
      'float hh(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}' +
      'vec3 srgb(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}' +
      'void main(){vec3 c=srgb(max(texture2D(tDiffuse,vUv).rgb,0.));float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,1.08-uNight*.25);c=mix(c,c*c*(3.-2.*c),.22);' +
      'c*=mix(vec3(1.03,1.,.95),vec3(.86,.93,1.1),uNight*.6);c=mix(c,vec3(l)*vec3(1.08,.82,.6),uStorm*.25);vec2 d=vUv-.5;c*=1.-dot(d,d)*uVig;' +
      'c+=(hh(vUv*vec2(1733.,947.)+fract(uTime*7.)*100.)-.5)*uGrain;c*=1.-uFade;gl_FragColor=vec4(c,1.);}' };
  function initPost() { var gl2 = renderer.capabilities.isWebGL2, sz = renderer.getDrawingBufferSize(new T.Vector2());
    var opt = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: gl2 ? T.HalfFloatType : T.UnsignedByteType };
    var rt = gl2 && W.q !== 'low' && T.WebGLMultisampleRenderTarget ? new T.WebGLMultisampleRenderTarget(sz.x, sz.y, opt) : new T.WebGLRenderTarget(sz.x, sz.y, opt); if (rt.isWebGLMultisampleRenderTarget) rt.samples = 4;
    composer = new T.EffectComposer(renderer, rt); composer.addPass(new T.RenderPass(scene, cam));
    bloom = new T.UnrealBloomPass(new T.Vector2(sz.x, sz.y), 0.38, 0.55, 0.86); bloom.enabled = W.q !== 'low'; composer.addPass(bloom);
    grade = new T.ShaderPass(GradeShader); composer.addPass(grade); }
  W.resize = function () { var c = renderer.domElement, w = c.clientWidth || 800, h = c.clientHeight || 600; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); } if (dust) dust.mat.uniforms.uScale.value = renderer.getDrawingBufferSize(new T.Vector2()).y / (2 * Math.tan(cam.fov * Math.PI / 360)); if (glow) glow.mat.uniforms.uScale.value = dust.mat.uniforms.uScale.value; };

  // ---------------- partículas (poeira, faíscas, vapor) ----------------
  function PSys(max, add) { var g = new T.BufferGeometry(); this.max = max; this.i = 0; this.p = new Float32Array(max * 3); this.c = new Float32Array(max * 3); this.s = new Float32Array(max); this.a = new Float32Array(max);
    this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.age = new Float32Array(max); this.s0 = new Float32Array(max); this.gr = new Float32Array(max); this.a0 = new Float32Array(max); this.dr = new Float32Array(max); this.gv = new Float32Array(max);
    g.setAttribute('position', new T.BufferAttribute(this.p, 3)); g.setAttribute('aColor', new T.BufferAttribute(this.c, 3)); g.setAttribute('aSize', new T.BufferAttribute(this.s, 1)); g.setAttribute('aAlpha', new T.BufferAttribute(this.a, 1));
    this.mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending, uniforms: { uScale: { value: 500 } },
      vertexShader: 'attribute vec3 aColor;attribute float aSize,aAlpha;uniform float uScale;varying vec3 vC;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=min(aSize*uScale/max(-mv.z,.1),256.);gl_Position=projectionMatrix*mv;vC=aColor;vA=aAlpha;}',
      fragmentShader: 'varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.05,d)*vA;if(a<.003)discard;' + (add ? 'gl_FragColor=vec4(vC*a,1.);' : 'gl_FragColor=vec4(vC,a);') + '}' });
    this.pts = new T.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts); }
  PSys.prototype.emit = function (x, y, z, vx, vy, vz, size, life, r, g, b, a, grow, drag, grav) { var i = this.i; this.i = (i + 1) % this.max;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz; this.c[i * 3] = r; this.c[i * 3 + 1] = g; this.c[i * 3 + 2] = b;
    this.life[i] = life; this.age[i] = 0; this.s0[i] = size; this.gr[i] = grow || 0; this.a0[i] = a; this.dr[i] = drag || 0; this.gv[i] = grav || 0; };
  PSys.prototype.update = function (dt) { for (var i = 0; i < this.max; i++) { if (this.age[i] >= this.life[i]) { this.a[i] = 0; continue; } this.age[i] += dt; var k = this.age[i] / this.life[i], f = Math.exp(-this.dr[i] * dt);
      this.v[i * 3] *= f; this.v[i * 3 + 1] = this.v[i * 3 + 1] * f - this.gv[i] * dt; this.v[i * 3 + 2] *= f; this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      this.s[i] = this.s0[i] + this.gr[i] * this.age[i]; this.a[i] = this.a0[i] * Math.min(1, k * 6) * (1 - k) * (1 - k); }
    var g = this.pts.geometry.attributes; g.position.needsUpdate = g.aColor.needsUpdate = g.aSize.needsUpdate = g.aAlpha.needsUpdate = true; };
  function initFx() { dust = new PSys(2600, false); glow = new PSys(600, true);
    flameMesh = new T.Mesh(new T.ConeGeometry(0.75, 6, 20, 6, true), new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: { uTime: G.U.uTime },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float uTime;varying vec2 vUv;void main(){float y=vUv.y;float f=.75+.25*sin(uTime*60.+y*30.)*sin(uTime*37.);vec3 c=mix(vec3(1.,.45,.15),vec3(1.,.9,.7),pow(y,3.));gl_FragColor=vec4(c*pow(y,1.4)*f*2.2,1.);}' }));
    flameMesh.rotation.x = Math.PI; flameMesh.visible = false; scene.add(flameMesh); }

  // ---------------- decalques no chão ----------------
  function decal(col) { var m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, uniforms: { uCol: { value: new T.Color(col) }, uTime: G.U.uTime, uAsp: { value: new T.Vector2(1, 1) }, uRing: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform vec3 uCol;uniform float uTime,uRing;uniform vec2 uAsp;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*uAsp;float a;if(uRing>.5){float r=length(vUv-.5)*2.;a=smoothstep(.62,.78,r)*(1.-smoothstep(.86,.98,r))+smoothstep(.98,.6,r)*.08;a*=.75+.25*sin(atan(vUv.y-.5,vUv.x-.5)*6.-uTime*3.);}' +
        'else{vec2 e=uAsp*.5-abs(p);float d=min(e.x,e.y);a=(1.-smoothstep(.04,.12,d))*.9+.1;float dash=step(.5,fract((p.x+p.y)*1.2-uTime*.6));a*=mix(.55,1.,dash);}gl_FragColor=vec4(uCol*1.6,a*.85);}' }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 3; scene.add(m); return m; }

  // ---------------- terreno ----------------
  function terrainMaterial() { var m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, envMapIntensity: 0.55 }); m.extensions = { derivatives: true };
    m.onBeforeCompile = function (sh) { for (var k in G.U) sh.uniforms[k] = G.U[k];
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;varying vec3 vWN;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;varying vec3 vWN;uniform sampler2D uFog;uniform sampler2D uPlay;uniform float uN,uTS;float gH=0.,gR=.95,gVis=1.;\n' + G.NOISE)
        .replace('#include <map_fragment>', [
          'vec2 q=vWP.xz/uTS;float lod=length(fwidth(q));vec4 fd=texture2D(uFog,q/uN);float ins=step(0.,q.x)*step(0.,q.y)*step(q.x,uN)*step(q.y,uN);',
          'float pl=texture2D(uPlay,q/uN).r*ins;float outA=1.-smoothstep(.3,.62,pl+(fbm(q*.35,vec2(1e4),3.)-.5)*.25);gVis=mix(.62,fd.r,ins)*(1.-outA*.55);float ice=fd.g*ins,base=fd.b*ins,trod=fd.a*ins;',
          '#define AA(f) (1.-smoothstep(.12,.45,lod*(f)))',
          'float n1=fbm(q*.085,vec2(1e4),5.),n2=fbm(q*.42+7.3,vec2(1e4),5.),n3=fbm(q*2.6+3.1,vec2(1e4),3.);',
          'float slope=1.-clamp(vWN.y,0.,1.);',
          'vec3 cDust=s2l(vec3(.70,.47,.32)),cRust=s2l(vec3(.55,.29,.17)),cDark=s2l(vec3(.30,.18,.12)),cOchre=s2l(vec3(.72,.53,.35)),cBas=s2l(vec3(.22,.16,.13));',
          'vec3 c=mix(cRust,cDust,smoothstep(.3,.72,n1));c=mix(c,cOchre,smoothstep(.55,.85,n2)*.4);c=mix(c,cDark,smoothstep(.45,.78,fbm(q*.23+11.,vec2(1e4),4.))*.45);c=mix(c,cBas*1.3,smoothstep(.62,.8,fbm(q*.6+29.,vec2(1e4),4.))*.3);',
          'float tM1=fbm(q*1.2+4.,vec2(1e4),4.);c*=.86+.28*tM1;c*=1.+(n3-.5)*.22*AA(5.);',
          'float strata=.5+.5*sin(vWP.y*4.5+n2*5.);float rk=smoothstep(.10,.32,slope+(n2-.5)*.14);c=mix(c,mix(cBas,cRust*.7,strata),rk);',
          // dunas e ondulações de vento: dão volume e sombra (bump), filtradas pela distância
          'vec2 wd=vec2(.83,.55);float dn=dot(q,wd);float dune=sin(dn*.55+n2*6.)*.5+.5;float rp=sin(dn*3.4+fbm(q*.7,vec2(1e4),3.)*9.)*AA(3.4);float rp2=sin(dn*8.+n3*6.)*AA(8.);',
          'float flt=(1.-rk)*(1.-base*.7);c*=1.-(1.-dune)*.07*flt;c*=1.+rp*.05*flt;c=mix(c,cDust*1.1,smoothstep(.4,1.,rp)*.14*flt);',
          // seixos pintados (os de perto também existem em 3D), bordas irregulares e sombra de contato
          'vec2 wq=q*2.6+vec2(fbm(q*1.3+5.,vec2(1e4),2.),fbm(q*1.3+9.,vec2(1e4),2.))*1.6;vec3 v=vor(wq,vec2(1e4));float pr=.10+.16*fract(v.y*53.1);',
          'float sh=v.x/pr+(fbm(wq*3.+v.y*20.,vec2(1e4),2.)-.5)*.5;float pk=step(v.y,.05+rk*.35)*(1.-smoothstep(.75,1.,sh))*AA(8.);float ao=step(v.y,.05+rk*.35)*smoothstep(1.6,1.,sh)*(1.-pk)*AA(8.);',
          'vec3 pc=mix(cBas*1.5,c*.75,fract(v.y*17.3))*(.85+.3*fract(v.y*91.7));c=mix(c,pc,pk*.85);c*=1.-ao*.18;',
          'float g1=fbm(q*9.+1.7,vec2(1e4),2.);c*=1.+(g1-.5)*.12*AA(18.);',
          'c=mix(vec3(dot(c,vec3(.3,.59,.11))),c,.82);',
          'c=mix(c,c*.78+cDark*.08,base*.55);c=mix(c,cDark*1.05,trod*.32);',
          'float iceM=smoothstep(.3,.62,ice+(n2-.5)*.45+(n3-.5)*.5);vec3 fv=vor(q*2.2,vec2(1e4));float frc=(1.-smoothstep(.0,.06,fv.z-fv.x))*AA(6.);c=mix(c,s2l(vec3(.84,.88,.93))*(.8+.3*n3)*(1.-frc*.35),iceM*.9);',
          'vec3 hz=mix(vec3(dot(c,vec3(.3,.59,.11))),c,.35)*vec3(.78,.7,.66);c=mix(c,hz*.5,outA*.92);float edge=smoothstep(.25,.45,pl)*(1.-smoothstep(.5,.66,pl));c=mix(c,cDust*1.15,edge*.35*(.6+.4*sin(q.x*.9+q.y*.7)));',
          'diffuseColor.rgb=c;gH=((dune*.35+rp*.06+rp2*.01)*flt+n3*.05*AA(5.)+pk*clamp(1.-sh*sh,0.,1.)*pr*1.1+(g1-.5)*.012*AA(18.)+(tM1-.5)*.08)*mix(1.,.3,base)+n2*.05;gR=mix(.96,.5,iceM)-pk*.05;'].join('\n'))
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor=gR;')
        .replace('#include <normal_fragment_maps>', 'normal=bumpN(-vViewPosition,normal,gH);')
        .replace('#include <tonemapping_fragment>', '{float l=dot(gl_FragColor.rgb,vec3(.3,.59,.11));vec3 fo=mix(vec3(l),gl_FragColor.rgb,.4)*.26;gl_FragColor.rgb=mix(fo,gl_FragColor.rgb,smoothstep(0.,1.,gVis));}\n#include <tonemapping_fragment>'); };
    m.customProgramCacheKey = function () { return 'terrain'; }; return m; }

  // ---------------- terreno em blocos ----------------
  // O mapa é dividido em blocos de 8x8. Cada bloco tem três níveis de detalhe, trocados conforme a distância
  // da câmera, poucos por quadro. O nível mais simples existe sempre: nunca aparece buraco no chão.
  var CH = 8, NC = N / CH, chunks = [], rockG = null, rockM = null, pebG = null, chunkRocks = null, frustum = new T.Frustum(), pmx = new T.Matrix4(), sph = new T.Sphere();
  var _mt = new T.Matrix4(), _qq = new T.Quaternion(), _ee = new T.Euler(), _ps = new T.Vector3(), _sc = new T.Vector3();
  function hrN(x, z, o, k) { var e = 0.2, hx = Hr(Math.min(N, x + e), z) - Hr(Math.max(0, x - e), z), hz = Hr(x, Math.min(N, z + e)) - Hr(x, Math.max(0, z - e)), sx = 2 * e * TS, nx = -hx / sx, nz = -hz / sx, l = Math.sqrt(nx * nx + 1 + nz * nz); o[k] = nx / l; o[k + 1] = 1 / l; o[k + 2] = nz / l; }
  // malha de um bloco, com normais analíticas (iguais entre vizinhos: sem costura de luz) e uma saia que esconde frestas
  function chunkGeo(cx, cz, sub) { var Rr = CH * sub, n = Rr + 3, pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), idx = [], i, j;
    for (j = 0; j < n; j++) for (i = 0; i < n; i++) { var gi = clamp(i - 1, 0, Rr), gj = clamp(j - 1, 0, Rr), x = cx * CH + gi / sub, z = cz * CH + gj / sub, sk = i === 0 || j === 0 || i === n - 1 || j === n - 1, k = (j * n + i) * 3;
      pos[k] = x * TS; pos[k + 1] = Hr(x, z) - (sk ? 0.8 : 0); pos[k + 2] = z * TS; hrN(x, z, nor, k); }
    for (j = 0; j < n - 1; j++) for (i = 0; i < n - 1; i++) { var a = j * n + i; idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1); }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setIndex(idx); g.computeBoundingSphere(); return g; }
  function instances(geo, list, mat, shadow) { var im = new T.InstancedMesh(geo, mat, list.length); im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false;
    list.forEach(function (r, j) { _ee.set(r[3] * 0.7, r[3] * 1.3, r[3] * 0.4); _qq.setFromEuler(_ee); _ps.set(r[0], Hr(r[0] / TS, r[1] / TS) + r[2] * 0.12, r[1]); _sc.set(r[2], r[2], r[2]); _mt.compose(_ps, _qq, _sc); im.setMatrixAt(j, _mt); });
    im.instanceMatrix.needsUpdate = true; scene.add(im); return im; }
  function pebbles(c, s) { if (c.peb) { scene.remove(c.peb); c.peb = null; } c.pebSig = occSig; var occ = s.rt.occ, L = [];
    for (var i = 0; i < (W.q === 'low' ? 40 : 110); i++) { var px = c.cx * CH + h2(c.i * 3.7 + i, 3.1) * CH, pz = c.cz * CH + h2(c.i * 1.9 + i, 7.7) * CH, k = Math.floor(pz) * N + Math.floor(px); if (occ[k] > 0 || map.ice[k] || map.rock[k] || Math.hypot(px - N / 2, pz - N / 2) < 4) continue; L.push([px * TS, pz * TS, 0.035 + Math.pow(h2(c.i + i, 9.3), 3.5) * 0.3, i + c.i]); }
    if (L.length) c.peb = instances(pebG[c.i % 3], L, rockM, W.q !== 'low'); }
  function setLevel(c, lvl, s) { var sub = lvl === 0 ? (W.q === 'low' ? 2 : 4) : lvl === 1 ? 2 : 1, g = chunkGeo(c.cx, c.cz, sub), v;
    if (c.terr) { c.terr.geometry.dispose(); c.terr.geometry = g; } else { c.terr = new T.Mesh(g, terrMat); c.terr.receiveShadow = true; scene.add(c.terr); }
    c.inst.forEach(function (m) { scene.remove(m); }); c.inst = []; c.lvl = lvl; if (c.peb) { scene.remove(c.peb); c.peb = null; }
    var by = {}; chunkRocks[c.i].forEach(function (r) { v = lvl === 2 ? r[4] % 2 : r[4]; (by[v] = by[v] || []).push(r); });
    for (v in by) c.inst.push(instances(rockG[lvl][v], by[v], rockM, lvl < 2)); if (lvl === 0) pebbles(c, s); }
  // carrega e descarrega detalhe em volta da câmera; `budget` blocos por quadro
  function stream(s, budget) { var cx = W.cam.x, cz = W.cam.z, near = Math.max(20, W.cam.dist * 0.6), mid = near * 2 + 12, todo = [], i, j;
    pmx.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(pmx);
    for (i = 0; i < chunks.length; i++) { var c = chunks[i], d = Math.hypot((c.cx + 0.5) * CH - cx, (c.cz + 0.5) * CH - cz), want = d < near ? 0 : d < mid ? 1 : 2;
      if (want < c.lvl) todo.push([d, c, want]); else if (want > c.lvl && d > (c.lvl === 0 ? near : mid) + 5) todo.push([d + 500, c, want]); else if (c.lvl === 0 && c.pebSig !== occSig) todo.push([d + 1000, c, -1]);
      sph.copy(c.terr.geometry.boundingSphere); sph.radius *= 1.5; var vis = frustum.intersectsSphere(sph); for (j = 0; j < c.inst.length; j++) c.inst[j].visible = vis; if (c.peb) c.peb.visible = vis; }
    todo.sort(function (a, b) { return a[0] - b[0]; }); for (i = 0; i < todo.length && i < budget; i++) { if (todo[i][2] < 0) pebbles(todo[i][1], s); else setLevel(todo[i][1], todo[i][2], s); }
    W.loading = todo.length; }
  function buildTerrain(s) { map = s.rt.map; var i, v;
    chunks.forEach(function (c) { scene.remove(c.terr); c.terr.geometry.dispose(); c.inst.forEach(function (m) { scene.remove(m); }); if (c.peb) scene.remove(c.peb); }); chunks = []; if (outer) { scene.remove(outer); outer.geometry.dispose(); }
    // textura de dados por tile: névoa, gelo, base compactada, trilhas
    fogData = new Uint8Array(N * N * 4); trod = new Float32Array(N * N); fogTex = new T.DataTexture(fogData, N, N, T.RGBAFormat); fogTex.magFilter = T.LinearFilter; fogTex.minFilter = T.LinearFilter; G.U.uFog.value = fogTex; playData = new Uint8Array(N * N * 4); playTex = new T.DataTexture(playData, N, N, T.RGBAFormat); playTex.magFilter = T.LinearFilter; playTex.minFilter = T.LinearFilter; G.U.uPlay.value = playTex;
    for (i = 0; i < N * N; i++) fogData[i * 4 + 1] = map.ice[i] ? 255 : 0;
    // textura de altura (para sujeira na base de tudo que toca o chão)
    var V = N + 1, hd = new Uint8Array(V * V * 4), mn = -10, rg = 30; for (i = 0; i < V * V; i++) { var hv = clamp((map.h[i] - mn) / rg * 256, 0, 255.99), r = Math.floor(hv); hd[i * 4] = r; hd[i * 4 + 1] = Math.round((hv - r) * 255); hd[i * 4 + 3] = 255; }
    hTex = new T.DataTexture(hd, V, V, T.RGBAFormat); hTex.needsUpdate = true; G.U.uHeight.value = hTex; G.U.uHInfo.value.set(V, mn, rg, TS);
    if (!terrMat) terrMat = terrainMaterial();
    if (!rockG) { rockM = G.rockMat(0xffffff, false); rockG = [[], [], []]; for (v = 0; v < 4; v++) { rockG[0].push(G.rockGeo(v * 7 + 1, 3)); rockG[1].push(G.rockGeo(v * 7 + 1, 2)); if (v < 2) rockG[2].push(G.rockGeo(v * 7 + 1, 1)); } pebG = [G.rockGeo(5, 1, 1.2), G.rockGeo(18, 1, 1.2), G.rockGeo(31, 1, 1.2)]; }
    chunkRocks = []; for (i = 0; i < NC * NC; i++) chunkRocks.push([]);
    map.rocks.forEach(function (rk, j) { var n = 1 + (j % 3), ci = Math.floor(rk.z / CH) * NC + Math.floor(rk.x / CH); for (var t = 0; t < n; t++) { var a = rk.r + t * 2.1, d = t ? 0.32 : 0; chunkRocks[ci].push([(rk.x + Math.cos(a) * d) * TS, (rk.z + Math.sin(a) * d) * TS, rk.s * (t ? 0.55 : 1.05) * TS * 0.55, rk.r * 3 + t, (j + t) % 4]); } });
    occSig = '';
    for (i = 0; i < NC * NC; i++) { var c = { i: i, cx: i % NC, cz: Math.floor(i / NC), lvl: -1, terr: null, inst: [], peb: null, pebSig: '' }; chunks.push(c); setLevel(c, 2, s); }
    // horizonte: montanhas e mesetas além da área jogável
    var OUT = 300, SP = 6, n = Math.round((N * TS + OUT * 2) / SP), og = new T.PlaneGeometry(N * TS + OUT * 2, N * TS + OUT * 2, n, n); og.rotateX(-Math.PI / 2); og.translate(N * TS / 2, 0, N * TS / 2); var p = og.attributes.position;
    for (i = 0; i < p.count; i++) { var x = p.getX(i) / TS, z = p.getZ(i) / TS, inside = x > 1.5 && z > 1.5 && x < N - 1.5 && z < N - 1.5; p.setY(i, inside ? Hr(x, z) - 3 : Hout(x, z)); } og.computeVertexNormals();
    outer = new T.Mesh(og, terrMat); outer.receiveShadow = true; scene.add(outer);
  }
  function updateData(s, force) { var f = s.rt.fog, ch = false, i;
    for (i = 0; i < N * N; i++) { var v = f[i] ? 255 : 0, t = Math.min(255, Math.round(trod[i])); if (fogData[i * 4] !== v || fogData[i * 4 + 3] !== t) { fogData[i * 4] = v; fogData[i * 4 + 3] = t; ch = true; } }
    var sig = s.b.map(function (b) { return b.id + ':' + b.x + ',' + b.z; }).join('|');
    if (sig !== occSig) { occSig = sig; for (i = 0; i < N * N; i++) fogData[i * 4 + 2] = 0;
      s.b.forEach(function (b) { var d = BD[b.type]; for (var z = b.z - 1; z <= b.z + d.h; z++) for (var x = b.x - 1; x <= b.x + d.w; x++) { if (x < 0 || z < 0 || x >= N || z >= N) continue; var inn = x >= b.x && x < b.x + d.w && z >= b.z && z < b.z + d.h; fogData[(z * N + x) * 4 + 2] = Math.max(fogData[(z * N + x) * 4 + 2], inn ? 255 : 140); } }); ch = true; }
    if (ch || force) fogTex.needsUpdate = true;
    if (s.rt.playDirty || force) { s.rt.playDirty = false; var P = s.rt.play; for (i = 0; i < N * N; i++) playData[i * 4] = P[i]; playTex.needsUpdate = true; } }

  function ensureRig(k, c) { var rig = c && c.veh ? MD.vehicle(c.veh) : MD.astronaut(k, Sim.cinfo(k)); rig.root.userData.kind = 'c'; rig.root.userData.id = k; rig.ph = h2(k.length * 3.3 + k.charCodeAt(k.length - 1), 1.7) * 6;
    var pk = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 2.2, 8), new T.MeshBasicMaterial({ visible: false })); pk.position.y = 1.1; rig.root.add(pk);
    rig.ring = decal(0x6dffb0); rig.ring.material.uniforms.uRing.value = 1; rig.ring.scale.set(rig.veh ? 5.5 : 1.9, rig.veh ? 5.5 : 1.9, 1); if (rig.veh) { pk.scale.set(2.5, 1.2, 2.5); }
    rig.root.traverse(function (m) { if (m.isMesh) { m.castShadow = m !== pk && !m.material.transparent; m.receiveShadow = true; } }); scene.add(rig.root); pickables.push(rig.root); cRig[k] = rig; return rig; }
  W.rebuild = function (s) { var k; for (k in bMesh) removeB(k); for (k in cRig) { scene.remove(cRig[k].root); scene.remove(cRig[k].ring); } for (k in dMesh) scene.remove(dMesh[k]); bMesh = {}; cRig = {}; dMesh = {}; pickables = []; for (var fk in foeM) scene.remove(foeM[fk].root); foeM = {}; if (relicM) { scene.remove(relicM); relicM = null; } if (roadM) { scene.remove(roadM); roadM = null; } roadSig = ''; if (arkMesh) { scene.remove(arkMesh); arkMesh = null; }
    W.cam.x = N / 2; W.cam.z = N / 2 + 1.5; cam.updateMatrixWorld(); 
    if (mapSeed !== s.seed || !chunks.length) { mapSeed = s.seed; buildTerrain(s); } else { for (var i = 0; i < N * N; i++) trod[i] = 0; occSig = ''; }
    updateData(s, true); stream(s, 80); W.lastEnvForce = true; };

  // ---------------- construções ----------------
  var EMIT = { winOn: 'winOff', ledG: 'ledOff', ledO: 'ledOff', ledR: 'ledOff', screenOn: 'ledOff', grow: 'ledOff' };
  function corridorMask(s, b) { var m = 0, dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]], occ = s.rt.occ;
    for (var i = 0; i < 4; i++) { var x = b.x + dirs[i][0], z = b.z + dirs[i][1]; if (x < 0 || z < 0 || x >= N || z >= N) continue; var id = occ[z * N + x]; if (id <= 0) continue; var o = Sim.byId(s, id); if (o && BD[o.type].press && o.type !== 'lander') m |= 1 << i; } return m; }
  function makeB(s, b) { var d = BD[b.type], opts = { lv: b.lv || 1 }; if (b.type === 'corridor') opts.mask = corridorMask(s, b);
    var g = MD.building(b.type, d, opts), cx = b.x + d.w / 2, cz = b.z + d.h / 2; g.position.set(cx * TS, Hr(cx, cz) - 0.04, cz * TS); g.userData.kind = 'b'; g.userData.id = b.id; scene.add(g); pickables.push(g);
    var o = { lv: opts.lv, g: g, mask: opts.mask, on: null, built: null, plots: [], solar: null, h: g.userData.h, base: g.position.y };
    if (b.type === 'solar') { var sm2 = g.userData.o.dyn.panel; sm2.traverse(function (m) { if (m.isMesh && m.material === G.mats.solar) { m.material = G.mats.solar.clone(); m.material.onBeforeCompile = G.mats.solar.onBeforeCompile; m.material.customProgramCacheKey = G.mats.solar.customProgramCacheKey; o.solar = m.material; } }); }
    var bc = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), new T.MeshBasicMaterial({ color: 0xff3a2a })); bc.position.y = o.h + 0.5; bc.visible = false; g.add(bc); o.beacon = bc;
    bMesh[b.id] = o; return o; }
  function removeB(id) { var o = bMesh[id]; if (!o) return; scene.remove(o.g); if (o.holo) scene.remove(o.holo); var i = pickables.indexOf(o.g); if (i >= 0) pickables.splice(i, 1); delete bMesh[id]; }
  function setBuilt(o, built) { if (o.built === built) return; o.built = built; var g = o.g;
    if (!built) { o.clip = new T.Plane(new T.Vector3(0, -1, 0), 0); o.clipH = new T.Plane(new T.Vector3(0, 1, 0), 0);
      var ud = g.userData; g.userData = {}; o.holo = g.clone(); g.userData = ud; o.holo.traverse(function (m) { if (m.isMesh) { m.material = o.holoMat || (o.holoMat = holoFor(o.clipH)); m.castShadow = false; } }); scene.add(o.holo);
      g.traverse(function (m) { if (!m.isMesh || m === o.beacon) return; m.userData.orig = m.material; var src = EMIT[m.material.userData.key] ? G.mats.ledOff : m.material, c = src.clone(); c.onBeforeCompile = src.onBeforeCompile; c.customProgramCacheKey = src.customProgramCacheKey; c.clippingPlanes = [o.clip]; m.material = c; }); }
    else { g.traverse(function (m) { if (m.isMesh && m.userData.orig) { m.material.dispose(); m.material = m.userData.orig; delete m.userData.orig; } }); if (o.holo) { scene.remove(o.holo); o.holo = null; } o.on = null; } }
  function holoFor(pl) { var h = G.holoMat(); h.clippingPlanes = [pl]; h.uniforms.uCol.value.setHex(0x6ad8ff); return h; }
  function setPower(o, on) { if (o.on === on || !o.built) return; o.on = on; var ms = o.g.userData.meshes; for (var k in EMIT) if (ms[k]) ms[k].material = on ? G.mats[k] : G.mats[EMIT[k]]; }

  // ---------------- atmosfera ----------------
  function c3(r, g, b) { return [r, g, b]; } var _c = [0, 0, 0];
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function lin(a) { return [Math.pow(a[0], 2.2), Math.pow(a[1], 2.2), Math.pow(a[2], 2.2)]; }
  function atmosphere(s) { var h = Sim.hour(s), th = Math.PI * (h - 6) / 12, el = Math.sin(th), k = s.stormK;
    sunDir.set(Math.cos(th), Math.max(el, -0.35) * 0.95, 0.42).normalize();
    var day = sm(-0.1, 0.25, el), tw = sm(-0.28, 0.02, el) * (1 - sm(0.08, 0.45, el)); W.nf = 1 - day;
    var top = mixc(c3(0.03, 0.035, 0.07), c3(0.70, 0.52, 0.36), day), hor = mixc(c3(0.06, 0.06, 0.09), c3(0.90, 0.72, 0.52), day);
    hor = mixc(hor, c3(0.52, 0.56, 0.66), tw * 0.65); top = mixc(top, c3(0.30, 0.30, 0.40), tw * 0.4);
    top = mixc(top, c3(0.55, 0.32, 0.16), k * 0.9); hor = mixc(hor, c3(0.62, 0.38, 0.2), k * 0.95); var dim = 1 - k * 0.45;
    var u = skyMat.uniforms, T1 = lin(top), H1 = lin(hor); u.uTop.value.setRGB(T1[0] * dim, T1[1] * dim, T1[2] * dim); u.uHor.value.setRGB(H1[0] * dim, H1[1] * dim, H1[2] * dim);
    var gr = lin(mixc(c3(0.05, 0.035, 0.03), c3(0.55, 0.34, 0.22), day)); u.uGround.value.setRGB(gr[0] * dim, gr[1] * dim, gr[2] * dim); u.uDir.value.copy(sunDir);
    var sc = lin(mixc(c3(0.62, 0.76, 1.0), c3(1.0, 0.88, 0.7), sm(0.1, 0.5, el))); u.uSun.value.setRGB(sc[0], sc[1], sc[2]); u.uGlow.value = sm(-0.12, 0.05, el) * (1 - k * 0.85); u.uStars.value = (1 - sm(-0.25, 0.05, el)) * (1 - k); u.uStorm.value = k;
    scene.fog.color.setRGB(H1[0] * dim, H1[1] * dim, H1[2] * dim); scene.fog.density = 0.0036 + k * 0.028;
    var li = sm(-0.02, 0.3, el) * (1 - k * 0.78); sunL.intensity = 2.2 * li; var lc = mixc(c3(1.0, 0.68, 0.52), c3(1.0, 0.93, 0.84), sm(0.05, 0.6, el)); sunL.color.setRGB(lc[0], lc[1], lc[2]);
    hemi.intensity = 0.08 + 0.12 * day; hemi.color.setRGB(0.55 + 0.45 * day, 0.62 + 0.3 * day, 0.85 - 0.05 * day);
    var tx = W.cam.x * TS, tz = W.cam.z * TS, ext = clamp(W.cam.dist * 1.15, 22, 95); var sc2 = sunL.shadow.camera; if (sc2.right !== ext) { sc2.left = -ext; sc2.right = ext; sc2.top = ext; sc2.bottom = -ext; sc2.near = 1; sc2.far = 500; sc2.updateProjectionMatrix(); }
    sunL.position.set(tx + sunDir.x * 220, Math.max(25, sunDir.y * 220), tz + sunDir.z * 220); sunL.target.position.set(tx, 0, tz); sunL.castShadow = li > 0.02;
    renderer.toneMappingExposure = 0.76 + W.nf * 0.32;
    // reflexos do ambiente: refeitos quando o céu muda o bastante
    if (W.lastEnvForce || Math.abs(h - envAt.h) > 0.4 && Math.abs(h - envAt.h) < 23.6 || Math.abs(k - envAt.k) > 0.08) { W.lastEnvForce = false; envAt.h = h; envAt.k = k;
      W.envGround.material.color.setRGB(gr[0] * 0.6 + 0.02, gr[1] * 0.6 + 0.012, gr[2] * 0.6 + 0.008); var nrt = pmrem.fromScene(envScene, 0, 0.1, 200); scene.environment = nrt.texture; if (envRT) envRT.dispose(); envRT = nrt; }
    grade.uniforms.uNight.value = W.nf; grade.uniforms.uStorm.value = k; }

  // ---------------- quadro a quadro ----------------
  var lightT = 0, dataT = 0, fxT = 0;
  W.sync = function (s, dt) { time += dt; G.U.uTime.value = time; grade.uniforms.uTime.value = time; var i, k, b, d, nf;
    dataT += dt; if (s.rt.fogDirty || s.rt.playDirty || dataT > 0.5) { updateData(s, s.rt.fogDirty); s.rt.fogDirty = false; dataT = 0; }
    atmosphere(s); nf = W.nf; var seen = {}; var GM = G.mats; GM.winOn.emissiveIntensity = 0.25 + 1.7 * nf; GM.grow.emissiveIntensity = 0.8 + 1.8 * nf; GM.screenOn.emissiveIntensity = 0.9 + 1.4 * nf;
    for (i = 0; i < s.b.length; i++) { b = s.b[i]; d = BD[b.type]; seen[b.id] = 1; var o = bMesh[b.id];
      if (o && b.type === 'corridor') { var mk = corridorMask(s, b); if (mk !== o.mask) { removeB(b.id); o = null; } }
      if (o && o.lv !== (b.lv || 1)) { removeB(b.id); o = null; }
      if (BD[b.type].floor) continue;
      if (!o) o = makeB(s, b); setBuilt(o, b.built); var u = o.g.userData.o;
      if (!b.built) { var cut = o.base + 0.05 + b.prog * (o.h + 0.1); o.clip.constant = cut; o.clipH.constant = -cut; o.holo.position.copy(o.g.position);
        for (k in s.chars) { var cc = s.chars[k]; if (cc.act && cc.act.type === 'build' && cc.act.id === b.id && cc.act.phase === 'work' && Math.random() < dt * 30) { var a = Math.random() * 6.28, rr = Math.min(d.w, d.h) * TS * 0.4; glow.emit(o.g.position.x + Math.cos(a) * rr, cut, o.g.position.z + Math.sin(a) * rr, (Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3, 0.09, 0.5 + Math.random() * 0.4, 1, 0.6, 0.25, 1, 0, 1, 6); } } }
      else setPower(o, b.on);
      o.beacon.visible = b.built && !b.on && Math.sin(time * 6) > 0; o.beacon.position.y = o.h + 0.5;
      if (b.type === 'lander') { o.g.position.y = o.base + W.landerY; flameMesh.visible = W.flame; if (W.flame) { flameMesh.position.set(o.g.position.x, o.g.position.y - 2.6, o.g.position.z); flameMesh.scale.set(1 + Math.sin(time * 40) * 0.12, 1 + Math.sin(time * 31) * 0.15, 1 + Math.cos(time * 37) * 0.12); }
        setPower(o, s.lifeSupport); o.beacon.visible = false;
        if (W.landerY > 0.1 && W.landerY < 45 && W.flame) for (var q = 0; q < 6; q++) { var an = Math.random() * 6.28, sp = 6 + Math.random() * 10; dust.emit(o.g.position.x + Math.cos(an) * 2, o.base + 0.3, o.g.position.z + Math.sin(an) * 2, Math.cos(an) * sp, 0.5 + Math.random() * 1.5, Math.sin(an) * sp, 1.2, 2.5 + Math.random() * 2, 0.62, 0.38, 0.22, 0.5 * (1 - W.landerY / 45), 2.2, 0.8, 0); } }
      if (u.dyn.ramp) u.dyn.ramp.rotation.x = -Math.PI / 2 + (0.52 + Math.PI / 2) * (W.landerRamp == null ? 1 : W.landerRamp);
      if (!b.built) continue;
      if (u.dyn.spin && b.on && !b.idle) u.dyn.spin.rotation[u.dyn.spinAxis] += dt * (u.dyn.spinAxis === 'y' ? 9 : 7);
      if (u.dyn.turret && s.foes.length) { var cbt = Sim.center(b), bf = null, bdd = 12; s.foes.forEach(function (f) { var dd = Math.hypot(f.x - cbt.x, f.z - cbt.z); if (dd < bdd) { bdd = dd; bf = f; } }); if (bf) u.dyn.turret.rotation.y = Math.atan2(bf.x - cbt.x, bf.z - cbt.z); }
      if (u.dyn.dish) { u.dyn.dish.rotation.y += dt * 0.08 * (b.on ? 1 : 0); }
      if (u.dyn.panel) { var tgy = Math.atan2(sunDir.x, sunDir.z), el = Math.asin(clamp(sunDir.y, -1, 1)), pn = u.dyn.panel; pn.rotation.order = 'YXZ'; var ty = b.on || sunDir.y > 0 ? tgy : pn.rotation.y; pn.rotation.y += (ty - pn.rotation.y) * Math.min(1, dt * 0.6); var tx2 = sunDir.y > 0.02 ? -(Math.PI / 2 - el) * 0.75 : 0; pn.rotation.x += (tx2 - pn.rotation.x) * Math.min(1, dt * 0.6);
        if (o.solar) { var du = b.dust; o.solar.color.setRGB(1 + du * 7, 1 + du * 3.6, 1 + du * 1.2); } }
      if (u.plots && b.plots) for (var p = 0; p < 4; p++) { var pl = b.plots[p], pg = u.plots[p], typ = pl && pl.crop ? pl.crop : null; if (pg.userData.t !== typ) { while (pg.children.length) pg.remove(pg.children[0]); if (typ) pg.add(MD.bed(typ)); pg.userData.t = typ; }
        if (typ) { var gr2 = 0.08 + pl.g * 0.92; pg.scale.set(gr2, gr2, 1); } }
      if (b.on && u.vent && Math.random() < dt * 3) { var vp = o.g.localToWorld(new T.Vector3(u.vent[0], u.vent[1], u.vent[2])); dust.emit(vp.x, vp.y, vp.z, 0.4 + Math.random() * 0.3, 0.7 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3, 0.5, 3.5, 0.85, 0.82, 0.8, 0.22, 0.9, 0.2, -0.05); }
      if (b.on && u.ice && Math.random() < dt * 6) { dust.emit(o.g.position.x + (Math.random() - 0.5) * 0.6, o.base + 0.3, o.g.position.z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, 0.22, 1.2, 0.9, 0.93, 0.96, 0.5, 0.5, 1, 2); }
    }
    for (k in bMesh) if (!seen[k]) removeB(k);
    // depósitos
    seen = {}; for (i = 0; i < s.deps.length; i++) { d = s.deps[i]; seen[d.id] = 1; var dm = dMesh[d.id]; if (!dm) { dm = dMesh[d.id] = MD.deposit(d.res); dm.userData.kind = 'd'; dm.userData.id = d.id; dm.position.set((d.x + 0.5) * TS, Hr(d.x + 0.5, d.z + 0.5), (d.z + 0.5) * TS); dm.rotation.y = d.id; scene.add(dm); pickables.push(dm); }
      dm.visible = !!s.rt.fog[d.z * N + d.x]; dm.scale.setScalar(TS * (0.55 + 0.45 * Math.min(1, d.left / 55))); }
    for (k in dMesh) if (!seen[k]) { scene.remove(dMesh[k]); pickables.splice(pickables.indexOf(dMesh[k]), 1); delete dMesh[k]; }
    // astronautas
    var si = 0; spots[0].intensity = 0; spots[1].intensity = 0;
    for (k in s.chars) { var c = s.chars[k], rig = cRig[k]; if (!rig) { if (!c.alive) continue; rig = ensureRig(k, c); } var m = rig.root; var show = c.alive && !W.hideChars && (c.inside == null || c.critical > 0); m.visible = show; rig.ring.visible = show && !!W.selected[k];
      if (!show) continue;
      var gy = Hr(c.x, c.z); m.position.set(c.x * TS, gy, c.z * TS); rig.ring.position.set(c.x * TS, gy + 0.06, c.z * TS);
      if (rig.veh) { var mv = rig.lx != null ? Math.hypot(c.x - rig.lx, c.z - rig.lz) : 0; rig.lx = c.x; rig.lz = c.z; rig.wheels.forEach(function (w) { w.rotation.x += mv * TS / 0.55; });
        if (c.face != null) { var dfv = c.face - m.rotation.y; while (dfv > Math.PI) dfv -= 6.283; while (dfv < -Math.PI) dfv += 6.283; m.rotation.y += dfv * Math.min(1, dt * 4); }
        var hx = Hr(c.x + Math.sin(m.rotation.y) * 1.2, c.z + Math.cos(m.rotation.y) * 1.2) - Hr(c.x - Math.sin(m.rotation.y) * 1.2, c.z - Math.cos(m.rotation.y) * 1.2); rig.body.rotation.x = -Math.atan2(hx, 4.8);
        if (mv > 0.001 && Math.random() < dt * 14) dust.emit(m.position.x - Math.sin(m.rotation.y) * 2.4, gy + 0.3, m.position.z - Math.cos(m.rotation.y) * 2.4, (Math.random() - 0.5) * 1.5, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 1.5, 0.9, 2.2, 0.62, 0.4, 0.26, 0.4, 1.2, 1.2, 0.1); continue; }
      if (c.guard && !rig.gun) { rig.gun = MD.rifle(c.guard); rig.gun.rotation.x = Math.PI / 2; rig.gun.position.set(0, -0.3, 0.06); rig.fore[0].add(rig.gun); } if (rig.gun) { rig.gun.visible = !!c.guard; if (!c.guard) { rig.fore[0].remove(rig.gun); rig.gun = null; } }
      var a2 = c.act, st = 'idle'; if (c.critical > 0) st = 'lie'; else if (a2 && a2.phase === 'go') st = c.carry ? 'carry' : 'walk'; else if (a2 && a2.phase === 'work') { st = { gather: 'mine', plant: 'crouch', harvest: 'crouch', build: 'work', repair: 'work', clean: 'work', inspect: 'work', unload: 'work', contemplate: 'look', rescue: 'crouch' }[a2.type] || 'idle'; }
      if (c.fighting && c.critical <= 0) st = c.firing ? 'aim' : 'walk';
      if (c.critical <= 0 && c.face != null) { var df = c.face - m.rotation.y; while (df > Math.PI) df -= 6.283; while (df < -Math.PI) df += 6.283; m.rotation.y += df * Math.min(1, dt * 8); }
      MD.animate(rig, st, time + rig.ph, dt, (s.stormK > 0.3 ? 0.65 : 1) * (c.weak > s.t ? 0.7 : 1)); rig.cargo.visible = !!c.carry; if (rig.pick) rig.pick.visible = st === 'mine';
      if ((st === 'walk' || st === 'carry') && Math.random() < dt * 5) dust.emit(m.position.x + (Math.random() - 0.5) * 0.3, gy + 0.08, m.position.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6, 0.25 + Math.random() * 0.3, (Math.random() - 0.5) * 0.6, 0.35, 1.4, 0.6, 0.38, 0.24, 0.35, 0.6, 1.2, 0.1);
      if (st === 'walk' || st === 'carry') { var tk = Math.floor(c.z) * N + Math.floor(c.x); trod[tk] = Math.min(255, trod[tk] + dt * 6); }
      if (nf > 0.25 && si < 2 && (W.selected[k] || c.hero)) { var sp2 = spots[si++]; sp2.intensity = 3.2 * sm(0.25, 0.6, nf); var fy = m.rotation.y; sp2.position.set(m.position.x + Math.sin(fy) * 0.25, gy + 1.75, m.position.z + Math.cos(fy) * 0.25); sp2.target.position.set(m.position.x + Math.sin(fy) * 6, gy, m.position.z + Math.cos(fy) * 6); } }
    // a Alvorada pousada na Zona de Pouso
    var pbm = s.ark.st === 2 ? bMesh[s.ark.pad] : null; if (pbm) { if (!arkMesh) { arkMesh = MD.ark(); scene.add(arkMesh); } arkMesh.visible = true; arkMesh.position.set(pbm.g.position.x, pbm.base + 0.3 + W.arkY, pbm.g.position.z); arkMesh.userData.ramp.rotation.x = (W.arkRamp == null ? 1 : W.arkRamp) * (Math.PI - 0.4);
      if (W.arkFlame) { flameMesh.visible = true; flameMesh.position.set(arkMesh.position.x, arkMesh.position.y - 2.4, arkMesh.position.z); flameMesh.scale.set(1.8 + Math.sin(time * 40) * 0.2, 1.3 + Math.sin(time * 31) * 0.15, 1.8 + Math.cos(time * 37) * 0.2);
        if (W.arkY < 50) for (var q2 = 0; q2 < 7; q2++) { var an2 = Math.random() * 6.28, sp3 = 7 + Math.random() * 11; dust.emit(arkMesh.position.x + Math.cos(an2) * 3, pbm.base + 0.5, arkMesh.position.z + Math.sin(an2) * 3, Math.cos(an2) * sp3, 0.5 + Math.random() * 1.5, Math.sin(an2) * sp3, 1.4, 2.5 + Math.random() * 2, 0.62, 0.38, 0.22, 0.5 * (1 - W.arkY / 50), 2.4, 0.8, 0); } } }
    else if (arkMesh) arkMesh.visible = false;
    stream(s, 3);
    // luzes da base: as mais próximas da câmera
    lightT -= dt; if (lightT <= 0) { lightT = 0.4; var cand = []; for (k in bMesh) { var bo = bMesh[k], bb = Sim.byId(s, +k); if (!bb || !bb.built || !(bb.on || (bb.type === 'lander' && s.lifeSupport))) continue; (bo.g.userData.o.lights || []).forEach(function (L) { var wp = bo.g.localToWorld(new T.Vector3(L[0], L[1], L[2])); cand.push({ p: wp, c: L[3] || 0xffb070, r: L[4] || 16, k: L[5] || 1, d: Math.hypot(wp.x - W.cam.x * TS, wp.z - W.cam.z * TS) - (L[4] ? 30 : 0) }); }); }
      cand.sort(function (a, b) { return a.d - b.d; }); pool.forEach(function (pl, j) { var cd = cand[j]; pl.userData.on = !!cd; if (cd) { pl.position.copy(cd.p); pl.color.setHex(cd.c); pl.distance = cd.r; pl.userData.k = cd.k; } }); }
    pool.forEach(function (pl) { pl.intensity = pl.userData.on ? (0.25 + 1.7 * nf) * (pl.userData.k || 1) : 0; });
    // poeira no ar e tempestade
    var cx = W.cam.x * TS, cz = W.cam.z * TS, R2 = W.cam.dist * 0.9;
    fxT += dt; if (fxT > 0.05) { fxT = 0; if (Math.random() < 0.5) dust.emit(cx + (Math.random() - 0.5) * R2 * 2, Hr(W.cam.x, W.cam.z) + Math.random() * 4, cz + (Math.random() - 0.5) * R2 * 2, 1.2 + Math.random(), 0.1, 0.3, 0.06, 6, 0.9, 0.7, 0.55, 0.35, 0, 0, 0);
      var sk = s.stormK; for (var j = 0; j < Math.round(sk * 26); j++) dust.emit(cx - R2 * 1.4 + Math.random() * R2 * 0.6, Hr(W.cam.x, W.cam.z) + Math.random() * 10, cz + (Math.random() - 0.5) * R2 * 2.6, 22 + Math.random() * 12, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4, 2.5 + Math.random() * 3, 2.2, 0.62, 0.36, 0.2, 0.35 * sk, 1.5, 0, 0); }
    dust.update(dt); glow.update(dt);
    cables(s);
    if (W.overlayOn && Math.floor(time * 2) !== W.ovT) { W.ovT = Math.floor(time * 2); drawOverlay(s); }
    warFx(s, dt, time); roads(s);
    // destaque da construção selecionada
    var sb = W.selB != null ? Sim.byId(s, W.selB) : null; selDecal.visible = !!sb; if (sb) { var sd = BD[sb.type]; selDecal.position.set((sb.x + sd.w / 2) * TS, Hr(sb.x + sd.w / 2, sb.z + sd.h / 2) + 0.12, (sb.z + sd.h / 2) * TS); selDecal.scale.set(sd.w * TS + 0.4, sd.h * TS + 0.4, 1); selDecal.material.uniforms.uAsp.value.set(sd.w * TS + 0.4, sd.h * TS + 0.4); }
    // câmera de estratégia
    var cs = W.cam, zb = W.zb || (W.zb = [0, 0, N, N]); if (W.zbN !== s.zones.length) { W.zbN = s.zones.length; zb = W.zb = [N, N, 0, 0]; s.zones.forEach(function (z) { var r = z.r * 1.3 + 10; zb[0] = Math.min(zb[0], z.x - r); zb[1] = Math.min(zb[1], z.z - r); zb[2] = Math.max(zb[2], z.x + r); zb[3] = Math.max(zb[3], z.z + r); }); }
    cs.x = clamp(cs.x, Math.max(2, zb[0]), Math.min(N - 2, zb[2])); cs.z = clamp(cs.z, Math.max(2, zb[1]), Math.min(N - 2, zb[3])); cs.dist = clamp(cs.dist, 7, 120); cs.pitch = clamp(cs.pitch, 0.1, 1.45);
    var ty = Hr(cs.x, cs.z) + 1, cp = Math.cos(cs.pitch), sh = W.shake > 0.001 ? W.shake : 0; W.shake *= Math.pow(0.02, dt);
    cam.position.set(cs.x * TS + Math.sin(cs.yaw) * cp * cs.dist + (Math.random() - 0.5) * sh, ty + Math.sin(cs.pitch) * cs.dist + (Math.random() - 0.5) * sh, cs.z * TS + Math.cos(cs.yaw) * cp * cs.dist);
    var gyc = (cam.position.x / TS > 0 && cam.position.x / TS < N && cam.position.z / TS > 0 && cam.position.z / TS < N ? Hr(cam.position.x / TS, cam.position.z / TS) : Hout(cam.position.x / TS, cam.position.z / TS)) + 1.2; if (cam.position.y < gyc) cam.position.y = gyc;
    cam.lookAt(cs.x * TS, ty + (cs.lookUp || 0), cs.z * TS); W.sky.position.copy(cam.position);
    composer.render(dt); };

  // cabos de energia: catenárias entre postes e o que eles alimentam (sempre visíveis, não só no modo Redes)
  var cabG = null, cabSig = '', cabMat = null;
  function cables(s) { var P = s.b.filter(function (b) { return b.type === 'poste' && b.built; }), sig = P.map(function (b) { return b.id; }).join() + '|' + s.b.filter(function (b) { return b.built; }).length, i, j;
    if (sig === cabSig) return; cabSig = sig; if (cabG) { scene.remove(cabG); cabG.geometry.dispose(); cabG = null; } if (!cabMat) cabMat = new T.LineBasicMaterial({ color: 0x17120f });
    var pts = [], R = (BD.poste.link || 30);
    function top(b) { var c = Sim.center(b); return new T.Vector3(c.x * TS, Hr(c.x, c.z) + 3.28, c.z * TS); }
    function span(p0, p1, sag) { var prev = null; for (var k = 0; k <= 18; k++) { var u = k / 18, p = new T.Vector3().lerpVectors(p0, p1, u); p.y -= sag * 4 * u * (1 - u); p.y = Math.max(p.y, Hr(p.x / TS, p.z / TS) + 0.12); if (prev) pts.push(prev, p); prev = p; } }
    var done = {};
    function link(a, b) { var key = Math.min(a.id, b.id) + '-' + Math.max(a.id, b.id); if (done[key]) return; done[key] = 1; var p0 = top(a), p1 = top(b), dx = p1.x - p0.x, dz = p1.z - p0.z, L = Math.hypot(dx, dz) || 1;
      for (var sd = -1; sd <= 1; sd += 2) { var ox = -dz / L * 0.55 * sd, oz = dx / L * 0.55 * sd; span(new T.Vector3(p0.x + ox, p0.y, p0.z + oz), new T.Vector3(p1.x + ox, p1.y, p1.z + oz), 0.035 * L); } }
    // poste com poste: cada um liga aos dois vizinhos mais próximos em direções diferentes (uma linha, sem zigue-zague)
    for (i = 0; i < P.length; i++) { var a = P[i], ca = Sim.center(a), nb = [];
      for (j = 0; j < P.length; j++) if (j !== i) { var cb = Sim.center(P[j]), d = Math.hypot(cb.x - ca.x, cb.z - ca.z); if (d <= R) nb.push({ b: P[j], d: d, ang: Math.atan2(cb.z - ca.z, cb.x - ca.x) }); }
      nb.sort(function (x, y) { return x.d - y.d; }); if (nb[0]) link(a, nb[0].b);
      for (j = 1; j < nb.length; j++) { var da = Math.abs(((nb[j].ang - nb[0].ang) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); if (da > 1.6) { link(a, nb[j].b); break; } } }
    // descida: do poste até a base de cada máquina ou painel por perto
    for (i = 0; i < P.length; i++) { var pa = P[i], cpa = Sim.center(pa), n = 0, near = [];
      s.b.forEach(function (b) { var d0 = BD[b.type]; if (b === pa || b.type === 'poste' || !b.built || !(d0.use || d0.gen || d0.cap || b.type === 'lander')) return; var cb = Sim.center(b), d = Math.hypot(cb.x - cpa.x, cb.z - cpa.z) - Math.max(d0.w, d0.h) / 2; if (d < 5) near.push({ b: b, d: d }); });
      near.sort(function (x, y) { return x.d - y.d; }); near.slice(0, 3).forEach(function (o) { var b = o.b, d0 = BD[b.type], c0 = Sim.center(b), dx = cpa.x - c0.x, dz = cpa.z - c0.z, L = Math.hypot(dx, dz) || 1, ex = c0.x + dx / L * Math.min(L, Math.max(d0.w, d0.h) * 0.5), ez = c0.z + dz / L * Math.min(L, Math.max(d0.w, d0.h) * 0.5);
        var p0 = top(pa); p0.y -= 0.15; span(p0, new T.Vector3(ex * TS, Hr(ex, ez) + 0.35, ez * TS), 0.25); }); }
    if (!pts.length) return; cabG = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), cabMat); cabG.frustumCulled = false; scene.add(cabG); }

  // ---------- Era II: criaturas, tiros, estrutura ----------
  var foeM = {}, relicM = null, tracers = [], trMat = null;
  function tracer(x0, y0, z0, x1, y1, z1, col, life) { if (!trMat) trMat = {}; var key = col; if (!trMat[key]) trMat[key] = new T.LineBasicMaterial({ color: col, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false });
    var g = new T.BufferGeometry().setFromPoints([new T.Vector3(x0, y0, z0), new T.Vector3(x1, y1, z1)]), l = new T.Line(g, trMat[key].clone()); l.userData.life = life; l.userData.max = life; scene.add(l); tracers.push(l); }
  function warFx(s, dt, time) { var k, i;
    // criaturas
    var alive = {}; s.foes.forEach(function (f) { alive[f.id] = 1; var a = foeM[f.id]; if (!a) { a = foeM[f.id] = MD.alien(f.type); scene.add(a.root); a.ph = Math.random() * 9; }
      var gy = Hr(f.x, f.z); a.root.position.set(f.x * TS, gy, f.z * TS); if (f.face != null) { var df = f.face - a.root.rotation.y; while (df > Math.PI) df -= 6.283; while (df < -Math.PI) df += 6.283; a.root.rotation.y += df * Math.min(1, dt * 6); }
      MD.animAlien(a, time + a.ph, !!f.mv || !!f.flee, !f.mv && !f.flee); if (Math.random() < dt * 2) glow.emit(a.root.position.x, gy + 0.7, a.root.position.z, 0, 0.3, 0, 0.25, 0.8, 0.2, 0.9, 0.9, 0.6, 0.5, 1, 0); });
    for (k in foeM) if (!alive[k]) { scene.remove(foeM[k].root); delete foeM[k]; }
    // efeitos que a simulação pediu
    var F = s.rt.fx || []; for (i = 0; i < F.length; i++) { var e = F[i], ex = e.x * TS, ez = e.z * TS, ey = Hr(e.x, e.z);
      if (e.k === 'shot') { var ty = Hr(e.tx, e.tz) + 0.55, sy = ey + (e.w === 'tower' ? 3.75 : 1.35); tracer(ex, sy, ez, e.tx * TS + (Math.random() - 0.5) * 0.3, ty, e.tz * TS + (Math.random() - 0.5) * 0.3, e.w === 'energy' ? 0x66e0ff : 0xffd27a, 0.07);
        glow.emit(ex, sy, ez, 0, 0, 0, 0.35, 0.06, 1, 0.8, 0.4, 1, 0, 1, 0); for (var q = 0; q < 2; q++) glow.emit(e.tx * TS, ty, e.tz * TS, (Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2, 0.12, 0.25, 0.5, 1, 0.9, 1, 0, 2, 3); }
      else if (e.k === 'spit') { tracer(ex, ey + 1.2, ez, e.tx * TS, Hr(e.tx, e.tz) + 0.8, e.tz * TS, 0xc070ff, 0.25); }
      else if (e.k === 'die') { for (q = 0; q < 26; q++) glow.emit(ex, ey + 0.5, ez, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 0.2, 0.9, 0.2, 1, 0.9, 1, 0, 1.5, 4); for (q = 0; q < 10; q++) dust.emit(ex, ey + 0.2, ez, (Math.random() - 0.5) * 2, Math.random() * 1.2, (Math.random() - 0.5) * 2, 0.8, 1.6, 0.25, 0.2, 0.22, 0.6, 1, 1.4, 0.4); }
      else if (e.k === 'claw' || e.k === 'boom') { for (q = 0; q < (e.k === 'boom' ? 30 : 4); q++) dust.emit(ex, ey + 0.4, ez, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, 0.8, 1.5, 0.6, 0.42, 0.3, 0.6, 1.2, 1.3, 0.5); } }
    if (F.length) F.length = 0;
    for (i = tracers.length - 1; i >= 0; i--) { var l = tracers[i]; l.userData.life -= dt; l.material.opacity = Math.max(0, l.userData.life / l.userData.max); if (l.userData.life <= 0) { scene.remove(l); l.geometry.dispose(); l.material.dispose(); tracers.splice(i, 1); } }
    // a estrutura
    if (s.al && s.al.site && !relicM) { relicM = MD.relic(); relicM.position.set(s.al.site.x * TS, Hr(s.al.site.x, s.al.site.z), s.al.site.z * TS); scene.add(relicM); relicM.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); }
    if (relicM) { relicM.rotation.y += dt * 0.02; if (Math.random() < dt * 6) glow.emit(relicM.position.x + (Math.random() - 0.5) * 4, relicM.position.y + Math.random() * 6, relicM.position.z + (Math.random() - 0.5) * 4, 0, 0.6, 0, 0.3, 2.5, 0.2, 0.95, 0.9, 0.8, 0.4, 1, -0.1); } }
  // ---------- estradas: uma malha só, com o visual da Era ----------
  var roadM = null, roadSig = '';
  function roads(s) { var R0 = s.rt.road; if (!R0) return; var sig = s.era + ':', i, list = [];
    for (i = 0; i < s.b.length; i++) { var b = s.b[i]; if (BD[b.type].floor && b.built) { list.push(b); sig += b.x + ',' + b.z + ';'; } } if (sig === roadSig) return; roadSig = sig;
    if (roadM) { scene.remove(roadM); roadM.traverse(function (m) { if (m.geometry) m.geometry.dispose(); }); roadM = null; } if (!list.length) return;
    var k = new G.Kit(), era = s.era, has = function (x, z) { return x >= 0 && z >= 0 && x < N && z < N && R0[z * N + x] === 2; };
    list.forEach(function (b) { var x = b.x, z = b.z, cx = (x + 0.5) * TS, cz = (z + 0.5) * TS, y = Math.max(Hr(x + 0.5, z + 0.5), Hr(x, z), Hr(x + 1, z), Hr(x, z + 1), Hr(x + 1, z + 1)) + 0.04;
      var nE = has(x + 1, z), nW = has(x - 1, z), nN = has(x, z - 1), nS = has(x, z + 1), horiz = nE || nW, vert = nN || nS;
      var surf = era >= 4 ? 'facade' : era >= 3 ? 'rubber' : era >= 2 ? 'concrete' : 'dark';
      k.add(surf, G.rbox(TS * 0.98, 0.08, TS * 0.98, 0.02), { p: [cx, y, cz] });
      if (era === 2) { k.add('dark', G.rbox(0.03, 0.09, TS * 0.98, 0.01), { p: [cx, y + 0.005, cz] }); k.add('dark', G.rbox(TS * 0.98, 0.09, 0.03, 0.01), { p: [cx, y + 0.005, cz] }); if (!nN) k.add('paint', G.rbox(TS * 0.7, 0.1, 0.06, 0.01), { p: [cx, y + 0.01, cz - TS * 0.47] }); if (!nS) k.add('paint', G.rbox(TS * 0.7, 0.1, 0.06, 0.01), { p: [cx, y + 0.01, cz + TS * 0.47] }); }
      if (era >= 3) { if (horiz && !vert) k.add(era >= 4 ? 'screenOn' : 'hull', G.rbox(TS * 0.45, 0.1, 0.06, 0.01), { p: [cx, y + 0.01, cz], uv: 'keep' }); else if (vert && !horiz) k.add(era >= 4 ? 'screenOn' : 'hull', G.rbox(0.06, 0.1, TS * 0.45, 0.01), { p: [cx, y + 0.01, cz], uv: 'keep' });
        if (!nN && !horiz) {} k.add('screenOn', G.rbox(0.08, 0.1, 0.08, 0.02), { p: [cx - TS * 0.44, y + 0.02, cz - TS * 0.44], uv: 'keep' }); }
      if (era >= 4) { if (!nN) k.add('screenOn', G.rbox(TS, 0.1, 0.04, 0.01), { p: [cx, y + 0.02, cz - TS * 0.49], uv: 'keep' }); if (!nS) k.add('screenOn', G.rbox(TS, 0.1, 0.04, 0.01), { p: [cx, y + 0.02, cz + TS * 0.49], uv: 'keep' }); if (!nE) k.add('screenOn', G.rbox(0.04, 0.1, TS, 0.01), { p: [cx + TS * 0.49, y + 0.02, cz], uv: 'keep' }); if (!nW) k.add('screenOn', G.rbox(0.04, 0.1, TS, 0.01), { p: [cx - TS * 0.49, y + 0.02, cz], uv: 'keep' }); } });
    roadM = new T.Group(); k.build(roadM, true); roadM.traverse(function (m) { if (m.isMesh) { m.receiveShadow = true; m.castShadow = false; } }); scene.add(roadM); }

  function drawOverlay(s) { while (overlay.children.length) { var ch = overlay.children[0]; overlay.remove(ch); ch.geometry.dispose(); } if (!W.overlayOn) return;
    var pe = [], pp = [], po = [], i, j; function c3v(b) { var c = Sim.center(b); return new T.Vector3(c.x * TS, Hr(c.x, c.z) + 1.4, c.z * TS); }
    for (i = 0; i < s.b.length; i++) { var b = s.b[i], d = BD[b.type]; if (!b.built) continue;
      if (b.via != null) { var best = null; for (j = 0; j < s.b.length; j++) if (s.b[j].id === b.via) best = s.b[j]; if (best) pe.push(c3v(b), c3v(best)); }
      var x0 = b.x * TS, z0 = b.z * TS, x1 = (b.x + d.w) * TS, z1 = (b.z + d.h) * TS, y = Hr(b.x + d.w / 2, b.z + d.h / 2) + 0.3, arr = !b.on ? po : d.press ? pp : null;
      if (arr) arr.push(new T.Vector3(x0, y, z0), new T.Vector3(x1, y, z0), new T.Vector3(x1, y, z0), new T.Vector3(x1, y, z1), new T.Vector3(x1, y, z1), new T.Vector3(x0, y, z1), new T.Vector3(x0, y, z1), new T.Vector3(x0, y, z0)); }
    function add(pts, col) { if (!pts.length) return; var l = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: col, depthTest: false, transparent: true })); l.renderOrder = 20; l.frustumCulled = false; overlay.add(l); }
    add(pe, 0xffd84a); add(pp, 0x5ad0ff); add(po, 0xff4030); }

  // ---------------- seleção e posicionamento ----------------
  var ray = new T.Raycaster();
  function ndc(px, py) { var r = renderer.domElement.getBoundingClientRect(); return new T.Vector2((px - r.left) / r.width * 2 - 1, -(py - r.top) / r.height * 2 + 1); }
  function groundHit() { var o = ray.ray.origin, d = ray.ray.direction, t = 0, prev = o.y - Hr(o.x / TS, o.z / TS);
    for (var i = 0; i < 900; i++) { t += 0.35 + t * 0.004; var x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, hh = y - Hr(x / TS, z / TS); if (hh <= 0) { var tt = t - (0.35 + t * 0.004) * hh / (hh - prev); return { x: (o.x + d.x * tt) / TS, z: (o.z + d.z * tt) / TS }; } prev = hh; } return null; }
  W.pick = function (px, py) { ray.setFromCamera(ndc(px, py), cam); var hits = ray.intersectObjects(pickables, true), res = null;
    for (var i = 0; i < hits.length && !res; i++) { var o = hits[i].object; while (o && !(o.userData && o.userData.kind)) o = o.parent; if (!o || !o.visible) continue; res = { kind: o.userData.kind, id: o.userData.id }; }
    var g = groundHit(); if (g) { if (!res) res = { kind: 'tile' }; res.x = g.x; res.z = g.z; } return res; };
  W.setGhost = function (type) { if (ghost) { scene.remove(ghost); ghost = null; } ghostType = type; footDecal.visible = !!type; if (!type) return;
    ghost = MD.building(type, BD[type]); ghost.traverse(function (m) { if (m.isMesh) { m.material = ghostHolo; m.castShadow = false; } }); scene.add(ghost); };
  W.moveGhost = function (x, z, ok) { if (!ghost) return; var d = BD[ghostType], cx = x + d.w / 2, cz = z + d.h / 2, y = Hr(cx, cz); ghost.position.set(cx * TS, y, cz * TS);
    ghostHolo.uniforms.uCol.value.setHex(ok ? 0x55ffb0 : 0xff5040); footDecal.material.uniforms.uCol.value.setHex(ok ? 0x55ff99 : 0xff5040); footDecal.position.set(cx * TS, y + 0.15, cz * TS); footDecal.scale.set(d.w * TS, d.h * TS, 1); footDecal.material.uniforms.uAsp.value.set(d.w * TS, d.h * TS); };
  W.screenPos = function (x, z, up) { var v = new T.Vector3(x * TS, Hr(x, z) + (up || 0), z * TS).project(cam), r = renderer.domElement.getBoundingClientRect(); return { x: (v.x + 1) / 2 * r.width, y: (1 - v.y) / 2 * r.height, vis: v.z < 1 }; };
  W.setOverlay = function (on, s) { W.overlayOn = on; W.ovT = -1; if (!on) drawOverlay(s); };
  W._stream = function (s, n) { stream(s, n); return W.loading; };
  W.setFade = function (v) { grade.uniforms.uFade.value = v; };
  return W;
})();
