// ============================================================
// MODELS — construções e personagens procedurais (estilo das artes de referência:
// módulos brancos com nervuras e faixas laranja, tanques prateados, vidro geodésico).
// Origem de cada construção = centro da área ocupada, no nível do chão.
// ============================================================
var Models = (function () {
  var T = THREE, G = Gfx, TS = G.TS, M = G.mats;
  var R = Math.PI;
  function grp() { return new T.Group(); }
  function mesh(geo, mat, p, r, s, parent, noShadow) { var m = new T.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); if (s != null) { if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]); } m.castShadow = !noShadow; m.receiveShadow = true; if (parent) parent.add(m); return m; }

  // ---------- peças reutilizáveis ----------
  function window_(k, x, y, z, w, h, ry) { k.add('dark', G.rbox(w + 0.12, h + 0.12, 0.08, 0.05), { p: [x, y, z], r: [0, ry || 0, 0] }); k.add('winOn', G.rbox(w, h, 0.1, 0.04), { p: [x, y, z], r: [0, ry || 0, 0], uv: 'keep' }); }
  function band(k, mat, w, h, d, r, x, y, z) { k.add(mat, G.rbox(w, h, d, r), { p: [x, y, z] }); }
  function skid(k, w, d, y) { k.add('dark', G.rbox(w, 0.22, d, 0.06), { p: [0, (y || 0) + 0.11, 0] }); for (var i = -1; i <= 1; i += 2) for (var j = -1; j <= 1; j += 2) k.add('dark', G.cyl(0.08, 0.1, 0.25), { p: [i * (w / 2 - 0.2), 0.05, j * (d / 2 - 0.2)] }); }
  function pipe(k, pts, r, mat) { k.add(mat || 'metal', G.tube(pts, r || 0.06, 24), { uv: 'keep' }); }
  function ladder(k, x, z, y0, y1, ry) { var c = Math.cos(ry || 0), s = Math.sin(ry || 0); for (var i = -1; i <= 1; i += 2) k.add('dark', G.rod([x + c * i * 0.18, y0, z - s * i * 0.18], [x + c * i * 0.18, y1, z - s * i * 0.18], 0.025));
    for (var y = y0 + 0.2; y < y1; y += 0.3) k.add('dark', G.rod([x - c * 0.18, y, z + s * 0.18], [x + c * 0.18, y, z - s * 0.18], 0.018)); }
  function led(k, mat, x, y, z) { k.add(mat, G.sphere(0.05, 8, 6), { p: [x, y, z], uv: 'keep' }); }
  function vTank(k, x, z, R0, H, body, bandMat, y) { y = y || 0; k.add(body || 'metal', G.tank(R0, H, 28), { p: [x, y, z], uv: 'scale', su: 3, sv: 1.5 });
    var hb = H - R0 * 0.75; [0.18, 0.55, 0.85].forEach(function (f, i) { k.add(i === 1 ? (bandMat || 'paint') : 'dark', G.cyl(R0 + 0.025, R0 + 0.025, i === 1 ? 0.22 : 0.07, 28, true), { p: [x, y + hb * f, z], uv: 'scale', su: 3, sv: 0.2 }); });
    k.add('dark', G.cyl(R0 * 0.25, R0 * 0.3, 0.18, 12), { p: [x, y + H + 0.05, z] }); }
  function berm(k, w, d, z, h) { k.add('bags', G.rbox(w, h || 0.75, d, 0.18, 2), { p: [0, (h || 0.75) / 2 - 0.05, z], d: 1.4 }); }

  // ---------- construções ----------
  var B = {};
  B.lander = function (k, o) { // Módulo de pouso (Estágio 1): cápsula com quatro pernas articuladas
    k.add('hull', G.rbox(4.2, 2.2, 3.7, 0.95, 4), { p: [0, 2.75, 0], d: 2.4 });
    k.add('hull', G.rbox(3.0, 0.9, 2.6, 0.42, 3), { p: [0, 3.95, -0.1], d: 2.4 });
    band(k, 'paint', 4.26, 0.32, 3.76, 0.16, 0, 2.2, 0); band(k, 'paint', 0.34, 2.24, 3.76, 0.17, -1.2, 2.75, 0); band(k, 'paint', 0.34, 2.24, 3.76, 0.17, 1.2, 2.75, 0);
    k.add('dark', G.rbox(4.0, 0.5, 3.5, 0.25), { p: [0, 1.6, 0] });
    window_(k, 0, 3.1, 1.86, 2.0, 0.42); window_(k, 2.12, 3.0, 0.4, 0.9, 0.36, R / 2); window_(k, -2.12, 3.0, 0.4, 0.9, 0.36, -R / 2);
    k.add('foil', G.lathe([[1.5, 0], [1.3, -0.5], [0.8, -0.75], [0.0001, -0.78]], 24), { p: [0, 1.55, 0], uv: 'scale', su: 4, sv: 1 });
    k.add('dark', G.lathe([[0.35, 0], [0.42, -0.2], [0.75, -0.7], [0.72, -0.72], [0.38, -0.25], [0.3, 0]], 20), { p: [0, 0.85, 0] });
    for (var i = 0; i < 4; i++) { var sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1, hip = [sx * 1.75, 2.0, sz * 1.45], knee = [sx * 2.75, 1.55, sz * 2.35], foot = [sx * 2.95, 0.18, sz * 2.55];
      k.add('metal', G.rod(hip, knee, 0.1, 10)); k.add('dark', G.rod(knee, foot, 0.12, 10)); k.add('metal', G.rod([sx * 1.4, 1.45, sz * 1.1], [(knee[0] + foot[0]) / 2, 0.9, (knee[2] + foot[2]) / 2], 0.06, 8));
      k.add('chrome', G.rod([knee[0], 1.35, knee[2]], [foot[0], 0.55, foot[2]], 0.07, 10)); k.add('dark', G.sphere(0.17, 12, 10), { p: knee });
      k.add('dark', G.cyl(0.42, 0.5, 0.14, 20), { p: [foot[0], 0.07, foot[2]] }); k.add('paint', G.cyl(0.3, 0.3, 0.06, 16), { p: [foot[0], 0.16, foot[2]] });
      k.add('dark', G.rbox(0.36, 0.3, 0.36, 0.08), { p: [sx * 1.95, 3.3, sz * 1.62] }); }
    k.add('dark', G.rbox(1.1, 1.55, 0.12, 0.08), { p: [0, 1.95, 1.9] }); k.add('paint', G.rbox(1.3, 1.75, 0.08, 0.12), { p: [0, 1.95, 1.86] });
    var rp = grp(); rp.position.set(0, 1.2, 1.97); var rk = new G.Kit(); rk.add('metal', G.rbox(1.0, 0.06, 2.3, 0.02), { p: [0, 0, 1.15] }); for (var ri = 0; ri < 6; ri++) rk.add('dark', G.rbox(0.9, 0.03, 0.05, 0.01), { p: [0, 0.04, 0.3 + ri * 0.33] }); rk.add('paint', G.rbox(0.06, 0.1, 2.3, 0.02), { p: [0.5, 0.03, 1.15] }); rk.add('paint', G.rbox(0.06, 0.1, 2.3, 0.02), { p: [-0.5, 0.03, 1.15] }); rk.build(rp); rp.rotation.x = 0.52; o.dyn.ramp = rp; k.extra.push(rp);
    k.add('dark', G.cyl(0.35, 0.4, 0.2, 18), { p: [0.6, 4.5, -0.3] }); k.add('metal', G.rod([-0.9, 4.4, -0.6], [-0.9, 5.4, -0.6], 0.03)); led(k, 'ledR', -0.9, 5.45, -0.6);
    k.add('hull', G.lathe([[0.0001, 0], [0.4, 0.04], [0.45, 0.16], [0.42, 0.18]], 16), { p: [-0.9, 4.75, -0.6], r: [R / 2 - 0.4, 0, 0], uv: 'keep' });
    o.lights = [[0, 2.4, 3.3]]; o.flameY = 0.1; return 5.5; };

  B.habitat = function (k, o, W, D) { // Habitat inicial: módulo retangular arredondado sobre pés
    k.add('hull', G.rbox(5.2, 2.5, 3.9, 0.6, 4), { p: [0, 1.75, 0], d: 2.6 });
    band(k, 'paint', 0.34, 2.56, 3.96, 0.62, -1.75, 1.75, 0); band(k, 'paint', 0.34, 2.56, 3.96, 0.62, 1.75, 1.75, 0); band(k, 'dark', 0.16, 2.54, 3.94, 0.6, 0, 1.75, 0);
    k.add('dark', G.rbox(4.8, 0.3, 3.5, 0.1), { p: [0, 0.4, 0] }); for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j += 2) { k.add('dark', G.cyl(0.1, 0.12, 0.45), { p: [i * 2.0, 0.2, j * 1.4] }); k.add('dark', G.cyl(0.25, 0.28, 0.06, 14), { p: [i * 2.0, 0.03, j * 1.4] }); }
    window_(k, -0.85, 2.05, 1.96, 0.75, 0.5); window_(k, 0.85, 2.05, 1.96, 0.75, 0.5); window_(k, -0.85, 2.05, -1.96, 0.75, 0.5); window_(k, 0.85, 2.05, -1.96, 0.75, 0.5);
    k.add('dark', G.rbox(0.12, 1.6, 1.0, 0.06), { p: [2.62, 1.45, 0] }); k.add('paint', G.rbox(0.1, 1.85, 1.3, 0.1), { p: [2.58, 1.5, 0] }); led(k, 'ledO', 2.66, 2.5, 0);
    k.add('metal', G.rbox(0.9, 0.06, 1.0, 0.02), { p: [2.95, 0.5, 0], r: [0, 0, -0.35] });
    k.add('metal', G.rbox(1.6, 0.06, 1.1, 0.02), { p: [-1.1, 3.25, -0.6], r: [0.25, 0, 0] }); k.add('dark', G.rbox(0.7, 0.35, 0.7, 0.12), { p: [1.2, 3.1, 0.5] }); k.add('dark', G.cyl(0.22, 0.22, 0.3, 16), { p: [0.2, 3.1, -0.5] });
    k.add('metal', G.rod([1.9, 3.0, -1.2], [1.9, 4.4, -1.2], 0.03)); led(k, 'ledR', 1.9, 4.45, -1.2);
    berm(k, 5.4, 0.55, 2.62, 0.7); berm(k, 5.4, 0.55, -2.62, 0.7);
    o.lights = [[3.2, 2.0, 0], [0, 2.2, 2.8]]; return 3.4; };

  B.solar = function (k, o, W, D) { // Painel com rastreador
    k.add('dark', G.rbox(0.8, 0.25, 0.8, 0.08), { p: [0, 0.12, 0] }); k.add('metal', G.cyl(0.11, 0.14, 1.5, 12), { p: [0, 0.85, 0] }); k.add('dark', G.rbox(0.4, 0.3, 0.3, 0.08), { p: [0, 1.65, 0] });
    pipe(k, [[0.1, 1.2, 0.1], [0.4, 0.4, 0.3], [0.8, 0.05, 0.6]], 0.03, 'rubber');
    var head = grp(); head.position.y = 1.72; var dk = new G.Kit();
    dk.add('metal', G.rbox(3.7, 0.08, 2.6, 0.03), {}); dk.add('solar', G.rbox(3.6, 0.06, 2.5, 0.02), { p: [0, 0.03, 0], d: 1.25 });
    for (var i = -1; i <= 1; i++) dk.add('metal', G.rbox(0.05, 0.1, 2.6, 0.02), { p: [i * 1.2, 0.0, 0] }); dk.add('dark', G.rbox(0.3, 0.14, 1.8, 0.05), { p: [0, -0.1, 0] });
    dk.build(head); o.dyn.panel = head; k.extra.push(head); return 2.8; };

  B.battery = function (k, o) {
    k.add('dark', G.rbox(1.6, 0.2, 1.4, 0.06), { p: [0, 0.1, 0] });
    k.add('hull', G.rbox(1.3, 1.95, 1.1, 0.3, 3), { p: [0, 1.17, 0], d: 1.8 }); band(k, 'paint', 1.34, 0.22, 1.14, 0.1, 0, 1.75, 0); band(k, 'paint', 1.34, 0.12, 1.14, 0.06, 0, 0.55, 0);
    k.add('dark', G.rbox(0.8, 0.9, 0.05, 0.04), { p: [0, 1.15, 0.56] }); led(k, 'ledG', -0.25, 1.45, 0.6); led(k, 'ledG', -0.1, 1.45, 0.6); led(k, 'ledG', 0.05, 1.45, 0.6); k.add('screenOn', G.rbox(0.36, 0.2, 0.03, 0.02), { p: [0.15, 1.0, 0.6], uv: 'keep' });
    for (var i = 0; i < 6; i++) { k.add('metal', G.rbox(0.05, 1.2, 0.6, 0.02), { p: [0.68, 1.1, -0.35 + i * 0.12], r: [0, R / 2, 0] }); k.add('metal', G.rbox(0.05, 1.2, 0.6, 0.02), { p: [-0.68, 1.1, -0.35 + i * 0.12], r: [0, R / 2, 0] }); }
    pipe(k, [[0, 0.3, -0.55], [0, 0.15, -0.8], [0, 0.04, -1.0]], 0.045, 'rubber'); o.leds = true; return 2.3; };

  B.airlock = function (k, o) {
    k.add('dark', G.rbox(1.5, 0.3, 1.2, 0.08), { p: [0, 0.15, 0] });
    k.add('hull', G.pod(0.82, 0.8, 0.3, 28), { p: [0, 1.15, 0], uv: 'scale', su: 2, sv: 1 });
    k.add('dark', G.torus(0.84, 0.06, 8, 32), { p: [0.42, 1.15, 0], r: [0, R / 2, 0] }); k.add('dark', G.torus(0.84, 0.06, 8, 32), { p: [-0.42, 1.15, 0], r: [0, R / 2, 0] });
    k.add('dark', G.cyl(0.48, 0.48, 0.12, 24), { p: [0, 1.1, 0.78], r: [R / 2, 0, 0] }); k.add('paint', G.torus(0.52, 0.06, 8, 28), { p: [0, 1.1, 0.83] }); k.add('chrome', G.rbox(0.3, 0.06, 0.06, 0.02), { p: [0.18, 1.1, 0.86] });
    led(k, 'ledO', 0, 1.8, 0.62); led(k, 'ledG', 0.45, 1.6, 0.66); return 2.1; };

  // Corredor: braços só para os lados que têm módulo vizinho (mask N,E,S,W)
  B.corridor = function (k, o) { var m = o.mask || 0; if (!m) m = 10;
    k.add('hull', G.rbox(1.25, 1.25, 1.25, 0.45, 3), { p: [0, 1.0, 0], d: 1.6 }); k.add('dark', G.rbox(1.3, 0.25, 1.3, 0.1), { p: [0, 0.25, 0] });
    var dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (var i = 0; i < 4; i++) { if (!(m & (1 << i))) continue; var dx = dirs[i][0], dz = dirs[i][1], ry = dx ? 0 : R / 2;
      k.add('hull', G.cyl(0.55, 0.55, 1.0, 22, true), { p: [dx * 0.6, 1.0, dz * 0.6], r: [0, ry, R / 2], uv: 'scale', su: 2, sv: 0.5 });
      k.add('dark', G.torus(0.58, 0.05, 8, 26), { p: [dx * 0.95, 1.0, dz * 0.95], r: [0, dx ? R / 2 : 0, 0] }); k.add('dark', G.rbox(dx ? 0.3 : 0.9, 0.5, dx ? 0.9 : 0.3, 0.08), { p: [dx * 0.7, 0.25, dz * 0.7] }); }
    return 1.7; };

  B.o2ext = function (k, o) { skid(k, 3.7, 3.7);
    vTank(k, -0.75, -0.7, 0.72, 3.6, 'metal', 'paint', 0.22); vTank(k, 0.95, -1.0, 0.42, 2.4, 'hull', 'paint', 0.22); vTank(k, 0.95, -0.05, 0.42, 2.4, 'hull', 'paint', 0.22);
    k.add('hull', G.rbox(1.6, 1.15, 1.1, 0.25), { p: [0.4, 0.85, 1.15] }); band(k, 'paint', 1.64, 0.2, 1.14, 0.1, 0.4, 1.25, 1.15);
    k.add('dark', G.cyl(0.42, 0.42, 0.08, 24), { p: [-0.9, 0.95, 1.4], r: [R / 2, 0, 0] }); k.add('screenOn', G.rbox(0.4, 0.25, 0.03, 0.02), { p: [0.6, 0.95, 1.71], uv: 'keep' });
    var fan = grp(); fan.position.set(-0.9, 0.95, 1.45); var fk = new G.Kit(); for (var i = 0; i < 6; i++) fk.add('metal', G.rbox(0.1, 0.36, 0.03, 0.01), { r: [0, 0, i * R / 3], p: [0, 0, 0] }); fk.build(fan); o.dyn.spin = fan; o.dyn.spinAxis = 'z'; k.extra.push(fan);
    pipe(k, [[-0.75, 2.6, -0.1], [-0.2, 2.75, 0.1], [0.95, 2.45, -0.05]], 0.07); pipe(k, [[-0.1, 1.1, 1.0], [-0.4, 1.4, 0.2], [-0.55, 1.8, -0.1]], 0.08); pipe(k, [[0.95, 2.4, -1.0], [0.95, 2.65, -0.55], [0.95, 2.4, -0.05]], 0.05);
    ladder(k, -1.5, -0.7, 0.3, 3.4, R / 2); o.vent = [-0.75, 4.0, -0.7]; return 4.1; };

  B.o2tank = function (k, o) { k.add('dark', G.cyl(0.6, 0.7, 0.2, 20), { p: [0, 0.1, 0] });
    for (var i = 0; i < 4; i++) { var a = i * R / 2 + R / 4; k.add('dark', G.rod([Math.cos(a) * 0.55, 0.15, Math.sin(a) * 0.55], [Math.cos(a) * 0.5, 0.95, Math.sin(a) * 0.5], 0.05, 8)); }
    k.add('metal', G.sphere(0.8, 28, 20), { p: [0, 1.4, 0], uv: 'scale', su: 3, sv: 1.5 }); k.add('paint', G.torus(0.81, 0.07, 8, 36), { p: [0, 1.4, 0], r: [R / 2, 0, 0] });
    k.add('dark', G.torus(0.81, 0.03, 6, 36), { p: [0, 1.4, 0], r: [0, 0, R / 2] }); k.add('dark', G.cyl(0.12, 0.15, 0.25, 12), { p: [0, 2.25, 0] }); k.add('chrome', G.cyl(0.05, 0.05, 0.2), { p: [0.15, 2.3, 0], r: [0, 0, R / 2] }); return 2.4; };

  B.wtank = function (k, o) { k.add('dark', G.cyl(0.8, 0.85, 0.2, 24), { p: [0, 0.1, 0] }); vTank(k, 0, 0, 0.74, 2.7, 'hull', 'paint', 0.15);
    k.add('dark', G.cyl(0.12, 0.12, 0.08, 14), { p: [0, 1.1, 0.74], r: [R / 2, 0, 0] }); k.add('screenOn', G.cyl(0.09, 0.09, 0.09, 14), { p: [0, 1.1, 0.75], r: [R / 2, 0, 0], uv: 'keep' });
    pipe(k, [[0.6, 0.35, 0.4], [0.8, 0.12, 0.6], [1.0, 0.05, 0.9]], 0.05); return 3.0; };

  B.drill = function (k, o) { k.add('dark', G.rbox(1.9, 0.25, 1.9, 0.08), { p: [0, 0.13, 0] }); G.truss(k, 'dark', 4.2, 1.35, 5, 0.035, 0, 0, 0.25);
    k.add('paint', G.rbox(0.75, 0.6, 0.75, 0.15), { p: [0, 4.6, 0] }); k.add('dark', G.cyl(0.18, 0.18, 0.4, 12), { p: [0, 5.05, 0] }); led(k, 'ledO', 0.3, 4.95, 0.3);
    k.add('hull', G.rbox(0.6, 0.8, 0.45, 0.12), { p: [0.75, 0.65, -0.65] }); k.add('screenOn', G.rbox(0.3, 0.2, 0.03, 0.02), { p: [0.75, 0.8, -0.41], uv: 'keep' });
    var bit = grp(); var bk = new G.Kit(); bk.add('metal', G.cyl(0.11, 0.11, 4.1, 10), { p: [0, 2.3, 0], uv: 'keep' }); for (var i = 0; i < 6; i++) bk.add('dark', G.cyl(0.15, 0.15, 0.06, 10), { p: [0, 0.6 + i * 0.6, 0] }); bk.build(bit); o.dyn.spin = bit; o.dyn.spinAxis = 'y'; k.extra.push(bit);
    for (i = 0; i < 7; i++) { var a = i * 0.9, r0 = 0.9 + (i % 3) * 0.12; k.add('ice', G.rockGeo(i + 3, 1, 0.6), { p: [Math.cos(a) * r0, 0.06, Math.sin(a) * r0], s: [0.12 + (i % 2) * 0.06, 0.08, 0.1], uv: 'keep' }); }
    pipe(k, [[0.6, 0.6, -0.5], [0.4, 1.4, -0.3], [0.25, 3.9, 0]], 0.05, 'rubber'); o.ice = true; return 5.3; };

  B.purifier = function (k, o) { skid(k, 3.8, 1.8);
    vTank(k, -1.3, 0, 0.5, 2.1, 'metal', 'paint', 0.22); vTank(k, -0.2, 0, 0.5, 2.1, 'metal', 'paint', 0.22);
    k.add('hull', G.rbox(1.2, 1.4, 1.4, 0.25), { p: [1.15, 0.95, 0] }); band(k, 'paint', 1.24, 0.2, 1.44, 0.1, 1.15, 1.35, 0); k.add('screenOn', G.rbox(0.45, 0.3, 0.03, 0.02), { p: [1.15, 1.0, 0.72], uv: 'keep' });
    pipe(k, [[-1.3, 1.9, 0], [-0.75, 2.2, 0.1], [-0.2, 1.9, 0]], 0.06); pipe(k, [[-0.2, 0.9, 0.45], [0.3, 0.7, 0.55], [0.6, 0.8, 0.4]], 0.07); pipe(k, [[-1.3, 0.6, 0.48], [-0.8, 0.4, 0.75], [0.6, 0.45, 0.6]], 0.05, 'rubber');
    led(k, 'ledG', 1.6, 1.55, 0.72); return 2.5; };

  B.greenhouse = function (k, o, W, D) { // Estufa: abóbada de vidro com nervuras, quatro canteiros
    k.add('hull', G.rbox(5.8, 0.55, 3.8, 0.2), { p: [0, 0.27, 0] }); band(k, 'paint', 5.84, 0.12, 3.84, 0.06, 0, 0.5, 0);
    var Rg = 1.75, L = 4.6; k.add('glass', new T.CylinderGeometry(Rg, Rg, L, 32, 1, true, 0, R), { p: [0, 0.55, 0], r: [0, 0, R / 2], uv: 'keep' });
    k.add('glass', G.sphere(Rg, 24, 12, 0, R, 0, R / 2), { p: [L / 2, 0.55, 0], r: [R / 2, 0, -R / 2], s: [1, 1, 0.7], uv: 'keep' }); k.add('glass', G.sphere(Rg, 24, 12, 0, R, 0, R / 2), { p: [-L / 2, 0.55, 0], r: [R / 2, 0, R / 2], s: [1, 1, 0.7], uv: 'keep' });
    for (var i = 0; i <= 6; i++) { var x = -L / 2 + i * L / 6; k.add('metal', G.torus(Rg + 0.02, 0.055, 6, 28, R), { p: [x, 0.55, 0], r: [0, R / 2, 0] }); }
    for (i = 1; i < 6; i++) { var a = i * R / 6; k.add('metal', G.rod([-L / 2, 0.55 + Math.sin(a) * Rg, Math.cos(a) * Rg], [L / 2, 0.55 + Math.sin(a) * Rg, Math.cos(a) * Rg], 0.03)); }
    for (i = 0; i < 6; i++) { var x0 = -L / 2 + i * L / 6, x1 = x0 + L / 6; for (var j = 0; j < 6; j++) { var a0 = j * R / 6, a1 = (j + 1) * R / 6; k.add('metal', G.rod([x0, 0.55 + Math.sin(a0) * Rg, Math.cos(a0) * Rg], [x1, 0.55 + Math.sin(a1) * Rg, Math.cos(a1) * Rg], 0.018, 4)); } }
    k.add('grow', G.rbox(4.2, 0.06, 0.18, 0.03), { p: [0, 2.15, 0], uv: 'keep' });
    o.plots = []; for (i = 0; i < 4; i++) { var px = -1.65 + i * 1.1; k.add('dark', G.rbox(0.9, 0.3, 2.6, 0.06), { p: [px, 0.7, 0] }); k.add('soil', G.rbox(0.8, 0.06, 2.5, 0.03), { p: [px, 0.84, 0], uv: 'keep' }); var pg = grp(); pg.position.set(px, 0.85, 0); k.extra.push(pg); o.plots.push(pg); }
    k.add('hull', G.rbox(0.8, 1.6, 1.3, 0.25), { p: [3.05, 1.0, 0] }); k.add('paint', G.rbox(0.1, 1.3, 0.8, 0.08), { p: [3.45, 0.95, 0] });
    o.lights = [[0, 1.8, 0, 0xff6ad8]]; return 2.4; };

  B.lab = function (k, o) { k.add('hull', G.rbox(3.5, 2.0, 3.2, 0.5, 4), { p: [0, 1.35, 0], d: 2.4 }); band(k, 'paint', 3.54, 0.25, 3.24, 0.12, 0, 0.55, 0); k.add('dark', G.rbox(3.2, 0.3, 2.9, 0.1), { p: [0, 0.2, 0] });
    window_(k, -0.7, 1.55, 1.62, 0.9, 0.45); window_(k, 0.7, 1.55, 1.62, 0.9, 0.45); window_(k, 1.77, 1.5, 0.3, 0.9, 0.45, R / 2);
    k.add('dark', G.cyl(1.0, 1.05, 0.3, 28), { p: [-0.5, 2.45, -0.3] }); k.add('glass', G.sphere(0.95, 28, 14, 0, 2 * R, 0, R / 2), { p: [-0.5, 2.6, -0.3], uv: 'keep' }); k.add('metal', G.cyl(0.18, 0.25, 0.9, 14), { p: [-0.5, 2.9, -0.3], r: [0.5, 0, 0.3] });
    G.truss(k, 'dark', 1.6, 0.3, 3, 0.02, 1.2, -1.0, 2.35); k.add('metal', G.cyl(0.04, 0.04, 0.8, 6), { p: [1.2, 4.05, -1.0], r: [0, 0, R / 2] }); led(k, 'ledR', 1.2, 4.05, -1.0);
    k.add('hull', G.lathe([[0.0001, 0], [0.45, 0.06], [0.5, 0.18], [0.47, 0.2]], 18), { p: [0.8, 2.5, 0.8], r: [-0.6, 0.7, 0], uv: 'keep' });
    o.lights = [[0, 1.6, 2.2]]; return 3.7; };

  B.workshop = function (k, o) { k.add('hull', G.rbox(3.6, 2.3, 3.3, 0.45, 4), { p: [0, 1.45, 0], d: 2.4 }); k.add('dark', G.rbox(3.3, 0.35, 3.0, 0.1), { p: [0, 0.2, 0] });
    band(k, 'paint', 0.3, 2.34, 3.34, 0.45, -1.4, 1.45, 0); k.add('dark', G.rbox(2.0, 1.6, 0.1, 0.05), { p: [0.3, 1.15, 1.66] }); for (var i = 0; i < 8; i++) k.add('metal', G.rbox(1.95, 0.04, 0.12, 0.01), { p: [0.3, 0.45 + i * 0.2, 1.7] });
    k.add('paint', G.rbox(2.3, 1.85, 0.08, 0.1), { p: [0.3, 1.2, 1.63] });
    k.add('metal', G.pod(0.35, 1.3, 0.2, 18), { p: [-0.6, 2.95, -0.8], uv: 'scale', su: 2, sv: 1 }); k.add('metal', G.pod(0.35, 1.3, 0.2, 18), { p: [-0.6, 2.95, 0.0], uv: 'scale', su: 2, sv: 1 });
    k.add('dark', G.cyl(0.14, 0.18, 1.4, 12), { p: [1.2, 3.2, -1.0] }); led(k, 'ledO', 1.2, 3.95, -1.0);
    k.add('paint', G.rod([1.6, 2.55, 0.9], [2.0, 3.3, 1.1], 0.08)); k.add('paint', G.rod([2.0, 3.3, 1.1], [2.1, 2.5, 1.7], 0.07)); k.add('dark', G.sphere(0.12), { p: [2.0, 3.3, 1.1] });
    o.lights = [[0.3, 2.3, 2.3]]; o.vent = [1.2, 4.0, -1.0]; return 3.6; };

  B.storage = function (k, o) { k.add('hull', G.rbox(3.4, 1.8, 2.0, 0.45, 3), { p: [0, 1.15, -0.8], d: 2.4 }); band(k, 'paint', 3.44, 0.22, 2.04, 0.1, 0, 1.55, -0.8); k.add('dark', G.rbox(3.2, 0.3, 1.8, 0.1), { p: [0, 0.15, -0.8] });
    k.add('dark', G.rbox(1.0, 1.3, 0.1, 0.05), { p: [0, 1.0, 0.22] });
    var cr = [[-1.2, 0.85, 0.65, 'hull'], [-0.4, 0.95, 0.75, 'paint'], [0.55, 1.0, 0.7, 'hull'], [1.3, 0.85, 1.05, 'dark'], [-1.15, 0.7, 1.3, 'paint']];
    cr.forEach(function (c) { k.add(c[3], G.rbox(0.7, 0.6, 0.6, 0.08), { p: [c[0], 0.3, c[2]] }); }); k.add('hull', G.rbox(0.6, 0.5, 0.5, 0.08), { p: [-1.15, 0.85, 0.65] });
    for (var i = 0; i < 3; i++) k.add('metal', G.cyl(0.24, 0.24, 0.7, 16), { p: [1.35 - i * 0.2, 0.35, 0.2 + i * 0.05], uv: 'scale', su: 2, sv: 1 }); return 2.1; };

  function dishGeo(Rd, depth) { var pts = [], i, n = 10; for (i = 0; i <= n; i++) { var r = i / n * Rd; pts.push([r, r * r / (Rd * Rd) * depth]); } for (i = n; i >= 0; i--) { r = i / n * Rd * 0.98; pts.push([r, r * r / (Rd * Rd) * depth - 0.07]); } return G.lathe(pts, 32); }
  B.posto = function (k, o) { // Posto avançado: módulo angular com farol, mastro de sinal e painel próprio; marca a nova fronteira
    k.add('dark', G.cyl(1.9, 2.0, 0.25, 6), { p: [0, 0.12, 0] }); k.add('screenOn', G.cyl(1.95, 1.95, 0.03, 6), { p: [0, 0.26, 0], uv: 'keep' });
    vol(k, 2.0, 1.6, 1.6, -0.3, 0.25, 0.1, 0.2, { gw: 0.8, fin: true });
    bx(k, 'dark', 0.22, 4.6, 0.22, 1.1, 2.55, -0.8); for (var i = 0; i < 4; i++) bx(k, 'metal', 0.6 - i * 0.1, 0.04, 0.04, 1.1, 2.0 + i * 0.8, -0.8); bx(k, 'hull', 0.5, 0.9, 0.06, 1.1, 4.3, -0.62, [0, 0, 0]); bx(k, 'visor', 0.4, 0.75, 0.03, 1.1, 4.3, -0.58);
    k.add('dark', G.cyl(0.18, 0.24, 0.3, 6), { p: [1.1, 4.95, -0.8] }); k.add('winOn', G.cyl(0.14, 0.14, 0.18, 6), { p: [1.1, 5.18, -0.8], uv: 'keep' }); led(k, 'ledR', 1.1, 5.35, -0.8);
    k.add('solar', G.rbox(1.4, 0.04, 0.9, 0.01), { p: [-0.4, 2.15, 0.1], r: [0.35, 0.2, 0], d: 1.25 }); k.add('metal', G.rod([-1.4, 0.25, 1.2], [-1.4, 2.6, 1.2], 0.02)); k.add('flag', G.rbox(0.6, 0.38, 0.01, 0.005), { p: [-1.1, 2.4, 1.2], uv: 'keep' });
    o.lights = [[1.1, 5.1, -0.8, 0xfff1dc, 30, 1.8], [0, 1.4, 1.2]]; o.leds = true; return 5.5; };

  // ---------- Era II: defesa ----------
  B.muro = function (k, o) { bx(k, 'concrete', 1.98, 1.5, 1.98, 0, 0.75, 0); bx(k, 'dark', 2.0, 0.12, 2.0, 0, 0.06, 0); for (var i = -1; i <= 1; i += 2) bx(k, 'concrete', 0.7, 0.35, 1.98, i * 0.55, 1.67, 0); return 1.9; };
  B.bastiao = function (k, o) { for (var s = -1; s <= 1; s += 2) for (var t2 = -1; t2 <= 1; t2 += 2) bx(k, 'dark', 0.16, 2.2, 0.16, s * 0.8, 1.1, t2 * 0.8);
    bx(k, 'concrete', 1.98, 1.4, 1.98, 0, 0.7, 0); bx(k, 'metal', 2.1, 0.12, 2.1, 0, 2.25, 0); for (var i = 0; i < 4; i++) { var a = i * R / 2; bx(k, 'armor', i % 2 ? 0.08 : 2.1, 0.7, i % 2 ? 2.1 : 0.08, Math.round(Math.cos(a)) * 1.02, 2.6, Math.round(Math.sin(a)) * 1.02); }
    bx(k, 'paint', 2.12, 0.06, 0.1, 0, 2.95, 1.02); for (i = 0; i < 6; i++) bx(k, 'metal', 0.5, 0.04, 0.05, 0, 0.3 + i * 0.32, 1.03); led(k, 'ledR', 0.9, 3.05, 0.9); return 3.1; };
  B.quartel = function (k, o) { bx(k, 'dark', 5.9, 0.3, 3.9, 0, 0.15, 0); strip(k, 5.9, 'x', 0, 0.3, 1.96);
    vol(k, 5.2, 2.4, 3.2, 0, 0.3, -0.1, 0, { gw: 0.5, fin: true }); bx(k, 'armor', 5.3, 0.5, 0.15, 0, 0.6, 1.58); bx(k, 'dark', 1.6, 1.8, 0.08, -1.6, 1.25, 1.55); bx(k, 'paint', 1.7, 0.12, 0.1, -1.6, 2.2, 1.58);
    G.truss(k, 'dark', 4.2, 0.3, 5, 0.02, 2.4, -1.4, 0.3); bx(k, 'paint', 0.7, 0.45, 0.04, 2.4, 4.3, -1.25); led(k, 'ledR', 2.4, 4.6, -1.4);
    for (var i = 0; i < 3; i++) bx(k, 'armor', 0.8, 0.5, 0.5, -2.2 + i * 0.9, 0.55, 2.4); o.lights = [[0, 2.6, 2.2, 0xffd8a8]]; return 4.6; };
  B.arsenal = function (k, o) { bx(k, 'dark', 3.9, 0.3, 3.9, 0, 0.15, 0); bx(k, 'armor', 3.4, 2.2, 3.2, 0, 1.4, -0.1); bx(k, 'dark', 3.5, 0.12, 3.3, 0, 2.55, -0.1);
    bx(k, 'dark', 2.0, 1.6, 0.06, 0.3, 1.1, 1.52); for (var i = 0; i < 8; i++) bx(k, 'metal', 1.95, 0.03, 0.08, 0.3, 0.4 + i * 0.19, 1.55); bx(k, 'paint', 0.15, 2.2, 0.2, -1.6, 1.4, 1.45); strip(k, 2.0, 'x', 0.3, 1.95, 1.56);
    bx(k, 'paint', 1.0, 0.6, 0.8, -0.9, 2.9, -0.6); bx(k, 'metal', 0.3, 0.9, 0.3, 1.1, 3.0, -0.9); led(k, 'ledO', 1.1, 3.5, -0.9); o.lights = [[0.3, 2.2, 2.0]]; return 3.6; };
  B.garagem = function (k, o) { bx(k, 'dark', 5.9, 0.25, 5.9, 0, 0.12, 0); strip(k, 5.9, 'x', 0, 0.25, 2.96);
    bx(k, 'hull', 5.4, 2.8, 4.6, 0, 1.65, -0.5); bx(k, 'metal', 5.6, 0.15, 4.8, 0, 3.1, -0.5); for (var i = -1; i <= 1; i += 2) { bx(k, 'dark', 2.2, 2.2, 0.08, i * 1.3, 1.35, 1.82); for (var j = 0; j < 9; j++) bx(k, 'metal', 2.15, 0.03, 0.1, i * 1.3, 0.35 + j * 0.24, 1.86); strip(k, 2.2, 'x', i * 1.3, 2.55, 1.86); }
    bx(k, 'paint', 0.2, 2.8, 0.25, 0, 1.65, 1.8); k.add('solar', G.rbox(2.4, 0.05, 1.6, 0.01), { p: [-1.2, 3.4, -1.3], r: [0.3, 0, 0], d: 1.25 }); bx(k, 'concrete', 5.6, 0.04, 1.2, 0, 0.27, 2.4);
    for (i = 0; i < 4; i++) bx(k, 'paint', 0.5, 0.03, 0.12, -2 + i * 1.3, 0.3, 2.4); o.lights = [[-1.3, 2.7, 2.4], [1.3, 2.7, 2.4]]; return 3.6; };
  B.torreta = function (k, o) { bx(k, 'dark', 1.8, 0.4, 1.8, 0, 0.2, 0); k.add('armor', G.cyl(0.6, 0.8, 1.2, 8), { p: [0, 1.0, 0] }); strip(k, 1.2, 'x', 0, 0.5, 0.82);
    var tur = grp(); tur.position.y = 1.85; var tk = new G.Kit(); tk.add('armor', G.rbox(1.3, 0.6, 1.2, 0.05), {}); tk.add('paint', G.rbox(1.32, 0.08, 1.22, 0.02), { p: [0, 0.25, 0] }); tk.add('facade', G.rbox(0.5, 0.15, 0.04, 0.01), { p: [0, 0.12, 0.61], uv: 'keep' });
    for (var s = -1; s <= 1; s += 2) { tk.add('dark', G.cyl(0.08, 0.1, 1.6, 10), { p: [s * 0.25, 0.0, 1.3], r: [R / 2, 0, 0] }); tk.add('dark', G.cyl(0.12, 0.12, 0.25, 10), { p: [s * 0.25, 0.0, 2.05], r: [R / 2, 0, 0] }); }
    tk.build(tur); o.dyn.turret = tur; k.extra.push(tur); led(k, 'ledR', 0.5, 2.25, -0.5); return 2.4; };
  B.fabrica = function (k, o) { bx(k, 'dark', 5.9, 0.3, 5.9, 0, 0.15, 0); strip(k, 5.9, 'x', 0, 0.3, 2.96);
    bx(k, 'armor', 5.4, 3.6, 4.6, 0, 2.1, -0.5); bx(k, 'metal', 5.6, 0.15, 4.8, 0, 3.95, -0.5); for (var i = 0; i < 4; i++) { bx(k, 'hull', 1.3, 0.06, 4.6, -2 + i * 1.35, 4.35, -0.5, [0, 0, 0.5]); bx(k, 'facade', 0.04, 0.6, 4.4, -1.6 + i * 1.35, 4.3, -0.5); }
    bx(k, 'dark', 3.6, 3.0, 0.08, 0, 1.8, 1.82); for (i = 0; i < 12; i++) bx(k, 'metal', 3.55, 0.03, 0.1, 0, 0.4 + i * 0.25, 1.86); strip(k, 3.6, 'x', 0, 3.35, 1.86, 'paint'); bx(k, 'paint', 0.2, 3.6, 0.25, -2.7, 2.1, 1.8); bx(k, 'paint', 0.2, 3.6, 0.25, 2.7, 2.1, 1.8);
    bx(k, 'dark', 0.8, 5.4, 0.8, 2.3, 2.7, -2.4); strip(k, 5, 'y', 2.71, 2.8, -2.0); bx(k, 'concrete', 5.6, 0.04, 1.2, 0, 0.32, 2.4); for (i = 0; i < 5; i++) bx(k, 'paint', 0.6, 0.03, 0.15, -2.2 + i * 1.1, 0.35, 2.4);
    o.lights = [[0, 3.2, 2.4, 0xffd8a8], [2.3, 5.5, -2.4]]; o.vent = [2.3, 5.6, -2.4]; return 5.6; };
  B.domo = function (k, o) { bx(k, 'dark', 3.8, 0.35, 3.8, 0, 0.17, 0); k.add('armor', G.cyl(1.2, 1.5, 1.0, 8), { p: [0, 0.85, 0] }); k.add('dark', G.cyl(0.5, 0.7, 1.6, 8), { p: [0, 2.1, 0] });
    k.add('screenOn', G.sphere(0.55, 16, 10), { p: [0, 3.2, 0], uv: 'keep' }); for (var i = 0; i < 4; i++) { var a = i * R / 2 + R / 4; k.add('metal', G.rod([Math.cos(a) * 1.4, 0.4, Math.sin(a) * 1.4], [Math.cos(a) * 0.5, 3.0, Math.sin(a) * 0.5], 0.06, 6)); }
    var sh = new T.Mesh(new T.SphereGeometry(14 * TS * 0.98, 40, 20, 0, R * 2, 0, R / 2), new T.MeshBasicMaterial({ color: 0x4ec8ff, transparent: true, opacity: 0.07, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending })); sh.castShadow = false; k.extra.push(sh); o.dyn.shield = sh;
    o.lights = [[0, 3.2, 0, 0x8ad8ff, 30, 1.6]]; return 3.8; };
  B.ship = function (k, o) { return 0.1; };
  B.vigia = function (k, o) { bx(k, 'dark', 1.6, 0.25, 1.6, 0, 0.12, 0); k.add('metal', G.cyl(0.18, 0.3, 3.4, 4), { p: [0, 1.9, 0], r: [0, R / 4, 0] });
    var tur = grp(); tur.position.y = 3.7; var tk = new G.Kit(); tk.add('armor', G.rbox(0.9, 0.5, 0.9, 0.04), {}); tk.add('dark', G.rbox(0.6, 0.18, 0.3, 0.03), { p: [0, 0.3, -0.15] });
    tk.add('dark', G.cyl(0.05, 0.05, 1.0, 8), { p: [0.12, 0.05, 0.85], r: [R / 2, 0, 0] }); tk.add('dark', G.cyl(0.05, 0.05, 1.0, 8), { p: [-0.12, 0.05, 0.85], r: [R / 2, 0, 0] }); tk.add('screenOn', G.rbox(0.3, 0.08, 0.03, 0.01), { p: [0, 0.12, 0.46], uv: 'keep' }); tk.add('paint', G.rbox(0.92, 0.06, 0.92, 0.02), { p: [0, -0.2, 0] });
    tk.build(tur); o.dyn.turret = tur; k.extra.push(tur); led(k, 'ledR', 0, 4.25, 0); return 4.4; };

  B.torre = function (k, o) { // Torre de luz: mastro alto com refletores voltados para baixo
    k.add('dark', G.rbox(0.9, 0.2, 0.9, 0.05), { p: [0, 0.1, 0] }); k.add('concrete', G.rbox(0.5, 0.35, 0.5, 0.06), { p: [0, 0.35, 0] });
    G.truss(k, 'dark', 5.0, 0.42, 6, 0.025, 0, 0, 0.5); k.add('metal', G.rbox(1.2, 0.12, 0.5, 0.04), { p: [0, 5.55, 0] });
    for (var i = -1; i <= 1; i += 2) { k.add('dark', G.rbox(0.42, 0.26, 0.3, 0.05), { p: [i * 0.42, 5.4, 0.08], r: [0.5, 0, 0] }); k.add('winOn', G.rbox(0.34, 0.03, 0.22, 0.02), { p: [i * 0.42, 5.27, 0.12], r: [0.5, 0, 0], uv: 'keep' }); }
    led(k, 'ledR', 0, 5.75, 0); o.lights.push([0, 5.1, 0.6, 0xfff1dc, 34, 2.4]); o.leds = true; return 5.9; };

  B.poste = function (k, o) { // Poste de energia: mastro treliçado, travessa e isoladores; os cabos saem do topo
    k.add('dark', G.rbox(0.7, 0.18, 0.7, 0.05), { p: [0, 0.09, 0] }); k.add('concrete', G.rbox(0.42, 0.3, 0.42, 0.06), { p: [0, 0.3, 0] });
    k.add('metal', G.cyl(0.07, 0.1, 3.0, 10), { p: [0, 1.85, 0] }); band(k, 'paint', 0.24, 0.16, 0.24, 0.04, 0, 1.0, 0);
    k.add('dark', G.rbox(1.3, 0.09, 0.12, 0.03), { p: [0, 3.15, 0] }); k.add('metal', G.rod([0, 2.75, 0], [0.55, 3.12, 0], 0.025)); k.add('metal', G.rod([0, 2.75, 0], [-0.55, 3.12, 0], 0.025));
    for (var i = -1; i <= 1; i += 2) { k.add('glass', G.cyl(0.05, 0.07, 0.16, 8), { p: [i * 0.55, 3.27, 0] }); }
    k.add('dark', G.rbox(0.22, 0.3, 0.14, 0.04), { p: [0, 1.6, 0.1] }); led(k, 'ledO', 0, 3.4, 0); o.leds = true; return 3.5; };

  B.antenna = function (k, o) { k.add('dark', G.rbox(1.4, 0.25, 1.4, 0.08), { p: [0, 0.13, 0] }); G.truss(k, 'dark', 3.6, 0.95, 4, 0.03, 0, 0, 0.25);
    var dish = grp(); dish.position.set(0, 4.05, 0); var dk = new G.Kit(); dk.add('hull', dishGeo(1.3, 0.42), { r: [0.9, 0, 0], uv: 'keep' }); dk.add('dark', G.cyl(0.14, 0.18, 0.3), { r: [0.9, 0, 0] });
    for (var i = 0; i < 3; i++) { var a = i * 2.094; dk.add('metal', G.rod([Math.cos(a) * 1.0, 0.3, Math.sin(a) * 1.0], [0, 0.95, 0], 0.02)); } dk.add('dark', G.cyl(0.08, 0.05, 0.2, 10), { p: [0, 1.0, 0] });
    dk.build(dish); dish.children.forEach(function (m) { m.geometry.rotateX(0); }); dish.rotation.order = 'YXZ'; o.dyn.dish = dish; k.extra.push(dish); led(k, 'ledR', 0, 4.85, 0); o.leds = true; return 5.2; };

  B.jardim = function (k, o) { // Marco: Jardim Selado — cúpula geodésica
    k.add('hull', G.cyl(3.85, 3.95, 0.8, 48), { p: [0, 0.4, 0], uv: 'scale', su: 8, sv: 0.3 }); k.add('paint', G.cyl(3.9, 3.9, 0.12, 48, true), { p: [0, 0.65, 0], uv: 'scale', su: 8, sv: 0.1 });
    var Rd = 3.6, ico = new T.IcosahedronGeometry(Rd, 2), p = ico.attributes.position, tri = [], edges = {}, i;
    var gl = []; for (i = 0; i < p.count; i += 3) { var cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3; if (cy < -0.1) continue; for (var j = 0; j < 3; j++) gl.push(p.getX(i + j), Math.max(0, p.getY(i + j)), p.getZ(i + j));
      for (j = 0; j < 3; j++) { var a = i + j, b = i + (j + 1) % 3, ka = [p.getX(a), p.getY(a), p.getZ(a)].map(function (v) { return Math.round(v * 100); }).join(','), kb = [p.getX(b), p.getY(b), p.getZ(b)].map(function (v) { return Math.round(v * 100); }).join(','); var key = ka < kb ? ka + '|' + kb : kb + '|' + ka; if (!edges[key]) edges[key] = [[p.getX(a), Math.max(0, p.getY(a)), p.getZ(a)], [p.getX(b), Math.max(0, p.getY(b)), p.getZ(b)]]; } }
    var dg = new T.BufferGeometry(); dg.setAttribute('position', new T.Float32BufferAttribute(gl, 3)); dg.computeVertexNormals(); k.add('glass', dg, { p: [0, 0.8, 0], uv: 'keep' });
    for (var e in edges) { var E = edges[e]; k.add('hull', G.rod([E[0][0], E[0][1] + 0.8, E[0][2]], [E[1][0], E[1][1] + 0.8, E[1][2]], 0.045, 5)); }
    k.add('soil', G.cyl(3.5, 3.5, 0.1, 40), { p: [0, 0.85, 0], uv: 'keep' });
    var pg = grp(); pg.position.y = 0.9; k.extra.push(pg); o.garden = pg;
    k.add('hull', G.pod(0.8, 1.4, 0.2, 22), { p: [0, 1.0, 4.0], r: [0, R / 2, 0], uv: 'scale', su: 2, sv: 1 }); k.add('paint', G.torus(0.84, 0.06, 8, 26), { p: [0, 1.0, 4.5] });
    o.lights = [[0, 3.0, 0, 0xff8ae0], [0, 1.5, 4.8]]; return 5.0; };

  B.farol = function (k, o) { // Marco: Farol Profundo — torre e grande antena
    k.add('hull', G.rbox(3.2, 1.6, 3.2, 0.45, 3), { p: [0, 0.8, 0], d: 2.4 }); band(k, 'paint', 3.24, 0.25, 3.24, 0.12, 0, 1.2, 0); window_(k, 0, 0.95, 1.62, 1.2, 0.4);
    G.truss(k, 'dark', 7.5, 1.6, 8, 0.05, 0, 0, 1.6);
    for (var i = 0; i < 4; i++) { var a = i * R / 2 + R / 4; k.add('metal', G.rod([Math.cos(a) * 0.5, 6.5, Math.sin(a) * 0.5], [Math.cos(a) * 3.7, 0.1, Math.sin(a) * 3.7], 0.015, 4)); k.add('dark', G.cyl(0.15, 0.2, 0.2, 10), { p: [Math.cos(a) * 3.7, 0.1, Math.sin(a) * 3.7] }); }
    var dish = grp(); dish.position.set(0, 9.4, 0); dish.rotation.order = 'YXZ'; var dk = new G.Kit(); dk.add('hull', dishGeo(2.6, 0.8), { r: [1.0, 0, 0], uv: 'keep' });
    for (i = 0; i < 4; i++) { a = i * R / 2; dk.add('metal', G.rod([Math.cos(a) * 2.0, 0.45, Math.sin(a) * 2.0], [0, 1.9, -0.9], 0.03)); } dk.add('dark', G.cyl(0.16, 0.1, 0.4), { p: [0, 1.95, -0.95] }); dk.build(dish); o.dyn.dish = dish; k.extra.push(dish);
    led(k, 'ledR', 0, 9.15, 0); k.add('screenOn', G.sphere(0.2, 12, 10), { p: [0, 11.2, 0], uv: 'keep' }); o.leds = true; o.lights = [[0, 2, 2.4], [0, 11, 0, 0x7ad0ff]]; return 11.4; };

  // ---------- sociedade: casas, enfermaria, zona de pouso, Berço, escola ----------
  B.casa = function (k, o) { // Casa: módulo pequeno com câmara própria; o tijolo dos bairros marcianos
    k.add('hull', G.rbox(3.0, 1.9, 2.5, 0.6, 4), { p: [-0.3, 1.4, -0.1], d: 2.2 }); band(k, 'paint', 3.04, 0.2, 2.54, 0.1, -0.3, 0.75, -0.1); k.add('dark', G.rbox(2.7, 0.3, 2.2, 0.1), { p: [-0.3, 0.3, -0.1] });
    for (var i = -1; i <= 1; i += 2) for (var j = -1; j <= 1; j += 2) k.add('dark', G.cyl(0.09, 0.11, 0.3), { p: [-0.3 + i * 1.15, 0.15, -0.1 + j * 0.9] });
    k.add('hull', G.pod(0.62, 0.5, 0.2, 20), { p: [1.35, 1.05, -0.1], uv: 'scale', su: 2, sv: 1 }); k.add('paint', G.torus(0.64, 0.05, 8, 24), { p: [1.72, 1.05, -0.1], r: [0, R / 2, 0] }); k.add('dark', G.cyl(0.42, 0.42, 0.06, 18), { p: [1.84, 1.05, -0.1], r: [0, 0, R / 2] });
    window_(k, -0.4, 1.6, 1.16, 0.95, 0.5); window_(k, -0.4, 1.6, -1.36, 0.95, 0.5); window_(k, -1.81, 1.55, -0.1, 0.7, 0.45, -R / 2);
    k.add('solar', G.rbox(1.5, 0.05, 1.0, 0.02), { p: [-0.6, 2.42, -0.15], r: [0.2, 0, 0], d: 1.25 }); k.add('dark', G.cyl(0.16, 0.18, 0.22, 12), { p: [0.6, 2.42, -0.6] });
    k.add('metal', G.rod([0.7, 2.3, 0.6], [0.7, 3.1, 0.6], 0.02)); led(k, 'ledG', 0.7, 3.13, 0.6); led(k, 'ledO', 1.5, 1.8, 0.45);
    o.lights = [[2.2, 1.5, -0.1]]; return 2.9; };
  B.cryo = function (k, o) { // Enfermaria criogênica: onde os colonos da Alvorada acordam
    k.add('hull', G.rbox(3.5, 2.1, 3.3, 0.5, 4), { p: [0, 1.35, 0], d: 2.4 }); k.add('dark', G.rbox(3.2, 0.3, 3.0, 0.1), { p: [0, 0.2, 0] }); band(k, 'paint', 3.54, 0.3, 3.34, 0.14, 0, 2.0, 0);
    k.add('paint', G.rbox(0.9, 0.28, 0.06, 0.03), { p: [0, 1.25, 1.66] }); k.add('paint', G.rbox(0.28, 0.9, 0.06, 0.03), { p: [0, 1.25, 1.66] });
    for (var s = -1; s <= 1; s += 2) { k.add('dark', G.rbox(0.82, 0.52, 0.08, 0.05), { p: [s * 1.15, 1.35, 1.66] }); k.add('screenOn', G.rbox(0.7, 0.4, 0.1, 0.03), { p: [s * 1.15, 1.35, 1.67], uv: 'keep' }); k.add('screenOn', G.rbox(0.1, 0.4, 0.9, 0.03), { p: [s * 1.76, 1.4, -0.3], uv: 'keep' }); }
    vTank(k, -1.0, -0.9, 0.34, 1.3, 'metal', 'paint', 2.4); vTank(k, -0.1, -0.9, 0.34, 1.3, 'metal', 'paint', 2.4); k.add('dark', G.rbox(0.9, 0.3, 0.8, 0.1), { p: [1.0, 2.55, 0.5] });
    pipe(k, [[-1.0, 3.3, -0.9], [-0.55, 3.6, -0.9], [-0.1, 3.3, -0.9]], 0.05); led(k, 'ledG', 0.7, 1.9, 1.68);
    o.lights = [[0, 1.6, 2.4, 0x8fe8ff]]; o.vent = [-0.55, 3.8, -0.9]; return 3.8; };
  B.pad = function (k, o) { // Zona de Pouso: plataforma octogonal com marcações e faróis
    k.add('concrete', G.cyl(3.85, 3.95, 0.3, 8), { p: [0, 0.15, 0], r: [0, R / 8, 0], d: 3 });
    k.add('paint', G.torus(2.9, 0.07, 4, 48), { p: [0, 0.31, 0], r: [R / 2, 0, 0], uv: 'keep' }); k.add('paint', G.torus(1.2, 0.06, 4, 32), { p: [0, 0.31, 0], r: [R / 2, 0, 0], uv: 'keep' });
    k.add('paint', G.rbox(5.6, 0.03, 0.14, 0.01), { p: [0, 0.31, 0], r: [0, R / 4, 0] }); k.add('paint', G.rbox(5.6, 0.03, 0.14, 0.01), { p: [0, 0.31, 0], r: [0, -R / 4, 0] });
    for (var i = 0; i < 4; i++) { var a = i * R / 2 + R / 4, x = Math.cos(a) * 3.55, z = Math.sin(a) * 3.55; k.add('dark', G.cyl(0.07, 0.09, 0.7, 8), { p: [x, 0.6, z] }); led(k, i % 2 ? 'ledG' : 'ledO', x, 1.0, z); }
    k.add('hull', G.rbox(0.7, 0.9, 0.5, 0.12), { p: [3.3, 0.7, 0.0] }); k.add('screenOn', G.rbox(0.03, 0.3, 0.3, 0.01), { p: [2.94, 0.85, 0], uv: 'keep' });
    o.lights = [[0, 1.4, 0, 0x8fe8ff]]; return 1.2; };
  B.berco = function (k, o) { // Berço: cúpula branca nervurada, com luz suave por dentro
    k.add('dark', G.cyl(2.92, 2.97, 0.2, 40), { p: [0, 0.1, 0] }); k.add('hull', G.cyl(2.75, 2.85, 1.3, 40), { p: [0, 0.8, 0], uv: 'scale', su: 6, sv: 0.5 }); k.add('paint', G.cyl(2.8, 2.8, 0.14, 40, true), { p: [0, 1.3, 0], uv: 'scale', su: 6, sv: 0.1 });
    k.add('hull', G.sphere(2.7, 40, 14, 0, 2 * R, 0, R / 2), { p: [0, 1.45, 0], s: [1, 0.72, 1], uv: 'scale', su: 6, sv: 2 });
    for (var i = 0; i < 8; i++) { k.add('metal', G.torus(2.72, 0.05, 6, 24, R), { p: [0, 1.45, 0], r: [0, i * R / 8, 0], s: [1, 0.72, 1] }); var a = i * R / 4 + R / 8; k.add('screenOn', G.rbox(0.7, 0.32, 0.1, 0.04), { p: [Math.sin(a) * 2.8, 0.9, Math.cos(a) * 2.8], r: [0, a, 0], uv: 'keep' }); }
    k.add('dark', G.cyl(0.95, 1.0, 0.16, 24), { p: [0, 3.32, 0] }); k.add('glass', G.sphere(0.9, 20, 8, 0, 2 * R, 0, R / 2), { p: [0, 3.36, 0], s: [1, 0.6, 1], uv: 'keep' }); k.add('screenOn', G.sphere(0.32, 12, 8), { p: [0, 3.45, 0], uv: 'keep' });
    k.add('hull', G.pod(0.75, 1.0, 0.2, 22), { p: [0, 0.95, 2.9], r: [0, R / 2, 0], uv: 'scale', su: 2, sv: 1 }); k.add('paint', G.torus(0.78, 0.06, 8, 26), { p: [0, 0.95, 3.5] }); k.add('dark', G.cyl(0.5, 0.5, 0.06, 20), { p: [0, 0.95, 3.6], r: [R / 2, 0, 0] });
    o.lights = [[0, 2.0, 3.9], [0, 3.9, 0, 0x8fe8ff]]; return 4.0; };
  B.escola = function (k, o) { // Escola: módulo longo com janelas grandes e bandeira
    k.add('hull', G.rbox(5.4, 2.2, 3.2, 0.5, 4), { p: [0, 1.45, 0], d: 2.6 }); k.add('dark', G.rbox(5.0, 0.3, 2.9, 0.1), { p: [0, 0.25, 0] }); band(k, 'paint', 5.44, 0.26, 3.24, 0.12, 0, 2.25, 0);
    for (var i = 0; i < 4; i++) { window_(k, -1.8 + i * 1.2, 1.45, 1.61, 0.85, 0.75); window_(k, -1.8 + i * 1.2, 1.45, -1.61, 0.85, 0.75); }
    k.add('dark', G.rbox(0.12, 1.6, 1.0, 0.06), { p: [2.72, 1.45, 0] }); k.add('paint', G.rbox(0.1, 1.85, 1.3, 0.1), { p: [2.68, 1.5, 0] }); led(k, 'ledO', 2.76, 2.5, 0);
    k.add('dark', G.cyl(0.75, 0.8, 0.14, 24), { p: [-1.5, 2.6, 0] }); k.add('glass', G.sphere(0.7, 20, 8, 0, 2 * R, 0, R / 2), { p: [-1.5, 2.62, 0], uv: 'keep' });
    k.add('metal', G.rod([2.0, 2.5, -1.2], [2.0, 4.7, -1.2], 0.025)); k.add('flag', new T.PlaneGeometry(0.75, 0.45), { p: [2.4, 4.42, -1.2], uv: 'keep' });
    o.lights = [[3.3, 1.9, 0], [0, 1.9, 2.5]]; return 3.5; };
  // A Alvorada: nave criogênica com doze cápsulas. Não é uma construção: pousa sobre a Zona de Pouso.
  function ark() { // Alvorada: nave longa e aerodinâmica, cabine escura na frente, dois motores laterais em braços; pousa na horizontal
    var g = grp(), k = new G.Kit(), i, s, Y = 1.95;
    var hull = G.lathe([[0.001, -6.0], [1.05, -5.9], [1.55, -5.2], [1.85, -3.4], [1.92, -0.5], [1.7, 2.2], [1.15, 4.4], [0.45, 6.1], [0.001, 6.8]], 40); hull.rotateX(R / 2);
    k.add('hull', hull, { p: [0, Y, 0], s: [1.32, 0.46, 1], uv: 'scale', su: 9, sv: 4 }); k.add('hull', G.rbox(3.2, 0.5, 7.5, 0.25, 4), { p: [0, Y + 0.35, -1.0], d: 2.4 });
    k.add('dark', G.rbox(2.5, 0.22, 8.4, 0.11), { p: [0, Y - 1.06, -0.6] });
    k.add('paint', G.rbox(0.5, 0.16, 6.4, 0.07), { p: [0, Y + 0.66, -1.6] }); k.add('dark', G.rbox(1.2, 0.18, 1.2, 0.06), { p: [0, Y + 0.68, -0.4] }); for (var pi = 0; pi < 4; pi++) k.add('dark', G.rbox(2.9, 0.03, 0.05, 0.01), { p: [0, Y + 0.61, -4.0 + pi * 1.4] });
    k.add('visor', G.sphere(0.95, 26, 16, 0, R * 2, 0, R / 2), { p: [0, Y + 0.55, 3.0], s: [1.0, 0.55, 2.3], uv: 'keep' }); k.add('hull', G.torus(0.95, 0.06, 6, 28), { p: [0, Y + 0.55, 3.0], r: [R / 2, 0, 0], s: [1.0, 2.3, 1] });
    for (s = -1; s <= 1; s += 2) {
      k.add('paint', G.rbox(0.05, 0.22, 7.2, 0.02), { p: [s * 2.5, Y + 0.05, -0.6] }); k.add('dark', G.rbox(0.05, 0.08, 5.6, 0.02), { p: [s * 2.49, Y - 0.25, -0.4] });
      for (i = 0; i < 5; i++) k.add('screenOn', G.rbox(0.05, 0.16, 0.34, 0.02), { p: [s * 2.47, Y + 0.32, 1.2 - i * 0.7], uv: 'keep' });
      k.add('hull', G.rbox(2.4, 0.22, 2.6, 0.1), { p: [s * 2.6, Y - 0.05, -2.2], r: [0, 0, s * 0.08] }); k.add('paint', G.rbox(1.6, 0.26, 0.5, 0.08), { p: [s * 2.7, Y + 0.05, -1.2] });
      var nx = s * 3.75, ny = Y + 0.22;
      k.add('hull', G.capsule(0.62, 3.8, 18), { p: [nx, ny, -2.0], r: [R / 2, 0, 0], uv: 'scale', su: 3, sv: 2 });
      k.add('dark', G.torus(0.6, 0.11, 8, 26), { p: [nx, ny, 0.05] }); k.add('dark', G.cyl(0.42, 0.42, 0.3, 20), { p: [nx, ny, 0.12], r: [R / 2, 0, 0] });
      k.add('dark', G.cyl(0.56, 0.44, 0.55, 22), { p: [nx, ny, -4.25], r: [R / 2, 0, 0] }); k.add('screenOn', G.cyl(0.38, 0.38, 0.04, 20), { p: [nx, ny, -4.53], r: [R / 2, 0, 0], uv: 'keep' });
      k.add('paint', G.rbox(0.05, 0.2, 3.0, 0.02), { p: [nx + s * 0.6, ny, -2.0] });
      k.add('hull', G.rbox(0.1, 1.05, 1.5, 0.04), { p: [nx, ny + 0.9, -3.3], r: [-0.25, 0, s * 0.22] });
      for (var z = -1; z <= 1; z += 2) { var lx = s * 1.55, lz = z > 0 ? 2.6 : -3.4; k.add('metal', G.rod([lx, Y - 0.9, lz], [lx * 1.18, 0.2, lz * 1.06], 0.09, 10)); k.add('chrome', G.rod([lx * 1.08, Y - 1.2, lz], [lx * 1.16, 0.45, lz * 1.05], 0.06, 8)); k.add('dark', G.cyl(0.36, 0.44, 0.13, 18), { p: [lx * 1.18, 0.07, lz * 1.06] }); }
      led(k, s > 0 ? 'ledG' : 'ledR', nx + s * 0.62, ny, -0.3); }
    k.add('metal', G.rod([0, Y + 1.3, -3.6], [0, Y + 2.2, -3.6], 0.03)); led(k, 'ledR', 0, Y + 2.25, -3.6);
    k.build(g);
    var rp = grp(); rp.position.set(0, Y - 1.1, -4.4); var rk = new G.Kit(); rk.add('metal', G.rbox(1.5, 0.07, 2.3, 0.03), { p: [0, 0, 1.15] }); for (i = 0; i < 6; i++) rk.add('dark', G.rbox(1.35, 0.03, 0.05, 0.01), { p: [0, 0.05, 0.3 + i * 0.33] }); rk.add('paint', G.rbox(0.07, 0.12, 2.3, 0.02), { p: [0.72, 0.03, 1.15] }); rk.add('paint', G.rbox(0.07, 0.12, 2.3, 0.02), { p: [-0.72, 0.03, 1.15] }); rk.build(rp); g.add(rp);
    g.userData.ramp = rp; g.userData.h = Y + 2.3; return g; }

  // ---------- plantas ----------
  var plantGeo = {};
  function plant(type) { if (plantGeo[type]) return plantGeo[type]; var k = new G.Kit(), i;
    if (type === 'batata') { for (i = 0; i < 16; i++) { var a = i * 2.4, r = 0.05 + (i % 4) * 0.045, y = 0.08 + (i % 5) * 0.05; k.add(i % 3 ? 'leaf' : 'leaf2', G.sphere(0.07, 7, 5), { p: [Math.cos(a) * r, y, Math.sin(a) * r], r: [0.4 * Math.sin(a), a, 0.5], s: [1.3, 0.25, 0.8], uv: 'keep' }); }
      k.add('leaf', G.cyl(0.012, 0.015, 0.2, 5), { p: [0, 0.1, 0], uv: 'keep' }); }
    else if (type === 'alface') { for (i = 0; i < 12; i++) { a = i * 2.4; r = i < 5 ? 0.03 : 0.07; k.add(i < 5 ? 'leaf2' : 'leaf', G.sphere(0.08, 8, 6, 0, R * 2, 0, R / 2), { p: [Math.cos(a) * r, 0.04, Math.sin(a) * r], r: [i < 5 ? -0.2 : -0.9, a, 0], s: [0.8, 0.9, 1.1], uv: 'keep' }); } }
    else { for (i = 0; i < 7; i++) { a = i * 2.4; k.add(i % 2 ? 'leaf' : 'leaf2', G.sphere(0.3, 8, 6), { p: [Math.cos(a) * 0.25, 1.1 + (i % 3) * 0.25, Math.sin(a) * 0.25], s: [1, 0.7, 1], uv: 'keep' }); } k.add('dark', G.cyl(0.05, 0.08, 1.2, 6), { p: [0, 0.6, 0], uv: 'keep' }); }
    var g = grp(); k.build(g, true); var geo = {}; g.children.forEach(function (m) { geo[m.material.userData.key] = m.geometry; }); plantGeo[type] = geo; return geo; }
  function bed(type) { var g = grp(), geo = plant(type); for (var i = 0; i < 6; i++) for (var key in geo) { var m = new T.Mesh(geo[key], M[key]); m.position.set((i % 2 ? 0.2 : -0.2), 0, -0.95 + Math.floor(i / 2) * 0.95); m.rotation.y = i * 1.3; m.castShadow = true; g.add(m); } return g; }
  function garden() { var g = grp(), i; for (i = 0; i < 22; i++) { var a = i * 2.39996, r = 0.8 + Math.sqrt(i / 22) * 2.4, t = i % 4 === 0 ? 'arv' : i % 2 ? 'batata' : 'alface', geo = plant(t), s = t === 'arv' ? 0.8 + (i % 3) * 0.25 : 3;
      for (var key in geo) { var m = new T.Mesh(geo[key], M[key]); m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); m.scale.setScalar(s); m.rotation.y = i; m.castShadow = true; g.add(m); } } return g; }

  // ---------- montagem final de uma construção ----------
  // ---------- Níveis 1–5: design moderno, arestas vivas ----------
  // Do nível 2 em diante as construções principais trocam o módulo arredondado por arquitetura angular: volumes empilhados e girados,
  // fachadas de vidro escuro, aletas laranja, filetes de luz. Cada nível é um salto de tecnologia sobre o anterior.
  function bx(k, m, w, h, d, x, y, z, r) { k.add(m, G.rbox(w, h, d, Math.min(0.025, w * 0.1, h * 0.1, d * 0.1)), { p: [x, y, z], r: r, uv: m === 'screenOn' || m === 'winOn' || m === 'visor' || m === 'facade' ? 'keep' : undefined }); }
  function strip(k, len, ax, x, y, z, m) { var s = 0.035; bx(k, m || 'screenOn', ax === 'x' ? len : s, ax === 'y' ? len : s, ax === 'z' ? len : s, x, y, z); }
  function glassF(k, w, h, x, y, z, face) { // fachada de vidro com caixilho e montantes; face: 'z' (frente/trás) ou 'x' (lados)
    var fz = face === 'x', n = Math.max(1, Math.round(w / 0.8)), i;
    if (fz) { bx(k, 'paint', 0.06, h + 0.12, w + 0.12, x, y, z); bx(k, 'facade', 0.07, h, w, x, y, z); for (i = 1; i < n; i++) bx(k, 'metal', 0.09, h, 0.035, x, y, z - w / 2 + i * w / n); }
    else { bx(k, 'metal', w + 0.12, h + 0.12, 0.06, x, y, z); bx(k, 'facade', w, h, 0.07, x, y, z); for (i = 1; i < n; i++) bx(k, 'metal', 0.035, h, 0.09, x - w / 2 + i * w / n, y, z); } }
  function vol(k, w, h, d, x, y, z, ry, opt) { // volume branco com recorte de vidro na frente, faixa escura na base e filete de luz no topo
    var c = Math.cos(ry || 0), s = Math.sin(ry || 0), g = new G.Kit(), o = opt || {};
    bx(g, 'hull', w, h, d, 0, h / 2, 0); bx(g, 'dark', w + 0.02, 0.12, d + 0.02, 0, 0.06, 0); bx(g, 'metal', w + 0.08, 0.1, d + 0.08, 0, h + 0.05, 0); bx(g, 'hull', w - 0.2, 0.06, d - 0.2, 0, h + 0.1, 0);
    bx(g, 'metal', 0.5, 0.25, 0.4, w * 0.25, h + 0.22, -d * 0.2); bx(g, 'dark', 0.36, 0.03, 0.28, w * 0.25, h + 0.36, -d * 0.2); bx(g, 'metal', 0.25, 0.18, 0.25, -w * 0.3, h + 0.18, -d * 0.25);
    glassF(g, w * (o.gw || 0.7) * 0.85, h * 0.4, o.gx || 0, h * 0.58, d / 2 + 0.02); if (o.back) glassF(g, w * 0.45, h * 0.35, 0, h * 0.58, -d / 2 - 0.02); glassF(g, d * 0.45, h * 0.3, w / 2 + 0.02, h * 0.6, 0, 'x');
    strip(g, w + 0.06, 'x', 0, h + 0.09, d / 2 + 0.03); if (o.fin) { bx(g, 'paint', 0.1, h + 0.2, 0.5, w / 2 + 0.05, h / 2, d / 2 - 0.3); }
    for (var i = 1; i < 4; i++) { bx(g, 'dark', 0.015, h * 0.92, 0.015, -w / 2 - 0.004, h / 2, -d / 2 + i * d / 4); bx(g, 'dark', 0.015, h * 0.92, 0.015, -w / 2 + i * w / 4, h / 2, -d / 2 - 0.004); } bx(g, 'dark', w + 0.01, 0.015, 0.015, 0, h * 0.28, d / 2 + 0.004); // juntas dos painéis
    var m4 = new T.Matrix4().makeRotationY(ry || 0).setPosition(x, y, z); for (var key in g.parts) g.parts[key].forEach(function (geo) { k.add(key, geo.clone().applyMatrix4(m4), { uv: 'keep' }); }); }
  function obelisk(k, x, z, hh, o) { // marco do nível 5: obelisco de vidro escuro com filetes de luz e quadros flutuantes
    k.add('visor', G.cyl(0.18, 0.42, hh, 4), { p: [x, hh / 2 + 0.1, z], r: [0, R / 4, 0], uv: 'keep' }); k.add('dark', G.cyl(0.5, 0.55, 0.25, 4), { p: [x, 0.12, z], r: [0, R / 4, 0] });
    for (var s = -1; s <= 1; s += 2) { strip(k, hh * 0.85, 'y', x + s * 0.21, hh * 0.5, z); strip(k, hh * 0.85, 'y', x, hh * 0.5, z + s * 0.21); }
    for (var i = 0; i < 2; i++) { var y = hh * (0.55 + i * 0.3), w = 1.1 - i * 0.3; strip(k, w, 'x', x, y, z + w / 2); strip(k, w, 'x', x, y, z - w / 2); strip(k, w, 'z', x + w / 2, y, z); strip(k, w, 'z', x - w / 2, y, z); }
    led(k, 'ledR', x, hh + 0.2, z); o.lights.push([x, hh * 0.7, z, 0x9ad8ff, 22, 1.2]); }
  var MOD = {
    casa: function (k, o, W, D, lv) { var y = 0.3, i, tw = [0, 0.12, -0.1, 0.18];
      bx(k, 'dark', 3.7, 0.3, 3.5, 0, 0.15, 0); strip(k, 3.7, 'x', 0, 0.3, 1.76); bx(k, 'concrete', 1.2, 0.08, 0.9, 1.1, 0.34, 1.9);
      vol(k, 3.1, 1.9, 2.5, -0.15, y, -0.15, 0, { fin: true, back: true }); y += 1.9;
      bx(k, 'hull', 0.9, 1.5, 1.2, 1.65, 0.3 + 0.75, -0.2); bx(k, 'dark', 0.6, 1.1, 0.05, 1.65, 0.85, 0.42); strip(k, 1.1, 'y', 1.98, 0.85, 0.42, 'paint');
      if (lv === 2) { bx(k, 'hull', 3.5, 0.1, 2.9, -0.15, y + 0.05, -0.05); strip(k, 3.5, 'x', -0.15, y + 0.05, 1.42); k.add('solar', G.rbox(1.6, 0.04, 1.1, 0.01), { p: [-0.4, y + 0.3, -0.4], r: [0.3, 0, 0], d: 1.25 }); y += 0.35; }
      if (lv >= 3) { for (i = 1; i <= (lv >= 5 ? 3 : lv >= 4 ? 2 : 1); i++) { var w = 2.9 - i * 0.25, d = 2.4 - i * 0.15; vol(k, w, 1.45, d, -0.15 + (i % 2 ? 0.25 : -0.1), y, -0.1 + (i % 2 ? 0.3 : 0), tw[i], { gw: 0.85, fin: i % 2 === 0 }); y += 1.45; } }
      if (lv === 3) { for (i = -1; i <= 1; i++) bx(k, 'glass', 0.9, 0.5, 0.03, -0.15 + i * 0.92, 2.45, 1.3); bx(k, 'metal', 2.8, 0.04, 0.04, -0.15, 2.7, 1.3); bx(k, 'metal', 0.5, 0.06, 1.6, 1.2, 1.2, 1.05, [0.75, 0, 0]); }
      if (lv >= 4) { for (var s = -1; s <= 1; s += 2) strip(k, y - 0.4, 'y', s * 1.45 - 0.15, 0.3 + (y - 0.4) / 2, 1.1); bx(k, 'dark', 0.08, 1.4, 0.08, 0.6, y + 0.7, -0.6); led(k, 'ledR', 0.6, y + 1.42, -0.6); }
      if (lv >= 5) { k.add('glass', G.cyl(0.9, 1.05, 1.0, 8), { p: [-0.1, y + 0.5, 0.1], uv: 'keep' }); k.add('dark', G.cyl(1.08, 1.08, 0.08, 8), { p: [-0.1, y + 0.04, 0.1] }); k.add('screenOn', G.cyl(1.1, 1.1, 0.03, 8), { p: [-0.1, y + 0.1, 0.1], uv: 'keep' }); k.add('leaf', G.cyl(0.4, 0.5, 0.6, 7), { p: [-0.1, y + 0.4, 0.1] });
        for (i = 0; i < 4; i++) { var a = i * R / 2 + R / 4; strip(k, 1.3, 'y', -0.1 + Math.cos(a) * 1.25, y + 0.9, 0.1 + Math.sin(a) * 1.25); } o.lights.push([-0.1, y + 0.6, 0.1, 0xffe2b8]); y += 1.1; }
      o.lights.push([0.4, 1.6, 1.8]); return y + 0.3; },
    habitat: function (k, o, W, D, lv) { var y = 0.35, i;
      bx(k, 'dark', 5.8, 0.35, 4.1, 0, 0.17, 0); strip(k, 5.8, 'x', 0, 0.35, 2.06); strip(k, 4.1, 'z', 2.91, 0.35, 0);
      vol(k, 5.2, 2.3, 3.6, 0, y, 0, 0, { gw: 0.8, back: true, fin: true }); bx(k, 'hull', 0.9, 2.0, 1.6, 2.95, y + 1.0, 0); bx(k, 'dark', 0.06, 1.5, 0.9, 3.41, y + 0.85, 0); strip(k, 1.5, 'y', 3.43, y + 0.85, 0.5, 'paint');
      bx(k, 'hull', 2.4, 0.08, 1.2, 0.8, y + 2.2, 2.2); strip(k, 2.4, 'x', 0.8, y + 2.16, 2.8); y += 2.3;
      if (lv >= 3) { vol(k, 3.8, 1.7, 3.0, -0.5, y, -0.15, 0.08, { gw: 0.9 }); for (i = 0; i < 6; i++) bx(k, 'metal', 0.04, 1.3, 0.7, 1.9 + i * 0.16, y + 0.75, 1.0); y += 1.7; }
      if (lv >= 4) { vol(k, 2.8, 1.5, 2.4, -0.7, y, -0.25, -0.1, { gw: 0.85, fin: true }); for (i = 0; i < 3; i++) k.add('solar', G.rbox(1.5, 0.04, 0.7, 0.01), { p: [1.4, 2.75 + 0.05, -1.2 + i * 0.75], r: [0.45, 0, 0], d: 1.25 });
        for (var s = -1; s <= 1; s += 2) { k.add('dark', G.rod([s * 2.75, 0.35, 1.95], [s * 2.75, y, 1.95], 0.05, 4)); k.add('dark', G.rod([s * 2.75, 0.35, -1.95], [s * 2.75, y, -1.95], 0.05, 4)); k.add('dark', G.rod([s * 2.75, 0.4, 1.95], [s * 2.75, y - 0.2, -1.95], 0.035, 4)); } y += 1.5; }
      if (lv >= 5) { var tx = 1.9, tz = -1.0; bx(k, 'hull', 1.5, 6.5, 1.5, tx, 3.25, tz); glassF(k, 1.2, 5.6, tx, 3.3, tz + 0.77); glassF(k, 1.2, 5.6, tx + 0.77, 3.3, tz, 'x'); for (i = 0; i < 4; i++) strip(k, 6.4, 'y', tx + (i % 2 ? 0.76 : -0.76), 3.3, tz + (i < 2 ? 0.76 : -0.76));
        bx(k, 'dark', 1.9, 0.15, 1.9, tx, 6.55, tz); bx(k, 'screenOn', 1.92, 0.05, 1.92, tx, 6.66, tz); k.add('metal', G.rod([tx, 6.6, tz], [tx, 8.0, tz], 0.04, 6)); led(k, 'ledR', tx, 8.05, tz); o.lights.push([tx, 6.4, tz, 0x9ad8ff, 24, 1.2]); y = Math.max(y, 8); }
      o.lights.push([3.5, 2.0, 0], [0, 2.2, 2.6]); return y + 0.3; },
    greenhouse: function (k, o, W, D, lv) { var i, L = 5.4, Wd = 3.6, H = lv >= 3 ? 2.6 : 2.2;
      bx(k, 'dark', 6.0, 0.45, 4.0, 0, 0.22, 0); strip(k, 6.0, 'x', 0, 0.45, 2.01); strip(k, 6.0, 'x', 0, 0.45, -2.01);
      var ridges = lv >= 3 ? 3 : 1, rw = L / ridges;
      for (i = 0; i < ridges; i++) { var cx = -L / 2 + rw * (i + 0.5); // telhado em dente de serra / duas águas, vidro com caixilho
        for (var s = -1; s <= 1; s += 2) { var ang = Math.atan2(0.9, Wd / 2); k.add('glass', G.rbox(rw - 0.04, 0.04, Wd / 2 / Math.cos(ang) + 0.05, 0.01), { p: [cx, H + 0.45, s * Wd / 4], r: [-s * ang, 0, 0], uv: 'keep' }); }
        bx(k, 'dark', rw, 0.08, 0.08, cx, H + 0.9, 0); bx(k, 'dark', 0.06, 0.06, Wd, cx - rw / 2, H + 0.45, 0); }
      for (var sd = -1; sd <= 1; sd += 2) { k.add('glass', G.rbox(L, H - 0.45, 0.04, 0.01), { p: [0, 0.45 + (H - 0.45) / 2, sd * Wd / 2], uv: 'keep' }); bx(k, 'dark', L + 0.06, 0.08, 0.08, 0, H, sd * Wd / 2); for (i = 0; i <= 6; i++) bx(k, 'dark', 0.06, H - 0.45, 0.06, -L / 2 + i * L / 6, 0.45 + (H - 0.45) / 2, sd * Wd / 2); }
      k.add('glass', G.rbox(0.04, H - 0.45, Wd, 0.01), { p: [-L / 2, 0.45 + (H - 0.45) / 2, 0], uv: 'keep' }); bx(k, 'hull', 0.9, H, 1.6, L / 2 + 0.4, H / 2, 0); bx(k, 'visor', 0.06, 1.3, 0.8, L / 2 + 0.86, 1.0, 0); strip(k, H, 'y', L / 2 + 0.86, H / 2, 0.55, 'paint');
      o.plots = []; for (i = 0; i < 4; i++) { var px = -1.85 + i * 1.2; bx(k, 'dark', 1.0, 0.3, 2.8, px, 0.6, 0); k.add('soil', G.rbox(0.9, 0.06, 2.7, 0.02), { p: [px, 0.76, 0], uv: 'keep' }); strip(k, 2.8, 'z', px - 0.5, 0.75, 0, 'grow'); var pg = grp(); pg.position.set(px, 0.78, 0); k.extra.push(pg); o.plots.push(pg); }
      bx(k, 'grow', L - 0.4, 0.05, 0.1, 0, H - 0.1, 0.9); bx(k, 'grow', L - 0.4, 0.05, 0.1, 0, H - 0.1, -0.9);
      if (lv >= 3) for (i = -1; i <= 1; i++) { k.add('hull', G.cyl(0.3, 0.3, 1.0, 6), { p: [i * 1.8, 0.5, 2.4] }); strip(k, 0.8, 'y', i * 1.8, 0.55, 2.68); }
      var top = H + 0.9;
      if (lv >= 4) { var y4 = top + 0.15; for (var s4 = -1; s4 <= 1; s4 += 2) for (var t4 = -1; t4 <= 1; t4 += 2) bx(k, 'dark', 0.12, 1.9, 0.12, s4 * 1.8, y4 + 0.95 - 0.9, t4 * 1.2);
        bx(k, 'dark', 4.0, 0.12, 2.8, 0, y4 + 0.9, 0); k.add('glass', G.rbox(3.8, 1.6, 2.6, 0.02), { p: [0, y4 + 1.75, 0], uv: 'keep' }); bx(k, 'dark', 3.9, 0.08, 2.7, 0, y4 + 2.6, 0);
        for (i = 0; i < 4; i++) { bx(k, 'metal', 0.06, 1.5, 2.2, -1.4 + i * 0.93, y4 + 1.7, 0); for (var j = 0; j < 3; j++) k.add('leaf', G.rbox(0.25, 0.22, 2.0, 0.08), { p: [-1.4 + i * 0.93 + 0.12, y4 + 1.15 + j * 0.45, 0] }); }
        strip(k, 3.9, 'x', 0, y4 + 2.64, 1.36); o.lights.push([0, y4 + 1.6, 0, 0xff6ad8]); top = y4 + 2.7; }
      if (lv >= 5) { var dome = G.sphere(3.6, 10, 5, 0, R * 2, 0, R / 2); k.add('glass', dome, { p: [0, 0.45, 0], s: [1, 1.15, 0.78], uv: 'keep' }); var wf = new T.EdgesGeometry(dome); var ln = new T.LineSegments(wf, new T.LineBasicMaterial({ color: 0x1a1a1e })); ln.position.y = 0.45; ln.scale.set(1.002, 1.152, 0.782); k.extra.push(ln);
        k.add('hull', G.cyl(0.55, 0.65, 5.2, 6), { p: [-2.1, 2.6, 0] }); for (i = 0; i < 5; i++) { k.add('leaf', G.cyl(0.75, 0.75, 0.18, 6), { p: [-2.1, 1.0 + i * 0.85, 0] }); strip(k, 1.4, 'x', -2.1, 1.12 + i * 0.85, 0.7, 'grow'); }
        bx(k, 'screenOn', 7.4, 0.04, 0.04, 0, 0.47, 2.8); bx(k, 'screenOn', 7.4, 0.04, 0.04, 0, 0.47, -2.8); top = Math.max(top, 4.6); }
      o.lights.push([0, 1.8, 0, 0xff6ad8]); return top; },
    solar: function (k, o, W, D, lv) { var ph = lv >= 5 ? 3.6 : lv >= 3 ? 2.6 : 2.0, i;
      bx(k, 'dark', 1.2, 0.25, 1.2, 0, 0.12, 0); strip(k, 1.2, 'x', 0, 0.25, 0.61); k.add('metal', G.cyl(0.1, 0.22, ph, 4), { p: [0, ph / 2 + 0.2, 0], r: [0, R / 4, 0] }); bx(k, 'dark', 0.5, 0.35, 0.4, 0, ph + 0.2, 0);
      bx(k, 'hull', 0.6, 0.8, 0.45, 1.25, 0.45, 1.25); bx(k, 'visor', 0.4, 0.25, 0.03, 1.25, 0.6, 1.48); strip(k, 0.6, 'x', 1.25, 0.85, 1.48);
      var head = grp(); head.position.y = ph + 0.32; var dk = new G.Kit(), pw = lv >= 5 ? 5.0 : lv >= 4 ? 4.4 : 3.8, pd = lv >= 5 ? 3.4 : lv >= 4 ? 3.0 : 2.6;
      function panel(x, w, d, ry, rz) { dk.add('dark', G.rbox(w + 0.08, 0.06, d + 0.08, 0.01), { p: [x, 0, 0], r: [0, ry || 0, rz || 0] }); dk.add('solar', G.rbox(w, 0.05, d, 0.01), { p: [x, 0.025, 0], r: [0, ry || 0, rz || 0], d: 1.25 }); }
      if (lv === 2) panel(0, pw, pd); else { panel(-pw / 4 - 0.06, pw / 2, pd, 0, 0.12); panel(pw / 4 + 0.06, pw / 2, pd, 0, -0.12); }
      dk.add('screenOn', G.rbox(pw + 0.1, 0.03, 0.03, 0.01), { p: [0, 0.03, pd / 2 + 0.05], uv: 'keep' }); dk.add('screenOn', G.rbox(pw + 0.1, 0.03, 0.03, 0.01), { p: [0, 0.03, -pd / 2 - 0.05], uv: 'keep' }); dk.add('dark', G.rbox(0.3, 0.16, pd * 0.8, 0.02), { p: [0, -0.1, 0] });
      if (lv >= 4) for (i = -1; i <= 1; i += 2) dk.add('metal', G.rbox(0.05, 0.05, pd, 0.01), { p: [i * pw * 0.25, 0.06, 0] });
      dk.build(head); o.dyn.panel = head; k.extra.push(head);
      if (lv >= 4) for (var s = -1; s <= 1; s += 2) { bx(k, 'dark', 0.12, 1.0, 0.12, s * 1.5, 0.5, -1.5); bx(k, 'hull', 0.5, 0.06, 0.5, s * 1.5, 1.05, -1.5, [0.5, 0, 0]); led(k, 'ledG', s * 1.5, 1.12, -1.5); }
      if (lv >= 5) { k.add('dark', G.cyl(0.3, 0.3, 0.6, 6), { p: [0, ph - 0.5, 0] }); k.add('screenOn', G.cyl(0.24, 0.24, 0.62, 6), { p: [0, ph - 0.5, 0], uv: 'keep' }); o.lights.push([0, ph - 0.5, 0, 0x9ad8ff]); }
      return ph + 0.9; },
    battery: function (k, o, W, D, lv) { var i, h = 1.8;
      bx(k, 'dark', 1.8, 0.2, 1.6, 0, 0.1, 0); strip(k, 1.8, 'x', 0, 0.2, 0.81);
      if (lv <= 3) { var n = lv === 2 ? 1 : 2; for (i = 0; i < n; i++) { var x = n === 1 ? 0 : -0.42 + i * 0.84; bx(k, 'hull', n === 1 ? 1.2 : 0.72, 1.7, 1.0, x, 1.05, 0); bx(k, 'visor', n === 1 ? 0.8 : 0.45, 1.2, 0.03, x, 1.05, 0.51); for (var j = 0; j < 5; j++) bx(k, 'screenOn', n === 1 ? 0.6 : 0.32, 0.1, 0.035, x, 0.6 + j * 0.2, 0.53); bx(k, 'paint', n === 1 ? 1.22 : 0.74, 0.08, 1.02, x, 1.9, 0); } h = 2.0;
        if (lv === 3) for (i = 0; i < 7; i++) bx(k, 'metal', 0.03, 1.4, 0.4, -0.75 + i * 0.25, 1.0, -0.72); }
      else { k.add('dark', G.cyl(0.75, 0.8, 0.3, 6), { p: [0, 0.35, 0] }); var hh = lv >= 5 ? 3.6 : 2.2; k.add('glass', G.cyl(0.5, 0.5, hh, 6), { p: [0, 0.5 + hh / 2, 0], uv: 'keep' }); k.add('screenOn', G.cyl(0.24, 0.24, hh - 0.2, 6), { p: [0, 0.5 + hh / 2, 0], uv: 'keep' });
        for (i = 0; i < 6; i++) { var a = i * R / 3; bx(k, 'hull', 0.12, hh, 0.12, Math.cos(a) * 0.62, 0.5 + hh / 2, Math.sin(a) * 0.62); } k.add('dark', G.cyl(0.75, 0.6, 0.25, 6), { p: [0, 0.6 + hh, 0] }); o.lights.push([0, 0.5 + hh / 2, 0, 0x9ad8ff]); h = hh + 0.9;
        if (lv >= 5) for (i = 0; i < 3; i++) { var y = 1.0 + i * 1.0, w = 1.5 - i * 0.2; strip(k, w, 'x', 0, y, w / 2); strip(k, w, 'x', 0, y, -w / 2); strip(k, w, 'z', w / 2, y, 0); strip(k, w, 'z', -w / 2, y, 0); } }
      return h; },
    workshop: function (k, o, W, D, lv) { var i, h = 2.4;
      bx(k, 'dark', 3.8, 0.3, 3.6, 0, 0.15, 0); strip(k, 3.8, 'x', 0, 0.3, 1.81);
      bx(k, 'hull', 3.4, h, 3.0, 0, 0.3 + h / 2, -0.1); bx(k, 'dark', 2.0, 1.7, 0.06, 0.4, 1.2, 1.42); for (i = 0; i < 9; i++) bx(k, 'metal', 1.95, 0.03, 0.08, 0.4, 0.45 + i * 0.18, 1.45); bx(k, 'paint', 0.12, h, 0.4, -1.75, 0.3 + h / 2, 1.2); glassF(k, 0.9, 1.0, -1.1, 1.8, 1.42);
      for (i = 0; i < 3; i++) { var x = -1.2 + i * 1.15; bx(k, 'hull', 1.1, 0.05, 3.0, x, 0.3 + h + 0.35, -0.1, [0, 0, 0.55]); bx(k, 'visor', 0.04, 0.55, 2.9, x + 0.32, 0.3 + h + 0.3, -0.1); } h += 0.9;
      if (lv >= 3) { G.truss(k, 'dark', 3.6, 0.3, 4, 0.02, 1.95, -1.4, 0.3); G.truss(k, 'dark', 3.6, 0.3, 4, 0.02, -1.95, -1.4, 0.3); bx(k, 'paint', 4.2, 0.3, 0.3, 0, 3.95, -1.4); bx(k, 'dark', 0.4, 0.3, 0.4, 0.6, 3.7, -1.4); k.add('metal', G.rod([0.6, 3.55, -1.4], [0.6, 2.9, -1.4], 0.015, 4)); }
      if (lv >= 4) { bx(k, 'dark', 0.6, 4.2, 0.6, -1.4, 2.1 + 0.3, -1.0); strip(k, 4, 'y', -1.09, 2.3, -0.69, 'paint'); bx(k, 'dark', 0.5, 0.5, 0.5, 1.4, 0.55, 2.0); k.add('metal', G.rod([1.4, 0.8, 2.0], [1.2, 1.7, 1.9], 0.06, 6)); k.add('metal', G.rod([1.2, 1.7, 1.9], [0.7, 1.5, 2.1], 0.05, 6)); bx(k, 'paint', 0.16, 0.16, 0.3, 0.7, 1.45, 2.1); o.vent = [-1.4, 4.7, -1.0]; }
      if (lv >= 5) { vol(k, 2.6, 1.4, 2.2, 0.3, h + 0.05, 0, 0.1, { gw: 0.9, fin: true }); bx(k, 'winOn', 2.0, 0.06, 0.06, 0.4, 0.5, 1.47); o.lights.push([0.3, h + 0.8, 1.4, 0xffb070]); h += 1.5; }
      o.lights.push([0.4, 2.3, 2.3]); return h; },
    muro: function (k, o, W, D, lv) { var i; // 2 concreto armado · 3 blindado com espetos · 4 blindagem alta com luz · 5 muro de energia
      bx(k, 'dark', 2.0, 0.15, 2.0, 0, 0.07, 0); var h = 1.6 + (lv - 2) * 0.35;
      bx(k, lv >= 3 ? 'armor' : 'concrete', 1.98, h, 1.98, 0, h / 2, 0); for (i = -1; i <= 1; i += 2) bx(k, 'metal', 2.0, 0.08, 0.1, 0, h * (0.35 + i * 0.25), 1.0);
      bx(k, 'metal', 2.04, 0.12, 2.04, 0, h + 0.06, 0);
      if (lv >= 3) for (i = -2; i <= 2; i++) k.add('dark', G.cyl(0.0, 0.07, 0.4, 4), { p: [i * 0.42, h + 0.32, 0.2] });
      if (lv >= 4) { strip(k, 2.0, 'x', 0, h - 0.15, 1.0); strip(k, 2.0, 'x', 0, h - 0.15, -1.0); bx(k, 'paint', 0.12, h, 0.12, 0.95, h / 2, 0.95); }
      if (lv >= 5) { k.add('screenOn', G.rbox(1.9, 1.2, 0.06, 0.02), { p: [0, h + 0.75, 0], uv: 'keep' }); for (i = -1; i <= 1; i += 2) bx(k, 'dark', 0.14, 1.4, 0.14, i * 0.95, h + 0.7, 0); h += 1.4; }
      return h + 0.2; },
    posto: function (k, o, W, D, lv) { return B.posto(k, o, W, D); }
  };
  function levelKit(k, type, def, W, D, h, lv, o) { var i, s, t2, M = Math.max(W, D);
    // 2 · base escura com filete de luz (vale para todas)
    if (!MOD[type]) { bx(k, 'dark', W + 0.5, 0.12, D + 0.5, 0, 0.06, 0); strip(k, W + 0.5, 'x', 0, 0.12, D / 2 + 0.26); }
    if (!MOD[type] && lv >= 3) { // demais construções: anexo angular com vidro e aletas
      vol(k, Math.min(1.6, W * 0.45), 1.1, Math.min(1.2, D * 0.4), -W / 2 + Math.min(1.6, W * 0.45) / 2 + 0.05, 0.12, D / 2 - 0.65, 0, { gw: 0.8 }); for (i = 0; i < 4; i++) bx(k, 'metal', 0.03, 0.8, 0.5, W / 2 + 0.12, 0.6, -0.4 + i * 0.25); }
    if (!MOD[type] && lv >= 4) { bx(k, 'dark', 0.1, 1.6, 0.1, -W / 2 + 0.2, h + 0.7, -D / 2 + 0.2); bx(k, 'hull', 0.7, 0.05, 0.5, -W / 2 + 0.2, h + 1.5, -D / 2 + 0.2, [0.5, 0, 0]); led(k, 'ledG', -W / 2 + 0.2, h + 1.56, -D / 2 + 0.2); }
    // 3 · moldura de luz no chão
    if (lv >= 3) { strip(k, W + 0.8, 'x', 0, 0.05, D / 2 + 0.4); strip(k, W + 0.8, 'x', 0, 0.05, -D / 2 - 0.4); strip(k, D + 0.8, 'z', W / 2 + 0.4, 0.05, 0); strip(k, D + 0.8, 'z', -W / 2 - 0.4, 0.05, 0); }
    // 4 · postes de luz angulares nos cantos
    if (lv >= 4) for (s = -1; s <= 1; s += 2) for (t2 = -1; t2 <= 1; t2 += 2) { bx(k, 'dark', 0.08, 1.5, 0.08, s * (W / 2 + 0.4), 0.75, t2 * (D / 2 + 0.4)); bx(k, 'winOn', 0.3, 0.04, 0.08, s * (W / 2 + 0.4) - s * 0.12, 1.5, t2 * (D / 2 + 0.4)); }
    // 5 · obelisco de vidro escuro com quadros de luz
    if (lv >= 5) { obelisk(k, W / 2 + 0.4, -D / 2 - 0.4, Math.max(5.5, h + 2.5), o); h = Math.max(h, 6); }
    return h; }
  function building(type, def, opts) { var g = grp(), k = new G.Kit(), o = { dyn: {}, lights: [] }; k.extra = []; for (var x in opts || {}) o[x] = opts[x];
    var W = def.w * TS, D = def.h * TS, lv = o.lv || 1, h = lv > 1 && MOD[type] ? MOD[type](k, o, W, D, lv) : B[type](k, o, W, D); if (lv > 1) h = levelKit(k, type, def, W, D, h, lv, o); k.build(g);  k.extra.forEach(function (e) { g.add(e); }); if (o.garden) o.garden.add(garden());
    g.userData.h = h; g.userData.o = o; g.traverse(function (m) { if (m.isMesh) { m.castShadow = m.castShadow && m.material !== M.glass; } }); return g; }

  // ---------- depósitos e rochas ----------
  var rockGeos = null; function rocks() { if (!rockGeos) { rockGeos = []; for (var i = 0; i < 6; i++) rockGeos.push(G.rockGeo(i * 7 + 1, 3)); } return rockGeos; }
  var oreMat = null, regMat = null;
  function deposit(res) { var g = grp(), i, rg = rocks();
    if (!oreMat) { oreMat = G.rockMat(0xc4c2c6, true); regMat = G.rockMat(0xc9b6a6, false, true); }
    if (res === 'metal') { for (i = 0; i < 4; i++) { var m = mesh(rg[i], oreMat, [Math.cos(i * 1.9) * 0.45, 0.15, Math.sin(i * 1.9) * 0.45], [0, i, 0], [0.55 - i * 0.07, 0.5 - i * 0.05, 0.5 - i * 0.06], g); } }
    else { var mound = new T.Mesh(G.rockGeo(9, 3, 0.3), regMat); mound.scale.set(0.62, 0.42, 0.56); mound.position.y = 0.0; mound.castShadow = true; mound.receiveShadow = true; g.add(mound); // monte de cascalho solto, com pedras em volta
      for (i = 0; i < 14; i++) { var ra = i * 2.39, rr = 0.35 + (i % 5) * 0.11; mesh(rg[i % 6], regMat, [Math.cos(ra) * rr, 0.02 + (i < 4 ? 0.18 : 0), Math.sin(ra) * rr], [i, i * 0.7, 0], 0.06 + (i % 4) * 0.03, g); } }
    mesh(G.cyl(0.02, 0.02, 1.1, 5), M.dark, [0.75, 0.55, 0.55], null, null, g); mesh(new T.PlaneGeometry(0.32, 0.2), M.flag, [0.91, 1.0, 0.55], null, null, g);
    return g; }

  // ---------- astronautas ----------
  // Traje no estilo das fichas: tecido branco, placas rígidas, detalhes na cor do ofício (laranja para Elias e Helena),
  // viseira escura espelhada, mochila de suporte com tanques e mangueiras. Cada osso é UMA malha fundida.
  var insMat = null, suitMat = null, lampMats = {}, PAL = null;
  function pal() { if (!PAL) { var L = G.lin; PAL = { W: [L(0xd8d3c8), [0.92, 0]], A: [L(0xe9e6df), [0.42, 0.05]], D: [L(0x26272b), [0.5, 0.45]], R: [L(0x17130f), [0.88, 0]], C: [L(0xc9ccd2), [0.22, 1]], G: [L(0x6a6d73), [0.4, 0.8]] }; } return PAL; }
  function lat(pts, seg) { return G.lathe(pts.slice().sort(function (a, b) { return a[1] - b[1]; }), seg || 14); }
  function ringX(r, t) { return G.torus(r, t, 6, 18); }
  function astronaut(id, inf) { inf = inf || {}; var P = pal(), hero = id === 'elias' || id === 'helena', hsh = 0, q; for (q = 0; q < id.length; q++) hsh = (hsh * 31 + id.charCodeAt(q)) % 997;
    var wS = id === 'helena' ? 0.92 : id === 'elias' ? 1 : 0.9 + (hsh % 14) / 100, hS = id === 'helena' ? 0.96 : id === 'elias' ? 1 : 0.95 + (hsh % 9) / 100;
    var accHex = hero ? 0xe0641c : new T.Color((DATA.jobs[inf.job] || ['', '#e0641c'])[1]).getHex(), AC = [G.lin(accHex), [0.5, 0.05]], lampHex = id === 'elias' ? 0x4ec8ff : id === 'helena' ? 0xffa040 : accHex;
    if (!suitMat) suitMat = G.suitMat(); var lamp = lampMats[lampHex] || (lampMats[lampHex] = new T.MeshStandardMaterial({ color: 0x101010, emissive: lampHex, emissiveIntensity: 2.6 }));
    var root = grp(), pose = grp(); root.add(pose); var rig = { root: root, pose: pose, lamp: lamp }, bones = [];
    function bone(parent, x, y, z) { var g = grp(); g.position.set(x, y, z); parent.add(g); g.userData.k = new G.SuitKit(); bones.push(g); return g; }
    function put(b, geo, c, p, r, s) { b.userData.k.add(geo, c[0], c[1], { p: p, r: r, s: s }); }
    var W = P.W, A = P.A, D = P.D, Rb = P.R, C = P.C, i, s, X = R / 2;
    // quadril
    var hips = bone(pose, 0, 0.98, 0); rig.hips = hips;
    put(hips, lat([[0.001, -0.13], [0.13, -0.12], [0.175, -0.04], [0.18, 0.04], [0.165, 0.1]], 18), W, null, null, [wS, 1, 0.74]);
    put(hips, G.torus(0.172, 0.022, 8, 24), D, [0, 0.08, 0], [X, 0, 0], [wS, 0.76, 1.7]); put(hips, G.rbox(0.07, 0.05, 0.03, 0.01), C, [0, 0.08, 0.135]);
    put(hips, G.rbox(0.09, 0.12, 0.06, 0.02), D, [0.17 * wS, 0, 0.07]); put(hips, G.rbox(0.09, 0.12, 0.06, 0.02), D, [-0.17 * wS, 0, 0.07]); put(hips, G.rbox(0.16, 0.11, 0.06, 0.02), D, [0, 0.0, -0.135]);
    put(hips, G.rbox(0.1, 0.12, 0.035, 0.015), A, [0.09 * wS, -0.06, 0.118], [0.15, 0, 0]); put(hips, G.rbox(0.1, 0.12, 0.035, 0.015), A, [-0.09 * wS, -0.06, 0.118], [0.15, 0, 0]);
    // tronco
    var spine = bone(hips, 0, 0.1, 0); rig.spine = spine;
    put(spine, lat([[0.16, 0], [0.198, 0.1], [0.218, 0.25], [0.214, 0.38], [0.18, 0.48], [0.135, 0.54], [0.115, 0.57]], 22), W, null, null, [wS, 1, 0.8]);
    put(spine, G.rbox(0.5, 0.1, 0.21, 0.05), A, [0, 0.475, -0.005], null, [wS, 1, 1]); put(spine, G.rbox(0.33, 0.25, 0.07, 0.035), A, [0, 0.37, 0.125], null, [wS, 1, 1]); put(spine, G.rbox(0.26, 0.09, 0.055, 0.02), D, [0, 0.215, 0.12], [0.15, 0, 0], [wS, 1, 1]);
    put(spine, G.rbox(0.15, 0.11, 0.045, 0.015), D, [0, 0.34, 0.175]); put(spine, G.cyl(0.012, 0.012, 0.02, 8), C, [0.05, 0.3, 0.2], [X, 0, 0]); put(spine, G.cyl(0.012, 0.012, 0.02, 8), C, [-0.05, 0.3, 0.2], [X, 0, 0]); put(spine, G.rbox(0.055, 0.03, 0.028, 0.008), C, [0, 0.238, 0.178]);
    put(spine, G.torus(0.128, 0.026, 8, 24), C, [0, 0.565, 0], [X, 0, 0]); put(spine, G.cyl(0.105, 0.115, 0.05, 16), D, [0, 0.555, 0]);
    put(spine, G.rbox(0.34, 0.47, 0.17, 0.08, 4), A, [0, 0.31, -0.205], null, [wS, 1, 1]); put(spine, G.rbox(0.28, 0.09, 0.15, 0.03), D, [0, 0.585, -0.205]); put(spine, G.rbox(0.24, 0.13, 0.04, 0.015), D, [0, 0.42, -0.305]); put(spine, G.rbox(0.3, 0.06, 0.17, 0.02), P.G, [0, 0.04, -0.21]);
    for (i = 0; i < 4; i++) put(spine, G.rbox(0.2, 0.016, 0.02, 0.006), D, [0, 0.12 + i * 0.035, -0.312]);
    for (s = -1; s <= 1; s += 2) { var sx = s * 0.255 * wS;
      put(spine, G.rbox(0.05, 0.25, 0.075, 0.02), AC, [s * 0.115 * wS, 0.37, 0.13]); put(spine, G.rbox(0.03, 0.46, 0.018, 0.007), D, [s * 0.075 * wS, 0.31, 0.168], [0, 0, -s * 0.3]);
      put(spine, G.rbox(0.045, 0.4, 0.16, 0.02), AC, [s * 0.185 * wS, 0.31, -0.205]); put(spine, G.capsule(0.042, 0.3, 10), C, [s * 0.225 * wS, 0.28, -0.19]);
      put(spine, G.tube([[s * 0.11, 0.6, -0.16], [s * 0.19, 0.62, -0.02], [s * 0.15, 0.5, 0.1], [s * 0.09, 0.42, 0.165]], 0.014, 14), D);
      put(spine, G.sphere(0.092, 16, 12), W, [sx, 0.46, 0]); put(spine, G.sphere(0.086, 16, 10, 0, R * 2, 0, R * 0.42), AC, [sx + s * 0.012, 0.47, 0], [0, 0, -s * 0.35], [1.0, 0.8, 1.0]); }
    if (id === 'elias') put(spine, G.cyl(0.006, 0.006, 0.34, 4), D, [0.14, 0.78, -0.2]);
    mesh(G.rbox(0.075, 0.04, 0.01, 0.004), lamp, [0, 0.355, 0.199], null, null, spine, true); mesh(G.sphere(0.018, 6, 5), lamp, [0.11, 0.6, -0.27], null, null, spine, true);
    if (!insMat) insMat = new T.MeshStandardMaterial({ map: G.decal(function (x, w) { G.insignia(x, w, false); }, 128, 128), transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
    mesh(new T.PlaneGeometry(0.13, 0.13), insMat, [0, 0.27, -0.312], [0, R, 0], null, spine, true);
    // capacete
    var head = bone(spine, 0, 0.64, 0); rig.head = head;
    put(head, G.sphere(0.198, 28, 20), A, [0, 0.04, 0]); put(head, G.torus(0.2, 0.018, 6, 30, R), AC, [0, 0.04, 0], [0, X, 0]);
     put(head, G.rbox(0.16, 0.1, 0.05, 0.02), D, [0, -0.02, -0.16]); put(head, G.rbox(0.2, 0.04, 0.06, 0.02), D, [0, -0.11, 0.105]);
    for (s = -1; s <= 1; s += 2) { put(head, G.cyl(0.045, 0.05, 0.045, 12), A, [s * 0.198, 0.03, -0.02], [0, 0, X]); mesh(G.cyl(0.018, 0.018, 0.03, 8), lamp, [s * 0.19, 0.1, 0.08], [X, 0, 0], null, head, true); }
    if (id === 'elias') put(head, G.cyl(0.006, 0.006, 0.22, 4), D, [-0.17, 0.15, -0.04]);
    mesh(G.sphere(0.203, 32, 20, R * 0.1, R * 0.8, R * 0.2, R * 0.52), M.visor, [0, 0.04, 0], null, null, head);
    mesh(G.torus(0.204, 0.013, 6, 30, R * 0.82), M.visorRim, [0, 0.04 + 0.203 * Math.cos(R * 0.2), 0], [X, 0, R * 0.09], [Math.sin(R * 0.2), Math.sin(R * 0.2), 1], head);
    // braços
    rig.arms = []; rig.fore = [];
    for (s = -1; s <= 1; s += 2) { var ua = bone(spine, s * 0.255 * wS, 0.47, 0);
      put(ua, lat([[0.078, 0], [0.084, -0.08], [0.076, -0.22], [0.066, -0.29]], 16), W); put(ua, ringX(0.08, 0.016), AC, [0, -0.1, 0], [X, 0, 0]);
      put(ua, ringX(0.068, 0.016), W, [0, -0.262, 0], [X, 0, 0]); put(ua, G.sphere(0.064, 12, 10), W, [0, -0.3, -0.006]);
      var fa = bone(ua, 0, -0.3, 0); put(fa, lat([[0.066, 0], [0.072, -0.06], [0.066, -0.18], [0.056, -0.235]], 16), W); put(fa, ringX(0.068, 0.014), W, [0, -0.035, 0], [X, 0, 0]);
      put(fa, ringX(0.07, 0.022), AC, [0, -0.15, 0], [X, 0, 0]); put(fa, G.torus(0.047, 0.012, 6, 16), C, [0, -0.238, 0], [X, 0, 0]);
      put(fa, G.rbox(0.075, 0.08, 0.042, 0.018), Rb, [0, -0.285, 0.004]); put(fa, G.rbox(0.07, 0.055, 0.034, 0.014), Rb, [0, -0.345, 0.014], [0.25, 0, 0]); put(fa, G.capsule(0.014, 0.035, 6), Rb, [-s * 0.04, -0.28, 0.03], [0.5, 0, s * 0.5]); put(fa, G.rbox(0.07, 0.025, 0.02, 0.008), D, [0, -0.262, 0.026]);
      if (s === -1) { put(fa, G.rbox(0.06, 0.08, 0.02, 0.008), D, [0, -0.12, 0.062]); mesh(G.rbox(0.045, 0.06, 0.008, 0.003), lamp, [0, -0.12, 0.074], null, null, fa, true); }
      rig.arms.push(ua); rig.fore.push(fa); }
    // pernas
    rig.thigh = []; rig.shin = []; rig.foot = [];
    for (s = -1; s <= 1; s += 2) { var th = bone(hips, s * 0.1 * wS, -0.05, 0);
      put(th, lat([[0.104, 0], [0.11, -0.07], [0.098, -0.28], [0.082, -0.4], [0.078, -0.44]], 18), W); put(th, G.rbox(0.11, 0.15, 0.04, 0.03), A, [0, -0.2, 0.088]);
      put(th, G.torus(0.094, 0.013, 6, 18), D, [0, -0.09, 0], [X, 0, 0]); put(th, ringX(0.084, 0.015), W, [0, -0.375, 0], [X, 0, 0]); put(th, ringX(0.081, 0.015), W, [0, -0.405, 0], [X, 0, 0]);
      if (s === 1) { put(th, G.rbox(0.05, 0.13, 0.11, 0.02), D, [0.1, -0.24, 0]); put(th, G.rbox(0.052, 0.03, 0.112, 0.01), AC, [0.1, -0.19, 0]); }
      var sn = bone(th, 0, -0.44, 0); put(sn, G.sphere(0.085, 14, 10), W, [0, 0, 0.01]); put(sn, G.rbox(0.1, 0.09, 0.05, 0.03), AC, [0, 0.0, 0.07]);
      put(sn, lat([[0.082, 0], [0.09, -0.09], [0.08, -0.28], [0.074, -0.39], [0.078, -0.43]], 18), W); put(sn, G.rbox(0.1, 0.18, 0.04, 0.03), A, [0, -0.2, 0.068]);
      put(sn, G.torus(0.078, 0.016, 6, 18), D, [0, -0.41, 0], [X, 0, 0]);
      var ft = bone(sn, 0, -0.44, 0); put(ft, G.cyl(0.082, 0.09, 0.12, 16), W, [0, 0.0, 0]); put(ft, G.capsule(0.075, 0.13, 12), A, [0, -0.04, 0.05], [X, 0, 0], [1.05, 1, 0.8]);
      put(ft, G.rbox(0.15, 0.04, 0.29, 0.02, 3), D, [0, -0.09, 0.05]); put(ft, G.rbox(0.13, 0.03, 0.06, 0.012), AC, [0, 0.04, 0.09]);
      rig.thigh.push(th); rig.shin.push(sn); rig.foot.push(ft); }
    bones.forEach(function (b) { b.add(b.userData.k.mesh(suitMat)); b.userData = {}; });
    var cargo = mesh(G.rbox(0.36, 0.26, 0.26, 0.05), M.paint, [0, 0.25, 0.32], null, null, spine); cargo.visible = false; rig.cargo = cargo;
    var pick = grp(); pick.position.set(0, -0.33, 0.02); rig.fore[0].add(pick); mesh(G.cyl(0.013, 0.013, 0.62, 6), M.dark, [0, 0, 0.18], [R / 2, 0, 0], null, pick); mesh(G.rbox(0.05, 0.05, 0.05, 0.01), M.metal, [0, 0, 0.47], null, null, pick); mesh(G.cone ? G.cone(0.02, 0.2, 6) : G.cyl(0.003, 0.025, 0.24, 6), M.metal, [0, 0.12, 0.47], null, null, pick); mesh(G.cyl(0.025, 0.003, 0.18, 6), M.metal, [0, -0.1, 0.47], null, null, pick); pick.visible = false; rig.pick = pick;
    root.scale.setScalar(hS); rig.cur = {}; return rig; }

  // Poses: alvo de ângulos para cada estado; a transição é suave.
  var KEYS = ['hy', 'sx', 'sy', 'hx', 'a0x', 'a0z', 'a1x', 'a1z', 'f0', 'f1', 't0', 't1', 's0', 's1', 'k0', 'k1', 'lie'];
  function animate(rig, st, t, dt, speed) { var tg = {}, k, ph = t * 8.5 * (speed || 1);
    for (k = 0; k < KEYS.length; k++) tg[KEYS[k]] = 0; tg.hy = 0.98; tg.a0z = 0.1; tg.a1z = -0.1; tg.f0 = -0.15; tg.f1 = -0.15; var br = Math.sin(t * 1.8);
    if (st === 'walk') { var s = Math.sin(ph); tg.t0 = -s * 0.55; tg.t1 = s * 0.55; tg.s0 = Math.max(0, Math.sin(ph + 1.9)) * 1.1 + 0.08; tg.s1 = Math.max(0, Math.sin(ph + 1.9 + R)) * 1.1 + 0.08; tg.k0 = -tg.t0 * 0.3 - tg.s0 * 0.4; tg.k1 = -tg.t1 * 0.3 - tg.s1 * 0.4;
      tg.a0x = -s * 0.42; tg.a1x = s * 0.42; tg.f0 = -0.35 - Math.max(0, -s) * 0.3; tg.f1 = -0.35 - Math.max(0, s) * 0.3; tg.hy = 0.96 + Math.abs(Math.cos(ph)) * 0.035; tg.sy = s * 0.09; tg.sx = 0.06; }
    else if (st === 'carry') { s = Math.sin(ph); tg.t0 = -s * 0.5; tg.t1 = s * 0.5; tg.s0 = Math.max(0, Math.sin(ph + 1.9)) * 1.0 + 0.08; tg.s1 = Math.max(0, Math.sin(ph + 1.9 + R)) * 1.0 + 0.08; tg.a0x = tg.a1x = -0.55; tg.f0 = tg.f1 = -1.1; tg.a0z = 0.05; tg.a1z = -0.05; tg.hy = 0.96 + Math.abs(Math.cos(ph)) * 0.03; tg.sx = -0.05; }
    else if (st === 'work') { tg.a0x = -1.15 + Math.sin(t * 6) * 0.3; tg.a1x = -1.0 + Math.cos(t * 6.4) * 0.3; tg.f0 = -0.7 + Math.sin(t * 6 + 1) * 0.25; tg.f1 = -0.6; tg.sx = 0.18; tg.t0 = -0.12; tg.t1 = 0.14; tg.s0 = 0.2; tg.s1 = 0.05; tg.hy = 0.95; tg.hx = 0.2; }
    else if (st === 'aim') { var rc = Math.max(0, Math.sin(t * 22)) * 0.06; tg.a0x = -1.5 + rc; tg.a1x = -1.3 + rc; tg.a0z = 0.12; tg.a1z = -0.5; tg.f0 = -0.12; tg.f1 = -0.6; tg.sx = 0.08; tg.hx = 0.05; }
    else if (st === 'mine') { var w = Math.pow(0.5 + 0.5 * Math.sin(t * 4.2), 1.6); tg.a0x = tg.a1x = -0.75 - 2.0 * w; tg.a0z = 0.16; tg.a1z = -0.16; tg.f0 = tg.f1 = -0.25 - 0.3 * w; tg.sx = 0.38 - 0.3 * w; tg.hx = 0.1; tg.t0 = -0.3; tg.t1 = 0.25; tg.s0 = 0.35; tg.s1 = 0.15; tg.hy = 0.93; }
    else if (st === 'crouch') { tg.t0 = tg.t1 = -1.3; tg.s0 = tg.s1 = 2.0; tg.k0 = tg.k1 = -0.7; tg.hy = 0.6; tg.sx = 0.45; tg.hx = 0.25; tg.a0x = -0.7 + Math.sin(t * 5) * 0.3; tg.a1x = -0.55 + Math.cos(t * 5.5) * 0.3; tg.f0 = tg.f1 = -0.5; }
    else if (st === 'look') { tg.hx = -0.35; tg.sx = -0.06; tg.a0z = 0.06; tg.a1z = -0.06; tg.f0 = tg.f1 = -0.1; }
    else if (st === 'lie') { tg.lie = 1; tg.a0z = 0.5; tg.a1z = -0.4; tg.t0 = 0.1; tg.t1 = -0.15; tg.s0 = 0.3; }
    else { tg.sx = br * 0.015; tg.hx = br * 0.02; }
    var c = rig.cur, r = Math.min(1, dt * 10); for (k in tg) c[k] = c[k] == null ? tg[k] : c[k] + (tg[k] - c[k]) * r;
    rig.hips.position.y = c.hy; rig.spine.rotation.set(c.sx, c.sy, 0); rig.head.rotation.x = c.hx;
    rig.arms[0].rotation.set(c.a0x, 0, -c.a0z); rig.arms[1].rotation.set(c.a1x, 0, -c.a1z); rig.fore[0].rotation.x = c.f0; rig.fore[1].rotation.x = c.f1;
    rig.thigh[0].rotation.x = c.t0; rig.thigh[1].rotation.x = c.t1; rig.shin[0].rotation.x = c.s0; rig.shin[1].rotation.x = c.s1; rig.foot[0].rotation.x = c.k0; rig.foot[1].rotation.x = c.k1;
    rig.pose.rotation.x = -c.lie * R / 2; rig.pose.position.y = c.lie * 0.22; rig.pose.position.z = c.lie * 0.9; }

  // ---------- veículos (branco, laranja e preto, como na arte) ----------
  function wheel(par, x, y, z, r, w) { var g = grp(); g.position.set(x, y, z); var k = new G.Kit(); k.add('tire', G.cyl(r, r, w, 18), { r: [0, 0, R / 2] }); for (var i = 0; i < 8; i++) k.add('tire', G.rbox(w * 1.02, 0.07, 0.16, 0.02), { p: [0, Math.cos(i * R / 4) * r, Math.sin(i * R / 4) * r], r: [i * R / 4, 0, 0] });
    k.add('dark', G.cyl(r * 0.62, r * 0.62, w + 0.02, 12), { r: [0, 0, R / 2] }); k.add('paint', G.cyl(r * 0.64, r * 0.64, w * 0.4, 16), { p: [x > 0 ? w * 0.32 : -w * 0.32, 0, 0], r: [0, 0, R / 2] }); k.build(g); par.add(g); return g; }
  function vehicle(type) { var root = grp(), body = grp(), k = new G.Kit(), wh = [], i, s; root.add(body);
    if (type === 'rover' || type === 'rover_a') { // 6 rodas, cabine com vidro, faixas laranja
      k.add('dark', G.rbox(2.3, 0.5, 5.2, 0.08), { p: [0, 1.0, 0] }); k.add('hull', G.rbox(2.4, 1.3, 3.2, 0.12), { p: [0, 1.9, -0.6] }); k.add('hull', G.rbox(2.3, 0.9, 1.8, 0.1), { p: [0, 1.65, 1.6] });
      k.add('facade', G.rbox(2.0, 0.5, 0.05, 0.02), { p: [0, 2.0, 2.0], r: [-0.5, 0, 0], uv: 'keep' }); for (s = -1; s <= 1; s += 2) { k.add('facade', G.rbox(0.05, 0.45, 1.6, 0.02), { p: [s * 1.21, 2.15, -0.5], uv: 'keep' }); k.add('paint', G.rbox(0.06, 0.9, 0.5, 0.02), { p: [s * 1.22, 1.9, 0.9], r: [0, 0, 0], uv: 'keep' }); k.add('paint', G.rbox(0.05, 0.12, 3.0, 0.02), { p: [s * 1.22, 1.35, -0.4] }); }
      k.add('screenOn', G.rbox(0.5, 0.08, 0.04, 0.01), { p: [0.6, 1.6, 2.52], uv: 'keep' }); k.add('screenOn', G.rbox(0.5, 0.08, 0.04, 0.01), { p: [-0.6, 1.6, 2.52], uv: 'keep' }); k.add('dark', G.rbox(2.2, 0.3, 0.3, 0.05), { p: [0, 1.1, 2.6] });
      k.add('dark', G.rbox(1.6, 0.25, 2.4, 0.05), { p: [0, 2.65, -0.8] }); k.add('metal', G.rod([0.8, 2.7, -2.0], [0.8, 3.6, -2.0], 0.02)); k.add('metal', G.rod([-0.8, 2.7, -2.0], [-0.8, 3.3, -2.0], 0.02)); k.add('dark', G.rbox(0.5, 0.25, 0.4, 0.04), { p: [0, 2.85, 0.6] });
      if (type === 'rover_a') { var tg2 = grp(); tg2.position.set(0, 2.85, -0.6); var gk = new G.Kit(); gk.add('armor', G.rbox(0.9, 0.45, 0.9, 0.06), {}); gk.add('dark', G.cyl(0.06, 0.07, 1.4, 8), { p: [0, 0.05, 1.0], r: [R / 2, 0, 0] }); gk.add('paint', G.rbox(0.92, 0.06, 0.4, 0.02), { p: [0, 0.2, -0.2] }); gk.build(tg2); body.add(tg2); root.userData.turret = tg2; }
      for (s = -1; s <= 1; s += 2) for (i = -1; i <= 1; i++) wh.push(wheel(body, s * 1.35, 0.62, i * 1.75, 0.62, 0.55)); }
    else if (type === 'tank' || type === 'arty') { // lagartas pressurizadas, casco angular, canhão
      k.add('dark', G.rbox(3.0, 0.9, 5.2, 0.1), { p: [0, 0.7, 0] }); for (s = -1; s <= 1; s += 2) { k.add('tire', G.rbox(0.75, 1.05, 5.6, 0.45, 4), { p: [s * 1.45, 0.55, 0] }); for (i = -2; i <= 2; i++) k.add('metal', G.cyl(0.3, 0.3, 0.78, 12), { p: [s * 1.45, 0.45, i * 1.05], r: [0, 0, R / 2] }); k.add('armor', G.rbox(0.9, 0.35, 5.4, 0.06), { p: [s * 1.45, 1.15, 0] }); k.add('paint', G.rbox(0.92, 0.06, 1.6, 0.02), { p: [s * 1.45, 1.35, 1.6] }); }
      k.add('armor', G.rbox(2.6, 0.7, 4.6, 0.12), { p: [0, 1.5, -0.1] }); k.add('armor', G.rbox(2.6, 0.5, 1.2, 0.08), { p: [0, 1.35, 2.5], r: [0.45, 0, 0] }); k.add('screenOn', G.rbox(0.8, 0.07, 0.04, 0.01), { p: [0.6, 1.25, 2.95], uv: 'keep' }); k.add('screenOn', G.rbox(0.8, 0.07, 0.04, 0.01), { p: [-0.6, 1.25, 2.95], uv: 'keep' });
      var tur = grp(); tur.position.set(0, 2.05, -0.3); var tk = new G.Kit();
      if (type === 'tank') { tk.add('armor', G.rbox(2.0, 0.65, 2.4, 0.12), {}); tk.add('paint', G.rbox(2.02, 0.08, 1.2, 0.02), { p: [0, 0.25, -0.3] }); tk.add('dark', G.cyl(0.13, 0.16, 3.6, 12), { p: [0, 0.05, 2.9], r: [R / 2, 0, 0] }); tk.add('dark', G.cyl(0.2, 0.2, 0.45, 12), { p: [0, 0.05, 4.6], r: [R / 2, 0, 0] }); tk.add('facade', G.rbox(0.5, 0.2, 0.04, 0.01), { p: [0.55, 0.15, 1.21], uv: 'keep' }); tk.add('metal', G.rod([0.6, 0.35, -0.8], [0.6, 1.3, -0.8], 0.02)); }
      else { tk.add('armor', G.rbox(1.8, 0.8, 1.8, 0.1), {}); tk.add('dark', G.cyl(0.22, 0.26, 4.8, 12), { p: [0, 1.2, 1.8], r: [R / 2 - 0.55, 0, 0] }); tk.add('dark', G.rbox(0.8, 0.8, 0.9, 0.1), { p: [0, 0.3, 0.6] }); tk.add('paint', G.rbox(1.82, 0.08, 1.82, 0.02), { p: [0, 0.41, 0] }); }
      tk.build(tur); body.add(tur); root.userData.turret = tur; }
    else if (type === 'scout') { // quadriciclo explorador
      k.add('dark', G.rbox(1.0, 0.3, 2.4, 0.06), { p: [0, 0.75, 0] }); k.add('hull', G.rbox(1.1, 0.45, 1.3, 0.1), { p: [0, 1.05, 0.5] }); k.add('paint', G.rbox(1.12, 0.12, 0.8, 0.04), { p: [0, 1.2, 0.6] });
      k.add('dark', G.rbox(0.5, 0.25, 0.7, 0.06), { p: [0, 1.2, -0.4] }); k.add('metal', G.rod([0, 1.3, 1.0], [0, 1.65, 0.75], 0.03)); k.add('metal', G.rod([-0.35, 1.65, 0.75], [0.35, 1.65, 0.75], 0.025)); k.add('screenOn', G.rbox(0.4, 0.06, 0.04, 0.01), { p: [0, 1.0, 1.17], uv: 'keep' }); k.add('metal', G.rod([0.4, 1.0, -1.0], [0.4, 2.0, -1.0], 0.015));
      for (s = -1; s <= 1; s += 2) for (i = -1; i <= 1; i += 2) wh.push(wheel(body, s * 0.75, 0.45, i * 0.85, 0.45, 0.38)); }
    else { // resgate: furgão branco com cruz vermelha
      k.add('dark', G.rbox(2.0, 0.4, 4.2, 0.08), { p: [0, 0.85, 0] }); k.add('hull', G.rbox(2.1, 1.6, 2.8, 0.15), { p: [0, 1.85, -0.5] }); k.add('hull', G.rbox(2.0, 1.0, 1.4, 0.12), { p: [0, 1.5, 1.5] });
      k.add('facade', G.rbox(1.8, 0.5, 0.05, 0.02), { p: [0, 1.95, 1.85], r: [-0.55, 0, 0], uv: 'keep' }); for (s = -1; s <= 1; s += 2) { k.add('redX', G.rbox(0.05, 0.7, 0.22, 0.01), { p: [s * 1.06, 2.0, -0.5] }); k.add('redX', G.rbox(0.05, 0.22, 0.7, 0.01), { p: [s * 1.06, 2.0, -0.5] }); k.add('paint', G.rbox(0.05, 0.12, 2.6, 0.02), { p: [s * 1.06, 1.25, -0.4] }); }
      k.add('dark', G.rbox(0.9, 0.12, 0.3, 0.03), { p: [0, 2.72, 0.5] }); k.add('ledR', G.rbox(0.3, 0.1, 0.2, 0.02), { p: [-0.25, 2.8, 0.5], uv: 'keep' }); k.add('screenOn', G.rbox(0.3, 0.1, 0.2, 0.02), { p: [0.25, 2.8, 0.5], uv: 'keep' });
      for (s = -1; s <= 1; s += 2) for (i = -1; i <= 1; i += 2) wh.push(wheel(body, s * 1.15, 0.55, i * 1.35, 0.55, 0.45)); }
    k.build(body); root.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return { root: root, body: body, wheels: wh, veh: true, cur: {}, turret: root.userData.turret || null }; }
  // ---------- o que vem do gelo ----------
  function alien(type) { var root = grp(), body = grp(), k = new G.Kit(), legs = [], i; root.add(body);
    if (type === 'colossus') { k.add('chitin', G.sphere(1.4, 16, 12), { p: [0, 2.6, -0.3], s: [1, 0.8, 1.4] }); k.add('chitin', G.sphere(0.8, 14, 10), { p: [0, 2.9, 1.7], s: [1, 0.8, 1] }); for (i = 0; i < 7; i++) k.add('chitin', G.cyl(0.0, 0.35, 1.3, 4), { p: [(i % 2 ? 0.5 : -0.5), 3.6, -1.6 + i * 0.5], r: [-0.3, 0, (i % 2 ? -0.3 : 0.3)] });
      k.add('alienGlow2', G.sphere(0.5, 12, 8), { p: [0, 2.4, 0.4] }); k.add('alienGlow', G.rbox(0.1, 0.1, 2.6, 0.02), { p: [0.9, 2.5, -0.3], uv: 'keep' }); k.add('alienGlow', G.rbox(0.1, 0.1, 2.6, 0.02), { p: [-0.9, 2.5, -0.3], uv: 'keep' }); k.add('alienGlow', G.sphere(0.12, 8, 6), { p: [0.3, 3.0, 2.5] }); k.add('alienGlow', G.sphere(0.12, 8, 6), { p: [-0.3, 3.0, 2.5] }); }
    else if (type === 'spitter') { k.add('chitin', G.sphere(0.45, 14, 10), { p: [0, 1.15, -0.1], s: [1, 1.3, 1.1] }); k.add('alienGlow2', G.sphere(0.32, 12, 8), { p: [0, 1.5, -0.35] }); k.add('chitin', G.sphere(0.25, 10, 8), { p: [0, 1.0, 0.45], s: [1, 0.8, 1.3] }); k.add('alienGlow2', G.sphere(0.06, 6, 5), { p: [0.1, 1.05, 0.72] }); k.add('alienGlow2', G.sphere(0.06, 6, 5), { p: [-0.1, 1.05, 0.72] }); }
    else { k.add('chitin', G.sphere(0.5, 14, 10), { p: [0, 0.55, -0.2], s: [0.9, 0.55, 1.5] }); k.add('chitin', G.sphere(0.32, 12, 8), { p: [0, 0.6, 0.6], s: [1, 0.7, 1.1] }); for (i = 0; i < 4; i++) k.add('chitin', G.cyl(0.0, 0.12, 0.35, 4), { p: [0, 0.82, -0.6 + i * 0.3], r: [-0.4, 0, 0] });
      k.add('alienGlow', G.rbox(0.05, 0.04, 0.9, 0.01), { p: [0.32, 0.6, -0.2], uv: 'keep' }); k.add('alienGlow', G.rbox(0.05, 0.04, 0.9, 0.01), { p: [-0.32, 0.6, -0.2], uv: 'keep' }); k.add('alienGlow', G.sphere(0.05, 6, 5), { p: [0.12, 0.66, 0.92] }); k.add('alienGlow', G.sphere(0.05, 6, 5), { p: [-0.12, 0.66, 0.92] });
      k.add('chitin', G.rod([0.12, 0.5, 0.85], [0.3, 0.2, 1.25], 0.035, 5)); k.add('chitin', G.rod([-0.12, 0.5, 0.85], [-0.3, 0.2, 1.25], 0.035, 5)); }
    k.build(body);
    for (i = 0; i < 6; i++) { var s = i < 3 ? 1 : -1, z = -0.5 + (i % 3) * 0.45, lg = grp(); var big = type === 'colossus' ? 3 : 1, ly = type === 'spitter' ? 0.95 : 0.55 * big; lg.position.set(s * 0.3 * big, ly, z * big); var lk = new G.Kit(); lk.add('chitin', G.rod([0, 0, 0], [s * 0.55 * big, 0.3 * big, 0], 0.04 * big, 5)); lk.add('chitin', G.rod([s * 0.55 * big, 0.3 * big, 0], [s * 0.85 * big, -ly, 0], 0.03 * big, 5)); lk.build(lg); body.add(lg); legs.push(lg); }
    root.traverse(function (m) { if (m.isMesh) { m.castShadow = true; } }); return { root: root, body: body, legs: legs, type: type }; }
  function animAlien(a, t, moving, attack) { var sp = moving ? 14 : attack ? 6 : 2; a.legs.forEach(function (l, i) { l.rotation.x = Math.sin(t * sp + i * 1.9) * (moving ? 0.45 : 0.1); l.rotation.z = Math.sin(t * sp + i * 1.9 + 1.5) * (moving ? 0.18 : 0.04); });
    a.body.position.y = Math.abs(Math.sin(t * sp * 0.5)) * (moving ? 0.06 : 0.02); a.body.rotation.x = attack ? Math.sin(t * 9) * 0.25 : 0; }
  function relic() { var g = grp(), k = new G.Kit(), i; // a estrutura enterrada: lâminas escuras saindo do gelo, com veios de luz
    for (i = 0; i < 7; i++) { var a = i * 0.9, r = i ? 1.6 + (i % 3) * 0.6 : 0, h = i ? 2.2 + (i % 4) * 0.9 : 6.5; k.add('relic', G.cyl(0.05, i ? 0.45 : 0.9, h, 4), { p: [Math.cos(a) * r, h / 2 - 0.4, Math.sin(a) * r], r: [Math.sin(a) * 0.25, a, Math.cos(a) * 0.2] });
      k.add('alienGlow', G.rbox(0.04, h * 0.7, 0.04, 0.01), { p: [Math.cos(a) * r + 0.12, h * 0.4, Math.sin(a) * r], r: [Math.sin(a) * 0.25, a, Math.cos(a) * 0.2], uv: 'keep' }); }
    k.add('relic', G.cyl(4.2, 4.8, 0.5, 9), { p: [0, 0.0, 0] }); k.add('chitin', G.cyl(3.2, 4.0, 0.35, 9), { p: [0, 0.3, 0] }); k.add('alienGlow', G.torus(3.0, 0.05, 6, 40), { p: [0, 0.3, 0], r: [R / 2, 0, 0] }); k.build(g); g.userData.lights = [[0, 3.5, 0, 0x3cf0e0, 30, 2]]; return g; }
  function rifle(kind) { var g = grp(), k = new G.Kit(), L = kind === 'shotgun' ? 0.7 : kind === 'smg' ? 0.55 : 0.85; // arma da Guarda, nas cores da colônia
    k.add('dark', G.rbox(0.07, 0.11, L, 0.015), { p: [0, 0, L / 2 - 0.15] }); k.add('hull', G.rbox(0.075, 0.08, L * 0.45, 0.015), { p: [0, 0.05, L * 0.3] }); k.add('paint', G.rbox(0.078, 0.03, L * 0.25, 0.01), { p: [0, 0.07, L * 0.15] });
    k.add('dark', G.cyl(0.018, 0.018, 0.3, 6), { p: [0, 0.01, L - 0.05], r: [R / 2, 0, 0] }); k.add('dark', G.rbox(0.05, 0.14, 0.05, 0.01), { p: [0, -0.1, L * 0.35], r: [0.3, 0, 0] }); k.add('dark', G.rbox(0.05, 0.1, 0.18, 0.01), { p: [0, -0.02, -0.18] }); if (kind !== 'shotgun') k.add('screenOn', G.rbox(0.04, 0.04, 0.08, 0.01), { p: [0, 0.11, L * 0.3], uv: 'keep' });
    k.build(g); return g; }

  return { vehicle: vehicle, alien: alien, animAlien: animAlien, relic: relic, rifle: rifle, building: building, ark: ark, astronaut: astronaut, animate: animate, deposit: deposit, bed: bed, rocks: rocks, B: B };
})();
