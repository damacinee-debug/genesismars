// Renderiza o jogo de verdade (WebGL por software), quadro a quadro sob controle, e salva screenshots.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const Q = process.argv[2] || 'mid', VW = +(process.argv[3] || 1100), VH = +(process.argv[4] || 640), only = (process.argv[5] || '').split(',').filter(Boolean);
const want = n => !only.length || only.includes(n);
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: VW, height: VH } }); const errs = []; pg.setDefaultTimeout(400000);
  pg.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); pg.on('console', m => { const t = m.text(); if (/GPU stall/.test(t)) return; if (['error', 'warning', 'log'].includes(m.type())) errs.push(m.type() + ' ' + t.slice(0, 500)); });
  await pg.addInitScript((q) => { try { localStorage.setItem('gm_set', JSON.stringify({ q })); } catch (e) {} window.__raf = []; window.__t = 0; window.requestAnimationFrame = cb => { window.__raf.push(cb); return 1; };
    window.step = (n, dt) => { for (let i = 0; i < n; i++) { const L = window.__raf; window.__raf = []; window.__t += (dt || 50); L.forEach(f => f(window.__t)); } }; }, Q);
  if (only.some(n => n === 'e4')) await pg.addInitScript(() => { window.__E4 = true; });
  if (only.some(n => n === 'war' || n === 'war2')) await pg.addInitScript(() => { window.__WAR = true; });
  if (only.some(n => n.startsWith('lv'))) await pg.addInitScript(() => { window.__LV = true; });
  let t0 = Date.now(); await pg.goto('file:///home/claude/gm/local.html'); await pg.evaluate(() => step(2)); console.log('load+2 frames ms', Date.now() - t0);
  const shot = async (name, n) => { t0 = Date.now(); await pg.evaluate((n) => step(n || 3), n); await pg.screenshot({ path: 't/' + name + '.png' }); console.log(name, Date.now() - t0, 'ms', await pg.evaluate(() => 'loading ' + World.loading)); };
  if (want('menu')) await shot('menu', 2);
  await pg.evaluate(() => { document.getElementById('mNew').click(); step(2); UI.endCut(); step(1); });
  await pg.evaluate(() => { const s = UI.state(), C = Sim.N / 2; s.flags.inspected = s.flags.unloaded = true; for (const f of ['firstLight', 'firstWater', 'firstO2', 'firstSprout', 'firstHarvest', 'firstPanel', 'iceFound', 'telemetry', 'firstHouse', 'firstBorn', 'awake6', 'bairro', 'stormSched', 'stormStarted', 'stormSurvived']) s.flags[f] = true;
    s.res.reg = 900; s.res.metal = 900; s.res.comp = 900; s.res.seeds = 20; s.res.food = 70; s.res.water = 70; s.pending = null; s.storm.st = 0; s.nbairro = 1;
    for (let i = 0; i < s.rt.fog.length; i++) { const x = i % Sim.N, z = Math.floor(i / Sim.N); s.rt.fog[i] = Math.hypot(x - C, z - C) < 26 ? 1 : 0; } s.rt.fogDirty = true;
    const P = (t, dx, dz) => { let r = Sim.place(s, t, C + dx, C + dz); for (let k = 1; !r.ok && k < 60; k++) r = Sim.place(s, t, C + dx + Math.round(Math.cos(k * 2.4) * (1 + k / 6)), C + dz + Math.round(Math.sin(k * 2.4) * (1 + k / 6))); if (r.ok) { r.b.built = true; r.b.prog = 1; if (t === 'greenhouse') r.b.plots = [{ crop: 'batata', g: 0.9 }, { crop: 'alface', g: 0.7 }, { crop: 'batata', g: 0.4 }, null]; } else console.log('place fail ' + t + ' ' + r.reason); return r.b; };
    P('solar', 4, -3); P('solar', 6, -3); P('solar', 4, -6); P('battery', 3, 0); P('battery', 3, 1); P('airlock', -3, 2); P('habitat', -6, 1); P('corridor', -3, 3); P('greenhouse', -5, 4); P('cryo', -2, 4); P('o2ext', 3, 3); P('o2tank', 5, 3); P('wtank', 5, 4);
    P('lab', -8, -2); P('workshop', 0, 5); P('storage', 7, 2); P('antenna', 8, -3); P('pad', 9, -9); P('solar', 9, -1);
    P('casa', -1, 9); P('casa', 1, 9); P('casa', 3, 9); P('casa', -1, 11); P('casa', 1, 11); const u = P('casa', 3, 11); if (u) { u.built = false; u.prog = 0.5; }
    s.ark.awake = 6; P('berco', -7, 9); P('escola', -8, 13); P('solar', 6, 6); P('battery', 6, 9); P('poste', 12, 4); P('poste', 20, 6); P('poste', 27, 9); P('o2ext', 29, 12); P('torre', 2, 7); s.b.filter(b => b.type === 'casa').slice(0, 3).forEach((b, i) => b.lv = i + 2); const gh = s.b.find(b => b.type === 'greenhouse'); if (gh) gh.lv = 3; s.b.find(b => b.type === 'workshop').lv = 4; if (window.__E4) { const q = Sim.quick(4); Object.assign(s, q); for (let i = 0; i < 400; i++) Sim.tick(s, 0.25); s.rt.out.length = 0; s.pending = null;
      for (const k in s.fac) if (s.fac[k].st !== 1) { s.fac[k].t0 = -999; } for (let i = 0; i < 40; i++) Sim.tick(s, 0.25); s.rt.out.length = 0; s.pending = null;
      Sim.spawnVehicle(s, 'tank', C - 6, C - 24).face = 3.1; Sim.spawnVehicle(s, 'arty', C - 1, C - 23).face = 3.0; Sim.spawnVehicle(s, 'rover_a', C + 4, C - 22).face = 2.9;
      for (let i = 0; i < 2; i++) s.foes.push({ id: s.fid++, type: 'colossus', x: C - 8 + i * 9, z: C - 32, sx: C, sz: C - 40, hp: 300, cd: 0, face: 0, mv: true }); for (let i = 0; i < 4; i++) s.foes.push({ id: s.fid++, type: 'soldier', fac: 'cn', x: C + 8 + i * 1.5, z: C - 28, sx: C, sz: C - 40, hp: 50, cd: 0, face: -0.3, mv: false }); window._s = s; return; }
    if (window.__WAR) { s.won = true; s.era = 2; s.al.st = 1; s.al.site = { x: C - 18, z: C - 74 }; s.res.ammo = 120; s.arms.rifle = 2; s.arms.smg = 1;
      ['quartel', 'arsenal', 'garagem'].forEach((ty, i) => P(ty, 10 + i * 5, -10)); P('vigia', 6, -16); P('vigia', 16, -16); for (let x = 2; x < 22; x++) { if (x === 11) P('bastiao', x, -18); else P('muro', x, -18); }
      s.b.filter(b => b.type === 'muro').slice(0, 15).forEach((b, i) => b.lv = 1 + (i % 5)); for (let z = -8; z < 6; z++) P('estrada', 9, z); for (let x = 0; x < 9; x++) P('estrada', x, 5);
      const v1 = Sim.spawnVehicle(s, 'rover', C + 14, C - 4), v2 = Sim.spawnVehicle(s, 'scout', C + 18, C - 3), v3 = Sim.spawnVehicle(s, 'rescue', C + 21, C - 5); v1.face = 0.6; v2.face = 1.2; v3.face = -0.4;
      for (let i = 0; i < 6; i++) s.foes.push({ id: s.fid++, type: i < 2 ? 'spitter' : 'crawler', x: C + 6 + i * 2.2, z: C - 23 - (i % 2) * 1.5, sx: C, sz: C - 40, hp: 30, cd: 0, face: 0, mv: i % 2 === 0 }); }
    if (window.__LV) { s.res.metal = s.res.comp = s.res.reg = 9999; const Q = (ty, x, z, lv) => { const b = { id: s.nid++, type: ty, x: C + x, z: C + z, prog: 1, built: true, hp: 100, on: true, why: '', dust: 0, off: false, lv: lv }; if (ty === 'greenhouse') b.plots = [{ crop: 'batata', g: 0.9 }, { crop: 'alface', g: 0.7 }, null, null]; s.b.push(b); }; for (let i = 0; i < 5; i++) { Q('solar', -30 + i * 5, -22, i + 1); Q('casa', -30 + i * 5, -27, i + 1); Q('battery', -6 + i * 3, -22, i + 1); Q('greenhouse', -32 + i * 7, -34, i + 1); Q('habitat', -32 + i * 7, -41, i + 1); Q('workshop', -6 + i * 5, -27, i + 1); } for (let x = -42; x < 20; x++) for (let z = -48; z < -18; z++) s.rt.fog[(C + z) * Sim.N + C + x] = 1; }
    const pad = s.b.find(b => b.type === 'pad'); s.ark.st = 2; s.ark.pad = pad.id; s.t = 8 * 24 + 10; s.lastHour = Math.floor(s.t); s.auto = false;
    s.ark.pods.slice(0, 8).forEach((p, i) => { p.st = 'awake'; UI.state(); }); window._s = s; });
  await pg.evaluate(() => { if (window.__E4) return; const s = window._s, C = Sim.N / 2; // acorda 8 colonos "à mão" e espalha pelo bairro e pelas obras
    const pos = [[0, 13.5], [2.4, 13.6], [4.6, 13.2], [-2, 7.5], [5.5, 8], [1, 3.2], [-4, 7.6], [7.5, -4.5]];
    s.ark.pods.slice(0, 8).forEach((p, i) => { Sim.tick(s, 0); }); const mk = (id, x, z) => { s.chars[id] = JSON.parse(JSON.stringify(s.chars.elias)); const c = s.chars[id]; c.id = id; c.x = C + x; c.z = C + z; c.hero = false; c.job = Sim.cinfo(id).job; c.act = null; c.queue = []; c.inside = null; c.face = Math.atan2(-x + 1, -z + 9); };
    ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'].forEach((id, i) => mk(id, pos[i][0], pos[i][1])); mk('n1', -6.5, 12.6); s.nborn = 1; s.chars.n1.bornT = s.t - 30;
    s.chars.elias.x = C + 1.3; s.chars.elias.z = C + 3.6; s.chars.helena.x = C + 2.5; s.chars.helena.z = C + 3.4; for (const k in s.chars) { s.chars[k].act = null; s.chars[k].inside = null; s.chars[k].queue = []; }
    s.chars.elias.face = 0.4; s.chars.helena.face = -0.5; s.chars.c1.act = { type: 'build', phase: 'work', id: s.b[s.b.length - 5].id, x: 0, z: 0 }; s.chars.c3.carry = { res: 'metal', n: 5 }; });
  const cam = (o, t) => pg.evaluate(([o, t]) => { if (UI.mode() === 'cut') UI.endCut(); const C = Sim.N / 2; o = Object.assign({}, o); o.x += C; o.z += C; Object.assign(World.cam, o); if (t != null) { window._s.t = t; window._s.lastHour = Math.floor(t); } }, [o, t]);
  await pg.evaluate(() => { UI.act('spd', { dataset: { a: '0' } }); step(2); if (UI.mode() === 'cut') UI.endCut(); });
  const D0 = 8 * 24;
  if (want('base')) { await cam({ x: 0, z: 4, dist: 52, yaw: 0.6, pitch: 0.7 }, D0 + 10.5); await shot('base', 14); }
  if (want('bairro')) { await cam({ x: 1.5, z: 11, dist: 20, yaw: 0.9, pitch: 0.42 }, D0 + 15.5); await shot('bairro', 8); }
  if (want('chars')) { await pg.evaluate(() => { const s = window._s; ['c1', 'c2', 'c3'].forEach((k, i) => { s.chars[k].face = 0.25 + (i - 1) * 0.25; s.chars[k].act = null; }); s.chars.c3.carry = null; const dp = s.deps[0]; s.chars.c2.act = { type: 'gather', phase: 'work', kind: 'd', id: dp.id, x: s.chars.c2.x + 1, z: s.chars.c2.z, t: 0 }; }); await cam({ x: 2.3, z: 13.5, dist: 4.4, yaw: 0.25, pitch: 0.12 }, D0 + 11); await shot('chars', 12); }
  if (want('ark')) { await cam({ x: 11, z: -7, dist: 30, yaw: 2.2, pitch: 0.28 }, D0 + 16.8); await shot('ark', 8); }
  if (want('berco')) { await cam({ x: -5.5, z: 11.5, dist: 22, yaw: -0.5, pitch: 0.4 }, D0 + 9); await shot('berco', 8); }
  if (want('ground')) { await cam({ x: 15, z: -2, dist: 9, yaw: 0.5, pitch: 0.55 }, D0 + 11); await shot('ground', 10); }
  if (want('edge')) { await pg.evaluate(() => { const s = window._s; s.rt.fog.fill(1); s.rt.fogDirty = true; }); await cam({ x: 40, z: 10, dist: 55, yaw: -0.9, pitch: 0.55 }, D0 + 11); await shot('edge', 14); }
  if (want('map')) { await pg.evaluate(() => { const s = window._s; s.rt.fog.fill(1); s.rt.fogDirty = true; }); await cam({ x: 0, z: 8, dist: 120, yaw: 0.3, pitch: 1.2 }, D0 + 11); await shot('map', 14); }
  if (want('e4')) { await pg.evaluate(() => { const s = window._s; World.rebuild(s); }); await cam({ x: 0, z: -26, dist: 34, yaw: 0.25, pitch: 0.45 }, D0 + 11); await shot('e4', 12); }
  if (want('fac')) { await cam({ x: 74, z: -52, dist: 60, yaw: 0.5, pitch: 0.55 }, D0 + 11); await shot('fac', 14); }
  if (want('core')) { await cam({ x: -18, z: -74, dist: 30, yaw: 0.6, pitch: 0.35 }, D0 + 11); await shot('core', 12); }
  if (want('war')) { await pg.evaluate(() => { const s = window._s, C = Sim.N / 2; ['c1', 'c2'].forEach((k, i) => { const c = s.chars[k]; if (!c) return; Sim.arm(s, k); c.x = C + 9 + i * 3; c.z = C - 15.5; c.inside = null; c.act = null; c.fighting = true; c.firing = true; c.face = Math.PI; }); s.rt.fx = s.foes.slice(0, 3).map((f, i) => ({ k: 'shot', x: C + 9 + (i % 2) * 3, z: C - 15.5, tx: f.x, tz: f.z, w: 'rifle' })); });
    await cam({ x: 12, z: -14, dist: 26, yaw: 0.5, pitch: 0.5 }, D0 + 11); await shot('war', 10); }
  if (want('war2')) { await cam({ x: 15, z: -6, dist: 20, yaw: -0.6, pitch: 0.42 }, D0 + 11); await shot('war2', 10); }
  if (want('lv1')) { await cam({ x: -18, z: -24, dist: 30, yaw: 0.35, pitch: 0.42 }, D0 + 11); await shot('lv1', 10); }
  if (want('lv2')) { await cam({ x: -18, z: -37, dist: 34, yaw: 0.35, pitch: 0.42 }, D0 + 11); await shot('lv2', 10); }
  if (want('lv3')) { await cam({ x: 0, z: -24, dist: 24, yaw: 0.35, pitch: 0.4 }, D0 + 11); await shot('lv3', 10); }
  if (want('poles')) { await cam({ x: 17, z: 8, dist: 22, yaw: -0.6, pitch: 0.32 }, D0 + 15); await shot('poles', 10); }
  if (want('search')) { await pg.evaluate(() => { const q = document.getElementById('bq'); q.value = 'perf'; q.dispatchEvent(new Event('input')); step(1); }); await pg.screenshot({ path: 't/search.png' }); }
  if (want('far')) { await cam({ x: 0, z: 4, dist: 110, yaw: 0.6, pitch: 0.5 }, D0 + 13); await shot('far', 20); }
  if (want('night')) { await cam({ x: 0, z: 6, dist: 44, yaw: 0.6, pitch: 0.6 }, D0 + 22); await shot('night', 10); }
  if (want('win')) { await pg.evaluate(() => { UI.openWin('ark'); step(1); }); await pg.screenshot({ path: 't/win.png' }); }
  console.log(errs.slice(0, 20).join('\n') || 'no errors'); await b.close();
})();
