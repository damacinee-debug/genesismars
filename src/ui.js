// ============================================================
// UI — interface, entrada, cenas, som, salvamento e laço principal.
// ============================================================
var UI = (function () {
  var W = World, D = DATA, BD = D.buildings, B = D.bal, N = Sim.N, C0 = N / 2;
  var s, mode = 'menu', paused = false, speed = 1, sel = { c: [], b: null, d: null }, placing = null, cat = null, modalKind = null, Cut = null;
  var set = { vol: 0.6, mus: 0.5, cam: 1, ui: 1, shake: true, subs: true, q: (/Mobi|Android/i.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4) ? 'mid' : 'high' }, keys = {}, last = 0, hudAcc = 0, sideSig = '', itemSig = '', scenes = [], subsQ = [], subsT = 0, chronNew = false, toastT = 0, ptr = null, pinch = null, demo = null;
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r0(v) { return Math.round(v); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }

  // ---------------- SOM (sintetizado; o silêncio faz parte) ----------------
  var Au = { ctx: null, duck: 0 };
  function auInit() { if (Au.ctx) { if (Au.ctx.state === 'suspended') Au.ctx.resume(); return; } try { var C = window.AudioContext || window.webkitAudioContext; if (!C) return; var c = Au.ctx = new C();
      Au.master = c.createGain(); Au.master.gain.value = set.vol; Au.master.connect(c.destination);
      var buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0), i, v = 0; for (i = 0; i < d.length; i++) { v = v * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = v * 6; }
      var src = c.createBufferSource(); src.buffer = buf; src.loop = true; Au.windF = c.createBiquadFilter(); Au.windF.type = 'bandpass'; Au.windF.frequency.value = 320; Au.windF.Q.value = 0.6; Au.wind = c.createGain(); Au.wind.gain.value = 0; src.connect(Au.windF); Au.windF.connect(Au.wind); Au.wind.connect(Au.master); src.start();
      // trilha: bus próprio; toca o arquivo de música em loop (window.GM_MUSIC troca o arquivo) ou, sem ele, pads gerados com eco suave
      Au.mus = c.createGain(); Au.mus.gain.value = 0; var dl = c.createDelay(2), fb = c.createGain(), lp = c.createBiquadFilter(); dl.delayTime.value = 0.62; fb.gain.value = 0.42; lp.type = 'lowpass'; lp.frequency.value = 1400;
      Au.musIn = c.createGain(); Au.musIn.connect(lp); lp.connect(Au.mus); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(Au.mus); Au.mus.connect(Au.master); Au.next = c.currentTime + 2;
      var trk = window.GM_MUSIC || 'music/god-particle.mp3'; // trilha: Out of Flux & Danny Shields — God Particle (em loop); se o arquivo faltar, volta a trilha gerada
      if (trk && location.protocol !== 'file:') { try { var el = new Audio(trk); el.loop = true; el.preload = 'auto'; var ms = c.createMediaElementSource(el), tg = c.createGain(); tg.gain.value = 0.45; ms.connect(tg); tg.connect(Au.mus); Au.file = el;
          el.addEventListener('error', function () { Au.file = null; }); var pr = el.play(); if (pr && pr.catch) pr.catch(function () { Au.file = null; }); } catch (e2) { Au.file = null; } }
      var o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55; var o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 82.5; var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 170; Au.hum = c.createGain(); Au.hum.gain.value = 0; o.connect(f); o2.connect(f); f.connect(Au.hum); Au.hum.connect(Au.master); o.start(); o2.start();
    } catch (e) { Au.ctx = null; } }
  function tone(f, dur, type, vol, at) { if (!Au.ctx) return; var c = Au.ctx, t = c.currentTime + (at || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || 0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(Au.master); o.start(t); o.stop(t + dur + 0.05); }
  function sfx(id) { switch (id) { case 'place': tone(520, 0.08, 'square', 0.05); break; case 'built': tone(440, 0.18, 'triangle', 0.1); tone(660, 0.3, 'triangle', 0.1, 0.12); break; case 'drop': tone(110, 0.2, 'sine', 0.16); break;
      case 'alarm': tone(880, 0.16, 'square', 0.07); tone(660, 0.22, 'square', 0.07, 0.2); break; case 'warn': tone(600, 0.12, 'triangle', 0.07); break; case 'discover': [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.5, 'sine', 0.08, i * 0.11); }); break;
      case 'radio': tone(1400, 0.05, 'square', 0.04); tone(1000, 0.05, 'square', 0.04, 0.08); break; case 'ok': tone(700, 0.06, 'sine', 0.06); break; case 'thud': tone(48, 0.9, 'sine', 0.5); tone(70, 0.5, 'triangle', 0.25); break; case 'hydraulic': tone(85, 2.6, 'sawtooth', 0.035); tone(128, 2.4, 'square', 0.015, 0.15); tone(60, 0.5, 'sine', 0.2, 2.6); break; } }
  function music(dur) { if (!Au.ctx) return; var c = Au.ctx, t = c.currentTime; [110, 164.8, 220, 261.6, 329.6, 493.9].forEach(function (f, i) { var o = c.createOscillator(), g = c.createGain(); o.type = i < 2 ? 'sine' : 'triangle'; o.frequency.value = f * (1 + (i % 2 ? 0.002 : -0.002));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045 / (1 + i * 0.25), t + 3 + i * 0.6); g.gain.setValueAtTime(0.045 / (1 + i * 0.25), t + dur - 4); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(g); g.connect(Au.master); o.start(t); o.stop(t + dur + 0.1); }); }
  var PAD = [[110, 164.8, 220, 277.2], [98, 146.8, 196, 246.9], [87.3, 130.8, 174.6, 220], [110, 146.8, 220, 329.6], [123.5, 185, 246.9, 293.7]];
  function padChord() { var c = Au.ctx, t = c.currentTime, ch = PAD[Math.floor(Math.random() * PAD.length)], dur = 10 + Math.random() * 5;
    ch.forEach(function (f, i) { var o = c.createOscillator(), g = c.createGain(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 8; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 / (1 + i * 0.4), t + 3.5); g.gain.setValueAtTime(0.05 / (1 + i * 0.4), t + dur - 4); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(g); g.connect(Au.musIn); o.start(t); o.stop(t + dur + 0.1); });
    if (Math.random() < 0.7) { var n = ch[1 + Math.floor(Math.random() * 3)] * 2, b = c.createOscillator(), bg = c.createGain(); b.type = 'sine'; b.frequency.value = n; bg.gain.setValueAtTime(0, t + 4); bg.gain.linearRampToValueAtTime(0.03, t + 4.05); bg.gain.exponentialRampToValueAtTime(0.0001, t + 7); b.connect(bg); bg.connect(Au.musIn); b.start(t + 4); b.stop(t + 7.2); }
    Au.next = t + dur - 3.5; }
  function auUpdate() { if (!Au.ctx) return; var t = Au.ctx.currentTime, k = s.stormK, quiet = Au.duck ? 0.05 : 1; Au.master.gain.setTargetAtTime(set.vol, t, 0.1);
    if (Au.mus) { Au.mus.gain.setTargetAtTime((set.mus == null ? 0.5 : set.mus) * (Au.duck ? 0.3 : 1), t, 1.5); if (!Au.file && t >= Au.next && (set.mus == null ? 0.5 : set.mus) > 0) padChord(); }
    Au.wind.gain.setTargetAtTime((0.05 + k * 0.32) * quiet * (mode === 'menu' ? 0.6 : 1), t, 0.6); Au.windF.frequency.setTargetAtTime(300 + k * 500 + Math.sin(t * 0.3) * 80, t, 0.5);
    Au.hum.gain.setTargetAtTime(mode === 'menu' ? 0 : Sim.signal(s) / 100 * 0.03 * quiet, t, 1); }

  // ---------------- SALVAMENTO ----------------
  function save(slot) { if (!s || s.lost) return false; var ok = lsSet('gm_' + slot, JSON.stringify({ at: Date.now(), sol: Sim.sol(s), data: Sim.serialize(s) })); if (slot === 'manual') toast(ok ? 'Missão salva' : 'Este navegador bloqueou o salvamento'); return ok; }
  function readSave(slot) { var j = lsGet('gm_' + slot); if (!j) return null; try { return JSON.parse(j); } catch (e) { return null; } }
  function latest() { var a = readSave('auto'), m = readSave('manual'); if (a && m) return a.at > m.at ? a : m; return a || m; }
  function loadGame(sv) { try { s = Sim.deserialize(sv.data); } catch (e) { lsDel('gm_auto'); lsDel('gm_manual'); toast('Esse salvamento é de uma versão anterior do jogo e não abre mais. Comece uma nova missão'); $('menu').hidden = false; refreshMenu(); return false; } W.rebuild(s); enterPlay(); toast('Missão carregada: sol ' + Sim.sol(s)); return true; }
  function saveSettings() { lsSet('gm_set', JSON.stringify(set)); applySettings(); }
  function applySettings() { document.documentElement.style.setProperty('--u', set.ui); }

  // ---------------- HUD ----------------
  var CH = [['energy', 'Energia'], ['o2', 'Oxigênio'], ['water', 'Água'], ['food', 'Alimento'], ['metal', 'Metal'], ['comp', 'Componentes'], ['reg', 'Regolito'], ['research', 'Pesquisa']];
  function buildHUD() {
    $('top').innerHTML = '<div class="tr">' + CH.map(function (c) { return '<div class="chip pn" id="c_' + c[0] + '"><span class="lb">' + c[1] + '</span><b class="num"></b><small class="num"></small></div>'; }).join('') +
      '<div class="chip pn" id="c_pop" data-act="win" data-a="ark" style="cursor:pointer" title="Colonos e a Alvorada"><span class="lb">População</span><b class="num"></b><small class="num"></small></div><div class="chip pn" id="clock"><span class="lb"><i id="pulse"></i><span id="ckSol"></span></span><b class="num" id="ckTime"></b><small id="ckW"></small></div></div><div class="tr r">' +
      '<div class="tb pn" id="spd"><button data-act="spd" data-a="0" title="Pausar (Espaço)">II</button><button data-act="spd" data-a="1" title="Tecla 1">1×</button><button data-act="spd" data-a="2" title="Tecla 2">2×</button><button data-act="spd" data-a="4" title="Tecla 3">4×</button></div>' +
      '<div class="tb pn"><button data-act="win" data-a="chron" id="bChron">Crônica</button><button data-act="win" data-a="research">Pesquisa</button><button data-act="win" data-a="ark">Colonos</button><button data-act="win" data-a="civ">Civilização</button><button data-act="win" data-a="tasks">Tarefas</button><button data-act="net" id="bNet" title="Tecla N">Redes</button><button data-act="win" data-a="menu" title="Esc">Menu</button></div></div>';
    $('cats').innerHTML = '<input id="bq" type="search" placeholder="Buscar construção…" autocomplete="off" aria-label="Buscar construção">' + D.cats.map(function (c) { return '<button data-act="cat" data-a="' + c + '">' + c + '</button>'; }).join('');
    var bq = $('bq'); bq.addEventListener('input', function () { bqv = norm(bq.value.trim()); if (bqv) { cat = null; var cb = $('cats').querySelectorAll('button'); for (var i = 0; i < cb.length; i++) cb[i].className = ''; } itemSig = ''; renderItems(); });
    bq.addEventListener('keydown', function (e) { if (e.key === 'Escape') { bq.value = ''; bqv = ''; itemSig = ''; renderItems(); bq.blur(); } if (e.key === 'Enter') { var f = $('items').querySelector('button:not(.no)') || $('items').querySelector('button'); if (f) f.click(); bq.blur(); } });
    crewSig = '';
  }
  var crewSig = '';
  function avatar(id, cls) { var inf = Sim.cinfo(id); if (ART[id]) return '<img class="' + cls + '" src="' + ART[id] + '" alt="" style="border-color:' + inf.color + '">'; if (cls === 'mono') return ''; var col = (D.jobs[inf.job] || ['', '#8a8177'])[1]; return '<span class="' + cls + ' av" style="background:' + col + ';border-color:' + col + '">' + esc(inf.short[0]) + '</span>'; }
  function renderCrew() { var ids = Object.keys(s.chars).filter(function (k) { return s.chars[k].alive || D.chars[k]; }), sig = ids.join(), i;
    if (sig !== crewSig) { crewSig = sig; $('crew').innerHTML = (ids.length > 2 ? '<button class="cw pn all" data-act="selall" title="Seleciona todos os que podem receber ordens">Todos</button>' : '') + ids.map(function (id) { var inf = Sim.cinfo(id); return '<button class="cw pn' + (D.chars[id] ? '' : ' col') + '" id="cw_' + id + '" data-act="selc" data-a="' + id + '" title="' + esc(inf.name + ' · ' + inf.role) + '">' + avatar(id, 'mono') + '<span><b>' + esc(inf.short) + '</b><small></small><span class="mini"><i><b></b></i><i><b></b></i></span></span></button>'; }).join(''); }
    for (i = 0; i < ids.length; i++) { var c = s.chars[ids[i]], e = $('cw_' + ids[i]); if (!e) continue; e.className = 'cw pn' + (D.chars[ids[i]] ? '' : ' col') + (sel.c.indexOf(ids[i]) >= 0 ? ' sel' : '') + (c.alive ? '' : ' dead'); e.querySelector('small').textContent = charStatus(c);
      var mb = e.querySelectorAll('.mini b'); mb[0].style.width = c.needs.health + '%'; mb[0].style.background = c.needs.health < 40 ? 'var(--crit)' : 'var(--green)'; mb[1].style.width = c.needs.o2 + '%'; mb[1].style.background = c.needs.o2 < 25 ? 'var(--crit)' : 'var(--blue)'; } }
  function arkLine() { var A = s.ark, sl = Sim.sleepers(s).length; if (A.st === 0) { var h = Math.max(0, B.arrivalT - s.t); return D.lore.ark + ' em ' + Math.floor(h / 24) + ' sóis ' + Math.floor(h % 24) + ' h'; } if (A.st === 1) return D.lore.ark + ' em órbita, sem zona de pouso';
    if (sl || A.wake) return sl + ' em criogenia' + (A.wake ? ', 1 despertando' : ''); var g = s.b.filter(function (b) { return b.gest; })[0]; return g ? 'Berço: ' + Math.round(g.gest * 100) + '%' : 'todos despertos'; }
  function hhmm(h) { var m = Math.floor((h % 1) * 60); return ('0' + Math.floor(h)).slice(-2) + ':' + ('0' + m).slice(-2); }
  function updateHUD() {
    var cp = Sim.caps(s), r = s.res, i;
    function chip(k, val, sub, low, out) { var e = $('c_' + k); e.children[1].textContent = val; e.children[2].textContent = sub; e.title = sub || ''; e.className = 'chip pn' + (out ? ' out' : low ? ' low' : ''); }
    var alive = 0; for (i in s.chars) if (s.chars[i].alive) alive++;
    chip('energy', r0(r.energy) + ' / ' + r0(cp.energy), (s.rate.energy >= 0 ? '+' : '') + s.rate.energy.toFixed(1) + ' por hora', s.rate.energy < 0 && r.energy < cp.energy * 0.3, r.energy < 1);
    chip('o2', r0(r.o2) + ' / ' + r0(cp.o2), 'dura ' + (alive ? (r.o2 / (alive * 10)).toFixed(1) : '0') + ' sóis parado', r.o2 < alive * 20, r.o2 < alive * 10);
    chip('water', r0(r.water) + ' / ' + r0(cp.water), 'gelo ' + r0(r.ice), r.water < 12, r.water < 4);
    chip('food', r0(r.food) + ' / ' + r0(cp.food), 'sementes ' + r0(r.seeds), r.food < 8, r.food < 3);
    chip('metal', r0(r.metal), 'limite ' + r0(cp.mat), r.metal >= cp.mat, false); chip('comp', r0(r.comp), '', false, false); chip('reg', r0(r.reg), '', r.reg >= cp.mat, false); chip('research', r.research.toFixed(1), '', false, false);
    var h = Sim.hour(s), st = s.storm, day = h >= B.sunrise && h < B.sunset;
    $('ckSol').textContent = 'Sol ' + Sim.sol(s) + ' · ' + D.lore.year; $('ckTime').textContent = hhmm(h) + (day ? ' · dia' : ' · noite');
    var w = st.st === 2 ? 'Tempestade de poeira' : st.st === 1 ? 'Tempestade em ' + Math.ceil(st.start - s.t) + ' h' : (day ? 'Pôr do sol em ' + Math.ceil(B.sunset - h) : 'Nascer do sol em ' + Math.ceil((B.sunrise - h + 24) % 24)) + ' h'; $('ckW').textContent = w; $('ckW').style.color = st.st === 2 ? 'var(--crit)' : st.st === 1 ? 'var(--warn)' : '';
    var sg = Sim.signal(s); $('pulse').style.animationDuration = (3.2 - sg / 100 * 2.4) + 's'; $('pulse').title = 'Sinal de Vida ' + sg + ' de 100'; $('clock').title = 'Sinal de Vida ' + sg + ' de 100';
    var sb = $('spd').children; for (i = 0; i < sb.length; i++) sb[i].className = (+sb[i].dataset.a === (paused ? 0 : speed)) ? 'on' : '';
    $('pause').hidden = !paused || !!modalKind; $('bNet').className = W.overlayOn ? 'on' : ''; $('bChron').innerHTML = 'Crônica' + (chronNew ? '<i class="dot"></i>' : '');
    // objetivos
    var ob = Sim.objectives(s), todo = ob.filter(function (o) { return !o.done; }).slice(0, 1), rq = Sim.requirements(s), nok = rq.filter(function (q) { return q.ok; }).length;
    var html = '<h3>' + (s.won ? 'Capítulo I concluído' : 'Próximo passo') + '</h3>' + (todo.length ? todo.map(function (o) { return '<div class="obj"><i></i><span>' + esc(o.text) + '</span></div>'; }).join('') : '<div class="obj done"><i></i><span>A base é de vocês. Continuem construindo.</span></div>') +
      '<button id="era" data-act="win" data-a="civ" style="text-align:left">Era <b>' + D.eras[s.era - 1].n + ' — ' + D.eras[s.era - 1].name + '</b>' + (s.won ? '' : ' · requisitos do Marco ' + nok + '/' + rq.length) + '</button>';
    if ($('left').dataset.h !== html) { $('left').dataset.h = html; $('left').innerHTML = html; }
    // tripulação
    renderCrew(); var np = Sim.pop(s), nb = Sim.beds(s); chip('pop', np + ' / ' + nb + ' leitos', arkLine(), np >= nb, s.ark.st === 1);
    renderItems(); renderSide();
    if (modalKind === 'research' || modalKind === 'tasks' || modalKind === 'ark') refreshModal();
  }
  function charStatus(c) { if (!c.alive) return 'Morreu'; if (c.critical > 0) return 'Estado crítico'; if (c.act) return Sim.LABEL[c.act.type]; return c.inside != null ? 'No abrigo' : 'Aguardando ordens'; }

  var bqv = ''; function norm(x) { return x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function renderItems() { var el = $('items'); if (!cat && !bqv) { el.hidden = true; itemSig = ''; return; }
    var list = Object.keys(BD).filter(function (k) { return bqv ? norm(BD[k].name + ' ' + BD[k].cat + ' ' + BD[k].desc + ' ' + k).indexOf(bqv) >= 0 : BD[k].cat === cat; }), rq = Sim.reqOK(s), sig = cat + bqv + placing + rq + list.map(function (k) { var c = BD[k].cost, ok = 1; for (var r in c) if (s.res[r] < c[r]) ok = 0; return ok; }).join('');
    if (sig === itemSig) return; itemSig = sig; el.hidden = false;
    el.innerHTML = list.map(function (k) { var d = BD[k], ok = true; for (var r in d.cost) if (s.res[r] < d.cost[r]) ok = false; var lock = d.landmark && !rq;
      return '<button data-act="build" data-a="' + k + '" class="' + (placing === k ? 'on ' : '') + (ok && !lock ? '' : 'no') + '" title="' + esc(d.desc) + '"><b>' + d.name + '</b><small>' + (lock ? 'requisitos da Era pendentes' : Sim.costText(d.cost)) + '</small></button>'; }).join('') || '<span class="lb" style="padding:.7em 1em">Nenhuma construção com esse nome</span>'; }

  var NEEDS = [['health', 'Saúde', 0], ['o2', 'O₂ do traje', 0], ['hunger', 'Alimentação', 1], ['thirst', 'Hidratação', 1], ['energy', 'Descanso', 0], ['temp', 'Temperatura', 0], ['morale', 'Moral', 0], ['stress', 'Estresse', 2], ['rad', 'Radiação', 2]];
  function bar(key, label) { return '<div class="bar" data-bar="' + key + '"><span>' + label + '</span><u><i></i></u><span class="num"></span></div>'; }
  function renderSide() { var el = $('side'), html = '', sig = '', dyn = {}, c, b, d, i;
    if (sel.c.length && !s.chars[sel.c[0]]) setSel({});
    if (sel.c.length) { c = s.chars[sel.c[0]]; var cd = Sim.cinfo(c.id), hm = c.home != null ? Sim.byId(s, c.home) : null; sig = 'c' + sel.c.join() + (hm ? hm.id + '' + !!hm.bairro : 'x') + (c.weak > s.t) + c.alive + (c.critical > 0) + (c.act ? c.act.type : '') + c.queue.length + c.mem.join() + JSON.stringify(c.skills) + Sim.bondName(s.bond) + (c.inside != null);
      html = '<div class="who">' + avatar(c.id, 'big') + '<div><span class="lb">' + cd.role + ' · ' + (cd.born ? 'nasceu no sol ' + (Math.floor((c.bornT || 0) / 24) + 1) : cd.age + ' anos') + (sel.c.length > 1 ? ' · ' + sel.c.length + ' selecionados' : '') + '</span><h2>' + esc(cd.name) + '</h2></div></div><p class="quote">' + (cd.quote ? '“' + esc(cd.quote) + '”' : esc(cd.why)) + '</p><div class="st ' + (c.critical > 0 || !c.alive ? 'bad' : 'ok') + '">' + charStatus(c) + (c.queue.length ? ' · ' + c.queue.length + ' na fila' : '') + '</div>' +
        NEEDS.map(function (n) { return bar(n[0], n[1]); }).join('') + '<div class="st">Casa: <b>' + (hm ? BD[hm.type].name + (hm.bairro ? ', num bairro' : '') : 'sem leito') + '</b>' + (c.weak > s.t ? ' · recém-desperto, ainda fraco' : '') + '</div><div class="st">Coesão da comunidade: <b>' + Sim.bondName(s.bond) + '</b></div>' +
        '<h3>Habilidades</h3><div class="tags">' + Object.keys(c.skills).map(function (k) { return '<span class="tag">' + D.skillNames[k] + ' <b>' + c.skills[k] + '</b></span>'; }).join('') + '</div>' +
        '<h3>Traços</h3><div class="tags">' + (cd.traits || [cd.trait]).map(function (t) { return '<span class="tag" title="' + esc(t[1]) + '"><b>' + t[0] + '</b></span>'; }).join('') + '</div>' +
        (c.mem.length ? '<h3>Memórias</h3><div class="tags">' + c.mem.map(function (m) { return '<span class="tag" title="' + esc(D.memories[m][1]) + '"><b>' + D.memories[m][0] + '</b></span>'; }).join('') + '</div>' : '') +
        (c.alive && c.critical <= 0 ? '<div class="btns"><button class="bt" data-act="co" data-a="sleep">Dormir</button><button class="bt" data-act="co" data-a="eat">Comer</button><button class="bt" data-act="co" data-a="drink">Beber</button><button class="bt" data-act="co" data-a="talk">Conversar</button><button class="bt" data-act="co" data-a="contemplate">Olhar o horizonte</button><button class="bt" data-act="co" data-a="stop">Parar</button><button class="bt" data-act="focus">Centralizar</button></div><p>Botão direito no terreno, num depósito ou numa construção dá a ordem. Shift põe na fila.' + (D.chars[c.id] ? '' : ' Sem ordens, os colonos constroem, coletam e cuidam da base sozinhos.') + '</p>' : '');
      NEEDS.forEach(function (n) { var v = c.needs[n[0]], shown = n[2] === 1 ? 100 - v : v; dyn[n[0]] = [shown, n[2] === 2 ? (v > 70 ? 'c' : v > 45 ? 'w' : 'g') : (shown < 22 ? 'c' : shown < 45 ? 'w' : n[0] === 'health' || n[0] === 'morale' ? 'g' : '')]; });
    } else if (sel.b != null && (b = Sim.byId(s, sel.b))) { d = BD[b.type]; var pl = b.plots ? b.plots.map(function (p) { return !p ? '0' : p.order ? 'o' : p.g >= 1 ? 'r' : 'g'; }).join('') : '';
      sig = 'b' + b.id + Sim.lvl(b) + (b.up != null) + Sim.canUpgrade(s, b).ok + (b.gest ? 1 : 0) + (s.ark.wake ? s.ark.wake.id : '') + s.ark.st + Sim.pop(s) + Sim.beds(s) + !!b.bairro + b.built + b.on + b.why + pl + b.off + (b.hp < 95) + (b.dust > 0.08) + (demo === b.id) + s.flags.unloaded + s.flags.inspected + (b.idle ? 1 : 0);
      html = '<span class="lb">' + (d.cat || 'Nave') + (b.built && b.type !== 'lander' ? ' · nível ' + Sim.lvl(b) : '') + '</span><h2>' + d.name + '</h2><div class="st ' + (!b.built ? 'mid' : b.on ? 'ok' : 'bad') + '">' + (!b.built ? 'Em obra' : b.on ? (b.idle ? 'Ligado, ocioso' : 'Funcionando') : 'Parado: ' + b.why) + '</div><p>' + d.desc + '</p>';
      var info = []; if (d.use) info.push('Consumo ' + d.use + '/h'); if (d.gen) info.push('Pico ' + d.gen + '/h'); if (d.cap) info.push('Guarda ' + d.cap); if (d.out) for (i in d.out) info.push('Produz ' + d.out[i] + ' ' + ({ o2: 'O₂', ice: 'gelo' })[i] + '/h'); if (d.store) for (i in d.store) info.push('+' + d.store[i] + ' de ' + ({ o2: 'O₂', water: 'água', mat: 'materiais' })[i]);
      if (info.length) html += '<div class="tags">' + info.map(function (t) { return '<span class="tag"><b>' + t + '</b></span>'; }).join('') + '</div>';
      if (!b.built) { html += bar('prog', 'Obra'); dyn.prog = [b.prog * 100, '']; }
      if (b.up != null) { html += bar('upg', 'Melhoria'); dyn.upg = [b.up * 100, 'g']; }
      if (b.built && b.hp < 100) { html += bar('hp', 'Integridade'); dyn.hp = [b.hp, b.hp < 45 ? 'c' : 'w']; }
      if (b.type === 'solar' && b.built) { html += bar('dust', 'Poeira') + '<div class="st">Gerando <b data-txt="out"></b> por hora</div>'; dyn.dust = [b.dust * 100, b.dust > 0.4 ? 'w' : 'g']; dyn.out = (b.on ? (b.out || 0) : 0).toFixed(1); }
      if (b.type === 'lander') html += '<div class="st">' + (!s.flags.inspected ? 'Ainda não inspecionado.' : !s.flags.unloaded ? 'Carga a bordo: metal, componentes e sementes.' : 'Carga retirada. Serve de abrigo e depósito.') + '</div><div class="st">Reserva lacrada de O₂: <b>' + (s.flags.sealed ? 'usada' : 'intacta') + '</b></div>';
      if (b.type === 'greenhouse' && b.built) for (i = 0; i < 4; i++) { var p = b.plots[i]; html += '<div class="plot"><span>Canteiro ' + (i + 1) + ': ' + (!p ? 'vazio' : p.order ? D.crops[p.order].name + ', aguardando plantio' : D.crops[p.crop].name + ' <b class="num" data-txt="g' + i + '"></b>') + '</span><span class="btns">' +
          (!p ? Object.keys(D.crops).map(function (k) { return '<button class="bt" data-act="plant" data-a="' + i + '" data-b="' + k + '" title="' + D.crops[k].desc + '">' + D.crops[k].name + '</button>'; }).join('') : p.crop && p.g >= 1 ? '<button class="bt pri" data-act="bo" data-a="harvest" data-b="' + i + '">Colher</button>' : '') + '</span></div>'; if (p && p.crop) dyn['g' + i] = p.g >= 1 ? 'madura' : r0(p.g * 100) + '%'; }
      if (b.type === 'lab' && b.built) html += '<div class="st">Pontos de pesquisa: <b data-txt="rs"></b></div>', dyn.rs = s.res.research.toFixed(1);
      if (d.landmark && b.built) html += '<div class="st ok">Marco da Era I. A história lembra.</div>';
      if (d.beds && b.built) { var res = []; for (i in s.chars) if (s.chars[i].alive && s.chars[i].home === b.id) res.push(Sim.cinfo(i).short); html += '<div class="st">Leitos: <b>' + res.length + ' de ' + d.beds + '</b>' + (res.length ? ' · ' + esc(res.join(', ')) : '') + (b.bairro ? ' · faz parte de um bairro' : '') + '</div>'; }
      if (b.type === 'pad') html += '<div class="st">' + (s.ark.st === 2 ? 'A ' + D.lore.ark + ' está pousada aqui. ' + Sim.sleepers(s).length + ' em criogenia.' : 'Aguardando a ' + D.lore.ark + '.') + '</div>';
      if (b.type === 'cryo' && b.built) { if (s.ark.wake) { html += bar('wake', 'Despertando') + '<div class="st">' + esc(Sim.cinfo(s.ark.wake.id).name) + '</div>'; dyn.wake = [s.ark.wake.t / B.wakeHours * 100, 'g']; } else html += '<div class="st">' + (s.ark.st !== 2 ? 'Aguardando a ' + D.lore.ark + '.' : Sim.sleepers(s).length ? (Sim.freeBeds(s) > 0 ? 'Pronta para o próximo despertar.' : 'Sem leito livre: construa casas.') : 'Todos os colonos já despertaram.') + '</div>'; }
      if (b.type === 'berco' && b.built) { if (b.gest) { html += bar('gest', 'Gestação'); dyn.gest = [b.gest * 100, 'g']; } else html += '<div class="st">' + (Sim.sleepers(s).length || s.ark.st !== 2 ? 'Espera todos os colonos despertarem.' : Sim.freeBeds(s) > 0 ? 'Aguardando comida e água de sobra.' : 'Sem leito livre: mais casas, mais gente.') + '</div>'; }
      if (b.type === 'escola' && b.built) html += '<div class="st">' + (b.on ? 'Aulas em andamento: todos aprendem mais rápido.' : 'Sem aulas.') + '</div>';
      if (b.type === 'pad' || b.type === 'cryo' || b.type === 'berco') html += '<div class="btns"><button class="bt" data-act="win" data-a="ark">Ver colonos</button></div>';
      var bt = ''; if (!b.built) bt += '<button class="bt pri" data-act="bo" data-a="build">Mandar construir</button>';
      if (b.built && b.hp < 95) bt += '<button class="bt pri" data-act="bo" data-a="repair">Reparar</button>';
      if (b.type === 'solar' && b.built && b.dust > 0.08) bt += '<button class="bt" data-act="bo" data-a="clean">Limpar poeira</button>';
      if (b.type === 'lander' && !s.flags.unloaded) bt += '<button class="bt pri" data-act="bo" data-a="' + (s.flags.inspected ? 'unload' : 'inspect') + '">' + (s.flags.inspected ? 'Retirar suprimentos' : 'Inspecionar') + '</button>';
      if (b.type === 'lab' && b.built) bt += '<button class="bt pri" data-act="bo" data-a="research">Operar bancada</button><button class="bt" data-act="win" data-a="research">Ver pesquisas</button>';
      if (b.built && b.type !== 'lander') { var cu = Sim.canUpgrade(s, b); if (cu.msg !== 'Esta construção não tem níveis') bt += '<button class="bt' + (cu.ok ? ' pri' : '') + '" data-act="upgrade" title="' + esc(cu.ok ? 'Custo: ' + Sim.costText(Sim.upCost(b)) : cu.msg) + '"' + (cu.ok ? '' : ' disabled') + '>' + (b.up != null ? 'Melhorando…' : Sim.lvl(b) >= 5 ? 'Nível máximo' : 'Melhorar · ' + Sim.costText(Sim.upCost(b))) + '</button>'; }
      if (b.type !== 'lander' && b.type !== 'pad' && !d.landmark && !d.unique) bt += '<button class="bt" data-act="copy" title="Atalho: C">Construir outro igual</button>';
      if (b.built && d.use && b.type !== 'lander') bt += '<button class="bt" data-act="toggle">' + (b.off ? 'Ligar' : 'Desligar') + '</button>';
      if (b.type !== 'lander' && !d.landmark) bt += '<button class="bt dng" data-act="demo">' + (demo === b.id ? 'Confirmar demolição' : 'Demolir') + '</button>';
      html += '<div class="btns">' + bt + '</div>';
    } else if (sel.d != null && (d = Sim.depById(s, sel.d))) { sig = 'd' + d.id; html = '<span class="lb">Depósito</span><h2>' + (d.res === 'metal' ? 'Minério metálico' : 'Regolito solto') + '</h2><div class="st">Restam <b data-txt="left"></b> unidades</div><p>' + (d.res === 'metal' ? 'Metal para estruturas e painéis.' : 'Regolito para blindagem, estufas e componentes.') + '</p><div class="btns"><button class="bt pri" data-act="gather" data-a="elias">Elias coleta</button><button class="bt" data-act="gather" data-a="helena">Helena coleta</button></div>'; dyn.left = r0(d.left); }
    else { sel.b = sel.d = null; }
    if (!html) { el.hidden = true; sideSig = ''; return; } el.hidden = false; if (sig !== sideSig) { sideSig = sig; el.innerHTML = html; }
    var bars = el.querySelectorAll('[data-bar]'); for (i = 0; i < bars.length; i++) { var v = dyn[bars[i].dataset.bar]; if (!v) continue; bars[i].className = 'bar ' + v[1]; bars[i].children[1].firstChild.style.width = clamp(v[0], 0, 100) + '%'; bars[i].children[2].textContent = r0(v[0]); }
    var tx = el.querySelectorAll('[data-txt]'); for (i = 0; i < tx.length; i++) if (dyn[tx[i].dataset.txt] != null) tx[i].textContent = dyn[tx[i].dataset.txt]; }

  function toast(t) { var e = $('toast'); e.textContent = t; e.hidden = false; toastT = 2.8; }
  function pushAlert(a) { var box = $('alerts'), e = document.createElement('div'); e.className = 'al pn ' + a.lvl; e.textContent = a.msg; if (a.x != null) e.onclick = function () { W.cam.x = a.x; W.cam.z = a.z; }; box.appendChild(e); while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, a.lvl === 'crit' ? 14000 : 8000); if (a.lvl === 'crit') sfx('alarm'); else if (a.lvl === 'warn') sfx('warn'); }

  // ---------------- JANELAS ----------------
  function winHTML(kind, arg) { var h = '<button class="bt x" data-act="close">Fechar</button>', i;
    if (kind === 'chron') { chronNew = false; return h + '<span class="lb">' + D.lore.chapter + '</span><h2>Crônica de Marte</h2><p>O livro se escreve sozinho. Um dia, quem nascer aqui vai aprender estas linhas na escola.</p>' + s.chron.slice().reverse().map(function (c) { return '<p class="ch"><small>Sol ' + c.sol + '</small>' + esc(c.text.replace(/^Sol \d+( de \d+)?\. /, '')) + '</p>'; }).join('') +
      '<h3 class="lb">O que existe em Marte</h3>' + D.glossary.map(function (g) { return '<p class="ch"><small>' + g[0] + '</small>' + esc(g[1]) + '</p>'; }).join(''); }
    if (kind === 'research') { var lab = Sim.ofType(s, 'lab', true).length; return h + '<span class="lb">Árvore de pesquisa · primeira camada</span><h2>Pesquisa</h2><p>Pontos disponíveis: <b class="num">' + s.res.research.toFixed(1) + '</b>. ' + (lab ? 'Mande alguém operar a bancada para gerar pontos.' : 'Construa uma bancada de pesquisa encostada no complexo pressurizado.') + '</p><div class="grid">' +
        Object.keys(D.research).map(function (k) { var t = D.research[k], done = s.tech[k]; return '<div class="card' + (done ? ' done' : '') + '"><span class="lb">' + t.branch + '</span><b>' + t.name + '</b><small>' + t.desc + '</small>' + (done ? '<span class="st ok">Dominada</span>' : '<button class="bt' + (s.res.research >= t.cost ? ' pri' : '') + '" data-act="tech" data-a="' + k + '">Pesquisar · ' + t.cost + ' pontos</button>') + '</div>'; }).join('') +
        D.lockedResearch.map(function (n) { return '<div class="card lock"><span class="lb">Eras futuras</span><b>' + n + '</b><small>Exige uma Era mais avançada.</small></div>'; }).join('') + '</div>'; }
    if (kind === 'civ') { var rq = Sim.requirements(s); return h + '<span class="lb">Como começa uma civilização?</span><h2>Era ' + D.eras[s.era - 1].n + ' — ' + D.eras[s.era - 1].name + '</h2>' +
        '<div class="grid">' + D.eras.map(function (e, n) { return '<div class="card' + (n + 1 < s.era ? ' done' : n + 1 > s.era ? ' lock' : '') + '"><span class="lb">Era ' + e.n + '</span><b>' + e.name + '</b><small>' + e.theme + (n + 1 > s.era ? ' · capítulos futuros' : '') + '</small></div>'; }).join('') + '</div>' +
        (s.won ? '<p>O Marco está de pé: <b>' + BD[s.flags.landmark].name + '</b>. O outro caminho ficou registrado na Crônica.</p>' : '<h3 class="lb">Para erguer o Marco da Era (menu Marco)</h3>' + rq.map(function (q) { return '<div class="chk' + (q.ok ? ' ok' : '') + '"><i></i><span>' + q.label + '</span></div>'; }).join('') + '<p>Jardim Selado ou Farol Profundo: só um pode ser erguido. A escolha define quem vocês serão.</p>') +
        '<h3 class="lb">Identidade</h3>' + Object.keys(D.axes).map(function (k) { return '<div class="axis"><span>' + D.axes[k][0] + '</span><u><i style="left:' + (50 + s.axes[k] / 2) + '%"></i></u><span>' + D.axes[k][1] + '</span></div>'; }).join('') +
        '<h3 class="lb">Tradições</h3>' + (D.traditions.filter(function (t) { return s.trad[t.id]; }).map(function (t) { return '<div class="chk ok"><i></i><span><b>' + t.name + '.</b> ' + t.desc + '</span></div>'; }).join('') || '<p>Nenhuma ainda. Tradições nascem quando as escolhas puxam forte para um lado.</p>') +
        '<p>Vínculo entre Elias e Helena: <b>' + Sim.bondName(s.bond) + '</b>. Sinal de Vida do planeta: <b>' + Sim.signal(s) + ' de 100</b>.</p>'; }
    if (kind === 'ark') { var A = s.ark, rd = Sim.readiness(s), okN = rd.filter(function (q) { return q.ok; }).length, first = Sim.sleepers(s)[0];
      var stt = { sleep: 'em criogenia', waking: 'despertando', awake: 'desperto', lost: 'cápsula perdida' };
      return h + '<span class="lb">' + D.lore.company + ' · nave criogênica</span><h2>' + (A.st === 0 ? 'A ' + D.lore.ark + ' chega em ' + arkLine().replace(/^.* em /, '') : A.st === 1 ? 'A ' + D.lore.ark + ' espera em órbita' : 'Os doze da ' + D.lore.ark) + '</h2>' +
        '<p>' + (A.st === 0 ? 'Doze pessoas dormem a caminho de Marte. Elas chegam no amanhecer do sol 7. Sem Zona de Pouso, a nave espera em órbita.' : A.st === 1 ? 'Sem Zona de Pouso a nave não desce. As cápsulas aguentam uns 4 sóis em órbita; depois disso, uma falha a cada 2 sóis.' : 'Cada colono desperta na Enfermaria quando existe um leito livre. Mais casas, mais gente. População: <b>' + Sim.pop(s) + '</b> para <b>' + Sim.beds(s) + '</b> leitos.') + '</p>' +
        (A.st !== 2 || Sim.sleepers(s).length ? '<h3 class="lb">Prontidão da base · ' + okN + ' de ' + rd.length + '</h3>' + rd.map(function (q) { return '<div class="chk' + (q.ok ? ' ok' : '') + '"><i></i><span>' + q.label + ': <b>' + q.val + '</b></span></div>'; }).join('') : '') +
        '<div class="st">Turno da noite: <b>' + (s.nightShift ? 'ligado' : 'desligado') + '</b> · ' + (s.nightShift ? 'metade dos colonos trabalha à noite e dorme de dia.' : 'todos descansam à noite.') + ' <button class="bt" data-act="shift">' + (s.nightShift ? 'Desligar' : 'Ligar') + '</button></div>' +
        '<h3 class="lb">Manifesto</h3><div class="grid">' + A.pods.map(function (p) { var inf = Sim.cinfo(p.id), col = D.jobs[inf.job][1]; return '<div class="card' + (p.st === 'awake' ? ' done' : p.st === 'lost' ? ' lock' : '') + '"><span class="lb" style="color:' + col + '">' + inf.role + ' · ' + inf.age + ' anos</span><b>' + esc(inf.name) + '</b><small>' + esc(inf.why) + '</small><small><b>' + inf.trait[0] + '.</b> ' + inf.trait[1] + '</small><span class="st ' + (p.st === 'awake' ? 'ok' : p.st === 'lost' ? 'bad' : 'mid') + '">' + stt[p.st] + '</span>' +
          (p.st === 'sleep' && first && first.id !== p.id ? '<button class="bt" data-act="wake" data-a="' + p.id + '">Despertar em seguida</button>' : p.st === 'sleep' ? '<span class="st">próximo a despertar</span>' : '') + '</div>'; }).join('') + '</div>' +
        (s.nborn ? '<p>Nascidos em Marte: <b>' + s.nborn + '</b>.</p>' : ''); }
    if (kind === 'tasks') { var tk = Sim.tasks(s); return h + '<span class="lb">Fila de ações</span><h2>Tarefas</h2>' + (tk.length ? tk.map(function (t) { return '<div class="chk' + (t.state === 'Em execução' ? ' ok' : '') + '"><i></i><span><b>' + t.who + '</b> · ' + t.label + ' · ' + t.state + '</span></div>'; }).join('') : '<p>Nenhuma tarefa em andamento.</p>') +
        '<div class="row"><button class="bt' + (s.auto ? ' pri' : '') + '" data-act="auto">Trabalho automático: ' + (s.auto ? 'ligado' : 'desligado') + '</button></div><p>Ligado, quem estiver livre constrói obras pendentes, repara, planta, colhe e limpa painéis por conta própria. Comer, dormir e respirar eles sempre resolvem sozinhos.</p>'; }
    if (kind === 'menu') { var sv = latest(); return h + '<span class="lb">' + D.lore.game + '</span><h2>Missão em pausa</h2><div class="btns"><button class="bt pri" data-act="close">Voltar ao jogo</button><button class="bt" data-act="save">Salvar</button><button class="bt" data-act="load"' + (sv ? '' : ' disabled') + '>Carregar ' + (sv ? '(sol ' + sv.sol + ')' : '') + '</button><button class="bt" data-act="win" data-a="settings">Configurações</button><button class="bt" data-act="title">Sair para o título</button><button class="bt dng" data-act="wipe">' + (arg === 'wipe' ? 'Confirmar: apagar tudo' : 'Apagar missão salva') + '</button></div>' +
        '<p>O jogo salva sozinho a cada novo sol e antes de cada cena.</p><h3 class="lb">Controles</h3><p>Clique seleciona. Botão direito move ou age (no celular, toque). Arrastar move a câmera; roda do mouse aproxima; Q e E giram; botão do meio inclina. WASD ou setas também movem. Espaço pausa; 1, 2, 3 mudam a velocidade; N mostra as redes; Tab troca de personagem.</p>'; }
    if (kind === 'settings') return h + '<span class="lb">' + D.lore.game + '</span><h2>Configurações</h2>' +
      '<div class="row"><label for="sVol">Volume</label><input type="range" id="sVol" min="0" max="1" step="0.05" value="' + set.vol + '"></div><div class="row"><label for="sMus">Trilha sonora</label><input type="range" id="sMus" min="0" max="1" step="0.05" value="' + (set.mus == null ? 0.5 : set.mus) + '"></div><div class="row"><label for="sCam">Velocidade da câmera</label><input type="range" id="sCam" min="0.4" max="2.5" step="0.1" value="' + set.cam + '"></div><div class="row"><label for="sUi">Tamanho da interface</label><input type="range" id="sUi" min="0.8" max="1.4" step="0.05" value="' + set.ui + '"></div>' +
      '<div class="row"><label>Qualidade gráfica</label><span class="btns">' + [['high', 'Alta'], ['mid', 'Média'], ['low', 'Baixa']].map(function (q) { return '<button class="bt' + (set.q === q[0] ? ' pri' : '') + '" data-act="qual" data-a="' + q[0] + '">' + q[1] + '</button>'; }).join('') + '</span></div><p>A qualidade muda sombras, texturas e efeitos de luz. Ela é aplicada ao recarregar a página.</p>' +
      '<div class="btns"><button class="bt' + (set.shake ? ' pri' : '') + '" data-act="opt" data-a="shake">Tremor de tela: ' + (set.shake ? 'ligado' : 'desligado') + '</button><button class="bt' + (set.subs ? ' pri' : '') + '" data-act="opt" data-a="subs">Legendas: ' + (set.subs ? 'ligadas' : 'desligadas') + '</button></div><p>Modo para daltônicos e troca de teclas ficam para uma próxima versão.</p>';
    if (kind === 'event') { var ev = D.events.filter(function (e) { return e.id === arg; })[0]; return '<span class="lb">Sol ' + Sim.sol(s) + ' · decisão</span><h2>' + ev.title + '</h2><p>' + ev.text + '</p>' + ev.choices.map(function (c, n) { return '<button class="choice" data-act="choose" data-a="' + n + '"><b>' + c.label + '</b><small>' + c.hint + '</small></button>'; }).join(''); }
    if (kind === 'victory' || kind === 'defeat') { var win = kind === 'victory'; return '<span class="lb">' + D.lore.chapter + '</span><h2>' + (win ? 'O primeiro capítulo da história humana em outro planeta.' : 'O silêncio voltou a Marte.') + '</h2><p>' + (win ? 'Em ' + Sim.sol(s) + ' sóis, uma missão virou um lar. A Era II começa aqui: novas naves, novos colonos, uma sociedade. Esta é a crônica que os próximos vão herdar.' : 'A missão durou ' + Sim.sol(s) + ' sóis. A crônica fica; alguém vai lê-la antes de tentar de novo.') + '</p>' +
        s.chron.map(function (c) { return '<p class="ch"><small>Sol ' + c.sol + '</small>' + esc(c.text.replace(/^Sol \d+( de \d+)?\. /, '')) + '</p>'; }).join('') + '<div class="btns">' + (win ? '<button class="bt pri" data-act="close">Continuar na base</button>' : (latest() ? '<button class="bt pri" data-act="load">Carregar último salvamento</button>' : '')) + '<button class="bt" data-act="title">Voltar ao título</button></div>'; }
    return h; }
  function openWin(kind, arg) { modalKind = kind; $('modal').dataset.arg = arg || ''; $('modal').innerHTML = '<div class="win" role="dialog" aria-modal="true">' + winHTML(kind, arg) + '</div>'; $('modal').hidden = false; setPlacing(null); }
  function refreshModal() { var w = $('modal').firstChild, sc = w ? w.scrollTop : 0, h = winHTML(modalKind, $('modal').dataset.arg); if ($('modal').dataset.h === h) return; $('modal').dataset.h = h; w.innerHTML = h; w.scrollTop = sc; }
  function closeWin() { if (modalKind === 'event') return; var k = modalKind; modalKind = null; $('modal').hidden = true; $('modal').dataset.h = ''; if (mode === 'menu' && k === 'settings') return; }

  // ---------------- CENAS (animações de passagem) ----------------
  function cutTitle(t, sub) { $('cutT').textContent = t || ''; $('cutS').textContent = sub || ''; $('cutT').style.opacity = t ? 1 : 0; $('cutS').style.opacity = sub ? 1 : 0; }
  function cutLine(t) { var e = $('cutL'); if (!t) { e.style.opacity = 0; return; } e.style.opacity = 0; setTimeout(function () { e.textContent = t; e.style.opacity = 1; }, 350); }
  function black(v, fast) { var e = $('black'); e.style.transitionDuration = fast ? '0s' : '2.2s'; e.style.opacity = v; }
  function tween(to, dur) { var f = {}; for (var k in to) f[k] = W.cam[k] || 0; Cut.tw = { from: f, to: to, t0: Cut.t, dur: dur }; }
  function playCut(def) { Cut = { t: 0, i: 0, steps: def.steps.slice().sort(function (a, b) { return a.t - b.t; }), dur: def.dur, end: def.end, orbit: def.orbit || 0, upd: def.upd, restore: def.restore ? JSON.parse(JSON.stringify(W.cam)) : null };
    mode = 'cut'; $('app').classList.add('cut'); $('skip').hidden = false; setPlacing(null); }
  function cutTick(dt) { var c = Cut; c.t += dt; while (c.i < c.steps.length && c.steps[c.i].t <= c.t) c.steps[c.i++].f();
    if (c.tw) { var k = clamp((c.t - c.tw.t0) / c.tw.dur, 0, 1), e = k * k * (3 - 2 * k); for (var p in c.tw.to) W.cam[p] = c.tw.from[p] + (c.tw.to[p] - c.tw.from[p]) * e; if (k >= 1) c.tw = null; }
    if (c.orbit) W.cam.yaw += dt * c.orbit; if (c.upd) c.upd(c.t, dt); if (c.t >= c.dur) endCut(); }
  function endCut() { var c = Cut; if (!c) return; Cut = null; cutTitle(''); cutLine(''); black(0); Au.duck = 0; W.cam.lookUp = 0; $('app').classList.remove('cut'); $('skip').hidden = true; if (c.restore) { for (var k in c.restore) W.cam[k] = c.restore[k]; } mode = 'play'; if (c.end) c.end(); }
  function date() { return 'Sol ' + Sim.sol(s) + ' — Ano ' + D.lore.year; }
  function focusCut(o) { var st = [{ t: 0, f: function () { tween({ x: o.x, z: o.z, dist: o.dist, pitch: o.pitch }, 2.8); if (o.duck) Au.duck = 1; if (o.music) music(o.music); if (o.start) o.start(); } }, { t: 1.3, f: function () { cutTitle(o.title, date()); } }, { t: 5.2, f: function () { cutTitle(''); } }];
    o.lines.forEach(function (l, i) { st.push({ t: 5.8 + i * 4.6, f: function () { cutLine(l); } }); }); return { steps: st, dur: 6 + o.lines.length * 4.6, restore: true, orbit: o.orbit, end: o.end }; }
  function chronText(key) { for (var i = s.chron.length - 1; i >= 0; i--) if (s.chron[i].key === key) return s.chron[i].text.replace(/^Sol \d+( de \d+)?\. /, ''); return ''; }
  function startScene(ev) { var b = ev.b != null ? Sim.byId(s, ev.b) : null, c = b ? Sim.center(b) : { x: N / 2, z: N / 2 }; if (ev.id !== 'defeat' && ev.id !== 'intro') save('auto');
    switch (ev.id) {
      case 'firstLight': playCut(focusCut({ x: c.x, z: c.z, dist: 30, pitch: 0.3, orbit: 0.05, music: 14, title: 'Primeira Luz', lines: [chronText('firstLight'), 'O primeiro módulo é abrigo.'] })); break;
      case 'firstWater': playCut(focusCut({ x: c.x, z: c.z, dist: 15, pitch: 0.45, orbit: 0.04, music: 14, title: 'Primeira Água', lines: [chronText('firstWater'), 'A primeira fonte de água é permanência.'] })); break;
      case 'firstSprout': playCut(focusCut({ x: c.x, z: c.z, dist: 10, pitch: 0.5, orbit: 0.03, duck: true, music: 16, title: 'Primeiro Broto', lines: ['O som de fora desaparece. Uma luva toca a folha, devagar.', chronText('firstSprout'), 'A primeira planta é esperança.'] })); break;
      case 'stormStart': playCut(focusCut({ x: N / 2, z: N / 2, dist: 70, pitch: 0.22, orbit: 0.02, title: 'A Tempestade', lines: ['Uma parede de poeira do tamanho de um país.', 'Os painéis vão receber um quinto da luz. Tudo o que é externo pode quebrar.'] })); break;
      case 'stormEnd': playCut(focusCut({ x: N / 2, z: N / 2, dist: 46, pitch: 0.5, orbit: 0.04, music: 12, title: 'Depois da Poeira', lines: [chronText('stormEnd')] })); break;
      case 'landmark': playCut(focusCut({ x: c.x, z: c.z, dist: 44, pitch: 0.34, orbit: 0.07, music: 24, title: 'Era II — Posto Avançado', lines: [chronText('landmark'), 'Duas pessoas pousaram numa missão. O que existe agora é um lar.', 'O primeiro capítulo da história humana em outro planeta.'], end: function () { save('auto'); openWin('victory'); } })); break;
      case 'arrival': playArrival(c); break;
      case 'firstAwake': playCut(focusCut({ x: c.x, z: c.z, dist: 14, pitch: 0.4, orbit: 0.04, music: 14, title: 'O Primeiro Despertar', lines: [chronText('firstAwake'), 'Os despertos trabalham por conta própria: constroem juntos, coletam e cuidam da base.'] })); break;
      case 'chapter2': playCut(focusCut({ x: C0, z: C0 + 2, dist: 52, pitch: 0.42, orbit: 0.05, music: 18, title: D.lore.chapter2, lines: [chronText('awake6'), 'Três casas vizinhas formam um bairro. Com seis despertos, o Berço pode ser erguido.'] })); break;
      case 'firstBorn': playCut(focusCut({ x: c.x, z: c.z, dist: 16, pitch: 0.36, orbit: 0.04, duck: true, music: 18, title: 'Nascido em Marte', lines: [chronText('firstBorn'), 'A primeira planta foi esperança. A primeira pessoa é futuro.'] })); break;
      case 'defeat': playCut({ dur: 8, steps: [{ t: 0, f: function () { black(1); } }, { t: 2.4, f: function () { cutTitle('O silêncio voltou a Marte', date()); } }], end: function () { openWin('defeat'); } }); break;
      case 'intro': playIntro(); break; } }
  function playArrival(c) { W.arkY = 170; W.arkFlame = true; W.arkRamp = 0; playCut({ dur: 25, restore: true, steps: [
      { t: 0, f: function () { tween({ x: c.x, z: c.z, dist: 64, pitch: 0.15 }, 2.5); music(22); } }, { t: 1.2, f: function () { cutTitle('A ' + D.lore.ark, date()); } },
      { t: 5.5, f: function () { cutTitle(''); cutLine('Doze pessoas atravessaram o espaço dormindo.'); } },
      { t: 12, f: function () { W.arkFlame = false; W.arkY = 0; if (set.shake) W.shake = 3; sfx('thud'); tween({ dist: 36, pitch: 0.4 }, 4); cutLine(chronText('arkLanded')); } },
      { t: 18.5, f: function () { cutLine('Cada leito livre acorda mais um. Casas vizinhas viram bairros.'); } }],
      upd: function (t) { if (t > 14.5) { if (W.arkRamp === 0) sfx('hydraulic'); W.arkRamp = Math.max(0.001, Math.min(1, (t - 14.5) / 3.2)); } if (t < 12) { var k = t / 12; W.arkY = 170 * Math.pow(1 - k, 1.8); W.cam.lookUp = W.arkY * 0.8; if (set.shake) W.shake = Math.max(W.shake, 0.1 + k * 0.5); } else W.cam.lookUp *= 0.9; },
      end: function () { W.arkY = 0; W.arkFlame = false; W.arkRamp = 1; W.cam.lookUp = 0; toast('A ' + D.lore.ark + ' pousou. Abra Colonos para ver quem desperta'); } }); }
  function playIntro() { W.hideChars = true; W.landerY = 170; W.flame = true; W.landerRamp = 0; black(1, true); var gp = { x: C0, z: C0 + 1.5, dist: 34, yaw: 0.5, pitch: 0.82 }; W.cam.x = C0; W.cam.z = C0 + 0.5; W.cam.dist = 62; W.cam.yaw = 1.1; W.cam.pitch = 0.14;
    playCut({ dur: 46, steps: [
      { t: 0.6, f: function () { cutTitle(String(D.lore.year)); } },
      { t: 4, f: function () { cutLine('A ' + D.lore.company + ', uma empresa privada, fez o que nenhuma agência conseguiu.'); } },
      { t: 8.4, f: function () { cutLine('Duas pessoas embarcaram na ' + D.lore.ship + ' para se tornarem os primeiros humanos interplanetários.'); } },
      { t: 13, f: function () { cutLine('Não há viagem de volta marcada.'); } },
      { t: 16.5, f: function () { cutTitle(''); sfx('radio'); cutLine('Controle ' + D.lore.company + ', com doze minutos de atraso: ' + D.lore.ship + ', a partir daqui é com vocês.'); } },
      { t: 19, f: function () { black(0); } }, { t: 21.5, f: function () { cutLine(''); } },
      { t: 29, f: function () { W.flame = false; W.landerY = 0; if (set.shake) W.shake = 3; sfx('thud'); } },
      { t: 30.5, f: function () { sfx('hydraulic'); } },
      { t: 34, f: function () { W.hideChars = false; tween({ x: C0 + 1.6, z: C0 + 2.2, dist: 13, pitch: 0.22, yaw: 0.3 }, 3.5); } },
      { t: 35, f: function () { cutLine('Elias: Então é aqui.'); } }, { t: 38, f: function () { cutLine('Helena: Agora é.'); } },
      { t: 40.5, f: function () { cutLine(''); music(14); cutTitle(D.lore.game, D.lore.chapter + ' · Sol 1, ' + D.lore.year); tween(gp, 5); } } ],
      upd: function (t) { if (t > 19 && t < 29) { var k = (t - 19) / 10; W.landerY = 170 * Math.pow(1 - k, 1.8); W.cam.lookUp = W.landerY * 0.85; if (set.shake) W.shake = Math.max(W.shake, 0.12 + k * 0.5); if (Au.ctx) Au.wind.gain.setTargetAtTime(0.1 + k * 0.5, Au.ctx.currentTime, 0.2); } else if (t >= 29 && t < 34) W.cam.lookUp *= 0.9; if (t > 30.5) W.landerRamp = Math.min(1, (t - 30.5) / 3.2); },
      end: function () { W.hideChars = false; W.flame = false; W.landerY = 0; W.landerRamp = 1; for (var k in gp) W.cam[k] = gp[k]; W.cam.lookUp = 0; save('auto'); toast('Selecione Elias e clique com o botão direito no módulo de pouso'); } }); }
  function showSub(dtm) { if (subsT > 0) { subsT -= dtm; if (subsT <= 0) $('subs').innerHTML = ''; return; } if (!subsQ.length) return; var l = subsQ.shift(); if (set.subs) $('subs').innerHTML = '<b>' + D.chars[l[0]].short + '</b>' + esc(l[1]); sfx('radio'); subsT = 2.2 + l[1].length * 0.045; }

  // ---------------- AÇÕES ----------------
  function copyB(id) { var b = Sim.byId(s, id); if (!b) return; var d = BD[b.type]; if (b.type === 'lander' || b.type === 'pad' || d.landmark || d.unique) { toast('Esta construção é única'); return; } setSel({}); setPlacing(b.type); toast('Posicione outra ' + d.name.toLowerCase() + '. Esc cancela'); }
  function setPlacing(t) { placing = t; W.setGhost(t); $('tip').hidden = true; itemSig = ''; }
  function setSel(o) { sel = { c: o.c || [], b: o.b != null ? o.b : null, d: o.d != null ? o.d : null }; demo = null; W.selB = sel.b; W.selected = {}; sel.c.forEach(function (k) { W.selected[k] = 1; }); sideSig = ''; }
  function bestChar(pref) { if (sel.c.length) return s.chars[sel.c[0]]; var a = s.chars[pref], o = s.chars[pref === 'helena' ? 'elias' : 'helena']; if (a.alive && a.critical <= 0) return a; if (o.alive && o.critical <= 0) return o; for (var k in s.chars) if (s.chars[k].alive && s.chars[k].critical <= 0) return s.chars[k]; return a; }
  function nearest(c) { var b = null, bd = 1e9; for (var k in s.chars) { var o = s.chars[k]; if (o === c || !o.alive) continue; var d = Math.hypot(o.x - c.x, o.z - c.z); if (d < bd) { bd = d; b = o; } } return b; }
  function doOrder(c, tg, q) { var r = Sim.order(s, c.id, tg, q); toast(Sim.cinfo(c.id).short + ': ' + r.msg); sfx(r.ok ? 'ok' : 'warn'); return r; }
  function act(a, el) { var d = el.dataset, c, b, r;
    switch (a) {
      case 'spd': if (+d.a === 0) paused = !paused; else { speed = +d.a; paused = false; } break;
      case 'win': openWin(d.a); break; case 'close': modalKind = null; $('modal').hidden = true; $('modal').dataset.h = ''; break;
      case 'net': W.setOverlay(!W.overlayOn, s); toast(W.overlayOn ? 'Redes: amarelo liga energia, azul é área pressurizada, vermelho está parado' : 'Redes ocultas'); break;
      case 'cat': cat = cat === d.a ? null : d.a; if (bqv) { bqv = ''; $('bq').value = ''; } setPlacing(null); var cb = $('cats').children; for (var i = 0; i < cb.length; i++) cb[i].className = cb[i].dataset.a === cat ? 'on' : ''; break;
      case 'build': setPlacing(placing === d.a ? null : d.a); if (placing) toast('Clique no terreno para posicionar. Esc ou botão direito cancela'); break;
      case 'selc': if (sel.c.length === 1 && sel.c[0] === d.a) { W.cam.x = s.chars[d.a].x; W.cam.z = s.chars[d.a].z; } setSel({ c: [d.a] }); break;
      case 'selall': var all = Object.keys(s.chars).filter(function (k) { return s.chars[k].alive && s.chars[k].critical <= 0; }); setSel({ c: all }); toast(all.length + ' selecionados'); break;
      case 'wake': Sim.wakeNext(s, d.a); refreshModal(); break;
      case 'focus': c = s.chars[sel.c[0]]; if (c) { W.cam.x = c.x; W.cam.z = c.z; } break;
      case 'co': sel.c.forEach(function (id) { c = s.chars[id]; if (d.a === 'stop') { c.queue = []; c.act = null; c.sleeping = false; toast(Sim.cinfo(id).short + ': parado'); return; }
          if (d.a === 'talk') { var nr = nearest(c); if (nr) doOrder(c, { kind: 'c', id: nr.id }); return; } if (d.a === 'contemplate') { doOrder(c, { type: 'contemplate', kind: 'here' }); return; }
          var hb = Sim.ofType(s, 'habitat', true).filter(function (h) { return h.on; })[0] || s.b[0]; doOrder(c, { type: d.a, kind: 'b', id: hb.id }); }); break;
      case 'bo': b = Sim.byId(s, sel.b); if (!b) break; c = bestChar(d.a === 'research' || d.a === 'build' || d.a === 'repair' || d.a === 'harvest' ? 'helena' : 'elias'); var o = { type: d.a, kind: 'b', id: b.id }; if (d.b != null) o.plot = +d.b; doOrder(c, o); break;
      case 'plant': r = Sim.plant(s, sel.b, +d.a, d.b); toast(r.msg); sfx(r.ok ? 'ok' : 'warn'); break;
      case 'toggle': b = Sim.byId(s, sel.b); if (b) b.off = !b.off; break;
      case 'upgrade': r = Sim.upgrade(s, sel.b); toast(r.msg); sfx(r.ok ? 'ok' : 'warn'); break;
      case 'copy': copyB(sel.b); break;
      case 'shift': s.nightShift = !s.nightShift; toast(s.nightShift ? 'Turno da noite ligado: metade dos colonos trabalha à noite' : 'Turno da noite desligado: todos descansam à noite'); refreshModal(); break;
      case 'demo': if (demo === sel.b) { Sim.demolish(s, sel.b); setSel({}); sfx('drop'); } else demo = sel.b; break;
      case 'gather': doOrder(s.chars[d.a], { kind: 'd', id: sel.d }); break;
      case 'tech': r = Sim.buyTech(s, d.a); toast(r.msg); refreshModal(); break;
      case 'auto': s.auto = !s.auto; refreshModal(); break;
      case 'choose': Sim.choose(s, +d.a); modalKind = null; $('modal').hidden = true; break;
      case 'save': save('manual'); break; case 'load': var sv = latest(); if (sv) { modalKind = null; $('modal').hidden = true; loadGame(sv); } break;
      case 'wipe': if ($('modal').dataset.arg === 'wipe') { lsDel('gm_auto'); lsDel('gm_manual'); toast('Missão salva apagada'); openWin('menu'); } else openWin('menu', 'wipe'); break;
      case 'title': modalKind = null; $('modal').hidden = true; toTitle(); break;
      case 'opt': set[d.a] = !set[d.a]; saveSettings(); openWin('settings'); break;
      case 'qual': set.q = d.a; saveSettings(); openWin('settings'); toast('Qualidade salva. Recarregue a página para aplicar'); break;
    } hudAcc = 1; }

  // ---------------- ENTRADA ----------------
  function tileFor(type, p) { var d = BD[type]; return { x: Math.floor(p.x - d.w / 2 + 0.5), z: Math.floor(p.z - d.h / 2 + 0.5) }; }
  function hoverPlace(px, py) { var p = W.pick(px, py, s); if (!p || p.x == null) return null; var t = tileFor(placing, p), r = Sim.canPlace(s, placing, t.x, t.z); W.moveGhost(t.x, t.z, r.ok);
    var tip = $('tip'), rc = $('app').getBoundingClientRect(); tip.hidden = false; tip.textContent = r.reason; tip.className = 'pn ' + (r.ok ? 'ok' : 'bad'); tip.style.left = Math.min(px - rc.left, rc.width - 260) + 'px'; tip.style.top = (py - rc.top) + 'px'; return { t: t, r: r }; }
  function clickAt(px, py, right, shift, touch) { if (mode !== 'play') return; var p;
    if (placing) { if (right) { setPlacing(null); return; } var h = hoverPlace(px, py); if (!h) return; if (!h.r.ok) { toast(h.r.reason); sfx('warn'); return; } var type = placing, res = Sim.place(s, type, h.t.x, h.t.z);
      if (res.ok) { if (!(shift || type === 'solar' || type === 'corridor' || type === 'poste' || type === 'casa')) setPlacing(null); else hoverPlace(px, py); } return; }
    p = W.pick(px, py, s); if (!p) return;
    var orderNow = right || (touch && sel.c.length && p.kind !== 'c');
    if (orderNow) { if (!sel.c.length) { if (p.kind === 'b' && right) { copyB(p.id); return; } toast('Selecione alguém primeiro'); return; } sel.c.forEach(function (id, i) { if (!s.chars[id]) return; var tg = { kind: p.kind, id: p.id, x: p.x + (i % 4) * 0.9, z: p.z + Math.floor(i / 4) * 0.9 }; if (p.kind === 'c' && p.id === id) return; doOrder(s.chars[id], tg, shift); }); return; }
    if (p.kind === 'c') { var cur = sel.c.slice(); if (shift && cur.indexOf(p.id) < 0) cur.push(p.id); else cur = [p.id]; setSel({ c: cur }); sfx('ok'); }
    else if (p.kind === 'b') setSel({ b: p.id }); else if (p.kind === 'd') setSel({ d: p.id }); else setSel({}); hudAcc = 1; }
  function bindInput() { var cv = $('gl'), pts = {};
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('pointerdown', function (e) { if (e.button === 1) e.preventDefault(); cv.focus(); auInit(); pts[e.pointerId] = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (x) { }
      var n = Object.keys(pts).length; if (n === 2) { var a = Object.keys(pts).map(function (k) { return pts[k]; }); pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), dist: W.cam.dist }; ptr = null; return; }
      ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, btn: e.button, drag: false, touch: e.pointerType === 'touch', shift: e.shiftKey }; });
    cv.addEventListener('pointermove', function (e) { if (pts[e.pointerId]) { pts[e.pointerId].x = e.clientX; pts[e.pointerId].y = e.clientY; }
      if (pinch) { var a = Object.keys(pts).map(function (k) { return pts[k]; }); if (a.length === 2) W.cam.dist = pinch.dist * pinch.d / Math.max(20, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)); return; }
      if (mode === 'play' && placing && (!ptr || !ptr.drag)) hoverPlace(e.clientX, e.clientY);
      if (!ptr || ptr.id !== e.pointerId || mode !== 'play') return; var dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; ptr.x = e.clientX; ptr.y = e.clientY;
      if (!ptr.drag && Math.hypot(e.clientX - ptr.x0, e.clientY - ptr.y0) > 7) ptr.drag = true; if (!ptr.drag) return;
      if (ptr.btn === 1) { W.cam.yaw -= dx * 0.006; W.cam.pitch += dy * 0.005; }
      else if (ptr.btn === 0) { var k = W.cam.dist / cv.clientHeight * 0.55, cy = Math.cos(W.cam.yaw), sy = Math.sin(W.cam.yaw); W.cam.x -= (dx * cy + dy * sy) * k; W.cam.z -= (-dx * sy + dy * cy) * k; } });
    function up(e) { delete pts[e.pointerId]; if (pinch) { if (Object.keys(pts).length < 2) pinch = null; ptr = null; return; } if (!ptr || ptr.id !== e.pointerId) return; var p = ptr; ptr = null; if (!p.drag && e.type === 'pointerup' && p.btn !== 1) clickAt(e.clientX, e.clientY, p.btn === 2, p.shift || e.shiftKey, p.touch); }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function (e) { e.preventDefault(); if (mode === 'play') W.cam.dist *= e.deltaY > 0 ? 1.1 : 0.9; }, { passive: false });
    window.addEventListener('keydown', function (e) { if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; var k = e.key.toLowerCase(); keys[k] = true;
      if (k === 'escape') { if (placing) setPlacing(null); else if (modalKind && modalKind !== 'event' && modalKind !== 'victory' && modalKind !== 'defeat') { modalKind = null; $('modal').hidden = true; } else if (mode === 'play' && !modalKind) openWin('menu'); return; }
      if (mode !== 'play' || modalKind) return;
      if (k === ' ') { paused = !paused; e.preventDefault(); } else if (k === '1') { speed = 1; paused = false; } else if (k === '2') { speed = 2; paused = false; } else if (k === '3') { speed = 4; paused = false; }
      else if (k === 'c' && sel.b != null) copyB(sel.b); else if (k === 'n') act('net', $('bNet')); else if (k === 'tab') { e.preventDefault(); var ids = Object.keys(s.chars), n = ids.indexOf(sel.c[0]); setSel({ c: [ids[(n + 1) % ids.length]] }); } hudAcc = 1; });
    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; }); window.addEventListener('blur', function () { keys = {}; });
    window.addEventListener('resize', function () { W.resize(); });
    document.addEventListener('click', function (e) { var el = e.target.closest ? e.target.closest('[data-act]') : null; if (!el || el.disabled) return; auInit(); act(el.dataset.act, el); });
    document.addEventListener('input', function (e) { var id = e.target.id; if (id === 'sVol') set.vol = +e.target.value; else if (id === 'sMus') set.mus = +e.target.value; else if (id === 'sCam') set.cam = +e.target.value; else if (id === 'sUi') set.ui = +e.target.value; else return; saveSettings(); });
    $('skip').onclick = function () { endCut(); };
    $('mNew').onclick = function () { auInit(); $('menu').hidden = true; s = Sim.newGame(D.lore.year); W.rebuild(s); enterPlay(); startScene({ id: 'intro' }); };
    $('mCont').onclick = function () { var sv = latest(); if (!sv) return; auInit(); $('menu').hidden = true; loadGame(sv); };
    $('mSet').onclick = function () { openWin('settings'); };
  }
  function camKeys(dt) { var c = W.cam, v = c.dist * 0.42 * set.cam * dt, f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0), r = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    c.x += (-sy * f + cy * r) * v; c.z += (-cy * f - sy * r) * v; if (keys.q) c.yaw += dt * 1.4; if (keys.e) c.yaw -= dt * 1.4; }

  // ---------------- LAÇO ----------------
  function enterPlay() { mode = 'play'; paused = false; speed = 1; scenes = []; subsQ = []; setSel({}); cat = null; $('hud').hidden = false; $('menu').hidden = true; $('alerts').innerHTML = ''; W.hideChars = false; W.landerY = 0; W.flame = false; W.arkY = 0; W.arkFlame = false; W.landerRamp = 1; W.arkRamp = 1; W.cam.x = C0; W.cam.z = C0 + 1.5; W.cam.dist = 34; W.cam.yaw = 0.5; W.cam.pitch = 0.82; W.cam.lookUp = 0; hudAcc = 1; crewSig = ''; if (s.pending) openWin('event', s.pending); if (s.lost) openWin('defeat'); }
  function toTitle() { mode = 'menu'; $('hud').hidden = true; $('menu').hidden = false; setPlacing(null); W.setOverlay(false, s); refreshMenu(); W.cam.dist = 48; W.cam.pitch = 0.3; }
  function refreshMenu() { var sv = latest(); $('mCont').disabled = !sv; $('menuNote').textContent = sv ? 'Missão salva no sol ' + sv.sol + '.' : 'Nenhuma missão salva neste navegador.'; }
  function drain() { var out = s.rt.out; if (!out.length) return; var list = out.slice(); out.length = 0; list.forEach(function (o) {
      if (o.type === 'alert') pushAlert(o); else if (o.type === 'sound') sfx(o.id); else if (o.type === 'dialogue') o.lines.forEach(function (l) { subsQ.push(l); }); else if (o.type === 'scene') scenes.push(o);
      else if (o.type === 'event') { openWin('event', o.id); sfx('alarm'); } else if (o.type === 'chron') chronNew = true; else if (o.type === 'pop') crewSig = ''; else if (o.type === 'shake') W.shake = 0.6; else if (o.type === 'newSol') { save('auto'); toast('Sol ' + Sim.sol(s) + '. Missão salva'); } }); }
  function frame(ts) { requestAnimationFrame(frame); var dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts;
    try {
      if (mode === 'menu') { W.cam.yaw += dt * 0.025; }
      else if (mode === 'cut') { cutTick(dt); }
      else { camKeys(dt); if (!paused && !modalKind) { var n = speed > 2 ? 2 : 1; for (var i = 0; i < n; i++) Sim.tick(s, dt * speed / n); showSub(dt); } drain();
        if (!modalKind && scenes.length && mode === 'play') startScene(scenes.shift());
        hudAcc += dt; if (hudAcc > 0.22) { hudAcc = 0; updateHUD(); } nameplate(); if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').hidden = true; } }
      auUpdate(); W.sync(s, dt);
    } catch (e) { fail(e); } }
  function nameplate() { var e = $('np'), id = sel.c[0], c = id && s.chars[id]; if (!c || !c.alive || (c.inside != null && c.critical <= 0) || W.hideChars) { e.hidden = true; return; }
    var p = W.screenPos(c.x, c.z, 2.5); if (!p.vis) { e.hidden = true; return; } e.hidden = false; e.textContent = Sim.cinfo(id).short + (sel.c.length > 1 ? ' +' + (sel.c.length - 1) : '') + (c.act ? ' · ' + Sim.LABEL[c.act.type] : ''); e.style.transform = 'translate(' + Math.round(p.x) + 'px,' + Math.round(p.y) + 'px) translate(-50%,-100%)'; }
  function fail(e) { var el = $('err'); if (!el.hidden) return; el.hidden = false; el.textContent = 'Algo quebrou no jogo: ' + (e && e.message ? e.message : e) + '. Recarregue a página; o último salvamento automático continua guardado.'; if (window.console) console.error(e); }
  function boot(data) { var j = lsGet('gm_set'); if (j) { try { var o = JSON.parse(j); for (var k in o) if (k in set) set[k] = o[k]; } catch (e) { } } applySettings();
    $('mTitle').textContent = D.lore.game; $('mKicker').textContent = D.lore.year + ' · ' + D.lore.company + ' · missão ' + D.lore.ship; document.title = D.lore.game;
    if (typeof THREE === 'undefined') { $('menu').hidden = false; fail(new Error('a biblioteca 3D não carregou (verifique a conexão)')); return; }
    try { W.init($('gl'), set.q); s = Sim.newGame(D.lore.year); W.rebuild(s); } catch (e) { fail(new Error('este navegador não conseguiu iniciar os gráficos 3D (WebGL): ' + e.message)); return; }
    buildHUD(); bindInput(); toTitle();
    if (data && data.save) { try { s = Sim.deserialize(data.save); W.rebuild(s); enterPlay(); } catch (e) { } }
    requestAnimationFrame(frame); }
  var hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(function () { return mode === 'menu' || !s || s.lost ? {} : { save: Sim.serialize(s) }; });
  if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
  return { ffCut: function (t) { while (Cut && Cut.t < t) cutTick(0.1); }, state: function () { return s; }, act: act, openWin: openWin, startScene: startScene, endCut: endCut, mode: function () { return mode; } };
})();
