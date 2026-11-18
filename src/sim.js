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
    for (i = 0; i < 16; i++) { var a = hsh(i, 9, 3) * 6.283, r = 17 + hsh(i, 4, 5) * (i < 6 ? 14 : N / 2 - 26); craters.push({ x: C + Math.cos(a) * r, z: C + Math.sin(a) * r, r: 3.5 + hsh(i, 2, 7) * 3.5, d: 1.2 + hsh(i, 8, 1) }); }
    var iceC = [{ x: C - 11, z: C - 10, r: 3.2 }, { x: C + 19, z: C + 15, r: 3.6 }, { x: C - 31, z: C + 27, r: 4.6 }, { x: C + 35, z: C - 29, r: 4.2 }, { x: C + 5, z: C - 41, r: 3.8 }];
    for (z = 0; z < V; z++) for (x = 0; x < V; x++) {
      var d = Math.hypot(x - C, z - C);
      var f = vn(x / 15, z / 15, 0) + vn(x / 6, z / 6, 1) * 0.4 + vn(x / 2.4, z / 2.4, 2) * 0.1;
      var y = (f - 0.75) * 4.2 * smooth(7, 22, d) + smooth(24, 38, d) * vn(x / 9, z / 9, 4) * 3.2 + smooth(36, 46, d) * smooth(0.56, 0.68, vn(x / 13, z / 13, 9)) * 3.6;
      // pequeno cânion a leste
      var cx = x - (C + 24 + Math.sin(z / 7) * 3); if (Math.abs(cx) < 3 && z > 8 && z < N - 8) y -= (1 - Math.abs(cx) / 3) * 2.6;
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
    var s = { v: 2, seed: seed, rs: seed * 7919, t: 7, speedNote: 0, era: 1, won: false, lost: false,
      res: JSON.parse(JSON.stringify(B.start)), b: [], nid: 1, deps: [], chars: {},
      storm: { st: 0, start: 0, end: 0 }, stormK: 0, flags: {}, stats: { o2Made: 0, waterMade: 0, trips: 0, harvests: 0 },
      tech: {}, trad: {}, axes: { origem: 0, comunidade: 0, planeta: 0 }, bond: 45, chron: [], cd: {}, said: {}, pending: null,
      stableH: 0, shed: false, lifeSupport: true, rate: { o2: 0, energy: 0 }, lastHour: 7, auto: true, fogStr: null, nborn: 0, nbairro: 0, school: false,
      ark: { st: 0, pods: D.colonists.map(function (c) { return { id: c.id, st: 'sleep' }; }), wake: null, lostT: 0, awake: 0, pad: null } };
    var C = N / 2;
    for (var id in D.chars) mkChar(s, id, C + D.chars[id].dx, C + D.chars[id].dz);
    attach(s);
    s.b.push({ id: s.nid++, type: 'lander', x: C - 1, z: C - 1, prog: 1, built: true, hp: 100, on: true, why: '', dust: 0 });
    // depósitos: alguns perto, o resto espalhado
    var spots = [['metal', 7.5, 0.6], ['reg', 7, 2.4], ['metal', 9.5, 4.0], ['reg', 9, 5.4]], i;
    for (i = 0; i < 56; i++) spots.push([i % 2 ? 'reg' : 'metal', 13 + rnd(s) * (i < 14 ? 18 : N / 2 - 18), rnd(s) * 6.283]);
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
    s.rt = { map: genMap(s.seed), occ: new Int16Array(N * N), fog: new Uint8Array(N * N), out: [], fogDirty: true };
    if (s.fogStr) for (var i = 0; i < N * N; i++) s.rt.fog[i] = s.fogStr.charCodeAt(i) === 49 ? 1 : 0;
    rebuildOcc(s);
  }
  function rebuildOcc(s) { var o = s.rt.occ; o.fill(0); var i, x, z;
    for (i = 0; i < s.b.length; i++) { var b = s.b[i], d = BD[b.type]; for (z = 0; z < d.h; z++) for (x = 0; x < d.w; x++) o[(b.z + z) * N + b.x + x] = b.id; }
    for (i = 0; i < s.deps.length; i++) o[s.deps[i].z * N + s.deps[i].x] = -1; }
  function serialize(s) { var rt = s.rt, f = ''; for (var i = 0; i < N * N; i++) f += rt.fog[i] ? '1' : '0'; s.fogStr = f; delete s.rt; var j = JSON.stringify(s); s.rt = rt; s.fogStr = null; return j; }
  function deserialize(j) { var s = JSON.parse(j); if (s.v !== 2) throw new Error('versão antiga'); attach(s); s.fogStr = null; return s; }

  function emit(s, o) { s.rt.out.push(o); }
  function alertK(s, lvl, msg, key, x, z, every) { key = key || msg; if (s.cd['a:' + key] != null && s.t - s.cd['a:' + key] < (every || 8)) return; s.cd['a:' + key] = s.t; emit(s, { type: 'alert', lvl: lvl, msg: msg, x: x, z: z }); }
  function sol(s) { return Math.floor(s.t / 24) + 1; }
  function hour(s) { return s.t % 24; }
  function chron(s, key, v) { v = v || {}; v.sol = sol(s); v.year = D.lore.year; v.ship = D.lore.ship; v.company = D.lore.company; v.ark = D.lore.ark; s.chron.push({ sol: v.sol, text: fmt(D.chronicle[key], v), key: key }); emit(s, { type: 'chron' }); }
  // ---- pessoas: os dois da Gênesis, os doze da Alvorada e os nascidos em Marte
  var COL = {}; D.colonists.forEach(function (c) { COL[c.id] = c; });
  function cinfo(id) { if (D.chars[id]) return D.chars[id]; if (COL[id]) return COL[id]; var n = +id.slice(1) || 1, nm = D.bornNames[(n - 1) % D.bornNames.length];
    return { id: id, name: nm, short: nm, role: 'Nascido em Marte', job: D.jobKeys[(n - 1) % D.jobKeys.length], born: true, trait: ['Nascido em Marte', 'Nunca viu a Terra. Marte é o único chão que conhece.'], why: 'Não veio de lugar nenhum. É daqui.' }; }
  function cname(id) { return cinfo(id).short; }
  function mkChar(s, id, x, z) { var inf = cinfo(id), sk = inf.skills ? JSON.parse(JSON.stringify(inf.skills)) : { eng: 1, bot: 1, geo: 1, pil: 1, med: 1, sci: 1 };
    return (s.chars[id] = { id: id, x: x, z: z, inside: null, alive: true, critical: 0, sleeping: false, carry: null, act: null, queue: [], mem: [], lastTalk: -99, lastCont: -99, job: inf.job || null, home: null, hero: !!D.chars[id], shift: D.chars[id] ? 0 : Object.keys(s.chars).length % 2,
      needs: { health: 100, o2: 100, hunger: 20, thirst: 20, energy: 85, temp: 90, stress: 25, morale: 65, rad: 0 }, skills: sk, xp: {} }); }
  function pop(s) { var n = 0; for (var id in s.chars) if (s.chars[id].alive) n++; return n; }
  function isShelter(b) { return b.built && (b.type === 'lander' || (!!BD[b.type].beds && b.on)); }
  // Níveis 1–4: cada melhoria multiplica produção, geração e armazenamento, e soma leitos
  var LVM = [1, 1.5, 2.1, 3];
  function lvl(b) { return b.lv || 1; } function mul(b) { return LVM[lvl(b) - 1]; }
  function bedsOf(b) { var n = BD[b.type].beds || 0; return n ? n + (lvl(b) - 1) * Math.ceil(n / 2) : 0; }
  function useOf(b) { return (BD[b.type].use || 0) * (1 + 0.25 * (lvl(b) - 1)); }
  function upCost(b) { var c = BD[b.type].cost, k = [0, 1.5, 2.5, 4][lvl(b)], o = {}; for (var r in c) o[r] = Math.ceil(c[r] * k); return o; }
  function canUpgrade(s, b) { var d = BD[b.type], L = lvl(b); if (!b.built || b.up != null) return { ok: false, msg: b.up != null ? 'Melhoria em andamento' : 'Termine a obra primeiro' };
    if (b.type === 'lander' || d.landmark || b.type === 'corridor' || b.type === 'pad' || b.type === 'airlock') return { ok: false, msg: 'Esta construção não tem níveis' };
    if (L >= 4) return { ok: false, msg: 'Nível máximo' };
    if (L === 2 && Object.keys(s.tech).filter(function (k) { return s.tech[k]; }).length < 2) return { ok: false, msg: 'Nível 3 pede 2 pesquisas concluídas' };
    if (L === 3 && !s.won) return { ok: false, msg: 'Nível 4 pede a Era II (erga um Marco)' };
    var c = upCost(b), miss = []; for (var r in c) if (s.res[r] < c[r]) miss.push((c[r] - Math.floor(s.res[r])) + ' ' + ({ metal: 'metal', comp: 'componentes', reg: 'regolito' })[r]);
    if (miss.length) return { ok: false, msg: 'Faltam ' + miss.join(', ') }; return { ok: true, msg: 'Melhorar para o nível ' + (L + 1) }; }
  function upgrade(s, id) { var b = byId(s, id); if (!b) return { ok: false, msg: 'Nada selecionado' }; var r = canUpgrade(s, b); if (!r.ok) return r; var c = upCost(b); for (var k in c) s.res[k] -= c[k]; b.up = 0; emit(s, { type: 'sound', id: 'place' }); return { ok: true, msg: 'Melhoria marcada: os colonos vão trabalhar nela' }; }
  function beds(s) { var n = 0; for (var i = 0; i < s.b.length; i++) { var b = s.b[i]; if (b.built && b.hp > 40) n += bedsOf(b); } return n; }
  function reserved(s) { var n = s.ark.wake ? 1 : 0; for (var i = 0; i < s.b.length; i++) if (s.b[i].gest) n++; return n; }
  function freeBeds(s) { return beds(s) - pop(s) - reserved(s); }
  function sleepers(s) { return s.ark.pods.filter(function (p) { return p.st === 'sleep'; }); }
  function nearestOther(s, c, pred) { var best = null, bd = 1e9; for (var id in s.chars) { var o = s.chars[id]; if (o === c || !o.alive || (pred && !pred(o))) continue; var d = Math.hypot(o.x - c.x, o.z - c.z); if (d < bd) { bd = d; best = o; } } return best; }
  function workers(s, c, type, id, plot) { var n = 0; for (var k in s.chars) { var o = s.chars[k], a = o.act; if (o !== c && o.alive && a && (a.type === type || (type === 'gather' && a.type === 'haul' && a.back === id)) && (a.id === id || a.back === id) && (plot == null || a.plot === plot)) n++; } return n; }
  function rescueTarget(s, c) { for (var id in s.chars) { var o = s.chars[id]; if (o === c || !o.alive || o.critical <= 0) continue; if (!workers(s, c, 'rescue', o.id)) return o; } return null; }
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
  function freeTile(s, x, z) { return x >= 0 && z >= 0 && x < N && z < N && !s.rt.map.rock[z * N + x] && !s.rt.occ[z * N + x]; }
  function ring(s, x0, z0, w, h) { for (var r = 1; r <= 3; r++) { var g = []; for (var z = z0 - r; z < z0 + h + r; z++) for (var x = x0 - r; x < x0 + w + r; x++) { if (x >= x0 && x < x0 + w && z >= z0 && z < z0 + h) continue; if (freeTile(s, x, z)) g.push(z * N + x); } if (g.length) return g; } return []; }
  function findPath(s, sx, sz, goals, tx, tz, soft) {
    function ok(x, z) { return freeTile(s, x, z) || (soft && x >= 0 && z >= 0 && x < N && z < N && !s.rt.map.rock[z * N + x] && s.rt.occ[z * N + x] > 0); }
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
    if (d.need === 'berco' && !ofType(s, 'berco', true).length) return { ok: false, reason: 'Construa o Berço primeiro' };
    var allIce = true;
    for (j = 0; j < d.h; j++) for (i = 0; i < d.w; i++) { k = (z + j) * N + x + i;
      if (!s.rt.fog[k]) return { ok: false, reason: 'Área ainda não explorada' };
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
      if (x < 3 || z < 3 || x > N - 4 || z > N - 4 || Math.hypot(x - C, z - C) < 8) continue; var k = z * N + x; if (s.rt.map.rock[k] || s.rt.map.ice[k] || s.rt.occ[k]) continue;
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
  function finishBuilding(s, b, c) { var d = BD[b.type]; b.built = true; b.prog = 1; b.why = '';
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
  function sp(s, c, k) { return (0.6 + 0.08 * (c.skills[k] || 0)) * (c.needs.stress > 85 ? 0.7 : 1) * (c.needs.energy < 12 ? 0.7 : 1) * (k === 'eng' && c.id === 'helena' ? 1.1 : 1) * (k === 'bot' && c.id === 'elias' ? 1.1 : 1) * (c.weak > s.t ? 0.6 : 1); }
  function xp(s, c, k, dtS) { if (!k) return; c.xp[k] = (c.xp[k] || 0) + dtS * 0.012 * (s.trad.oficio ? 1.5 : 1) * (s.school ? 1.5 : 1); var need = 1 + c.skills[k] * 0.6;
    if (c.xp[k] >= need && c.skills[k] < 10) { c.xp[k] = 0; c.skills[k]++; alertK(s, 'info', cname(c.id) + ': ' + D.skillNames[k] + ' nível ' + c.skills[k], 'lv' + c.id + k + c.skills[k], c.x, c.z, 0); } }
  function clearAct(c) { c.act = null; c.sleeping = false; }
  // abrigo mais próximo (para emergências) e casa própria (para dormir e comer)
  function shelter(s, c) { var best = s.b[0], bd = 1e9; for (var i = 0; i < s.b.length; i++) { var b = s.b[i]; if (!isShelter(b)) continue; var ct = center(b), d = Math.hypot(ct.x - c.x, ct.z - c.z); if (d < bd) { bd = d; best = b; } } return best; }
  function homeOf(s, c) { var b = c.home != null ? byId(s, c.home) : null; return b && isShelter(b) ? b : shelter(s, c); }
  // Casas: cada colono ganha a sua (prefere Casa; o habitat fica para Elias e Helena) e dorme nela
  function assignHomes(s) { var occ = {}, id, c, i, ids = Object.keys(s.chars);
    for (i = 0; i < ids.length; i++) { c = s.chars[ids[i]]; if (!c.alive) continue; var hb = c.home != null ? byId(s, c.home) : null; if (hb && isShelter(hb)) occ[hb.id] = (occ[hb.id] || 0) + 1; else c.home = null; }
    function free(b) { return isShelter(b) && b.type !== 'lander' && (occ[b.id] || 0) < bedsOf(b); }
    function pick(pref) { for (var j = 0; j < s.b.length; j++) if (s.b[j].type === pref && free(s.b[j])) return s.b[j]; return null; }
    for (i = 0; i < ids.length; i++) { c = s.chars[ids[i]]; if (!c.alive) continue; var cur = c.home != null ? byId(s, c.home) : null;
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
      case 'gather': var dp = depById(s, a.id); if (!dp) return true; if (a.t >= 5) { var n = Math.min(B.carry, dp.left); dp.left -= n; c.carry = { res: dp.res, n: n * (s.tech.geologia ? 1.25 : 1) };
          if (dp.left <= 0) { s.deps.splice(s.deps.indexOf(dp), 1); rebuildOcc(s); newVein(s, dp.res, dp.x, dp.z); emit(s, { type: 'deps' }); }
          var dr = dropoff(s, c); if (!start(s, c, { type: 'haul', kind: 'b', id: dr.id, back: a.id }, a.player)) return true; return false; } return false;
      case 'haul': if (c.carry) { if (!a.player) a.back = null; var got = addRes(s, c.carry.res, c.carry.n); if (got < c.carry.n - 0.01) alertK(s, 'warn', 'Armazém cheio: construa um armazém', 'full', c.x, c.z, 6); c.carry = null; s.stats.trips++; s.flags.gathered = true; emit(s, { type: 'sound', id: 'drop' }); }
        if (a.back && depById(s, a.back) && start(s, c, { type: 'gather', kind: 'd', id: a.back }, a.player)) return false; return true;
      case 'upgrade': if (!b || b.up == null) return true; b.up += dtS * sp(s, c, 'eng') / (BD[b.type].t * (lvl(b) + 1)); if (b.up >= 1) { b.up = null; b.lv = lvl(b) + 1; if (BD[b.type].beds) assignHomes(s); alertK(s, 'info', BD[b.type].name + ' chegou ao nível ' + b.lv, 'lv' + b.id + b.lv, b.x, b.z, 0); emit(s, { type: 'sound', id: 'built' }); return true; } return false;
      case 'build': if (!b || b.built) return true; b.prog += dtS * sp(s, c, 'eng') / BD[b.type].t; if (b.prog >= 1) { finishBuilding(s, b, c); return true; } return false;
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
      for (var pass = 0; pass < 2 && !best; pass++) { for (i = 0; i < s.deps.length; i++) { var dp = s.deps[i]; if (dp.res !== want || !s.rt.fog[dp.z * N + dp.x] || workers(s, c, 'gather', dp.id) >= 2) continue; d = Math.hypot(dp.x - c.x, dp.z - c.z); if (d < bd) { bd = d; best = dp; } } if (!best) { want = want === 'metal' ? 'reg' : 'metal'; if (s.res[want] >= T) break; } }
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
    if (c.critical > 0) { c.critical -= dtH; if (c.critical <= 0) die(s, c); return; }
    needs(s, c, dtH); if (c.critical > 0 || !c.alive) return;
    var a = c.act, n = c.needs;
    if (a) { // interrupções de sobrevivência
      var urgent = a.type === 'warm' || a.type === 'refill' || a.type === 'rescue' || a.type === 'sleep' || a.type === 'eat' || a.type === 'drink';
      if (!urgent && ((c.inside == null && n.o2 < 20) || (c.inside == null && n.temp < 32) || n.energy < 6 || (n.thirst >= 88 && s.res.water > 0.5) || (n.hunger >= 88 && s.res.food >= B.mealFood) || rescueTarget(s, c))) { requeue(c); a = null; }
    }
    if (!c.act) { if (c.wait > s.t) return; decide(s, c); a = c.act; if (!a) return; }
    if (a.phase === 'go') { var v = B.walk * (1 + 0.03 * c.skills.pil) * (s.stormK > 0.3 ? 0.6 : 1) * (n.energy < 12 ? 0.7 : 1) * (c.weak > s.t ? 0.65 : 1), left = v * dtS;
      if (a.kind === 'c' && a.pi === 0 && a.t === 0) a.t = 0;
      while (left > 0 && a.pi < a.path.length) { var p = a.path[a.pi], dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
        if (d <= left) { c.x = p.x; c.z = p.z; left -= d; a.pi++; } else { c.x += dx / d * left; c.z += dz / d * left; c.face = Math.atan2(dx, dz); left = 0; } }
      var tx = Math.floor(c.x), tz = Math.floor(c.z); if (c.lt !== tz * N + tx) { c.lt = tz * N + tx; reveal(s, c, s.tech.geologia ? B.revealRGeo : B.revealR); }
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
      else if (b.type === 'greenhouse') { o.type = 'shelter'; for (var p = 0; p < 4; p++) { var pl = b.plots[p]; if (pl && pl.crop && pl.g >= 1) { o.type = 'harvest'; o.plot = p; break; } if (pl && pl.order) { o.type = 'plant'; o.plot = p; } } }
      else o.type = 'move';
      return o; }
    return { type: tg.act || 'move', kind: tg.act === 'contemplate' ? 'here' : 'tile', x: tg.x, z: tg.z }; }
  function order(s, cid, tg, queue) { var c = s.chars[cid]; if (!c || !c.alive || c.critical > 0) return { ok: false, msg: 'Não pode receber ordens agora' };
    var o = tg.type ? tg : orderFor(s, c, tg); if (!o) return { ok: false, msg: 'Nada a fazer aqui' };
    if (queue && c.act) { c.queue.push(o); return { ok: true, msg: 'Na fila: ' + LABEL[o.type] }; }
    c.queue = []; c.hold = null; var prev = c.act; clearAct(c);
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
      case 'sealed': s.flags.sealed = true; s.res.o2 += B.sealedO2; chron(s, 'sealed', {}); alertK(s, 'crit', 'Reserva lacrada aberta: resolva a produção de O₂ agora', 'sealed', null, null, 0); break;
    }
    if (note && !s.flags['n_' + ev + idx]) { s.flags['n_' + ev + idx] = 1; chron(s, 'choice', { what: note }); } emit(s, { type: 'sound', id: 'drop' }); }

  // ---------------- TICK ----------------
  function tick(s, dtS) { // dtS = segundos de simulação (tempo real × velocidade)
    if (s.lost || s.pending) return; if (dtS > 2) dtS = 2;
    var dtH = dtS / HS; s.t += dtH;
    var st = s.storm, k = 0; if (!B.storm && st.st) st.st = 0; if (st.st === 2) k = clamp(Math.min(s.t - st.start, st.end - s.t) / 3, 0, 1); s.stormK = k;
    var cp = networks(s, dtH); production(s, dtH, cp); society(s, dtH);
    var alive = 0; for (var id in s.chars) { charTick(s, s.chars[id], dtS, dtH); if (s.chars[id].alive) alive++; }
    for (var r in s.res) if (s.res[r] < 0) s.res[r] = 0;
    if (Math.floor(s.t) !== s.lastHour) { s.lastHour = Math.floor(s.t); hourly(s); if (s.lastHour % 24 === 0) emit(s, { type: 'newSol' }); }
    if (!alive && !s.lost) { s.lost = true; chron(s, 'lost', {}); emit(s, { type: 'scene', id: 'defeat' }); }
  }

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
      antenna: has('antenna'), pad: has('pad'), cryo: has('cryo'), arrival: s.ark.st === 2, wake: s.ark.awake >= 6, bairro: f.bairro, berco: has('berco'), born: f.firstBorn, escola: has('escola'), casas: has('casa', 6) || (s.ark.st === 2 && !sleepers(s).length) };
    var nc = ofType(s, 'casa', true).length;
    return D.tutorial.map(function (t) { var tx = t.text; if (t.id === 'casas') tx = 'Construa casas para os 12 colonos: ' + nc + ' de 6 prontas (2 leitos cada)'; return { id: t.id, text: tx, done: !!done[t.id] }; }); }
  function signal(s) { var v = 0, on = 0, plants = 0, lit = false, id; v = Math.min(34, pop(s) * 5);
    s.b.forEach(function (b) { if (b.on && b.type !== 'lander') on++; if (b.type === 'habitat' && b.on) lit = true; if (b.plots) b.plots.forEach(function (p) { if (p && p.crop) plants++; }); });
    v += Math.min(40, on * 3.5) + Math.min(20, plants * 5) + (s.flags.antenna ? 8 : 0) + (lit ? 8 : 0) + (s.won ? 8 : 0); return Math.min(100, Math.round(v)); }
  function bondName(v) { return v < 30 ? 'Tensão' : v < 55 ? 'Colegas' : v < 80 ? 'Confiança' : 'Família'; }
  function tasks(s) { var out = [], id; for (id in s.chars) { var c = s.chars[id]; if (!c.alive) continue;
      if (c.act) out.push({ who: cname(id), label: LABEL[c.act.type], state: c.act.phase === 'go' ? 'Em deslocamento' : 'Em execução' });
      c.queue.forEach(function (q) { out.push({ who: cname(id), label: LABEL[q.type], state: 'Aguardando' }); }); }
    s.b.forEach(function (b) { if (!b.built) { var w = false; for (var i in s.chars) if (s.chars[i].act && s.chars[i].act.type === 'build' && s.chars[i].act.id === b.id) w = true; if (!w) out.push({ who: 'sem dono', label: 'Construir ' + BD[b.type].name, state: 'Aguardando' }); } });
    return out; }

  return { newGame: newGame, tick: tick, canPlace: canPlace, place: place, demolish: demolish, order: order, plant: plant, buyTech: buyTech, choose: choose,
    serialize: serialize, deserialize: deserialize, requirements: requirements, readiness: readiness, cinfo: cinfo, pop: pop, beds: beds, freeBeds: freeBeds, wakeNext: wakeNext, sleepers: sleepers, reqOK: reqOK, objectives: objectives, signal: signal, caps: caps, byId: byId, depById: depById,
    upgrade: upgrade, canUpgrade: canUpgrade, upCost: upCost, lvl: lvl, bedsOf: bedsOf, sol: sol, hour: hour, sun: sun, isNight: isNight, bondName: bondName, tasks: tasks, LABEL: LABEL, costText: costText, center: center, HS: HS, N: N, ofType: ofType };
})();
if (typeof module !== 'undefined') module.exports = Sim;
