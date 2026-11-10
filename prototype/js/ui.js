/* =====================================================================
   Kineta — интерфейс: роутер с анимированными переходами, экраны,
   шиты, тосты, конфетти, миссии и достижения.
   ===================================================================== */

/* ---------------- Миссии дня (пул 14 типов, 3 в день) ---------------- */
const MISSIONS = [
  { id: 'games2', t: 'Сыграй 2 игры', n: 2, ev: 'game', ic: 'game' },
  { id: 'grip30', t: 'Сделай 30 захватов протезом', n: 30, ev: 'grip', ic: 'hand' },
  { id: 'pure80', t: 'Чистота сигнала ≥ 80% в игре', n: 1, ev: 'pure80', ic: 'spark' },
  { id: 'newg', t: 'Создай собственный жест', n: 1, ev: 'gesture:new', ic: 'edit' },
  { id: 'switch5', t: 'Переключи жест со-сокращением 5 раз', n: 5, ev: 'switch', ic: 'swap' },
  { id: 'calib', t: 'Пройди калибровку датчиков', n: 1, ev: 'calib', ic: 'calib' },
  { id: 'min10', t: 'Тренируйся 10 минут', n: 10, ev: 'minute', ic: 'clock' },
  { id: 'stars3', t: 'Получи 3 звезды в любой игре', n: 1, ev: 'stars3', ic: 'star' },
  { id: 'record', t: 'Побей личный рекорд', n: 1, ev: 'record', ic: 'trophy' },
  { id: 'flap10', t: 'Пролети 10 ворот в «Искре»', n: 10, ev: 'flap:gate', ic: 'bird' },
  { id: 'combo15', t: 'Комбо ×15 в «Ритм-пульсе»', n: 1, ev: 'rhythm:combo15', ic: 'music' },
  { id: 'fish3', t: 'Поймай 3 рыбы', n: 3, ev: 'fish:catch', ic: 'fish' },
  { id: 'mug3', t: 'Донеси 3 кружки, не пролив', n: 3, ev: 'mug:deliver', ic: 'cup' },
  { id: 'blind8', t: 'Выполни 8 команд в игре «Без экрана»', n: 8, ev: 'blind:ok', ic: 'ear' },
  { id: 'react', t: 'Средняя реакция быстрее 450 мс', n: 1, ev: 'react:fast', ic: 'bolt' },
  { id: 'race1k', t: 'Проедь 1000 м без аварий', n: 1, ev: 'race:clean1k', ic: 'car' }
];
const Mission = {
  ensure() {
    // миссии из старой версии, которых больше нет в пуле, — набор дня строится заново
    const d = dayKey(); if (S.missions?.day === d && S.missions.list?.length === 3 && S.missions.list.every(m => MISSIONS.some(x => x.id === m.id))) return;
    let h = 0; for (const c of d) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const pool = MISSIONS.map(m => m.id), list = [];
    while (list.length < 3) { h = (h * 1103515245 + 12345) >>> 0; const id = pool.splice(h % pool.length, 1)[0]; list.push({ id, p: 0, done: false }); }
    S.missions = { day: d, list }; save();
  },
  ev(type, k = 1) {
    if (App.cur?.name === 'play' && SCR.play.p?.duel) return; // ход гостя в дуэли
    this.ensure();
    S.missions.list.forEach(m => {
      const def = MISSIONS.find(x => x.id === m.id); if (!def || m.done || def.ev !== type) return;
      m.p = Math.min(def.n, m.p + k);
      if (m.p >= def.n) { m.done = true; addXP(60); reward('target', 'Миссия выполнена', def.t + ' · +60 XP', 60); Workshop.add('миссия дня'); }
    });
    save();
  }
};
Bus.on('gesture:count', () => Mission.ev('grip'));
Bus.on('switch', () => Mission.ev('switch'));

/* ---------------- Единый визуальный язык: линейная иконка в пастельном кружке ---------------- */
const TONES = ['peach', 'sky', 'mint', 'lilac', 'sun', 'rose'];
const badge = (icon, tone = 'peach', cls = '') => `<span class="bdg t-${tone} i-${tone} ${cls}">${ic(icon)}</span>`;
const gIcon = (id, cls = '') => badge(GAMES[id].ic, GAMES[id].tone, cls);
const battTxt = () => S.device.battery == null ? '—' : S.device.battery + '%';
const pillHTML = (d = S.device) => `<i class="led ${d.connected ? '' : 'off'}"></i><span class="pill-name">${d.connected ? (d.real ? 'Протез' : 'Демо') : 'Нет связи'}</span>${d.connected ? '· ' + battTxt() : ''}`;
const brand = () => `<span class="brand"><span class="bm">${ic('hand', '', 2.2)}</span>kineta</span>`;

/* ---------------- XP, уровни, достижения ---------------- */
const plvl = (xp = S.profile.xp) => Math.floor(Math.sqrt(xp / 100)) + 1;
const xpFor = l => (l - 1) * (l - 1) * 100;
/* Награды: во время игры не отвлекаем — копим и показываем на экране результата */
const Rewards = { list: [] };
function reward(icon, title, sub, conf = 60) {
  if (App.cur?.name === 'play') { Rewards.list.push({ icon, title, sub }); return; }
  toast(icon, title, sub); if (conf) confetti(conf);
}
function addXP(n) { const l0 = plvl(); S.profile.xp += n; save(); if (plvl() > l0) reward('star', 'Новый ранг игрока: ' + plvl(), 'Опыт копится за любые тренировки', 100); }
const playedGames = () => ARCADE().filter(g => S.games[g]?.plays);
const ACH = [
  { id: 'first', icon: 'play', t: 'Первые шаги', d: 'Сыграй первую игру', p: () => [Math.min(1, S.history.filter(h => !h.seed).length), 1] },
  { id: 'calib', icon: 'calib', t: 'Настроено', d: 'Откалибруй датчики', p: () => [S.calib.done ? 1 : 0, 1] },
  { id: 'maker', icon: 'edit', t: 'Конструктор', d: 'Создай свой жест', p: () => [Math.min(1, S.gestures.filter(g => !g.builtin).length), 1] },
  { id: 'rot5', icon: 'layers', t: 'Ротация', d: '5 жестов в ротации', p: () => [Math.min(5, S.rotation.length), 5] },
  { id: 'clean', icon: 'spark', t: 'Чистый сигнал', d: 'Чистота ≥ 90% в пройденном уровне', p: () => [S.history.some(h => !h.seed && h.purity >= 90 && h.acc >= 60 && h.stars >= 1) ? 1 : 0, 1] },
  { id: 'all', icon: 'game', t: 'Игроман', get d() { return `Сыграй во все ${ARCADE().length} игр`; }, p: () => [playedGames().length, ARCADE().length] },
  { id: 'streak7', icon: 'flame', t: 'Неделя силы', d: 'Серия 7 дней', p: () => [Math.min(7, S.profile.streak), 7] },
  { id: 'g1000', icon: 'hand', t: 'Тысяча хватов', d: '1000 активаций жестов', p: () => [Math.min(1000, S.stats.gestLive || 0), 1000] },
  { id: 'fast', icon: 'bolt', t: 'Молния', d: 'Реакция быстрее 350 мс', p: () => [S.history.some(h => h.react && h.react < 350) ? 1 : 0, 1] },
  { id: 'stars', icon: 'star', t: 'Звездочёт', d: '3 звезды в 5 играх', p: () => [Math.min(5, ARCADE().filter(id => S.games[id]?.stars >= 3).length), 5] },
  { id: 'pilot', icon: 'bird', t: 'Пилот', d: '3000 очков в «Искре»', p: () => [Math.min(3000, S.games.flap?.best || 0), 3000] },
  { id: 'expert', icon: 'trophy', t: 'Эксперт', d: 'Ранг игрока 10', p: () => [Math.min(10, plvl()), 10] },
  // финал основного сценария: все уровни всех игр пройдены хотя бы на одну звезду — дальше бесконечный режим и недели
  { id: 'master', icon: 'shield', t: 'Мастер управления', get d() { return `Пройди все ${ARCADE().length * 3} уровней`; }, p: () => [ARCADE().reduce((a, id) => a + gst(id).ls.filter(x => x >= 1).length, 0), ARCADE().length * 3] }
];
function checkAch() {
  ACH.forEach(a => { const [c, n] = a.p(); if (c >= n && !S.ach[a.id]) { S.ach[a.id] = Date.now(); addXP(100); reward(a.icon, 'Достижение: ' + a.t, a.d + ' · +100 XP', 90); } });
  save();
}

/* ---------------- Тосты, рябь, конфетти ---------------- */
/* Тосты идут очередью: не больше двух на экране, без «лавины» */
const TQ = { q: [], live: 0 };
function toast(icon, title, sub = '') {
  const key = title + '|' + sub; if (TQ.q.some(t => t.key === key)) return;
  TQ.q.push({ icon, title, sub, key }); if (TQ.q.length > 4) TQ.q.splice(0, TQ.q.length - 4); pumpToasts();
}
function pumpToasts() {
  if (TQ.live >= 2 || !TQ.q.length) return;
  const { icon, title, sub } = TQ.q.shift(), el = document.createElement('div'); el.className = 'toast'; TQ.live++;
  const n = IC[icon] ? icon : 'star';
  el.innerHTML = `<div class="ti">${ic(n)}</div><div>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  // на обычных экранах уведомления снизу над вкладками, чтобы не закрывать заголовок; в игре — сверху, чтобы не закрывать панели К1/К2
  const box = $('#toasts'), ph = $('#phone'), vw = $('#view');
  if (App.cur && !App.cur.sc.full && ph && vw) { box.classList.add('bot'); box.style.bottom = Math.max(10, ph.getBoundingClientRect().bottom - vw.getBoundingClientRect().bottom + 10) + 'px'; }
  else { box.classList.remove('bot'); box.style.bottom = ''; }
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); TQ.live--; pumpToasts(); }, 260); }, 2600);
}
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.btn,.chipbtn,.seg button,.presets button,.perm button.go'); if (!b) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), sp = document.createElement('span');
  sp.className = 'ripple'; sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  if (getComputedStyle(b).position === 'static') b.style.position = 'relative'; b.style.overflow = 'hidden';
  b.appendChild(sp); setTimeout(() => sp.remove(), 650); Snd.init(); Snd.tap();
});
const FXC = { parts: [] };
let lastConf = 0;
function confetti(n = 100, x, y) {
  const now = performance.now(); if (now - lastConf < 1500) return; lastConf = now; n = Math.min(n, 90);
  const cv = $('#fx'), W = cv.offsetWidth, H = cv.offsetHeight, cols = ['#F27D45', '#FFC24B', '#7FD3A8', '#86C5F0', '#E995B6', '#B79CF0'];
  for (let i = 0; i < n; i++) FXC.parts.push({ x: x ?? W / 2 + rnd(-60, 60), y: y ?? H * .3, vx: rnd(-280, 280), vy: rnd(-520, -150), r: rnd(4, 8), c: pick(cols), a: rnd(0, 6), va: rnd(-8, 8), life: rnd(1.6, 2.6), sh: Math.random() < .5 });
}
function drawFX(dt) {
  const cv = $('#fx'); if (!FXC.parts.length) { if (cv._dirty) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); cv._dirty = false; } return; }
  const dpr = devicePixelRatio || 1, W = cv.offsetWidth, H = cv.offsetHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); cv._dirty = true;
  FXC.parts = FXC.parts.filter(p => (p.life -= dt) > 0);
  FXC.parts.forEach(p => {
    p.vy += 700 * dt; p.vx *= .99; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
    ctx.save(); ctx.globalAlpha = clamp(p.life); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
    if (p.sh) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); else { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.5, 0, 7); ctx.fill(); }
    ctx.restore();
  });
}

/* ---------------- Шиты и модалки ---------------- */
function sheet(html, onMount, opt = {}) {
  const ph = $('#phone'), sc = document.createElement('div'), sh = document.createElement('div');
  sc.className = 'scrim'; sh.className = 'sheet'; sh.innerHTML = `<div class="grab"></div>${html}`;
  ph.append(sc, sh);
  const close = () => { if (sh._closing) return; sh._closing = true; sc.classList.add('out'); sh.classList.add('out'); setTimeout(() => { sc.remove(); sh.remove(); opt.onClose?.(); }, 300); };
  sc.onclick = close;
  // закрытие перетаскиванием за «ручку»
  const grab = $('.grab', sh); let y0 = null;
  grab.addEventListener('pointerdown', e => { y0 = e.clientY; grab.setPointerCapture(e.pointerId); sh.style.transition = 'none'; });
  grab.addEventListener('pointermove', e => { if (y0 != null) sh.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)`; });
  grab.addEventListener('pointerup', e => { const d = e.clientY - y0; y0 = null; sh.style.transition = 'transform .3s'; if (d > 90) close(); else sh.style.transform = ''; });
  sh.close = close; onMount?.(sh, close); animateIn(sh);
  return sh;
}
function modal(html, onMount) {
  const ph = $('#phone'), sc = document.createElement('div'), m = document.createElement('div');
  sc.className = 'scrim'; m.className = 'modal'; m.innerHTML = html; ph.append(sc, m);
  const close = () => { sc.classList.add('out'); m.style.animation = 'fade .2s reverse both'; setTimeout(() => { sc.remove(); m.remove(); }, 220); };
  m.close = close; onMount?.(m, close); return m;
}

/* ---------------- Сеансы и время тренировки ---------------- */
const Session = { playS: 0, minuteAcc: 0, warned: false };
function addTrainTime(dt) {
  Session.playS += dt; Session.minuteAcc += dt;
  if (Session.minuteAcc >= 60) { Session.minuteAcc -= 60; today().min++; Mission.ev('minute'); save(); }
  if (Session.playS > (C().sessionMin || 10) * 60 && !Session.warned) {
    Session.warned = true; const pl = App.cur?.name === 'play' ? SCR.play : null;
    if (pl) { pl.paused = true; restModal(() => pl.countdown(App.cur.el), () => App.go('games', {}, { back: true })); } else restModal();
  }
}
/* почему предлагаем отдых: по времени сеанса или по признакам утомления */
function restWhy() { return Session.fatigue ? 'Сила сокращений к концу игры заметно упала — мышцы культи устали. Короткая пауза сохранит качество сигнала.' : `Ты тренируешься больше ${C().sessionMin || 10} минут. Мышцы культи устают — короткая пауза сохранит качество сигнала.`; }
function restModal(onGo, onExit) {
  modal(`${badge('heart', 'rose', 'xl')}<div style="font-size:19px;font-weight:800;margin-top:10px">Пора отдохнуть</div><p class="sub" style="margin:6px 0 12px">${restWhy()}</p>
    <div class="big-ring"><div class="c"><div><b id="brN">30</b><small class="muted">вдох-выдох</small></div></div></div>
    <button class="btn" data-x="go">${onGo ? 'Продолжить' : 'Хорошо'}</button>${onExit ? '<button class="btn ghost" data-x="ex" style="margin-top:8px">Закончить на сегодня</button>' : ''}`, (m, close) => {
    let n = 30; const t = setInterval(() => { n = Math.max(0, n - 1); const b = $('#brN', m); if (b) b.textContent = n; if (!n) clearInterval(t); }, 1000);
    m.onclick = e => { const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return; clearInterval(t); close(); (x === 'go' ? onGo : onExit)?.(); };
  });
}

/* ---------------- Сигнальный буфер для графиков ---------------- */
const Sig = { buf: [], push() { this.buf.push([Ctrl.a[0], Ctrl.a[1], Ctrl.state]); if (this.buf.length > 900) this.buf.shift(); } };
function drawTrace(cv, n = 300, opt = {}) {
  if (!cv || !cv.offsetWidth) return;
  const dpr = devicePixelRatio || 1, W = cv.offsetWidth, H = cv.offsetHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = W * dpr; cv.height = H * dpr; }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const pad = opt.pad ?? 4, data = Sig.buf.slice(-n), step = W / (n - 1), y = v => H - pad - v * (H - pad * 2);
  if (opt.grid) { ctx.strokeStyle = getCss('--line'); ctx.lineWidth = 1; for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(0, y(k / 5)); ctx.lineTo(W, y(k / 5)); ctx.stroke(); } }
  const off = n - data.length; // пока буфер не заполнен, данные прижаты к правому краю — и линии, и полосы состояний
  if (opt.states) data.forEach((b, i) => { if (b[2] !== 'REST') { ctx.fillStyle = ST[b[2]].hex + '1A'; ctx.fillRect((i + off) * step, 0, step + 1, H); } });
  [[0, getCss('--ch1')], [1, getCss('--ch2')]].forEach(([k, c]) => {
    ctx.strokeStyle = c; ctx.lineWidth = opt.lw || 2; ctx.lineJoin = 'round'; ctx.beginPath();
    data.forEach((b, i) => { const xx = (i + off) * step, yy = y(clamp(b[k])); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }); ctx.stroke();
  });
}
const cssCache = {}; let cssTheme = '';
function getCss(v) { const th = document.documentElement.dataset.theme; if (th !== cssTheme) { cssTheme = th; for (const k in cssCache) delete cssCache[k]; } return cssCache[v] ||= getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

/* ---------------- Хелперы разметки ---------------- */
const stateChip = (id = 'stchip') => `<span class="stchip" id="${id}"><i></i>${ST.REST.n}</span>`;
const LOCK_ST = { n: 'Блокировка', hex: '#8A7F78' };
function updChip(el) { if (!el) return; const k = Ctrl.blocked ? 'LOCK' : Ctrl.state, s = Ctrl.blocked ? LOCK_ST : ST[Ctrl.state]; if (el._s !== k) { el._s = k; el.style.setProperty('--sc', s.hex); el.innerHTML = `<i></i>${s.n}`; } }
const seg = (name, opts, cur) => `<div class="seg" data-seg="${name}"><div class="sl"></div>${opts.map(([k, l]) => `<button data-v="${k}" class="${k === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`;
function bindSeg(root, name, cb) {
  const el = $(`[data-seg="${name}"]`, root); if (!el) return;
  const move = () => { const b = $('button.on', el), sl = $('.sl', el); if (b) { sl.style.left = b.offsetLeft + 'px'; sl.style.width = b.offsetWidth + 'px'; } };
  requestAnimationFrame(move); try { new ResizeObserver(move).observe(el); } catch (e) { }
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', el).forEach(x => x.classList.toggle('on', x === b)); move(); cb(b.dataset.v); });
}
const sw = (key, on) => `<button class="sw ${on ? 'on' : ''}" data-sw="${key}" aria-pressed="${on}"></button>`;
function rangeFill(inp) { const p = (inp.value - inp.min) / (inp.max - inp.min) * 100; inp.style.setProperty('--p', p + '%'); }
const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'; };
const starsSvg = n => [0, 1, 2].map(i => `<svg viewBox="0 0 24 24" class="${i < n ? 'on' : ''}" style="animation-delay:${.4 + i * .2}s" fill="currentColor">${IC.star}</svg>`).join('');

/* Навыки для радара и рекомендаций */
function skills(fromDaysAgo = 0) {
  const cut = Date.now() - fromDaysAgo * 864e5, H = S.history.filter(h => h.t <= cut).slice(-30);
  const avg = (arr, f) => arr.length ? arr.reduce((a, b) => a + f(b), 0) / arr.length : null;
  const of = g => H.filter(h => h.game === g);
  const days = Object.entries(S.stats.days).filter(([k]) => new Date(k).getTime() <= cut).slice(-10).map(e => e[1]);
  const pur = avg(H.filter(h => h.purity != null), h => h.purity) ?? avg(days.filter(d => d.purity), d => d.purity) ?? 50;
  const acc = avg(H, h => h.acc) ?? 50;
  const rt = avg(of('react').filter(h => h.react), h => h.react) ?? avg(days.filter(d => d.react), d => d.react) ?? 650;
  return [
    { k: 'iso', label: 'Изоляция', value: clamp(pur / 100), game: 'react' },
    { k: 'acc', label: 'Точность', value: clamp(acc / 100), game: 'race' },
    { k: 'rt', label: 'Реакция', value: clamp((900 - rt) / 600), game: 'react' },
    { k: 'force', label: 'Сила', value: clamp((avg([...of('fish'), ...of('mug')], h => h.acc) ?? acc * .85) / 100), game: of('mug').length <= of('fish').length ? 'mug' : 'fish' },
    { k: 'timing', label: 'Тайминг', value: clamp((avg([...of('rhythm'), ...of('flap'), ...of('blind')], h => h.acc) ?? acc * .8) / 100), game: of('blind').length < of('rhythm').length ? 'blind' : 'rhythm' }
  ];
}

/* ---------------- Голосовые подсказки ----------------
   Озвучиваются призывы к действию и предупреждения из hint() игры, не чаще раза в 2 с
   (призыв к действию перебивает очередь). В «Реакции» голос выключен: он запаздывает
   на сотни миллисекунд и исказил бы замер скорости реакции. */
const Voice = {
  last: 0,
  speakable: s => String(s).replace(/\(?К1\)?/g, 'ка один').replace(/\(?К2\)?/g, 'ка два').replace(/[«»!…]/g, '').replace(/\s+—\s+/g, ', ').trim(),
  hint([text, kind], game) {
    if (!C().voice || !text || game === 'react' || game === 'blind') return;
    const now = performance.now(), urgent = kind === 'act';
    if (!(urgent || kind === 'warn' || game === 'school')) return;
    if (!urgent && now - this.last < 2000) return;
    this.last = now; Native.say(this.speakable(text), { force: urgent });
  }
};
Bus.on('signal:lost', () => C().voice && Native.say('Сигнал потерян', { force: true }));

/* ---------------- Мастерская: робот собирается из деталей за миссии и испытание недели ----------------
   Долгая цель поверх ежедневных: 8 деталей — робот готов, начинается следующий. */
const ROBOTS = ['Кинетик', 'Шестерёнка', 'Искорка', 'Болтик', 'Пружинка', 'Магнитик'];
const PARTS = ['Ноги', 'Корпус', 'Левая рука', 'Правая рука', 'Голова', 'Антенна', 'Глаза', 'Сердце'];
const Workshop = {
  get w() { const w = S.workshop ||= { parts: 0, built: 0, log: [] }; w.log ||= []; return w; },
  name(off = 0) { return ROBOTS[(this.w.built + off) % ROBOTS.length]; },
  add(why) {
    const w = this.w; w.parts++; w.log.push({ t: Date.now(), why, part: PARTS[w.parts - 1] }); if (w.log.length > 60) w.log.shift();
    if (w.parts >= PARTS.length) { const n = this.name(); w.parts = 0; w.built++; addXP(100); reward('robot', `Робот «${n}» собран!`, '+100 XP · следующий уже ждёт детали', 120); }
    else reward('robot', 'Деталь для мастерской: ' + PARTS[w.parts - 1].toLowerCase(), `${w.parts} из ${PARTS.length} · за ${why}`, 30);
    save();
  }
};
function robotSVG(n, size = 120) {
  const f = (i, col) => i < n ? col : 'none', d = i => i < n ? '' : ' stroke-dasharray="4 4" opacity=".5"';
  return `<svg class="robot" viewBox="0 0 120 140" width="${size}" height="${Math.round(size * 140 / 120)}" fill="none" stroke="var(--muted)" stroke-width="2" aria-label="Робот: ${n} из ${PARTS.length} деталей">
    <rect x="40" y="108" width="14" height="26" rx="5" fill="${f(0, 'var(--s2)')}"${d(0)}/><rect x="66" y="108" width="14" height="26" rx="5" fill="${f(0, 'var(--s2)')}"${d(0)}/>
    <rect x="32" y="62" width="56" height="48" rx="14" fill="${f(1, 'var(--s1)')}"${d(1)}/>
    <rect x="12" y="66" width="16" height="36" rx="8" fill="${f(2, 'var(--s3)')}"${d(2)}/><rect x="92" y="66" width="16" height="36" rx="8" fill="${f(3, 'var(--s3)')}"${d(3)}/>
    <rect x="36" y="20" width="48" height="38" rx="12" fill="${f(4, 'var(--s4)')}"${d(4)}/>
    <path d="M60 20V9"${d(5)}/><circle cx="60" cy="7" r="4" fill="${f(5, 'var(--s5)')}"${d(5)}/>
    <circle cx="50" cy="38" r="5" fill="${f(6, '#fff')}"${d(6)}/><circle cx="70" cy="38" r="5" fill="${f(6, '#fff')}"${d(6)}/>
    <path d="M60 80c-4-5-11-1-8 4l8 7 8-7c3-5-4-9-8-4z" fill="${f(7, '#EE5D5D')}"${d(7)}/></svg>`;
}
function workshopSheet() {
  const w = Workshop.w;
  sheet(`<h2 style="margin-top:0">Мастерская</h2><div style="display:grid;place-items:center;margin:6px 0 10px">${robotSVG(w.parts, 150)}</div>
    <p class="sub" style="text-align:center;margin:0">Робот «${Workshop.name()}» · ${w.parts} из ${PARTS.length} деталей${w.built ? ` · уже собрано: ${w.built}` : ''}</p>
    <div class="note">${ic('target')}<span>Деталь дают за каждую выполненную миссию дня и за испытание недели. Восемь деталей — робот готов и +100 XP.</span></div>
    <h3 class="h3">Детали</h3><div class="wparts">${PARTS.map((p, i) => `<span class="${i < w.parts ? 'on' : ''}">${i < w.parts ? ic('check') : ''}${p}</span>`).join('')}</div>
    ${w.log.length ? `<h3 class="h3">Последние</h3><div class="list">${w.log.slice(-4).reverse().map(x => `<div class="lrow">${badge('robot', 'lilac')}<div><b>${esc(x.part || 'Деталь')}</b><small>${new Date(x.t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · за ${esc(x.why)}</small></div></div>`).join('')}</div>` : ''}`);
}

/* ---------------- Испытание недели: одна игра и уровень на всю неделю, цель по точности ----------------
   Таблица — попытки этого пользователя за неделю (общей таблицы без сервера нет). */
const weekKey = (d = new Date()) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return dayKey(x); };
function weeklyDef(k = weekKey()) {
  let h = 7; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = ARCADE().filter(id => id !== 'blind'); return { k, id: a[h % a.length], lv: 2 + ((h >>> 5) % 2), acc: 70 + ((h >>> 9) % 3) * 5 };
}
const Weekly = {
  cur() { const d = weeklyDef(), w = S.weekly[d.k] ||= { tries: [], done: false }; return { ...d, w }; },
  record(id, lv, r) {
    const c = this.cur(); if (id !== c.id) return null;
    c.w.tries.push({ t: Date.now(), score: r.score, acc: Math.round(r.acc * 100), win: r.win !== false }); if (c.w.tries.length > 40) c.w.tries.shift();
    let just = false; if (!c.w.done && r.win !== false && r.acc * 100 >= c.acc && lv >= c.lv) { c.w.done = true; just = true; addXP(150); Workshop.add('испытание недели'); }
    const keys = Object.keys(S.weekly).sort(); if (keys.length > 12) delete S.weekly[keys[0]];
    save(); return { just, done: c.w.done };
  },
  streak() { let n = 0, d = new Date(); for (;;) { const w = S.weekly[weekKey(d)]; if (!w?.done) { if (n === 0 && d.getTime() > Date.now() - 864e5) { d = addDays(d, -7); continue; } break; } n++; d = addDays(d, -7); } return n; }
};
function weeklySheet() {
  const c = Weekly.cur(), g = GAMES[c.id], best = [...c.w.tries].sort((a, b) => b.score - a.score).slice(0, 5), end = addDays(new Date(c.k), 6);
  sheet(`<div class="sh-head">${badge('calendar', 'lilac', 'lg')}<div><h2 style="margin:0">Испытание недели</h2><small class="muted">до ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</small></div></div>
    <div class="note" style="margin-top:12px">${gIcon(c.id)}<span>Пройди «${g.t}» на уровне ${c.lv} с точностью от ${c.acc}%. Награда: +150 XP и деталь для мастерской.</span></div>
    ${c.w.done ? `<div class="note ok">${ic('check')}<span><b>Выполнено.</b> Можно улучшать результат — таблица ниже.</span></div>` : ''}
    <h3 class="h3">Мои попытки за неделю</h3>
    ${best.length ? `<div class="card" style="padding:4px 14px">${best.map((x, i) => `<div class="kv"><span class="l">${i + 1}. ${new Date(x.t).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })}${x.win ? '' : ' · не пройден'}</span><b>${fmtN(x.score)} · ${x.acc}%</b></div>`).join('')}</div>` : '<p class="sub">Попыток пока нет.</p>'}
    <p class="sub small" style="margin-top:8px">Недель подряд с выполненным испытанием: ${Weekly.streak()}</p>
    <h3 class="h3">Таблица клуба</h3><div id="wClub">${Club.url() ? '<p class="sub">Загружаю…</p>' : '<p class="sub small">Общая таблица для центра реабилитации, кружка или семьи: на компьютере в той же сети — <b>node tools/relay.mjs</b>, адрес — сюда. Результаты испытания недели будут уходить в неё автоматически.</p>'}</div>
    <div class="row" style="margin-top:6px"><input class="txt" id="wCU" inputmode="url" placeholder="http://192.168.1.5:8787" value="${esc(C().club || '')}" style="flex:1;min-width:0"><button class="btn ghost sm" id="wCS" style="width:auto;flex:none">${C().club ? 'Сохранить' : 'Подключить'}</button></div>
    <button class="btn" id="wGo" style="margin-top:14px">${ic('play')} Играть · уровень ${c.lv}</button>`, (sh, close) => {
    $('#wGo', sh).onclick = () => { if (sh._closing) return; close(); App.go('play', { id: c.id, diff: c.lv, weekly: true }); };
    const box = $('#wClub', sh), load = () => { if (!Club.url()) return; box.innerHTML = '<p class="sub">Загружаю…</p>'; Club.list(c.k).then(list => { if (!sh.isConnected) return; const rows = Array.isArray(list?.rows) ? list.rows : [];
      box.innerHTML = rows.length ? `<div class="card" style="padding:4px 14px">${rows.slice(0, 10).map((x, i) => `<div class="kv"><span class="l">${i + 1}. ${esc(x.name)}${x.id === Club.id() ? ' (вы)' : ''}</span><b>${fmtN(x.score)} · ${x.acc}%</b></div>`).join('')}</div>` : '<p class="sub">В таблице клуба пока пусто — сыграйте испытание недели.</p>'; })
      .catch(e => { if (sh.isConnected) box.innerHTML = `<p class="sub small" style="color:var(--warn)">Сервер клуба не отвечает: ${esc(e.message)}</p>`; }); };
    $('#wCS', sh).onclick = () => { const u = $('#wCU', sh).value.trim().replace(/\/$/, ''); if (u && !/^https?:\/\//.test(u)) return toast('info', 'Нужен адрес вида http://192.168.1.5:8787'); C().club = u; save(); toast('calendar', u ? 'Таблица клуба подключена' : 'Таблица клуба отключена'); load(); };
    load();
  });
}

/* ---------------- Карта игры: когда работали К1/К2 и где включалась мышца-антагонист ---------------- */
function gameMap(tl) {
  const n = tl.length; if (n < 10) return '';
  const W = 600, w = W / n; let bars = '', marks = '', ep = 0, first = null, prev = false;
  tl.forEach((c, i) => {
    const st = c & 3, lk = c >= 4, x = (i * w).toFixed(2), ww = (w + .4).toFixed(2);
    if (st) bars += `<rect x="${x}" y="4" width="${ww}" height="26" fill="${['', 'var(--ch1)', 'var(--ch2)', 'var(--both)'][st]}"/>`;
    if (lk) { marks += `<rect x="${x}" y="36" width="${ww}" height="12" fill="#EE5D5D"/>`; if (!prev) { ep++; if (first == null) first = i * .2; } }
    prev = lk;
  });
  const dur = n * .2;
  return `<div class="card emap"><div class="between"><b>Карта игры</b><small class="muted">${fmtTime(dur)}</small></div>
    <svg viewBox="0 0 ${W} 52" preserveAspectRatio="none" role="img" aria-label="Карта активности каналов во времени"><rect x="0" y="4" width="${W}" height="26" fill="var(--line)" opacity=".45"/>${bars}<rect x="0" y="36" width="${W}" height="12" fill="var(--line)" opacity=".3"/>${marks}</svg>
    <div class="legend"><span><i style="background:var(--ch1)"></i>К1</span><span><i style="background:var(--ch2)"></i>К2</span><span><i style="background:var(--both)"></i>обе</span><span><i style="background:#EE5D5D"></i>встречное сокращение</span></div>
    <p class="sub small" style="margin:6px 0 0">${ep ? `Мышца-антагонист включалась ${plur(ep, 'раз', 'раза', 'раз')}, впервые на ${fmtTime(first)}. Красные отрезки — где держать вторую мышцу расслабленной.` : 'Встречных сокращений не было — каналы работали раздельно.'}</p></div>`;
}

/* =====================================================================
   РОУТЕР
   ===================================================================== */
const TABS = ['home', 'gestures', 'sensors', 'games', 'progress'];
const App = {
  cur: null, stack: [],
  go(name, p = {}, opt = {}) {
    // только собственные экраны: имя из deep link / postMessage не должно попадать на Object.prototype ('constructor', '__proto__')
    const sc = Object.hasOwn(SCR, name) ? SCR[name] : null; if (!sc) return;
    if (sc.valid && !sc.valid(p)) { if (name !== 'home') this.go('home', {}, { fade: true }); return; }
    // двойной тап по кнопке не открывает один и тот же экран дважды
    const sig = name + JSON.stringify(p), t = performance.now(); if (sig === this._sig && t - this._t < 400 && !opt.force) return; this._sig = sig; this._t = t;
    document.body.dataset.scr = name; // для стилей по экрану (плашка демо-данных — только на дашбордах)
    const view = $('#view'), old = this.cur;
    Intent.pad = [null, null]; // панели старого экрана исчезают — их «нажатие» не должно жить дальше
    if (old) { old.sc.unmount?.(old.el); old.el.classList.remove('enter'); old.el.classList.add('leave'); if (opt.back) old.el.classList.add('back'); setTimeout(() => old.el.remove(), 320); }
    // игра и её результат не копятся в истории: «назад» из игры ведёт туда, откуда её открыли
    const transient = n => n === 'play' || n === 'result';
    if (TABS.includes(name)) this.stack = []; else if (!opt.back && old && !(transient(old.name) && transient(name))) this.stack.push({ name: old.name, p: old.p });
    if (transient(name)) this.stack = this.stack.filter(x => !transient(x.name));
    const el = document.createElement('div');
    el.className = 'page ' + (sc.full ? 'full ' : '') + (opt.fade ? 'fade ' : '') + 'enter' + (opt.back ? ' back' : '');
    el.innerHTML = sc.render(p); view.appendChild(el);
    this.cur = { name, sc, el, p };
    $('#tabs').classList.toggle('off', !sc.tab);
    if (sc.tab) { const i = TABS.indexOf(sc.tab); $$('#tabs button').forEach((b, k) => b.classList.toggle('on', k === i)); $('#tabs .blob').style.transform = `translateX(${i * 100}%)`; }
    sc.mount?.(el, p); animateIn(el);
    $('#mEmu')?.classList.toggle('hidden', !!sc.noEmu);
  },
  back() { const prev = this.stack.pop(); this.go(prev ? prev.name : 'home', prev?.p || {}, { back: true }); },
  /* перерисовка текущего экрана: новый элемент — старые обработчики не копятся */
  refresh() {
    if (!this.cur) return; const { sc, el, p } = this.cur, top = el.scrollTop; sc.unmount?.(el);
    const n = document.createElement('div'); n.className = 'page ' + (sc.full ? 'full' : ''); n.innerHTML = sc.render(p); el.replaceWith(n);
    this.cur.el = n; sc.mount?.(n, p); n.scrollTop = top; animateIn(n);
  }
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); App.go(a.dataset.go, a.dataset.p ? JSON.parse(a.dataset.p) : {}); return; }
  if (e.target.closest('[data-back]')) App.back();
});

/* =====================================================================
   ЭКРАНЫ
   ===================================================================== */
const SCR = {};

/* ---------- Онбординг ---------- */
SCR.onboard = {
  full: true, noEmu: true,
  slides: [
    { t: 'Твоя рука.<br>Твои возможности.', d: 'Kineta помогает освоить бионический протез: управляй жестами, тренируйся в играх и смотри, как растут навыки.' },
    { t: 'Жесты под тебя', d: 'Настрой положение каждого пальца, сохрани жест и собери удобную группу ротации для повседневных задач.' },
    { t: 'Тренируйся играя', d: 'Гонки, полёт дрона, ритм, рыбалка и реакция — каждая игра прокачивает отдельный навык управления.' }
  ],
  render() {
    return `<div class="onb"><div class="row" style="justify-content:space-between">${brand()}<button class="tag soft" id="skip">Пропустить</button></div>
      <div class="art" id="oArt"></div>
      <h1 id="oT"></h1><p class="sub" id="oD" style="min-height:60px"></p>
      <div class="dots" id="oDots">${this.slides.map(() => '<i></i>').join('')}</div>
      <button class="btn" id="oNext">Далее ${ic('chev')}</button></div>`;
  },
  mount(el) {
    let i = 0; const art = $('#oArt', el);
    const show = () => {
      const s = this.slides[i]; $('#oT', el).innerHTML = s.t; $('#oD', el).textContent = s.d;
      $$('#oDots i', el).forEach((d, k) => d.classList.toggle('on', k === i));
      [$('#oT', el), $('#oD', el)].forEach(x => { x.style.animation = 'none'; x.offsetWidth; x.style.animation = 'fadeUp .5s var(--ease) both'; });
      art.style.animation = 'none'; art.offsetWidth; art.style.animation = 'pop2 .6s var(--spring) both';
      if (i === 0) { art.innerHTML = `<div class="onb-hand"><div id="oHand"></div></div>`; this.hv = new HandView($('#oHand', art), {}); this.hv.svg.style.cssText = 'height:100%;width:auto;display:block;margin:auto'; }
      else if (i === 1) { this.hv = null; art.innerHTML = `<div class="gest-grid onb-grid">${['pinch', 'point', 'ok', 'call'].map((id, k) => `<div class="gcard" style="animation:fadeUp .5s ${k * .1}s both"><div class="hw">${handSVG(G(id).closed)}</div><b>${G(id).name}</b></div>`).join('')}</div>`; }
      else { this.hv = null; art.innerHTML = `<div class="onb-list">${ARCADE().map((id, k) => `<div class="lrow" style="animation:fadeUp .5s ${k * .08}s both">${gIcon(id)}<div><b>${GAMES[id].t}</b><small>${GAMES[id].skill}</small></div></div>`).join('')}</div>`; }
      $('#oNext', el).innerHTML = i === 2 ? `Начать ${ic('chev')}` : `Далее ${ic('chev')}`;
    };
    show();
    $('#oNext', el).onclick = () => { if (i < 2) { i++; show(); } else App.go('perms'); };
    $('#skip', el).onclick = () => App.go('perms');
    let x0 = null; art.addEventListener('pointerdown', e => x0 = e.clientX); art.addEventListener('pointerup', e => { if (x0 == null) return; const d = e.clientX - x0; x0 = null; if (d < -40 && i < 2) { i++; show(); } else if (d > 40 && i > 0) { i--; show(); } });
    this.t0 = performance.now();
  },
  frame(dt, now, el) {
    if (this.hv) { const tt = Math.max(0, now - this.t0), k = (Math.sin(tt / 700) + 1) / 2, g = G(['natural', 'fist', 'point', 'ok', 'pinch'][Math.floor(tt / 4400) % 5]); this.hv.set(g.open.map((v, j) => lerp(v, g.closed[j], k))); }
  }
};
function paintPreview(cv, now) {
  const dpr = devicePixelRatio || 1, W = cv.offsetWidth, H = cv.offsetHeight; if (!W) return;
  if (cv.width !== Math.round(W * dpr)) { cv.width = W * dpr; cv.height = H * dpr; }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); gamePreview(cv.dataset.prev, ctx, W, H, now / 1000);
}

/* ---------- Разрешения: Bluetooth + геолокация ---------- */
SCR.perms = {
  full: true, noEmu: true,
  render() {
    return `<div class="onb" style="text-align:left">
      <div class="back"><button class="ib" data-back>${ic('back')}</button></div>
      <h1>Подключим протез</h1><p class="sub">Нужны два разрешения. Мы не передаём данные третьим лицам.</p>
      <div id="pBt"></div><div id="pGeo"></div>
      <div class="note">${ic('info')}<span>Bluetooth — связь с протезом: заряд, жесты, сигналы ЭМГ. Геолокация — «Где мой протез» (место последнего подключения) и ближайший сервис.</span></div>
      <div style="flex:1"></div>
      <button class="btn" id="pGo" disabled>Продолжить ${ic('chev')}</button>
      <button class="btn ghost sm" id="pLater" style="margin-top:10px">Без протеза — демо-режим</button></div>`;
  },
  mount(el) {
    const spin = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div>';
    const draw = () => {
      const bt = S.device.connected, geo = S.perms.geo;
      $('#pBt', el).innerHTML = `<div class="perm ${bt ? 'ok' : ''}"><div class="pi b">${bt ? '' : '<i class="pulse-ring"></i><i class="pulse-ring d2"></i>'}${ic('bt')}</div>
        <div style="flex:1;min-width:0"><div class="t">Bluetooth</div><div class="d">${bt ? 'Подключено: ' + esc(S.device.name) : 'Поиск и подключение протеза'}</div>
        ${!BT.supported() && !bt ? '<div class="st" style="color:var(--warn)">Web Bluetooth недоступен в этом браузере — покажем демо-поиск</div>' : ''}
        ${this.failed && !bt ? '<button class="lnk" id="btDemo" style="margin-top:4px">Показать демо-протезы ' + ic('chev') + '</button>' : ''}</div>
        ${bt ? `<div class="check">${ic('check')}</div>` : `<button class="go" id="btGo">${this.failed ? 'Повторить' : 'Разрешить'}</button>`}</div>`;
      $('#pGeo', el).innerHTML = `<div class="perm ${geo === 'granted' ? 'ok' : ''}"><div class="pi g">${geo === 'granted' ? '' : '<i class="pulse-ring"></i>'}${ic('gps')}</div>
        <div style="flex:1;min-width:0"><div class="t">Геолокация</div><div class="d">${geo === 'granted' ? `Точность ±${S.geo.acc} м` : geo === 'denied' ? 'Доступ запрещён — можно включить позже на экране протеза' : 'Где мой протез: место последнего подключения'}</div></div>
        ${geo === 'granted' ? `<div class="check">${ic('check')}</div>` : `<button class="go" id="geoGo">${geo === 'denied' ? 'Повторить' : 'Разрешить'}</button>`}</div>`;
      $('#pGo', el).disabled = !bt;
      const dm = $('#btDemo', el); if (dm) dm.onclick = () => App.go('scan');
      const b = $('#btGo', el); if (b) b.onclick = async () => {
        if (!BT.supported()) { App.go('scan'); return; }
        b.innerHTML = spin; b.disabled = true;
        // браузер умеет Bluetooth, но адаптера нет или он выключен — сразу демо-поиск
        const avail = await navigator.bluetooth.getAvailability?.().catch(() => true);
        if (avail === false) { toast('bt', 'Bluetooth выключен', 'Включите его или выберите демо-протез'); this.failed = true; if (el.isConnected) draw(); return; }
        try { const r = await BT.request(); this.failed = false; Snd.ok(); toast('bt', 'Подключено', r.name); confetti(50); }
        catch (err) { this.failed = true; toast('info', err.name === 'NotFoundError' ? 'Устройство не выбрано' : err.name === 'SecurityError' ? (/gesture/i.test(err.message) ? 'Нажмите «Разрешить» ещё раз' : 'Bluetooth доступен только по https или localhost') : 'Не удалось подключиться', err.name === 'NotFoundError' ? 'Можно повторить или выбрать демо-режим' : 'Или выберите демо-поиск'); }
        if (el.isConnected) draw();
      };
      const g = $('#geoGo', el); if (g) g.onclick = async () => {
        g.innerHTML = spin; g.disabled = true;
        try { await Geo.request(); Snd.ok(); toast('gps', 'Геолокация включена', `±${S.geo.acc} м`); } catch (err) { toast('info', 'Геолокация недоступна', err.message || 'Доступ запрещён'); }
        if (el.isConnected) draw();
      };
    };
    this.failed = false; draw();
    $('#pGo', el).onclick = () => finishOnboarding();
    $('#pLater', el).onclick = () => { BT.connectDemo('Kineta Hand (демо)'); finishOnboarding(); };
  }
};
function finishOnboarding() { S.onboarded = true; save(); touchStreak(); App.go('home', {}, { fade: true }); setTimeout(() => { toast('hand', `${greet()}, ${S.profile.name}!`, 'Протез готов к работе'); }, 500); }

/* ---------- Демо-поиск протеза (радар) ---------- */
SCR.scan = {
  full: true, noEmu: true,
  render() {
    return `<div class="onb" style="text-align:left"><div class="back"><button class="ib" data-back>${ic('back')}</button><span class="grow">Поиск протеза</span></div>
      <p class="sub">${BT.supported() ? 'Демо-поиск: показываем протезы-эмуляторы. Чтобы подключить настоящий протез, включите Bluetooth и вернитесь назад.' : 'Демо-поиск: в этом браузере нет Web Bluetooth, поэтому показываем протезы-эмуляторы. Реальный протез подключается в Chrome или Edge на Android и компьютере.'}</p>
      <div class="radar"><div class="sweep"></div><div class="core">${ic('bt')}</div></div>
      <div id="devs"></div></div>`;
  },
  mount(el) {
    const devs = [['Kineta Hand K2 · правая', 'SN 24-0711', 4, 62, 30], ['Kineta Hand K2 · левая', 'SN 24-0388', 3, 28, 64], ['MyoBand EMG-2', 'Браслет датчиков', 2, 74, 76]];
    this.to = devs.map((d, i) => setTimeout(() => {
      $('.radar', el).insertAdjacentHTML('beforeend', `<div class="blip" style="left:${d[3]}%;top:${d[4]}%" data-i="${i}">${ic(i === 2 ? 'wave' : 'hand')}</div>`);
      $('#devs', el).insertAdjacentHTML('beforeend', `<button class="dev tap" data-i="${i}"><div class="di">${ic(i === 2 ? 'wave' : 'hand')}</div><div><b>${d[0]}</b><small>${d[1]}</small></div><div class="sig">${[1, 2, 3, 4].map(k => `<i class="${k <= d[2] ? 'on' : ''}" style="height:${k * 4}px"></i>`).join('')}</div></button>`);
      Snd.tick();
    }, 900 + i * 900));
    el.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) this.connect(el, devs[+b.dataset.i][0]); });
  },
  unmount() { this.to?.forEach(clearTimeout); },
  connect(el, name) {
    const steps = ['Сопряжение по Bluetooth', 'Чтение прошивки и заряда', 'Проверка каналов ЭМГ', 'Готово'];
    sheet(`<h2 style="margin-top:0">${esc(name)}</h2><div id="cs">${steps.map((s, i) => `<div class="calib-step" data-s="${i}"><div class="cn">${i + 1}</div><div style="flex:1;font-weight:700">${s}</div></div>`).join('')}</div>`, async (sh, close) => {
      for (let i = 0; i < steps.length; i++) {
        const st = $(`[data-s="${i}"]`, sh); st.classList.add('now'); await sleep(i === 3 ? 200 : 650);
        st.classList.remove('now'); st.classList.add('done'); $('.cn', st).innerHTML = ic('check'); Snd.tick();
      }
      BT.connectDemo(name); Snd.ok(); confetti(70); await sleep(500); close(); App.go('perms', {}, { back: true });
    });
  }
};

/* ---------- Главная ---------- */
SCR.home = {
  tab: 'home',
  render() {
    Mission.ensure();
    const d = today(), g = Prosthesis.gesture, rec = skills().sort((a, b) => a.value - b.value)[0], RG = GAMES[rec.game];
    const goal = S.profile.goalMin, dev = S.device, dg = dailyGame(), DG = GAMES[dg], sch = gst('school').plays;
    const L = plvl(), lo = xpFor(L), hi = xpFor(L + 1), left = Math.max(0, goal - d.min);
    const wk = [...Array(7)].map((_, i) => { const dd = addDays(new Date(), i - 6); return { d: dd, v: S.stats.days[dayKey(dd)] }; });
    const wMin = wk.reduce((a, x) => a + (x.v?.min || 0), 0), wMax = Math.max(goal, ...wk.map(x => x.v?.min || 0)), wDays = wk.filter(x => x.v?.min).length;
    const wAcc = (a => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null)(wk.map(x => x.v?.acc).filter(Boolean));
    const wd = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    return `<div class="stg">
    <div class="topbar">${brand()}<span class="grow"></span>
      <button class="pill-st" data-go="device" title="Мой протез">${pillHTML()}</button>
      <button class="ava" data-go="profile" title="Профиль">${esc(S.profile.name[0] || 'K')}</button></div>
    <div class="greet"><h1>${greet()}, ${esc(S.profile.name)}</h1><p class="sub">${d.min >= goal ? 'Цель дня выполнена. Отличная работа!' : `До цели дня ${left} мин — пара игр, и рука слушается лучше.`}</p>
      <button class="rankline" data-go="profile"><span class="tag soft">${ic('star')} Ранг ${L}</span><div class="pbar"><i data-w="${clamp((S.profile.xp - lo) / (hi - lo)) * 100}%" style="width:0"></i></div><small>${fmtN(hi - S.profile.xp)} XP до ${L + 1}</small></button></div>
    <div class="home-grid"><div class="hcol">
    <div class="hero">
      <div class="lbl"><span class="eyebrow">Активный жест</span><h3 id="hName">${esc(g.name)}</h3>
        ${stateChip('hChip')}
        <div class="grip"><div class="pbar"><i id="hGrip" style="width:0;transition:none"></i></div><small id="hGripT">Сжатие 0%</small></div></div>
      <div class="hstage"><div class="hv" id="hHand"></div></div>
      <div class="legend-st"><span><i style="background:var(--ch1)"></i>К1 — закрыть</span><span><i style="background:var(--ch2)"></i>К2 — открыть</span><span><i style="background:var(--both)"></i>обе — сменить жест</span></div>
      <div class="gbtns" id="hRot">${S.rotation.filter(G).map(id => `<button class="chipbtn ${id === S.activeId ? 'on' : ''}" data-g="${id}">${esc(G(id).name)}</button>`).join('')}</div></div>
    <div class="card sigcard">
      <div class="between"><div><b class="ct">Сигнал мышц</b><small class="cs2" id="hSrc">${Ctrl.source()} · ${C().mode === 'emg' ? 'поток 1, ЭМГ' : 'поток 2, СПППР'}</small></div><button class="lnk" data-go="sensors">Датчики ${ic('chev')}</button></div>
      <div class="mtrace"><canvas id="hTrace"></canvas></div>
      <div class="lvbars">${[0, 1].map(i => `<div class="lvb c${i + 1}"><span>К${i + 1}<em>${i ? 'открыть' : 'закрыть'}</em></span><div class="lvt"><i id="hL${i}"></i><u id="hT${i}"></u></div><b id="hV${i}">0%</b></div>`).join('')}</div>
    </div>
    <div class="stats3">
      <div class="st1">${ring(d.min / goal, 'var(--primary)', 46, 6)}<div><b>${d.min}<small>/${goal}</small></b><span>минут сегодня</span></div></div>
      <div class="st1">${badge('flame', 'sun')}<div><b data-count="${S.profile.streak}">0</b><span>дней подряд</span></div></div>
      <div class="st1">${badge('hand', 'sky')}<div><b id="hActs">${fmtN(d.acts)}</b><span>захватов</span></div></div></div>
    <button class="card weekcard" data-go="progress">
      <div class="between"><div><b class="ct">Эта неделя</b><small class="cs2">${wMin} мин · ${wDays} из 7 дней${wAcc ? ` · точность ${wAcc}%` : ''}</small></div><span class="chev">${ic('chev')}</span></div>
      <div class="wbars">${wk.map((x, i) => { const m = x.v?.min || 0; return `<div class="${i === 6 ? 'now' : ''}" title="${m} мин"><span class="bw"><i style="height:${Math.max(6, m / wMax * 100)}%" class="${m >= goal ? 'ok' : m ? '' : 'z'}"></i></span><small>${wd[x.d.getDay()]}</small></div>`; }).join('')}<u style="bottom:${20 + goal / wMax * 64}px" title="цель ${goal} мин"></u></div>
    </button>
    </div><div class="hcol">
    <h2 class="h2top">Тренировка</h2>
    <div class="list">
      ${storyCard()}
      ${!sch ? `<button class="lrow" data-play="school">${gIcon('school')}<div><b>Школа управления</b><small>Начни отсюда: 7 коротких упражнений</small></div>${ic('chev', 'chev')}</button>` : ''}
      <button class="lrow" data-play="${dg}" data-daily="1">${gIcon(dg)}<div><b>Испытание дня · ${DG.t}</b><small>Двойной опыт за прохождение</small></div>${dailyAvail() ? '<span class="tag soft">×2 XP</span>' : `<span class="tag ok">${ic('check')} сегодня</span>`}</button>
      <button class="lrow" data-play="${rec.game}">${gIcon(rec.game)}<div><b>Подтянуть навык · ${rec.label.toLowerCase()}</b><small>${RG.t} · сейчас ${Math.round(rec.value * 100)}%</small></div>${ic('chev', 'chev')}</button>
    </div>
    <h2>Миссии дня <span class="tag soft">${S.missions.list.filter(m => m.done).length}/3 · +60 XP</span></h2>
    <div class="list">${S.missions.list.map((m, i) => { const def = MISSIONS.find(x => x.id === m.id); return `<div class="lrow mission ${m.done ? 'done' : ''}">${badge(m.done ? 'check' : def.ic, m.done ? 'mint' : ['peach', 'sky', 'lilac'][i])}<div><b>${def.t}</b><div class="pbar"><i data-w="${m.p / def.n * 100}%" style="width:0"></i></div></div><span class="mx">${m.done ? 'готово' : m.p + '/' + def.n}</span></div>`; }).join('')}</div>
    <p class="sub small" style="margin:8px 4px 0">Новые миссии появляются каждый день. Каждая выполненная — деталь для мастерской.</p>
    <h2>Мастерская</h2>
    <button class="card wshop" data-ws="1">${robotSVG(Workshop.w.parts, 64)}<div class="grow"><b>Робот «${Workshop.name()}»</b><small>${Workshop.w.parts} из ${PARTS.length} деталей${Workshop.w.built ? ` · собрано роботов: ${Workshop.w.built}` : ''}</small><div class="pbar"><i style="width:${Workshop.w.parts / PARTS.length * 100}%"></i></div></div><span class="chev">${ic('chev')}</span></button>
    <h2>Быстрые действия</h2>
    <div class="qa">
      <button data-go="calib">${badge('calib', 'peach')}<b>Калибровка</b><small>${S.calib.done ? 'обновить' : 'не пройдена'}</small></button>
      <button data-go="sensors">${badge('sliders', 'sky')}<b>Пороги</b><small>${pct(C().thr1)} / ${pct(C().thr2)}</small></button>
      <button data-go="editor">${badge('plus', 'mint')}<b>Новый жест</b><small>${S.gestures.length} в коллекции</small></button>
      <button data-go="device">${badge('bt', 'lilac')}<b>Мой протез</b><small>${dev.connected ? 'на связи' : 'подключить'}</small></button>
    </div>
    </div></div></div>`;
  },
  mount(el) {
    this.hv = new HandView($('#hHand', el), {}); this.hv.svg.style.cssText = 'width:100%;height:100%';
    $('#hRot', el).addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; Prosthesis.setActive(b.dataset.g); });
    this.off = [Bus.on('gesture', id => { $('#hName', el).textContent = G(id).name; $$('#hRot .chipbtn', el).forEach(b => b.classList.toggle('on', b.dataset.g === id)); const n = $('#hName', el); n.style.animation = 'none'; n.offsetWidth; n.style.animation = 'fadeUp .4s both'; }),
    Bus.on('gesture:count', () => { const a = $('#hActs', el); if (a) a.textContent = fmtN(today().acts); })];
    el.addEventListener('click', e => { if (e.target.closest('[data-ws]')) return workshopSheet(); if (e.target.closest('[data-weekly]')) return weeklySheet(); const p = e.target.closest('[data-play]'); if (p) openGame(p.dataset.play, !!p.dataset.daily); });
  },
  unmount() { this.off?.forEach(f => f()); },
  frame(dt, now, el) {
    this.hv?.set(Prosthesis.pose);
    updChip($('#hChip', el)); const gi = $('#hGrip', el); if (gi) { gi.style.width = pct(Prosthesis.grip); $('#hGripT', el).textContent = 'Сжатие ' + pct(Prosthesis.grip); }
    drawTrace($('#hTrace', el), 240, { states: true, pad: 4, lw: 1.8 });
    for (let i = 0; i < 2; i++) { const l = $('#hL' + i, el); if (!l) break; const v = clamp(Ctrl.a[i]); l.style.width = pct(v); l.parentElement.classList.toggle('on', Ctrl.on[i]); $('#hT' + i, el).style.left = pct(C()['thr' + (i + 1)]); $('#hV' + i, el).textContent = pct(v); }
  }
};

/* ---------- Жесты: коллекция и группа ротации ---------- */
SCR.gestures = {
  tab: 'gestures',
  render(p) {
    this.view = p.tab || this.view || 'col'; this.flt = this.flt || 'all';
    const own = S.gestures.filter(g => !g.builtin).length;
    return `<div class="head"><div><h1>Жесты</h1><p class="sub" style="margin:0">${S.gestures.length} в коллекции · ${S.rotation.length} в ротации${own ? ' · ' + own + ' моих' : ''}</p></div><button class="ib pri" data-go="editor" title="Новый жест">${ic('plus')}</button></div>
      ${seg('gt', [['col', 'Коллекция'], ['rot', 'Группа ротации']], this.view)}
      <div class="card active-g" style="margin-top:12px"><div class="mini" id="gaMini"></div><div style="flex:1;min-width:0"><small class="muted" style="font-weight:700">Активный жест</small><div style="font-weight:800;font-size:16px" id="gaName">${esc(Prosthesis.gesture.name)}</div>
        <div class="pbar" style="margin-top:6px;height:6px"><i id="gaGrip" style="width:0;transition:none"></i></div></div>${stateChip('gChip')}</div>
      <div class="howto"><span><i style="background:var(--ch1)"></i><b>К1</b> закрыть</span><span><i style="background:var(--ch2)"></i><b>К2</b> открыть</span><span><i style="background:var(--both)"></i><b>обе</b> следующий жест</span></div>
      <div id="gBody" style="margin-top:12px"></div>`;
  },
  mount(el) {
    bindSeg(el, 'gt', v => { this.view = v; this.body(el); });
    this.mini = new HandView($('#gaMini', el), {}); this.mini.svg.style.cssText = 'height:50px;width:auto';
    this.body(el);
    this.off = [Bus.on('gesture', id => { $('#gaName', el).textContent = G(id).name; $$('.gcard', el).forEach(c => { c.classList.toggle('act', c.dataset.id === id); const b = $('.badge', c); if (b) b.remove(); if (c.dataset.id === id) c.insertAdjacentHTML('beforeend', '<span class="badge">Активен</span>'); }); $$('.rot', el).forEach(r => r.classList.toggle('cur', r.dataset.id === id)); this.cycle(el); })];
  },
  unmount() { this.off?.forEach(f => f()); },
  frame(dt, now, el) { this.mini?.set(Prosthesis.pose); updChip($('#gChip', el)); const gg = $('#gaGrip', el); if (gg) gg.style.width = pct(Prosthesis.grip); },
  body(el) {
    const B = $('#gBody', el);
    if (this.view === 'col') {
      const list = S.gestures.filter(g => this.flt === 'all' || (this.flt === 'own' ? !g.builtin : this.flt === 'rot' ? S.rotation.includes(g.id) : g.builtin));
      const fb = (k, n) => `<button class="chipbtn ${this.flt === k ? 'on' : ''}" data-f="${k}">${n}</button>`;
      B.innerHTML = `<div class="gbtns" id="gFlt" style="margin-bottom:12px">${fb('all', 'Все · ' + S.gestures.length)}${fb('rot', 'В ротации')}${fb('std', 'Стандартные')}${fb('own', 'Мои')}</div>
        <div class="gest-grid stg">${list.map(g => { const ri = S.rotation.indexOf(g.id); return `<button class="gcard ${g.id === S.activeId ? 'act' : ''}" data-id="${g.id}"><div class="hw">${handSVG(g.closed)}${ri >= 0 ? `<span class="rn" title="Номер в ротации">${ri + 1}</span>` : ''}</div><b>${esc(g.name)}</b><small>${fmtN(S.stats.gestTotal[g.id] || 0)} раз · сегодня ${today().gest[g.id] || 0}</small>${!g.builtin ? '<span class="own">Мой</span>' : ''}${g.id === S.activeId ? '<span class="badge">Активен</span>' : ''}</button>`; }).join('')}
        ${this.flt === 'own' && !list.length ? '<p class="sub" style="grid-column:1/-1">Своих жестов пока нет — создайте первый.</p>' : ''}
        <button class="gcard add" data-go="editor"><div><div class="plus">${ic('plus')}</div>Новый жест<small style="display:block;color:var(--muted);font-weight:600;margin-top:2px">5 пальцев + оппозиция</small></div></button></div>`;
      B.onclick = e => { const f = e.target.closest('[data-f]'); if (f) { this.flt = f.dataset.f; this.body(el); return; } const c = e.target.closest('.gcard[data-id]'); if (c) gestureSheet(c.dataset.id); };
    } else {
      B.innerHTML = `<div class="cycle" id="gCyc"></div>
        <div class="rot-list" id="rList">${S.rotation.filter(G).map((id, i) => this.rotRow(id, i)).join('')}</div>
        <button class="btn ghost" id="rAdd" style="margin-top:12px">${ic('plus')} Добавить жест в ротацию</button>
        <div class="note">${ic('swap')}<span>Жесты переключаются по кругу в этом порядке одновременным сокращением обеих мышц (≥ ${C().switchMs} мс). Перетащите за ${'≡'}, чтобы изменить порядок.</span></div>
        <button class="btn sm" id="rTest" style="margin-top:12px">${ic('swap')} Переключить на следующий</button>`;
      this.cycle(el); this.bindDrag(el);
      $('#rAdd', el).onclick = () => this.addSheet(el);
      $('#rTest', el).onclick = () => Prosthesis.next();
      B.onclick = e => {
        const d = e.target.closest('.del'); if (d) { const row = d.closest('.rot'); if (S.rotation.length <= 1) { toast('info', 'В ротации должен остаться хотя бы один жест'); return; } row.classList.add('out'); setTimeout(() => { S.rotation = S.rotation.filter(x => x !== row.dataset.id); save(); this.body(el); }, 330); Snd.tap(); return; }
        const r = e.target.closest('.rot'); if (r && !e.target.closest('.drag')) Prosthesis.setActive(r.dataset.id);
      };
    }
    animateIn(B);
  },
  rotRow(id, i) { const g = G(id); return `<div class="rot ${id === S.activeId ? 'cur' : ''}" data-id="${id}"><span class="n">${i + 1}</span><div class="mini">${handSVG(g.closed)}</div><b>${esc(g.name)}<small>${g.builtin ? 'Стандартный' : 'Мой жест'}</small></b><button class="del">${ic('trash')}</button><button class="drag">${ic('drag')}</button></div>`; },
  cycle(el) { const c = $('#gCyc', el); if (c) c.innerHTML = S.rotation.map(id => `<i class="${id === S.activeId ? 'on' : ''}"></i>`).join(''); },
  bindDrag(el) {
    const list = $('#rList', el); if (!list) return;
    list.addEventListener('pointerdown', e => {
      const h = e.target.closest('.drag'); if (!h) return; e.preventDefault();
      const row = h.closest('.rot'), rows = $$('.rot', list), rh = row.offsetHeight + 10, i0 = rows.indexOf(row), y0 = e.clientY;
      row.classList.add('dragging'); h.setPointerCapture(e.pointerId); let idx = i0;
      const mv = ev => {
        const dy = ev.clientY - y0; row.style.transform = `translateY(${dy}px) scale(1.03)`;
        idx = clamp(Math.round(i0 + dy / rh), 0, rows.length - 1);
        rows.forEach((r, k) => { if (r === row) return; let sh = 0; if (i0 < idx && k > i0 && k <= idx) sh = -rh; if (i0 > idx && k < i0 && k >= idx) sh = rh; r.style.transition = 'transform .25s var(--ease)'; r.style.transform = sh ? `translateY(${sh}px)` : ''; });
      };
      const up = () => {
        h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
        const id = row.dataset.id, arr = S.rotation.filter(G); arr.splice(i0, 1); arr.splice(idx, 0, id); S.rotation = arr; save();
        if (idx !== i0) { Snd.ok(); vib(10); }
        this.body(el);
      };
      h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
  },
  addSheet(el) {
    const free = S.gestures.filter(g => !S.rotation.includes(g.id));
    sheet(`<h2 style="margin-top:0">Добавить в ротацию</h2>${free.length ? `<div class="gest-grid">${free.map(g => `<button class="gcard" data-id="${g.id}"><div class="hw">${handSVG(g.closed)}</div><b>${esc(g.name)}</b></button>`).join('')}</div>` : '<p class="sub">Все жесты уже в ротации. Создайте новый!</p>'}<button class="btn ghost" data-go="editor" style="margin-top:12px">${ic('plus')} Создать жест</button>`, (sh, close) => {
      sh.addEventListener('click', e => { const c = e.target.closest('.gcard'); if (c) { S.rotation.push(c.dataset.id); save(); close(); toast('layers', 'Добавлено в ротацию', G(c.dataset.id).name); this.body(el); checkAch(); } if (e.target.closest('[data-go]')) close(); });
    });
  }
};
function gestureSheet(id) {
  const g = G(id);
  sheet(`<div class="between"><h2 style="margin:0">${esc(g.name)}</h2><span class="tag ${g.builtin ? 'soft' : 'ok'}">${g.builtin ? 'Стандартный' : 'Мой жест'}</span></div>
    <div class="editor-stage" style="height:250px;margin-top:12px"><div id="gsHand"></div><div class="hint" id="gsHint">Открытое ↔ закрытое положение</div></div>
    <div class="grid3" style="margin-top:12px"><div class="kpi"><div class="l">Использован</div><div class="v" style="font-size:18px">${fmtN(S.stats.gestTotal[id] || 0)}</div></div><div class="kpi"><div class="l">Сегодня</div><div class="v" style="font-size:18px">${today().gest[id] || 0}</div></div><div class="kpi"><div class="l">В ротации</div><div class="v" style="font-size:18px">${S.rotation.includes(id) ? '№' + (S.rotation.indexOf(id) + 1) : '—'}</div></div></div>
    <div class="row" style="margin-top:14px">${id === S.activeId ? `<button class="btn" data-x="apply" disabled>${ic('check')} Уже активен</button>` : `<button class="btn" data-x="apply">${ic('hand')} Применить</button>`}</div>
    <div class="row" style="margin-top:10px"><button class="btn ghost sm" data-x="rot">${S.rotation.includes(id) ? 'Убрать из ротации' : 'В ротацию'}</button><button class="btn ghost sm" data-x="edit">${ic('edit')} ${g.builtin ? 'Копия' : 'Изменить'}</button>${!g.builtin ? `<button class="btn ghost sm" data-x="del" style="color:var(--err);width:60px;flex:none">${ic('trash')}</button>` : ''}</div>`, (sh, close) => {
    const hv = new HandView($('#gsHand', sh)); hv.svg.style.cssText = 'height:100%;width:auto';
    const t0 = performance.now(); let run = true;
    const loop = now => { if (!run || !sh.isConnected) return; const k = (Math.sin((now - t0) / 650 - 1.57) + 1) / 2; hv.set(g.open.map((v, i) => lerp(v, g.closed[i], k))); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    sh.addEventListener('click', e => {
      const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return;
      if (x === 'apply') { Prosthesis.setActive(id); toast('hand', 'Жест применён', g.name); Snd.ok(); }
      if (x === 'rot') { if (S.rotation.includes(id)) { if (S.rotation.length > 1) S.rotation = S.rotation.filter(r => r !== id); else { toast('info', 'В ротации должен остаться хотя бы один жест'); return; } } else S.rotation.push(id); save(); checkAch(); }
      if (x === 'edit') { run = false; close(); App.go('editor', g.builtin ? { copy: id } : { id }); return; }
      if (x === 'del') {
        run = false; close();
        modal(`${badge('trash', 'rose', 'xl')}<b style="display:block;font-size:17px;margin-top:10px">Удалить «${esc(g.name)}»?</b><p class="sub">Жест пропадёт из коллекции и группы ротации. Статистика использования сохранится.</p><div class="row"><button class="btn ghost sm" data-x="no">Отмена</button><button class="btn danger sm" data-x="yes">Удалить</button></div>`, (m, cl) => m.onclick = ev => {
          const y = ev.target.closest('[data-x]')?.dataset.x; if (!y) return; cl(); if (y !== 'yes') return;
          S.gestures = S.gestures.filter(z => z.id !== id); S.rotation = S.rotation.filter(r => r !== id); if (!S.rotation.length) S.rotation = [S.gestures[0].id]; if (S.activeId === id) Prosthesis.setActive(S.rotation[0]); save(); toast('trash', 'Жест удалён', g.name); if (App.cur.name === 'gestures') App.refresh();
        });
        return;
      }
      run = false; close(); if (App.cur.name === 'gestures') App.refresh();
    });
  }, { onClose: () => { } });
}

/* ---------- Редактор жеста ---------- */
SCR.editor = {
  full: false, noEmu: true,
  render(p) {
    const src = p.id ? G(p.id) : p.copy ? G(p.copy) : null;
    this.g = src ? structuredClone(src) : { id: null, name: 'Жест №' + (S.gestures.filter(g => !g.builtin).length + 1), open: [5, 5, 5, 5, 5, 30], closed: [50, 60, 60, 60, 60, 60] };
    if (p.copy && src) { this.g.id = null; this.g.name = src.name + ' (мой)'; this.g.builtin = false; }
    this.side = 'closed'; this.sel = 1; this.preview = false;
    this.g0 = JSON.stringify([this.g.name, this.g.open, this.g.closed]); this.saved = false;
    return `<div class="back"><button class="ib" id="eBack" title="Назад">${ic('back')}</button><input class="grow" id="eName" maxlength="28" value="${esc(this.g.name)}" style="border:0;background:none;font-weight:800;font-size:19px;outline:none;min-width:0"><button class="ib" id="eRename">${ic('edit')}</button></div>
      ${seg('side', [['open', 'Открытое положение'], ['closed', 'Закрытое положение']], 'closed')}
      <div class="editor-stage" style="margin-top:12px" id="eStage"><div id="eHand"></div>
        <div class="tools"><button class="ib" id="ePlay" title="Проверить">${ic('play')}</button><button class="ib" id="eUndo" title="Сбросить">${ic('refresh')}</button><button class="ib" id="eDev" title="Отправить на протез">${ic('bt')}</button></div>
        <div class="hint" id="eHint">Нажми на палец и тяни вверх-вниз</div></div>
      <div class="gbtns" style="margin-top:12px" id="ePre">
        <button class="chipbtn" data-pre="open">Раскрыть всё</button><button class="chipbtn" data-pre="fist">Сжать всё</button><button class="chipbtn" data-pre="half">Наполовину</button><button class="chipbtn" data-pre="copy">Копия другой позы</button></div>
      <div class="fingers" id="eF"></div>
      <button class="btn" id="eSave" style="margin-top:16px">${ic('check')} Сохранить жест</button>`;
  },
  mount(el, p) {
    this.hv = new HandView($('#eHand', el), { onSelect: i => { this.sel = i; this.syncSel(el); Snd.tick(); vib(5); } });
    this.hv.sel = this.sel;
    this.cur = this.g[this.side].slice();
    bindSeg(el, 'side', v => { this.side = v; this.cur = this.g[v].slice(); this.preview = false; this.fingers(el); });
    this.fingers(el);
    // перетаскивание по сцене меняет сгиб выбранного пальца
    const st = $('#eStage', el); let y0 = null, v0 = 0;
    st.addEventListener('pointerdown', e => { if (e.target.closest('.tools')) return; this.preview = false; y0 = e.clientY; v0 = this.g[this.side][this.sel]; st.setPointerCapture(e.pointerId); });
    st.addEventListener('pointermove', e => { if (y0 == null) return; const v = clamp(v0 + (e.clientY - y0) * .5, 0, 100); this.setF(el, this.sel, Math.round(v)); });
    st.addEventListener('pointerup', () => y0 = null); st.addEventListener('pointercancel', () => y0 = null);
    $('#ePlay', el).onclick = () => { this.preview = !this.preview; this.t0 = performance.now(); $('#ePlay', el).innerHTML = ic(this.preview ? 'pause' : 'play'); $('#eHint', el).textContent = this.preview ? 'Проверка: открытое ↔ закрытое' : 'Нажми на палец и тяни вверх-вниз'; };
    $('#eUndo', el).onclick = () => { const src = G(p.id || p.copy); this.g[this.side] = src ? src[this.side].slice() : this.side === 'open' ? [5, 5, 5, 5, 5, 30] : [50, 60, 60, 60, 60, 60]; this.fingers(el); };
    $('#eDev', el).onclick = async () => { const sent = await Prosthesis.command('pose', this.g[this.side]); toast('bt', sent ? 'Поза отправлена на протез' : S.device.real ? 'Протез не принимает команды' : 'Поза показана на модели', sent ? 'Протез примет её на 3 секунды' : S.device.real ? 'В профиле протокола не задана характеристика команд' : 'Демо-режим: реальный протез не подключён'); };
    $('#eRename', el).onclick = () => { const n = $('#eName', el); n.focus(); n.select(); };
    $('#ePre', el).onclick = e => {
      const b = e.target.closest('[data-pre]'); if (!b) return; const t = this.g[this.side], k = b.dataset.pre;
      const nv = k === 'open' ? [0, 0, 0, 0, 0, t[5]] : k === 'fist' ? [70, 96, 96, 96, 96, t[5]] : k === 'half' ? [35, 50, 50, 50, 50, t[5]] : this.g[this.side === 'open' ? 'closed' : 'open'].slice();
      this.g[this.side] = nv; this.fingers(el); this.preview = false;
    };
    $('#eSave', el).onclick = () => this.save(el, p);
    $('#eBack', el).onclick = () => {
      const dirty = !this.saved && JSON.stringify([$('#eName', el).value.trim() || this.g.name, this.g.open, this.g.closed]) !== this.g0;
      if (!dirty) { App.back(); return; }
      modal(`${badge('edit', 'peach', 'xl')}<b style="display:block;font-size:17px;margin-top:10px">Выйти без сохранения?</b><p class="sub">Изменения положения пальцев пропадут.</p><div class="row"><button class="btn ghost sm" data-x="out">Выйти</button><button class="btn sm" data-x="save">Сохранить</button></div>`, (m, cl) => m.onclick = e => { const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return; cl(); if (x === 'out') App.back(); else this.save(el, p); });
    };
  },
  setF(el, i, v) { this.g[this.side][i] = v; const o = $(`#eF [data-f="${i}"]`, el); if (o) { $('input', o).value = v; rangeFill($('input', o)); $('output', o).textContent = v + '%'; } },
  syncSel(el) { this.hv.sel = this.sel; $$('#eF .fing', el).forEach(f => f.classList.toggle('sel', +f.dataset.f === this.sel)); },
  fingers(el) {
    const t = this.g[this.side];
    $('#eF', el).innerHTML = [...FINGERS.map((n, i) => [n, i]), ['Оппозиция', 5]].map(([n, i]) => `<div class="fing ${i === this.sel ? 'sel' : ''}" data-f="${i}"><span>${n}</span><input type="range" min="0" max="100" value="${t[i]}"><output>${t[i]}%</output></div>`).join('');
    $$('#eF .fing', el).forEach(f => {
      const i = +f.dataset.f, inp = $('input', f); rangeFill(inp);
      inp.addEventListener('input', () => { this.preview = false; this.g[this.side][i] = +inp.value; rangeFill(inp); $('output', f).textContent = inp.value + '%'; });
      f.addEventListener('pointerdown', () => { if (i < 5) { this.sel = i; this.syncSel(el); } });
    });
    this.syncSel(el);
  },
  frame(dt, now) {
    if (!this.hv) return;
    let target = this.g[this.side];
    if (this.preview) { const k = (Math.sin((now - this.t0) / 600 - 1.57) + 1) / 2; target = this.g.open.map((v, i) => lerp(v, this.g.closed[i], k)); }
    this.cur = this.cur.map((v, i) => v + (target[i] - v) * Math.min(1, dt * 16));
    this.hv.set(this.cur);
  },
  save(el, p) {
    this.g.name = $('#eName', el).value.trim() || this.g.name;
    sheet(`<h2 style="margin-top:0">Сохранить жест</h2><input class="txt" id="sN" value="${esc(this.g.name)}" maxlength="28">
      <div class="set" style="margin-top:10px"><div>Добавить в ротацию<small>Можно переключать со-сокращением</small></div>${sw('addrot', true)}</div>
      <button class="btn" id="sOk" style="margin-top:14px">${ic('check')} Сохранить</button>`, (sh, close) => {
      $('[data-sw]', sh).onclick = e => e.currentTarget.classList.toggle('on');
      $('#sOk', sh).onclick = () => {
        this.g.name = $('#sN', sh).value.trim() || this.g.name;
        const isNew = !this.g.id;
        if (isNew) { this.g.id = 'u' + uid(); this.g.builtin = false; S.gestures.push(this.g); }
        else { const i = S.gestures.findIndex(x => x.id === this.g.id); if (i >= 0) S.gestures[i] = this.g; else S.gestures.push(this.g); } // жест могли удалить, пока шёл редактор
        if ($('[data-sw]', sh).classList.contains('on') && !S.rotation.includes(this.g.id)) S.rotation.push(this.g.id);
        this.saved = true; save(); if (isNew) Mission.ev('gesture:new'); checkAch(); close();
        Prosthesis.setActive(this.g.id, true);
        modal(`<div class="result-hero"><div class="medal hand">${handSVG(this.g.closed)}</div><h1 style="font-size:24px">Жест сохранён!</h1><p class="sub">«${esc(this.g.name)}» ${S.rotation.includes(this.g.id) ? 'добавлен в ротацию и ' : ''}активен на протезе</p></div><button class="btn" data-x="ok">Отлично</button>`, (m, cl) => { $('.medal svg', m).style.height = '130px'; $('[data-x]', m).onclick = () => { cl(); App.go('gestures', { tab: 'col' }); }; });
        confetti(120); Snd.win();
      };
    });
  }
};

/* ---------- Датчики ---------- */
const CO_D = {
  both: 'К1 + К2 вместе — отдельная команда (смена жеста, нитро, ноты «обе»). Тренирует умение разделять 4 состояния.',
  classic: 'Как у протеза в классическом режиме: первый сигнал над порогом держит управление, пока не опустится; второй его не перехватывает.',
  sport: 'Как в спортивном режиме: второй сигнал может перехватить управление до окончания первого. Игровые действия «обе мышцы» отключаются.',
  lock: 'Как при включённой блокировке протеза: пока обе мышцы выше порогов, протез и игра стоят. Тренирует расслаблять лишнюю мышцу — иначе управление блокируется. Действия «обе мышцы» отключаются.'
};
const thrDesc = () => C().thrSrc === 'device'
  ? `Пороги приходят от протеза в потоке данных: К1 ${C().devThr[0]}, К2 ${C().devThr[1]} из 255. Если подвинуть порог на графике, игра перейдёт на свои пороги.`
  : `Свои пороги игры (после калибровки): К1 ${thrToRaw(0)}, К2 ${thrToRaw(1)} из 255. Протез при этом не меняется — по окончании игра вернёт их приложению протеза.`;
const PRESETS = {
  soft: { n: 'Мягко', e: 'moon', d: 'Меньше ложных', v: { gain1: 8, gain2: 8, thr1: .45, thr2: .42, smoothing: .4, hyst: .7, suppressMs: 40 } },
  norm: { n: 'Норма', e: 'sun', d: 'Баланс', v: { gain1: 10, gain2: 10, thr1: .38, thr2: .35, smoothing: .35, hyst: .75, suppressMs: 30 } },
  sharp: { n: 'Чётко', e: 'bolt', d: 'Быстрый отклик', v: { gain1: 13, gain2: 13, thr1: .3, thr2: .28, smoothing: .2, hyst: .8, suppressMs: 30 } }
};
SCR.sensors = {
  tab: 'sensors',
  render() {
    const c = C(), sens = (k, n, col) => `<div class="card sens"><div class="between"><b>${n}</b><span class="tag" style="background:${col}22;color:${col}">x${(c[k] / 10).toFixed(1)}</span></div>
      <div class="stepper"><button data-st="${k}" data-d="-1">−</button><input type="range" min="1" max="20" value="${c[k]}" data-sens="${k}"><button data-st="${k}" data-d="1">+</button><span class="val" id="v_${k}">${c[k]}</span></div></div>`;
    const SP = SP_ALL, SPNl = SP_ALL.map(k => SPN[k]);
    return `<div class="head"><h1>Датчики</h1>${stateChip('sChip')}</div>
      ${seg('mode', [['emg', 'Поток 1 · ЭМГ'], ['spppr', 'Поток 2 · СПППР']], c.mode)}
      <div class="sstat" id="sStat">
        <div><small>Источник</small><b id="sSrc">${Ctrl.source()}</b></div>
        <div><small>${c.mode === 'emg' ? 'Частота' : 'Пакетов'}</small><b id="sRate">—</b></div>
        <div><small>Задержка</small><b id="sLat">—</b></div>
        <div><small>Связь</small><b id="sLink">—</b></div></div>
      <p class="sub" style="margin:10px 2px">Пунктир — порог срабатывания. Тяните цветные метки прямо на графике: выше порог — меньше случайных срабатываний.</p>
      <div class="scope" id="scope"><canvas></canvas>
        <div class="thr c2" id="thr2"><div class="ln"></div><div class="hd">${ic('hand', '', 2.5).replace('<svg', '<svg width="12" height="12"')}<span></span></div><div class="tl">порог открытия</div></div>
        <div class="thr c1" id="thr1"><div class="ln"></div><div class="hd"><span></span></div><div class="tl">порог закрытия</div></div></div>
      <div class="between" style="margin:10px 2px 0"><div class="legend"><span><i style="background:var(--ch1)"></i>К1 · закрытие</span><span><i style="background:var(--ch2)"></i>К2 · открытие</span></div><div class="row small muted" style="gap:6px;font-weight:700">Качество <div class="quality" id="sQ">${[1, 2, 3, 4, 5].map(k => `<i style="height:${6 + k * 3}px"></i>`).join('')}</div></div></div>
      <div class="meter-big" style="margin-top:12px">
        <div class="card mb">${gauge(0, 'var(--ch1)')}<b id="g1v">0</b><small>Закрытие · К1</small></div>
        <div class="card mb">${gauge(0, 'var(--ch2)')}<b id="g2v">0</b><small>Открытие · К2</small></div></div>
      ${c.mode === 'spppr' ? `<h2>Классификатор СПППР</h2><div class="card"><div class="cs2" style="margin:0 0 10px">Вероятности 7 жестов из последнего пакета. Управление: сгибание − разгибание, пронация — «обе мышцы».</div>
        <div class="dist" id="sDist">${SP.map((k, i) => `<div data-k="${k}"${i && !Ctrl.spSet().includes(k) ? ' class="off"' : ''}><span>${SPNl[i]}</span><div class="pbar"><i style="width:0;transition:width .12s"></i></div><em>0%</em></div>`).join('')}</div></div>` : ''}
      <h2>Режим управления</h2>
      <div class="card">${c.mode === 'emg' ? `
        <div class="cs2">Одновременное напряжение К1 + К2</div>
        ${seg('co', [['both', 'Действие 3'], ['classic', 'Классика'], ['sport', 'Спорт'], ['lock', 'Блокировка']], c.coMode)}
        <p class="sub small" style="margin:8px 2px 12px" id="coD">${CO_D[c.coMode]}</p>
        <div class="cs2">Пороги срабатывания</div>
        ${seg('ts', [['game', 'Свои в игре'], ['device', 'Из протеза']], c.thrSrc)}
        <p class="sub small" style="margin:8px 2px 0" id="tsD">${thrDesc()}</p>` : `
        <div class="cs2">Словарь СПППР</div>
        ${seg('spg', [['2', '2 жеста + нейтраль'], ['6', '6 жестов + нейтраль']], String(c.spGest))}
        <p class="sub small" style="margin:8px 2px 0">${c.spGest === 6 ? 'Сгибание, разгибание, пронация, супинация, приведение, отведение. Пронация работает как «обе мышцы»; в «Реакции» и «Школе» нужны все шесть жестов.' : 'Только сгибание и разгибание. Действий «обе мышцы» в играх нет — они подстраиваются под два жеста.'}</p>`}
      </div>
      <h2>Удалённый эмулятор <small class="h2s">пульт на другом устройстве</small></h2>
      <div class="card"><p class="sub small" style="margin:0 2px 10px">На компьютере: <b>node tools/relay.mjs</b>, на втором телефоне откройте адрес, который он покажет. Пакеты идут в том же формате, что от протеза, экранные панели скрываются.</p>
        <div class="row"><input class="txt" id="rmU" inputmode="url" placeholder="http://192.168.1.5:8787" value="${esc(c.remote || '')}" style="flex:1;min-width:0"><button class="btn sm${Remote.on || c.remote ? ' ghost' : ''}" id="rmB" style="width:auto;flex:none">${Remote.on || c.remote ? 'Отключить' : 'Подключить'}</button></div></div>
      <h2>Чувствительность <small class="h2s">усиление сигнала 0.1–2.0×</small></h2>
      ${sens('gain2', 'Датчик открытия', getCss('--ch2') || '#3E9FD6')}${sens('gain1', 'Датчик закрытия', getCss('--ch1') || '#F27D45')}
      <h2>Проверка протеза</h2>
      <div class="row"><button class="btn ghost" id="tOpen">${ic('hand')} Открыть</button><button class="btn ghost" id="tClose">${ic('hand')} Закрыть</button></div>
      <h2>Профиль комфорта <small class="h2s">пороги + сглаживание</small></h2>
      <div class="presets" id="sPre">${Object.entries(PRESETS).map(([k, p]) => `<button data-p="${k}" class="${c.preset === k ? 'on' : ''}">${ic(p.e)}${p.n}<small class="muted" style="font-size:10.5px;font-weight:600">${p.d}</small></button>`).join('')}</div>
      <h2>Калибровка</h2>
      <button class="card set tap" data-go="signal" style="width:100%;text-align:left;padding:14px 16px;margin-bottom:10px"><div class="ico">${ic('flow')}</div><div style="flex:1">Как работает сигнал<small>Сырой сигнал → сглаживание → порог → состояние, задержка вживую</small></div><span class="chev">${ic('chev')}</span></button>
      <button class="card set tap" data-go="calib" style="width:100%;text-align:left;padding:14px 16px"><div class="ico">${ic('calib')}</div><div style="flex:1">${S.calib.done ? 'Откалибровано' : 'Не откалибровано'}<small>${S.calib.done ? 'Последняя: ' + new Date(S.calib.at).toLocaleDateString('ru-RU') + ' · пройти заново' : 'Измерим покой и максимальное усилие мышц'}</small></div><span class="chev">${ic('chev')}</span></button>
      <h2>Тонкая настройка <button class="lnk" id="advT">Показать</button></h2>
      <div class="card hidden" id="adv">
        ${[['smoothing', 'Сглаживание', 0, .8, .05, v => pct(v), 'Убирает дрожание сигнала, но добавляет задержку'], ['deadzone', 'Мёртвая зона', 0, .2, .01, v => pct(v), 'Слабый фон ниже этого уровня считается покоем'], ['hyst', 'Гистерезис', .5, .95, .05, v => pct(v), 'Отпускание при доле порога — без «дребезга»'], ['suppressMs', 'Подавление ложных', 0, 200, 10, v => v + ' мс', 'Сколько сигнал должен держаться, чтобы сработать'], ['switchMs', 'Удержание для смены жеста', 150, 800, 10, v => v + ' мс', 'Время сокращения обеих мышц для переключения'], ['speed', 'Скорость пальцев', .8, 4, .1, v => (+v).toFixed(1) + '×', 'Как быстро кисть закрывается и открывается']].map(([k, n, a, b, s, f, d]) => `<div class="set" style="display:block"><div class="between"><span>${n}<small>${d}</small></span><span class="tag soft" id="a_${k}">${f(c[k])}</span></div><input type="range" min="${a}" max="${b}" step="${s}" value="${c[k]}" data-adv="${k}"></div>`).join('')}
        <button class="btn ghost sm" id="advReset" style="margin:10px 0 4px">${ic('refresh')} Вернуть значения по умолчанию</button>
      </div>`;
  },
  mount(el) {
    const c = C();
    const setThr = (i, v) => {
      // ручная правка порога в игре: дальше пользуемся своими игровыми порогами (пороги протеза не трогаем)
      if (c.thrSrc === 'device') { c.thrSrc = 'game'; toast('sliders', 'Пороги изменены в игре', 'Пороги протеза не меняются — вернуть их можно в «Режиме управления»'); $$('[data-seg="ts"] button', el).forEach(b => b.classList.toggle('on', b.dataset.v === 'game')); }
      c['thr' + i] = +clamp(v, .08, .95).toFixed(2); c.preset = 'custom'; save(); this.place(el); $$('#sPre button', el).forEach(b => b.classList.remove('on')); const d = $('#tsD', el); if (d) d.textContent = thrDesc();
    };
    $('#rmB', el).onclick = () => { if (Remote.on || C().remote) { Remote.stop(); toast('wave', 'Удалённый эмулятор отключён'); } else Remote.connect($('#rmU', el).value); setTimeout(() => App.cur?.name === 'sensors' && App.refresh(), 300); };
    bindSeg(el, 'co', v => { c.coMode = v; save(); $('#coD', el).textContent = CO_D[v]; });
    bindSeg(el, 'ts', v => { c.thrSrc = v; Ctrl.applyDevThr(); save(); this.place(el); $('#tsD', el).textContent = thrDesc(); });
    bindSeg(el, 'spg', v => { c.spGest = +v; save(); renderEmu(); setTimeout(() => App.cur?.name === 'sensors' && App.refresh(), 300); });
    ['thr1', 'thr2'].forEach((id, k) => {
      const t = $('#' + id, el), i = k + 1;
      t.addEventListener('pointerdown', e => { t.setPointerCapture(e.pointerId); t.classList.add('drag'); t._d = true; vib(5); });
      t.addEventListener('pointermove', e => { if (!t._d) return; const r = $('#scope', el).getBoundingClientRect(); setThr(i, 1 - (e.clientY - r.top - 14) / (r.height - 28)); });
      const up = () => { t._d = false; t.classList.remove('drag'); }; t.addEventListener('pointerup', up); t.addEventListener('pointercancel', up);
    });
    this.place(el); this.ro = new ResizeObserver(() => this.place(el)); this.ro.observe($('#scope', el));
    const syncGain = k => { const inp = $(`[data-sens="${k}"]`, el); inp.value = c[k]; rangeFill(inp); $('#v_' + k, el).textContent = c[k]; inp.closest('.card').querySelector('.tag').textContent = 'x' + (c[k] / 10).toFixed(1); };
    const setGain = (k, v) => { c[k] = clamp(Math.round(v), 1, 20); c.preset = 'custom'; Ctrl.applyDevThr(); this.place(el); save(); syncGain(k); $$('#sPre button', el).forEach(b => b.classList.remove('on')); };
    $$('[data-sens]', el).forEach(inp => { rangeFill(inp); inp.addEventListener('input', () => setGain(inp.dataset.sens, +inp.value)); });
    $$('[data-st]', el).forEach(b => b.addEventListener('click', () => { setGain(b.dataset.st, c[b.dataset.st] + +b.dataset.d); Snd.tick(); }));
    const cmd = async k => { const sent = await Prosthesis.command(k); toast('hand', k === 'open' ? 'Команда: открыть' : 'Команда: закрыть', sent ? 'Отправлено на протез' : 'Показано на модели протеза'); };
    $('#tOpen', el).onclick = () => cmd('open'); $('#tClose', el).onclick = () => cmd('close');
    $('#sPre', el).onclick = e => {
      const b = e.target.closest('[data-p]'); if (!b) return; Object.assign(c, PRESETS[b.dataset.p].v); c.preset = b.dataset.p; save();
      $$('#sPre button', el).forEach(x => x.classList.toggle('on', x === b)); this.place(el);
      Ctrl.applyDevThr(); ['gain1', 'gain2'].forEach(syncGain);
      toast(PRESETS[b.dataset.p].e, 'Профиль «' + PRESETS[b.dataset.p].n + '»', 'Пороги и чувствительность обновлены');
    };
    $('#advT', el).onclick = e => { const a = $('#adv', el); a.classList.toggle('hidden'); e.target.textContent = a.classList.contains('hidden') ? 'Показать' : 'Скрыть'; if (!a.classList.contains('hidden')) a.style.animation = 'fadeUp .4s both'; };
    bindSeg(el, 'mode', v => { if (C().mode === v) return; C().mode = v; save(); Ctrl.restart(); renderEmu(); toast(v === 'emg' ? 'bolt' : 'layers', v === 'emg' ? 'Поток 1: ЭМГ' : 'Поток 2: СПППР'); setTimeout(() => App.cur?.name === 'sensors' && App.refresh(), 380); });
    $('#advReset', el).onclick = () => { ['smoothing', 'deadzone', 'hyst', 'suppressMs', 'switchMs', 'speed'].forEach(k => c[k] = DEF.cfg[k]); save(); toast('refresh', 'Тонкая настройка сброшена'); this.advOpen = true; App.refresh(); };
    if (this.advOpen) { $('#adv', el).classList.remove('hidden'); $('#advT', el).textContent = 'Скрыть'; this.advOpen = false; }
    $$('[data-adv]', el).forEach(inp => { rangeFill(inp); inp.addEventListener('input', () => { const k = inp.dataset.adv; c[k] = +inp.value; save(); rangeFill(inp); const f = { smoothing: pct, deadzone: pct, hyst: pct, suppressMs: v => v + ' мс', switchMs: v => v + ' мс', speed: v => (+v).toFixed(1) + '×' }[k]; $('#a_' + k, el).textContent = f(c[k]); }); });
  },
  unmount() { this.ro?.disconnect(); },
  place(el) {
    const sc = $('#scope', el); if (!sc) return; const H = sc.offsetHeight || 250;
    [1, 2].forEach(i => { const t = $('#thr' + i, el), v = C()['thr' + i]; t.style.top = (14 + (1 - v) * (H - 28)) + 'px'; $('.hd span', t).textContent = Math.round(v * 100); t.title = 'В шкале датчика: ' + thrToRaw(i - 1) + ' из 255'; });
  },
  frame(dt, now, el) {
    const cv = $('#scope canvas', el); drawTrace(cv, 420, { grid: true, states: true, pad: 14, lw: 2.2 });
    updChip($('#sChip', el)); const so = $('#sSrc', el); if (so && so.textContent !== Ctrl.source()) so.textContent = Ctrl.source();
    if (!this.stT || now - this.stT > 300) {
      this.stT = now; const emg = C().mode === 'emg', lat = Ctrl.latency();
      $('#sRate', el).textContent = emg ? (Ctrl.lossFlag ? 'нет' : Ctrl.rate + ' Гц') : fmtN(Ctrl.pkts);
      $('#sLat', el).textContent = lat ? Math.round(lat) + ' мс' : '—';
      const lk = $('#sLink', el); lk.textContent = Ctrl.lossFlag ? 'потеря' : 'норма'; lk.style.color = Ctrl.lossFlag ? 'var(--err)' : 'var(--ok)';
      const d = Ctrl.lastPkt?.dist; if (d) $$('#sDist [data-k]', el).forEach(r => { const v = clamp(+d[r.dataset.k] || 0); $('i', r).style.width = pct(v); $('em', r).textContent = pct(v); r.classList.toggle('top', v === Math.max(...Object.values(d))); });
    }
    const g = $$('.gauge', el); if (g.length) { setGauge(g[0], Ctrl.a[0]); setGauge(g[1], Ctrl.a[1]); $('#g1v', el).textContent = Math.round(Ctrl.a[0] * 100); $('#g2v', el).textContent = Math.round(Ctrl.a[1] * 100); }
    // качество: шум в покое
    if (!this.qT || now - this.qT > 400) {
      this.qT = now; const rest = Sig.buf.slice(-120).filter(b => b[2] === 'REST'); if (rest.length > 30) {
        const m = rest.reduce((a, b) => a + b[0] + b[1], 0) / rest.length / 2, v = Math.sqrt(rest.reduce((a, b) => a + ((b[0] + b[1]) / 2 - m) ** 2, 0) / rest.length);
        const q = clamp(1 - v * 12 - m * 1.5), n = Math.round(q * 5); $$('#sQ i', el).forEach((x, k) => x.style.background = k < n ? (n >= 4 ? 'var(--ok)' : n >= 2 ? 'var(--warn)' : 'var(--err)') : 'var(--line)');
      }
    }
  }
};

/* ---------- Калибровка ---------- */
SCR.calib = {
  render() {
    this.steps = [['Расслабьте мышцы', 'rest', 'Рука спокойно лежит 3 секунды'], ['Сожмите максимально', 'mvc1', 'Сильно напрягите сгибатели (К1) и держите'], ['Раскройте максимально', 'mvc2', 'Сильно напрягите разгибатели (К2) и держите']];
    return `<div class="back"><button class="ib" data-back>${ic('back')}</button><span class="grow">Калибровка</span></div>
      <p class="sub">Измерим покой и максимальное усилие каждой мышцы — пороги подстроятся под вас.</p>
      <div class="card" style="text-align:center;padding:20px"><div class="big-ring" id="cRing">${ring(0, 'var(--primary)', 160, 12)}<div class="c"><div><b id="cN">—</b><small class="muted" id="cS">готово к старту</small></div></div></div>
      <h3 id="cT" style="margin:6px 0 4px">Нажмите «Начать»</h3><p class="sub" id="cD" style="margin:0;min-height:40px">Лучше сидя, предплечье на столе</p>
      <div class="cbars"><div><div class="pbar"><i id="cb1"></i></div><small>К1 · сгибатели</small></div><div><div class="pbar"><i id="cb2"></i></div><small>К2 · разгибатели</small></div></div></div>
      <div class="card" style="margin-top:12px">${this.steps.map((s, i) => `<div class="calib-step" data-s="${i}"><div class="cn">${i + 1}</div><div style="flex:1;min-width:0"><b style="font-size:14px">${s[0]}</b><div class="muted small">${s[2]}</div></div></div>`).join('')}</div>
      <div id="cBtns" style="margin-top:14px"><button class="btn" id="cGo">${ic('play')} Начать</button></div>`;
  },
  mount(el) { this.el = el; this.running = false; this.abort = false; $('#cGo', el).onclick = () => this.run(el); },
  unmount() { this.abort = true; this.running = false; this.runId = (this.runId || 0) + 1; },
  setRing(el, p) { const c = $('#cRing circle[data-off]', el); if (!c) return; const L = +c.getAttribute('stroke-dasharray'); c.style.transition = 'none'; c.style.strokeDashoffset = L * (1 - clamp(p)); },
  resetUi(el) { $$('.calib-step', el).forEach(r => { r.classList.remove('done', 'now'); $('.cn', r).textContent = +r.dataset.s + 1; }); this.setRing(el, 0); $('#cN', el).textContent = '—'; $('#cS', el).textContent = 'готово к старту'; },
  async measure(el, dur, dead) {
    const vals = [], t0 = performance.now();
    while (performance.now() - t0 < dur) {
      if (dead() || !el.isConnected) return null; await sleep(30);
      const e = performance.now() - t0; vals.push(Ctrl.raw.slice());
      this.setRing(el, e / dur); $('#cN', el).textContent = Math.max(1, Math.ceil((dur - e) / 1000)); $('#cS', el).textContent = 'секунд';
    }
    return vals;
  },
  async run(el) {
    if (this.running) return;
    if (C().mode !== 'emg') { toast('info', 'В режиме СПППР калибровка не нужна', 'Классификатор уже нормирует сигнал'); return; }
    this.running = true; this.abort = false; const id = this.runId = (this.runId || 0) + 1, dead = () => this.abort || id !== this.runId; this.resetUi(el);
    $('#cBtns', el).innerHTML = `<button class="btn ghost" id="cStop">${ic('x')} Остановить</button>`;
    $('#cStop', el).onclick = () => { this.abort = true; };
    const med = a => quantile(a, .5), p90 = a => quantile(a, .9);
    const res = {};
    for (let i = 0; i < 3; i++) {
      const [t, k, d] = this.steps[i], row = $(`[data-s="${i}"]`, el);
      let tries = 0, ok = false;
      while (!ok) {
        row.classList.add('now');
        $('#cT', el).textContent = t; $('#cD', el).textContent = 'Приготовьтесь…'; $('#cN', el).textContent = '•'; $('#cS', el).textContent = 'сейчас начнём'; this.setRing(el, 0);
        await sleep(1100); if (dead()) return id === this.runId && this.stop(el);
        $('#cD', el).textContent = d; Snd.go();
        const vals = await this.measure(el, 3000, dead); if (!vals) return id === this.runId && this.stop(el);
        const c1 = vals.map(v => v[0]), c2 = vals.map(v => v[1]);
        let msg = '';
        if (k === 'rest') { res.base1 = med(c1); res.base2 = med(c2); if (res.base1 > .25 || res.base2 > .25) msg = 'Во время покоя мышцы были напряжены — расслабьте руку полностью'; }
        else {
          const ch = k === 'mvc1' ? 0 : 1, main = ch ? c2 : c1, other = ch ? c1 : c2, base = ch ? res.base2 : res.base1, peak = p90(main);
          res[k] = peak;
          if (peak - base < .25) msg = 'Сокращение слишком слабое — напрягите сильнее и держите все 3 секунды';
          else if (med(other) > peak * .7) msg = 'Вторая мышца тоже напряглась — постарайтесь сократить только ' + (ch ? 'разгибатели (К2)' : 'сгибатели (К1)');
        }
        if (msg) { tries++; Snd.bad(); $('#cD', el).textContent = msg; toast('info', 'Повторим шаг', msg); await sleep(1600); if (dead()) return id === this.runId && this.stop(el); if (tries >= 3) { this.stop(el, 'Не получилось — проверьте датчики и попробуйте снова'); return; } }
        else ok = true;
      }
      row.classList.remove('now'); row.classList.add('done'); $('.cn', row).innerHTML = ic('check'); Snd.ok();
      await sleep(300); if (dead()) return id === this.runId && this.stop(el);
    }
    Object.assign(S.calib, res, { done: true, at: Date.now() }); Ctrl.applyDevThr(); save(); // пороги протеза (0…255) — в новую шкалу
    this.running = false; Snd.win(); confetti(60);
    $('#cT', el).textContent = 'Калибровка завершена'; $('#cD', el).textContent = `Покой ${res.base1.toFixed(2)} / ${res.base2.toFixed(2)} · максимум ${res.mvc1.toFixed(2)} / ${res.mvc2.toFixed(2)}`;
    $('#cN', el).innerHTML = '✓'; $('#cS', el).textContent = 'готово'; this.setRing(el, 1);
    $('#cBtns', el).innerHTML = `<div class="row"><button class="btn ghost" id="cAgain">${ic('refresh')} Заново</button><button class="btn" id="cDone">${ic('sliders')} К датчикам</button></div>`;
    $('#cAgain', el).onclick = () => this.run(el); $('#cDone', el).onclick = () => App.go('sensors');
    setTimeout(() => { Mission.ev('calib'); checkAch(); }, 400);
  },
  stop(el, msg) {
    this.running = false; if (!el.isConnected) return;
    this.resetUi(el); $('#cT', el).textContent = msg ? 'Калибровка не завершена' : 'Калибровка остановлена'; $('#cD', el).textContent = msg || 'Прежние настройки сохранены';
    $('#cBtns', el).innerHTML = `<button class="btn" id="cGo">${ic('play')} Начать заново</button>`; $('#cGo', el).onclick = () => this.run(el);
  },
  frame(dt, now, el) { const a = $('#cb1', el); if (a) { a.style.width = pct(clamp(Ctrl.raw[0])); $('#cb2', el).style.width = pct(clamp(Ctrl.raw[1])); } }
};

/* ---------- Игры ---------- */
const dailyAvail = () => S.dailyDone !== dayKey();
const dailyGame = () => { const d = new Date(), a = ARCADE(); return a[(d.getDate() + d.getMonth()) % a.length]; };
function gst(id) { const s = S.games[id] ||= { best: 0, plays: 0, stars: 0 }; if (!s.ls) s.ls = [s.stars || 0, 0, 0]; return s; }
const unlockedLv = id => { const s = gst(id); let n = 1; while (n < 3 && s.ls[n - 1] >= 1) n++; return n; };
/* бесконечный режим открывается после прохождения уровня 3; сложность подстраивается после каждой игры (2…4.5) */
const endlessOpen = id => gst(id).ls[2] >= 1;
const adaptOf = id => clamp(gst(id).adapt ?? 3, 2, 4.5);
const totalStars = () => ARCADE().reduce((a, id) => a + gst(id).ls.reduce((x, y) => x + y, 0), 0);
const lvlBars = id => { const s = gst(id), u = unlockedLv(id); return `<div class="lvls">${[0, 1, 2].map(i => `<i class="${s.ls[i] >= 1 ? 'on' : i === u - 1 ? 'cur' : ''}"></i>`).join('')}</div>`; };
/* рекорд: из сохранённой статистики игры и из истории (включая демо-историю первого запуска) */
const lvName = lv => lv >= 4 ? 'бесконечный' : 'ур. ' + lv;
const plur = (n, a, b, c) => { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c); };
const playsOf = id => Math.max(S.games[id]?.plays || 0, S.history.filter(h => h.game === id).length);
const bestScore = id => Math.max(S.games[id]?.best || 0, ...S.history.filter(h => h.game === id && h.win !== false).map(h => h.score || 0));
const starStr = n => `${'★'.repeat(n)}<span>${'★'.repeat(3 - n)}</span>`;
const ctlList = g => `<div class="ctl-list">${g.ctl.map(([a, b, c]) => `<div><i style="--c:${c}">${a}</i><span>${b}</span></div>`).join('')}</div>`;
SCR.games = {
  tab: 'games',
  render() {
    const daily = dailyGame(), DG = GAMES[daily], sch = gst('school'), ts = totalStars(), tmax = ARCADE().length * 9;
    const plays = ARCADE().reduce((a, id) => a + playsOf(id), 0), lvDone = ARCADE().reduce((a, id) => a + gst(id).ls.filter(x => x >= 1).length, 0);
    const sk = skills().sort((a, b) => a.value - b.value);
    return `<div class="head"><h1>Игры</h1><span class="tag soft">${ic('star')} ${ts} / ${tmax}</span></div>
      <div class="card gsum">${ring(ts / tmax, 'var(--s4)', 64, 8)}<div class="grow"><b>Пройдено уровней: ${lvDone} из ${ARCADE().length * 3}</b>
        <small>Сыграно: ${plur(plays, 'игра', 'игры', 'игр')} · слабый навык — ${sk[0].label.toLowerCase()} (${Math.round(sk[0].value * 100)}%), сильный — ${sk.at(-1).label.toLowerCase()}</small>
        <div class="skl">${sk.map(s => `<span title="${s.label}: ${Math.round(s.value * 100)}%"><b class="skv">${Math.round(s.value * 100)}</b><i style="height:${Math.round(4 + clamp((s.value - .3) / .7) * 22)}px"></i><em>${s.label.slice(0, 4)}</em></span>`).join('')}</div></div></div>
      <div class="list" style="margin-top:12px">
        ${storyCard()}
        <button class="lrow" data-duel="1">${badge('user', 'sky')}<div><b>Дуэль</b><small>2–4 игрока по очереди на одном телефоне · рейтинг</small></div>${ic('chev', 'chev')}</button>
        <button class="lrow" data-play="school">${gIcon('school')}<div><b>Школа управления</b><small>Режим обучения · 7 упражнений</small></div>${sch.plays ? `<span class="tag ok">${ic('check')}</span>` : '<span class="tag soft">начни здесь</span>'}</button>
        ${(c => `<button class="lrow" data-weekly="1">${badge('calendar', 'lilac')}<div><b>Испытание недели · ${GAMES[c.id].t}</b><small>${c.w.done ? 'Выполнено · можно улучшать результат' : `Уровень ${c.lv}, точность от ${c.acc}% · +150 XP и деталь`}</small></div>${c.w.done ? `<span class="tag ok">${ic('check')}</span>` : '<span class="tag soft">неделя</span>'}</button>`)(Weekly.cur())}
        <button class="lrow" data-play="${daily}" data-daily="1">${gIcon(daily)}<div><b>Испытание дня · ${DG.t}</b><small>${dailyAvail() ? 'Двойной опыт за прохождение' : 'Выполнено сегодня — завтра новое'}</small></div>${dailyAvail() ? '<span class="tag soft">×2 XP</span>' : `<span class="tag ok">${ic('check')}</span>`}</button>
      </div>
      <h2>Мини-игры <small class="h2s">3 уровня и бесконечный режим</small></h2>
      <div class="games-list stg">${ARCADE().map(id => { const g = GAMES[id], s = gst(id), st = s.ls.reduce((a, b) => a + b, 0), u = unlockedLv(id), best = bestScore(id); return `<button class="game-card" data-play="${id}"><div class="gc-prev"><canvas data-prev="${id}"></canvas><span class="gc-lv">Уровень ${u}${s.ls[2] >= 1 ? ' · пройдено' : ''}</span></div>
        <div class="gc-body">${gIcon(id)}<div class="gc-txt"><b>${g.t}</b><small>${g.skill}</small></div>
        <div class="gc-meta">${lvlBars(id)}<span>★ ${st}/9</span></div></div>
        <div class="gc-foot"><span>${ic('trophy')} ${best ? fmtN(best) : 'нет рекорда'}</span><span>${ic('play')} ${playsOf(id) ? plur(playsOf(id), 'игра', 'игры', 'игр') : 'ещё не играли'}</span><span class="gc-go">Играть ${ic('chev')}</span></div></button>`; }).join('')}</div>
      <div class="note">${ic('info')}<span>Сложность подстраивается: очень чистая игра сразу открывает следующий уровень, при точности ниже 45% приложение предложит уровень проще. После 12 минут — пауза на отдых.</span></div>`;
  },
  mount(el) { el.addEventListener('click', e => { if (e.target.closest('[data-weekly]')) return weeklySheet(); if (e.target.closest('[data-duel]')) return duelSheet(); const p = e.target.closest('[data-play]'); if (p) openGame(p.dataset.play, !!p.dataset.daily); }); },
  frame(dt, now, el) { $$('canvas[data-prev]', el).forEach(cv => { const r = cv.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) paintPreview(cv, now); }); }
};
function openGame(id, daily) {
  const g = GAMES[id], s = gst(id);
  if (g.tut) { App.go('play', { id, diff: 1 }); return; }
  const U = unlockedLv(id); let lv = clamp(Math.round(s.diff || U), 1, U);
  sheet(`<div class="sh-head">${gIcon(id, 'lg')}<div><h2 style="margin:0">${g.t}</h2><small class="muted">${g.skill}</small></div></div>
    <p class="sub" style="margin:12px 0">${g.d}</p>
    <div class="lvl-pick" id="lvP">${[1, 2, 3].map(n => `<button data-l="${n}" class="${n === lv ? 'on' : ''} ${n > U ? 'lock' : ''}"><small>уровень</small><b>${n}</b><span class="st">${n > U ? ic('shield') : starStr(s.ls[n - 1])}</span></button>`).join('')}<button data-l="4" class="${endlessOpen(id) ? '' : 'lock'}"><small>бесконечный</small><b>∞</b><span class="st" style="color:var(--muted);letter-spacing:0">${endlessOpen(id) ? 'сложн. ' + adaptOf(id).toFixed(1) : ic('shield')}</span></button></div>
    <div class="note">${ic('target')}<span id="lvGoal">${g.goal(lv)}</span></div>
    <h3 class="h3">Управление</h3>${ctlList(g)}
    ${s.best ? `<div class="between small muted" style="margin-top:12px;font-weight:700"><span>Рекорд: ${fmtN(s.best)}</span><span>Сыграно: ${s.plays}</span></div>` : ''}
    <button class="btn" id="gGo" style="margin-top:16px">${ic('play')} Играть · уровень <span id="lvN">${lv}</span></button>`, (sh, close) => {
    $('#lvP', sh).onclick = e => { const b = e.target.closest('[data-l]'); if (!b) return; const n = +b.dataset.l;
      if (n === 4 && !endlessOpen(id)) { toast('shield', 'Бесконечный режим закрыт', 'Пройди уровень 3 хотя бы на одну звезду'); return; }
      if (n < 4 && n > U) { toast('shield', 'Уровень закрыт', `Пройди уровень ${n - 1} хотя бы на одну звезду`); return; }
      lv = n; $$('#lvP button', sh).forEach(x => x.classList.toggle('on', x === b)); $('#lvGoal', sh).textContent = n === 4 ? 'Без конца уровней: сложность растёт после чистой игры и снижается после трудной. Сейчас — ' + adaptOf(id).toFixed(1) + ' · ' + g.goal(adaptOf(id)) : g.goal(lv); $('#lvN', sh).textContent = n === 4 ? '∞' : lv; Snd.tick(); };
    $('#gGo', sh).onclick = () => { if (sh._closing) return; close(); if (lv === 4) { App.go('play', { id, diff: adaptOf(id), endless: true, daily }); return; } s.diff = lv; save(); App.go('play', { id, diff: lv, daily }); };
  }, { onClose: () => { } });
}

/* ---------- Игровой экран ---------- */
/* уровень игры: обычный — целый 1…3, бесконечный — дробный 2…4.5, обучение — 1.
   Иначе deep link (?diff=999) записал бы звёзды в st.ls[998] и испортил сохранение. */
function normDiff(p) {
  const g = GAMES[p.id], v = +p.diff;
  if (g.tut) p.diff = 1;
  else if (p.endless) p.diff = +clamp(Number.isFinite(v) ? v : 3, 2, 4.5).toFixed(2);
  else p.diff = clamp(Math.round(Number.isFinite(v) ? v : 1), 1, 3);
  return p;
}
SCR.play = {
  full: true, noEmu: true,
  valid: p => !!p && typeof p.id === 'string' && Object.hasOwn(GAMES, p.id) && !!normDiff(p),
  render(p) {
    const g = GAMES[p.id], lv = p.diff || 1, lvT = p.endless ? 'Бесконечный · ' + lv.toFixed(1) : 'Уровень ' + lv;
    return `<div class="ghud"><button class="ib" id="gP">${ic('pause')}</button><div class="gt"><b>${g.t}</b><small>${g.tut ? 'Режим обучения' : lvT}</small></div><div class="gs"><b id="gScore">0</b><small id="gTime"></small></div></div>
      <div class="gprog"><i id="gProg"></i></div>
      <div class="ginfo" id="gChips"></div>
      <div class="gwrap"><canvas id="gc"></canvas><div class="countdown" id="gCd"></div>
        <div class="intro" id="gIntro"><div class="ic">${gIcon(p.id, 'lg')}${p.duel ? `<small class="ep-t">Дуэль · ход: ${esc(p.duel)}</small>` : p.story ? `<small class="ep-t">${esc(Story.epTitle(p.id, lv))}</small>` : ''}<h3>${g.t}${g.tut ? '' : p.endless ? ' · бесконечный' : ' · уровень ' + lv}</h3><p>${g.goal(lv)}</p>
          ${ctlList(g)}
          <button class="btn sm" id="gStart">${ic('play')} Старт</button><div class="sq"><i id="gSq"></i></div><div class="hint">или сожми К1 и подержи секунду</div></div></div></div>
      <div class="ghint" id="gHint"></div>
      <div class="gctl"><div class="pad c1 m1" data-ch="0"><div class="fill"></div><div class="thl"></div><span>Закрыть · К1</span><kbd>F</kbd></div>
        <div class="chip" id="gChip"><i></i><span>Покой</span></div>
        <div class="pad c2 m2" data-ch="1"><div class="fill"></div><div class="thl"></div><span>Открыть · К2</span><kbd>J</kbd></div></div>`;
  },
  mount(el, p) {
    Rewards.list = []; this.p = p; if (p.duel) Duel.useCal(p.duel); this.game = new GAMES[p.id].cls(p.diff || 1); this.paused = true; this.ended = false; this.lastScore = 0; this.intro = true; this.sq = 0; this.lastChips = ''; this.lastHint = null; this.qc = null; this.tl = []; this.tlT = 0;
    this.cv = $('#gc', el); this.ctx = this.cv.getContext('2d'); this.fit();
    $$('.pad', el).forEach(bindPad);
    $('#gP', el).onclick = () => this.intro ? App.back() : this.pause();
    $('#gStart', el).onclick = () => this.begin(el);
    this.off = Bus.on('state', e => { if (!this.paused && !this.ended) this.game.onState(e); });
    this.offDev = Bus.on('device:lost', () => { if (!this.intro) this.pause('Связь с протезом потеряна', 'Приложение переподключается автоматически. Продолжите, когда протез снова будет на связи.'); });
    // нет данных > 1.5 с — критическая потеря: управление остановлено, игра на паузе до восстановления связи
    this.offSig = Bus.on('signal:lost', () => { if (!this.intro && !this.ended) this.pause('Сигнал потерян', 'Данные от датчиков не приходят дольше 1.5 секунды. Управление остановлено, игра на паузе. Продолжить можно, когда связь восстановится.', true); });
    this.ro = new ResizeObserver(() => this.fit()); this.ro.observe(this.cv);
  },
  begin(el) { if (!this.intro) return; this.intro = false; const i = $('#gIntro', el); if (i) { i.style.animation = 'fade .25s reverse both'; setTimeout(() => i.remove(), 240); } this.needQC() ? this.quick(el) : this.countdown(el); },
  /* Проверка датчиков перед игрой (5 с): покой → К1 → К2. Электроды каждый день стоят чуть иначе — пороги
     подстраиваются к сегодняшнему сигналу, чтобы правильное движение не засчитывалось как промах.
     Не чаще раза в 10 минут; только ЭМГ (у СПППР нет амплитуды). */
  needQC() { if (C().mode === 'emg' && this.p.duel) return true; /* у каждого игрока дуэли своя калибровка */ return C().quickCal && C().mode === 'emg' && !GAMES[this.p.id].tut && Date.now() - (S.lastQC || 0) > 6e5; },
  quick(el) {
    this.qc = { i: 0, t: 0, c: [] };
    $('.gwrap', el).insertAdjacentHTML('beforeend', `<div class="qc" id="gQc">${badge('calib', 'peach', 'lg')}<small class="muted">Проверка датчиков · 5 секунд</small><b id="qcT"></b><span class="sub" id="qcD"></span><div class="qcbar"><i id="qcP"></i></div><button class="btn ghost sm" id="qcSkip">Пропустить</button></div>`);
    $('#qcSkip', el).onclick = () => this.quickEnd(el, null);
  },
  QC: [['Расслабь руку', 'обе мышцы в покое', 1.5], ['Сожми сильно · К1', 'сгибатели, как для крепкого хвата', 1.8], ['Раскрой сильно · К2', 'разгибатели, ладонь широко', 1.8]],
  quickStep(dt, el) {
    const q = this.qc, [t, d, dur] = this.QC[q.i]; q.t += dt;
    (q.c[q.i] ||= [[], []]); q.c[q.i][0].push(Ctrl.raw[0]); q.c[q.i][1].push(Ctrl.raw[1]);
    const T = $('#qcT', el); if (T && T.textContent !== t) { T.textContent = t; $('#qcD', el).textContent = d; Snd.tick(); }
    const P = $('#qcP', el); if (P) P.style.width = pct(clamp(q.t / dur));
    if (q.t >= dur) { q.i++; q.t = 0; if (q.i >= this.QC.length) this.quickEnd(el, q.c); }
  },
  quickEnd(el, c) {
    this.qc = null; $('#gQc', el)?.remove(); S.lastQC = Date.now();
    if (c) {
      const med = a => quantile(a, .5), p90 = a => quantile(a, .9);
      const k = S.calib, out = [];
      for (const i of [0, 1]) {
        const base = med(c[0][i]), peak = p90(c[i + 1][i]), n = i + 1;
        if (peak - base < .15 || base > .3) { out.push(`К${n}: сигнал слабый`); continue; }
        const ob = k['base' + n], om = k['mvc' + n], nb = k.done ? lerp(ob, base, .5) : base, nm = k.done ? lerp(om, Math.max(peak, base + .2), .5) : Math.max(peak, base + .2);
        k['base' + n] = +nb.toFixed(3); k['mvc' + n] = +nm.toFixed(3);
        const ch = Math.round(((nm - nb) / Math.max(.08, om - ob) - 1) * 100); out.push(`К${n} ${ch >= 0 ? '+' : ''}${ch}%`);
      }
      Ctrl.applyDevThr(); save();
      toast('calib', out.some(x => x.includes('слабый')) ? 'Сигнал слабый — проверьте электроды' : 'Датчики подстроены', out.join(' · '));
    }
    this.countdown(el);
  },
  unmount() { this.off?.(); this.offDev?.(); this.offSig?.(); this.offBack?.(); this.ro?.disconnect(); this.ended = true; Ctrl.m = null; if (this.p?.duel) Duel.endCal(this.p.duel); },
  fit() { const dpr = devicePixelRatio || 1, W = this.cv.offsetWidth, H = this.cv.offsetHeight; if (!W) return; this.cv.width = W * dpr; this.cv.height = H * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.game.resize(W, H); },
  async countdown(el) {
    const cd = $('#gCd', el); this.paused = true; this.cdAbort = false; this.countingDown = true;
    for (const n of ['3', '2', '1', 'Старт']) { if (this.ended || !cd?.isConnected || this.cdAbort) { this.countingDown = false; if (cd) cd.innerHTML = ''; return; } cd.innerHTML = `<span style="${n.length > 1 ? 'font-size:52px' : ''}">${n}</span>`; n.length > 1 ? Snd.go() : Snd.tick(); await sleep(n.length > 1 ? 600 : 750); }
    this.countingDown = false; if (this.ended || !cd.isConnected || this.cdAbort) { cd.innerHTML = ''; return; } cd.innerHTML = ''; if (!Ctrl.m) Ctrl.resetMetrics(); this.paused = false;
  },
  pause(title = 'Пауза', text = 'Расслабь руку и подыши. Продолжим, когда будешь готов.', sig = false) {
    if (this.ended || App.cur?.name !== 'play') return;
    if (this.paused && !sig) return; // потеря сигнала прерывает и отсчёт, и обычную паузу: управление без сигнала невозможно
    this.paused = true; this.cdAbort = true; $$('.modal [data-x="go"]').forEach(b => b.closest('.modal').close?.());
    modal(`${badge(title === 'Пауза' ? 'pause' : 'bt', 'peach', 'xl')}<div style="font-size:21px;font-weight:800;margin-top:10px">${title}</div><p class="sub">${text}</p>
      <button class="btn" data-x="go"${sig && Ctrl.lost ? ' disabled' : ''}>${ic('play')} ${sig && Ctrl.lost ? 'Ждём сигнал…' : 'Продолжить'}</button><button class="btn ghost" data-x="re" style="margin-top:8px">${ic('refresh')} Заново</button><button class="btn ghost" data-x="ex" style="margin-top:8px">Выйти</button>`, (m, close) => {
      if (sig) { this.offBack?.(); this.offBack = Bus.on('signal:back', () => { const b = $('[data-x="go"]', m); if (b) { b.disabled = false; b.innerHTML = ic('play') + ' Продолжить'; Snd.ok(); } this.offBack?.(); }); }
      m.onclick = e => { const b = e.target.closest('[data-x]'), x = b?.dataset.x; if (!x || b.disabled) return; close();
        if (x === 'go' && App.cur?.name === 'play') this.countdown(App.cur.el); if (x === 're') App.go('play', this.p); if (x === 'ex') App.go('games', {}, { back: true }); };
    });
  },
  frame(dt, now, el) {
    const g = this.game; if (!g) return;
    if (this.intro) { this.sq = Ctrl.state === 'CH1' ? this.sq + dt : Math.max(0, this.sq - dt * 2); const q = $('#gSq', el); if (q) q.style.width = pct(clamp(this.sq / .9)); if (this.sq >= .9) { Snd.ok(); this.begin(el); } }
    if (this.qc) this.quickStep(dt, el);
    if (!this.paused && !this.ended) {
      g.update(dt, Ctrl, now); if (!this.p.duel) addTrainTime(dt); // время гостя в дуэли — не в статистику владельца
      // лента активности каналов для карты игры: каждые 0.2 с — состояние и признак встречного сокращения
      this.tlT += dt; if (this.tlT >= .2) { this.tlT -= .2; const st = { REST: 0, CH1: 1, CH2: 2, BOTH: 3 }[Ctrl.state] || 0, c = C(), lk = (st === 1 && Ctrl.a[1] > c.thr2 * .5) || (st === 2 && Ctrl.a[0] > c.thr1 * .5); this.tl.push(st + (lk ? 4 : 0)); if (this.tl.length > 900) this.tl.shift(); }
      if (g.done) this.finish();
    }
    g.draw(this.ctx);
    const sc = Math.round(g.score || 0), sb = $('#gScore', el); if (sb && sc !== this.lastScore) { sb.textContent = fmtN(sc); if (sc > this.lastScore) { sb.classList.add('bump'); setTimeout(() => sb.classList.remove('bump'), 150); } this.lastScore = sc; }
    const tt = $('#gTime', el); if (tt) tt.textContent = g.hud ? g.hud() : '';
    const pg = $('#gProg', el); if (pg && g.progress) pg.style.width = pct(g.progress());
    const chips = (g.chips?.() || []).map(([k, v, c]) => `<span${c ? ` style="--c:${c}"` : ''}><em>${k}</em>${v}</span>`).join('');
    if (chips !== this.lastChips) { $('#gChips', el).innerHTML = chips; this.lastChips = chips; }
    const h = this.intro ? '' : this.paused ? 'Приготовься…' : Ctrl.blocked ? ['Блокировка: обе мышцы выше порога — расслабь лишнюю', 'warn'] : g.hint?.() || ''; const H = Array.isArray(h) ? h : [h, ''];
    if (H.join() !== this.lastHint) { const he = $('#gHint', el); he.textContent = H[0]; he.className = 'ghint ' + (H[1] || ''); this.lastHint = H.join(); Voice.hint(H, this.p.id); }
    const ck = Ctrl.blocked ? 'LOCK' : Ctrl.state, ch = $('#gChip', el), s = Ctrl.blocked ? LOCK_ST : ST[Ctrl.state]; if (ch && ch._s !== ck) { ch._s = ck; ch.style.setProperty('--sc', s.hex); ch.classList.toggle('on', ck !== 'REST'); $('span', ch).textContent = s.n; }
    $$('.pad', el).forEach(p => { const i = +p.dataset.ch; $('.fill', p).style.height = pct(Ctrl.a[i]); $('.thl', p).style.bottom = pct(C()['thr' + (i + 1)]); p.classList.toggle('hot', Ctrl.on[i]); });
  },
  finish() {
    this.ended = true; const g = this.game, r = g.result(), id = this.p.id, lv = this.p.diff || 1, hasAct = Ctrl.m && Ctrl.m.active > .5, purity = hasAct ? Ctrl.clean() : null;
    r.purity = purity; r.bal = Ctrl.balance(); r.fat = Ctrl.fatigue(); r.lat = Ctrl.latency() || null;
    if (r.bal != null) r.extra.push(['Баланс К1 / К2', `${Math.round(r.bal * 100)} / ${100 - Math.round(r.bal * 100)} %`]);
    if (r.fat != null) r.extra.push(['Сила к концу игры', r.fat > .05 ? '−' + Math.round(r.fat * 100) + ' %' : 'без спада']);
    if (Ctrl.m && C().mode === 'spppr') { const gs = Object.entries(Ctrl.m.gest); if (gs.length) r.extra.push(['Жесты СПППР', gs.map(([k, n]) => SPN[k].slice(0, 4) + '. ' + n).join(' · ')]); }
    Session.fatigue = r.fat != null && r.fat > .25; r.stars = r.win === false ? 0 : starsFor(r.acc, purity ?? r.acc);
    // без сокращений мышц звёзд нет: уровень не открывается «сам», даже если сцена дошла до конца (машина в гонке едет сама)
    if (!GAMES[id].tut && Ctrl.m && Ctrl.m.active + Ctrl.m.tb < .5) { r.stars = 0; r.noAct = true; }
    // ход дуэли: в таблицу дуэли, без статистики, опыта и миссий владельца телефона
    if (this.p.duel) { Duel.done(r); Bus.emit('level:end', { game: id, ...r, duel: true }); setTimeout(() => { if (App.cur?.name === 'play' && this.game === g) App.go('duel', {}, { fade: true }); }, 600); return; } r.lv = lv; r.tl = this.tl.slice(); const endless = !!this.p.endless;
    const st = gst(id), prevBest = bestScore(id), record = !GAMES[id].tut && r.win !== false && r.score > prevBest && prevBest > 0, U0 = unlockedLv(id);
    st.plays++; if (r.win !== false) st.best = Math.max(st.best, r.score); // рекорд — только за пройденный уровень
    if (!endless) { st.ls[lv - 1] = Math.max(st.ls[lv - 1] || 0, r.stars); st.stars = Math.max(...st.ls); }
    // бесконечный режим: лестница сложности — чистая победа +0.3, трудная игра −0.25, иначе +0.1
    if (endless) { const from = adaptOf(id), step = r.win !== false && r.acc >= .85 && (purity ?? 1) >= .7 ? .3 : r.win === false || r.acc < .6 ? -.25 : .1; st.adapt = +clamp(from + step, 2, 4.5).toFixed(2); r.endless = { from, to: st.adapt }; }
    // адаптация сложности: очень чисто — сразу открываем следующий уровень, тяжело — советуем предыдущий
    else if (!GAMES[id].tut) {
      if (r.win !== false && r.acc >= .85 && (purity ?? 1) >= .7 && lv < 3) { st.ls[lv - 1] = Math.max(st.ls[lv - 1], 1); st.diff = lv + 1; r.diffUp = true; }
      else if (r.acc < .45 && lv > 1) { st.diff = lv - 1; r.diffDn = true; }
      else st.diff = lv;
      if (unlockedLv(id) > U0) r.unlocked = unlockedLv(id);
    }
    const d = today(), n = (d.n || 0) + 1; d.acc = Math.round(((d.acc || 0) * (n - 1) + r.acc * 100) / n); if (purity != null) d.purity = Math.round(((d.purity || 0) * (n - 1) + purity * 100) / n); if (r.react) d.react = Math.round(r.react); d.n = n;
    if (this.p.weekly) { r.weekly = Weekly.record(id, lv, r); Club.send(weekKey(), id, lv, r); }
    if (!GAMES[id].tut) S.history.push({ t: Date.now(), game: id, lv: endless ? 4 : lv, ad: endless ? lv : undefined, score: r.score, acc: Math.round(r.acc * 100), purity: purity == null ? null : Math.round(purity * 100), dur: Math.round(g.T), react: r.react ? Math.round(r.react) : undefined, stars: r.stars, win: r.win !== false, bal: r.bal == null ? undefined : Math.round(r.bal * 100), fat: r.fat == null ? undefined : Math.round(r.fat * 100), mode: C().mode });
    if (S.history.length > 300) S.history.shift();
    r.daily2 = !!this.p.daily && dailyAvail() && r.win !== false; if (r.daily2) S.dailyDone = dayKey();
    // опыт: за победу заметно больше, чем за попытку; очки дают бонус, но не больше 60 XP
    const xp = Math.round((40 + r.stars * 30 + (endless ? 60 : lv * 15) + Math.min(60, r.score / 50)) * (r.daily2 ? 2 : 1) * (r.win === false ? .5 : 1)); r.xp = xp; addXP(xp); touchStreak();
    // миссии качества засчитываются только за пройденный уровень, а не за любую попытку
    Mission.ev('game'); if (r.win !== false && purity != null && purity >= .8) Mission.ev('pure80'); if (r.stars >= 3) Mission.ev('stars3'); if (record) Mission.ev('record');
    r.story = Story.after(id); r.record = record; save(); checkAch(); Bus.emit('level:end', { game: id, ...r });
    r.rewards = Rewards.list.splice(0);
    // если игрок уже ушёл с экрана игры — не перебрасываем его на результат
    setTimeout(() => { if (App.cur?.name === 'play' && this.game === g) App.go('result', { id, r, diff: lv, daily: this.p.daily, endless, weekly: this.p.weekly, story: this.p.story }, { fade: true }); }, 600);
  }
};
function bindPad(p) {
  const ch = +p.dataset.ch, set = e => { const r = p.getBoundingClientRect(); Intent.pad[ch] = clamp(1 - (e.clientY - r.top) / r.height * .9); };
  p.addEventListener('pointerdown', e => { p.setPointerCapture(e.pointerId); Snd.init(); set(e); });
  p.addEventListener('pointermove', e => { if (Intent.pad[ch] != null) set(e); });
  // отпускание засчитываем всегда: и когда панель исчезла вместе с экраном (конец игры), и когда палец ушёл за её пределы
  const up = () => Intent.pad[ch] = null; ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => p.addEventListener(t, up));
}
// страховка: любое отпускание мыши/пальца в окне сбрасывает «нажатые» панели эмулятора
['pointerup', 'pointercancel'].forEach(t => addEventListener(t, () => { Intent.pad = [null, null]; }));

/* ---------- Результат ---------- */
SCR.result = {
  full: false, noEmu: true,
  valid: p => !!p?.r && Object.hasOwn(GAMES, p.id),
  render(p) {
    const r = p.r, g = GAMES[p.id], tut = g.tut, lv = p.diff || 1;
    const title = r.win === false ? 'Почти получилось' : tut ? 'Обучение пройдено' : r.stars >= 3 ? 'Превосходно!' : r.stars === 2 ? 'Отлично!' : r.stars === 1 ? 'Уровень пройден' : 'Попробуй ещё раз';
    const tip = r.noAct ? 'Сокращений мышц почти не было — звёзды и новые уровни даются только за управление сигналом. Попробуй ещё раз с К1 и К2.'
      : r.fat != null && r.fat > .25 ? 'К концу игры сила сокращений упала на ' + Math.round(r.fat * 100) + '% — это признак усталости. Отдохни пару минут, прежде чем играть дальше.'
      : r.purity != null && r.purity < .7 ? 'Мышца-антагонист часто включалась вместе с рабочей. Сокращай медленнее и держи вторую мышцу расслабленной.'
      : r.bal != null && (r.bal > .72 || r.bal < .28) ? `Работал в основном ${r.bal > .5 ? 'К1 (сгибатели)' : 'К2 (разгибатели)'}. Для протеза важны оба канала — попробуй игру, где ведущим будет ${r.bal > .5 ? 'К2' : 'К1'}.`
      : r.acc < .6 ? 'Точности пока не хватает — попробуй уровень ниже или повысь чувствительность датчиков.'
      : r.win === false ? 'Сигнал хороший, но цель уровня не выполнена. Сыграй ещё раз до конца — ты уже близко.'
      : r.stars >= 3 ? 'Сигнал чистый и точный. Можно повышать уровень.' : 'Хороший результат. Для трёх звёзд держи вторую мышцу полностью расслабленной.';
    const next = !tut && !p.endless && lv < 3 && unlockedLv(p.id) > lv, lvT = p.endless ? 'бесконечный, сложность ' + lv.toFixed(1) : 'уровень ' + lv;
    return `<div class="result-hero">${badge(r.win === false ? 'refresh' : tut ? 'check' : 'trophy', r.win === false ? 'peach' : 'sun', 'xxl')}
      <h1>${title}</h1><div class="starsrow">${starsSvg(r.stars)}</div>
      <div class="score" data-count="${r.score}">0</div><p class="sub" style="margin:0">очков · ${g.t}${tut ? '' : ' · ' + lvT}${r.record ? ' · <b style="color:var(--ok)">рекорд</b>' : ''}</p></div>
      <div class="res-grid">
        <div><b data-count="${Math.round(r.acc * 100)}" data-fmt="%">0</b><small>Точность</small></div>
        <div>${r.purity == null ? '<b>—</b>' : `<b data-count="${Math.round(r.purity * 100)}" data-fmt="%">0</b>`}<small>Чистота</small></div>
        <div><b>+${r.xp}</b><small>XP${r.daily2 ? ' ×2' : ''}</small></div></div>
      <div class="card" style="margin-top:12px">${r.extra.map(([k, v]) => `<div class="kv"><span class="l">${k}</span><b>${v}</b></div>`).join('')}</div>
      ${gameMap(r.tl || [])}
      ${r.endless ? `<div class="note ${r.endless.to >= r.endless.from ? 'ok' : ''}">${ic(r.endless.to >= r.endless.from ? 'bolt' : 'info')}<span>Сложность ${r.endless.from.toFixed(1)} → <b>${r.endless.to.toFixed(1)}</b>. ${r.endless.to > r.endless.from ? 'Следующая игра будет чуть труднее.' : r.endless.to < r.endless.from ? 'Следующая игра будет проще — закрепим навык.' : ''}</span></div>` : ''}
      ${r.weekly ? `<div class="note ${r.weekly.done ? 'ok' : ''}">${ic('calendar')}<span>${r.weekly.just ? '<b>Испытание недели выполнено!</b> +150 XP и деталь для мастерской.' : r.weekly.done ? 'Испытание недели уже выполнено — результат записан в таблицу.' : 'Попытка записана в таблицу испытания недели.'}</span></div>` : ''}
      ${r.story ? `<div class="card story-end"><small class="muted">${r.story.place} пройдена · +100 XP</small><h3>${esc(r.story.n)}</h3><p class="story-txt">${r.story.outro}</p><div class="note life">${ic('hand')}<span><b>Упражнение в жизни.</b> ${r.story.life}</span></div>${r.story.fin ? `<p class="story-txt"><b>Эпилог.</b> ${STORY.epilogue}</p>` : ''}<button class="btn ghost sm" data-go="story" style="margin-top:8px">${ic('robot')} К сюжету</button></div>` : p.story ? `<button class="btn ghost sm" data-go="story" style="margin-top:10px">${ic('robot')} К сюжету</button>` : ''}
      ${r.unlocked ? `<div class="note ok">${ic('check')}<span><b>Открыт уровень ${r.unlocked}.</b> ${r.diffUp ? 'Ты играешь так чисто, что можно сразу идти дальше.' : 'Новые задачи уже ждут.'}</span></div>` : r.diffDn ? `<div class="note">${ic('info')}<span>Советуем вернуться на уровень ${lv - 1}, чтобы закрепить навык.</span></div>` : ''}
      ${r.rewards?.length ? `<h3 class="h3">Награды</h3><div class="list">${r.rewards.map((w, i) => `<div class="lrow">${badge(IC[w.icon] ? w.icon : 'star', TONES[i % 6])}<div><b>${esc(w.title)}</b><small>${esc(w.sub || '')}</small></div></div>`).join('')}</div>` : ''}
      <div class="note">${ic('chat')}<span>${tip}</span></div>
      ${r.fat != null && r.fat > .25 ? `<button class="btn ghost sm" id="rRest" style="margin-top:10px">${ic('heart')} Пауза на отдых</button>` : ''}
      ${Host.ret ? `<button class="btn ghost sm" id="rHost" style="margin-top:10px">${ic('back')} Вернуться в ${esc(Host.name)}</button>` : ''}
      <h3 class="h3">Как ощущения?</h3><div class="seg-btns" id="rFb">${['Тяжело', 'Нормально', 'Легко'].map(t => `<button data-v="${t}">${t}</button>`).join('')}</div>
      <div class="row" style="margin-top:18px"><button class="btn ghost" data-go="games">К играм</button>${next ? `<button class="btn" id="rNext">Уровень ${lv + 1} ${ic('chev')}</button>` : `<button class="btn" id="rAgain">${ic('refresh')} Ещё раз</button>`}</div>
      ${next ? `<button class="btn ghost sm" id="rAgain" style="margin-top:8px">${ic('refresh')} Переиграть уровень ${lv}</button>` : ''}`;
  },
  mount(el, p) {
    if (p.r.stars >= 2 || (GAMES[p.id].tut && p.r.win)) { confetti(120); Snd.win(); } else Snd.ok();
    $('#rAgain', el).onclick = () => App.go('play', p.endless ? { id: p.id, diff: adaptOf(p.id), endless: true } : { id: p.id, diff: p.diff || 1, daily: p.daily, weekly: p.weekly });
    $('#rNext', el)?.addEventListener('click', () => App.go('play', { id: p.id, diff: (p.diff || 1) + 1, daily: p.daily, story: p.story }));
    $('#rRest', el)?.addEventListener('click', () => restModal());
    $('#rHost', el)?.addEventListener('click', () => Host.back());
    // один отзыв на одну игру: повторное нажатие меняет оценку, а не добавляет запись
    let fb = null;
    $('#rFb', el).onclick = e => { const b = e.target.closest('button'); if (!b || b.classList.contains('on')) return; $$('#rFb button', el).forEach(x => x.classList.toggle('on', x === b)); const first = !fb; if (first) (S.feedback ||= []).push(fb = { t: Date.now(), game: p.id, lv: p.diff }); fb.feel = b.dataset.v; save(); Bus.emit('feedback', { game: p.id, feel: b.dataset.v }); if (first) toast('heart', 'Спасибо за отзыв!', 'Учтём при подборе уровня'); };
  }
};

/* ---------- Прогресс ---------- */
SCR.progress = {
  tab: 'progress',
  render() {
    this.range = this.range || 'week';
    return `<div class="head"><h1>Прогресс</h1><span class="tag soft">${ic('star')} Ранг ${plvl()}</span></div>
      ${seg('rng', [['week', 'Неделя'], ['month', 'Месяц'], ['all', 'Всё время']], this.range)}
      <div id="pBody"></div>`;
  },
  mount(el) { bindSeg(el, 'rng', v => { this.range = v; this.body(el); }); this.body(el); el.addEventListener('click', e => { const p = e.target.closest('[data-play]'); if (p) openGame(p.dataset.play); }); },
  body(el) {
    const now = new Date(), first = Object.keys(S.stats.days).sort()[0], span = first ? Math.round((new Date(dayKey(now)) - new Date(first)) / 864e5) + 1 : 7;
    const N = this.range === 'week' ? 7 : this.range === 'month' ? 30 : clamp(span, 7, 120);
    const days = [...Array(N)].map((_, i) => { const d = addDays(now, i - N + 1), k = dayKey(d); return { k, d, v: S.stats.days[k] }; });
    const prev = [...Array(N)].map((_, i) => S.stats.days[dayKey(addDays(now, i - 2 * N + 1))]);
    const sum = (arr, f) => arr.reduce((a, x) => a + (x ? f(x) : 0), 0), avg = (arr, f) => { const a = arr.filter(x => x && f(x)); return a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0; };
    const cur = days.map(d => d.v), mins = sum(cur, x => x.min), acts = sum(cur, x => x.acts), acc = avg(cur, x => x.acc), pur = avg(cur, x => x.purity);
    const dl = (a, b, inv) => { if (!b) return ''; const d = Math.round((a - b) / b * 100); return `<div class="dl ${(d >= 0) !== !!inv ? 'up' : 'dn'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}%</div>`; };
    const wd = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], lbl = d => N <= 7 ? wd[d.getDay()] : N <= 31 ? d.getDate() + '' : d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0');
    const gest = Object.entries(this.range === 'all' ? S.stats.gestTotal : cur.reduce((m, x) => { if (x) for (const k in x.gest) m[k] = (m[k] || 0) + x.gest[k]; return m; }, {})).filter(([id]) => G(id)).sort((a, b) => b[1] - a[1]);
    const top = gest.slice(0, 6).map(([id, v], i) => ({ label: G(id).name, value: v, color: SERIES[i], id })), rest = gest.slice(6).reduce((a, b) => a + b[1], 0);
    if (rest) top.push({ label: 'Другие', value: rest, color: OTHER });
    const recent = S.history.filter(h => Object.hasOwn(GAMES, h.game)).slice(-6).reverse(); // игры из старых версий пропускаем
    const empty = !S.history.length && !Object.values(S.stats.days).some(d => d.min || d.acts);
    $('#pBody', el).innerHTML = `<div class="stg">
      ${empty ? `<div class="card insights" style="margin-top:14px"><h3>Здесь появится ваш прогресс</h3><button data-play="school" class="ins">${badge('play', 'mint')}<span>Начните со «Школы управления» — 2–3 минуты, и графики оживут</span>${ic('chev', 'chev')}</button></div>` : ''}
      <div class="grid2" style="margin-top:14px">
        <div class="kpi"><div class="ki c-p">${ic('clock')}</div><div class="v" data-count="${mins}" data-fmt="min">0</div><div class="l">Время тренировок</div>${dl(mins, sum(prev, x => x.min))}</div>
        <div class="kpi"><div class="ki c-b">${ic('hand')}</div><div class="v" data-count="${acts}">0</div><div class="l">Активаций жестов</div>${dl(acts, sum(prev, x => x.acts))}</div>
        <div class="kpi"><div class="ki c-g">${ic('target')}</div><div class="v" data-count="${Math.round(acc)}" data-fmt="%">0</div><div class="l">Средняя точность</div>${dl(acc, avg(prev, x => x.acc))}</div>
        <div class="kpi"><div class="ki c-o">${ic('spark')}</div><div class="v" data-count="${Math.round(pur)}" data-fmt="%">0</div><div class="l">Чистота сигнала</div>${dl(pur, avg(prev, x => x.purity))}</div></div>
      ${(() => {
        const pa = avg(prev, x => x.acc), pp = avg(prev, x => x.purity), bd = days.filter(d => d.v?.min).sort((a, b) => b.v.min - a.v.min)[0], sk = skills().sort((a, b) => a.value - b.value)[0], act = days.filter(d => d.v?.min).length;
        const items = [];
        if (acc && pa) items.push(['target', acc >= pa ? `Точность выросла на ${Math.round(acc - pa)} п.п. к прошлому периоду` : `Точность снизилась на ${Math.round(pa - acc)} п.п. — попробуйте уровень проще`, acc >= pa]);
        if (pur && pp) items.push(['spark', pur >= pp ? `Мышцы работают раздельнее: чистота ${Math.round(pur)}%` : `Чаще включаются обе мышцы сразу — расслабляйте антагонист`, pur >= pp]);
        items.push(['flame', `Активных дней: ${act} из ${N}${bd ? ` · лучший — ${bd.d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}, ${bd.v.min} мин` : ''}`, act >= N / 2]);
        if (S.history.length) items.push(['bolt', `Подтянуть: ${sk.label.toLowerCase()} (${Math.round(sk.value * 100)}%) — игра «${GAMES[sk.game].t}»`, null, sk.game]);
        return `<div class="card insights"><h3>Итоги периода</h3>${items.map(([i, t, ok, g]) => `<${g ? `button data-play="${g}"` : 'div'} class="ins">${badge(i, ok == null ? 'lilac' : ok ? 'mint' : 'sun')}<span>${t}</span>${g ? ic('chev', 'chev') : ''}</${g ? 'button' : 'div'}>`).join('')}</div>`;
      })()}
      <div class="pgrid">
      <div class="card chart-card"><div class="between"><div><h3>Точность и чистота</h3><div class="cs">%, по дням · наведите для деталей</div></div><button class="tag soft" id="tblT">Таблица</button></div>
        <div class="legend" style="margin-bottom:6px"><span><i style="background:var(--primary)"></i>Точность</span><span><i style="background:var(--s3)"></i>Чистота</span></div><div id="cLine"></div><div id="cTbl" class="hidden"></div></div>
      <div class="card chart-card"><h3>Минуты тренировок</h3><div class="cs">Цель — ${S.profile.goalMin} мин в день</div><div id="cBars"></div></div>
      <div class="card chart-card"><h3>Счётчик жестов</h3><div class="cs">Какие жесты протеза вы используете чаще</div><div id="cDonut"></div></div>
      <div class="card chart-card"><h3>Навыки</h3><div class="cs">Сейчас (заливка) и 2 недели назад (пунктир)</div><div id="cRadar"></div></div>
      <div class="card chart-card"><h3>Активность</h3><div class="cs">Последние 5 недель · насыщенность = минуты</div>
        <div class="heat-l">${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(x => `<span>${x}</span>`).join('')}</div><div class="heat" id="cHeat"></div>
        <div class="heat-k"><span>меньше</span>${[0, 25, 50, 75, 100].map(k => `<i style="background:${k ? `color-mix(in srgb, var(--primary) ${20 + k * .8}%, var(--card))` : 'var(--line)'}"></i>`).join('')}<span>больше</span></div></div>
      </div>
      <h2>Рекорды в играх</h2>
      <div class="records">${Object.entries(GAMES).filter(([, g]) => !g.tut).map(([id, g]) => `<div class="rec">${gIcon(id)}<b>${bestScore(id) ? fmtN(bestScore(id)) : '—'}</b><small>${g.t} · ${plur(playsOf(id), 'игра', 'игры', 'игр')}</small><div style="color:#FFB524;font-size:12px;letter-spacing:1px">${'★'.repeat(S.games[id]?.stars || 0)}<span style="color:var(--line)">${'★'.repeat(3 - (S.games[id]?.stars || 0))}</span></div></div>`).join('')}</div>
      <h2>Последние тренировки</h2>
      <div class="card">${recent.length ? recent.map(h => { const g = GAMES[h.game]; return `<div class="hist">${gIcon(h.game)}<div><b>${g.t}</b><small>${new Date(h.t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · ${fmtTime(h.dur)}${h.lv ? ' · ' + lvName(h.lv) : ''}${h.win === false ? ' · не пройден' : h.stars ? ' · ' + '★'.repeat(h.stars) : ''}</small></div><div class="hv">${fmtN(h.score)}<small class="muted">${h.acc}%${h.purity != null ? ' · чист. ' + h.purity + '%' : ''}</small></div></div>`; }).join('') : '<p class="sub">Пока нет тренировок</p>'}</div>
      <div class="row" style="margin-top:14px;gap:10px;flex-wrap:wrap"><button class="btn ghost" data-go="achievements" style="flex:1">${ic('trophy')} Все достижения</button><button class="btn ghost" id="pReport" style="flex:1">${ic('down')} Отчёт для специалиста</button></div></div>`;
    const P = $('#pBody', el);
    $('#pReport', P).onclick = () => Native.saveFile(`kineta-report-${dayKey()}.html`, specialistReport(N), 'text/html', 'Отчёт Kineta').then(r => r !== 'cancel' && toast('down', r === 'shared' ? 'Отчёт готов к отправке' : 'Отчёт сохранён', 'Откройте файл и при необходимости распечатайте в PDF')).catch(() => toast('down', 'Не удалось сохранить отчёт'));
    lines($('#cLine', P), days.map(d => lbl(d.d)), [{ name: 'Точность', color: 'var(--primary)', values: days.map(d => d.v?.acc || null) }, { name: 'Чистота', color: 'var(--s3)', values: days.map(d => d.v?.purity || null) }], { min: 0, max: 100, unit: '%', full: days.map(d => d.d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })) });
    $('#cTbl', P).innerHTML = `<table class="tblv"><tr><th>Дата</th><th>Точность</th><th>Чистота</th><th>Мин</th></tr>${days.filter(d => d.v).map(d => `<tr><td>${d.d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</td><td>${d.v.acc || '—'}%</td><td>${d.v.purity || '—'}%</td><td>${d.v.min}</td></tr>`).join('')}</table>`;
    $('#tblT', P).onclick = e => { $('#cLine', P).classList.toggle('hidden'); $('#cTbl', P).classList.toggle('hidden'); e.target.textContent = $('#cTbl', P).classList.contains('hidden') ? 'Таблица' : 'График'; };
    bars($('#cBars', P), days.map((d, i) => ({ label: lbl(d.d), value: d.v?.min || 0, hi: i === days.length - 1, full: d.d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) })), { goal: S.profile.goalMin, fmt: v => v + ' мин' });
    if (top.length) donut($('#cDonut', P), top, { onPick: it => it.id && gestureSheet(it.id) }); else $('#cDonut', P).innerHTML = '<p class="sub">Пока нет данных</p>';
    radar($('#cRadar', P), skills(), skills(14).map(s => s.value));
    const H = $('#cHeat', P), start = addDays(now, -34 - ((now.getDay() + 6) % 7) + 6), maxM = Math.max(...Object.values(S.stats.days).map(d => d.min), 1);
    let hh = ''; for (let i = 0; i < 35; i++) { const d = addDays(start, i), v = S.stats.days[dayKey(d)], k = v ? v.min / maxM : 0, fut = d > now; hh += `<i title="${d.toLocaleDateString('ru-RU')}: ${v ? v.min + ' мин' : 'нет'}" style="animation-delay:${i * .012}s;${fut ? 'opacity:.25;' : ''}background:${v ? `color-mix(in srgb, var(--primary) ${Math.round(20 + k * 80)}%, var(--card))` : 'var(--line)'}"></i>`; }
    H.innerHTML = hh;
    H.onclick = e => { const i = e.target.closest('i'); if (i) toast('clock', i.title); };
    animateIn(P);
  }
};

/* ---------- Как работает сигнал: конвейер обработки вживую (для пользователя, специалиста и жюри) ---------- */
SCR.signal = {
  render() {
    const sp = C().mode === 'spppr';
    return `<div class="back"><button class="ib" data-back>${ic('back')}</button><span class="grow">Путь сигнала</span>${stateChip("pChip")}</div>
      ${seg('pch', [['0', 'К1 · сгибатели'], ['1', 'К2 · разгибатели']], String(this.ch || 0))}
      <div class="card pipe" style="margin-top:12px"><canvas id="pCv"></canvas>
        <div class="legend" style="margin-top:6px"><span><i style="background:var(--muted)"></i>${sp ? 'вероятность из пакета' : 'сырой сигнал'}</span><span><i style="background:var(--ch1)" id="pLc"></i>после обработки</span><span><i style="background:#3B2F2A"></i>порог</span><span><i style="background:#3B2F2A;opacity:.4"></i>отпускание</span></div></div>
      <div class="sstat" style="margin-top:12px"><div><small>${sp ? 'Интервал пакетов' : 'Частота'}</small><b id="pRate">—</b></div><div><small>Задержка</small><b id="pLat">—</b></div><div><small>${sp ? 'Потери / ошибки' : 'Ошибочные пакеты'}</small><b id="pBad">—</b></div></div>
      ${sp ? `<div class="card" style="margin-top:12px"><b>Вероятности жестов (СПППР)</b><div class="pprob" id="pProb">${SP_ALL.map(k => `<div><span>${SPN[k]}</span><i><u data-p="${k}"></u></i><em data-v="${k}">0</em></div>`).join('')}</div><small class="muted" id="pG">Устойчивый жест: —</small></div>` : ''}
      <h2>Этапы</h2><div class="list psteps">
        ${(sp ? [
          ['1', 'Пакет от системы распознавания', 'JSON с вероятностями 7 жестов; время — только разница timestamp_ms между пакетами'],
          ['2', 'Интерполяция', 'Сглаживание с постоянной времени, равной фактическому интервалу пакетов: джиттер 10–100+ мс без рывков'],
          ['3', 'Порог и гистерезис', `Сгибание − разгибание дают каналы; включение при ${pct(C().thr1)}, отпускание при ${pct(C().thr1 * C().hyst)}`],
          ['4', 'Устойчивый жест', 'Новый жест принимается, если держится ≥ 2 пакетов и ≥ 120 мс — единичная ошибка классификатора прощается'],
          ['5', 'Потеря связи', 'Нет пакетов > 200 мс — скорость гаснет, > 1.5 с — игра на паузе']
        ] : [
          ['1', 'Нормализация', 'Амплитуда 0…255 → доля от максимума калибровки × чувствительность датчика'],
          ['2', 'Сглаживание', `EMA ${pct(1 - C().smoothing)} + ограничение скачков ${C().slew} за отсчёт`],
          ['3', 'Мёртвая зона', `Фон ниже ${pct(C().deadzone)} считается нулём`],
          ['4', 'Порог с гистерезисом', `Канал включается выше порога, выключается ниже ${pct(C().hyst)} от него — нет дребезга у границы`],
          ['5', 'Подавление ложных', `Новое состояние принимается, если держится ${C().suppressMs} мс — короткие выбросы отсекаются`],
          ['6', 'Состояние', 'Покой / К1 / К2 / обе мышцы → действие в игре и в протезе']
        ]).map(([n, t, d]) => `<div class="lrow"><span class="pnum">${n}</span><div><b>${t}</b><small>${d}</small></div></div>`).join('')}</div>`;
  },
  mount(el) { this.buf = []; this.ch = this.ch || 0; bindSeg(el, 'pch', v => { this.ch = +v; this.buf = []; $('#pLc', el).style.background = this.ch ? 'var(--ch2)' : 'var(--ch1)'; }); $('#pLc', el).style.background = this.ch ? 'var(--ch2)' : 'var(--ch1)'; },
  frame(dt, now, el) {
    updChip($('#pChip', el));
    const c = C(), dz = c.deadzone, f = x => x < dz ? 0 : (x - dz) / (1 - dz), i = this.ch;
    this.buf.push([f(Ctrl.nRaw[i] || 0), Ctrl.a[i], Ctrl.state]); if (this.buf.length > 360) this.buf.shift();
    const cv = $('#pCv', el); if (!cv) return; const dpr = devicePixelRatio || 1, W = cv.offsetWidth, H = cv.offsetHeight; if (!W) return;
    if (cv.width !== Math.round(W * dpr)) { cv.width = W * dpr; cv.height = H * dpr; }
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    const ph = H - 22, n = 360, X = k => k / (n - 1) * W, Y = v => 6 + (ph - 6) * (1 - clamp(v)), thr = c['thr' + (i + 1)], col = i ? getCss('--ch2') : getCss('--ch1'), txtc = getCss('--text');
    x.strokeStyle = getCss('--line'); x.lineWidth = 1; for (const v of [.25, .5, .75]) { x.beginPath(); x.moveTo(0, Y(v)); x.lineTo(W, Y(v)); x.stroke(); }
    x.setLineDash([6, 5]); x.strokeStyle = txtc; x.globalAlpha = .8; x.beginPath(); x.moveTo(0, Y(thr)); x.lineTo(W, Y(thr)); x.stroke(); x.globalAlpha = .35; x.beginPath(); x.moveTo(0, Y(thr * c.hyst)); x.lineTo(W, Y(thr * c.hyst)); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
    const off = n - this.buf.length, line = (k, w, s) => { x.strokeStyle = s; x.lineWidth = w; x.lineJoin = 'round'; x.beginPath(); this.buf.forEach((b, j) => j ? x.lineTo(X(j + off), Y(b[k])) : x.moveTo(X(j + off), Y(b[k]))); x.stroke(); };
    line(0, 1.3, getCss('--muted')); line(1, 2.6, col);
    this.buf.forEach((b, j) => { x.fillStyle = ST[b[2]].hex; x.globalAlpha = b[2] === 'REST' ? .35 : .9; x.fillRect(X(j + off), H - 12, W / n + .6, 10); }); x.globalAlpha = 1;
    x.fillStyle = txtc; x.font = '700 10px ' + getComputedStyle(document.body).fontFamily; x.fillText('порог ' + pct(thr), 4, Y(thr) - 4); x.fillText('состояние', 4, H - 15);
    const sp = c.mode === 'spppr';
    $('#pRate', el).textContent = sp ? Math.round(Ctrl.pktDt * 1000) + ' мс' : (Ctrl.rate || '—') + (Ctrl.rate ? ' Гц' : '');
    const L = Ctrl.latency(); $('#pLat', el).textContent = L ? Math.round(L) + ' мс' : '—';
    $('#pBad', el).textContent = sp ? `${Ctrl.src?.dropped ?? '—'} / ${Ctrl.bad}` : String(Ctrl.bad);
    if (sp) { for (const k of SP_ALL) { const u = $(`[data-p="${k}"]`, el); if (u) { u.style.width = pct(Ctrl.p[k] || 0); $(`[data-v="${k}"]`, el).textContent = Math.round((Ctrl.p[k] || 0) * 100); } } $('#pG', el).textContent = 'Устойчивый жест: ' + SPN[Ctrl.g]; }
  }
};

/* ---------- Отчёт для специалиста ----------
   Самодостаточный HTML (без скриптов и внешних ресурсов): динамика чистоты сигнала, точности,
   баланса К1/К2, утомления и реакции по играм за период. Специалист открывает его на любом
   устройстве и при необходимости печатает в PDF. */
function specialistReport(N = 30) {
  const now = new Date(), from = new Date(addDays(now, -N + 1)).setHours(0, 0, 0, 0);
  const H = S.history.filter(h => h.t >= from && GAMES[h.game]), days = Object.entries(S.stats.days).filter(([k]) => new Date(k).getTime() >= from - 864e5).sort();
  const avg = (a, f) => { const v = a.map(f).filter(x => x != null && Number.isFinite(x)); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
  const f0 = v => v == null ? '—' : Math.round(v);
  const half = Math.floor(H.length / 2), A = H.slice(0, half), B = H.slice(half);
  const trend = (f, unit = '%', inv = false) => { const a = avg(A, f), b = avg(B, f); if (a == null || b == null || H.length < 4) return '—'; const d = Math.round(b - a); return `${d > 0 ? '+' : ''}${d}${unit} ${(d >= 0) !== inv ? '▲' : '▼'}`; };
  const mins = days.reduce((x, [, d]) => x + (d.min || 0), 0), act = days.filter(([, d]) => d.min).length;
  const pc = v => v == null ? '—' : Math.round(v) + '%';
  const rows = [
    ['Активных дней', `${act} из ${N}`, ''], ['Время тренировок', mins + ' мин', ''], ['Игровых сессий', H.length, ''],
    ['Чистота сигнала (нет встречных сокращений)', pc(avg(H, h => h.purity)), trend(h => h.purity)],
    ['Точность выполнения заданий', pc(avg(H, h => h.acc)), trend(h => h.acc)],
    ['Баланс К1 / К2 (норма ≈ 50 / 50)', (b => b == null ? '—' : `${Math.round(b)} / ${100 - Math.round(b)}`)(avg(H, h => h.bal)), ''],
    ['Спад силы к концу игры (утомление)', pc(avg(H, h => h.fat)), trend(h => h.fat, '%', true)],
    ['Средняя реакция («Реакция»)', (r => r == null ? '—' : Math.round(r) + ' мс')(avg(H.filter(h => h.game === 'react'), h => h.react)), trend(h => h.game === 'react' ? h.react : null, ' мс', true)]
  ];
  const games = Object.keys(GAMES).filter(id => !GAMES[id].tut).map(id => { const g = H.filter(h => h.game === id); return g.length ? `<tr><td>${esc(GAMES[id].t)}</td><td>${esc(GAMES[id].skill)}</td><td>${g.length}</td><td>${(m => m >= 4 ? '∞' : m)(Math.max(...g.map(h => h.lv || 1)))}</td><td>${pc(avg(g, h => h.acc))}</td><td>${pc(avg(g, h => h.purity))}</td></tr>` : ''; }).join('');
  const pd = days.filter(([, d]) => d.purity);
  const spark = pd.length > 1 ? (() => { const W = 560, Hh = 120, pts = pd.map(([, d], i) => [Math.round(i / (pd.length - 1) * W), Math.round(Hh - d.purity / 100 * Hh)]); return `<svg viewBox="-6 -6 ${W + 12} ${Hh + 12}" width="100%" height="140" role="img" aria-label="Чистота сигнала по дням"><path d="M0 ${Hh}H${W}M0 ${Hh / 2}H${W}" stroke="#e5e5e5"/><text x="${W}" y="${Hh / 2 - 4}" font-size="11" fill="#999" text-anchor="end">50%</text><polyline fill="none" stroke="#3E9FD6" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(p => p.join(',')).join(' ')}"/></svg>`; })() : '<p class="m">Недостаточно дней для графика.</p>';
  const fb = (S.feedback || []).filter(x => x.t >= from).slice(-5).map(x => `<li>${new Date(x.t).toLocaleDateString('ru-RU')}: ${x.rate ? '★'.repeat(x.rate) + ' ' : ''}${x.feel ? `«${esc(x.feel)}» после игры «${esc(GAMES[x.game]?.t || x.game || '')}»${x.lv ? ', ' + lvName(x.lv) : ''}` : ''}${esc(x.text || '')}</li>`).join('');
  const c = C();
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Отчёт Kineta — ${dayKey()}</title>
<style>body{font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:#2b2420;background:#fff;max-width:760px;margin:24px auto;padding:0 16px}h1{font-size:22px;margin:0}h2{font-size:17px;margin:26px 0 8px}.m{color:#857669}table{width:100%;border-collapse:collapse}td,th{padding:7px 8px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}th{font-size:13px;color:#857669;font-weight:600}.demo{background:#ffe2b8;padding:8px 12px;border-radius:8px}@media print{body{margin:0}}</style></head><body>
<h1>Kineta — отчёт о тренировках управления протезом</h1>
<p class="m">${esc(S.profile.name || 'Пользователь')} · период: ${new Date(from).toLocaleDateString('ru-RU')} — ${now.toLocaleDateString('ru-RU')} (${N} дн.) · протез на ${c.hand === 'right' ? 'правой' : 'левой'} руке · управление: ${c.mode === 'emg' ? 'двухканальная ЭМГ' : 'СПППР, ' + c.spGest + ' жестов'}</p>
${S.demo ? '<p class="demo">Внимание: статистика содержит демонстрационные данные, а не реальные тренировки.</p>' : ''}
<h2>Ключевые показатели</h2><table><tr><th>Показатель</th><th>Среднее</th><th>Динамика*</th></tr>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>
<p class="m">* вторая половина сессий периода против первой.</p>
<h2>Чистота сигнала по дням</h2>${spark}
<h2>По играм</h2>${games ? `<table><tr><th>Игра</th><th>Навык</th><th>Сессий</th><th>Макс. ур.</th><th>Точность</th><th>Чистота</th></tr>${games}</table>` : '<p class="m">За период игр не было.</p>'}
<h2>Настройки управления</h2><table>
<tr><td>Пороги К1 / К2 (0…255)</td><td>${thrToRaw(0)} / ${thrToRaw(1)} (${c.thrSrc === 'device' ? 'из протеза' : 'игровые'})</td></tr>
<tr><td>Чувствительность К1 / К2</td><td>${c.gain1} / ${c.gain2}</td></tr>
<tr><td>Одновременная активация</td><td>${{ both: 'отдельное действие', classic: 'классический', sport: 'спортивный', lock: 'блокировка протеза' }[c.coMode] || c.coMode}</td></tr>
<tr><td>Калибровка</td><td>${S.calib.at ? new Date(S.calib.at).toLocaleDateString('ru-RU') : 'не проводилась'}</td></tr></table>
${fb ? `<h2>Отзывы пользователя</h2><ul>${fb}</ul>` : ''}
<p class="m" style="margin-top:28px">Сформировано приложением Kineta ${APP_VERSION} ${now.toLocaleString('ru-RU')}. Показатели получены в игровом тренажёре и не являются медицинским заключением.</p>
</body></html>`;
}

/* ---------- Достижения ---------- */
SCR.achievements = {
  render() {
    const got = ACH.filter(a => S.ach[a.id]).length;
    return `<div class="back"><button class="ib" data-back>${ic('back')}</button><span class="grow">Достижения</span><span class="tag soft">${got}/${ACH.length}</span></div>
      <div class="card" style="display:flex;gap:14px;align-items:center;margin-bottom:14px">${ring(got / ACH.length, 'var(--primary)', 64, 8)}<div><b style="font-size:16px">Собрано ${got} из ${ACH.length}</b><div class="sub" style="margin:2px 0 0;font-size:12.5px">Каждое достижение даёт +100 XP</div></div></div>
      <div class="ach-grid stg">${ACH.map(a => { const [c, n] = a.p(), on = !!S.ach[a.id]; return `<button class="ach ${on ? '' : 'off'}" data-a="${a.id}">${badge(a.icon, on ? TONES[ACH.indexOf(a) % 6] : 'peach', 'lg')}<div class="n">${a.t}</div><div class="d">${a.d}</div>${!on && n > 1 ? `<div class="pb"><i style="width:${c / n * 100}%"></i></div>` : ''}</button>`; }).join('')}</div>`;
  },
  mount(el) { el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = ACH.find(x => x.id === b.dataset.a), [c, n] = a.p(); b.style.animation = 'none'; b.offsetWidth; b.style.animation = 'pop2 .4s var(--spring)'; toast(a.icon, a.t, S.ach[a.id] ? 'Получено ' + new Date(S.ach[a.id]).toLocaleDateString('ru-RU') : `Прогресс: ${c} / ${n}`); }); }
};

/* ---------- Устройство ---------- */
SCR.device = {
  render() {
    const d = S.device, near = Geo.nearest(), inf = d.info || {}, busy = BT.state === 'connecting' || BT.state === 'reconnecting', pr = C().ble;
    const tag = d.connected ? ['ok', 'Подключено'] : busy ? ['warn', BT.state === 'reconnecting' ? 'Переподключение…' : 'Подключение…'] : ['err', 'Нет связи'];
    const src = !d.connected ? 'Сигнал идёт с эмулятора, пока протез не на связи' : !d.real ? 'Демо-режим: сигнал ЭМГ эмулируется' : BT.streaming() ? 'Bluetooth LE · сигнал ЭМГ с протеза' : 'Bluetooth LE · протокол сигнала не настроен, работает эмулятор';
    const kv = (k, v, id = '') => `<div class="kv"><span class="l">${k}</span><b ${id}>${v}</b></div>`;
    return `<div class="back"><button class="ib" data-back>${ic('back')}</button><span class="grow">Мой протез</span></div>
      <div class="hero"><div class="hstage"><div class="hv" id="dHand"></div></div>
        <div class="lbl"><span class="tag ${tag[0]}">${tag[1]}</span><h3>${esc(d.name || 'Протез не выбран')}</h3><p>${src}</p>
          <div class="batt"><span class="cell"><i style="width:${d.battery ?? 0}%;background:${d.battery != null && d.battery < 20 ? 'var(--err)' : 'var(--ok)'}"></i></span>${battTxt()}${d.battery == null && d.connected ? ' · протез не сообщает заряд' : ''}</div></div></div>
      <div class="row" style="margin-top:12px"><button class="btn ${d.connected ? 'ghost' : ''}" id="dRe" ${busy ? 'disabled' : ''}>${ic('bt')} ${d.connected ? 'Переподключить' : 'Подключить'}</button>${d.connected ? `<button class="btn ghost" id="dOff" style="color:var(--err)">Отключить</button>` : ''}</div>
      ${d.real && d.info ? `<h2>Об устройстве</h2><div class="card" style="padding:4px 16px">${[['Производитель', inf.maker], ['Модель', inf.model], ['Серийный номер', inf.serial], ['Прошивка', inf.fw], ['Аппаратная версия', inf.hw]].filter(x => x[1]).map(([k, v]) => kv(k, esc(v))).join('') || '<p class="sub" style="margin:12px 0">Протез не передаёт паспорт устройства</p>'}</div>` : ''}
      <h2>Связь и сигнал</h2><div class="card" style="padding:4px 16px">
        ${kv('Источник сигнала', Ctrl.source())}${kv('Частота отсчётов', '—', 'id="dRate"')}${kv('Задержка обработки', '—', 'id="dLat"')}
        <button class="set" id="dProto" style="width:100%;text-align:left"><div class="ico">${ic('sliders')}</div><div style="flex:1;min-width:0">Протокол протеза<small>${pr.service ? 'Сервис ' + esc(pr.service) + ' · ' + esc(pr.format) : 'Не настроен — параметры даёт производитель'}</small></div><span class="chev">${ic('chev')}</span></button></div>
      <h2>Где мой протез</h2>
      <div class="map ${S.geo ? '' : 'empty'}">
        ${S.geo ? `<i class="road" style="left:-10px;right:-10px;top:60px;height:16px"></i><i class="road" style="top:-10px;bottom:-10px;left:58%;width:14px"></i><div class="acc"></div><div class="pin"></div><div class="coords">${S.geo.lat.toFixed(4)}, ${S.geo.lon.toFixed(4)} · ±${S.geo.acc} м</div>` : `<div class="map-empty">${badge('gps', 'mint')}<div><b>Геолокация выключена</b><small>Покажем место последнего подключения протеза</small></div><button class="chipbtn" id="dGeo">Включить</button></div>`}</div>
      ${S.geo ? `<div class="card set" style="margin-top:10px;padding:12px 16px"><div class="ico">${ic('gps')}</div><div style="flex:1;min-width:0">Последнее подключение<small>${new Date(S.geo.t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${near ? ` · ближайший крупный город: ${near.n}, ${Math.round(near.km)} км` : ''}</small></div><button class="ib" id="dGeo">${ic('refresh')}</button></div>` : ''}
      <h2>Прошивка</h2>
      ${d.real ? `<div class="card" style="padding:4px 16px">${kv('Прошивка протеза', esc(inf.fw || 'нет данных'))}${kv('Приложение', 'Kineta ' + APP_VERSION)}</div><div class="note">${ic('info')}<span>Обновление прошивки протеза выполняет сервис производителя.</span></div>`
      : `<div class="card">${[['hand', 'Прошивка кисти'], ['gui', 'Интерфейс протеза'], ['emg', 'Модуль ЭМГ']].map(([k, n]) => `<div class="fw" data-fw="${k}"><div>${n}<small>v${d.fw[k]} · демо</small></div><div class="pbar hidden"><i style="width:0"></i></div><button>Обновить</button></div>`).join('')}
        <div class="fw"><div>Приложение<small>Kineta ${APP_VERSION}</small></div><span></span><span class="tag ok">Актуально</span></div></div>`}`;
  },
  mount(el) {
    this.hv = new HandView($('#dHand', el)); this.hv.svg.style.cssText = 'width:100%;height:100%';
    el.onclick = async e => {
      if (e.target.closest('#dGeo')) { try { await Geo.request(); toast('gps', 'Местоположение обновлено', `±${S.geo.acc} м`); App.refresh(); } catch (err) { toast('info', 'Геолокация недоступна', err.message || ''); } return; }
      if (e.target.closest('#dRe')) {
        if (S.device.real && BT.device) { try { BT.disconnect(true); await BT.connect(); toast('bt', 'Подключено', S.device.name); } catch (err) { toast('info', 'Не удалось подключиться', err.message || ''); } App.refresh(); }
        else App.go('perms'); return;
      }
      if (e.target.closest('#dOff')) { BT.disconnect(); toast('bt', 'Протез отключён'); return; }
      if (e.target.closest('#dProto')) { protoSheet(); return; }
      const f = e.target.closest('[data-fw] button'); if (f && !f.disabled) {
        const row = f.closest('.fw'), bar = $('.pbar', row), i = $('i', bar), k = row.dataset.fw; f.disabled = true; f.textContent = '…'; bar.classList.remove('hidden');
        for (let q = 0; q <= 100; q += 4) { i.style.width = q + '%'; await sleep(60); }
        const v = S.device.fw[k].split('.').map(Number); v[2]++; S.device.fw[k] = v.join('.'); save();
        bar.classList.add('hidden'); f.textContent = '✓'; $('small', row).textContent = 'v' + S.device.fw[k] + ' · установлено'; toast('down', 'Обновление установлено', 'v' + S.device.fw[k]); Snd.ok();
      }
    };
  },
  frame(dt, now, el) {
    this.hv?.set(Prosthesis.pose);
    if (!this.t || now - this.t > 500) { this.t = now; const r = $('#dRate', el), l = $('#dLat', el); if (r) r.textContent = C().mode === 'emg' ? (Ctrl.lossFlag ? 'нет данных' : Ctrl.rate + ' Гц') : Ctrl.pkts + ' пакетов'; if (l) l.textContent = Ctrl.latency() ? Math.round(Ctrl.latency()) + ' мс' : 'нет данных'; }
  }
};
/* Профиль протокола протеза (параметры GATT от производителя) */
function protoSheet() {
  const p = C().ble, f = (k, label, ph) => `<label class="fld"><span>${label}</span><input class="txt" data-k="${k}" value="${esc(p[k] ?? '')}" placeholder="${ph}" spellcheck="false"></label>`;
  sheet(`<h2 style="margin-top:0">Протокол протеза</h2><p class="sub">Параметры задаёт производитель протеза. Пока сервис пуст, приложение читает заряд и паспорт устройства, а сигнал берёт из эмулятора.</p>
    ${f('namePrefix', 'Имя устройства начинается с', 'например, Kineta')}${f('service', 'UUID сервиса сигнала', '0xFFE0 или полный UUID')}${f('emgChar', 'Характеристика сигнала (notify)', '0xFFE1')}${f('cmdChar', 'Характеристика команд (write), необязательно', '0xFFE2')}
    <label class="fld"><span>Формат пакета</span><select class="txt" data-k="format">${[['u16le2', '2 × uint16 LE — отсчёты АЦП'], ['u8x2', '2 × uint8'], ['f32le2', '2 × float32 LE, 0…1'], ['json', 'JSON-строки: ЭМГ {ch1,ch2} или СПППР {dist}']].map(([v, t]) => `<option value="${v}" ${p.format === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    ${f('fullScale', 'Полная шкала АЦП (для целых форматов)', '4095')}
    <button class="btn" id="pSave" style="margin-top:16px">${ic('check')} Сохранить</button>`, (sh, close) => {
    $('#pSave', sh).onclick = async () => {
      const old = p.service;
      $$('[data-k]', sh).forEach(i => { const k = i.dataset.k; p[k] = k === 'fullScale' ? Math.max(1, Math.round(+i.value) || 4095) : i.value.trim(); }); save(); close();
      if (!S.device.real || !BT.supported()) { toast('check', 'Профиль сохранён', 'Применится при подключении протеза'); if (App.cur?.name === 'device') App.refresh(); return; }
      try { // новый сервис требует заново выдать разрешение в окне выбора устройства
        if (normUuid(old) !== normUuid(p.service) || !BT.device) await BT.request(); else { BT.disconnect(true); await BT.connect(); }
        toast('bt', 'Профиль применён', BT.streaming() ? 'Сигнал идёт с протеза' : 'Сервис сигнала не найден — проверьте UUID');
      } catch (e) { toast('info', 'Не удалось применить профиль', e.message || ''); }
      if (App.cur?.name === 'device') App.refresh();
    };
  });
}

/* ---------- Профиль ---------- */
SCR.profile = {
  render() {
    const L = plvl(), lo = xpFor(L), hi = xpFor(L + 1), c = C(), tg = Object.values(S.stats.gestTotal).reduce((a, b) => a + b, 0);
    const row = (icn, t, s, right, attr = '') => { const tg = right ? 'div' : 'button'; /* кнопка в кнопке недопустима — строка с переключателем делается div */ return `<${tg} class="set" ${attr} style="width:100%;text-align:left"><div class="ico">${ic(icn)}</div><div style="flex:1">${t}${s ? `<small>${s}</small>` : ''}</div>${right ?? `<span class="chev">${ic('chev')}</span>`}</${tg}>`; };
    return `<div class="back"><button class="ib" data-back>${ic('back')}</button><span class="grow">Профиль</span></div>
      <div class="card prof-card"><i class="lvl-badge"></i><div class="ava">${esc(S.profile.name[0] || 'K')}</div><div style="flex:1;position:relative"><input id="pName" value="${esc(S.profile.name)}" style="border:0;background:none;font-weight:800;font-size:19px;width:100%;outline:none"><div class="muted small" style="font-weight:700;margin:2px 0 8px">Ранг ${L} · ${fmtN(S.profile.xp)} XP</div><div class="pbar"><i data-w="${(S.profile.xp - lo) / (hi - lo) * 100}%" style="width:0"></i></div><small class="muted" style="font-size:11px">${hi - S.profile.xp} XP до ранга ${L + 1}</small></div></div>
      <div class="grid3" style="margin-top:12px"><div class="kpi" style="text-align:center"><div class="v" data-count="${S.profile.streak}">0</div><div class="l">дней подряд</div></div><div class="kpi" style="text-align:center"><div class="v" data-count="${S.history.length}">0</div><div class="l">тренировок</div></div><div class="kpi" style="text-align:center"><div class="v" data-count="${tg}">0</div><div class="l">захватов</div></div></div>
      <h2>Главное</h2><div class="card" style="padding:4px 16px">
        ${row('hand', 'Информация о протезе', esc(S.device.name || 'не подключён'), null, 'data-go="device"')}
        ${row('trophy', 'Достижения', `${ACH.filter(a => S.ach[a.id]).length} из ${ACH.length}`, null, 'data-go="achievements"')}
        ${row('chart', 'Статистика', 'Графики и дашборды', null, 'data-go="progress"')}
        ${row('game', 'Игры', ARCADE().length + ' мини-игр и школа', null, 'data-go="games"')}
        ${row('help', 'Служба поддержки', 'Частые вопросы и связь', null, 'id="pHelp"')}</div>
      <h2>Настройки</h2><div class="card" style="padding:4px 16px">
        <div class="set" style="display:block"><div class="between"><span>Тема<small>«Системная» следует настройке телефона</small></span></div>${seg('theme', [['light', 'Светлая'], ['dark', 'Тёмная'], ['auto', 'Системная']], c.theme)}</div>
        <div class="set" style="display:block"><div class="between"><span>Цвет руки протеза<small>В приложении и в играх</small></span></div><div class="hpal" id="hPal">${Object.entries(HAND_PALS).map(([k, p]) => `<button data-pal="${k}" class="${(c.handPal || 'titan') === k ? 'on' : ''}"><i style="background:linear-gradient(135deg,${p.skin},${p.shade});border-color:${p.edge}"></i>${p.n}</button>`).join('')}</div></div>
        ${row('text', 'Крупный режим', 'Крупнее текст и кнопки — удобно детям и при слабом зрении', sw('big', c.big))}
        ${row('shapes', 'Формы каналов', 'К1 — круг, К2 — квадрат: различимо без цвета', sw('shapes', c.shapes))}
        ${row('calib', 'Проверка датчиков перед игрой', '5 секунд: покой, К1, К2 — пороги подстраиваются под сегодняшний сигнал', sw('quickCal', c.quickCal))}
        <div class="set" style="display:block"><div class="between"><span>Протез на руке<small>Кнопки и панели — под здоровую руку</small></span></div>${seg('hand', [['left', 'Левой'], ['right', 'Правой']], c.hand)}</div>
        ${row('mirror', 'Зеркальный интерфейс', c.mirror ? 'Управление под левую руку' : 'Управление под правую руку', sw('mirror', c.mirror))}
        <div class="set" style="display:block"><div class="between"><span>Длина сеанса<small>Потом приложение предложит отдых</small></span><span class="tag soft" id="sesV">${c.sessionMin} мин</span></div><input type="range" min="5" max="20" step="1" value="${c.sessionMin}" id="ses"></div>
        ${row('sound', 'Звуки', 'Ненавязчивые сигналы', sw('sound', c.sound))}
        ${row('vibro', 'Вибрация', 'Тактильный отклик', sw('vibro', c.vibro))}
        ${row('voice', 'Голосовые подсказки', 'Игра говорит, что делать, — можно смотреть на руку, а не на экран', sw('voice', c.voice))}
        <div class="set" style="display:block"><div class="between"><span>Цель на день</span><span class="tag soft" id="goalV">${S.profile.goalMin} мин</span></div><input type="range" min="5" max="40" step="5" value="${S.profile.goalMin}" id="goal"></div></div>
      <h2>Отзыв о приложении</h2><div class="card"><div class="presets" id="fbR">${[['Тяжело', 1], ['Нормально', 3], ['Отлично', 5]].map(([e, v]) => `<button data-v="${v}">${e}</button>`).join('')}</div><textarea class="txt" id="fbT" placeholder="Что улучшить? (необязательно)" style="margin-top:10px;min-height:70px"></textarea><button class="btn sm" id="fbS" style="margin-top:10px">Отправить отзыв</button></div>
      <h2>Данные</h2><div class="card" style="padding:4px 16px">
        ${row('down', 'Экспорт данных (JSON)', 'История, метрики, жесты, отзывы', null, 'id="pExp"')}
        ${row('refresh', 'Сбросить статистику', S.demo ? 'Удалить демо-данные и историю' : 'Удалить историю тренировок', null, 'id="pReset"')}
        ${row('info', 'Пройти онбординг заново', '', null, 'id="pOnb"')}</div>
      <p class="sub" style="text-align:center;margin-top:16px;font-size:12px">Kineta ${APP_VERSION} · сигнал: ${Ctrl.source()}</p>`;
  },
  mount(el) {
    $('#pName', el).addEventListener('change', e => { S.profile.name = e.target.value.trim().slice(0, 24) || 'Пользователь'; e.target.value = S.profile.name; $('.prof-card .ava', el).textContent = S.profile.name[0].toUpperCase(); save(); toast('user', 'Имя сохранено'); });
    $('#pName', el).addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
    $$('[data-sw]', el).forEach(b => b.addEventListener('click', e => {
      e.stopPropagation(); const k = b.dataset.sw, c = C();
      if (k === 'theme') { c.theme = c.theme === 'dark' ? 'light' : 'dark'; applyTheme(); }
      else { c[k] = !c[k]; if (k === 'mirror') applyMirror(); if (k === 'voice') c.voice ? Native.say('Голосовые подсказки включены', { force: true }) : Native.hush(); if (k === 'big') applyBig(); }
      b.classList.toggle('on'); save(); vib(8);
    }));
    bindSeg(el, 'theme', v => { C().theme = v; applyTheme(); save(); vib(8); });
    $('#hPal', el).onclick = e => { const b = e.target.closest('[data-pal]'); if (!b) return; C().handPal = b.dataset.pal; applyHand(); save(); $$('#hPal button', el).forEach(x => x.classList.toggle('on', x === b)); Snd.tick(); toast('palette', 'Цвет руки: ' + HAND_PALS[b.dataset.pal].n.toLowerCase()); };
    bindSeg(el, 'hand', v => { const c = C(); c.hand = v; c.mirror = v === 'right'; applyMirror(); save(); const m = $('[data-sw="mirror"]', el); m?.classList.toggle('on', c.mirror); toast('mirror', 'Протез на ' + (v === 'left' ? 'левой' : 'правой') + ' руке', 'Интерфейс — под ' + (c.mirror ? 'левую' : 'правую') + ' здоровую руку'); });
    const se = $('#ses', el); rangeFill(se); se.oninput = () => { C().sessionMin = +se.value; rangeFill(se); $('#sesV', el).textContent = se.value + ' мин'; save(); };
    const g = $('#goal', el); rangeFill(g); g.oninput = () => { S.profile.goalMin = +g.value; rangeFill(g); $('#goalV', el).textContent = g.value + ' мин'; save(); };
    let rate = 0; $('#fbR', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; rate = +b.dataset.v; $$('#fbR button', el).forEach(x => x.classList.toggle('on', x === b)); };
    $('#fbS', el).onclick = () => { if (!rate && !$('#fbT', el).value.trim()) { toast('info', 'Поставьте оценку или напишите пару слов'); return; } (S.feedback ||= []).push({ t: Date.now(), rate, text: $('#fbT', el).value.trim() }); save(); Bus.emit('feedback', { rate }); $('#fbT', el).value = ''; toast('heart', 'Спасибо!', 'Отзыв сохранён и попадёт в экспорт'); confetti(40); };
    $('#pExp', el).onclick = () => {
      const txt = JSON.stringify({ exported: new Date().toISOString(), profile: S.profile, device: S.device, cfg: S.cfg, calib: S.calib, gestures: S.gestures, rotation: S.rotation, stats: S.stats, games: S.games, history: S.history, ach: S.ach, weekly: S.weekly, workshop: S.workshop, feedback: S.feedback || [], version: APP_VERSION }, null, 2); Native.saveFile('kineta-export.json', txt, 'application/json', 'Экспорт Kineta').then(r => r !== 'cancel' && toast('down', r === 'shared' ? 'Файл экспорта готов' : 'Файл экспорта сохранён')).catch(() => toast('down', 'Не удалось сохранить файл')); };
    $('#pReset', el).onclick = () => modal(`<b style="font-size:17px">Сбросить статистику?</b><p class="sub">История игр, дни, счётчик жестов, опыт, испытания недели и мастерская будут удалены. Жесты и настройки останутся.</p><div class="row"><button class="btn ghost sm" data-x="no">Отмена</button><button class="btn danger sm" data-x="yes">Сбросить</button></div>`, (m, close) => m.onclick = e => { const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return; close(); if (x === 'yes') { S.stats = { days: {}, gestTotal: {}, seeded: false }; S.demo = false; document.body.classList.remove('demo'); S.history = []; S.games = {}; S.ach = {}; S.profile.xp = 0; S.profile.streak = 0; S.profile.lastDay = null; S.dailyDone = null; S.missions = null; S.weekly = {}; S.workshop = { parts: 0, built: 0, log: [] }; Mission.ensure(); touchStreak(); save(true); toast('refresh', 'Статистика сброшена'); App.refresh(); } });
    $('#pOnb', el).onclick = () => App.go('onboard');
    $('#pHelp', el).onclick = () => supportSheet();
  }
};
function supportSheet() {
  const faq = [['Протез не реагирует на сокращения', 'Проверьте заряд и подключение, затем пройдите калибровку. Если сигнал слабый — увеличьте чувствительность датчика во вкладке «Датчики».'], ['Протез срабатывает сам по себе', 'Поднимите порог на графике датчиков или выберите профиль «Мягко»: он усиливает сглаживание и подавление ложных срабатываний.'], ['Как сменить жест без телефона?', 'Одновременно напрягите обе мышцы и удерживайте ≈0.3 с — протез переключится на следующий жест группы ротации.'], ['Сколько тренироваться?', 'Начните с 5–10 минут в день. Приложение предложит отдых, если заметит усталость.']];
  sheet(`<h2 style="margin-top:0">Служба поддержки</h2>${faq.map(([q, a], i) => `<div class="card" style="padding:0;margin-top:10px"><button class="between" data-q="${i}" style="width:100%;padding:14px 16px;text-align:left;font-weight:700;font-size:14px">${q}<span class="chev" style="transition:transform .3s">${ic('chev')}</span></button><div class="hidden" style="padding:0 16px 14px;font-size:13px;color:var(--muted);line-height:1.5">${a}</div></div>`).join('')}
    <div class="row" style="margin-top:14px"><button class="btn ghost sm" id="sChat">${ic('chat')} Написать в чат</button></div>`, sh => {
    sh.addEventListener('click', e => { const q = e.target.closest('[data-q]'); if (q) { const a = q.nextElementSibling; a.classList.toggle('hidden'); a.style.animation = 'fadeUp .3s both'; $('.chev', q).style.transform = a.classList.contains('hidden') ? '' : 'rotate(90deg)'; } if (e.target.closest('#sChat')) toast('chat', 'Чат поддержки', 'В прототипе — заглушка: здесь откроется чат с сервисом'); });
  });
}

/* =====================================================================
   Глобальные элементы: статус-бар, тема, зеркало, мобильный эмулятор
   ===================================================================== */
/* Состояние протеза меняется само (обрыв, заряд) — обновляем то, что на экране */
Bus.on('device', () => { const c = App.cur; if (!c) return; if (c.name === 'device') App.refresh(); else if (c.name === 'home') { const b = $('.pill-st', c.el), d = S.device; if (b) b.innerHTML = pillHTML(); } });
Bus.on('battery', () => Bus.emit('device'));
const mqDark = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
const themeNow = () => C().theme === 'auto' ? (mqDark?.matches ? 'dark' : 'light') : C().theme === 'dark' ? 'dark' : 'light';
function applyTheme() {
  const th = themeNow(), bg = th === 'dark' ? '#1B1613' : '#FBF4EA';
  document.documentElement.dataset.theme = th; $('meta[name=theme-color]').content = bg; Native.statusBar(th === 'dark', bg); applyHand();
}
mqDark?.addEventListener?.('change', () => { if (C().theme === 'auto') applyTheme(); });
/* цвет руки: «Титан» берётся из темы (--hand-* в app.css), остальные палитры — поверх неё */
function applyHand() { const k = C().handPal || 'titan', p = HAND_PALS[k], st = document.documentElement.style; for (const n of ['skin', 'shade', 'edge', 'cuff']) { if (k === 'titan' || !p) st.removeProperty('--hand-' + n); else st.setProperty('--hand-' + n, p[n]); } }
function applyBig() { document.body.classList.toggle('big', !!C().big); }
function applyMirror() { document.body.classList.toggle('mirror', C().mirror); $('#phone').classList.toggle('mirror', C().mirror); document.body.classList.toggle('mirror-pads', C().mirror); }
