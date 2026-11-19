// ============================================================
// SIM — simulação pura (sem DOM, sem 3D). Testável em Node.
// Estado serializável em s; dados de execução em s.rt.
// ============================================================
var Sim = (function () {
  var D = (typeof DATA !== 'undefined') ? DATA : require('./data.js');
  var B = D.bal, N = B.N, HS = B.solSec / 24, BD = D.buildings;
  var SUIT_UNITS = B.o2PerHour * B.suitHours;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function rnd(s) { s.rs = (s.rs + 0x6D2B79F5) | 0; var t = s.rs; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function fmt(tpl, v) { return tpl.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }

  // ---------------- MAPA ----------------
  function genMap(seed) {
    function hsh(i, j, k) { var x = Math.sin(i * 127.1 + j * 311.7 + seed * 0.731 + k * 57.3) * 43758.5453; return x - Math.floor(x); }
    function vn(x, z, k) { var i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j; fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
      var a = hsh(i, j, k), b = hsh(i + 1, j, k), c = hsh(i, j + 1, k), d = hsh(i + 1, j + 1, k); return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz; }
    var C = N / 2, V = N + 1, h = new Float32Array(V * V), rock = new Uint8Array(N * N), steep = new Uint8Array(N * N), ice = new Uint8Array(N * N);
    var craters = [], i, x, z;
    for (i = 0; i < 48; i++) { var a = hsh(i, 9, 3) * 6.283, r = 17 + hsh(i, 4, 5) * (i < 6 ? 14 : N / 2 - 26); craters.push({ x: C + Math.cos(a) * r, z: C + Math.sin(a) * r, r: 3.5 + hsh(i, 2, 7) * 3.5, d: 1.2 + hsh(i, 8, 1) }); }
    var iceC = [{ x: C - 11, z: C - 10, r: 3.2 }, { x: C + 19, z: C + 15, r: 3.6 }, { x: C - 31, z: C + 27, r: 4.6 }, { x: C + 35, z: C - 29, r: 4.2 }, { x: C + 5, z: C - 41, r: 3.8 }, { x: C - 68, z: C - 40, r: 7 }, { x: C + 72, z: C + 52, r: 6 }, { x: C - 20, z: C + 84, r: 8 }, { x: C + 90, z: C - 70, r: 6.5 }, { x: C - 95, z: C + 30, r: 5.5 }];
    for (z = 0; z < V; z++) for (x = 0; x < V; x++) {
      var d = Math.hypot(x - C, z - C);
      var f = vn(x / 15, z / 15, 0) + vn(x / 6, z / 6, 1) * 0.4 + vn(x / 2.4, z / 2.4, 2) * 0.1;
      var y = (f - 0.75) * 4.2 * smooth(7, 22, d) + smooth(24, 38, d) * vn(x / 9, z / 9, 4) * 3.2 + smooth(36, 46, d) * smooth(0.56, 0.68, vn(x / 13, z / 13, 9)) * 3.6 + smooth(46, 80, d) * (vn(x / 34, z / 34, 14) - 0.4) * 7 + smooth(60, 100, d) * smooth(0.6, 0.72, vn(x / 22, z / 22, 15)) * 6;
      // pequeno cânion a leste
      var cx = x - (C + 24 + Math.sin(z / 7) * 3); if (Math.abs(cx) < 3 && z > 8 && z < N - 8) y -= (1 - Math.abs(cx) / 3) * 2.6;
      var cz2 = z - (C - 58 + Math.sin(x / 11) * 6); if (Math.abs(cz2) < 4.5 && x > C - 110 && x < C + 40) y -= (1 - Math.abs(cz2) / 4.5) * 4; // Vale Grande, ao norte
      for (i = 0; i < craters.length; i++) { var c = craters[i], dd = Math.hypot(x - c.x, z - c.z) / c.r; if (dd < 1) y -= c.d * (1 - dd * dd); if (dd < 1.35) y += 0.4 * c.d * Math.max(0, 1 - Math.abs(dd - 1) / 0.35); }
      for (i = 0; i < iceC.length; i++) { var q = Math.hypot(x - iceC[i].x, z - iceC[i].z); y *= smooth(2, 7, q) * 0.8 + 0.2; }
      h[z * V + x] = y;
    }
    var rocks = [];
    for (z = 0; z < N; z++) for (x = 0; x < N; x++) {
      var k = z * N + x, a0 = h[z * V + x], a1 = h[z * V + x + 1], a2 = h[(z + 1) * V + x], a3 = h[(z + 1) * V + x + 1];
      var sl = Math.max(a0, a1, a2, a3) - Math.min(a0, a1, a2, a3); if (sl > 0.8) steep[k] = 1;
      for (i = 0; i < iceC.length; i++) if (Math.hypot(x + 0.5 - iceC[i].x, z + 0.5 - iceC[i].z) < iceC[i].r + (hsh(x, z, 6) - 0.5)) ice[k] = 1;
      var dc = Math.hypot(x + 0.5 - C, z + 0.5 - C);
      var p = 0.035 + vn(x / 5, z / 5, 8) * 0.07; if (dc < 6 || ice[k]) p = 0; else if (dc < 11) p *= 0.4;
      if (hsh(x, z, 11) < p) { rock[k] = 1; rocks.push({ x: x + 0.5, z: z + 0.5, s: 0.5 + hsh(x, z, 12) * 0.7, r: hsh(x, z, 13) * 6.28 }); }
    }
    return { N: N, V: V, h: h, rock: rock, steep: steep, ice: ice, rocks: rocks, iceC: iceC,
      hAt: function (fx, fz) { var x0 = clamp(Math.floor(fx), 0, N - 1), z0 = clamp(Math.floor(fz), 0, N - 1), tx = clamp(fx - x0, 0, 1), tz = clamp(fz - z0, 0, 1);
        var a = h[z0 * V + x0], b = h[z0 * V + x0 + 1], c = h[(z0 + 1) * V + x0], d = h[(z0 + 1) * V + x0 + 1]; return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz; } };
  }

  // ---------------- ESTADO ----------------
  function newGame(seed) {
    seed = seed || 2032;
    var s = { v: 3, seed: seed, zones: [{ x: N / 2, z: N / 2, r: B.zone0, k: 1 }], rs: seed * 7919, t: 7, speedNote: 0, era: 1, won: false, lost: false,
      res: JSON.parse(JSON.stringify(B.start)), b: [], nid: 1, deps: [], chars: {},
      storm: { st: 0, start: 0, end: 0 }, stormK: 0, flags: {}, stats: { o2Made: 0, waterMade: 0, trips: 0, harvests: 0 },
      tech: {}, trad: {}, axes: { origem: 0, comunidade: 0, planeta: 0 }, bond: 45, chron: [], cd: {}, said: {}, pending: null,
      stableH: 0, shed: false, lifeSupport: true, rate: { o2: 0, energy: 0 }, lastHour: 7, auto: true, fogStr: null, nborn: 0, nbairro: 0, school: false,
      ark: { st: 0, pods: D.colonists.map(function (c) { return { id: c.id, st: 'sleep' }; }), wake: null, lostT: 0, awake: 0, pad: null } };
    warInit(s); var C = N / 2;
    for (var id in D.chars) mkChar(s, id, C + D.chars[id].dx, C + D.chars[id].dz);
    attach(s);
    s.b.push({ id: s.nid++, type: 'lander', x: C - 1, z: C - 1, prog: 1, built: true, hp: 100, on: true, why: '', dust: 0 });
    // depósitos: alguns perto, o resto espalhado
    var spots = [['metal', 7.5, 0.6], ['reg', 7, 2.4], ['metal', 9.5, 4.0], ['reg', 9, 5.4]], i;
    for (i = 0; i < 150; i++) spots.push([i % 2 ? 'reg' : 'metal', 13 + rnd(s) * (i < 30 ? 26 : N / 2 - 18), rnd(s) * 6.283]);
    for (i = 0; i < spots.length; i++) { var sp = spots[i], tries = 0;
      while (tries++ < 30) { var x = Math.floor(C + Math.cos(sp[2]) * sp[1] + (tries - 1) * (rnd(s) - 0.5)), z = Math.floor(C + Math.sin(sp[2]) * sp[1] + (tries - 1) * (rnd(s) - 0.5));
        if (x < 2 || z < 2 || x > N - 3 || z > N - 3) continue; var k = z * N + x; if (s.rt.map.rock[k] || s.rt.map.ice[k] || s.rt.occ[k]) continue;
        s.deps.push({ id: s.nid++, res: sp[0], x: x, z: z, left: (sp[0] === 'metal' ? 55 : 70) * (sp[1] > 30 ? 1.8 : 1) }); s.rt.occ[k] = -1; break; } }
    for (var cid in s.chars) reveal(s, s.chars[cid], 10);
    assignHomes(s);
    chron(s, 'landing', {});
    return s;
  }
  function attach(s) { // dados de execução, recriados ao carregar
    s.rt = { map: genMap(s.seed), occ: new Int16Array(N * N), fog: new Uint8Array(N * N), play: new Uint8Array(N * N), out: [], fogDirty: true }; computePlay(s);
    warInit(s); s.rt.fx = []; for (var vk in s.chars) if (s.chars[vk].veh) regVeh(vk, s.chars[vk].veh);
    if (s.fogStr) for (var i = 0; i < N * N; i++) s.rt.fog[i] = s.fogStr.charCodeAt(i) === 49 ? 1 : 0;
    rebuildOcc(s);
  }
  // Área jogável: união de bolsões de borda irregular (sem quadrado). Cresce com cada Posto avançado.
  function zoneR(z, ang) { return z.r * (1 + 0.15 * Math.sin(3 * ang + z.k * 1.7) + 0.08 * Math.sin(7 * ang + z.k * 4.1) + 0.045 * Math.sin(13 * ang + z.k * 2.3) + 0.025 * Math.sin(23 * ang + z.k)); }
  function computePlay(s) { var P = s.rt.play, x, z, i; P.fill(0);
    for (i = 0; i < s.zones.length; i++) { var zn = s.zones[i], R0 = zn.r * 1.35, x0 = Math.max(0, Math.floor(zn.x - R0)), x1 = Math.min(N - 1, Math.ceil(zn.x + R0)), z0 = Math.max(0, Math.floor(zn.z - R0)), z1 = Math.min(N - 1, Math.ceil(zn.z + R0));
      for (z = z0; z <= z1; z++) for (x = x0; x <= x1; x++) { var dx = x + 0.5 - zn.x, dz = z + 0.5 - zn.z, d = Math.hypot(dx, dz), v = Math.max(0, Math.min(1, (zoneR(zn, Math.atan2(dz, dx)) - d) / 5 + 0.5)) * 255, k = z * N + x; if (v > P[k]) P[k] = v; } }
    for (z = 0; z < N; z++) for (x = 0; x < N; x++) if (x < 3 || z < 3 || x > N - 4 || z > N - 4) P[z * N + x] = 0;
    s.rt.playDirty = true; }
  function playable(s, x, z) { x = Math.floor(x); z = Math.floor(z); return x >= 0 && z >= 0 && x < N && z < N && s.rt.play[z * N + x] >= 110; }
  function addZone(s, x, z, r) { s.zones.push({ x: x, z: z, r: r, k: s.zones.length + 1 }); computePlay(s); emit(s, { type: 'zone' }); }
  function rebuildOcc(s) { var o = s.rt.occ; o.fill(0); var i, x, z; if (!s.rt.road) s.rt.road = new Uint8Array(N * N); s.rt.road.fill(0);
    for (i = 0; i < s.b.length; i++) { var b = s.b[i], d = BD[b.type]; if (d.floor) { s.rt.road[b.z * N + b.x] = b.built ? 2 : 1; continue; } for (z = 0; z < d.h; z++) for (x = 0; x < d.w; x++) o[(b.z + z) * N + b.x + x] = b.id; }
    for (i = 0; i < s.deps.length; i++) o[s.deps[i].z * N + s.deps[i].x] = -1; }
  function serialize(s) { var rt = s.rt, f = ''; for (var i = 0; i < N * N; i++) f += rt.fog[i] ? '1' : '0'; s.fogStr = f; delete s.rt; var j = JSON.stringify(s); s.rt = rt; s.fogStr = null; return j; }
  function deserialize(j) { var s = JSON.parse(j); if (s.v !== 3) throw new Error('versão antiga'); attach(s); s.fogStr = null; return s; }

  function emit(s, o) { s.rt.out.push(o); }
  function alertK(s, lvl, msg, key, x, z, every) { key = key || msg; if (s.cd['a:' + key] != null && s.t - s.cd['a:' + key] < (every || 8)) return; s.cd['a:' + key] = s.t; emit(s, { type: 'alert', lvl: lvl, msg: msg, x: x, z: z }); }
  function sol(s) { return Math.floor(s.t / 24) + 1; }
  function hour(s) { return s.t % 24; }
  function chron(s, key, v) { v = v || {}; v.sol = sol(s); v.year = D.lore.year; v.ship = D.lore.ship; v.company = D.lore.company; v.ark = D.lore.ark; s.chron.push({ sol: v.sol, text: fmt(D.chronicle[key], v), key: key }); emit(s, { type: 'chron' }); }
  // ---- pessoas: os dois da Gênesis, os doze da Alvorada e os nascidos em Marte
  var COL = {}; D.colonists.forEach(function (c) { COL[c.id] = c; });
  var VEH = {}; function regVeh(id, ty) { var V = D.vehicles[ty]; VEH[id] = { id: id, name: V.name + ' ' + id.slice(1), short: V.short + ' ' + id.slice(1), role: 'Veículo', job: 'pil', veh: ty, trait: [V.short, V.desc], why: 'Fabricado na Garagem.' }; }
  function cinfo(id) { if (D.chars[id]) return D.chars[id]; if (COL[id]) return COL[id]; if (VEH[id]) return VEH[id]; var n = +id.slice(1) || 1, nm = D.bornNames[(n - 1) % D.bornNames.length];
    return { id: id, name: nm, short: nm, role: 'Nascido em Marte', job: D.jobKeys[(n - 1) % D.jobKeys.length], born: true, trait: ['Nascido em Marte', 'Nunca viu a Terra. Marte é o único chão que conhece.'], why: 'Não veio de lugar nenhum. É daqui.' }; }
  function cname(id) { return cinfo(id).short; }
  function mkChar(s, id, x, z) { var inf = cinfo(id), sk = inf.skills ? JSON.parse(JSON.stringify(inf.skills)) : { eng: 1, bot: 1, geo: 1, pil: 1, med: 1, sci: 1 };
    return (s.chars[id] = { id: id, x: x, z: z, inside: null, alive: true, critical: 0, sleeping: false, carry: null, act: null, queue: [], mem: [], lastTalk: -99, lastCont: -99, job: inf.job || null, home: null, hero: !!D.chars[id], shift: D.chars[id] ? 0 : Object.keys(s.chars).length % 2,
      needs: { health: 100, o2: 100, hunger: 20, thirst: 20, energy: 85, temp: 90, stress: 25, morale: 65, rad: 0 }, skills: sk, xp: {} }); }
  function pop(s) { var n = 0; for (var id in s.chars) if (s.chars[id].alive && !s.chars[id].veh) n++; return n; }
  function isShelter(b) { return b.built && (b.type === 'lander' || (!!BD[b.type].beds && b.on)); }
  // Níveis 1–4: cada melhoria multiplica produção, geração e armazenamento, e soma leitos
  var LVM = [1, 1.5, 2.1, 3, 4.2];
  function lvl(b) { return b.lv || 1; } function mul(b) { return LVM[lvl(b) - 1]; }
  function bedsOf(b) { var n = BD[b.type].beds || 0; return n ? n + (lvl(b) - 1) * Math.ceil(n / 2) : 0; }
  function useOf(b) { return (BD[b.type].use || 0) * (1 + 0.25 * (lvl(b) - 1)); }
  function upCost(b) { var c = BD[b.type].cost, k = [0, 1.5, 2.5, 4, 6][lvl(b)], o = {}; for (var r in c) o[r] = Math.ceil(c[r] * k); return o; }
  function canUpgrade(s, b) { var d = BD[b.type], L = lvl(b); if (!b.built || b.up != null) return { ok: false, msg: b.up != null ? 'Melhoria em andamento' : 'Termine a obra primeiro' };
    if (b.type === 'lander' || d.landmark || d.floor || b.type === 'corridor' || b.type === 'pad' || b.type === 'airlock') return { ok: false, msg: 'Esta construção não tem níveis' };
    if (L >= 5) return { ok: false, msg: 'Nível máximo' };
    if (L === 2 && Object.keys(s.tech).filter(function (k) { return s.tech[k]; }).length < 2) return { ok: false, msg: 'Nível 3 pede 2 pesquisas concluídas' };
    if (L === 3 && !s.won) return { ok: false, msg: 'Nível 4 pede a Era II (erga um Marco)' };
    if (L === 4 && Object.keys(s.tech).filter(function (k) { return s.tech[k]; }).length < 4) return { ok: false, msg: 'Nível 5 pede 4 pesquisas concluídas' };
    var c = upCost(b), miss = []; for (var r in c) if (s.res[r] < c[r]) miss.push((c[r] - Math.floor(s.res[r])) + ' ' + ({ metal: 'metal', comp: 'componentes', reg: 'regolito' })[r]);
    if (miss.length) return { ok: false, msg: 'Faltam ' + miss.join(', ') }; return { ok: true, msg: 'Melhorar para o nível ' + (L + 1) }; }
  function upgrade(s, id) { var b = byId(s, id); if (!b) return { ok: false, msg: 'Nada selecionado' }; var r = canUpgrade(s, b); if (!r.ok) return r; var c = upCost(b); for (var k in c) s.res[k] -= c[k]; b.up = 0; emit(s, { type: 'sound', id: 'place' }); return { ok: true, msg: 'Melhoria marcada: os colonos vão trabalhar nela' }; }
  function beds(s) { var n = 0; for (var i = 0; i < s.b.length; i++) { var b = s.b[i]; if (b.built && b.hp > 40) n += bedsOf(b); } return n; }
  function reserved(s) { var n = s.ark.wake ? 1 : 0; for (var i = 0; i < s.b.length; i++) if (s.b[i].gest) n++; return n; }
  function freeBeds(s) { return beds(s) - pop(s) - reserved(s); }
  function sleepers(s) { return s.ark.pods.filter(function (p) { return p.st === 'sleep'; }); }
  function nearestOther(s, c, pred) { var best = null, bd = 1e9; for (var id in s.chars) { var o = s.chars[id]; if (o === c || !o.alive || o.veh || (pred && !pred(o))) continue; var d = Math.hypot(o.x - c.x, o.z - c.z); if (d < bd) { bd = d; best = o; } } return best; }
  function workers(s, c, type, id, plot) { var n = 0; for (var k in s.chars) { var o = s.chars[k], a = o.act; if (o !== c && o.alive && a && (a.type === type || (type === 'gather' && a.type === 'haul' && a.back === id)) && (a.id === id || a.back === id) && (plot == null || a.plot === plot)) n++; } return n; }
  function rescueTarget(s, c) { for (var id in s.chars) { var o = s.chars[id]; if (o === c || !o.alive || o.veh || o.critical <= 0) continue; if (!workers(s, c, 'rescue', o.id)) return o; } return null; }
  function byId(s, id) { for (var i = 0; i < s.b.length; i++) if (s.b[i].id === id) return s.b[i]; return null; }
  function depById(s, id) { for (var i = 0; i < s.deps.length; i++) if (s.deps[i].id === id) return s.deps[i]; return null; }
  function ofType(s, t, builtOnly) { var r = []; for (var i = 0; i < s.b.length; i++) if (s.b[i].type === t && (!builtOnly || s.b[i].built)) r.push(s.b[i]); return r; }
  function center(b) { var d = BD[b.type]; return { x: b.x + d.w / 2, z: b.z + d.h / 2 }; }
  function memo(s, c, k) { if (c.mem.indexOf(k) < 0) { c.mem.push(k); if (c.mem.length > 5) c.mem.shift(); } }
  function axis(s, k, v) { s.axes[k] = clamp(s.axes[k] + v, -100, 100); }
  function isNight(s) { var h = hour(s); return h < B.sunrise || h >= B.sunset; }
  function sun(s) { var h = hour(s); if (h < B.sunrise || h > B.sunset) return 0; return Math.sin(Math.PI * (h - B.sunrise) / (B.sunset - B.sunrise)); }
  function caps(s) { var c = { o2: B.caps.o2, water: B.caps.water, food: B.caps.food, ice: B.caps.ice, mat: B.caps.mat, energy: B.caps.energy };
    for (var i = 0; i < s.b.length; i++) { var b = s.b[i]; if (!b.built) continue; var d = BD[b.type]; if (d.store) for (var k in d.store) c[k] += d.store[k] * mul(b); if (d.cap && b.conn) c.energy += d.cap * mul(b) * (s.tech.celulas ? 1.5 : 1); }
    if (s.ark.st === 2) for (var a in B.arkStore) c[a] += B.arkStore[a]; return c; }
  function addRes(s, k, n) { var c = caps(s), cap = (k === 'metal' || k === 'comp' || k === 'reg') ? c.mat : (c[k] != null ? c[k] : 1e9); var v = Math.min(cap, s.res[k] + n); var got = v - s.res[k]; s.res[k] = Math.max(0, v); return got; }

  // ---------------- FOG ----------------
  function reveal(s, c, R) { var f = s.rt.fog, m = s.rt.map, cx = Math.floor(c.x), cz = Math.floor(c.z), ch = false;
    for (var z = Math.max(0, cz - R); z <= Math.min(N - 1, cz + R); z++) for (var x = Math.max(0, cx - R); x <= Math.min(N - 1, cx + R); x++) {
      if ((x - cx) * (x - cx) + (z - cz) * (z - cz) > R * R) continue; var k = z * N + x; if (f[k]) continue; f[k] = 1; ch = true;
      if (m.ice[k] && !s.flags.iceFound) { s.flags.iceFound = true; chron(s, 'iceFound', { who: cname(c.id) }); alertK(s, 'info', 'Gelo subterrâneo localizado', 'ice', x, z); emit(s, { type: 'sound', id: 'discover' }); } }
    if (ch) s.rt.fogDirty = true; }

  // ---------------- CAMINHO (A*) ----------------
  function freeTile(s, x, z) { return x >= 0 && z >= 0 && x < N && z < N && !s.rt.map.rock[z * N + x] && !s.rt.occ[z * N + x] && s.rt.play[z * N + x] >= 110; }
  function ring(s, x0, z0, w, h) { for (var r = 1; r <= 3; r++) { var g = []; for (var z = z0 - r; z < z0 + h + r; z++) for (var x = x0 - r; x < x0 + w + r; x++) { if (x >= x0 && x < x0 + w && z >= z0 && z < z0 + h) continue; if (freeTile(s, x, z)) g.push(z * N + x); } if (g.length) return g; } return []; }
  function findPath(s, sx, sz, goals, tx, tz, soft) {
    function ok(x, z) { return freeTile(s, x, z) || (soft && x >= 0 && z >= 0 && x < N && z < N && !s.rt.map.rock[z * N + x] && s.rt.occ[z * N + x] > 0 && s.rt.play[z * N + x] >= 110); }
    var start = sz * N + sx, gs = {}, i; for (i = 0; i < goals.length; i++) gs[goals[i]] = 1; if (!goals.length) return null; if (gs[start]) return [];
    var g = new Float32Array(N * N).fill(1e9), from = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N), heap = [];
    function push(f, k) { heap.push([f, k]); var i = heap.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; var t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; } }
    function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var i = 0; for (;;) { var l = i * 2 + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; var t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; } } return top; }
    g[start] = 0; push(0, start);
    var dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [-1, -1, 1.42]];
    while (heap.length) { var cur = pop()[1]; if (closed[cur]) continue; closed[cur] = 1;
      if (gs[cur]) { var p = [], k = cur; while (k !== start) { p.push({ x: (k % N) + 0.5, z: Math.floor(k / N) + 0.5 }); k = from[k]; } return p.reverse(); }
      var cx = cur % N, cz = Math.floor(cur / N);
      for (i = 0; i < 8; i++) { var d = dirs[i], nx = cx + d[0], nz = cz + d[1]; if (!ok(nx, nz)) continue;
        if (d[2] > 1 && (!ok(cx + d[0], cz) || !ok(cx, cz + d[1]))) continue;
        var nk = nz * N + nx, ng = g[cur] + d[2] * (s.rt.map.steep[nk] ? 1.8 : 1) + (s.rt.occ[nk] > 0 ? 6 : 0); if (ng < g[nk]) { g[nk] = ng; from[nk] = cur; push(ng + Math.hypot(nx - tx, nz - tz), nk); } } }
    return null;
  }

  // ---------------- CONSTRUÇÃO ----------------
  function requirements(s) { var hab = ofType(s, 'habitat', true).some(function (b) { return b.on; });
    return [
      { label: 'Habitat funcional e pressurizado', ok: hab },
      { label: 'Energia estável por ' + B.stableHours + ' horas seguidas (' + Math.min(B.stableHours, Math.floor(s.stableH)) + '/' + B.stableHours + ')', ok: s.stableH >= B.stableHours },
      { label: 'Água produzida e ' + B.waterGoal + ' em reserva', ok: !!s.flags.firstWater && s.res.water >= B.waterGoal },
      { label: 'Oxigênio produzido em Marte', ok: s.stats.o2Made >= B.o2Goal },
      { label: 'Primeira colheita', ok: !!s.flags.firstHarvest },
      { label: 'Primeira casa construída', ok: !!s.flags.firstHouse },
      { label: 'Seis colonos despertos (' + Math.min(6, s.ark.awake) + '/6)', ok: s.ark.awake >= 6 || (s.ark.st === 2 && !sleepers(s).length && !s.ark.wake) },
      { label: 'Primeiro bairro: 3 casas vizinhas', ok: !!s.flags.bairro }]; }
  // Prontidão para a Alvorada: o que a base sustenta contra o que seis recém-despertos exigem.
  function readiness(s) { var fb = freeBeds(s), ext = ofType(s, 'o2ext', true).filter(function (b) { return b.on; }).length, pad = ofType(s, 'pad', true)[0], cry = ofType(s, 'cryo', true)[0], gh = 0;
    s.b.forEach(function (b) { if (b.plots) b.plots.forEach(function (p) { if (p && p.crop) gh++; }); });
    return [
      { label: 'Leitos livres', val: Math.max(0, fb) + ' de 6', ok: fb >= 6 },
      { label: 'Extratores de oxigênio ligados', val: ext + ' de 2', ok: ext >= 2 },
      { label: 'Água em reserva', val: Math.floor(s.res.water) + ' de 60', ok: s.res.water >= 60 && !!s.flags.firstWater },
      { label: 'Alimento', val: Math.floor(s.res.food) + ' em estoque, ' + gh + ' canteiros plantados', ok: s.res.food >= 25 && gh >= 3 },
      { label: 'Energia estável', val: s.shed ? 'faltando' : 'saldo ' + (s.rate.energy >= 0 ? '+' : '') + s.rate.energy.toFixed(1) + ' por hora', ok: !s.shed && s.stableH >= 12 },
      { label: 'Zona de Pouso', val: pad ? (pad.on ? 'pronta e com energia' : 'sem energia') : 'não construída', ok: !!pad && pad.on },
      { label: 'Enfermaria criogênica', val: cry ? (cry.on ? 'pronta' : 'parada') : 'não construída', ok: !!cry && cry.on }]; }
  function reqOK(s) { return requirements(s).every(function (r) { return r.ok; }); }
  function costText(c) { var n = { metal: 'metal', comp: 'componentes', reg: 'regolito' }, a = []; for (var k in c) a.push(c[k] + ' ' + n[k]); return a.join(', '); }
  function canPlace(s, type, x, z) {
    var d = BD[type], m = s.rt.map, i, j, k;
    if (x < 1 || z < 1 || x + d.w > N - 1 || z + d.h > N - 1) return { ok: false, reason: 'Fora do mapa' };
    if (d.landmark) { if (s.b.some(function (b) { return BD[b.type].landmark; })) return { ok: false, reason: 'O Marco desta Era já foi escolhido' }; if (!reqOK(s)) return { ok: false, reason: 'Requisitos da Era ainda não cumpridos' }; }
    if (d.unique && ofType(s, type).length) return { ok: false, reason: 'Só pode existir uma construção deste tipo' };
    if (d.need === 'antenna' && !ofType(s, 'antenna', true).length) return { ok: false, reason: 'Precisa de uma antena pronta para guiar o pouso' };
    if (d.need === 'awake6' && s.ark.awake < 6) return { ok: false, reason: 'Precisa de 6 colonos despertos para operar' };
    if (d.need === 'era2' && !s.won) return { ok: false, reason: 'Liberado na Era II: erga um Marco primeiro' };
    if (d.need === 'era3' && s.era < 3) return { ok: false, reason: 'Liberado na Era III' };
    if (d.need === 'era4' && s.era < 4) return { ok: false, reason: 'Liberado na Era IV' };
    if (d.need === 'quartel' && !ofType(s, 'quartel', true).length) return { ok: false, reason: 'Construa o Quartel primeiro' };
    if (d.need === 'arsenal' && !ofType(s, 'arsenal', true).length) return { ok: false, reason: 'Construa o Arsenal primeiro' };
    if (d.need === 'berco' && !ofType(s, 'berco', true).length) return { ok: false, reason: 'Construa o Berço primeiro' };
    var allIce = true;
    for (j = 0; j < d.h; j++) for (i = 0; i < d.w; i++) { k = (z + j) * N + x + i;
      if (!s.rt.fog[k]) return { ok: false, reason: 'Área ainda não explorada' };
      if (s.rt.play[k] < 110) return { ok: false, reason: 'Fora da área explorável: avance a fronteira com um Posto avançado' };
      if (s.rt.road && s.rt.road[k]) return { ok: false, reason: d.floor ? 'Já tem estrada aqui' : 'Tem uma estrada aqui' };
      if (m.rock[k]) return { ok: false, reason: 'Bloqueado por rocha' };
      if (s.rt.occ[k]) return { ok: false, reason: 'Local ocupado' };
      if (m.steep[k]) return { ok: false, reason: 'Terreno inclinado demais' };
      if (!m.ice[k]) allIce = false; }
    if (d.needIce && !allIce) return { ok: false, reason: 'Precisa ficar sobre gelo subterrâneo' };
    if (d.needPress) { var adj = false; for (i = 0; i < s.b.length; i++) { var b = s.b[i], bd = BD[b.type]; if (!bd.press || b.type === 'lander') continue;
        var ox = x < b.x + bd.w && b.x < x + d.w, oz = z < b.z + bd.h && b.z < z + d.h;
        if ((ox && (z === b.z + bd.h || b.z === z + d.h)) || (oz && (x === b.x + bd.w || b.x === x + d.w))) adj = true; }
      if (!adj) return { ok: false, reason: 'Sem acesso pressurizado: encoste em uma câmara ou módulo' }; }
    if ((d.use || d.cap || d.link) && !d.gen) { var cx = x + d.w / 2, cz = z + d.h / 2, near = false, me = { type: type }; netAll(s);
      for (i = 0; i < s.b.length; i++) { var c = center(s.b[i]); if (s.b[i].reach && Math.hypot(c.x - cx, c.z - cz) <= linkR(me, s.b[i])) near = true; }
      if (!near) return { ok: false, reason: 'Fora da rede de energia: ponha painéis solares ao lado ou leve postes de energia até aqui' }; }
    var miss = []; for (k in d.cost) if (s.res[k] < d.cost[k]) miss.push((d.cost[k] - Math.floor(s.res[k])) + ' ' + ({ metal: 'metal', comp: 'componentes', reg: 'regolito' })[k]);
    if (miss.length) return { ok: false, reason: 'Faltam materiais: ' + miss.join(', ') + (d.cost.comp > s.res.comp ? ' (a oficina fabrica componentes)' : '') };
    return { ok: true, reason: 'Local válido' };
  }
  function linkR(a, b) { return Math.max(BD[a.type].link || B.netRadius, BD[b.type].link || B.netRadius); }
  function netSeed(b) { return b.type === 'lander' || !!BD[b.type].gen; } // o módulo e cada painel solar começam uma rede (microrrede)
  // Uma veia esgotada nunca deixa o mapa vazio: a varredura geológica acha outra do mesmo tipo, mais longe da base
  function newVein(s, res, ox, oz) { var C = N / 2, tries = 0;
    while (tries++ < 80) { var a = rnd(s) * 6.283, r = 8 + rnd(s) * 14 + tries * 0.2, x = Math.floor(ox + Math.cos(a) * r), z = Math.floor(oz + Math.sin(a) * r);
      if (x < 3 || z < 3 || x > N - 4 || z > N - 4 || Math.hypot(x - C, z - C) < 8) continue; var k = z * N + x; if (s.rt.map.rock[k] || s.rt.map.ice[k] || s.rt.occ[k] || s.rt.play[k] < 140) continue;
      var d = { id: s.nid++, res: res, x: x, z: z, left: (res === 'metal' ? 60 : 75) * (Math.hypot(x - C, z - C) > 30 ? 1.6 : 1) }; s.deps.push(d); rebuildOcc(s); reveal(s, { x: x + 0.5, z: z + 0.5, id: 'elias' }, 2);
      alertK(s, 'info', 'Varredura geológica: nova veia de ' + (res === 'metal' ? 'metal' : 'regolito') + ' encontrada', 'vein' + d.id, x, z, 0); return d; } return null; }
  function netAll(s) { // alcance da rede incluindo obras (para validar posição)
    var i, ch = true; for (i = 0; i < s.b.length; i++) s.b[i].reach = netSeed(s.b[i]);
    while (ch) { ch = false; for (i = 0; i < s.b.length; i++) { var a = s.b[i]; if (a.reach) continue; var ca = center(a);
        for (var j = 0; j < s.b.length; j++) { var b = s.b[j]; if (!b.reach) continue; var cb = center(b); if (Math.hypot(ca.x - cb.x, ca.z - cb.z) <= linkR(a, b)) { a.reach = true; ch = true; break; } } } } }
  function place(s, type, x, z) { var r = canPlace(s, type, x, z); if (!r.ok) return r; var d = BD[type];
    for (var k in d.cost) s.res[k] -= d.cost[k];
    var b = { id: s.nid++, type: type, x: x, z: z, prog: 0, built: false, hp: 100, on: false, why: 'em obra', dust: 0, off: false };
    s.b.push(b); rebuildOcc(s); emit(s, { type: 'sound', id: 'place' }); return { ok: true, b: b }; }
  function demolish(s, id) { var b = byId(s, id); if (!b || b.type === 'lander' || BD[b.type].landmark || b.id === s.ark.pad) return false; var d = BD[b.type];
    for (var k in d.cost) addRes(s, k, d.cost[k] * (b.built ? 0.5 : 1));
    s.b.splice(s.b.indexOf(b), 1); rebuildOcc(s); for (var c in s.chars) if (s.chars[c].act && s.chars[c].act.id === id) clearAct(s.chars[c]); return true; }
  function finishBuilding(s, b, c) { var d = BD[b.type]; b.built = true; b.prog = 1; b.why = ''; b.bt = s.t; if (d.floor) rebuildOcc(s); if (b.type === 'posto') { var cb = center(b); addZone(s, cb.x, cb.z, B.outpostR); alertK(s, 'info', 'Posto avançado pronto: a fronteira avançou', 'posto' + b.id, b.x, b.z, 0); chron(s, 'posto', {}); }
    if (b.type === 'greenhouse') b.plots = [null, null, null, null];
    if (b.type === 'solar' && !s.flags.firstPanel) { s.flags.firstPanel = true; chron(s, 'firstPanel', { who: cname(c.id) }); }
    if (b.type === 'casa' && !s.flags.firstHouse) { s.flags.firstHouse = true; chron(s, 'firstHouse', {}); }
    if (b.type === 'berco') chron(s, 'berco', {}); if (b.type === 'escola') chron(s, 'escola', {});
    if (BD[b.type].beds || b.type === 'casa') assignHomes(s);
    emit(s, { type: 'sound', id: 'built' }); alertK(s, 'info', d.name + ' concluído', 'built' + b.id, b.x, b.z, 0);
    if (d.landmark) { s.won = true; s.era = 2; s.flags.landmark = b.type; if (b.type === 'jardim') { axis(s, 'origem', 30); axis(s, 'planeta', 10); } else { axis(s, 'origem', -30); axis(s, 'planeta', -10); }
      chron(s, 'landmark', { what: d.name }); emit(s, { type: 'scene', id: 'landmark', b: b.id }); } }

  // ---------------- REDES ----------------
  function networks(s, dtH) {
    var i, j, b, d, L = s.b; // energia: alcance por raio a partir do módulo, só por construções prontas
    for (i = 0; i < L.length; i++) { L[i].conn = L[i].type === 'lander' || (L[i].built && L[i].hp > 40 && netSeed(L[i])); L[i].via = null; }
    var ch = true; while (ch) { ch = false; for (i = 0; i < L.length; i++) { b = L[i]; if (b.conn || !b.built) continue; var ca = center(b), bd2 = 1e9, bv = null;
        for (j = 0; j < L.length; j++) { if (!L[j].conn) continue; var cb = center(L[j]), dd = Math.hypot(ca.x - cb.x, ca.z - cb.z); if (dd <= linkR(b, L[j]) && dd < bd2) { bd2 = dd; bv = L[j]; } }
        if (bv) { b.conn = true; b.via = bv.id; ch = true; } } }
    // pressurizado: complexos por adjacência; precisam de uma câmara
    var comp = {}; for (i = 0; i < L.length; i++) { L[i].pg = L[i].id; }
    function touch(a, b) { var da = BD[a.type], db = BD[b.type]; var ox = a.x < b.x + db.w && b.x < a.x + da.w, oz = a.z < b.z + db.h && b.z < a.z + da.h;
      return (ox && (a.z === b.z + db.h || b.z === a.z + da.h)) || (oz && (a.x === b.x + db.w || b.x === a.x + da.w)); }
    ch = true; while (ch) { ch = false; for (i = 0; i < L.length; i++) { b = L[i]; if (!b.built || !BD[b.type].press || b.type === 'lander') continue;
        for (j = 0; j < L.length; j++) { var o = L[j]; if (o === b || !o.built || !BD[o.type].press || o.type === 'lander') continue; if (touch(b, o) && o.pg < b.pg) { b.pg = o.pg; ch = true; } } } }
    for (i = 0; i < L.length; i++) if (L[i].built && L[i].type === 'airlock') comp[L[i].pg] = 1;
    // estado básico
    var cp0 = caps(s), gen = 0, cons = [], sn = sun(s) * (1 - (1 - B.stormSolar) * s.stormK);
    for (i = 0; i < L.length; i++) { b = L[i]; d = BD[b.type]; b.on = false;
      if (!b.built) { b.why = 'em obra'; continue; }
      if (b.hp <= 40) { b.why = 'danificado: precisa de reparo'; continue; }
      b.pressOK = b.type === 'lander' || !d.press || !!d.selfPress || !!comp[b.pg];
      if (d.press && !b.pressOK) { b.why = 'sem acesso pressurizado: falta câmara'; continue; }
      if ((d.use || d.gen || d.cap) && !b.conn) { b.why = 'fora da rede de energia'; continue; }
      if (b.off) { b.why = 'desligado'; continue; }
      if (b.frozen && s.t < b.frozen) { b.why = 'broca congelada'; continue; }
      b.why = ''; b.on = true;
      if (d.gen) { b.out = d.gen * mul(b) * sn * (1 - b.dust) * (b.hp / 100); gen += b.out;
        b.dust = clamp(b.dust + dtH * (s.stormK > 0.3 ? 0.03 : 0.004) * (s.tech.limpeza ? 0.35 : 1), 0, 0.9); }
      b.idle = (b.type === 'workshop' && (s.res.reg < 2 || s.res.metal < 1 || s.res.comp >= B.compStock)) || (b.type === 'purifier' && (s.res.ice < 0.01 || s.res.water >= cp0.water)) || (b.type === 'o2ext' && s.res.o2 >= cp0.o2) || (b.type === 'drill' && s.res.ice >= cp0.ice);
      if (d.use && !b.idle) cons.push(b); }
    cons.sort(function (a, b) { return BD[b.type].prio - BD[a.type].prio; });
    var use = 0, shed = false, budget = s.res.energy > 0.01 ? 1e9 : gen;
    for (i = 0; i < cons.length; i++) { var u = useOf(cons[i]); if (use + u <= budget + 1e-6) use += u; else { cons[i].on = false; cons[i].why = 'sem energia'; shed = true; } }
    var cp = caps(s); s.res.energy = clamp(s.res.energy + (gen - use) * dtH, 0, cp.energy);
    s.rate.energy = gen - use; s.rate.gen = gen; s.rate.use = use; s.shed = shed;
    var lander = L[0]; s.lifeSupport = lander.on;
    if (shed) { s.stableH = 0; alertK(s, 'warn', 'Energia insuficiente: sistemas desligando', 'shed', lander.x, lander.z, 6); } else if (ofType(s, 'solar', true).length) s.stableH += dtH;
    return cp;
  }

  function production(s, dtH, cp) {
    var i, b, d, o2Before = s.res.o2;
    for (i = 0; i < s.b.length; i++) { b = s.b[i]; d = BD[b.type];
      if (b.type === 'greenhouse' && b.built) plots(s, b, dtH);
      if ((b.type === 'arsenal' || b.type === 'garagem' || b.type === 'fabrica') && b.built) factory(s, b, dtH);
      if (b.leak && b.built) s.res.o2 = Math.max(0, s.res.o2 - 2 * dtH);
      if (!b.on) continue;
      if (b.type === 'o2ext') { var g = Math.min(cp.o2 - s.res.o2, d.out.o2 * mul(b) * dtH); if (g > 0) { s.res.o2 += g; s.stats.o2Made += g; if (!s.flags.firstO2 && s.stats.o2Made > 1) { s.flags.firstO2 = true; chron(s, 'firstO2', {}); } } }
      else if (b.type === 'drill') s.res.ice = Math.min(cp.ice, s.res.ice + d.out.ice * mul(b) * dtH);
      else if (b.type === 'purifier') { var cv = Math.min(s.res.ice, 6 * mul(b) * dtH, (cp.water - s.res.water) / 0.9); if (cv > 0) { s.res.ice -= cv; s.res.water += cv * 0.9; s.stats.waterMade += cv * 0.9;
          if (!s.flags.firstWater && s.stats.waterMade > 0.6) { s.flags.firstWater = true; chron(s, 'firstWater', {}); for (var c in s.chars) memo(s, s.chars[c], 'agua'); emit(s, { type: 'scene', id: 'firstWater', b: b.id }); } } }
      else if (b.type === 'workshop') { if (s.res.reg >= 2 && s.res.metal >= 1 && s.res.comp < B.compStock) { b.wp = (b.wp || 0) + dtH * 3 * mul(b); while (b.wp >= 1 && s.res.reg >= 2 && s.res.metal >= 1) { b.wp -= 1; s.res.reg -= 2; s.res.metal -= 1; s.res.comp += 1; } } }
      else if (b.type === 'antenna') s.flags.antenna = true;
      else if (b.type === 'habitat' && !s.flags.firstLight) { s.flags.firstLight = true; chron(s, 'firstLight', {}); emit(s, { type: 'scene', id: 'firstLight', b: b.id }); }
    }
    s.rate.o2 = dtH > 0 ? (s.res.o2 - o2Before) / dtH : 0;
  }
  function plots(s, b, dtH) { for (var i = 0; i < 4; i++) { var p = b.plots[i]; if (!p || !p.crop) continue; var cr = D.crops[p.crop];
      if (p.g >= 1) continue;
      var need = cr.water * dtH * (s.tech.hidroponia ? 0.6 : 1);
      if (b.on && s.res.water >= need) { s.res.water -= need; p.g += dtH / cr.hours * (s.tech.hidroponia ? 1.3 : 1) * (1 + 0.35 * (lvl(b) - 1)); p.w = Math.max(0, (p.w || 0) - dtH); s.res.o2 += cr.o2 * dtH;
        if (p.g >= 0.15 && !s.flags.firstSprout) { s.flags.firstSprout = true; chron(s, 'firstSprout', { crop: cr.name.toLowerCase() }); for (var c in s.chars) memo(s, s.chars[c], 'broto'); emit(s, { type: 'scene', id: 'firstSprout', b: b.id }); }
        if (p.g >= 1) { p.g = 1; alertK(s, 'info', cr.name + ' pronta para colher', 'ripe' + b.id + i, b.x, b.z, 0); } }
      else { p.w = (p.w || 0) + dtH; alertK(s, 'warn', 'Estufa sem ' + (b.on ? 'água' : 'energia') + ': plantas murchando', 'wilt' + b.id, b.x, b.z, 6);
        if (p.w > 14) { b.plots[i] = null; alertK(s, 'crit', cr.name + ' morreu na estufa', 'dead' + b.id + i, b.x, b.z, 0); } } } }

  // ---------------- PERSONAGENS ----------------
  var INSIDE = { warm: 1, sleep: 1, eat: 1, drink: 1, refill: 1, shelter: 1, research: 1, plant: 1, harvest: 1 };
  var SKILL = { gather: 'geo', haul: 'geo', build: 'eng', upgrade: 'eng', repair: 'eng', clean: 'eng', plant: 'bot', harvest: 'bot', research: 'sci', rescue: 'med' };
  var LABEL = { move: 'Caminhando', upgrade: 'Melhorando', gather: 'Coletando', haul: 'Levando material', build: 'Construindo', repair: 'Reparando', clean: 'Limpando painel', inspect: 'Inspecionando o módulo', unload: 'Retirando suprimentos',
    sleep: 'Dormindo', eat: 'Comendo', drink: 'Bebendo', refill: 'Reabastecendo O₂', research: 'Pesquisando', plant: 'Plantando', harvest: 'Colhendo', talk: 'Conversando', contemplate: 'Olhando o horizonte', rescue: 'Resgatando', shelter: 'Indo para o abrigo', warm: 'Aquecendo-se no abrigo' };
  function bT(type) { return BD[type].t * (B.buildMul || 1); }
  // quem está construindo (ou melhorando) b e quantos segundos reais faltam na velocidade 1x
  function buildEta(s, b) { var names = [], rate = 0, up = b.built && b.up != null, i, c;
    for (i in s.chars) { c = s.chars[i]; if (!c.alive || !c.act || c.act.id !== b.id || c.act.type !== (up ? 'upgrade' : 'build')) continue; names.push(cinfo(c.id).short || cinfo(c.id).name.split(' ')[0]); rate += sp(s, c, 'eng'); }
    var left = up ? (1 - b.up) * bT(b.type) * (lvl(b) + 1) : (1 - b.prog) * bT(b.type);
    return { names: names, sec: rate > 0 ? left / rate : left, idle: !names.length, up: up }; }
  function sp(s, c, k) { return (0.6 + 0.08 * (c.skills[k] || 0)) * (c.needs.stress > 85 ? 0.7 : 1) * (c.needs.energy < 12 ? 0.7 : 1) * (k === 'eng' && c.id === 'helena' ? 1.1 : 1) * (k === 'bot' && c.id === 'elias' ? 1.1 : 1) * (c.weak > s.t ? 0.6 : 1); }
  function xp(s, c, k, dtS) { if (!k) return; c.xp[k] = (c.xp[k] || 0) + dtS * 0.012 * (s.trad.oficio ? 1.5 : 1) * (s.school ? 1.5 : 1); var need = 1 + c.skills[k] * 0.6;
    if (c.xp[k] >= need && c.skills[k] < 10) { c.xp[k] = 0; c.skills[k]++; alertK(s, 'info', cname(c.id) + ': ' + D.skillNames[k] + ' nível ' + c.skills[k], 'lv' + c.id + k + c.skills[k], c.x, c.z, 0); } }
  function clearAct(c) { c.act = null; c.sleeping = false; }
  // abrigo mais próximo (para emergências) e casa própria (para dormir e comer)
  function shelter(s, c) { var best = s.b[0], bd = 1e9; for (var i = 0; i < s.b.length; i++) { var b = s.b[i]; if (!isShelter(b)) continue; var ct = center(b), d = Math.hypot(ct.x - c.x, ct.z - c.z); if (d < bd) { bd = d; best = b; } } return best; }
  function homeOf(s, c) { var b = c.home != null ? byId(s, c.home) : null; return b && isShelter(b) ? b : shelter(s, c); }
  // Casas: cada colono ganha a sua (prefere Casa; o habitat fica para Elias e Helena) e dorme nela
  function assignHomes(s) { var occ = {}, id, c, i, ids = Object.keys(s.chars);
    for (i = 0; i < ids.length; i++) { c = s.chars[ids[i]]; if (!c.alive || c.veh) continue; var hb = c.home != null ? byId(s, c.home) : null; if (hb && isShelter(hb)) occ[hb.id] = (occ[hb.id] || 0) + 1; else c.home = null; }
    function free(b) { return isShelter(b) && b.type !== 'lander' && (occ[b.id] || 0) < bedsOf(b); }
    function pick(pref) { for (var j = 0; j < s.b.length; j++) if (s.b[j].type === pref && free(s.b[j])) return s.b[j]; return null; }
    for (i = 0; i < ids.length; i++) { c = s.chars[ids[i]]; if (!c.alive || c.veh) continue; var cur = c.home != null ? byId(s, c.home) : null;
      var want = c.hero ? ['habitat', 'casa'] : ['casa', 'habitat']; if (cur && cur.type === want[0]) continue;
      var nb = pick(want[0]) || (!cur || cur.type === 'lander' ? pick(want[1]) : null);
      if (!nb && !cur) { for (var j = 0; j < s.b.length; j++) if (free(s.b[j])) { nb = s.b[j]; break; } }
      if (nb) { if (cur) occ[cur.id]--; c.home = nb.id; occ[nb.id] = (occ[nb.id] || 0) + 1; cur = nb; }
      if (!cur && (occ[s.b[0].id] || 0) < BD.lander.beds) { c.home = s.b[0].id; occ[s.b[0].id] = (occ[s.b[0].id] || 0) + 1; } } }
  function dropoff(s, c) { var best = s.b[0], bd = 1e9; for (var i = 0; i < s.b.length; i++) { var b = s.b[i]; if (!b.built || (b.type !== 'lander' && b.type !== 'storage')) continue; var ct = center(b), d = Math.hypot(ct.x - c.x, ct.z - c.z); if (d < bd) { bd = d; best = b; } } return best; }
  function goals(s, c, o) { var cx = Math.floor(c.x), cz = Math.floor(c.z);
    if (o.kind === 'here') return [cz * N + cx];
    if (o.kind === 'b') { var b = byId(s, o.id); if (!b) return []; var d = BD[b.type]; var g = ring(s, b.x, b.z, d.w, d.h); if (cx >= b.x - 1 && cx <= b.x + d.w && cz >= b.z - 1 && cz <= b.z + d.h) g.push(cz * N + cx); return g; }
    if (o.kind === 'd') { var dp = depById(s, o.id); if (!dp) return []; var g2 = ring(s, dp.x, dp.z, 1, 1); if (Math.abs(cx - dp.x) <= 1 && Math.abs(cz - dp.z) <= 1) g2.push(cz * N + cx); return g2; }
    if (o.kind === 'c') { var oc = s.chars[o.id]; var g3 = ring(s, Math.floor(oc.x), Math.floor(oc.z), 1, 1); g3.push(Math.floor(oc.z) * N + Math.floor(oc.x)); return g3; }
    var x = Math.floor(o.x), z = Math.floor(o.z); if (freeTile(s, x, z)) return [z * N + x]; return ring(s, x, z, 1, 1); }
  function target(s, o) { if (o.kind === 'b') { var b = byId(s, o.id); return b ? center(b) : null; } if (o.kind === 'd') { var d = depById(s, o.id); return d ? { x: d.x + 0.5, z: d.z + 0.5 } : null; }
    if (o.kind === 'c') return s.chars[o.id]; return { x: o.x, z: o.z }; }
  // inicia uma ordem {type, kind, id, x, z, ...}; devolve false se impossível
  function start(s, c, o, player) {
    if (o.type === 'gather' && c.carry) { var dp0 = dropoff(s, c); o = { type: 'haul', kind: 'b', id: dp0.id, back: o.id }; }
    if (o.kind === 'here') { o.x = c.x; o.z = c.z; }
    var tg = target(s, o); if (!tg) return false;
    var gl = goals(s, c, o), p = findPath(s, Math.floor(c.x), Math.floor(c.z), gl, tg.x, tg.z) || findPath(s, Math.floor(c.x), Math.floor(c.z), gl, tg.x, tg.z, true);
    if (!p) { c.wait = s.t + 0.4; if (typeof process!=='undefined' && process.env.DBG) console.log('BLOCK', c.id, JSON.stringify(o), c.x, c.z, goals(s,c,o).length); alertK(s, 'warn', cname(c.id) + ': caminho bloqueado', 'path' + c.id, c.x, c.z, 2); return false; }
    var a = { type: o.type, kind: o.kind, id: o.id, x: tg.x, z: tg.z, back: o.back, plot: o.plot, phase: p.length ? 'go' : 'work', path: p, pi: 0, t: 0, player: !!player, o: o };
    if (p.length) c.inside = null; c.sleeping = false; c.act = a; return true;
  }
  function requeue(c) { var a = c.act; if (!a) return; var o = a.o; if (a.type === 'haul' && a.back) o = { type: 'gather', kind: 'd', id: a.back };
    if (a.player) c.queue.unshift(o); clearAct(c); }

  function goCritical(s, c) { if (c.critical > 0 || !c.alive) return; c.critical = B.criticalHours; clearAct(c); c.queue = []; c.needs.health = 0;
    if (!s.flags['crit' + c.id] && (c.hero || (s.flags.critN || 0) < 2)) { s.flags['crit' + c.id] = 1; s.flags.critN = (s.flags.critN || 0) + 1; chron(s, 'critical', { who: cname(c.id) }); } alertK(s, 'crit', cname(c.id) + ' em estado crítico! Resgate já', 'crit' + c.id, c.x, c.z, 0); emit(s, { type: 'sound', id: 'alarm' }); }
  function die(s, c) { c.alive = false; c.critical = 0; clearAct(c); chron(s, 'death', { who: cinfo(c.id).name }); alertK(s, 'crit', cinfo(c.id).name + ' morreu', 'dead' + c.id, c.x, c.z, 0);
    for (var id in s.chars) { var o = s.chars[id]; if (o !== c && o.alive) { o.needs.stress = clamp(o.needs.stress + (o.hero && c.hero ? 40 : 18), 0, 100); o.needs.morale = Math.min(o.needs.morale, o.hero && c.hero ? 10 : 35); } } }

  function needs(s, c, dtH) {
    var n = c.needs, out = c.inside == null, ib = out ? null : byId(s, c.inside), st = s.stormK > 0.3, working = c.act && !c.sleeping && c.act.type !== 'shelter';
    var breath = !out && s.res.o2 > 0;
    if (breath) { s.res.o2 = Math.max(0, s.res.o2 - B.o2PerHour * dtH); var add = Math.min(100 - n.o2, 300 * dtH), cost = add / 100 * SUIT_UNITS; if (cost > s.res.o2) { add = s.res.o2 / SUIT_UNITS * 100; cost = s.res.o2; } n.o2 += add; s.res.o2 -= cost; }
    else n.o2 = Math.max(0, n.o2 - 100 / (B.suitHours * (s.tech.trajes ? 1.6 : 1)) * dtH);
    n.hunger = Math.min(100, n.hunger + 6 * dtH); n.thirst = Math.min(100, n.thirst + 8 * dtH);
    if (!c.sleeping) n.energy = Math.max(0, n.energy - (working ? 5.5 : 2.5) * dtH);
    var heated = ib && (ib.type === 'lander' ? s.lifeSupport : ib.on);
    n.temp = clamp(n.temp + (out ? -(isNight(s) ? 5 : 1) - (st ? 6 : 0) : heated ? 20 : -3) * dtH, 0, 100);
    n.rad = clamp(n.rad + (out ? 0.35 * (st ? 2 : 1) : -0.15) * dtH, 0, 100);
    var sg = 0; if (working) sg += 0.8; if (st && out) sg += c.mem.indexOf('tempestade') >= 0 ? 1.5 : 3;
    if (s.res.food < 5) sg += c.id === 'elias' ? 2.5 : 1.5; if (s.res.o2 < 15) sg += c.id === 'elias' ? 2.5 : 1.5;
    if (c.id === 'helena' && (s.shed || s.b.some(function (b) { return b.built && b.hp <= 40; }))) sg += 1.5;
    if (n.rad > 50) sg += 0.5; if (c.mem.indexOf('semAr') >= 0 && out) sg += 0.4; if (s.trad.solo) sg *= 0.8;
    if (!out && !working && ib && ib.type !== 'lander' && BD[ib.type].beds) sg -= 2; if (c.home == null) sg += 0.6;
    n.stress = clamp(n.stress + sg * dtH, 0, 100);
    var hm = c.home != null ? byId(s, c.home) : null; var mt = 68 - n.stress * 0.45 + s.bond * 0.12 + (hm && hm.bairro ? 6 : 0) - (c.home == null ? 8 : 0) + (c.mem.indexOf('broto') >= 0 ? 5 : 0) + (s.trad.cartas ? 6 : 0) + (s.flags.firstLight ? 4 : 0) - (s.res.food < 5 ? 10 : 0);
    n.morale = clamp(n.morale + (mt - n.morale) * 0.06 * dtH, 0, 100);
    var hp = 0; if (n.o2 <= 0) hp -= 70; if (n.hunger >= 100) hp -= 3; if (n.thirst >= 100) hp -= 6; if (n.temp < 25) hp -= 4;
    if (hp === 0 && n.hunger < 85 && n.thirst < 85) hp = c.sleeping ? 4 : 1.5;
    var maxH = n.rad > 60 ? 100 - (n.rad - 60) : 100; n.health = Math.min(maxH, n.health + hp * dtH);
    if (out && n.o2 < 22) alertK(s, n.o2 < 8 ? 'crit' : 'warn', 'O₂ do traje de ' + cname(c.id) + ' em ' + Math.round(n.o2) + '%', 'suit' + c.id, c.x, c.z, 1.5);
    if (n.o2 <= 0 && c.mem.indexOf('semAr') < 0) memo(s, c, 'semAr');
    if (n.health <= 0) goCritical(s, c);
    else if (n.health < 40) alertK(s, 'warn', cname(c.id) + ' está ferido', 'hurt' + c.id, c.x, c.z, 6);
  }

  function work(s, c, a, dtS, dtH) { // devolve true quando a ação termina
    var b = a.kind === 'b' ? byId(s, a.id) : null, k = SKILL[a.type]; a.t += dtS * (k ? sp(s, c, k) : 1); xp(s, c, k, dtS);
    switch (a.type) {
      case 'move': case 'shelter': return true;
      case 'refill': return c.needs.o2 >= 95 || s.res.o2 <= 0;
      case 'warm': return c.needs.temp >= 85 || a.t > 40;
      case 'inspect': if (a.t >= 3) { s.flags.inspected = true; return true; } return false;
      case 'unload': if (a.t >= 6) { s.flags.unloaded = true; for (var r in B.cargo) s.res[r] += B.cargo[r]; alertK(s, 'info', 'Suprimentos retirados: metal, componentes e sementes', 'unl', c.x, c.z, 0); emit(s, { type: 'sound', id: 'built' }); return true; } return false;
      case 'gather': var dp = depById(s, a.id); if (!dp) return true; if (a.t >= 5) { var n = Math.min(B.carry * (c.veh ? D.vehicles[c.veh].carry || 1 : 1), dp.left); dp.left -= n; c.carry = { res: dp.res, n: n * (s.tech.geologia ? 1.25 : 1) };
          if (dp.left <= 0) { s.deps.splice(s.deps.indexOf(dp), 1); rebuildOcc(s); newVein(s, dp.res, dp.x, dp.z); emit(s, { type: 'deps' }); }
          var dr = dropoff(s, c); if (!start(s, c, { type: 'haul', kind: 'b', id: dr.id, back: a.id }, a.player)) return true; return false; } return false;
      case 'haul': if (c.carry) { if (!a.player) a.back = null; var got = addRes(s, c.carry.res, c.carry.n); if (got < c.carry.n - 0.01) alertK(s, 'warn', 'Armazém cheio: construa um armazém', 'full', c.x, c.z, 6); c.carry = null; s.stats.trips++; s.flags.gathered = true; emit(s, { type: 'sound', id: 'drop' }); }
        if (a.back && depById(s, a.back) && start(s, c, { type: 'gather', kind: 'd', id: a.back }, a.player)) return false; return true;
      case 'upgrade': if (!b || b.up == null) return true; b.up += dtS * sp(s, c, 'eng') / (bT(b.type) * (lvl(b) + 1)); if (b.up >= 1) { b.up = null; b.lv = lvl(b) + 1; if (BD[b.type].beds) assignHomes(s); alertK(s, 'info', BD[b.type].name + ' chegou ao nível ' + b.lv, 'lv' + b.id + b.lv, b.x, b.z, 0); emit(s, { type: 'sound', id: 'built' }); return true; } return false;
      case 'build': if (!b || b.built) return true; b.prog += dtS * sp(s, c, 'eng') / bT(b.type); if (b.prog >= 1) { finishBuilding(s, b, c); return true; } return false;
      case 'repair': if (!b) return true; if (s.res.metal < 0.2) { alertK(s, 'warn', 'Falta metal para o reparo', 'repm', c.x, c.z, 6); return true; } var dh = Math.min(100 - b.hp, dtS * sp(s, c, 'eng') * 5); s.res.metal -= dh * 0.06; b.hp += dh; if (b.hp >= 100) { b.leak = false; return true; } return false;
      case 'clean': if (!b) return true; if (a.t >= 3) { b.dust = 0; return true; } return false;
      case 'sleep': c.sleeping = true; var hb = b && b.type !== 'lander' && BD[b.type].beds && b.on; c.needs.energy = Math.min(100, c.needs.energy + 20 * dtH * (hb ? 1.4 : 1)); c.needs.stress = Math.max(0, c.needs.stress - (hb ? 7 : 4) * dtH);
        if (c.needs.energy >= 96 || c.needs.thirst > 92 || c.needs.hunger > 92) { c.sleeping = false; return true; } return false;
      case 'eat': if (a.t >= 3) { if (s.res.food >= B.mealFood) { s.res.food -= B.mealFood; c.needs.hunger = Math.max(0, c.needs.hunger - 70); c.needs.morale = Math.min(100, c.needs.morale + 2); } else alertK(s, 'crit', 'Não há comida', 'nofood', c.x, c.z, 6); return true; } return false;
      case 'drink': if (a.t >= 2) { var w = B.drinkWater * (s.tech.reciclagem ? 0.6 : 1); if (s.res.water >= w) { s.res.water -= w; c.needs.thirst = Math.max(0, c.needs.thirst - 75); } else alertK(s, 'crit', 'Não há água', 'nowater', c.x, c.z, 6); return true; } return false;
      case 'research': if (!b || !b.on) { alertK(s, 'warn', 'Bancada de pesquisa sem energia ou acesso', 'labOff', c.x, c.z, 4); return true; } s.res.research += 1.2 * mul(b) * sp(s, c, 'sci') * dtH * (s.flags.landmark === 'farol' ? 1.5 : 1); return false;
      case 'plant': if (!b || !b.plots) return true; var p = b.plots[a.plot]; if (!p || !p.order) return true; if (a.t >= 4) { b.plots[a.plot] = { crop: p.order, g: 0, w: 0 }; s.flags.planted = true; if (p.order === 'batata') s.flags.potato = true; emit(s, { type: 'sound', id: 'drop' }); return true; } return false;
      case 'harvest': if (!b || !b.plots) return true; var q = b.plots[a.plot]; if (!q || q.g < 1) return true; if (a.t >= 4) { var cr = D.crops[q.crop]; addRes(s, 'food', cr.food * (s.flags.landmark === 'jardim' ? 1.5 : 1)); s.res.seeds += 2; b.plots[a.plot] = null; s.stats.harvests++;
          if (cr.morale) for (var ci in s.chars) s.chars[ci].needs.morale = Math.min(100, s.chars[ci].needs.morale + cr.morale);
          if (!s.flags.firstHarvest) { s.flags.firstHarvest = true; chron(s, 'firstHarvest', { who: cname(c.id), crop: cr.name.toLowerCase() }); } emit(s, { type: 'sound', id: 'built' }); return true; } return false;
      case 'talk': if (a.t >= 5) { var o = s.chars[a.id]; if (o && o.alive) { c.needs.stress = Math.max(0, c.needs.stress - (a.id === 'helena' ? 14 : 10)); o.needs.stress = Math.max(0, o.needs.stress - (c.id === 'helena' ? 14 : 10)); s.bond = clamp(s.bond + 8 / Math.max(2, pop(s)) * (s.trad.mesa ? 1.5 : 1), 0, 100); c.lastTalk = o.lastTalk = s.t; s.flags.talked = true; } return true; } return false;
      case 'contemplate': if (a.t >= 8) { c.needs.stress = Math.max(0, c.needs.stress - (c.id === 'elias' ? 16 : 8)); c.needs.morale = Math.min(100, c.needs.morale + 5); c.lastCont = s.t; return true; } return false;
      case 'rescue': var v = s.chars[a.id]; if (!v || !v.alive || v.critical <= 0) return true; if (a.t >= 4) { var L = s.b[0]; v.critical = 0; v.needs.health = 25; v.needs.o2 = 60; v.needs.temp = 60; v.x = L.x + 1.5; v.z = L.z + 3.5; v.inside = L.id; c.x = L.x + 2.5; c.z = L.z + 3.5; c.inside = L.id;
          s.bond = clamp(s.bond + 12, 0, 100); memo(s, c, 'resgate'); if (!s.flags['resc' + c.id] && (s.flags.rescN || 0) < 3) { s.flags['resc' + c.id] = 1; s.flags.rescN = (s.flags.rescN || 0) + 1; chron(s, 'rescued', { who: cname(c.id), other: cname(v.id) }); } alertK(s, 'info', cname(v.id) + ' foi resgatado', 'resc', v.x, v.z, 0); return true; } return false;
    } return true;
  }

  function jobTaken(s, c, type, id, plot) { return workers(s, c, type, id, plot) > 0; }
  // Trabalho automático. Colonos cooperam: até 3 por obra, e os que sobram coletam material.
  function pickJob(s, c) { var i, b, storm = s.stormK > 0.4, best = null, bd = 1e9, d, ct;
    for (i = 0; i < s.b.length; i++) { b = s.b[i]; if (b.built && b.hp < 70 && !jobTaken(s, c, 'repair', b.id)) return { type: 'repair', kind: 'b', id: b.id }; }
    if (!storm) { for (i = 0; i < s.b.length; i++) { b = s.b[i]; if (b.built) continue; var w = workers(s, c, 'build', b.id); if (w >= 3) continue; ct = center(b); d = Math.hypot(ct.x - c.x, ct.z - c.z) + w * 14; if (d < bd) { bd = d; best = b; } }
      if (best) return { type: 'build', kind: 'b', id: best.id };
      for (i = 0; i < s.b.length; i++) { b = s.b[i]; if (b.up == null || workers(s, c, 'upgrade', b.id) >= 3) continue; return { type: 'upgrade', kind: 'b', id: b.id }; } }
    for (i = 0; i < s.b.length; i++) { b = s.b[i]; if (b.type !== 'greenhouse' || !b.built || !b.pressOK) continue; for (var p = 0; p < 4; p++) { var pl = b.plots[p]; if (!pl) continue;
        if (pl.crop && pl.g >= 1 && !jobTaken(s, c, 'harvest', b.id, p)) return { type: 'harvest', kind: 'b', id: b.id, plot: p };
        if (pl.order && !jobTaken(s, c, 'plant', b.id, p)) return { type: 'plant', kind: 'b', id: b.id, plot: p }; } }
    if (!storm && workTime(s, c)) for (i = 0; i < s.b.length; i++) { b = s.b[i]; if (b.type === 'solar' && b.built && b.dust > 0.4 && !jobTaken(s, c, 'clean', b.id)) return { type: 'clean', kind: 'b', id: b.id }; }
    if (c.hero) return null;
    if (c.job === 'sci') for (i = 0; i < s.b.length; i++) { b = s.b[i]; if (b.type === 'lab' && b.on && !jobTaken(s, c, 'research', b.id)) return { type: 'research', kind: 'b', id: b.id }; }
    if (!storm && workTime(s, c) && c.needs.o2 > 45 && !(c.weak > s.t)) { var cp = caps(s), T = Math.min(cp.mat * 0.8, 170), want = s.res.metal <= s.res.reg ? 'metal' : 'reg'; if (s.res[want] >= T) return null;
      for (var pass = 0; pass < 2 && !best; pass++) { for (i = 0; i < s.deps.length; i++) { var dp = s.deps[i]; if (dp.res !== want || !s.rt.fog[dp.z * N + dp.x] || s.rt.play[dp.z * N + dp.x] < 110 || workers(s, c, 'gather', dp.id) >= 2) continue; d = Math.hypot(dp.x - c.x, dp.z - c.z); if (d < bd) { bd = d; best = dp; } } if (!best) { want = want === 'metal' ? 'reg' : 'metal'; if (s.res[want] >= T) break; } }
      if (best) return { type: 'gather', kind: 'd', id: best.id }; }
    return null; }
  function sleepTime(s, c) { var hr = hour(s); return s.nightShift && c.shift ? hr >= 9 && hr < 17 : hr >= 21 || hr < 5; }
  function workTime(s, c) { return s.nightShift ? !sleepTime(s, c) : !isNight(s); }
  function decide(s, c) { var n = c.needs, sh = shelter(s, c), h = homeOf(s, c), hr = hour(s), o;
    if (c.inside == null && n.o2 < 30) return start(s, c, { type: 'refill', kind: 'b', id: sh.id });
    if (c.inside == null && n.temp < 45) return start(s, c, { type: 'warm', kind: 'b', id: sh.id });
    o = rescueTarget(s, c); if (o) return start(s, c, { type: 'rescue', kind: 'c', id: o.id });
    if (c.carry) return start(s, c, { type: 'haul', kind: 'b', id: dropoff(s, c).id });
    if (n.thirst >= 65 && s.res.water > 0.5) return start(s, c, { type: 'drink', kind: 'b', id: h.id });
    if (n.hunger >= 65 && s.res.food >= B.mealFood) return start(s, c, { type: 'eat', kind: 'b', id: h.id });
    if (n.energy < 15 || (sleepTime(s, c) && n.energy < 60 && !c.queue.length && !c.hold)) { c.hold = null; return start(s, c, { type: 'sleep', kind: 'b', id: h.id }); }
    while (c.queue.length) { var q = c.queue.shift(); if (start(s, c, q, true)) return true; }
    if (c.hold) { if (Math.hypot(c.x - c.hold.x, c.z - c.hold.z) > 1.5 && n.o2 > 60 && n.temp > 55) return start(s, c, { type: 'move', kind: 'tile', x: c.hold.x, z: c.hold.z }); c.wait = s.t + 0.3; return false; } // mandado para um lugar: fica lá esperando a próxima ordem
    if (s.auto) { var j = pickJob(s, c); if (j && start(s, c, j)) return true; }
    if (s.t - c.lastTalk > 18 && (n.stress > 35 || s.bond < 50)) { o = nearestOther(s, c, function (q) { return !q.sleeping && q.critical <= 0 && Math.hypot(q.x - c.x, q.z - c.z) < 25; }); if (o) { c.lastTalk = s.t; return start(s, c, { type: 'talk', kind: 'c', id: o.id }); } }
    if (c.inside == null && !isNight(s) && s.stormK < 0.1 && n.stress > 45 && s.t - c.lastCont > 14 && n.o2 > 50) return start(s, c, { type: 'contemplate', kind: 'here' });
    if (c.inside == null) return start(s, c, { type: 'shelter', kind: 'b', id: h.id });
    c.wait = s.t + 0.25; return false; }

  function charTick(s, c, dtS, dtH) {
    if (!c.alive) return;
    if (c.veh) { vehNeeds(s, c, dtH); if (!c.alive) return; if (D.vehicles[c.veh].dps && fightOrFlee(s, c, dtS)) return; } else if (fightOrFlee(s, c, dtS)) return;
    if (c.critical > 0) { c.critical -= dtH; if (c.critical <= 0) die(s, c); return; }
    if (!c.veh) needs(s, c, dtH); if (c.critical > 0 || !c.alive) return;
    var a = c.act, n = c.needs;
    if (a) { // interrupções de sobrevivência
      var urgent = a.type === 'warm' || a.type === 'refill' || a.type === 'rescue' || a.type === 'sleep' || a.type === 'eat' || a.type === 'drink';
      if (!urgent && ((c.inside == null && n.o2 < 20) || (c.inside == null && n.temp < 32) || n.energy < 6 || (n.thirst >= 88 && s.res.water > 0.5) || (n.hunger >= 88 && s.res.food >= B.mealFood) || rescueTarget(s, c))) { requeue(c); a = null; }
    }
    if (!c.act) { if (c.wait > s.t) return; if (c.veh) vehDecide(s, c); else decide(s, c); a = c.act; if (!a) return; }
    if (a.phase === 'go') { var v = c.veh ? B.walk * D.vehicles[c.veh].speed * (c.bat > 0 ? 1 : 0.3) : B.walk * (1 + 0.03 * c.skills.pil) * (s.stormK > 0.3 ? 0.6 : 1) * (n.energy < 12 ? 0.7 : 1) * (c.weak > s.t ? 0.65 : 1); if (s.rt.road && s.rt.road[Math.floor(c.z) * N + Math.floor(c.x)] === 2) v *= 1.4 + 0.1 * Math.max(0, s.era - 1); var left = v * dtS;
      if (a.kind === 'c' && a.pi === 0 && a.t === 0) a.t = 0;
      while (left > 0 && a.pi < a.path.length) { var p = a.path[a.pi], dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
        if (d <= left) { c.x = p.x; c.z = p.z; left -= d; a.pi++; } else { c.x += dx / d * left; c.z += dz / d * left; c.face = Math.atan2(dx, dz); left = 0; } }
      var tx = Math.floor(c.x), tz = Math.floor(c.z); if (c.lt !== tz * N + tx) { c.lt = tz * N + tx; reveal(s, c, c.veh ? D.vehicles[c.veh].reveal : s.tech.geologia ? B.revealRGeo : B.revealR); if (c.veh) c.bat = Math.max(0, c.bat - 0.02); }
      xp(s, c, 'pil', dtS * 0.3);
      if (a.pi >= a.path.length) { a.phase = 'work'; a.t = 0; }
      else return; }
    if (a.phase === 'work') { if (INSIDE[a.type] && a.kind === 'b') { var ib = byId(s, a.id); if (ib && ib.built && (ib.type === 'lander' || (BD[ib.type].press && ib.pressOK))) c.inside = ib.id; }
      c.face = Math.atan2(a.x - c.x, a.z - c.z);
      if (work(s, c, a, dtS, dtH) && c.act === a) { if (a.player && a.type === 'move' && !c.queue.length) c.hold = { x: c.x, z: c.z }; clearAct(c); } }
  }

  // ---------------- ORDENS DO JOGADOR ----------------
  function orderFor(s, c, tg) {
    if (tg.kind === 'd') return { type: 'gather', kind: 'd', id: tg.id };
    if (tg.kind === 'c') { var oc = s.chars[tg.id]; if (!oc || !oc.alive || oc === c) return null; return { type: oc.critical > 0 ? 'rescue' : 'talk', kind: 'c', id: tg.id }; }
    if (tg.kind === 'b') { var b = byId(s, tg.id); if (!b) return null; var o = { kind: 'b', id: b.id };
      if (!b.built) o.type = 'build'; else if (b.hp < 95) o.type = 'repair'; else if (b.up != null) o.type = 'upgrade';
      else if (b.type === 'lander') o.type = !s.flags.inspected ? 'inspect' : !s.flags.unloaded ? 'unload' : 'shelter';
      else if (b.type === 'solar') o.type = b.dust > 0.08 ? 'clean' : 'move';
      else if (BD[b.type].beds) o.type = c.needs.energy < 70 ? 'sleep' : 'shelter';
      else if (b.type === 'lab') o.type = 'research';
      else if (b.type === 'bastiao' && c.guard) { c.post = b.id; o.type = 'move'; }
      else if (b.type === 'greenhouse') { o.type = 'shelter'; for (var p = 0; p < 4; p++) { var pl = b.plots[p]; if (pl && pl.crop && pl.g >= 1) { o.type = 'harvest'; o.plot = p; break; } if (pl && pl.order) { o.type = 'plant'; o.plot = p; } } }
      else o.type = 'move';
      return o; }
    return { type: tg.act || 'move', kind: tg.act === 'contemplate' ? 'here' : 'tile', x: tg.x, z: tg.z }; }
  function order(s, cid, tg, queue) { var c = s.chars[cid]; if (!c || !c.alive || c.critical > 0) return { ok: false, msg: 'Não pode receber ordens agora' };
    var o = tg.type ? tg : orderFor(s, c, tg); if (!o) return { ok: false, msg: 'Nada a fazer aqui' };
    if (queue && c.act) { c.queue.push(o); return { ok: true, msg: 'Na fila: ' + LABEL[o.type] }; }
    c.queue = []; c.hold = null; if (!(tg && tg.kind === 'b' && byId(s, tg.id) && byId(s, tg.id).type === 'bastiao')) c.post = null; var prev = c.act; clearAct(c);
    if (!start(s, c, o, true)) { c.act = prev; return { ok: false, msg: 'Caminho bloqueado' }; }
    return { ok: true, msg: LABEL[o.type] }; }
  function plant(s, bid, plot, crop) { var b = byId(s, bid); if (!b || !b.plots) return { ok: false, msg: 'Estufa indisponível' }; if (b.plots[plot]) return { ok: false, msg: 'Canteiro ocupado' };
    if (s.res.seeds < 1) return { ok: false, msg: 'Sem sementes: retire os suprimentos do módulo ou colha' }; s.res.seeds--; b.plots[plot] = { order: crop }; return { ok: true, msg: D.crops[crop].name + ' marcada para plantio' }; }
  function buyTech(s, id) { var t = D.research[id]; if (s.tech[id]) return { ok: false, msg: 'Já pesquisada' }; if (s.res.research < t.cost) return { ok: false, msg: 'Faltam ' + Math.ceil(t.cost - s.res.research) + ' pontos de pesquisa' };
    s.res.research -= t.cost; s.tech[id] = true; chron(s, 'tech', { what: t.name }); emit(s, { type: 'sound', id: 'discover' }); return { ok: true, msg: t.name + ' concluída' }; }

  // ---------------- EVENTOS ----------------
  function cdOK(s, k, h) { return s.cd[k] == null || s.t - s.cd[k] >= h; }
  function hourly(s) {
    var hr = hour(s), so = sol(s), alive = pop(s), c, id, both = s.chars.elias.alive && s.chars.helena.alive;
    // tempestade
    var st = s.storm;
    if (B.storm && !s.flags.stormSched && s.t >= B.stormT - 26) { s.flags.stormSched = true; var start = B.stormT; st.st = 1; st.start = start; st.end = start + B.stormHours;
      alertK(s, 'crit', 'Tempestade de poeira prevista para o amanhecer do sol ' + (Math.floor(start / 24) + 1) + '. Prepare baterias e abrigo', 'storm', null, null, 0); emit(s, { type: 'sound', id: 'alarm' }); }
    else if (B.storm && st.st === 0 && s.flags.stormSurvived && Math.floor(hr) === B.sunrise && rnd(s) < 0.14) { var lead = s.flags.antenna ? 48 : 24; st.st = 1; st.start = s.t + lead; st.end = st.start + 14 + rnd(s) * 14; alertK(s, 'warn', 'Nova tempestade prevista em ' + lead + ' horas', 'storm2', null, null, 0); }
    if (st.st === 1 && s.t >= st.start) { st.st = 2; if (!s.flags.stormStarted) { s.flags.stormStarted = true; chron(s, 'stormStart', {}); emit(s, { type: 'scene', id: 'stormStart' }); } alertK(s, 'crit', 'A tempestade chegou', 'stormNow', null, null, 0); }
    if (st.st === 2) { if (s.t >= st.end) { st.st = 0; if (!s.flags.stormSurvived) { s.flags.stormSurvived = true; chron(s, 'stormEnd', {}); for (id in s.chars) if (s.chars[id].alive) memo(s, s.chars[id], 'tempestade'); emit(s, { type: 'scene', id: 'stormEnd' }); } alertK(s, 'info', 'A tempestade passou. Limpe os painéis', 'stormEnd', null, null, 0); }
      else if (rnd(s) < 0.07) { var ext = s.b.filter(function (b) { return b.built && b.type !== 'lander' && !BD[b.type].press && !BD[b.type].landmark; }); if (ext.length) { var hit = ext[Math.floor(rnd(s) * ext.length)]; hit.hp = Math.max(10, hit.hp - 35); alertK(s, 'warn', BD[hit.type].name + ' danificado pela tempestade', 'dmg' + hit.id, hit.x, hit.z, 0); } } }
    // alertas de reserva
    var per = alive * 10; if (s.rate.o2 < 0 || s.res.o2 < per * 0.25) { if (s.res.o2 < per * 0.25) alertK(s, 'crit', 'Oxigênio da base para menos de 6 horas', 'o2c', null, null, 3); else if (s.res.o2 < per) alertK(s, 'crit', 'Oxigênio da base para menos de 1 sol', 'o2b', null, null, 8); else if (s.res.o2 < per * 2) alertK(s, 'warn', 'Oxigênio da base para menos de 2 sóis', 'o2a', null, null, 12); }
    if (s.res.water < 8) alertK(s, s.res.water < 3 ? 'crit' : 'warn', 'Água acabando', 'h2o', null, null, 8);
    if (s.res.food < 6) alertK(s, s.res.food < 2.5 ? 'crit' : 'warn', 'Alimento acabando', 'food', null, null, 8);
    for (id in s.chars) { c = s.chars[id]; if (c.alive && c.needs.rad > 50) alertK(s, 'warn', cname(id) + ' acumulou muita radiação: mais tempo no abrigo', 'rad' + id, c.x, c.z, 24); if (c.alive && c.needs.stress > 85) alertK(s, 'warn', cname(id) + ' está no limite do estresse', 'str' + id, c.x, c.z, 12); }
    // sociedade: casas, bairros, escola, telemetria
    assignHomes(s); bairros(s); s.school = ofType(s, 'escola', true).some(function (b) { return b.on; });
    if (s.school) for (id in s.chars) { c = s.chars[id]; if (c.alive && cinfo(id).born && c.job) xp(s, c, c.job, 30); }
    if (!s.flags.telemetry && s.t >= 24 + 8) { s.flags.telemetry = true; chron(s, 'telemetry', {}); alertK(s, 'info', 'Telemetria da ' + D.lore.ark + ': 12 sinais vitais estáveis. Chega no amanhecer do sol 7', 'tele', null, null, 0); emit(s, { type: 'sound', id: 'radio' }); }
    if (s.ark.st === 0 && s.t >= B.arrivalT - 24 && s.t < B.arrivalT) alertK(s, ofType(s, 'pad', true).length ? 'info' : 'crit', ofType(s, 'pad', true).length ? 'A ' + D.lore.ark + ' pousa no próximo amanhecer' : 'A ' + D.lore.ark + ' chega no próximo amanhecer e não há Zona de Pouso', 'arkSoon', null, null, 8);
    // vínculo e tradições
    var e = s.chars.elias, h = s.chars.helena; if (both) { if (e.needs.stress > 70 && h.needs.stress > 70) s.bond = clamp(s.bond - 0.5, 0, 100); if (s.t - Math.max(e.lastTalk, 0) > 40) s.bond = clamp(s.bond - 0.25, 0, 100); }
    D.traditions.forEach(function (t) { if (!s.trad[t.id] && s.axes[t.axis] * t.sign >= 40) { s.trad[t.id] = true; chron(s, 'tradition', { what: t.name }); alertK(s, 'info', 'Nova tradição: ' + t.name, 'tr' + t.id, null, null, 0); } });
    if (s.pending || s.lost) return;
    // eventos leves (sem janela): falha de equipamento, achado geológico, pequeno tremor
    var mach = s.b.filter(function (b) { return b.built && b.hp > 60 && b.type !== 'lander' && !BD[b.type].landmark && b.id !== s.ark.pad; });
    if (s.t > 36 && mach.length && cdOK(s, 'fail', 40) && rnd(s) < 0.035) { s.cd.fail = s.t; var fb = mach[Math.floor(rnd(s) * mach.length)]; fb.hp = 35; alertK(s, 'warn', 'Falha de equipamento: ' + BD[fb.type].name + ' precisa de reparo', 'fail' + fb.id, fb.x, fb.z, 0); emit(s, { type: 'sound', id: 'warn' }); }
    else if (s.t > 30 && cdOK(s, 'find', 50) && rnd(s) < 0.03) { s.cd.find = s.t; var C0 = N / 2, a0 = rnd(s) * 6.283; newVein(s, rnd(s) < 0.5 ? 'metal' : 'reg', C0 + Math.cos(a0) * 12, C0 + Math.sin(a0) * 12); s.res.research += 4; }
    else if (s.t > 72 && mach.length > 2 && cdOK(s, 'quake', 90) && rnd(s) < 0.02) { s.cd.quake = s.t; for (var qi = 0; qi < 2; qi++) { var qb = mach[Math.floor(rnd(s) * mach.length)]; qb.hp = Math.max(30, qb.hp - 30); } alertK(s, 'warn', 'Um pequeno tremor sacudiu a base. Confira as construções', 'quake', null, null, 0); emit(s, { type: 'shake' }); }
    // eventos com escolha
    var hab = ofType(s, 'habitat', true)[0], ev = null;
    if (s.res.o2 <= 0.5 && !s.flags.sealed && alive) ev = 'sealed';
    else if (hab && hab.on && !hab.leak && s.t > 40 && cdOK(s, 'leak', 70) && rnd(s) < 0.035) ev = 'leak';
    else if (both && s.t > 30 && cdOK(s, 'earthMsg', 80) && rnd(s) < (s.flags.antenna ? 0.1 : 0.04)) ev = 'earthMsg';
    else if (both && (s.bond < 38 || (e.needs.stress > 62 && h.needs.stress > 62)) && cdOK(s, 'conflict', 60) && rnd(s) < 0.1) ev = 'conflict';
    else if (both && hr >= 17 && hr < 18.5 && s.stormK < 0.1 && s.t > 12 && cdOK(s, 'horizon', 70) && rnd(s) < 0.3) ev = 'horizon';
    else if (s.stats.trips >= 6 && !s.flags.rare && rnd(s) < 0.2) ev = 'rare';
    else if (both && s.res.food < 8 && !s.flags.ration) ev = 'ration';
    else if (hr >= 3 && hr < 5 && cdOK(s, 'frozen', 60) && rnd(s) < 0.15 && ofType(s, 'drill', true).some(function (b) { return b.on; })) ev = 'frozen';
    if (ev) { s.cd[ev] = s.t; s.pending = ev; emit(s, { type: 'event', id: ev }); return; }
    // diálogos
    if (both && !e.sleeping && !h.sleeping && e.critical <= 0 && h.critical <= 0 && cdOK(s, 'dlg', 3) && rnd(s) < 0.4) {
      var cond = { firstPanel: s.flags.firstPanel, early: s.t > 8 && so === 1, lowFood: s.res.food < 10, lowO2: s.res.o2 < 30, night: isNight(s) && s.stormK < 0.1, storm: s.stormK > 0.4, growing: s.flags.firstSprout, water: s.flags.firstWater, bondHigh: s.bond > 70, bondLow: s.bond < 35, sol5: so >= 5, antenna: s.flags.antenna };
      for (var i = 0; i < D.dialogues.length; i++) { var dg = D.dialogues[i]; if (!s.said[dg.id] && cond[dg.cond]) { s.said[dg.id] = 1; s.cd.dlg = s.t; emit(s, { type: 'dialogue', lines: dg.lines }); break; } } }
  }
  function choose(s, idx) { var ev = s.pending; if (!ev) return; s.pending = null; var e = s.chars.elias, h = s.chars.helena, hab = ofType(s, 'habitat', true)[0], note = '';
    switch (ev) {
      case 'leak': if (idx === 0) { h.needs.energy = Math.max(5, h.needs.energy - 30); h.needs.stress = clamp(h.needs.stress + 15, 0, 100); h.skills.eng = Math.min(10, h.skills.eng + (h.skills.eng < 10 ? 1 : 0)); s.res.o2 = Math.max(0, s.res.o2 - 4); note = 'Helena fechou o vazamento do habitat com as próprias mãos.'; }
        else if (idx === 1) { if (hab) { hab.leak = true; hab.hp = 60; } s.res.o2 = Math.max(0, s.res.o2 - 3); note = 'Um remendo segurou o vazamento do habitat. Por enquanto.'; alertK(s, 'warn', 'Remendo provisório: o habitat perde O₂ até ser reparado', 'leak2', hab && hab.x, hab && hab.z, 0); }
        else { if (s.res.comp >= 6) { s.res.comp -= 6; note = 'O vazamento foi selado com peças de reserva.'; } else { if (hab) { hab.leak = true; hab.hp = 60; } note = 'Não havia peças de reserva. O vazamento continua.'; alertK(s, 'warn', 'Faltaram componentes: repare o habitat', 'leak3', hab && hab.x, hab && hab.z, 0); } } break;
      case 'earthMsg': if (idx === 0) { s.res.energy = Math.max(0, s.res.energy - 15); e.needs.morale = Math.min(100, e.needs.morale + 15); h.needs.morale = Math.min(100, h.needs.morale + 15); e.needs.stress = Math.max(0, e.needs.stress - 10); h.needs.stress = Math.max(0, h.needs.stress - 10); axis(s, 'origem', -20); note = 'As mensagens da Terra foram ouvidas uma a uma. Todas foram respondidas.'; }
        else { axis(s, 'origem', 20); note = 'As mensagens da Terra ficaram na fila. A energia ficou em Marte.'; } break;
      case 'conflict': if (idx === 0) { s.bond = clamp(s.bond + 14, 0, 100); e.needs.stress = Math.max(0, e.needs.stress - 15); h.needs.stress = Math.max(0, h.needs.stress - 15); s.t += 0; axis(s, 'comunidade', -15); e.lastTalk = h.lastTalk = s.t; note = 'Depois da discussão, os dois sentaram e conversaram até o fim.'; }
        else { s.bond = clamp(s.bond - 12, 0, 100); axis(s, 'comunidade', 15); note = 'A discussão terminou sem conversa. Cada um voltou ao seu trabalho.'; } break;
      case 'horizon': if (idx === 0) { e.needs.stress = Math.max(0, e.needs.stress - 20); h.needs.stress = Math.max(0, h.needs.stress - 12); s.bond = clamp(s.bond + 8, 0, 100); axis(s, 'planeta', -8); e.lastCont = s.t; note = 'Os dois pararam para ver o pôr do sol azul. Ninguém falou.'; }
        else { e.needs.stress = clamp(e.needs.stress + 6, 0, 100); note = 'O pôr do sol passou sem plateia.'; } break;
      case 'rare': s.flags.rare = true; if (idx === 0) { addRes(s, 'metal', 30); addRes(s, 'comp', 10); axis(s, 'planeta', 25); note = 'A veia de mineral raro foi extraída até o fim.'; } else { s.res.research += 6; axis(s, 'planeta', -25); note = 'A formação antiga foi preservada. Só as amostras saíram de lá.'; } break;
      case 'ration': s.flags.ration = true; if (idx === 0) { s.bond = clamp(s.bond + 10, 0, 100); axis(s, 'comunidade', -25); note = 'A comida que restava foi dividida em partes iguais.'; } else { s.bond = clamp(s.bond - 10, 0, 100); e.needs.hunger = Math.max(0, e.needs.hunger - 30); h.needs.stress = clamp(h.needs.stress + 12, 0, 100); axis(s, 'comunidade', 25); note = 'A comida foi priorizada para quem trabalha fora.'; } break;
      case 'frozen': var dr = ofType(s, 'drill', true)[0]; if (idx === 0) { s.res.energy = Math.max(0, s.res.energy - 20); } else if (dr) dr.frozen = s.t + 6; break;
      case 'cnWater': if (idx === 0 && s.res.water >= 30) { s.res.water -= 30; trust(s, 'cn', 22); note = 'A colônia mandou água para a Xuanyuan quando o perfurador deles quebrou.'; } else trust(s, 'cn', -14); break;
      case 'deResearch': if (idx === 0 && s.res.comp >= 15) { s.res.comp -= 15; s.res.research += 25; trust(s, 'de', 15); note = 'Kepler e SpaceZ estudaram a estrutura juntos.'; } else trust(s, 'de', -5); break;
      case 'border': if (idx === 0) trust(s, s.evFac, 14); else trust(s, s.evFac, -22); break;
      case 'help': if (idx === 0 && s.res.ammo >= 60) { s.res.ammo -= 60; trust(s, s.evFac, 20); note = 'A colônia mandou munição para os vizinhos sob ataque.'; } else trust(s, s.evFac, -12); break;
      case 'sealed': s.flags.sealed = true; s.res.o2 += B.sealedO2; chron(s, 'sealed', {}); alertK(s, 'crit', 'Reserva lacrada aberta: resolva a produção de O₂ agora', 'sealed', null, null, 0); break;
    }
    if (note && !s.flags['n_' + ev + idx]) { s.flags['n_' + ev + idx] = 1; chron(s, 'choice', { what: note }); } emit(s, { type: 'sound', id: 'drop' }); }

  // ---------------- TICK ----------------
  function tick(s, dtS) { // dtS = segundos de simulação (tempo real × velocidade)
    if (s.lost || s.pending) return; if (dtS > 2) dtS = 2;
    var dtH = dtS / HS; s.t += dtH;
    var st = s.storm, k = 0; if (!B.storm && st.st) st.st = 0; if (st.st === 2) k = clamp(Math.min(s.t - st.start, st.end - s.t) / 3, 0, 1); s.stormK = k;
    var cp = networks(s, dtH); production(s, dtH, cp); society(s, dtH);
    var alive = 0; for (var id in s.chars) { charTick(s, s.chars[id], dtS, dtH); if (s.chars[id].alive && !s.chars[id].veh) alive++; }
    war(s, dtS, dtH);
    for (var r in s.res) if (s.res[r] < 0) s.res[r] = 0;
    if (Math.floor(s.t) !== s.lastHour) { s.lastHour = Math.floor(s.t); hourly(s); if (s.lastHour % 24 === 0) emit(s, { type: 'newSol' }); }
    if (!alive && !s.lost) { s.lost = true; chron(s, 'lost', {}); emit(s, { type: 'scene', id: 'defeat' }); }
  }

  // ---------------- ERA II: SINAIS, ATAQUES, GUARDA E VEÍCULOS ----------------
  function warInit(s) { s.arms = s.arms || {}; s.al = s.al || { st: 0, t0: 0, wave: 0, next: 0, nights: 0, attack: false, found: false, site: null, kills: 0 }; s.foes = s.foes || []; s.fid = s.fid || 1; s.nv = s.nv || 0; if (s.res.ammo == null) s.res.ammo = 0; s.fac = s.fac || {}; s.fb = s.fb || []; }
  function fx(s, o) { if (s.rt.fx && s.rt.fx.length < 300) s.rt.fx.push(o); }
  function nightAt(t) { var d = Math.floor(t / 24) * 24 + 21; return d > t ? d : d + 24; }
  function foesNear(s, x, z, r) { var best = null, bd = r; for (var i = 0; i < s.foes.length; i++) { var f = s.foes[i]; if (f.hp <= 0 || f.flee) continue; var d = Math.hypot(f.x - x, f.z - z) - (f.type === 'core' ? 4 : 0); if (d < bd) { bd = d; best = f; } } return best ? { f: best, d: bd } : null; }
  function spawnWave(s) { var A = s.al, C = N / 2, n = Math.min(14, 2 + Math.floor(A.wave * 1.6)), sp = A.wave >= 2 ? Math.floor(n / 3) : 0, base = Math.atan2(A.site.z - C, A.site.x - C) + (rnd(s) - 0.5) * 1.6, r = 10, x, z;
    while (r < N / 2 - 4) { x = Math.floor(C + Math.cos(base) * r); z = Math.floor(C + Math.sin(base) * r); if (s.rt.play[z * N + x] < 40) break; r += 1; } r += 4;
    var ox = C + Math.cos(base) * r, oz = C + Math.sin(base) * r;
    if (s.era >= 4) { var nc = 1 + Math.floor(A.wave / 3); for (var ci = 0; ci < nc; ci++) s.foes.push({ id: s.fid++, type: 'colossus', x: ox + (rnd(s) - 0.5) * 6, z: oz + (rnd(s) - 0.5) * 6, sx: ox, sz: oz, hp: D.aliens.colossus.hp * (1 + A.wave * 0.05), cd: 0 }); n = Math.min(20, n + 4); }
    for (var i = 0; i < n; i++) s.foes.push({ id: s.fid++, type: i < sp ? 'spitter' : 'crawler', x: ox + (rnd(s) - 0.5) * 5, z: oz + (rnd(s) - 0.5) * 5, sx: ox, sz: oz, hp: D.aliens[i < sp ? 'spitter' : 'crawler'].hp * (1 + A.wave * 0.08), cd: 0 });
    A.wave++; A.attack = true; if (A.wave === 1) chron(s, 'ataque', {}); alertK(s, 'crit', 'Ataque! ' + n + ' criaturas vindo do escuro. Os colonos se abrigam; a Guarda vai ao combate', 'wave' + A.wave, ox, oz, 0); emit(s, { type: 'sound', id: 'alarm' }); emit(s, { type: 'raid', on: true }); }
  function postOf(s, c) { if (c.post == null) return null; var b = byId(s, c.post); if (!b || !b.built || b.hp <= 0) { c.post = null; return null; } return b; }
  function hitChar(s, c, dmg) { var pb = postOf(s, c); if (pb && Math.hypot(pb.x + 0.5 - c.x, pb.z + 0.5 - c.z) < 1.2) dmg *= 0.4; c.needs.health = Math.max(0, c.needs.health - dmg); if (c.veh && c.needs.health <= 0) { c.alive = false; alertK(s, 'crit', cname(c.id) + ' foi destruído', 'vd' + c.id, c.x, c.z, 0); } }
  function hitBuilding(s, b, dmg) { if (!b.built) dmg *= 1.5; var cbh = center(b); for (var di = 0; di < s.b.length; di++) { var dm = s.b[di]; if (dm.type === 'domo' && dm.built && dm.on) { var cd0 = center(dm); if (Math.hypot(cd0.x - cbh.x, cd0.z - cbh.z) < BD.domo.shield) { dmg *= 0.5; break; } } } b.hp = Math.max(0, b.hp - dmg); if (b.hp <= 0 && BD[b.type].wall) { s.b.splice(s.b.indexOf(b), 1); rebuildOcc(s); fx(s, { k: 'boom', x: b.x + 0.5, z: b.z + 0.5 }); } else if (b.hp < 40) alertK(s, 'warn', BD[b.type].name + ' sob ataque', 'atk' + b.id, b.x, b.z, 8); }
  function foeTick(s, f, dtS) { if (f.type === 'core') return coreTick(s, f, dtS); var A = D.aliens[f.type], C = N / 2, i;
    if (f.flee) { var dx = f.sx - f.x, dz = f.sz - f.z, d = Math.hypot(dx, dz); if (d < 1) { f.gone = true; return; } f.x += dx / d * A.speed * 1.3 * dtS; f.z += dz / d * A.speed * 1.3 * dtS; return; }
    if (!f.tg || f.rt < s.t) { f.rt = s.t + 0.08; f.tg = null; var bd = 13;
      for (var id in s.chars) { var c = s.chars[id]; if (!c.alive || c.inside != null || c.critical > 0) continue; var d0 = Math.hypot(c.x - f.x, c.z - f.z); if (d0 < bd) { bd = d0; f.tg = { k: 'c', id: id }; } }
      if (!f.tg) { bd = 1e9; for (i = 0; i < s.b.length; i++) { var b0 = s.b[i]; if (b0.hp <= 0 || BD[b0.type].floor) continue; var cb0 = center(b0), d1 = Math.hypot(cb0.x - f.x, cb0.z - f.z) + (BD[b0.type].wall ? 6 : 0); if (d1 < bd) { bd = d1; f.tg = { k: 'b', id: b0.id }; } } } }
    if (!f.tg) return; var tx, tz, reach = A.range, tc = null, tb = null;
    if (f.tg.k === 'c') { tc = s.chars[f.tg.id]; if (!tc || !tc.alive || tc.inside != null) { f.tg = null; return; } tx = tc.x; tz = tc.z; }
    else { tb = byId(s, f.tg.id); if (!tb || tb.hp <= 0) { f.tg = null; return; } var cb = center(tb); tx = cb.x; tz = cb.z; reach += Math.max(BD[tb.type].w, BD[tb.type].h) / 2; }
    var ddx = tx - f.x, ddz = tz - f.z, dd = Math.hypot(ddx, ddz); f.face = Math.atan2(ddx, ddz); f.cd -= dtS;
    if (dd > reach) { var st = A.speed * dtS, nx = f.x + ddx / dd * st, nz = f.z + ddz / dd * st, k = Math.floor(nz) * N + Math.floor(nx), oc = (k >= 0 && k < N * N) ? s.rt.occ[k] : 0;
      if (oc > 0 && (!tb || oc !== tb.id)) { var blk = byId(s, oc); if (blk) { if (f.cd <= 0) { f.cd = 0.5; hitBuilding(s, blk, A.dps * 0.5 * (BD[blk.type].wall ? 0.35 / mul(blk) : 0.7)); fx(s, { k: 'claw', x: f.x, z: f.z }); } return; } }
      f.x = nx; f.z = nz; f.mv = true; return; }
    f.mv = false; if (f.cd > 0) return; f.cd = 0.5;
    if (f.type === 'spitter') fx(s, { k: 'spit', x: f.x, z: f.z, tx: tx, tz: tz }); else if (f.type === 'soldier') fx(s, { k: 'shot', x: f.x, z: f.z, tx: tx, tz: tz, w: 'enemy' });
    if (tc) hitChar(s, tc, A.dps * 0.5); else hitBuilding(s, tb, A.dps * 0.5 * (BD[tb.type].wall ? 0.35 / mul(tb) : 0.7)); }
  function shoot(s, x, z, f, dps, dtS, who) { var dmg = dps * dtS; if (s.res.ammo <= 0) dmg *= 0.15; else s.res.ammo = Math.max(0, s.res.ammo - 0.3 * dtS); f.hp -= dmg;
    who.sh = (who.sh || 0) - dtS; if (who.sh <= 0) { who.sh = (who.veh === 'tank' || who.veh === 'arty' ? 0.9 : 0.18) + Math.random() * 0.12; fx(s, { k: 'shot', x: x, z: z, tx: f.x, tz: f.z, w: who.veh || who.guard || (who.type === 'torreta' ? 'turret' : 'tower') }); } }
  function fightOrFlee(s, c, dtS) { if (!s.foes.length || c.critical > 0) return false;
    var VW = c.veh ? D.vehicles[c.veh] : null; if (c.guard || (VW && VW.dps)) { if (c.needs.health < 25 && !VW) return false; var nf = foesNear(s, c.x, c.z, c.post != null ? 22 : VW ? Math.max(16, VW.range + 6) : 16); if (!nf) return false; var W = VW || D.weapons[c.guard];
      if (c.act && !c.act.fight) { requeue(c); clearAct(c); } c.act = null; c.sleeping = false; c.inside = null; c.hold = null; c.fighting = true; c.face = Math.atan2(nf.f.x - c.x, nf.f.z - c.z);
      var pb = postOf(s, c), rng = W.range * (pb ? 1.5 : 1); if (pb) { var pd = Math.hypot(pb.x + 0.5 - c.x, pb.z + 0.5 - c.z); if (pd > 0.4) { var pv = Math.min(pd, B.walk * 1.2 * dtS); c.x += (pb.x + 0.5 - c.x) / pd * pv; c.z += (pb.z + 0.5 - c.z) / pd * pv; c.firing = false; return true; } if (nf.d > rng) { c.firing = false; return true; } }
      if (!pb && nf.d > W.range * 0.9) { var v = B.walk * (VW ? VW.speed : 1.1) * dtS, nx = c.x + (nf.f.x - c.x) / nf.d * v, nz = c.z + (nf.f.z - c.z) / nf.d * v; if (freeTile(s, Math.floor(nx), Math.floor(nz))) { c.x = nx; c.z = nz; } else if (freeTile(s, Math.floor(nx), Math.floor(c.z))) c.x = nx; else if (freeTile(s, Math.floor(c.x), Math.floor(nz))) c.z = nz; c.firing = false; }
      else { shoot(s, c.x, c.z, nf.f, W.dps * (1 + 0.04 * (c.skills.pil || 0)), dtS, c); if (W.area) for (var ai = 0; ai < s.foes.length; ai++) { var af = s.foes[ai]; if (af !== nf.f && Math.hypot(af.x - nf.f.x, af.z - nf.f.z) < 2.2) af.hp -= W.dps * 0.5 * dtS; } c.firing = true; }
      return true; }
    c.fighting = false; c.firing = false;
    if (c.inside == null && !c.veh) { var near = foesNear(s, c.x, c.z, 9); if (near && !(c.act && c.act.type === 'warm' && c.act.flee)) { var sh = shelter(s, c); if (sh) { requeue(c); clearAct(c); c.queue = []; c.hold = null; if (start(s, c, { type: 'warm', kind: 'b', id: sh.id })) c.act.flee = true; alertK(s, 'warn', 'Colonos correndo para se abrigar', 'flee', c.x, c.z, 12); } } }
    else if (c.inside != null && !c.act && s.al.attack) { c.wait = s.t + 0.5; return true; }
    return false; }
  function war(s, dtS, dtH) { var A = s.al, i;
    if (s.won && A.st === 0) { if (!A.t0) A.t0 = s.t; if (s.t - A.t0 >= 6) { A.st = 1; A.site = { x: N / 2 - 18, z: N / 2 - 74 }; for (var dz = -4; dz <= 4; dz++) for (var dx = -4; dx <= 4; dx++) { var kk = (A.site.z + dz) * N + A.site.x + dx; if (kk >= 0 && kk < N * N) s.rt.fog[kk] = 1; } s.rt.fogDirty = true;
        A.next = nightAt(s.t + 18); chron(s, 'sinal', {}); alertK(s, 'crit', 'A antena captou um sinal regular vindo de baixo do gelo, ao norte. Prepare a defesa', 'sinal', A.site.x, A.site.z, 0); emit(s, { type: 'sound', id: 'discover' }); emit(s, { type: 'scene', id: 'signal' }); } }
    if (A.st >= 1 && !A.attack && !s.ended && s.t >= A.next) spawnWave(s);
    if (A.attack && !isNight(s)) for (i = 0; i < s.foes.length; i++) if (s.foes[i].type !== 'core') s.foes[i].flee = true;
    eras(s, dtS, dtH);
    for (i = 0; i < s.foes.length; i++) foeTick(s, s.foes[i], dtS);
    // torres de vigia
    for (i = 0; i < s.b.length; i++) { var b = s.b[i]; if ((b.type !== 'vigia' && b.type !== 'torreta') || !b.built || !b.on) continue; var cb = center(b), nf = foesNear(s, cb.x, cb.z, BD[b.type].range); if (nf) shoot(s, cb.x, cb.z, nf.f, BD[b.type].dps * mul(b), dtS, b); }
    for (i = s.foes.length - 1; i >= 0; i--) { var f = s.foes[i]; if (f.hp <= 0) { A.kills++; fx(s, { k: 'die', x: f.x, z: f.z }); s.foes.splice(i, 1); } else if (f.gone) s.foes.splice(i, 1); }
    if (A.attack && !s.foes.some(function (f) { return f.type !== 'core'; })) { A.attack = false; A.nights++; A.next = nightAt(s.t + 4); alertK(s, 'info', 'O ataque acabou. Confira os estragos e repare', 'endw' + A.wave, null, null, 0); emit(s, { type: 'raid', on: false }); if (A.nights === 3) chron(s, 'noites', {}); }
    // estrutura: alguém chega perto
    if (A.st === 1 && !A.found && A.site) for (var id in s.chars) { var c = s.chars[id]; if (c.alive && Math.hypot(c.x - A.site.x, c.z - A.site.z) < 4) { A.found = true; chron(s, 'estrutura', { who: cname(id) }); alertK(s, 'crit', cname(id) + ' chegou à estrutura. Ela pulsa, e algo no céu responde', 'found', A.site.x, A.site.z, 0); emit(s, { type: 'sound', id: 'discover' }); break; } }
    // veículos recarregam perto da Garagem
    for (var vid in s.chars) { var v = s.chars[vid]; if (!v.veh || !v.alive) continue; for (i = 0; i < s.b.length; i++) { var g = s.b[i]; if (g.type === 'garagem' && g.built && g.on) { var cg = center(g); if (Math.hypot(cg.x - v.x, cg.z - v.z) < 4) { v.bat = Math.min(100, v.bat + 30 * dtH); v.needs.health = Math.min(100, v.needs.health + 15 * dtH); } } } } }
  // ---------------- ERAS III–V: os outros, o despertar e o fim ----------------
  function facBase(s, k) { var F = D.factions[k], C = N / 2; return { x: C + F.dx, z: C + F.dz }; }
  function fbAdd(s, k, type, ox, oz) { var bs = facBase(s, k); s.fb.push({ id: s.nid++, fac: k, type: type, x: Math.round(bs.x + ox), z: Math.round(bs.z + oz), hp: 100 }); }
  var FB_LAYOUT = [['ship', 0, 0], ['habitat', 6, -4], ['solar', -6, -4], ['solar', -6, 0], ['antenna', 0, -7], ['quartel', 6, 3], ['casa', -3, 6], ['casa', 0, 6], ['vigia', 9, -7], ['vigia', -9, 8], ['casa', 3, 9], ['solar', -9, -4], ['battery', -9, 0], ['greenhouse', 10, 7], ['casa', -6, 9], ['workshop', 12, -1], ['vigia', 12, 10], ['casa', 6, 12], ['habitat', -12, 4], ['solar', -12, -8], ['torreta', 0, -12], ['casa', -9, 12], ['garagem', 14, -8], ['casa', 0, 14], ['torreta', -14, 12]];
  function facLand(s, k) { var f = s.fac[k], bs = facBase(s, k); f.st = 1; f.landT = s.t; f.n = 0; for (var i = 0; i < (k === 'cn' ? 10 : 7); i++) { var L = FB_LAYOUT[i]; fbAdd(s, k, L[0], L[1], L[2]); f.n++; }
    for (var dz = -16; dz <= 16; dz++) for (var dx = -16; dx <= 16; dx++) { var kk = (bs.z + dz) * N + bs.x + dx; if (kk >= 0 && kk < N * N && dx * dx + dz * dz < 256) s.rt.fog[kk] = 1; } s.rt.fogDirty = true;
    chron(s, 'pouso_' + k, {}); alertK(s, 'crit', D.factions[k].name + ' (' + D.factions[k].short + ') pousou. Abra Diplomacia', 'land' + k, bs.x, bs.z, 0); emit(s, { type: 'sound', id: 'discover' }); emit(s, { type: 'fac' }); }
  function trust(s, k, d) { var f = s.fac[k]; f.trust = clamp(f.trust + d, 0, 100); emit(s, { type: 'fac' }); }
  function eras(s, dtS, dtH) { var A = s.al, C = N / 2, k;
    if (s.era === 2 && A.found && !s.flags.era3) { s.flags.era3 = 1; s.flags.era3T = s.t; s.era = 3; s.fac = { cn: { st: 0, t0: s.t, trust: 50, war: false, treaty: false, ally: false, raids: 0, rep: 0, pop: 30 }, de: { st: 0, t0: s.t, trust: 55, war: false, treaty: false, ally: false, raids: 0, rep: 0, pop: 14 } };
      chron(s, 'era3', {}); emit(s, { type: 'scene', id: 'era3' }); alertK(s, 'crit', 'Era III: duas naves cruzam o céu. China e Alemanha estão chegando', 'era3', null, null, 0); }
    if (s.era >= 3) for (k in s.fac) { var f = s.fac[k], F = D.factions[k];
      if (f.st === 0 && s.t - f.t0 >= F.delay) facLand(s, k);
      if (f.st !== 1) continue;
      if (f.n < FB_LAYOUT.length && s.t - f.landT > (f.n - 6) * (k === 'cn' ? 10 : 15)) { var L = FB_LAYOUT[f.n]; fbAdd(s, k, L[0], L[1], L[2]); f.n++; f.pop += k === 'cn' ? 3 : 1; emit(s, { type: 'fac' }); }
      f.trust += (45 - f.trust) * 0.004 * dtH; // a confiança volta devagar para o meio
      // pedidos e atritos
      if (!s.pending && !f.war) {
        if (k === 'cn' && cdOK(s, 'cnWater', 40) && s.t - f.landT > 10 && rnd(s) < 0.02 * dtH) { s.cd.cnWater = s.t; s.pending = 'cnWater'; s.evFac = 'cn'; emit(s, { type: 'event', id: 'cnWater' }); }
        else if (k === 'de' && cdOK(s, 'deResearch', 50) && s.t - f.landT > 8 && rnd(s) < 0.02 * dtH) { s.cd.deResearch = s.t; s.pending = 'deResearch'; s.evFac = 'de'; emit(s, { type: 'event', id: 'deResearch' }); }
        else if (cdOK(s, 'border' + k, 60) && s.zones.some(function (z) { var bs = facBase(s, k); return Math.hypot(z.x - bs.x, z.z - bs.z) < 48 && z.k > 1; }) && rnd(s) < 0.03 * dtH) { s.cd['border' + k] = s.t; s.pending = 'border'; s.evFac = k; emit(s, { type: 'event', id: 'border' }); }
        else if (s.era >= 4 && cdOK(s, 'help' + k, 48) && rnd(s) < 0.015 * dtH) { s.cd['help' + k] = s.t; s.pending = 'help'; s.evFac = k; emit(s, { type: 'event', id: 'help' }); } }
      // ataques humanos à noite
      var hostile = f.war || (f.trust < 18 && !f.treaty);
      if (hostile && isNight(s) && hour(s) >= 22 && cdOK(s, 'raid' + k, 30) && !s.foes.some(function (q) { return q.fac === k; })) { s.cd['raid' + k] = s.t; f.raids++; if (!f.war) { f.war = true; chron(s, 'guerra', { who: F.name }); }
        var bs2 = facBase(s, k), ang = Math.atan2(bs2.z - C, bs2.x - C), r = 10, x, z; while (r < N / 2 - 4) { x = Math.floor(C + Math.cos(ang) * r); z = Math.floor(C + Math.sin(ang) * r); if (s.rt.play[z * N + x] < 40) break; r++; } r += 3;
        var n = 3 + f.raids; for (var i = 0; i < n; i++) s.foes.push({ id: s.fid++, type: 'soldier', fac: k, x: C + Math.cos(ang) * r + (rnd(s) - 0.5) * 4, z: C + Math.sin(ang) * r + (rnd(s) - 0.5) * 4, sx: C + Math.cos(ang) * (r + 6), sz: C + Math.sin(ang) * (r + 6), hp: D.aliens.soldier.hp, cd: 0 });
        A.attack = true; alertK(s, 'crit', 'Ataque humano! Soldados da ' + F.name + ' vindo de ' + (k === 'cn' ? 'nordeste' : 'sudoeste'), 'hraid' + k + f.raids, null, null, 0); emit(s, { type: 'sound', id: 'alarm' }); emit(s, { type: 'raid', on: true }); }
      if (f.war && f.raids > f.rep && !s.foes.some(function (q) { return q.fac === k; }) && !isNight(s)) { f.rep = f.raids; s.flags.repelled = 1; if (f.rep >= 2) { f.war = false; f.trust = 32; alertK(s, 'info', 'A ' + F.name + ' pediu trégua depois de dois ataques fracassados', 'truce' + k, null, null, 0); emit(s, { type: 'fac' }); } } }
    // Era IV: a estrutura desperta
    if (s.era === 3 && ofType(s, 'fabrica', true).length && s.t - s.flags.era3T >= 36 && !s.flags.era4) { s.flags.era4 = 1; s.era = 4; addZone(s, A.site.x, A.site.z, 20);
      s.foes.push({ id: s.fid++, type: 'core', x: A.site.x, z: A.site.z, sx: A.site.x, sz: A.site.z, hp: 14000, max: 14000, cd: 0 }); A.next = Math.min(A.next, nightAt(s.t));
      chron(s, 'despertar', {}); emit(s, { type: 'scene', id: 'awaken' }); alertK(s, 'crit', 'Era IV: a estrutura despertou. Vêm Colossos. Prepare tanques e o Domo de escudo', 'era4', A.site.x, A.site.z, 0); emit(s, { type: 'sound', id: 'alarm' }); }
    // aliados ajudam nas ondas
    if (A.attack) for (k in s.fac) if (s.fac[k].ally) for (var j = 0; j < s.foes.length; j++) { var fo = s.foes[j]; if (fo.type !== 'core' && !fo.fac) fo.hp -= 3 * dtS; } }
  function coreTick(s, f, dtS) { f.cd -= dtS; f.pz = (f.pz || 0) - dtS; if (f.pz <= 0) { f.pz = 2.5; for (var id in s.chars) { var c = s.chars[id]; if (c.alive && Math.hypot(c.x - f.x, c.z - f.z) < 12) { hitChar(s, c, c.veh ? 10 : 5); fx(s, { k: 'spit', x: f.x, z: f.z, tx: c.x, tz: c.z }); } } } if (f.hp < f.max && f.cd <= 0) { f.cd = 14; var n = f.hp < f.max * 0.5 ? 4 : 2; for (var i = 0; i < n; i++) s.foes.push({ id: s.fid++, type: rnd(s) < 0.3 ? 'spitter' : 'crawler', x: f.x + (rnd(s) - 0.5) * 6, z: f.z + (rnd(s) - 0.5) * 6, sx: f.x, sz: f.z, hp: 34, cd: 0, guard: 1 }); fx(s, { k: 'die', x: f.x, z: f.z }); }
    if (f.hp <= 0 && !s.ended) ending(s); }
  function ending(s) { var al = 0, war = 0; for (var k in s.fac) { if (s.fac[k].treaty || s.fac[k].ally) al++; if (s.fac[k].war) war++; }
    s.ended = war ? 'dividido' : al >= 2 ? 'unido' : 'independente'; s.era = 5; chron(s, 'nucleo', {});
    var txt = { unido: 'Marte unido. SpaceZ, Xuanyuan e Kepler assinaram a Carta de Marte: um planeta, três bandeiras, nenhuma guerra.', independente: 'Marte independente. A colônia sobreviveu ao que veio do gelo sem depender de ninguém. Os vizinhos observam, com respeito.', dividido: 'Marte dividido. O núcleo se apagou, mas a guerra entre humanos continua. A próxima ameaça talvez seja a gente.' }[s.ended];
    chron(s, 'fim', { what: txt }); emit(s, { type: 'scene', id: 'ending', end: s.ended }); s.foes = s.foes.filter(function (q) { return q.type !== 'core'; }); }
  function dip(s, k, act, arg) { var f = s.fac[k], F = D.factions[k]; if (!f || f.st !== 1) return { ok: false, msg: 'Ainda não pousaram' };
    function pay(c) { for (var r in c) if ((s.res[r] || 0) < c[r]) return false; for (r in c) s.res[r] -= c[r]; return true; }
    if (act === 'gift') { if (!cdOK(s, 'gift' + k, 12)) return { ok: false, msg: 'Espere um pouco antes de outro presente' }; if (!pay({ water: 20, food: 20 })) return { ok: false, msg: 'Precisa de 20 água e 20 alimento' }; s.cd['gift' + k] = s.t; trust(s, k, f.war ? 6 : 12); s.flags.troca = 1; return { ok: true, msg: 'Presente entregue. A ' + F.name + ' agradece' }; }
    if (act === 'trade') { var T0 = F.trade[arg]; if (f.war) return { ok: false, msg: 'Não negociam em guerra' }; if (!pay(T0.give)) return { ok: false, msg: 'Faltam recursos para a troca' }; for (var r in T0.get) addRes(s, r, T0.get[r]); trust(s, k, 3); s.flags.troca = 1; return { ok: true, msg: 'Troca feita' }; }
    if (act === 'treaty') { if (f.war) return { ok: false, msg: 'Primeiro, a paz' }; if (f.trust < 60) return { ok: false, msg: 'Precisa de confiança 60 ou mais' }; f.treaty = true; s.flags.tratado = 1; chron(s, 'tratado', { who: F.name }); emit(s, { type: 'fac' }); return { ok: true, msg: 'Tratado de não agressão assinado' }; }
    if (act === 'ally') { if (s.era < 4) return { ok: false, msg: 'Alianças só na Era IV' }; if (!f.treaty || f.trust < 75) return { ok: false, msg: 'Precisa de tratado e confiança 75' }; f.ally = true; emit(s, { type: 'fac' }); return { ok: true, msg: 'Aliança: eles vão ajudar contra os ataques' }; }
    if (act === 'peace') { if (!f.war) return { ok: false, msg: 'Não estão em guerra' }; if (!pay({ metal: 40, comp: 20 })) return { ok: false, msg: 'A paz custa 40 metal e 20 componentes' }; f.war = false; f.trust = 30; emit(s, { type: 'fac' }); return { ok: true, msg: 'Paz assinada' }; }
    if (act === 'war') { f.war = true; f.treaty = false; f.ally = false; f.trust = 0; chron(s, 'guerra', { who: F.name }); emit(s, { type: 'fac' }); return { ok: true, msg: 'Guerra declarada à ' + F.name }; }
    return { ok: false, msg: '?' }; }

  // Começar direto numa Era: monta uma base pronta (para quem quer ver as fases avançadas sem jogar desde o pouso)
  function quick(era) { var s = newGame(D.lore.year), C = N / 2, i; s.rt.fog.fill(1); s.rt.fogDirty = true;
    s.flags.telemetry = s.flags.inspected = s.flags.unloaded = s.flags.iceFound = s.flags.firstPanel = s.flags.firstWater = s.flags.firstSprout = s.flags.antenna = true; s.res.metal = s.res.comp = s.res.reg = 2000; s.res.water = s.res.food = s.res.o2 = 400; s.res.seeds = 60; s.res.research = 40;
    function qb(type, dx, dz, R0) { for (var r = 0; r < (R0 || 12); r++) for (var a = 0; a < 32; a++) { var x = Math.round(C + dx + Math.cos(a * 0.7) * r), z = Math.round(C + dz + Math.sin(a * 0.7) * r); if (canPlace(s, type, x, z).ok) { var b = place(s, type, x, z).b; finishBuilding(s, b, s.chars.elias); return b; } } return null; }
    [[6, -3], [8, -3], [6, -1], [8, -1], [10, -3], [10, -1], [12, -3], [12, -1]].forEach(function (p) { qb('solar', p[0], p[1], 3); }); for (i = 0; i < 4; i++) qb('battery', 14, -3 + i, 4);
    var al = qb('airlock', -3, 3); qb('habitat', -6, 3, 6); qb('workshop', 3, 7); qb('storage', 6, 4); var ic = s.rt.map.iceC[0]; qb('drill', ic.x - C, ic.z - C, 4); qb('purifier', -8, -4); qb('o2ext', -2, -7); qb('o2ext', 1, -8); qb('wtank', -10, -2); qb('o2tank', 0, -10);
    qb('greenhouse', -8, 8, 10); qb('greenhouse', -12, 6, 10); qb('lab', -4, 11, 10); qb('antenna', 12, 5); var pad = qb('pad', 15, -10, 10); qb('cryo', -2, 13, 12);
    for (i = 0; i < 7; i++) qb('casa', 2 + (i % 4) * 3, 12 + Math.floor(i / 4) * 3, 6); qb('berco', -10, 15, 10); qb('escola', -14, 16, 12); qb('jardim', 18, 12, 14);
    for (i = 0; i < 6; i++) qb('estrada', 0, -1 + i, 1); for (i = 0; i < 8; i++) qb('estrada', 1 + i, 9, 1);
    s.ark.st = 2; s.ark.pad = pad && pad.id; s.ark.pods.forEach(function (p, j) { p.st = 'awake'; var c = mkChar(s, p.id, C - 2 + (j % 4), C + 15 + Math.floor(j / 4)); }); s.ark.awake = 12; assignHomes(s);
    ['limpeza', 'celulas', 'reciclagem', 'trajes'].forEach(function (k) { s.tech[k] = true; });
    s.t = 8 * 24 + 7; s.won = true; s.era = 2; s.flags.firstHouse = true;
    if (era >= 3) { s.al.st = 1; s.al.site = { x: C - 18, z: C - 74 }; s.al.nights = 3; s.al.wave = 3; s.al.next = nightAt(s.t + 30); s.al.found = true;
      qb('quartel', 10, 8, 12); qb('arsenal', 14, 8, 12); qb('garagem', -16, -4, 14); for (i = 0; i < 12; i++) qb(i === 6 ? 'bastiao' : 'muro', -6 + i, -16, 2); qb('vigia', -4, -14, 4); qb('vigia', 5, -14, 4); qb('posto', -8, -34, 10); qb('posto', -14, -56, 10);
      s.arms.rifle = 4; s.arms.smg = 2; ['c1', 'c2', 'c3', 'c4'].forEach(function (k) { arm(s, k); }); s.res.ammo = 200; spawnVeh(s, 'rover', C - 12, C - 6); spawnVeh(s, 'rescue', C - 15, C - 8); s.flags.guarda = 1; }
    if (era >= 4) { s.flags.era3 = 1; s.flags.era3T = s.t - 40; s.era = 3; s.fac = { cn: { st: 0, t0: s.t - 99, trust: 55, war: false, treaty: false, ally: false, raids: 0, rep: 0, pop: 30 }, de: { st: 0, t0: s.t - 99, trust: 62, war: false, treaty: false, ally: false, raids: 0, rep: 0, pop: 14 } };
      qb('fabrica', 20, -2, 14); qb('torreta', -1, -14, 4); spawnVeh(s, 'rover_a', C - 10, C - 10); s.flags.troca = 1; }
    if (era === 3) { s.flags.era3 = 1; s.flags.era3T = s.t; s.era = 3; s.fac = { cn: { st: 0, t0: s.t - 5, trust: 50, war: false, treaty: false, ally: false, raids: 0, rep: 0, pop: 30 }, de: { st: 0, t0: s.t - 20, trust: 55, war: false, treaty: false, ally: false, raids: 0, rep: 0, pop: 14 } }; }
    s.res.metal = 400; s.res.comp = 250; s.res.reg = 300; s.rt.out.length = 0; s.chron = s.chron.slice(-6); return s; }
  function spawnVeh(s, ty, x, z) { var id = 'v' + (++s.nv); regVeh(id, ty); var c = mkChar(s, id, x, z); c.veh = ty; c.bat = 100; c.needs = { health: 100, o2: 100, hunger: 0, thirst: 0, energy: 100, temp: 90, stress: 0, morale: 80, rad: 0 }; return c; }

  function factory(s, b, dtH) { if (!b.on) return;
    if (b.type === 'arsenal' && s.res.ammo < 200 && s.res.metal >= 1 && s.res.comp >= 0.5) { b.ap = (b.ap || 0) + dtH * 6 * mul(b); while (b.ap >= 3 && s.res.metal >= 1 && s.res.comp >= 0.5) { b.ap -= 3; s.res.metal -= 1; s.res.comp -= 0.5; s.res.ammo += 3; } }
    if (!b.fab) return; b.fab.t += dtH * mul(b); var need = b.fab.w ? 3 : D.vehicles[b.fab.v].hours;
    if (b.fab.t >= need) { if (b.fab.w) { s.arms[b.fab.w] = (s.arms[b.fab.w] || 0) + 1; alertK(s, 'info', D.weapons[b.fab.w].short + ' pronta no Arsenal', 'arm' + b.id + s.t, b.x, b.z, 0); }
      else { var sp = spotNear(s, b), id = 'v' + (++s.nv); regVeh(id, b.fab.v); var c = mkChar(s, id, sp.x, sp.z); c.veh = b.fab.v; c.bat = 100; c.needs = { health: 100, o2: 100, hunger: 0, thirst: 0, energy: 100, temp: 90, stress: 0, morale: 80, rad: 0 }; c.vtype = b.fab.v; alertK(s, 'info', D.vehicles[b.fab.v].name + ' pronto na Garagem', 'veh' + id, c.x, c.z, 0); emit(s, { type: 'pop' }); }
      emit(s, { type: 'sound', id: 'built' }); b.fab = null; } }
  function orderItem(s, bid, kind, key) { var b = byId(s, bid); if (!b || !b.built) return { ok: false, msg: 'Termine a obra primeiro' }; if (b.fab) return { ok: false, msg: 'Já está fabricando' };
    var it = kind === 'w' ? D.weapons[key] : D.vehicles[key]; if (!it) return { ok: false, msg: '?' }; if (it.era > s.era) return { ok: false, msg: 'Liberado na Era ' + D.eras[it.era - 1].n };
    if (kind === 'v' && (it.plant || 'garagem') !== b.type) return { ok: false, msg: 'Fabricado na ' + BD[it.plant || 'garagem'].name };
    for (var r in it.cost) if (s.res[r] < it.cost[r]) return { ok: false, msg: 'Faltam materiais: ' + costText(it.cost) }; for (r in it.cost) s.res[r] -= it.cost[r];
    b.fab = kind === 'w' ? { w: key, t: 0 } : { v: key, t: 0 }; return { ok: true, msg: 'Encomendado: ' + it.name }; }
  function arm(s, cid, w) { var c = s.chars[cid]; if (!c || !c.alive || c.veh) return { ok: false, msg: 'Selecione um colono' }; if (!ofType(s, 'quartel', true).length) return { ok: false, msg: 'Construa o Quartel primeiro' };
    if (c.guard) { s.arms[c.guard] = (s.arms[c.guard] || 0) + 1; c.guard = null; return { ok: true, msg: cname(cid) + ' entregou a arma e voltou ao trabalho' }; }
    var order = w ? [w] : ['rifle', 'smg', 'shotgun', 'lmg', 'sniper', 'grenade', 'energy', 'rocket'], pick = null; for (var i = 0; i < order.length; i++) if (s.arms[order[i]] > 0) { pick = order[i]; break; }
    if (!pick) return { ok: false, msg: 'Sem armas no estoque: encomende no Arsenal' }; s.arms[pick]--; c.guard = pick;
    if (!s.flags.guarda) { s.flags.guarda = 1; chron(s, 'guarda', { who: cname(cid) }); } return { ok: true, msg: cname(cid) + ' agora é da Guarda (' + D.weapons[pick].short + ')' }; }
  function guards(s) { var n = 0; for (var id in s.chars) if (s.chars[id].alive && s.chars[id].guard) n++; return n; }
  function vehNeeds(s, c, dtH) { var n = c.needs; n.o2 = 100; n.hunger = 0; n.thirst = 0; n.energy = 100; n.temp = 90; n.stress = 0; n.morale = 80; c.inside = null; c.critical = 0;
    if (c.bat < 15 && !c.lowBat) { c.lowBat = 1; alertK(s, 'warn', cname(c.id) + ' com pouca bateria: volte para a Garagem', 'bat' + c.id, c.x, c.z, 20); } if (c.bat > 40) c.lowBat = 0; if (n.health <= 0) { c.alive = false; } }
  function vehDecide(s, c) { var V = c.veh, o, i;
    while (c.queue.length) { var q = c.queue.shift(); if (start(s, c, q, true)) return true; }
    if (c.hold) { c.wait = s.t + 0.5; return false; }
    if (c.carry) { var dp0 = dropoff(s, c); return start(s, c, { type: 'haul', kind: 'b', id: dp0.id }); }
    if (c.bat < 20) { for (i = 0; i < s.b.length; i++) if (s.b[i].type === 'garagem' && s.b[i].built) return start(s, c, { type: 'move', kind: 'b', id: s.b[i].id }); }
    if (V === 'rescue') { o = rescueTarget(s, c); if (o) return start(s, c, { type: 'rescue', kind: 'c', id: o.id }); }
    if (V === 'rover' && !s.al.attack) { var want = s.res.metal < s.res.reg ? 'metal' : 'reg', best = null, bd = 1e9; for (i = 0; i < s.deps.length; i++) { var d = s.deps[i]; if (d.res !== want || !s.rt.fog[d.z * N + d.x] || s.rt.play[d.z * N + d.x] < 110 || workers(s, c, 'gather', d.id) >= 2) continue; var dd = Math.hypot(d.x - c.x, d.z - c.z); if (dd < bd) { bd = dd; best = d; } } if (best) return start(s, c, { type: 'gather', kind: 'd', id: best.id }); }
    c.wait = s.t + 1; return false; }

  // ---------------- SOCIEDADE: a Alvorada, o despertar, o Berço, os bairros ----------------
  function spotNear(s, b) { var d = BD[b.type], g = ring(s, b.x, b.z, d.w, d.h); if (!g.length) return { x: b.x + d.w + 0.5, z: b.z + 0.5 }; var k = g[Math.floor(rnd(s) * g.length)]; return { x: (k % N) + 0.5, z: Math.floor(k / N) + 0.5 }; }
  function losePod(s) { var sl = sleepers(s); if (!sl.length) return; var p = sl[sl.length - 1]; p.st = 'lost'; chron(s, 'podLost', { who: cinfo(p.id).name }); alertK(s, 'crit', 'A cápsula de ' + cinfo(p.id).name + ' falhou', 'pod' + p.id, null, null, 0); emit(s, { type: 'sound', id: 'alarm' });
    for (var id in s.chars) if (s.chars[id].alive) { s.chars[id].needs.morale = Math.max(0, s.chars[id].needs.morale - 12); s.chars[id].needs.stress = clamp(s.chars[id].needs.stress + 10, 0, 100); } }
  function land(s, pad) { var A = s.ark; A.st = 2; A.pad = pad.id; A.lostT = 0; chron(s, 'arkLanded', {}); for (var k in B.arkCargo) addRes(s, k, B.arkCargo[k]); alertK(s, 'info', 'A ' + D.lore.ark + ' pousou. Suprimentos descarregados', 'arkL', pad.x, pad.z, 0); emit(s, { type: 'scene', id: 'arrival', b: pad.id }); }
  function wakeNext(s, id) { var P = s.ark.pods, i; for (i = 0; i < P.length; i++) if (P[i].id === id && P[i].st === 'sleep') { var p = P.splice(i, 1)[0]; P.unshift(p); return true; } return false; }
  function society(s, dtH) { var A = s.ark, i, b, pb;
    if (A.st === 0 && s.t >= B.arrivalT) { pb = ofType(s, 'pad', true)[0]; if (pb) land(s, pb); else { A.st = 1; chron(s, 'orbit', {}); alertK(s, 'crit', 'A ' + D.lore.ark + ' espera em órbita: construa a Zona de Pouso. As cápsulas aguentam uns 4 sóis', 'orbit', null, null, 0); emit(s, { type: 'sound', id: 'alarm' }); } }
    else if (A.st === 1) { pb = ofType(s, 'pad', true)[0]; if (pb) land(s, pb); else { A.lostT += dtH; if (A.lostT >= 96) { A.lostT -= 48; losePod(s); } } }
    else if (A.st === 2) { pb = byId(s, A.pad); var sl = sleepers(s);
      if (sl.length || A.wake) { if (pb && !pb.on) { A.lostT += dtH; if (A.lostT > 1.5) alertK(s, 'crit', 'Zona de Pouso sem energia: as cápsulas estão em bateria', 'arkPow', pb.x, pb.z, 6); if (A.lostT >= 48) { A.lostT -= 48; losePod(s); } } else A.lostT = Math.max(0, A.lostT - dtH * 0.5); }
      var cry = null; for (i = 0; i < s.b.length; i++) if (s.b[i].type === 'cryo' && s.b[i].on) { cry = s.b[i]; break; }
      if (A.wake) { if (cry) { A.wake.t += dtH * (s.chars.c4 && s.chars.c4.alive ? 1.4 : 1); if (A.wake.t >= B.wakeHours) { var id = A.wake.id, sp = spotNear(s, cry), c = mkChar(s, id, sp.x, sp.z); A.wake = null; A.awake++; c.weak = s.t + B.weakHours; c.needs.energy = 60; memo(s, c, 'despertou'); reveal(s, c, 4); assignHomes(s);
            for (i = 0; i < A.pods.length; i++) if (A.pods[i].id === id) A.pods[i].st = 'awake';
            alertK(s, 'info', cinfo(id).name + ' despertou (' + cinfo(id).role + ')', 'aw' + id, c.x, c.z, 0); emit(s, { type: 'sound', id: 'discover' }); emit(s, { type: 'pop' });
            if (A.awake === 1) { chron(s, 'firstAwake', { who: cinfo(id).name }); emit(s, { type: 'scene', id: 'firstAwake', b: cry.id, who: id }); }
            if (A.awake === 6) { s.flags.awake6 = true; chron(s, 'awake6', {}); emit(s, { type: 'scene', id: 'chapter2', b: cry.id }); } } } }
      else if (cry && sl.length && pop(s) < B.maxPop && s.res.food >= 6 + pop(s) * 1.5 && s.res.water >= 6 + pop(s)) { if (freeBeds(s) > 0) { A.wake = { id: A.pods.filter(function (p) { return p.st === 'sleep'; })[0].id, t: 0 }; for (i = 0; i < A.pods.length; i++) if (A.pods[i].id === A.wake.id) A.pods[i].st = 'waking'; }
        else alertK(s, 'warn', 'Sem leito livre: construa casas para despertar mais colonos', 'nobed', cry.x, cry.z, 10); }
      else if (cry && sl.length && pop(s) < B.maxPop && freeBeds(s) > 0) alertK(s, 'warn', 'Despertar adiado: faltam comida ou água para mais uma pessoa', 'nofoodwake', cry.x, cry.z, 12);
      else if (!cry && sl.length) alertK(s, 'warn', 'Construa a Enfermaria criogênica para despertar os colonos', 'nocryo', pb && pb.x, pb && pb.z, 10); }
    // o Berço: uma pessoa nova quando há leito, comida e água, e nenhuma cápsula esperando
    for (i = 0; i < s.b.length; i++) { b = s.b[i]; if (b.type !== 'berco' || !b.on) continue;
      if (!b.gest) { if (A.st === 2 && !sleepers(s).length && !A.wake && pop(s) < B.maxPop && s.res.food >= B.birthFood + 6 + pop(s) * 2 && s.res.water >= B.birthWater + 6 + pop(s) * 2 && !s.shed) { if (freeBeds(s) > 0) { s.res.food -= B.birthFood; s.res.water -= B.birthWater; b.gest = 0.0001; } else alertK(s, 'warn', 'O Berço espera um leito livre: mais casas, mais gente', 'nobed2', b.x, b.z, 12); } }
      else { b.gest += dtH / B.gestHours * (s.chars.c12 && s.chars.c12.alive ? 1.3 : 1); if (b.gest >= 1) { b.gest = 0; var nid = 'n' + (++s.nborn), sp2 = spotNear(s, b), nc = mkChar(s, nid, sp2.x, sp2.z); nc.bornT = s.t; memo(s, nc, 'nascido'); assignHomes(s);
          alertK(s, 'info', cinfo(nid).name + ' nasceu no Berço', 'born' + nid, nc.x, nc.z, 0); emit(s, { type: 'sound', id: 'discover' }); emit(s, { type: 'pop' });
          for (var k in s.chars) if (s.chars[k].alive) s.chars[k].needs.morale = Math.min(100, s.chars[k].needs.morale + 6);
          if (!s.flags.firstBorn) { s.flags.firstBorn = true; chron(s, 'firstBorn', { who: cinfo(nid).name }); emit(s, { type: 'scene', id: 'firstBorn', b: b.id }); } } } } }
  function bairros(s) { var H = s.b.filter(function (b) { return b.type === 'casa' && b.built; }), g = H.map(function (b, i) { return i; }), i, j, ch = true;
    while (ch) { ch = false; for (i = 0; i < H.length; i++) for (j = 0; j < H.length; j++) { if (g[j] >= g[i]) continue; var a = center(H[i]), c = center(H[j]); if (Math.hypot(a.x - c.x, a.z - c.z) <= 3.2) { g[i] = g[j]; ch = true; } } }
    var size = {}, n = 0; g.forEach(function (k) { size[k] = (size[k] || 0) + 1; }); H.forEach(function (b, i) { b.bairro = size[g[i]] >= 3; }); for (var k in size) if (size[k] >= 3) n++;
    while (s.nbairro < n) { s.nbairro++; var nm = D.bairroNames[(s.nbairro - 1) % D.bairroNames.length]; chron(s, s.nbairro === 1 ? 'bairro' : 'bairroN', { what: nm }); alertK(s, 'info', 'Novo bairro: ' + nm, 'bairro' + s.nbairro, null, null, 0); s.flags.bairro = true; emit(s, { type: 'sound', id: 'discover' }); } }

  function objectives(s) { var f = s.flags, has = function (t, n) { return ofType(s, t, true).length >= (n || 1); };
    var done = { inspect: f.inspected, unload: f.unloaded, solar: has('solar', 2), battery: has('battery'), gather: f.gathered, airlock: has('airlock'), habitat: has('habitat'), workshop: has('workshop'), ice: f.iceFound, drill: has('drill'), water: f.firstWater, o2: has('o2ext'), greenhouse: has('greenhouse'), plant: f.potato || f.firstHarvest, storm: f.stormSurvived, landmark: s.won,
      antenna: has('antenna'), pad: has('pad'), cryo: has('cryo'), arrival: s.ark.st === 2, wake: s.ark.awake >= 6, bairro: f.bairro, berco: has('berco'), born: f.firstBorn, escola: has('escola'), sinal: s.al.st >= 1, quartel: has('quartel'), arsenal: has('arsenal'), guarda: guards(s) >= 2, muro: has('muro', 8) && has('vigia'), noites: s.al.nights >= 3, garagem: Object.keys(s.chars).some(function (k) { return s.chars[k].veh === 'rover'; }), posto2: has('posto'), estrutura: s.al.found, contato: s.fac.cn && s.fac.cn.st === 1 && s.fac.de && s.fac.de.st === 1, troca: !!s.flags.troca, tratado: !!(s.flags.tratado || s.flags.repelled), fabrica: has('fabrica') && Object.keys(s.chars).some(function (q) { return s.chars[q].veh === 'rover_a' && s.chars[q].alive; }), despertar: s.era >= 4 && has('domo') && Object.keys(s.chars).some(function (q) { return s.chars[q].veh === 'tank' && s.chars[q].alive; }), nucleo: !!s.ended, casas: has('casa', 6) || (s.ark.st === 2 && !sleepers(s).length) };
    var nc = ofType(s, 'casa', true).length;
    var ix = function (id) { for (var q = 0; q < D.tutorial.length; q++) if (D.tutorial[q].id === id) return q; return 0; }, skip = s.era >= 4 ? ix('despertar') : s.era >= 3 ? ix('contato') : s.won ? ix('sinal') : 0;
    return D.tutorial.map(function (t, q) { var tx = t.text; if (t.id === 'casas') tx = 'Construa casas para os 12 colonos: ' + nc + ' de 6 prontas (2 leitos cada)'; return { id: t.id, text: tx, done: !!done[t.id] || q < skip }; }); }
  function signal(s) { var v = 0, on = 0, plants = 0, lit = false, id; v = Math.min(34, pop(s) * 5);
    s.b.forEach(function (b) { if (b.on && b.type !== 'lander') on++; if (b.type === 'habitat' && b.on) lit = true; if (b.plots) b.plots.forEach(function (p) { if (p && p.crop) plants++; }); });
    v += Math.min(40, on * 3.5) + Math.min(20, plants * 5) + (s.flags.antenna ? 8 : 0) + (lit ? 8 : 0) + (s.won ? 8 : 0); return Math.min(100, Math.round(v)); }
  function bondName(v) { return v < 30 ? 'Tensão' : v < 55 ? 'Colegas' : v < 80 ? 'Confiança' : 'Família'; }
  function tasks(s) { var out = [], id; for (id in s.chars) { var c = s.chars[id]; if (!c.alive) continue;
      if (c.act) out.push({ who: cname(id), label: LABEL[c.act.type], state: c.act.phase === 'go' ? 'Em deslocamento' : 'Em execução' });
      c.queue.forEach(function (q) { out.push({ who: cname(id), label: LABEL[q.type], state: 'Aguardando' }); }); }
    s.b.forEach(function (b) { if (!b.built) { var w = false; for (var i in s.chars) if (s.chars[i].act && s.chars[i].act.type === 'build' && s.chars[i].act.id === b.id) w = true; if (!w) out.push({ who: 'sem dono', label: 'Construir ' + BD[b.type].name, state: 'Aguardando' }); } });
    return out; }

  return { buildEta: buildEta, bT: bT, newGame: newGame, tick: tick, canPlace: canPlace, place: place, demolish: demolish, order: order, plant: plant, buyTech: buyTech, choose: choose,
    serialize: serialize, deserialize: deserialize, requirements: requirements, readiness: readiness, cinfo: cinfo, pop: pop, beds: beds, freeBeds: freeBeds, wakeNext: wakeNext, sleepers: sleepers, reqOK: reqOK, objectives: objectives, signal: signal, caps: caps, byId: byId, depById: depById,
    playable: playable, addZone: addZone, zoneR: zoneR, spawnVehicle: spawnVeh, quick: quick, dip: dip, facBase: facBase, orderItem: orderItem, arm: arm, guards: guards, upgrade: upgrade, canUpgrade: canUpgrade, upCost: upCost, lvl: lvl, bedsOf: bedsOf, sol: sol, hour: hour, sun: sun, isNight: isNight, bondName: bondName, tasks: tasks, LABEL: LABEL, costText: costText, center: center, HS: HS, N: N, ofType: ofType };
})();
if (typeof module !== 'undefined') module.exports = Sim;
