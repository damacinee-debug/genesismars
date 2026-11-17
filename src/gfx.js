// ============================================================
// GFX — núcleo gráfico: texturas procedurais geradas na GPU, materiais PBR,
// poeira marciana acumulada nas superfícies e ferramentas de geometria.
// ============================================================
var Gfx = (function () {
  var T = THREE, G = { mats: {}, tex: {} };
  G.TS = 2;

  // ---------------- ruído GLSL (compartilhado) ----------------
  G.NOISE = [
    'float h21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',
    'float h31(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}',
    'float vn(vec2 p,vec2 per){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);',
    ' return mix(mix(h21(mod(i,per)),h21(mod(i+vec2(1.,0.),per)),u.x),mix(h21(mod(i+vec2(0.,1.),per)),h21(mod(i+vec2(1.,1.),per)),u.x),u.y);}',
    'float fbm(vec2 p,vec2 per,float oct){float s=0.,a=.5,n=0.;for(int i=0;i<8;i++){if(float(i)>=oct)break;s+=a*vn(p,per);n+=a;p*=2.;per*=2.;a*=.5;}return s/n;}',
    'float vn3(vec3 p){vec3 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);',
    ' float a=h31(i),b=h31(i+vec3(1.,0.,0.)),c=h31(i+vec3(0.,1.,0.)),d=h31(i+vec3(1.,1.,0.)),e=h31(i+vec3(0.,0.,1.)),g=h31(i+vec3(1.,0.,1.)),h=h31(i+vec3(0.,1.,1.)),k=h31(i+vec3(1.,1.,1.));',
    ' return mix(mix(mix(a,b,u.x),mix(c,d,u.x),u.y),mix(mix(e,g,u.x),mix(h,k,u.x),u.y),u.z);}',
    'float fbm3(vec3 p,float oct){float s=0.,a=.5,n=0.;for(int i=0;i<6;i++){if(float(i)>=oct)break;s+=a*vn3(p);n+=a;p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s/n;}',
    'vec3 vor(vec2 p,vec2 per){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.,id=0.;',
    ' for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 c=mod(i+g,per);vec2 o=vec2(h21(c),h21(c+17.31));vec2 r=g+o-f;float d=dot(r,r);',
    '  if(d<d1){d2=d1;d1=d;id=h21(c+5.7);}else if(d<d2){d2=d;}}',
    ' return vec3(sqrt(d1),id,sqrt(d2));}',
    'vec3 bumpN(vec3 sp,vec3 sn,float h){vec3 dx=dFdx(sp),dy=dFdy(sp);vec3 r1=cross(dy,sn),r2=cross(sn,dx);float det=dot(dx,r1);',
    ' vec3 gr=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);return normalize(abs(det)*sn-gr);}',
    'vec3 s2l(vec3 c){return pow(c,vec3(2.2));}'
  ].join('\n');

  // ---------------- texturas procedurais (assadas na GPU) ----------------
  // Cada superfície define surf(uv, cor, altura, rugosidade, metalicidade), periódica em uv.
  var SURF = {
    hull: { ns: 0.006, code: [
      'float row=floor(uv.y*4.);float cols=2.+floor(h21(vec2(row,3.))*3.);vec2 q=vec2(uv.x*cols,uv.y*4.);vec2 cell=floor(q),f=fract(q);',
      'float ex=min(f.x,1.-f.x)/cols,ey=min(f.y,1.-f.y)/4.;float e=min(ex,ey);float seam=1.-smoothstep(.0015,.0045,e);',
      'float rv=1.-smoothstep(.12,.22,length(vec2(fract(uv.x*96.)-.5,(ey-.008)*96.)));rv*=step(ey,.013)*step(.004,ey)*step(.5,fract(uv.x*12.));',
      'float st=smoothstep(.5,.85,fbm(vec2(uv.x*40.,uv.y*3.),vec2(40.,3.),4.));float gr=fbm(uv*16.,vec2(16.),5.);',
      'float pan=h21(cell+1.);c=vec3(.86,.85,.82)*(.93+.08*pan);c*=1.-.13*st;c*=.95+.08*gr;c=mix(c,vec3(.55,.42,.32),smoothstep(.62,.8,fbm(uv*6.+3.,vec2(6.),5.))*.25);',
      'c*=1.-.6*seam;c=mix(c,vec3(.6,.6,.62),rv);float bul=(1.-smoothstep(.0,.06,e))*.0;',
      'h=-seam+rv*.7+gr*.08+(pan-.5)*.1;r=.42+.22*st+.2*seam;m=rv*.8;'] },
    paint: { ns: 0.005, code: [
      'float n=fbm(uv*10.,vec2(10.),6.);float chip=smoothstep(.66,.70,n);float rim=smoothstep(.61,.66,n)-chip;',
      'float sc=smoothstep(.78,.86,fbm(vec2(uv.x*90.,uv.y*3.),vec2(90.,3.),3.));float gr=fbm(uv*24.,vec2(24.),4.);',
      'c=vec3(.86,.34,.08)*(.9+.15*gr);c=mix(c,vec3(.95,.86,.76),rim*.8);c=mix(c,vec3(.5,.5,.52),chip);c=mix(c,vec3(.9,.7,.55),sc*.5);',
      'h=-chip*.8+gr*.1;r=mix(.45,.32,chip)+sc*.1;m=chip*.85;'] },
    fabric: { ns: 0.004, code: [
      'float w=.5+.5*sin(uv.x*6.2832*192.)*sin(uv.y*6.2832*192.);float d1=abs(fract((uv.x+uv.y)*6.)-.5),d2=abs(fract((uv.x-uv.y)*6.)-.5);',
      'float sm=1.-smoothstep(.0,.035,min(d1,d2));float stch=sm*step(.5,fract((uv.x*3.+uv.y)*80.));float pf=min(d1,d2);',
      'float dirt=fbm(uv*8.,vec2(8.),5.);c=vec3(.82,.80,.75)*(.92+.08*w);c=mix(c,vec3(.58,.42,.30),smoothstep(.5,.8,dirt)*.45);c*=1.-.25*sm;',
      'h=w*.15+pf*1.4-sm*.6;r=.92;m=0.;'] },
    dark: { ns: 0.005, code: [
      'vec2 q=uv*vec2(2.,3.);vec2 f=fract(q);float e=min(min(f.x,1.-f.x)/2.,min(f.y,1.-f.y)/3.);float seam=1.-smoothstep(.002,.005,e);',
      'float n=fbm(uv*20.,vec2(20.),5.);float wear=smoothstep(.72,.8,fbm(uv*7.+5.,vec2(7.),5.));',
      'c=vec3(.15,.15,.16)*(.85+.3*n);c=mix(c,vec3(.42,.42,.44),wear*.6);c*=1.-.5*seam;h=-seam+n*.1;r=.42+.1*n-wear*.1;m=.65;'] },
    rubber: { ns: 0.006, code: [
      'float n=fbm(uv*30.,vec2(30.),4.);float tr=step(.5,fract(uv.y*24.+step(.5,fract(uv.x*6.))*.5));',
      'c=vec3(.13,.10,.08)*(.8+.4*n);h=tr*.4+n*.2;r=.85;m=0.;'] },
    foil: { ns: 0.01, code: [
      'vec3 v=vor(uv*14.,vec2(14.));vec3 v2=vor(uv*37.+3.,vec2(37.));float cr=v.x+v2.x*.4;',
      'c=vec3(.86,.64,.28)*(.65+.5*v.y)*(.85+.3*v2.y);h=-cr+v.y*.3;r=.22+.15*v2.y;m=1.;'] },
    solar: { ns: 0.003, code: [
      'vec2 q=uv*vec2(4.,8.);vec2 f=fract(q),ci=floor(q);float e=min(min(f.x,1.-f.x),min(f.y,1.-f.y));float gap=1.-smoothstep(.02,.035,e);',
      'float bus=1.-smoothstep(.006,.014,abs(fract(f.x*3.)-.5)/3.);float fing=1.-smoothstep(.0,.004,abs(fract(f.y*24.)-.5)/24.);',
      'vec3 v=vor(uv*vec2(120.,240.),vec2(120.,240.));c=vec3(.03,.06,.15)*(.75+.5*v.y)*(.9+.2*h21(ci));c=mix(c,vec3(.58,.6,.64),bus*.85+fing*.15);c=mix(c,vec3(.8,.8,.82),gap);',
      'h=gap*.6+bus*.2;r=.12+gap*.4;m=.55;'] },
    metal: { ns: 0.003, code: [
      'float b=fbm(vec2(uv.x*2.,uv.y*300.),vec2(2.,300.),4.);float n=fbm(uv*12.,vec2(12.),4.);float row=fract(uv.y*3.);float band=1.-smoothstep(.004,.012,min(row,1.-row));',
      'c=vec3(.66,.67,.69)*(.85+.25*b)*(.92+.12*n);c*=1.-.35*band;h=b*.2-band;r=.26+.12*n;m=1.;'] },
    bags: { ns: 0.012, code: [
      'vec2 q=vec2(uv.x*4.,uv.y*6.);q.x+=step(1.,mod(floor(q.y),2.))*.5;vec2 f=fract(q),ci=floor(q);vec2 d=(f-.5)*vec2(1.,1.25);',
      'float b=1.-dot(d,d)*2.6;float gap=1.-smoothstep(.0,.12,b);float n=fbm(uv*30.,vec2(30.),4.);',
      'c=vec3(.66,.44,.30)*(.85+.25*n)*(.9+.15*h21(ci));c*=1.-.45*gap;h=max(b,0.)*1.2+n*.15;r=.95;m=0.;'] },
    concrete: { ns: 0.006, code: [
      'float n=fbm(uv*6.,vec2(6.),6.);float g=fbm(uv*60.,vec2(60.),3.);vec2 q=fract(uv*4.);float e=min(min(q.x,1.-q.x),min(q.y,1.-q.y));float j=1.-smoothstep(.004,.01,e);',
      'vec3 cr=vor(uv*9.,vec2(9.));float crack=(1.-smoothstep(.0,.02,cr.z-cr.x))*step(.72,fbm(uv*5.+2.,vec2(5.),4.));',
      'c=vec3(.42,.38,.35)*(.8+.35*n)*(.9+.15*g);c=mix(c,vec3(.6,.38,.24),smoothstep(.55,.8,fbm(uv*4.+7.,vec2(4.),5.))*.5);c*=1.-.5*j-.5*crack;',
      'h=-j-crack+g*.2;r=.9;m=0.;'] }
  };
  var bake = { scene: null, cam: null, quad: null };
  function bakeSurf(renderer, key, size) {
    var S = SURF[key], sz = size, out = {};
    var mat = new T.ShaderMaterial({ uniforms: { uMode: { value: 0 }, uTexel: { value: 1 / sz }, uNS: { value: S.ns * sz / 2 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: 'precision highp float;\n' + G.NOISE + '\nuniform float uMode,uTexel,uNS;varying vec2 vUv;\nvoid surf(vec2 uv,out vec3 c,out float h,out float r,out float m){\n' + S.code.join('\n') + '\n}\n' +
        'void main(){vec3 c;float h,r,m;if(uMode<.5){surf(vUv,c,h,r,m);gl_FragColor=vec4(c,1.);}else if(uMode<1.5){vec3 c2;float a,b,d,u,r2,m2;float e=uTexel;' +
        'surf(fract(vUv-vec2(e,0.)),c2,a,r2,m2);surf(fract(vUv+vec2(e,0.)),c2,b,r2,m2);surf(fract(vUv-vec2(0.,e)),c2,d,r2,m2);surf(fract(vUv+vec2(0.,e)),c2,u,r2,m2);' +
        'vec3 n=normalize(vec3((a-b)*uNS,(d-u)*uNS,1.));gl_FragColor=vec4(n*.5+.5,1.);}else{surf(vUv,c,h,r,m);gl_FragColor=vec4(1.,r,m,1.);}}', depthTest: false, depthWrite: false });
    bake.quad.material = mat; var an = renderer.capabilities.getMaxAnisotropy();
    ['map', 'normal', 'orm'].forEach(function (name, mode) {
      var rt = new T.WebGLRenderTarget(sz, sz, { minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping, generateMipmaps: true, depthBuffer: false });
      rt.texture.anisotropy = Math.min(8, an); if (mode === 0) rt.texture.encoding = T.sRGBEncoding;
      mat.uniforms.uMode.value = mode; renderer.setRenderTarget(rt); renderer.render(bake.scene, bake.cam); out[name] = rt.texture; });
    renderer.setRenderTarget(null); mat.dispose(); return out;
  }

  // ---------------- poeira e sujeira (patch nos materiais) ----------------
  // Superfícies voltadas para cima acumulam pó; a parte de baixo pega barro do chão.
  G.U = { uHeight: { value: null }, uHInfo: { value: new T.Vector4(73, -10, 30, 2) }, uDustCol: { value: new T.Color(0.62, 0.36, 0.2).convertSRGBToLinear() }, uDustAmt: { value: 1 }, uTime: { value: 0 } };
  var HFUN = 'uniform sampler2D uHeight;uniform vec4 uHInfo;float th(vec2 i){vec4 t=texture2D(uHeight,(i+.5)/uHInfo.x);return uHInfo.y+(t.r*255.+t.g)/256.*uHInfo.z;}' +
    'float terrainH(vec2 xz){vec2 p=clamp(xz/uHInfo.w,vec2(0.),vec2(uHInfo.x-1.001));vec2 i=floor(p),f=fract(p);return mix(mix(th(i),th(i+vec2(1.,0.)),f.x),mix(th(i+vec2(0.,1.)),th(i+vec2(1.,1.)),f.x),f.y);}';
  var VERT_WP = '#include <worldpos_vertex>\nvec4 gwp=vec4(transformed,1.);\n#ifdef USE_INSTANCING\ngwp=instanceMatrix*gwp;\n#endif\ngwp=modelMatrix*gwp;vWP=gwp.xyz;vec3 gn=objectNormal;\n#ifdef USE_INSTANCING\ngn=mat3(instanceMatrix)*gn;\n#endif\nvWN=normalize(mat3(modelMatrix)*gn);';
  function vertPatch(sh) { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;varying vec3 vWN;').replace('#include <worldpos_vertex>', VERT_WP); }
  G.dusty = function (mat, top, low, grimeH) {
    var o = { top: top == null ? 0.55 : top, low: low == null ? 0.7 : low, gh: grimeH || 0.9 };
    mat.onBeforeCompile = function (sh) { for (var k in G.U) sh.uniforms[k] = G.U[k]; vertPatch(sh);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;varying vec3 vWN;uniform vec3 uDustCol;uniform float uDustAmt;float gDust=0.;\n' + G.NOISE + '\n' + HFUN)
        .replace('#include <color_fragment>', '#include <color_fragment>\n{float above=vWP.y-terrainH(vWP.xz);float up=clamp(vWN.y,0.,1.);float nz=fbm3(vWP*1.3,4.);float nz2=vn3(vWP*7.);' +
          'gDust=smoothstep(.45,.95,up)*smoothstep(.35,.75,nz+.15)*' + o.top.toFixed(2) + '+(1.-smoothstep(0.,' + o.gh.toFixed(2) + ',above-nz*.35))*(.5+.5*nz2)*' + o.low.toFixed(2) + ';gDust=clamp(gDust*uDustAmt,0.,.92);' +
          'diffuseColor.rgb=mix(diffuseColor.rgb,uDustCol*(.8+.4*nz2),gDust);}')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.95,gDust);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor*=1.-gDust;'); };
    mat.customProgramCacheKey = function () { return 'dusty' + o.top + o.low + o.gh; };
    return mat;
  };

  // ---------------- materiais ----------------
  function std(o) { var m = new T.MeshStandardMaterial(o); return m; }
  G.init = function (renderer, q) {
    var sz = q === 'low' ? 256 : q === 'mid' ? 512 : 1024;
    bake.scene = new T.Scene(); bake.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1); bake.quad = new T.Mesh(new T.PlaneGeometry(2, 2)); bake.quad.frustumCulled = false; bake.scene.add(bake.quad);
    var t = G.tex; for (var k in SURF) t[k] = bakeSurf(renderer, k, k === 'solar' || k === 'fabric' ? Math.max(512, sz) : sz);
    function pbr(k, o) { o = o || {}; var x = t[k]; var m = std({ map: x.map, normalMap: x.normal, roughnessMap: x.orm, metalnessMap: x.orm, roughness: 1, metalness: 1, normalScale: new T.Vector2(o.ns || 1, o.ns || 1), envMapIntensity: o.env || 1, color: o.color || 0xffffff }); return m; }
    var M = G.mats;
    M.hull = G.dusty(pbr('hull', { env: 0.9 }), 0.6, 0.75);
    M.paint = G.dusty(pbr('paint', { env: 0.9 }), 0.5, 0.75);
    M.dark = G.dusty(pbr('dark', { env: 1 }), 0.4, 0.6);
    M.metal = G.dusty(pbr('metal', { env: 1.2 }), 0.35, 0.65);
    M.foil = G.dusty(pbr('foil', { env: 1.3, ns: 1.2 }), 0.3, 0.5);
    M.solar = G.dusty(pbr('solar', { env: 1.4 }), 0.0, 0.0);
    M.bags = G.dusty(pbr('bags', { ns: 1.4 }), 0.6, 0.9);
    M.concrete = G.dusty(pbr('concrete'), 0.7, 0.7);
    M.rubber = G.dusty(pbr('rubber'), 0.3, 0.9, 0.25);
    M.fabric = G.dusty(pbr('fabric', { ns: 1.2 }), 0.25, 0.95, 0.65);
    M.armor = G.dusty(pbr('hull', { env: 0.9, ns: 0.6 }), 0.3, 0.8, 0.6);
    M.orange = G.dusty(pbr('paint', { env: 0.9 }), 0.3, 0.8, 0.6);
    M.suitDark = G.dusty(pbr('dark', { env: 0.8 }), 0.2, 0.8, 0.5);
    M.glass = std({ color: 0xbfd6e0, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.22, envMapIntensity: 2.2, depthWrite: false, side: T.DoubleSide });
    M.visor = std({ color: 0x1a1210, metalness: 1, roughness: 0.06, envMapIntensity: 2.4 });
    M.visorRim = std({ color: 0xc98a3a, metalness: 1, roughness: 0.25, envMapIntensity: 1.6 });
    M.chrome = std({ color: 0xd6d8dc, metalness: 1, roughness: 0.16, envMapIntensity: 1.5 });
    M.winOn = std({ color: 0x1a120b, emissive: 0xffb466, emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.2 });
    M.winOff = std({ color: 0x0d0f12, roughness: 0.1, metalness: 0.6, envMapIntensity: 1.5 });
    M.screenOn = std({ color: 0x06121a, emissive: 0x4ec8ff, emissiveIntensity: 2.2, roughness: 0.3 });
    M.ledG = std({ color: 0x07140a, emissive: 0x52ff8a, emissiveIntensity: 3 }); M.ledR = std({ color: 0x1a0505, emissive: 0xff3a24, emissiveIntensity: 3 }); M.ledOff = std({ color: 0x151515, roughness: 0.5 });
    M.ledO = std({ color: 0x1a0d05, emissive: 0xffa040, emissiveIntensity: 3 });
    M.grow = std({ color: 0x200a1a, emissive: 0xff5ad0, emissiveIntensity: 2.4 });
    M.soil = std({ color: 0x3a2418, roughness: 1 });
    M.leaf = std({ color: 0x4f9a3c, roughness: 0.6, side: T.DoubleSide }); M.leaf2 = std({ color: 0x7cc24a, roughness: 0.55, side: T.DoubleSide });
    M.ice = std({ color: 0xe8f2fa, roughness: 0.25, metalness: 0, envMapIntensity: 1.5 });
    M.flag = std({ color: 0xff6a1a, roughness: 0.7, side: T.DoubleSide });
    for (var n in M) M[n].userData.key = n;
  };

  // ---------------- geometria ----------------
  // Caixa com cantos arredondados de verdade (normais suaves nas quinas).
  G.rbox = function (w, h, d, r, k) { k = k || 3; r = Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)); var m = 2 * k + 1, g = new T.BoxGeometry(1, 1, 1, m, m, m);
    var p = g.attributes.position, nr = g.attributes.normal, half = [w / 2, h / 2, d / 2], v = [0, 0, 0], inn = [0, 0, 0], off = [0, 0, 0];
    function remap(c, hh) { var i = Math.round((c + 0.5) * m); if (i <= k) return -hh + r * (i / k); if (i >= m - k) return hh - r + r * ((i - (m - k)) / k); return 0; }
    for (var i = 0; i < p.count; i++) { v[0] = remap(p.getX(i), half[0]); v[1] = remap(p.getY(i), half[1]); v[2] = remap(p.getZ(i), half[2]); var L = 0;
      for (var a = 0; a < 3; a++) { inn[a] = Math.max(-(half[a] - r), Math.min(half[a] - r, v[a])); off[a] = v[a] - inn[a]; L += off[a] * off[a]; }
      L = Math.sqrt(L); if (L > 1e-6) { for (a = 0; a < 3; a++) v[a] = inn[a] + off[a] / L * r; nr.setXYZ(i, off[0] / L, off[1] / L, off[2] / L); }
      p.setXYZ(i, v[0], v[1], v[2]); }
    return g; };
  // Perfil girado: pts = [[raio, y], ...]
  G.lathe = function (pts, seg) { var mono = true, i; for (i = 1; i < pts.length; i++) if (pts[i][1] > pts[i - 1][1]) mono = false; if (mono && pts.length > 1 && pts[0][1] > pts[pts.length - 1][1]) pts = pts.slice().reverse(); return new T.LatheGeometry(pts.map(function (q) { return new T.Vector2(Math.max(0.0001, q[0]), q[1]); }), seg || 24); };
  G.capsule = function (r, len, seg) { var pts = [], i, n = 6; for (i = 0; i <= n; i++) { var a = -Math.PI / 2 + i / n * Math.PI / 2; pts.push([Math.cos(a) * r, -len / 2 + Math.sin(a) * r]); }
    for (i = 0; i <= n; i++) { a = i / n * Math.PI / 2; pts.push([Math.cos(a) * r, len / 2 + Math.sin(a) * r]); } return G.lathe(pts, seg || 14); };
  // Módulo cilíndrico deitado com tampas abauladas (eixo X)
  G.pod = function (R, L, cap, seg) { var pts = [[0.0001, -L / 2 - cap]], i, n = 8; for (i = 1; i <= n; i++) { var a = i / n * Math.PI / 2; pts.push([Math.sin(a) * R, -L / 2 - Math.cos(a) * cap]); }
    for (i = 0; i <= n; i++) { a = i / n * Math.PI / 2; pts.push([Math.cos(a) * R, L / 2 + Math.sin(a) * cap]); } var g = G.lathe(pts, seg || 28); g.rotateZ(-Math.PI / 2); return g; };
  // Tanque vertical com tampa em cúpula
  G.tank = function (R, H, seg) { var pts = [[0.0001, 0], [R * 0.96, 0], [R, 0.06]], i, n = 8, hb = H - R * 0.75; pts.push([R, hb]); for (i = 1; i <= n; i++) { var a = i / n * Math.PI / 2; pts.push([Math.cos(a) * R, hb + Math.sin(a) * R * 0.75]); } return G.lathe(pts, seg || 24); };
  G.cyl = function (rt, rb, h, seg, open) { return new T.CylinderGeometry(rt, rb, h, seg || 16, 1, !!open); };
  G.sphere = function (r, ws, hs, p0, pl, t0, tl) { return new T.SphereGeometry(r, ws || 20, hs || 14, p0, pl, t0, tl); };
  G.torus = function (R, r, rs, ts, arc) { return new T.TorusGeometry(R, r, rs || 8, ts || 32, arc); };
  G.tube = function (pts, r, seg) { var c = new T.CatmullRomCurve3(pts.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); })); c.curveType = 'catmullrom'; c.tension = 0.2; return new T.TubeGeometry(c, seg || 24, r, 8, false); };
  // Cilindro entre dois pontos
  var _a = new T.Vector3(), _b = new T.Vector3(), _q = new T.Quaternion(), _up = new T.Vector3(0, 1, 0);
  G.rod = function (a, b, r, seg) { _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]); var L = _a.distanceTo(_b), g = new T.CylinderGeometry(r, r, L, seg || 6, 1, true); var d = _b.clone().sub(_a).normalize(); _q.setFromUnitVectors(_up, d); g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(_q)); g.translate((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2); return g; };
  // Treliça vertical (torres, antenas, perfuradores)
  G.truss = function (kit, mat, h, w, lv, r, x0, z0, y0) { x0 = x0 || 0; z0 = z0 || 0; y0 = y0 || 0; var c = [[-1, -1], [1, -1], [1, 1], [-1, 1]], i, j;
    function at(i, y) { var s = w / 2 * (1 - 0.25 * y / h); return [x0 + c[i % 4][0] * s, y0 + y, z0 + c[i % 4][1] * s]; }
    for (i = 0; i < 4; i++) kit.add(mat, G.rod(at(i, 0), at(i, h), r * 1.4));
    for (j = 0; j < lv; j++) { var ya = j / lv * h, yb = (j + 1) / lv * h; for (i = 0; i < 4; i++) { kit.add(mat, G.rod(at(i, yb), at(i + 1, yb), r)); kit.add(mat, G.rod(at(i, ya), at(i + 1, yb), r * 0.8)); } } };

  // ---------------- montagem (funde peças por material = poucas chamadas de desenho) ----------------
  var _m = new T.Matrix4(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3();
  function Kit() { this.parts = {}; }
  // o = {p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz] ou número, uv:'box'|'keep', d: densidade}
  Kit.prototype.add = function (key, geo, o) { o = o || {}; var g = geo.index ? geo.toNonIndexed() : geo.clone(); if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    var p = o.p || [0, 0, 0], r = o.r || [0, 0, 0], s = o.s == null ? [1, 1, 1] : typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s;
    _e.set(r[0], r[1], r[2]); _q.setFromEuler(_e); _m.compose(_p.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2])); g.applyMatrix4(_m);
    if ((o.uv || 'box') === 'box') boxUV(g, o.d || 3);
    else if (o.uv === 'scale') { var uv = g.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.su, uv.getY(i) * o.sv); }
    (this.parts[key] = this.parts[key] || []).push(g); return this; };
  function boxUV(g, d) { var p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (var i = 0; i < p.count; i++) { var ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (ay >= ax && ay >= az) uv.setXY(i, x / d, z / d); else if (ax >= az) uv.setXY(i, z / d, y / d); else uv.setXY(i, x / d, y / d); } }
  G.merge = function (list) { var n = 0, i; for (i = 0; i < list.length; i++) n += list[i].attributes.position.count; var P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), o = 0;
    for (i = 0; i < list.length; i++) { var g = list[i]; P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); }
    var out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(P, 3)); out.setAttribute('normal', new T.BufferAttribute(N, 3)); out.setAttribute('uv', new T.BufferAttribute(U, 2)); out.computeBoundingSphere(); return out; };
  Kit.prototype.build = function (group, noShadow) { var meshes = group.userData.meshes = group.userData.meshes || {};
    for (var k in this.parts) { var mat = G.mats[k]; var m = new T.Mesh(G.merge(this.parts[k]), mat); m.castShadow = !noShadow && !mat.transparent && k !== 'glass'; m.receiveShadow = true; group.add(m); meshes[k] = m; }
    this.parts = {}; return group; };
  G.Kit = Kit;

  // Kit de traje: funde as peças de um osso em UMA malha, com cor e acabamento por vértice.
  // Um astronauta inteiro vira ~16 chamadas de desenho em vez de ~90.
  function SuitKit() { this.list = []; }
  SuitKit.prototype.add = function (geo, col, pbr, o) { o = o || {}; var g = geo.index ? geo.toNonIndexed() : geo.clone(), n = g.attributes.position.count; if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2));
    var p = o.p || [0, 0, 0], r = o.r || [0, 0, 0], s = o.s == null ? [1, 1, 1] : typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s;
    _e.set(r[0], r[1], r[2]); _q.setFromEuler(_e); _m.compose(_p.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2])); g.applyMatrix4(_m); boxUV(g, 0.22);
    var c = new Float32Array(n * 3), b = new Float32Array(n * 2); for (var i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; b[i * 2] = pbr[0]; b[i * 2 + 1] = pbr[1]; }
    g.setAttribute('color', new T.BufferAttribute(c, 3)); g.setAttribute('aPbr', new T.BufferAttribute(b, 2)); this.list.push(g); return this; };
  SuitKit.prototype.mesh = function (mat) { var L = this.list, n = 0, i; for (i = 0; i < L.length; i++) n += L[i].attributes.position.count; var A = { position: [new Float32Array(n * 3), 3], normal: [new Float32Array(n * 3), 3], uv: [new Float32Array(n * 2), 2], color: [new Float32Array(n * 3), 3], aPbr: [new Float32Array(n * 2), 2] }, o = 0;
    for (i = 0; i < L.length; i++) { for (var k in A) A[k][0].set(L[i].attributes[k].array, o * A[k][1]); o += L[i].attributes.position.count; L[i].dispose(); }
    var out = new T.BufferGeometry(); for (k in A) out.setAttribute(k, new T.BufferAttribute(A[k][0], A[k][1])); out.computeBoundingSphere(); var m = new T.Mesh(out, mat); m.castShadow = true; m.receiveShadow = true; this.list = []; return m; };
  G.SuitKit = SuitKit;
  G.lin = function (hex) { var c = new T.Color(hex).convertSRGBToLinear(); return [c.r, c.g, c.b]; };
  G.suitMat = function () { var m = new T.MeshStandardMaterial({ vertexColors: true, normalMap: G.tex.fabric.normal, normalScale: new T.Vector2(0.55, 0.55), roughness: 1, metalness: 0, envMapIntensity: 1 });
    G.dusty(m, 0.22, 0.9, 0.6); var base = m.onBeforeCompile;
    m.onBeforeCompile = function (sh) { base(sh);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aPbr;varying vec2 vPbr;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPbr=aPbr;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vPbr;').replace('#include <roughnessmap_fragment>', 'float roughnessFactor=vPbr.x;').replace('#include <metalnessmap_fragment>', 'float metalnessFactor=vPbr.y;'); };
    m.customProgramCacheKey = function () { return 'suit'; }; return m; };

  // Pedra orgânica: icosfera deformada por ruído e lascada por planos de corte.
  function hash(n) { var x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
  function n3(x, y, z, sd) { var i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    function h(a, b, c) { return hash(a * 17.1 + b * 31.7 + c * 13.3 + sd * 7.7); } var l = function (a, b, t) { return a + (b - a) * t; };
    return l(l(l(h(i, j, k), h(i + 1, j, k), fx), l(h(i, j + 1, k), h(i + 1, j + 1, k), fx), fy), l(l(h(i, j, k + 1), h(i + 1, j, k + 1), fx), l(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), fx), fy), fz); }
  G.n3 = n3; G.hash = hash;
  G.rockGeo = function (seed, detail, rough) { var g = new T.IcosahedronGeometry(1, detail == null ? 3 : detail); g = mergeVerts(g); var p = g.attributes.position, i, j, v = new T.Vector3();
    var cuts = []; for (j = 0; j < 5; j++) { var th = hash(seed + j * 3.1) * 6.283, ph = Math.acos(hash(seed + j * 7.7) * 1.6 - 0.6); cuts.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th), 0.55 + hash(seed + j) * 0.3]); }
    var sx = 0.8 + hash(seed + 11) * 0.6, sy = 0.5 + hash(seed + 12) * 0.4, sz = 0.7 + hash(seed + 13) * 0.6;
    for (i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)); var d = 1 + (n3(v.x * 1.6, v.y * 1.6, v.z * 1.6, seed) - 0.5) * 0.5 * (rough || 1) + (n3(v.x * 4, v.y * 4, v.z * 4, seed + 3) - 0.5) * 0.14; v.multiplyScalar(d);
      for (j = 0; j < cuts.length; j++) { var c = cuts[j], dd = v.x * c[0] + v.y * c[1] + v.z * c[2] - c[3]; if (dd > 0) { v.x -= c[0] * dd * 0.9; v.y -= c[1] * dd * 0.9; v.z -= c[2] * dd * 0.9; } }
      v.x *= sx; v.y *= sy; v.z *= sz; if (v.y < -0.25 * sy) v.y = -0.25 * sy + (v.y + 0.25 * sy) * 0.15; p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g; };
  function mergeVerts(g) { var p = g.attributes.position, map = {}, idx = [], pos = [], i; for (i = 0; i < p.count; i++) { var k = Math.round(p.getX(i) * 1e4) + '_' + Math.round(p.getY(i) * 1e4) + '_' + Math.round(p.getZ(i) * 1e4); if (map[k] == null) { map[k] = pos.length / 3; pos.push(p.getX(i), p.getY(i), p.getZ(i)); } idx.push(map[k]); }
    var o = new T.BufferGeometry(); o.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); o.setIndex(idx); return o; }
  G.mergeVerts = mergeVerts;

  // Material de rocha: cor e relevo procedurais no espaço do mundo, com pó por cima.
  G.rockMat = function (tint, metallic, loose) {
    var m = new T.MeshStandardMaterial({ color: tint || 0xffffff, roughness: 0.92, metalness: 0 }); m.extensions = { derivatives: true };
    m.onBeforeCompile = function (sh) { for (var k in G.U) sh.uniforms[k] = G.U[k]; vertPatch(sh);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;varying vec3 vWN;uniform vec3 uDustCol;uniform sampler2D uFog;uniform float uN,uTS;float gH=0.,gR=.9,gM=0.;\n' + G.NOISE)
        .replace('#include <map_fragment>', '{vec3 p=vWP;float n=fbm3(p*.9,5.);float n2=fbm3(p*4.,4.);float strata=sin(p.y*9.+n*6.)*.5+.5;' +
          'float n3=fbm3(p*13.,3.);vec3 fv=vor(p.xz*2.4+vec2(p.y*1.7,-p.y*1.3),vec2(1e4));float crk=(1.-smoothstep(.0,.04,fv.z-fv.x))*smoothstep(.35,.6,n2);' +
          'vec3 c=mix(vec3(.17,.12,.10),vec3(.36,.22,.15),n);c=mix(c,vec3(.18,.13,.11),strata*.35);c*=.8+.28*n2+.18*n3;c=mix(c,c*.45,crk*.6);c=mix(c,c*vec3(.85,.8,.78),fract(fv.y*7.)*.4);' +
          (metallic ? 'float ore=smoothstep(.56,.64,fbm3(p*2.2+4.,4.));float vl=1.-smoothstep(.0,.035,abs(fbm3(p*3.1+9.,4.)-.5));float vein=max(ore*.85,vl);c=mix(c,vec3(.52,.53,.57)*(.8+.4*n3),vein);float spk=step(.94,fract(n3*37.+fv.y*11.))*vein;c+=spk*.35;gM=vein*.9;gR=mix(.82,.38,vein);' : '') +
          'float up=clamp(vWN.y,0.,1.);float dust=' + (loose ? 'smoothstep(-.2,.5,up+(n2-.5)*.4)' : 'smoothstep(.6,.95,up+(n2-.5)*.5)') + ';c=mix(c,uDustCol*(.8+.3*n2)*' + (loose ? '1.15' : '1.') + ',dust*' + (loose ? '.95' : '.6') + ');gR=mix(gR,.97,dust);gM*=1.-dust;' +
          'diffuseColor.rgb*=s2l(c)*1.0;gH=n2*.06+strata*.015+n*.05+n3*.012-crk*.03;}')
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor=gR;').replace('#include <metalnessmap_fragment>', 'float metalnessFactor=gM;')
        .replace('#include <normal_fragment_maps>', 'normal=bumpN(-vViewPosition,normal,gH);')
        .replace('#include <tonemapping_fragment>', '{vec2 q=vWP.xz/uTS;float ins=step(0.,q.x)*step(0.,q.y)*step(q.x,uN)*step(q.y,uN);float vis=mix(.62,texture2D(uFog,q/uN).r,ins);float l=dot(gl_FragColor.rgb,vec3(.3,.59,.11));gl_FragColor.rgb=mix(mix(vec3(l),gl_FragColor.rgb,.4)*.26,gl_FragColor.rgb,vis);}\n#include <tonemapping_fragment>'); };
    m.customProgramCacheKey = function () { return 'rock' + (metallic ? 1 : 0) + (loose ? 1 : 0); }; return m; };

  // Holograma (fantasma de posicionamento e obra em andamento)
  G.holoMat = function () { return new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, clipping: true,
    uniforms: { uCol: { value: new T.Color(0x55ffb0) }, uTime: G.U.uTime, uA: { value: 1 } },
    vertexShader: '#include <clipping_planes_pars_vertex>\nvarying vec3 vN;varying vec3 vV;varying vec3 vW;void main(){vec4 mvPosition=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=-mvPosition.xyz;vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*mvPosition;\n#include <clipping_planes_vertex>\n}',
    fragmentShader: '#include <clipping_planes_pars_fragment>\nuniform vec3 uCol;uniform float uTime,uA;varying vec3 vN;varying vec3 vV;varying vec3 vW;void main(){\n#include <clipping_planes_fragment>\nfloat f=1.-abs(dot(normalize(vN),normalize(vV)));f=pow(f,2.);float sl=.55+.45*sin(vW.y*28.-uTime*6.);gl_FragColor=vec4(uCol*(.12+f*.9)*sl*uA,1.);}' }); };

  // Textura de decalque (insígnia e nomes), desenhada em canvas
  G.decal = function (draw, w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; };
  G.insignia = function (x, s, dark) { x.save(); x.translate(s / 2, s / 2); x.fillStyle = dark ? '#1b1c20' : '#e86a1e'; x.beginPath(); x.moveTo(0, -s * 0.42); x.lineTo(s * 0.38, s * 0.34); x.lineTo(-s * 0.38, s * 0.34); x.closePath(); x.fill();
    x.fillStyle = dark ? '#e86a1e' : '#f4efe8'; x.beginPath(); x.moveTo(0, -s * 0.2); x.lineTo(s * 0.18, s * 0.26); x.lineTo(0, s * 0.12); x.lineTo(-s * 0.18, s * 0.26); x.closePath(); x.fill(); x.restore(); };
  return G;
})();
