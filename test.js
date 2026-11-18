// Teste automatizado: um "jogador" simples joga do pouso ao Marco da Era II, passando pela Alvorada,
// pelo despertar, pelo primeiro bairro, pelo Berço e pela escola. Tem de terminar em vitória.
var D = require('./src/data.js'); global.DATA = D; var Sim = require('./src/sim.js');
var s = Sim.newGame(2032), N = Sim.N, C = N / 2, log = [], alerts = [], seenA = {};
function drain() { s.rt.out.forEach(function (o) { if (o.type === 'alert') { var k = o.msg.replace(/\d+/g, '#'); if (!seenA[k]) { seenA[k] = 1; alerts.push('sol ' + Sim.sol(s) + ' h' + Sim.hour(s).toFixed(0) + ' [' + o.lvl + '] ' + o.msg); } } if (o.type === 'scene') log.push('sol ' + Sim.sol(s) + ' h' + Sim.hour(s).toFixed(0) + ' CENA ' + o.id); if (o.type === 'event') { log.push('sol ' + Sim.sol(s) + ' EVENTO ' + o.id); Sim.choose(s, 0); } }); s.rt.out.length = 0; }
function run(sec) { for (var t = 0; t < sec; t += 0.25) { Sim.tick(s, 0.25); drain(); if (s.lost) return; } }
function spot(type, near, R) { for (var r = 2; r < (R || 14); r++) for (var a = 0; a < 40; a++) { var x = Math.round(near.x + Math.cos(a) * r), z = Math.round(near.z + Math.sin(a) * r); if (Sim.canPlace(s, type, x, z).ok) return { x: x, z: z }; } return null; }
function build(type, near, R) { var p = spot(type, near || { x: C, z: C }, R); if (!p) { log.push('SEM LOCAL para ' + type + ': ' + JSON.stringify(Sim.canPlace(s, type, Math.round((near || { x: C }).x), Math.round((near || { z: C }).z)))); return null; } var r = Sim.place(s, type, p.x, p.z); log.push('sol ' + Sim.sol(s) + ' h' + Sim.hour(s).toFixed(0) + ' obra ' + type + ' (pop ' + Sim.pop(s) + ')'); return r.b; }
function waitFor(fn, max, label) { var t = 0; while (!fn() && t < max && !s.lost) { run(5); t += 5; } if (!fn()) log.push('TIMEOUT ' + label + ' no sol ' + Sim.sol(s)); }
function afford(type) { var c = D.buildings[type].cost; for (var k in c) if (s.res[k] < c[k]) return false; return true; }
function upkeep() { // o que um jogador faria no dia a dia: Elias coleta, canteiros sempre plantados
  var c = s.chars.elias; if (c.alive && !c.act && !c.queue.length) { var want = s.res.metal < s.res.reg + 20 ? 'metal' : 'reg', best = null, bd = 1e9; s.deps.forEach(function (d) { if (d.res !== want || !s.rt.fog[d.z * N + d.x]) return; var q = Math.hypot(d.x - c.x, d.z - c.z); if (q < bd) { bd = q; best = d; } });
    if (best) Sim.order(s, 'elias', { kind: 'd', id: best.id }); else Sim.order(s, 'elias', { kind: 'tile', x: C + (Math.random() - 0.5) * 50, z: C + (Math.random() - 0.5) * 50 }); }
  Sim.ofType(s, 'greenhouse', true).forEach(function (g) { if (g.plots) for (var q = 0; q < 4; q++) if (!g.plots[q]) Sim.plant(s, g.id, q, q === 3 ? 'alface' : 'batata'); });
  if (s.res.research >= 8 && !s.tech.limpeza) Sim.buyTech(s, 'limpeza'); }
function power() { if (s.shed || s.stableH < 8) { need('solar'); need('battery'); } }
function need(type, near, R) { waitFor(function () { upkeep(); return afford(type); }, 6000, 'materiais ' + type); var b = build(type, near, R); if (b) waitFor(function () { upkeep(); return b.built; }, 1800, 'obra ' + type); return b; }

Sim.order(s, 'elias', { kind: 'b', id: s.b[0].id }); waitFor(function () { return s.flags.inspected; }, 60, 'inspect');
Sim.order(s, 'elias', { kind: 'b', id: s.b[0].id }); waitFor(function () { return s.flags.unloaded; }, 60, 'unload');
need('solar'); need('solar'); need('battery'); var al = need('airlock'); need('habitat', al, 6); need('solar'); need('workshop');
Sim.order(s, 'elias', { kind: 'tile', x: C - 11, z: C - 10 }); waitFor(function () { return s.flags.iceFound; }, 200, 'gelo');
var ic = s.rt.map.iceC[0]; need('solar', { x: C - 6, z: C - 5 }, 4); need('battery', { x: C - 9, z: C - 8 }, 3); need('drill', ic, 5); need('purifier'); need('o2ext'); need('solar'); need('solar');
var gh = need('greenhouse', al, 8); need('wtank'); upkeep();
need('battery'); need('solar'); need('antenna'); need('pad', { x: C + 9, z: C - 4 }, 12); power(); need('cryo', al, 9);
var v = { x: C + 2, z: C + 11 }; need('casa', v, 6); need('solar'); need('casa', v, 6); need('casa', v, 6); power(); need('o2ext'); need('battery'); need('storage'); power();
log.push('prontidão no sol ' + Sim.sol(s) + ': ' + Sim.readiness(s).map(function (r) { return (r.ok ? 'OK ' : 'NÃO ') + r.label; }).join(' | '));
waitFor(function () { upkeep(); return s.ark.st === 2; }, 8000, 'chegada da Alvorada');
need('solar'); need('battery'); need('drill', ic, 6); need('purifier'); need('greenhouse', al, 12); need('solar'); need('solar'); need('battery'); need('casa', v, 8); need('casa', v, 8); power();
waitFor(function () { upkeep(); return s.ark.awake >= 6; }, 8000, '6 despertos'); log.push('sol ' + Sim.sol(s) + ' seis despertos, pop ' + Sim.pop(s) + ', leitos ' + Sim.beds(s));
need('solar'); need('solar'); need('battery'); need('o2ext'); need('wtank'); need('o2tank'); power(); need('berco', { x: C - 6, z: C + 10 }, 10); need('casa', v, 9); need('casa', v, 9); need('solar'); need('battery'); power(); need('greenhouse', al, 14); power();
waitFor(function () { upkeep(); return s.flags.firstBorn; }, 12000, 'primeiro nascido'); log.push('sol ' + Sim.sol(s) + ' primeiro nascido, pop ' + Sim.pop(s));
need('escola', { x: C - 6, z: C + 16 }, 10); need('lab', al, 10);
waitFor(function () { upkeep(); return Sim.reqOK(s); }, 12000, 'requisitos');
log.push('requisitos: ' + JSON.stringify(Sim.requirements(s).map(function (r) { return r.ok; })));
for (var tries = 0; tries < 6 && !s.won; tries++) { waitFor(function () { upkeep(); power(); return Sim.reqOK(s) && afford('jardim'); }, 6000, 'requisitos+materiais jardim'); var jb = build('jardim', { x: C + 10, z: C + 12 }, 20); if (jb) waitFor(function () { upkeep(); return jb.built; }, 1800, 'obra jardim'); }
// ---- Era II: sinal, defesa e três noites de ataque ----
if (s.won) { var E2 = { x: C - 10, z: C - 20 };
  waitFor(function () { upkeep(); return s.al.st >= 1; }, 400, 'sinal'); log.push('sol ' + Sim.sol(s) + ' sinal: estrutura em ' + JSON.stringify(s.al.site));
  var qb = need('quartel', al, 16), ab = need('arsenal', al, 16);
  ['rifle', 'rifle', 'smg'].forEach(function (w) { waitFor(function () { upkeep(); return !ab.fab && afford2(D.weapons[w].cost); }, 3000, 'arma'); Sim.orderItem(s, ab.id, 'w', w); });
  waitFor(function () { upkeep(); return (s.arms.rifle || 0) + (s.arms.smg || 0) >= 3; }, 3000, 'armas prontas');
  ['c1', 'c2', 'c3'].forEach(function (k) { if (s.chars[k] && s.chars[k].alive) log.push('armar ' + k + ': ' + Sim.arm(s, k).msg); });
  need('vigia', { x: C - 4, z: C - 12 }, 8); need('vigia', { x: C + 4, z: C - 12 }, 8); for (var wi = 0; wi < 10; wi++) need('muro', { x: C - 6 + wi, z: C - 15 }, 4);
  var gb = need('garagem', al, 18); if (gb) { waitFor(function () { upkeep(); return afford2(D.vehicles.rover.cost); }, 3000, 'rover'); Sim.orderItem(s, gb.id, 'v', 'rover'); }
  waitFor(function () { upkeep(); power(); return s.al.nights >= 3; }, 30000, '3 noites');
  log.push('sol ' + Sim.sol(s) + ' noites ' + s.al.nights + ' ondas ' + s.al.wave + ' abatidos ' + s.al.kills + ' munição ' + Math.round(s.res.ammo) + ' veículos ' + Object.keys(s.chars).filter(function (k) { return s.chars[k].veh; }).length + ' guardas ' + Sim.guards(s));
}
function afford2(c) { for (var k in c) if (s.res[k] < c[k]) return false; return true; }
var j = Sim.serialize(s), s2 = Sim.deserialize(j); Sim.tick(s2, 0.25);
var R0 = function (k, v) { return typeof v === 'number' ? Math.round(v) : v; };
console.log(log.join('\n')); console.log('--- alertas distintos (' + alerts.length + ') ---\n' + alerts.slice(0, 70).join('\n'));
console.log('--- fim --- sol', Sim.sol(s), 'won', s.won, 'lost', s.lost, 'pop', Sim.pop(s), 'leitos', Sim.beds(s), 'bairros', s.nbairro, 'nascidos', s.nborn, 'res', JSON.stringify(s.res, R0));
console.log('capsulas', s.ark.pods.map(function (p) { return p.st[0]; }).join(''), 'mortos', Object.keys(s.chars).filter(function (k) { return !s.chars[k].alive; }).join(',') || 'nenhum');
console.log('coesão', Math.round(s.bond), 'sinal', Sim.signal(s), 'save bytes', j.length, 'reload ok', s2.b.length === s.b.length && Object.keys(s2.chars).length === Object.keys(s.chars).length);
console.log('cronica:\n' + s.chron.map(function (c) { return ' - ' + c.text; }).join('\n'));
