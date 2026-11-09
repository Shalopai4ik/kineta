/* =====================================================================
   Мини-игры Kineta 3.0. Общий контракт сцены:
     constructor(level 1..3) · resize(W,H) · update(dt, Ctrl, now) · draw(ctx)
     onState({state, prev}) — смена состояния ЭМГ · result() · done
     progress() 0..1 — шкала цели уровня · hud() — строка таймера/счётчика
   Управление — только двумя каналами: К1 (сгибатели, «закрыть»),
   К2 (разгибатели, «открыть»), их комбинацией и покоем.
   Графика рисуется процедурно в «мягком 3D»: пастель, глянец, мягкие тени.
   ===================================================================== */
const imgOk = i => i && i.complete && i.naturalWidth;
/* Рука протеза для canvas: тот же SVG, что и в интерфейсе, с подставленными цветами */
const HAND_IMG = {};
function handImg(key, pose) {
  const pal = HAND_PALS[C().handPal] || HAND_PALS.titan, K = (C().handPal || 'titan') + ':' + key;
  if (HAND_IMG[K]) return HAND_IMG[K];
  const vars = { '--hand-skin': pal.skin, '--hand-shade': pal.shade, '--hand-edge': pal.edge, '--hand-cuff': pal.cuff, '--primary': '#EE7A45' }; // палитры — HAND_PALS в core.js
  let svg = handSVG(pose).replace(/var\((--[a-z-]+)\)/g, (m, v) => vars[v] || '#999');
  if (!/width=/.test(svg.slice(0, 120))) svg = svg.replace('<svg ', '<svg width="368" height="544" ');
  const i = new Image(); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); HAND_IMG[K] = i; return i;
}
const POSES = { fist: [70, 96, 96, 96, 96, 55], open: [0, 0, 0, 0, 0, 15], relax: [12, 10, 12, 16, 20, 30], point: [65, 0, 95, 95, 95, 70] };
const handFor = k => handImg(k, POSES[k]);
function drawHand(ctx, key, x, y, h, alpha = 1) {
  const im = handFor(key); if (!imgOk(im)) return;
  const w = h * 184 / 272; ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = 'rgba(40,52,72,.28)'; ctx.shadowBlur = h * .06; ctx.shadowOffsetY = h * .02; ctx.drawImage(im, x - w / 2, y - h / 2, w, h); ctx.restore();
}
const GFONT = 'Nunito, system-ui, sans-serif';

/* ---------------- Мягкий 3D-набор ---------------- */
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, Math.max(0, h), Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)); }
function txt(ctx, s, x, y, size, color = '#fff', weight = 900, align = 'center') { ctx.font = `${weight} ${size}px ${GFONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
function txtO(ctx, s, x, y, size, fill = '#fff', stroke = '#C85A22', lw = 6, align = 'center') {
  ctx.font = `900 ${size}px ${GFONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y + lw * .25); ctx.strokeText(s, x, y); ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
const hexRgb = h => { if (h.startsWith('rgb')) return h.match(/[\d.]+/g).slice(0, 3).map(Number); h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function shade(hex, k) { const [r, g, b] = hexRgb(hex), t = k > 0 ? 255 : 0, a = Math.abs(k); return `rgb(${Math.round(r + (t - r) * a)},${Math.round(g + (t - g) * a)},${Math.round(b + (t - b) * a)})`; }
const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
/* Тёмная тема: сцены переходят в «вечер» — фон смешивается с ночным синим, солнце становится луной.
   Игровые объекты, шкалы и подписи на плашках остаются яркими, чтобы контраст управления не падал. */
const NIGHT = () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';
const NIGHT_BASE = [27, 30, 47];
function mixRgb(c, base, k) { const [r, g, b] = hexRgb(c); return `rgb(${Math.round(r + (base[0] - r) * k)},${Math.round(g + (base[1] - g) * k)},${Math.round(b + (base[2] - b) * k)})`; }
const luma = c => { const [r, g, b] = hexRgb(c); return (r * .3 + g * .59 + b * .11) / 255; };
/* цвет фона сцены: днём как есть, ночью — приглушённый; уже тёмные цвета не трогаем */
const nt = (c, k = .62) => NIGHT() && luma(c) > .35 ? mixRgb(c, NIGHT_BASE, k) : c;
/* цвет текста прямо на фоне сцены: ночью светлый */
const ink = c => !NIGHT() ? c : c === '#9C8B7F' ? '#B9AEC2' : '#F2ECF5';
/* Форма канала для различения без цвета: К1 — круг, К2 — квадрат, обе — ромб (настройка «Формы каналов») */
function chMark(ctx, ch, x, y, r, col = '#fff') {
  if (!C().shapes) return;
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(40,30,40,.35)'; ctx.lineWidth = 1.5; ctx.beginPath();
  if (ch === 0) ctx.arc(x, y, r, 0, 7);
  else if (ch === 1) ctx.roundRect(x - r * .9, y - r * .9, r * 1.8, r * 1.8, r * .3);
  else { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.15, y); ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r * 1.15, y); ctx.closePath(); }
  ctx.fill(); ctx.stroke(); ctx.restore();
}
/* «мармеладный» прямоугольник: тень-подложка, градиент, глянцевый блик */
function gum(ctx, x, y, w, h, r, col, depth = 5) {
  rr(ctx, x, y + depth, w, h, r); ctx.fillStyle = shade(col, -.22); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shade(col, .25)); g.addColorStop(1, col);
  rr(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
  if (w > 10 && h > 10) { rr(ctx, x + w * .12, y + Math.min(h * .1, 6), w * .76, Math.min(h * .28, 14), Math.min(r, 8)); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill(); }
}
/* глянцевый шар */
function ball(ctx, x, y, r, col, glow = 0) {
  if (glow) { ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = glow; }
  const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r); g.addColorStop(0, shade(col, .55)); g.addColorStop(.55, col); g.addColorStop(1, shade(col, -.2));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  if (glow) ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x - r * .32, y - r * .42, r * .3, r * .18, -.5, 0, 7); ctx.fill();
}
function shadowE(ctx, x, y, rx, ry, a = .18) { ctx.fillStyle = `rgba(90,50,30,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, Math.max(.5, ry), 0, 0, 7); ctx.fill(); }
function skyG(ctx, W, H, stops) { const g = ctx.createLinearGradient(0, 0, 0, H); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), nt(c))); ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40); }
function glow(ctx, x, y, r, col, a = .6) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
function sun(ctx, x, y, r) {
  if (NIGHT()) { // луна
    glow(ctx, x, y, r * 3.2, '#C9D4FF', .28);
    const m = ctx.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r); m.addColorStop(0, '#FFFBEA'); m.addColorStop(1, '#D9DCEB');
    ctx.fillStyle = m; ctx.beginPath(); ctx.arc(x, y, r * .9, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(150,155,185,.35)'; [[.3, -.2, .18], [-.25, .25, .13], [.1, .4, .09]].forEach(([a, b, c]) => { ctx.beginPath(); ctx.arc(x + a * r, y + b * r, c * r, 0, 7); ctx.fill(); });
    return;
  }
  glow(ctx, x, y, r * 4, '#FFE9B0', .75);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#FFF8DC'); g.addColorStop(.7, '#FFE08A'); g.addColorStop(1, '#FFCF6A');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
function cloud(ctx, x, y, s, a = .9) {
  ctx.fillStyle = NIGHT() ? `rgba(190,198,230,${a * .22})` : `rgba(255,255,255,${a})`; ctx.beginPath();
  ctx.arc(x, y, 18 * s, 0, 7); ctx.arc(x + 20 * s, y - 10 * s, 22 * s, 0, 7); ctx.arc(x + 44 * s, y - 2 * s, 17 * s, 0, 7); ctx.arc(x + 24 * s, y + 6 * s, 16 * s, 0, 7); ctx.fill();
}
function hills(ctx, W, base, amp, col, shift, seed, freq = 90, H = 2000) {
  ctx.fillStyle = nt(col, .58); ctx.beginPath(); ctx.moveTo(-10, H);
  for (let x = -10; x <= W + 10; x += 6) { const t = (x + shift) / freq + seed; ctx.lineTo(x, base - amp * (.55 + .45 * Math.sin(t) * Math.sin(t * .41 + seed * 1.7))); }
  ctx.lineTo(W + 10, H); ctx.fill();
}
function gem(ctx, x, y, s, col = '#9B78E8') {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = shade(col, -.15); ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .7, -s * .2); ctx.lineTo(0, s); ctx.lineTo(-s * .7, -s * .2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(col, .2); ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .7, -s * .2); ctx.lineTo(0, 0); ctx.lineTo(-s * .7, -s * .2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(-s * .15, -s * .75); ctx.lineTo(s * .2, -s * .3); ctx.lineTo(-s * .25, -s * .25); ctx.closePath(); ctx.fill();
  ctx.restore();
}
class FX {
  constructor() { this.p = []; this.t = []; this.rings = []; }
  burst(x, y, color, n = 16, sp = 220, star = false) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = sp * (.3 + Math.random()); this.p.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * .3, life: .6 + Math.random() * .5, max: 1.1, r: 2.5 + Math.random() * 4, c: Array.isArray(color) ? pick(color) : color, star: star && Math.random() < .5, rot: Math.random() * 6 }); } }
  pop(x, y, s, color = '#fff', size = 22, stroke = 'rgba(120,60,20,.55)') { this.t.push({ x, y, s, c: color, size, life: 1, stroke }); }
  ring(x, y, color, r = 40) { this.rings.push({ x, y, c: color, r, life: 1 }); }
  update(dt) {
    this.p = this.p.filter(p => (p.life -= dt) > 0); this.p.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= .98; p.rot += dt * 6; });
    this.t = this.t.filter(t => (t.life -= dt * 1.1) > 0); this.t.forEach(t => t.y -= 46 * dt);
    this.rings = this.rings.filter(r => (r.life -= dt * 2.2) > 0);
  }
  draw(ctx) {
    this.rings.forEach(r => { ctx.globalAlpha = r.life; ctx.strokeStyle = r.c; ctx.lineWidth = 4 * r.life + 1; ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (1.6 - r.life * .6), 0, 7); ctx.stroke(); });
    this.p.forEach(p => {
      ctx.globalAlpha = clamp(p.life / p.max * 1.4); ctx.fillStyle = p.c;
      if (p.star) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = k * 1.2566 - 1.57; ctx.lineTo(Math.cos(a) * p.r * 1.6, Math.sin(a) * p.r * 1.6); ctx.lineTo(Math.cos(a + .628) * p.r * .7, Math.sin(a + .628) * p.r * .7); } ctx.fill(); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    });
    this.t.forEach(t => { ctx.globalAlpha = clamp(t.life * 1.6); const s = 1 + Math.max(0, .25 - (1 - t.life)) * 1.6; txtO(ctx, t.s, t.x, t.y, t.size * s, t.c, t.stroke, Math.max(4, t.size * .22)); });
    ctx.globalAlpha = 1;
  }
}
/* большая надпись по центру с «пружинкой» */
class Banner {
  constructor() { this.s = null; }
  show(s, c = '#fff', stroke = '#C85A22', dur = .9, size = 34) { this.s = { s, c, stroke, life: dur, dur, size }; }
  update(dt) { if (this.s && (this.s.life -= dt) <= 0) this.s = null; }
  draw(ctx, x, y) {
    if (!this.s) return; const b = this.s, k = 1 - b.life / b.dur, sc = k < .15 ? .6 + k / .15 * .5 : k < .3 ? 1.1 - (k - .15) / .15 * .1 : 1;
    ctx.save(); ctx.globalAlpha = clamp(b.life / .25); ctx.translate(x, y); ctx.scale(sc, sc); txtO(ctx, b.s, 0, 0, b.size, b.c, b.stroke, 8); ctx.restore();
  }
}
const starsFor = (acc, purity) => { const k = acc * .7 + purity * .3; return k >= .85 ? 3 : k >= .68 ? 2 : k >= .45 ? 1 : 0; };
/* параметр уровня: 1–3 — как задано; дробный уровень (бесконечный режим) — интерполяция, выше 3 — продолжение
   тренда последнего шага с ограничением, целые величины (счётчики) округляются */
const LV = (lv, arr) => {
  if (Number.isInteger(lv) && lv >= 1 && lv <= arr.length) return arr[lv - 1];
  if (typeof arr[0] !== 'number') return arr[clamp(Math.round(lv), 1, arr.length) - 1];
  const n = arr.length, x = clamp(lv, 1, n + 2) - 1, i = Math.min(n - 2, Math.floor(x)), v = arr[i] + (arr[i + 1] - arr[i]) * (x - i);
  const lo = Math.min(...arr), hi = Math.max(...arr), ints = arr.every(Number.isInteger);
  const r = clamp(v, lo * (ints ? 1 : .6), hi * 1.6);
  return ints ? Math.round(r) : r;
};

/* =================== 1. НЕЙРО-ГОНКА (пропорциональное руление) =================== */
class RaceGame {
  constructor(lv) {
    this.diff = lv; this.T = 0; this.dur = 95; this.done = false; this.fx = new FX(); this.ban = new Banner();
    this.SEG = 200; this.ROAD = 1150; this.camH = 1000; this.camD = .84; this.draw_ = 130;
    this.goal = LV(lv, [2200, 3200, 4200]); this.total = 0;
    this.pos = 0; this.speed = 0; this.max = 7800 + lv * 1300; this.px = 0; this.nitro = 1; this.boost = false; this.finished = false;
    this.offT = 0; this.crash = 0; this.shake = 0; this.crystals = 0; this.hits = 0; this.sky = 0; this.cleanDist = 0; this.clean1k = false; this.dist = 0;
    // призрак: лучший финиш этого уровня — дистанция и положение на дороге каждые 0.25 с
    this.gKey = Number.isInteger(lv) && lv <= 3 ? String(lv) : 'endless';
    this.ghost = S.games?.race?.ghost?.[this.gKey] || null; this.trk = { d: [], x: [] }; this.trkT = 0;
    this.build();
  }
  build() {
    const segs = [], need = this.goal * 100 / this.SEG + 260;
    const add = (n, curve, hill = 0) => { for (let i = 0; i < n; i++) { const k = i < n * .2 ? i / (n * .2) : i > n * .8 ? (n - i) / (n * .2) : 1; segs.push({ curve: curve * k, obj: [], side: [] }); } };
    add(70, 0);
    while (segs.length < need) add(30 + Math.floor(Math.random() * 50), pick([0, 0, 2, -2, 3.5, -3.5, 5, -5]) * (.75 + this.diff * .12));
    this.fin = Math.round(this.goal * 100 / this.SEG);
    const cols = ['#86C5F0', '#7FD3A8', '#FFC24B', '#E995B6', '#B79CF0'];
    segs.forEach((g, i) => {
      if (i % 3 === 0) { const s = Math.random() < .5 ? -1 : 1; g.side.push({ t: Math.random() < .55 ? 'tree' : Math.random() < .5 ? 'bush' : 'flower', off: s * rnd(1.45, 2.6), v: Math.random() }); }
      if (i % 26 === 0) { g.side.push({ t: 'lamp', off: -1.3 }); g.side.push({ t: 'lamp', off: 1.3 }); }
      if (i < 90 || i > this.fin - 20 || i % 3) return;
      const r = Math.random();
      if (r < .05 + this.diff * .025) g.obj.push({ t: Math.random() < .5 ? 'car' : 'cone', off: pick([-.62, 0, .62]), c: pick(cols) });
      else if (r < .2) g.obj.push({ t: 'gem', off: pick([-.62, 0, .62]) });
    });
    this.segs = segs; this.len = segs.length * this.SEG;
  }
  resize(W, H) { this.W = W; this.H = H; }
  onState() { }
  progress() { return clamp(this.dist / this.goal); }
  hud() { return fmtTime(this.dur - this.T); }
  ghostAt(T) { const g = this.ghost; if (!g) return null; const f = T / .25, i = Math.floor(f); if (i >= g.d.length - 1) return { d: g.d.at(-1), x: g.x.at(-1), fin: true }; const k = f - i; return { d: g.d[i] + (g.d[i + 1] - g.d[i]) * k, x: g.x[i] + (g.x[i + 1] - g.x[i]) * k }; }
  chips() { const gh = this.ghostAt(this.T), gap = gh ? Math.round(this.dist - gh.d) : null; return [['Скорость', Math.round(this.speed / 40) + ' км/ч'], ...(gap != null ? [['Призрак', (gap >= 0 ? '+' : '−') + Math.abs(gap) + ' м', gap >= 0 ? '#3DB37A' : '#9B78E8']] : []), ...(Ctrl.bothOK() ? [['Нитро', Math.round(this.nitro * 100) + '%', '#9B78E8']] : []), ['Кристаллы', this.crystals]]; }
  hint() { if (this.finished) return ['Финиш!', 'ok']; if (Math.abs(this.px) > 1) return ['Обочина — верни машину на трассу', 'warn']; if (this.boost) return ['Нитро!', 'ok']; return this.T < 6 ? 'К1 — влево · К2 — вправо · обе — нитро' : ''; }
  update(dt, c) {
    this.T += dt; this.fx.update(dt); this.ban.update(dt);
    if (this.finished) { this.speed *= Math.exp(-dt * 1.6); this.pos += this.speed * dt; this.finT += dt; if (this.finT > 1.6) this.done = true; return; }
    if (this.T >= this.dur) { this.done = true; return; }
    const pct = this.speed / this.max, seg = this.segs[Math.floor((this.pos + 840) / this.SEG) % this.segs.length];
    this.boost = c.state === 'BOTH' && this.nitro > 0;
    if (this.boost) this.nitro = Math.max(0, this.nitro - dt * .5); else this.nitro = Math.min(1, this.nitro + dt * .07);
    const target = this.max * (this.boost ? 1.3 : 1) * (Math.abs(this.px) > 1 ? .45 : 1);
    this.speed += (target - this.speed) * dt * (this.speed < target ? .6 : 2.5);
    const steer = c.state === 'BOTH' ? 0 : (c.a[1] - c.a[0]); // К1 (закрытие) — влево, К2 (открытие) — вправо
    this.px += steer * dt * 2.6 * Math.max(.35, pct);
    this.px -= dt * 2 * pct * pct * seg.curve * .16; // центробежная сила
    this.px = clamp(this.px, -1.8, 1.8);
    this.pos += this.speed * dt; this.dist += this.speed * dt / 100;
    this.trkT += dt; if (this.trkT >= .25) { this.trkT -= .25; this.trk.d.push(Math.round(this.dist)); this.trk.x.push(+this.px.toFixed(2)); }
    this.sky += seg.curve * pct * dt * 30;
    if (Math.abs(this.px) > 1) { this.offT += dt; this.shake = .2; this.cleanDist = 0; }
    else { this.cleanDist += this.speed * dt / 100; if (this.cleanDist > 1000 && !this.clean1k) { this.clean1k = true; Mission.ev('race:clean1k'); this.ban.show('1000 м без аварий!', '#fff', '#3DB37A', 1.4, 26); } }
    if (this.crash > 0) this.crash -= dt;
    seg.obj.forEach(o => {
      if (o.hit || Math.abs(o.off - this.px) > .32) return;
      o.hit = true;
      if (o.t === 'gem') { this.crystals++; Snd.coin(); this.fx.burst(this.W / 2, this.H * .8, ['#B79CF0', '#FFFFFF', '#FFD27A'], 14, 220, true); this.fx.pop(this.W / 2, this.H * .62, '+50', '#fff', 24, '#7556D6'); }
      else if (this.crash <= 0) { this.hits++; this.crash = 1; this.speed *= .35; this.shake = .5; this.cleanDist = 0; Snd.bad(); this.fx.burst(this.W / 2, this.H * .82, ['#FFB07C', '#FFD27A', '#fff'], 24, 300); this.ban.show('Бам!', '#fff', '#EE5D5D', .8, 34); }
    });
    if (this.shake > 0) this.shake -= dt;
    if (this.dist >= this.goal) { this.finished = true; this.finT = 0; this.finAt = this.T; Snd.win(); this.ban.show('ФИНИШ!', '#fff', '#3DB37A', 1.6, 44); this.fx.burst(this.W / 2, this.H * .4, ['#FF9A5E', '#FFD27A', '#7FD3A8', '#86C5F0', '#E995B6'], 60, 420, true); }
  }
  get score() { return Math.max(0, Math.round(this.dist + this.crystals * 50 - this.hits * 100 + (this.finished ? (this.dur - this.T) * 25 : 0))); }
  draw(ctx) {
    const W = this.W, H = this.H, hor = H * .44, now = performance.now() / 1000;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - .5) * 8 * this.shake, (Math.random() - .5) * 6 * this.shake);
    skyG(ctx, W, hor + 4, ['#FFC79A', '#FFE2C4', '#FFF4E4']);
    const sx = ((W * .72 - this.sky * .25) % (W + 80) + W + 80) % (W + 80) - 40;
    sun(ctx, sx, hor * .55, 24);
    for (let k = 0; k < 4; k++) { const cx = ((k * 170 - this.sky * .45 + now * 6) % (W + 200) + W + 200) % (W + 200) - 100; cloud(ctx, cx, hor * (.22 + (k % 2) * .18), .8 + (k % 3) * .2, .85); }
    hills(ctx, W, hor + 2, 80, '#F2BFA3', this.sky * .25, 1, 120, hor + 4);
    hills(ctx, W, hor + 2, 52, '#C9E2B0', this.sky * .5, 4, 80, hor + 4);
    ctx.fillStyle = nt('#BFE3A5'); ctx.fillRect(-10, hor, W + 20, H - hor + 10);
    // дорога
    const base = Math.floor(this.pos / this.SEG), bp = (this.pos % this.SEG) / this.SEG, N = this.segs.length;
    let x = 0, dx = -this.segs[base % N].curve * bp, maxy = H; const camX = this.px * this.ROAD, proj = [];
    for (let n = 0; n < this.draw_; n++) {
      const i = (base + n) % N, s = this.segs[i];
      const z1 = n * this.SEG - this.pos % this.SEG + .001, z2 = z1 + this.SEG;
      const P = (z, xx) => { const sc = this.camD / Math.max(1, z); return { x: W / 2 + sc * (xx - camX) * W / 2, y: hor + sc * this.camH * (H - hor) * .9, w: sc * this.ROAD * W / 2, sc }; };
      const p1 = P(z1, x), p2 = P(z2, x + dx); x += dx; dx += s.curve;
      proj[n] = { p1, i, clip: maxy };
      if (z1 <= 0 || p2.y >= maxy) continue;
      const alt = Math.floor(i / 3) % 2, fog = clamp(n / this.draw_);
      ctx.fillStyle = nt(alt ? '#B3DC98' : '#BFE3A5'); ctx.fillRect(-10, p2.y, W + 20, p1.y - p2.y + 1);
      const quad = (x1, w1, x2, w2, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x1 - w1, p1.y + 1.5); ctx.lineTo(x1 + w1, p1.y + 1.5); ctx.lineTo(x2 + w2, p2.y); ctx.lineTo(x2 - w2, p2.y); ctx.fill(); };
      quad(p1.x, p1.w * 1.15, p2.x, p2.w * 1.15, alt ? '#FFF7EE' : '#FF8F5A');
      const fin = i >= this.fin && i < this.fin + 3;
      quad(p1.x, p1.w, p2.x, p2.w, fin ? '#fff' : alt ? '#8E8189' : '#968990');
      if (fin) { const n8 = 8; for (let k = 0; k < n8; k++) if ((k + i) % 2) quad(p1.x - p1.w + p1.w * 2 * (k + .5) / n8, p1.w / n8, p2.x - p2.w + p2.w * 2 * (k + .5) / n8, p2.w / n8, '#3B2F2A'); }
      else if (alt) { quad(p1.x - p1.w / 3, p1.w * .028, p2.x - p2.w / 3, p2.w * .028, '#FFF7EE'); quad(p1.x + p1.w / 3, p1.w * .028, p2.x + p2.w / 3, p2.w * .028, '#FFF7EE'); }
      if (fog > .55) { ctx.fillStyle = `rgba(${NIGHT() ? '27,30,47' : '255,236,214'},${(fog - .55) * 1.4})`; ctx.fillRect(-10, p2.y, W + 20, p1.y - p2.y + 1); }
      maxy = p2.y;
    }
    // объекты и декор — от дальних к ближним
    for (let n = this.draw_ - 1; n > 0; n--) {
      const pr = proj[n]; if (!pr) continue; const s = this.segs[pr.i], { p1 } = pr;
      if (p1.y > H + 60) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(-40, 0, W + 80, pr.clip); ctx.clip();
      s.side.forEach(o => { const sx2 = p1.x + p1.w * o.off, sz = p1.w; if (sz < 3 || sx2 < -sz * 2 || sx2 > W + sz * 2) return; this.prop(ctx, o, sx2, p1.y, sz); });
      if (pr.i === this.fin) { const w = p1.w * 1.25, hh = p1.w * .9; ctx.fillStyle = '#FFF7EE'; ctx.fillRect(p1.x - w - p1.w * .04, p1.y - hh, p1.w * .06, hh); ctx.fillRect(p1.x + w - p1.w * .02, p1.y - hh, p1.w * .06, hh); gum(ctx, p1.x - w, p1.y - hh - p1.w * .14, w * 2, p1.w * .16, p1.w * .06, '#FF8F5A', p1.w * .02); if (p1.w > 40) txt(ctx, 'ФИНИШ', p1.x, p1.y - hh - p1.w * .06, p1.w * .1, '#fff'); }
      s.obj.forEach(o => {
        if (o.hit && o.t === 'gem') return;
        const sx2 = p1.x + p1.w * o.off, sz = p1.w * (o.t === 'car' ? .5 : o.t === 'cone' ? .2 : .2);
        if (sz < 2) return;
        if (o.t === 'car') carRear(ctx, sx2, p1.y, sz, o.c, 0, false);
        else if (o.t === 'cone') cone(ctx, sx2, p1.y, sz);
        else { const yy = p1.y - sz * 1.5 + Math.sin(now * 4 + n) * sz * .15; shadowE(ctx, sx2, p1.y, sz * .5, sz * .12); glow(ctx, sx2, yy, sz * 1.4, '#C9B4FF', .5); gem(ctx, sx2, yy, sz * .8); }
      });
      ctx.restore();
    }
    // призрак лучшего заезда — полупрозрачная машина впереди на дороге
    const gh = this.ghostAt(this.T);
    if (gh && !this.finished) {
      const z = (gh.d - this.dist) * 100, n = Math.floor((z + this.pos % this.SEG) / this.SEG), pr = proj[n];
      if (z > 60 && pr && n < this.draw_ - 2 && pr.p1.w > 3) { ctx.save(); ctx.globalAlpha = .5; ctx.beginPath(); ctx.rect(-40, 0, W + 80, pr.clip); ctx.clip(); carRear(ctx, pr.p1.x + pr.p1.w * clamp(gh.x - this.px, -1.6, 1.6) * .6, pr.p1.y, pr.p1.w * .5, '#B79CF0', 0, false); ctx.restore(); }
    }
    // машина игрока
    const tilt = clamp((Ctrl.a[1] - Ctrl.a[0]) * .2, -.2, .2), cw = Math.min(120, W * .26);
    if (this.boost) { for (let k = 0; k < 6; k++) ball(ctx, W / 2 + (Math.random() - .5) * cw * .5, H - 14 + Math.random() * 12, 4 + Math.random() * 7, pick(['#FFB07C', '#FFD27A', '#FF8F5A'])); }
    if (!(this.crash > 0 && Math.floor(this.crash * 10) % 2)) carRear(ctx, W / 2, H - 20, cw, '#F27D45', tilt, true, this.boost);
    ctx.restore();
    this.fx.draw(ctx);
    this.ban.draw(ctx, W / 2, H * .34);
  }
  prop(ctx, o, x, y, s) {
    if (o.t === 'tree') { const h = s * (.9 + o.v * .5); shadowE(ctx, x, y, s * .35, s * .07); ctx.fillStyle = '#A57B5C'; rr(ctx, x - s * .05, y - h * .55, s * .1, h * .55, s * .03); ctx.fill(); ball(ctx, x, y - h * .7, s * .32, o.v > .5 ? '#7CC58A' : '#94D18B'); ball(ctx, x - s * .18, y - h * .52, s * .2, o.v > .5 ? '#6DB87C' : '#86C77E'); }
    else if (o.t === 'bush') { ball(ctx, x - s * .1, y - s * .12, s * .15, '#8ED39B'); ball(ctx, x + s * .1, y - s * .1, s * .13, '#7CC58A'); }
    else if (o.t === 'flower') { const c = o.v > .66 ? '#FF9DB3' : o.v > .33 ? '#FFD27A' : '#B79CF0'; for (let k = 0; k < 3; k++) { const fx = x + (k - 1) * s * .1, fy = y - s * (.04 + (k % 2) * .05); ctx.fillStyle = '#7CC58A'; ctx.fillRect(fx - 1, fy, 2, s * .05); ball(ctx, fx, fy, Math.max(1.5, s * .035), c); } }
    else if (o.t === 'lamp') { const h = s * .9; ctx.fillStyle = '#6B5A55'; rr(ctx, x - s * .02, y - h, s * .04, h, s * .02); ctx.fill(); glow(ctx, x, y - h, s * .35, '#FFD58A', .55); ball(ctx, x, y - h, Math.max(1.5, s * .06), '#FFD27A'); }
  }
  result() {
    const acc = clamp(1 - this.offT / Math.max(1, this.T) - this.hits * .05) * (this.finished ? 1 : .85);
    let ghostRow = null;
    if (this.finished) {
      const st = S.games.race ||= { best: 0, plays: 0, stars: 0 }, gs = st.ghost ||= {}, old = gs[this.gKey];
      if (!old || this.finAt < old.T) { gs[this.gKey] = { T: +this.finAt.toFixed(2), d: this.trk.d, x: this.trk.x, at: Date.now() }; ghostRow = ['Призрак', old ? `новый: быстрее на ${(old.T - this.finAt).toFixed(1)} с` : 'записан — обгони его в следующий раз']; }
      else ghostRow = ['Призрак', `медленнее на ${(this.finAt - old.T).toFixed(1)} с`];
    } else if (this.ghost) ghostRow = ['Призрак', 'финишировал раньше'];
    return { score: this.score, acc, win: this.finished, extra: [...(ghostRow ? [ghostRow] : []), ['Дистанция', `${Math.round(Math.min(this.dist, this.goal))} / ${this.goal} м`], ['Финиш', this.finished ? fmtTime(this.T) : 'не успел'], ['Кристаллы', this.crystals], ['Аварии', this.hits], ['На обочине', this.offT.toFixed(1) + ' с']] };
  }
}
function carRear(ctx, x, y, w, col, tilt = 0, me = false, boost = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  shadowE(ctx, 0, 2, w * .62, w * .1, .22);
  ctx.fillStyle = '#3B2F2A'; rr(ctx, -w * .56, -w * .2, w * .2, w * .22, w * .06); ctx.fill(); rr(ctx, w * .36, -w * .2, w * .2, w * .22, w * .06); ctx.fill();
  gum(ctx, -w * .5, -w * .5, w, w * .4, w * .14, col, w * .04);
  gum(ctx, -w * .34, -w * .74, w * .68, w * .3, w * .12, shade(col, .15), 0);
  const g = ctx.createLinearGradient(0, -w * .7, 0, -w * .5); g.addColorStop(0, '#CDEBFA'); g.addColorStop(1, '#8FC9EA');
  rr(ctx, -w * .27, -w * .69, w * .54, w * .18, w * .07); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.6)'; rr(ctx, -w * .22, -w * .67, w * .14, w * .06, w * .03); ctx.fill();
  const tl = me && boost ? '#FFE27A' : '#FF6B6B';
  ball(ctx, -w * .36, -w * .3, w * .06, tl, me ? 10 : 0); ball(ctx, w * .36, -w * .3, w * .06, tl, me ? 10 : 0);
  rr(ctx, -w * .16, -w * .22, w * .32, w * .09, w * .03); ctx.fillStyle = '#FFF7EE'; ctx.fill();
  if (me && w > 50) txt(ctx, 'K', 0, -w * .175, w * .07, col);
  ctx.restore();
}
function cone(ctx, x, y, s) {
  shadowE(ctx, x, y, s * .6, s * .12);
  ctx.fillStyle = '#E86A3A'; rr(ctx, x - s * .6, y - s * .15, s * 1.2, s * .18, s * .05); ctx.fill();
  const g = ctx.createLinearGradient(x - s * .4, 0, x + s * .4, 0); g.addColorStop(0, '#FF9A5E'); g.addColorStop(.4, '#FFC29A'); g.addColorStop(1, '#F27D45');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - s * .45, y - s * .12); ctx.lineTo(x - s * .1, y - s * 1.2); ctx.quadraticCurveTo(x, y - s * 1.3, x + s * .1, y - s * 1.2); ctx.lineTo(x + s * .45, y - s * .12); ctx.fill();
  ctx.fillStyle = '#FFF7EE'; ctx.beginPath(); ctx.moveTo(x - s * .32, y - s * .5); ctx.lineTo(x + s * .32, y - s * .5); ctx.lineTo(x + s * .24, y - s * .72); ctx.lineTo(x - s * .24, y - s * .72); ctx.fill();
}

/* =================== 2. ИСКРА (импульс + сила сокращения) =================== */
class FlapGame {
  constructor(lv) {
    this.diff = lv; this.T = 0; this.done = false; this.fx = new FX(); this.ban = new Banner();
    this.goalN = LV(lv, [12, 16, 20]); this.vy = 0; this.lives = 3; this.inv = 0; this.gates = []; this.passed = 0; this.seen = 0; this.gems = 0; this.bg = 0; this.next = 1.2; this.started = false; this.flaps = 0; this.charge = 0; this.peak = 0; this.leakT = 0; this.endT = 0;
    // цвет ворот = канал: оранжевые — К1, голубые — К2. Серии одного цвета короче с уровнем: 3 → 2 → 1 (частое переключение)
    this.mode = 0; this.fl = [0, 0]; this.wrong = 0; this.run = LV(lv, [3, 2, 1]); this.seq = [];
    for (let i = 0, ch = Math.random() < .5 ? 0 : 1; this.seq.length < this.goalN + 2; i++) { const n = lv === 3 ? 1 + (Math.random() < .35) : this.run; for (let k = 0; k < n; k++) this.seq.push(ch); ch = 1 - ch; }
  }
  resize(W, H) { if (!this.W) this.y = H * .45; this.W = W; this.H = H; this.k = H / 600; }
  onState(e) { if (this.done || this.endT) return; if (e.state === 'CH1') this.flap(0); else if (e.state === 'CH2') this.flap(1); }
  flap(ch) {
    if (ch !== this.mode && this.started) this.fx.ring(this.W * .28, this.y, ch ? '#86C5F0' : '#FFB07C', 26);
    this.started = true; this.flaps++; this.fl[ch]++; this.mode = ch; this.charge = .16; this.peak = clamp(Ctrl.a[ch]);
    this.vy = -(300 + 200 * this.peak) * this.k; Snd.flap(); this.fx.burst(this.W * .28, this.y + 18 * this.k, ['rgba(255,255,255,.9)', ch ? '#9FD3F5' : '#FFD27A'], 6, 90);
  }
  nextGate() { const x = this.W * .28; return this.gates.find(g => !g.scored && g.x + 34 >= x); }
  progress() { return clamp(this.seen / this.goalN); }
  hud() { return `${Math.min(this.seen, this.goalN)} / ${this.goalN}`; }
  chips() { return [['Щиты', '♥'.repeat(Math.max(0, this.lives)) + '♡'.repeat(3 - Math.max(0, this.lives)), '#EE5D5D'], ['Ворота', `${this.passed}/${this.goalN}`], ['Кристаллы', this.gems]]; }
  hint() {
    if (!this.started) return 'Сожми К1 или К2 — взлёт. Сила сжатия задаёт высоту, цвет ворот — какой мышцей лететь';
    if (Ctrl.state === 'BOTH') return ['Одна мышца за раз — обе вместе не дают тяги', 'warn'];
    const g = this.nextGate(); if (g && g.ch !== this.mode) return [g.ch ? 'Голубые ворота — взмахни К2 (раскрытие)' : 'Оранжевые ворота — взмахни К1 (сжатие)', 'warn'];
    return '';
  }
  update(dt, c) {
    this.T += dt; this.fx.update(dt); this.ban.update(dt);
    if (this.endT) { this.endT -= dt; if (this.endT <= 0) this.done = true; this.bg += 60 * dt; return; }
    if (this.charge > 0) { this.charge -= dt; const a = clamp(c.a[this.mode]); if (a > this.peak) { this.peak = a; this.vy = Math.min(this.vy, -(300 + 200 * a) * this.k); } } // сила = высота
    if (c.state === 'BOTH') this.leakT += dt;
    const sp = (150 + this.diff * 22 + Math.min(this.seen, 20) * 2.5) * this.k; this.bg += sp * dt;
    if (this.started) { this.vy += 1200 * this.k * dt; this.y += this.vy * dt; }
    else this.y = this.H * .45 + Math.sin(this.T * 3) * 8;
    if (this.inv > 0) this.inv -= dt;
    this.next -= dt;
    if (this.next <= 0 && this.started && this.seen + this.gates.length < this.goalN) {
      const gap = this.H * (.4 - this.diff * .04), cy = rnd(gap / 2 + 40 * this.k, this.H * .86 - gap / 2);
      const n = this.seen + this.gates.length, ch = this.seq[n] ?? 0;
      this.gates.push({ x: this.W + 40, cy, gap, scored: false, gem: Math.random() < .55, n: n + 1, ch, col: ch ? '#86C5F0' : '#FFB07C' });
      this.next = 1.85 - this.diff * .15;
    }
    const x = this.W * .28, r = 18 * this.k + 4;
    this.gates.forEach(g => {
      g.x -= sp * dt;
      if (!g.scored && g.x + 34 < x) {
        g.scored = true; this.seen++;
        if (!g.hit && g.ch === this.mode) { this.passed++; Snd.ok(); this.fx.pop(x, this.y - 44, '+100', '#fff', 22, '#3DB37A'); this.fx.ring(x, this.y, g.col, 30); Mission.ev('flap:gate'); }
        else if (!g.hit) { this.wrong++; Snd.bad(); this.fx.pop(x, this.y - 44, g.ch ? 'нужен К2' : 'нужен К1', '#fff', 16, '#F2A33A'); }
        if (this.seen >= this.goalN) this.win();
      }
      if (g.gem && Math.hypot(g.x - x, g.cy - this.y) < r + 16) { g.gem = false; this.gems++; Snd.coin(); this.fx.burst(g.x, g.cy, ['#B79CF0', '#fff'], 12, 200, true); }
      const inX = Math.abs(g.x - x) < 30 + r * .6, out = this.y - r < g.cy - g.gap / 2 || this.y + r > g.cy + g.gap / 2;
      if (inX && out && this.inv <= 0 && !g.hit) { g.hit = true; this.hurt(); }
    });
    this.gates = this.gates.filter(g => g.x > -70);
    const ground = this.H * .9;
    if (this.started && (this.y > ground - r || this.y < r)) { this.y = clamp(this.y, r, ground - r); this.vy = this.y < this.H / 2 ? 120 : -380 * this.k; if (this.inv <= 0) this.hurt(); }
  }
  win() { this.endT = 1.6; Snd.win(); this.ban.show('Маршрут пройден!', '#fff', '#3DB37A', 1.6, 32); this.fx.burst(this.W / 2, this.H * .4, ['#FF9A5E', '#FFD27A', '#7FD3A8', '#86C5F0'], 50, 380, true); }
  hurt() {
    this.lives--; this.inv = 1.4; Snd.bad(); this.fx.burst(this.W * .28, this.y, ['#FF8A80', '#FFD27A'], 18, 260); this.ban.show(this.lives > 0 ? 'Ой!' : 'Энергия кончилась', '#fff', '#EE5D5D', .9, 30);
    if (this.lives <= 0) this.endT = 1.4;
  }
  get score() { return this.passed * 100 + this.gems * 50 + (this.seen >= this.goalN ? this.lives * 150 : 0); }
  draw(ctx) {
    const W = this.W, H = this.H, t = performance.now() / 1000, ground = H * .9;
    skyG(ctx, W, H, ['#A9D8FF', '#D7ECFF', '#FFF1DE']);
    sun(ctx, W * .8, H * .18, 26);
    for (let k = 0; k < 5; k++) { const cx = ((k * 150 - this.bg * .12) % (W + 180) + W + 180) % (W + 180) - 90; cloud(ctx, cx, H * (.12 + (k % 3) * .1), .7 + (k % 2) * .4, .9); }
    // город мечты
    for (let k = 0; k < 14; k++) {
      const bw = 46, bx = ((k * 62 - this.bg * .25) % (14 * 62) + 14 * 62) % (14 * 62) - 60, bh = 70 + ((k * 37) % 5) * 26;
      gum(ctx, bx, ground - bh - 30, bw, bh + 40, 14, nt(['#E8DDFB', '#FBE0D2', '#DCEBFA'][k % 3], .55), 0);
      ctx.fillStyle = 'rgba(255,214,140,.8)'; for (let wy = 0; wy < bh / 26 - 1; wy++) for (let wx = 0; wx < 2; wx++) if ((k + wy + wx) % 3) { rr(ctx, bx + 10 + wx * 18, ground - bh - 14 + wy * 26, 9, 12, 3); ctx.fill(); }
    }
    hills(ctx, W, ground + 4, 26, '#BFE6B8', this.bg * .6, 2, 70, H + 10);
    ctx.fillStyle = nt('#A8DB9F'); ctx.fillRect(0, ground + 6, W, H);
    // ворота
    this.gates.forEach(g => {
      const top = g.cy - g.gap / 2, bot = g.cy + g.gap / 2, w = 54;
      gum(ctx, g.x - w / 2, -20, w, top + 20, 18, g.col, 0); gum(ctx, g.x - w / 2 - 6, top - 22, w + 12, 22, 11, shade(g.col, -.08), 4);
      gum(ctx, g.x - w / 2, bot, w, ground - bot + 30, 18, g.col, 0); gum(ctx, g.x - w / 2 - 6, bot, w + 12, 22, 11, shade(g.col, -.08), 4);
      ctx.strokeStyle = `rgba(255,255,255,${.5 + .2 * Math.sin(t * 5)})`; ctx.lineWidth = 3; ctx.setLineDash([2, 10]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(g.x, top + 6); ctx.lineTo(g.x, bot - 6); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, g.ch ? 'К2' : 'К1', g.x + (C().shapes ? 7 : 0), top - 11, 12, '#fff'); chMark(ctx, g.ch, g.x - 12, top - 11, 4.5);
      if (g.gem) { const yy = g.cy + Math.sin(t * 3 + g.x * .01) * 6; glow(ctx, g.x, yy, 30, '#C9B4FF', .6); gem(ctx, g.x, yy, 13); }
    });
    // дрон
    const x = W * .28, r = 18 * this.k + 4;
    if (!(this.inv > 0 && Math.floor(this.inv * 12) % 2) && this.lives > 0) {
      const mc = this.mode ? '#5FB3EA' : '#FF9A5E'; glow(ctx, x, this.y, r * 2.1, mc, .35);
      drone(ctx, x, this.y, r, t, clamp(this.vy / 900, -.45, .6), this.charge > 0);
      ctx.strokeStyle = mc; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, this.y, r + 5, 0, 7); ctx.stroke();
      txt(ctx, this.mode ? 'К2' : 'К1', x, this.y + r + 16, 11, mc); chMark(ctx, this.mode ? 1 : 0, x + 16, this.y + r + 16, 4, mc);
    }
    this.fx.draw(ctx);
    this.ban.draw(ctx, W / 2, H * .38);
  }
  result() { const acc = this.seen ? this.passed / Math.max(this.seen, this.goalN * (this.lives <= 0 ? 1 : 0)) : 0; return { score: this.score, acc: clamp(acc), win: this.seen >= this.goalN && this.passed >= Math.ceil(this.goalN * .5), extra: [['Ворота нужным каналом', `${this.passed} / ${this.goalN}`], ['Не тем каналом', this.wrong], ['Щиты', `${Math.max(0, this.lives)} из 3`], ['Кристаллы', this.gems], ['Взмахи К1 / К2', `${this.fl[0]} / ${this.fl[1]}`]] }; }
}
function drone(ctx, x, y, r, t, tilt, thrust) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  const pw = r * 1.5 * Math.abs(Math.sin(t * 40));
  ctx.fillStyle = '#D8CABC'; rr(ctx, -r * .08, -r * 1.25, r * .16, r * .4, 2); ctx.fill();
  ctx.fillStyle = 'rgba(120,100,90,.55)'; ctx.beginPath(); ctx.ellipse(0, -r * 1.28, pw + 2, r * .14, 0, 0, 7); ctx.fill();
  if (thrust) { glow(ctx, 0, r * 1.1, r * 1.1, '#FFD27A', .8); }
  ball(ctx, 0, 0, r, '#FFFFFF');
  rr(ctx, -r * .7, -r * .45, r * 1.4, r * .75, r * .35); ctx.fillStyle = '#3B2F2A'; ctx.fill();
  const bl = (t % 2.8) > 2.68 ? .2 : 1; ctx.fillStyle = '#FFB070'; ctx.shadowColor = '#FF9A5E'; ctx.shadowBlur = 6;
  [-.28, .28].forEach(ex => { ctx.beginPath(); ctx.ellipse(ex * r, -r * .1, r * .13, r * .17 * bl, 0, 0, 7); ctx.fill(); }); ctx.shadowBlur = 0;
  ball(ctx, -r * 1.05, r * .2, r * .25, '#FF9A5E'); ball(ctx, r * 1.05, r * .2, r * .25, '#FF9A5E');
  ctx.restore();
}

/* =================== 3. РИТМ-ПУЛЬС (тайминг, удержание, переключение) =================== */
class RhythmGame {
  constructor(lv) {
    this.diff = lv; this.T = -1.2; this.done = false; this.fx = new FX(); this.ban = new Banner();
    this.combo = 0; this.maxCombo = 0; this.hits = 0; this.perfect = 0; this.miss = 0; this.extra = 0; this.sc = 0; this.heldN = 0;
    this.bpm = LV(lv, [78, 92, 106]); this.beat = 60 / this.bpm; this.lead = 2; this.notes = []; this.lit = [0, 0]; this.mel = 0;
    const P1 = [[[0, 0], [2, 1]], [[0, 1], [2, 0]], [[0, 0, 2]], [[0, 1, 2]], [[0, 0], [2, 0]], [[0, 1], [2, 1]]];
    const P2 = [...P1, [[0, 0], [1, 1], [2, 0]], [[0, 1], [1, 0], [3, 1]], [[0, 0, 1], [2, 1, 1]], [[0, 0], [2, 2]]];
    const P3 = [...P2, [[0, 2], [2, 0], [3, 1]], [[0, 0], [1, 1], [2, 0], [3, 1]], [[0, 1, 3]], [[0, 2], [2, 2]]];
    const pool = LV(lv, [P1, P2, P3]), bars = LV(lv, [12, 14, 16]);
    for (let b = 1; b <= bars; b++) pick(pool).forEach(([o, lane, len]) => this.notes.push({ t: (b * 4 + o) * this.beat, lane, len: (len || 0) * this.beat }));
    if (!Ctrl.bothOK()) this.notes.forEach((n, i) => { if (n.lane === 2) n.lane = i % 2; }); // режим протеза без «обе мышцы» или СПППР на 2 жеста
    this.end = (bars * 4 + 6) * this.beat;
  }
  resize(W, H) { this.W = W; this.H = H; }
  laneX(l) { return l === 2 ? this.W / 2 : this.W / 2 + (l ? 1 : -1) * Math.min(this.W * .2, 120); }
  progress() { return clamp(this.T / this.end); }
  hud() { return fmtTime(Math.max(0, this.end - this.T)); }
  chips() { return [['Ноты', `${this.hits}/${this.notes.length}`], ['Комбо', '×' + this.combo, '#9B78E8'], ['Идеально', this.perfect]]; }
  hint() { if (this.T < 0) return 'Приготовься… ' + Math.ceil(-this.T); if (this.notes.some(n => n.holding)) return ['Держи! Не отпускай до конца ноты', 'ok']; return this.T < 6 ? 'Лови шарики нужной мышцей, когда они на кругах' : ''; }
  onState(e) {
    if (this.T < -.3) return;
    const t = this.T - .04, want = e.state === 'CH1' ? 0 : e.state === 'CH2' ? 1 : e.state === 'BOTH' ? 2 : -1;
    if (want < 0) return;
    const win = .28;
    const n = this.notes.find(n => !n.j && n.lane === want && Math.abs(n.t - t) < win);
    if (!n) { if (!this.notes.some(n => !n.j && n.lane === 2 && Math.abs(n.t - t) < .45) && !this.notes.some(n => n.holding)) { this.extra++; this.combo = 0; this.ban.show('Лишнее', '#fff', '#F2A33A', .5, 22); } return; }
    const d = Math.abs(n.t - t); n.j = d < .1 ? 'p' : 'g'; n.hitT = this.T;
    const pts = n.j === 'p' ? 300 : 150; this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (this.combo === 15) Mission.ev('rhythm:combo15');
    if (this.combo && this.combo % 10 === 0) { this.ban.show('Комбо ×' + this.combo, '#fff', '#9B78E8', .9, 30); }
    this.sc += pts * (1 + Math.floor(this.combo / 10) * .5); this.hits++; if (n.j === 'p') this.perfect++;
    this.judge = { s: n.j === 'p' ? 'ИДЕАЛЬНО' : 'ХОРОШО', c: n.j === 'p' ? '#7FD3A8' : '#FFD27A', life: .6 };
    const scale = [523, 587, 659, 784, 880, 1047]; Snd.pluck(scale[(this.mel++ * 2 + n.lane) % scale.length]);
    const col = n.lane === 0 ? '#FF9A5E' : n.lane === 1 ? '#6CC0F0' : '#B597FF';
    this.fx.burst(this.laneX(n.lane), this.hitY(), [col, '#fff', '#FFD27A'], 18, 240, true); this.fx.ring(this.laneX(n.lane), this.hitY(), col, 34);
    if (n.len) n.holding = true;
  }
  hitY() { return this.H * .8; }
  update(dt, c) {
    const pb = Math.floor(this.T / this.beat * 2); this.T += dt; this.fx.update(dt); this.ban.update(dt);
    if (this.T > this.end) { this.done = true; return; }
    if (this.T > 0 && Math.floor(this.T / this.beat * 2) !== pb) { const half = Math.floor(this.T / this.beat * 2); if (half % 2 === 0) { Snd.kick(); this.pulse = 1; } else Snd.hat(); }
    this.pulse = Math.max(0, (this.pulse || 0) - dt * 3);
    const st = c.state;
    this.lit = [st === 'CH1' || st === 'BOTH' ? 1 : this.lit[0] * .88, st === 'CH2' || st === 'BOTH' ? 1 : this.lit[1] * .88];
    this.notes.forEach(n => {
      if (!n.j && this.T - .04 > n.t + .3) { n.j = 'm'; this.miss++; this.combo = 0; this.judge = { s: 'МИМО', c: '#FF8A80', life: .6 }; }
      if (n.holding) {
        const need = n.lane === 0 ? 'CH1' : 'CH2';
        if (this.T >= n.t + n.len) { n.holding = false; n.held = true; this.heldN++; this.sc += 200; this.fx.pop(this.laneX(n.lane), this.H * .66, 'Удержал!', '#fff', 18, '#3DB37A'); Snd.ok(); }
        else if (st !== need && st !== 'BOTH') { if (this.T < n.t + n.len - .15) { n.holding = false; n.broke = true; this.combo = 0; this.judge = { s: 'РАНО ОТПУСТИЛ', c: '#FFB07C', life: .7 }; } }
        else { this.sc += dt * 80; if (Math.random() < dt * 20) this.fx.burst(this.laneX(n.lane), this.hitY(), n.lane ? '#9AD3F3' : '#FFB98C', 1, 80); }
      }
    });
    if (this.judge) this.judge.life -= dt;
  }
  get score() { return Math.round(this.sc); }
  draw(ctx) {
    const W = this.W, H = this.H, hitY = this.hitY(), pxs = (hitY + 20) / this.lead, now = performance.now() / 1000, pu = this.pulse || 0;
    skyG(ctx, W, H, ['#2E2342', '#4A2E52', '#7A4256']);
    for (let k = 0; k < 40; k++) { const sx = (k * 97.3) % W, sy = (k * 53.7) % (H * .55), tw = .4 + .6 * Math.abs(Math.sin(now * 1.3 + k)); ctx.fillStyle = `rgba(255,240,220,${tw * .7})`; ctx.beginPath(); ctx.arc(sx, sy, 1.2 + (k % 3) * .5, 0, 7); ctx.fill(); }
    // гирлянда
    const sag = 34, bulbs = 11, cols = ['#FFD27A', '#FF9A6B', '#FFB4C8', '#9FD8FF', '#B9F0C8'];
    ctx.strokeStyle = 'rgba(40,25,30,.8)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40; ctx.lineTo(u * W, 18 + Math.sin(u * Math.PI) * sag); } ctx.stroke();
    for (let i = 0; i < bulbs; i++) { const u = (i + .5) / bulbs, bx = u * W, by = 22 + Math.sin(u * Math.PI) * sag, c = cols[i % cols.length], on = .55 + .45 * ((i + Math.floor(this.T / this.beat)) % 2 ? pu : 1 - pu * .5); glow(ctx, bx, by + 6, 30, c, .55 * on); ball(ctx, bx, by + 6, 6.5, c); }
    // сцена
    const fl = ctx.createLinearGradient(0, H * .62, 0, H); fl.addColorStop(0, 'rgba(255,170,120,0)'); fl.addColorStop(1, 'rgba(255,170,120,.25)'); ctx.fillStyle = fl; ctx.fillRect(0, H * .62, W, H);
    for (let k = 0; k < 16; k++) { const bw = W / 16, h = (8 + 26 * Math.abs(Math.sin(k * 1.7 + this.T * 3))) * (.4 + pu * .8); rr(ctx, k * bw + 3, H - h - 4, bw - 6, h, 4); ctx.fillStyle = `rgba(255,${180 + k * 4},150,.28)`; ctx.fill(); }
    // дорожки
    const lw = Math.min(W * .24, 110);
    [0, 1].forEach(l => {
      const x = this.laneX(l), col = l ? '#6CC0F0' : '#FF9A5E', lit = this.lit[l];
      const lg = ctx.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, rgba(col, 0)); lg.addColorStop(1, rgba(col, .1 + lit * .28));
      rr(ctx, x - lw / 2, 50, lw, H, lw / 2); ctx.fillStyle = lg; ctx.fill();
      for (let b = 0; b < 8; b++) { const yy = hitY - ((Math.ceil(this.T / this.beat) + b) * this.beat - this.T) * pxs; if (yy > 50 && yy < hitY) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x - lw / 2 + 10, yy, lw - 20, 2); } }
      glow(ctx, x, hitY, 60, col, .25 + lit * .45);
      ctx.strokeStyle = col; ctx.lineWidth = 5 + lit * 3; ctx.beginPath(); ctx.arc(x, hitY, 30 + lit * 4, 0, 7); ctx.stroke();
      ctx.fillStyle = rgba(col, .18 + lit * .3); ctx.beginPath(); ctx.arc(x, hitY, 26, 0, 7); ctx.fill();
      txt(ctx, l ? 'К2' : 'К1', x, hitY + 1, 15, '#fff');
      txt(ctx, l ? 'К2 · ОТКРЫТЬ' : 'К1 · ЗАКРЫТЬ', x, hitY + 52, 11.5, col);
    });
    // ноты
    this.notes.forEach(n => {
      const y = hitY - (n.t - this.T) * pxs; if (y < -60 && !n.len) return; if (y < -600) return;
      const x = this.laneX(n.lane), col = n.lane === 0 ? '#FF9A5E' : n.lane === 1 ? '#6CC0F0' : '#B597FF';
      if (n.len && !n.held) {
        const y2 = hitY - (n.t + n.len - this.T) * pxs, yb = n.holding ? hitY : y;
        if (yb > y2 && !(n.j === 'm' && y > H + 40)) { rr(ctx, x - 13, y2, 26, yb - y2, 13); ctx.fillStyle = n.broke ? 'rgba(255,255,255,.12)' : rgba(col, n.holding ? .85 : .45); ctx.fill(); ball(ctx, x, y2, 11, n.broke ? '#8C7F86' : col); }
      }
      if (n.j && n.j !== 'm') return;
      if (n.j === 'm' && y > H + 30) return;
      ctx.globalAlpha = n.j === 'm' ? .3 : 1;
      if (n.lane === 2) { const x0 = this.laneX(0) - 26, w = this.laneX(1) - this.laneX(0) + 52; gum(ctx, x0, y - 17, w, 34, 17, col, 4); txt(ctx, 'ОБЕ', W / 2, y, 14, '#fff'); chMark(ctx, 2, W / 2 - 34, y, 6); }
      else { ball(ctx, x, y, 22, col, 16); chMark(ctx, n.lane, x, y + 2, 7); }
      ctx.globalAlpha = 1;
    });
    this.fx.draw(ctx);
    if (this.combo > 2) { txtO(ctx, '×' + this.combo, W / 2, 86, 30, '#fff', '#9B78E8', 7); txt(ctx, 'КОМБО', W / 2, 110, 11, '#E6D8FF', 900); }
    if (this.judge && this.judge.life > 0) { ctx.globalAlpha = clamp(this.judge.life * 2.5); txtO(ctx, this.judge.s, W / 2, H * .46, 26 + (.6 - this.judge.life) * 8, this.judge.c, 'rgba(40,20,30,.7)', 6); ctx.globalAlpha = 1; }
    this.ban.draw(ctx, W / 2, H * .38);
  }
  result() { const tot = this.notes.length + this.notes.filter(n => n.len).length; return { score: this.score, acc: tot ? (this.hits + this.heldN) / tot : 0, win: this.hits / Math.max(1, this.notes.length) >= .6, extra: [['Ноты', `${this.hits} / ${this.notes.length}`], ['Идеально', this.perfect], ['Макс. комбо', '×' + this.maxCombo], ['Удержания', this.heldN], ['Лишние сокращения', this.extra]] }; }
}

/* =================== 4. РЫБАЛКА (покой → реакция → контроль силы) =================== */
const FISH = [
  { n: 'Карась', c: '#F2B33A', pts: 200, ag: 1, w: [.4, 1.2] },
  { n: 'Окунь', c: '#8CCB7A', pts: 300, ag: 1.3, w: [.3, 1.5] },
  { n: 'Форель', c: '#F28CA0', pts: 400, ag: 1.6, w: [.8, 2.4] },
  { n: 'Щука', c: '#7FA88A', pts: 550, ag: 2, w: [1.5, 4.5] }
];
class FishGame {
  constructor(lv) {
    this.diff = lv; this.T = 0; this.dur = LV(lv, [100, 110, 120]); this.done = false; this.fx = new FX(); this.ban = new Banner();
    this.goalN = LV(lv, [3, 4, 5]); this.caught = 0; this.lost = 0; this.scared = 0; this.inT = 0; this.fightT = 0; this.wave = 0; this.leakT = 0; this.sc = 0; this.bag = [];
    this.zone = .3; this.newFish(); this.endT = 0;
  }
  newFish() { this.ph = 'wait'; this.pt = 0; this.wait = rnd(1.6, 3.2); this.relaxT = 0; this.sp = FISH[Math.min(FISH.length - 1, Math.floor(Math.random() * (this.diff + 1.6)))]; this.fish = .5; this.fv = 0; this.ft = .5; this.ftT = 0; this.prog = .3; }
  resize(W, H) { this.W = W; this.H = H; }
  progress() { return clamp(this.caught / this.goalN); }
  hud() { return fmtTime(this.dur - this.T); }
  onState(e) {
    if (this.ph === 'wait' && e.state !== 'REST') { this.scared++; this.wait += 1; this.ban.show('Тише — рыба пугается', '#fff', '#F2A33A', 1, 22); Snd.bad(); }
    if (this.ph === 'bite' && e.state === 'CH1') { this.ph = 'fight'; this.pt = 0; Snd.whoosh(); this.ban.show('Подсечка!', '#fff', '#3DB37A', .8, 32); this.fx.burst(this.bx(), this.wy() + 6, ['#fff', '#BDE7F7'], 16, 200); this.rt = this.biteT; }
    else if (this.ph === 'bite' && e.state === 'CH2') { this.ban.show('Сожми (К1)!', '#fff', '#F27D45', .6, 24); }
  }
  // раскладка сцены: масштаб u от размера холста, справа — полупрозрачная колонка шкалы силы
  u() { return clamp(Math.min(this.W / 380, this.H / 560), .75, 1.4); }
  mw() { return Math.round(clamp(this.W * .12, 44, 58)); }
  wy() { return this.H * .34; }
  sw() { return this.W - this.mw() - 20; }
  bx() { return this.sw() * .62; }
  fishY() { const wy = this.wy(); return wy + 46 * this.u() + (this.H - wy - 100 * this.u()) * (1 - (this.fish ?? .5)); }
  chips() { return [['Улов', `${this.caught}/${this.goalN}`], ['Сорвалось', this.lost], ['Рыба', this.ph === 'fight' ? this.sp.n : '—', this.ph === 'fight' ? this.sp.c : null]]; }
  hint() { if (this.endT) return ['Улов собран!', 'ok']; if (this.ph === 'wait') return 'Расслабь руку и жди поклёвку'; if (this.ph === 'bite') return ['Клюёт! Сожми К1!', 'act']; if (this.leak) return ['Одна мышца за раз — от встречного сигнала зона сжалась', 'warn']; return this.inZ ? ['Отлично, держи силу', 'ok'] : (this.fish > .5 ? 'Рыбка вверху — подтяни леску К1' : 'Рыбка внизу — отпусти леску К2'); }
  update(dt, c) {
    this.T += dt; this.wave += dt; this.fx.update(dt); this.ban.update(dt);
    if (this.endT) { this.endT -= dt; if (this.endT <= 0) this.done = true; return; }
    if (this.T >= this.dur) { this.done = true; return; }
    this.pt += dt;
    if (this.ph === 'wait') { if (c.state === 'REST') this.relaxT += dt; if (this.pt >= this.wait) { this.ph = 'bite'; this.pt = 0; this.biteT = 0; Snd.splash(); this.fx.ring(this.bx(), this.wy() + 4, '#fff', 20); } }
    else if (this.ph === 'bite') { this.biteT = this.pt; if (this.pt > 1.8) { this.ph = 'wait'; this.pt = 0; this.wait = rnd(1.2, 2.4); this.ban.show('Не успел подсечь', '#fff', '#F2A33A', .9, 22); } }
    else if (this.ph === 'fight') {
      this.fightT += dt;
      const hard = this.diff * .6 + this.sp.ag;
      // рыба уходит то вверх (нужен К1), то вниз (нужен К2) — оба канала работают поровну
      this.ftT -= dt; if (this.ftT <= 0) { this.ftUp = !this.ftUp; this.ft = this.ftUp ? rnd(.62, .9) : rnd(.1, .38); this.ftT = rnd(1.5, 2.8) / (1 + hard * .2); }
      this.fv += ((this.ft - this.fish) * (1.6 + hard) - this.fv * 2.4) * dt; this.fish = clamp(this.fish + this.fv * dt, .05, .95);
      // пропорционально: покой — зона посередине, К1 тянет вверх, К2 опускает; встречное сокращение сжимает зону
      this.zone += (clamp(.5 + .5 * (clamp(c.a[0]) - clamp(c.a[1]))) - this.zone) * Math.min(1, dt * 10);
      const leak = c.a[0] > C().thr1 * .5 && c.a[1] > C().thr2 * .5; if (leak) this.leakT += dt;
      this.zh = (.28 - this.diff * .03) * (leak ? .55 : 1);
      const inZ = Math.abs(this.fish - this.zone) < this.zh / 2;
      if (inZ) { this.inT += dt; this.prog += dt * (.24 - this.diff * .02); if (Math.random() < dt * 12) Snd.reel(); } else this.prog -= dt * .16;
      this.inZ = inZ; this.leak = leak;
      if (this.prog >= 1) {
        const kg = +rnd(...this.sp.w).toFixed(1); this.caught++; this.bag.push({ ...this.sp, kg }); this.sc += this.sp.pts + Math.round(kg * 50);
        Snd.win(); Mission.ev('fish:catch'); this.fx.burst(this.bx(), this.wy(), ['#FFD27A', '#fff', this.sp.c], 34, 320, true);
        this.show = { sp: this.sp, kg, life: 1.8 };
        if (this.caught >= this.goalN) { this.endT = 2; this.ban.show('Улов собран!', '#fff', '#3DB37A', 2, 34); } else this.newFish();
      }
      if (this.prog <= 0) { this.lost++; Snd.bad(); this.ban.show('Сорвалась…', '#fff', '#EE5D5D', 1, 28); this.newFish(); }
    }
    if (this.show && (this.show.life -= dt) <= 0) this.show = null;
  }
  get score() { return Math.round(this.sc + this.inT * 10); }
  draw(ctx) {
    const W = this.W, H = this.H, wy = this.wy(), t = this.wave, SW = this.sw(), u = this.u(), fightK = this.ph === 'fight' ? 1 : 0;
    // ---- небо и берег ----
    skyG(ctx, W, wy + 4, ['#FFB98C', '#FFD3AE', '#FFE9D2']);
    glow(ctx, SW * .7, wy - 18 * u, 120 * u, '#FFE29A', .5);
    sun(ctx, SW * .7, wy - 26 * u, 26 * u);
    cloud(ctx, SW * .14 + Math.sin(t * .1) * 20, wy * .3, .75 * u, .85); cloud(ctx, SW * .52 + Math.sin(t * .08) * 30, wy * .14, .55 * u, .7);
    hills(ctx, W, wy + 2, 46 * u, '#EBB89F', 0, 1, 110, wy + 3); hills(ctx, W, wy + 2, 26 * u, '#BFD9A8', 40, 3, 70, wy + 3);
    // ---- вода ----
    const g = ctx.createLinearGradient(0, wy, 0, H); g.addColorStop(0, nt('#95D3E2', .45)); g.addColorStop(.45, nt('#5FAFD0', .45)); g.addColorStop(1, nt('#2F78A8', .45)); ctx.fillStyle = g; ctx.fillRect(0, wy, W, H - wy);
    for (let k = 0; k < 10; k++) { const ry = wy + 7 + k * 8 * u, rw = (38 - k * 3) * u; ctx.fillStyle = `rgba(255,228,165,${.5 - k * .045})`; rr(ctx, SW * .7 - rw / 2 + Math.sin(t * 2 + k) * 5, ry, rw, 3, 2); ctx.fill(); }
    // световые лучи под водой
    ctx.save(); ctx.globalAlpha = .08 + fightK * .04; ctx.fillStyle = '#fff';
    for (let k = 0; k < 4; k++) { const x0 = SW * (.15 + k * .24) + Math.sin(t * .4 + k) * 14; ctx.beginPath(); ctx.moveTo(x0, wy); ctx.lineTo(x0 + 26 * u, wy); ctx.lineTo(x0 + 70 * u, H); ctx.lineTo(x0 + 20 * u, H); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let k = 0; k < 8; k++) { const yy = wy + 26 + ((k * 53) % Math.max(40, H - wy - 50)), xx = ((k * 131 + t * 14) % (W + 60)) - 30; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 10, yy - 4, xx + 22, yy); ctx.stroke(); }
    // кувшинки и водоросли
    [[.86, .8], [.1, .93]].forEach(([a, b], i) => { const lx = SW * a, ly = wy + (H - wy) * b; ctx.fillStyle = '#8CCB7A'; ctx.beginPath(); ctx.ellipse(lx, ly, 19 * u, 7 * u, 0, .3, 6.0); ctx.lineTo(lx, ly); ctx.fill(); if (!i) ball(ctx, lx + 4, ly - 4, 4.5 * u, '#FFB4C8'); });
    ctx.strokeStyle = 'rgba(60,140,110,.55)'; ctx.lineWidth = 4;
    for (let k = 0; k < 5; k++) { const x0 = SW * (.3 + k * .13), h0 = (34 + (k * 17) % 30) * u; ctx.beginPath(); ctx.moveTo(x0, H); ctx.quadraticCurveTo(x0 + Math.sin(t * 1.4 + k) * 9, H - h0 * .6, x0 + Math.sin(t * 1.1 + k) * 6, H - h0); ctx.stroke(); }
    // ---- удочка из нижнего левого угла (вид от рыбака) ----
    const bx = this.bx(), dip = this.ph === 'bite' ? 6 + Math.sin(this.pt * 18) * 5 : fightK ? 9 : Math.sin(t * 2.4) * 2;
    const ctlY = wy + (H - wy) * .25 + fightK * 20, tip = { x: SW * .4, y: wy - (fightK ? 26 : 46) * u + (this.ph === 'bite' ? Math.sin(this.pt * 18) * 4 : 0) };
    ctx.lineCap = 'round'; ctx.strokeStyle = '#7A4E33'; ctx.lineWidth = 7 * u; ctx.beginPath(); ctx.moveTo(-6, H * .98); ctx.quadraticCurveTo(SW * .16, ctlY, tip.x, tip.y); ctx.stroke();
    ctx.strokeStyle = '#A87252'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(-4, H * .98 - 4); ctx.quadraticCurveTo(SW * .16, ctlY - 3, tip.x, tip.y); ctx.stroke();
    ball(ctx, SW * .06, H * .9, 11 * u, '#5A3A28'); ball(ctx, SW * .06, H * .9, 5 * u, '#C9A27E');
    const fy = wy + 4 + dip, fishY = this.fishY();
    ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo((tip.x + bx) / 2, Math.min(tip.y, fy) - 10 + fightK * 24, bx, fy); ctx.stroke();
    if (fightK) { ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(bx, fy); ctx.lineTo(bx + 6, fishY); ctx.stroke(); ctx.setLineDash([]); }
    // поплавок
    ball(ctx, bx, fy, 8 * u, '#FF6B6B'); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, fy + 3 * u, 7.5 * u, 0, Math.PI); ctx.fill();
    if (!fightK) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(bx, wy + 10, (16 + Math.sin(t * 3) * 3) * u, 4 * u, 0, 0, 7); ctx.stroke(); }
    // поклёвка: пузырь «!» с таймером подсечки
    if (this.ph === 'bite') {
      const k = clamp(this.pt / 1.8), by = fy - 46 * u, r = 20 * u, pulse = 1 + Math.sin(this.pt * 14) * .06;
      for (let q = 0; q < 2; q++) { const p = (this.pt * 1.6 + q * .5) % 1; ctx.strokeStyle = `rgba(255,255,255,${.6 - p * .6})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(bx, wy + 8, (12 + p * 30) * u, (3 + p * 7) * u, 0, 0, 7); ctx.stroke(); }
      ctx.save(); ctx.translate(bx, by); ctx.scale(pulse, pulse);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-6, r - 3); ctx.lineTo(0, r + 9); ctx.lineTo(6, r - 3); ctx.fill();
      ctx.strokeStyle = '#F27D45'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r - 4, -Math.PI / 2, -Math.PI / 2 + 6.283 * (1 - k)); ctx.stroke();
      txt(ctx, '!', 0, 1, 24 * u, '#F27D45'); ctx.restore();
    }
    // рыба во время вываживания
    if (fightK) { glow(ctx, bx + 6, fishY, 46 * u, this.sp.c, .35); fishSprite(ctx, bx + 6, fishY, 28 * u, this.sp.c, this.fv > 0 ? 1 : -1, t); }
    this.fx.draw(ctx);
    // ---- улов: слоты в левом верхнем углу ----
    const sl = 26 * u, sx = 12, sy = 12;
    gum(ctx, sx, sy, this.goalN * (sl + 4) + 8, sl + 8, 12, '#FFFDFA', 3);
    for (let k = 0; k < this.goalN; k++) { const cx = sx + 4 + k * (sl + 4) + sl / 2 + 2, cy = sy + 4 + sl / 2, b = this.bag[k]; if (b) fishSprite(ctx, cx + 2, cy, sl * .42, b.c, 1, 0); else { ctx.fillStyle = 'rgba(120,90,80,.16)'; ctx.beginPath(); ctx.arc(cx, cy, sl * .3, 0, 7); ctx.fill(); } }
    // ---- шкала вываживания ----
    if (fightK) {
      const x0 = sx + this.goalN * (sl + 4) + 20, pw = Math.max(60, SW - x0 - 14), py = sy + 4;
      rr(ctx, x0, py, pw, sl, sl / 2); ctx.fillStyle = 'rgba(255,253,250,.88)'; ctx.fill();
      rr(ctx, x0 + 3, py + 3, (pw - 6) * clamp(this.prog), sl - 6, (sl - 6) / 2); ctx.fillStyle = this.prog > .7 ? '#7FD3A8' : this.prog > .35 ? '#FFD27A' : '#FF9A8A'; ctx.fill();
      txt(ctx, this.sp.n + ' · ' + Math.round(clamp(this.prog) * 100) + '%', x0 + pw / 2, py + sl / 2 + 1, 12, '#3B2F2A', 900);
    }
    if (this.show) { const s = this.show, k = clamp((1.8 - s.life) * 5), cx = SW / 2, cy = wy * .62 + 20; ctx.save(); ctx.globalAlpha = clamp(s.life * 3); ctx.translate(cx, cy); ctx.scale(.7 + .3 * k, .7 + .3 * k); gum(ctx, -96, -36, 192, 72, 22, '#FFFDFA', 5); fishSprite(ctx, -54, 0, 28, s.sp.c, 1, 0); txt(ctx, s.sp.n, 24, -10, 18, '#3B2F2A'); txt(ctx, s.kg + ' кг · +' + s.sp.pts, 24, 14, 12.5, '#9C8B7F', 800); ctx.restore(); }
    this.ban.draw(ctx, SW / 2, wy * .55 + 14);
    // ---- шкала силы К1 (колонка справа поверх сцены) ----
    const mw = this.mw(), mx = W - mw - 10, my = 12, mh = H - 24;
    ctx.save(); ctx.shadowColor = 'rgba(60,40,30,.18)'; ctx.shadowBlur = 12; rr(ctx, mx, my, mw, mh, mw / 2); ctx.fillStyle = 'rgba(255,250,244,.9)'; ctx.fill(); ctx.restore();
    const ix = mx + 7, iw = mw - 14, iy = my + 26, ih = mh - 52;
    rr(ctx, ix, iy, iw, ih, iw / 2); ctx.fillStyle = '#EDE2D6'; ctx.fill();
    txt(ctx, 'К1', mx + mw / 2, my + 13, 11, fightK ? '#F27D45' : '#9C8B7F', 900); txt(ctx, fightK ? 'К2' : this.ph === 'bite' ? 'жми' : 'покой', mx + mw / 2, my + mh - 13, 10, fightK ? '#3E9FD6' : '#9C8B7F', 900);
    if (fightK) { ctx.fillStyle = 'rgba(59,47,42,.18)'; ctx.fillRect(ix + 4, iy + ih / 2 - 1, iw - 8, 2); }
    if (fightK) {
      const zy = iy + ih * (1 - this.zone), zh = ih * this.zh, zt = clamp(zy - zh / 2, iy, iy + ih - zh);
      rr(ctx, ix + 2, zt, iw - 4, zh, (iw - 4) / 2); ctx.fillStyle = this.leak ? '#FFB07C' : this.inZ ? '#7FD3A8' : '#FFD27A'; ctx.fill();
      if (this.inZ) { ctx.strokeStyle = '#3DB37A'; ctx.lineWidth = 2; rr(ctx, ix + 2, zt, iw - 4, zh, (iw - 4) / 2); ctx.stroke(); }
      fishSprite(ctx, ix + iw / 2, iy + ih * (1 - this.fish), Math.min(13, iw * .5), this.sp.c, 1, t);
    } else {
      const lvl = clamp(Ctrl.a[0]), calm = this.ph === 'wait';
      rr(ctx, ix + 2, iy + ih * (1 - lvl), iw - 4, ih * lvl, (iw - 4) / 2); ctx.fillStyle = calm ? (lvl > .15 ? '#FFB07C' : '#BFE3CF') : '#F27D45'; ctx.fill();
      txt(ctx, calm ? '…' : '!', ix + iw / 2, iy + ih / 2, 22, calm ? '#B9A99B' : '#F27D45');
    }
  }
  result() { const acc = this.fightT ? this.inT / this.fightT : 0; return { score: this.score, acc: clamp(acc * (this.caught >= this.goalN ? 1 : .8)), win: this.caught >= this.goalN, extra: [['Улов', `${this.caught} / ${this.goalN}`], ['Тяжелейшая', this.bag.length ? Math.max(...this.bag.map(b => b.kg)) + ' кг' : '—'], ['Сорвалось', this.lost], ['Испугано (не расслабился)', this.scared], ['В зоне', Math.round(this.inT) + ' с']] }; }
}
function fishSprite(ctx, x, y, s, col, dir = 1, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(Math.sin(t * 8) * .08);
  ctx.fillStyle = shade(col, -.15); ctx.beginPath(); ctx.moveTo(-s * .55, 0); ctx.lineTo(-s * 1.05, -s * .42); ctx.quadraticCurveTo(-s * .9, 0, -s * 1.05, s * .42); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(0, -s * .5, 0, s * .5); g.addColorStop(0, shade(col, .3)); g.addColorStop(1, col);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, s * .7, s * .45, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-s * .05, -s * .22, s * .38, s * .1, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * .38, -s * .08, s * .13, 0, 7); ctx.fill(); ctx.fillStyle = '#3B2F2A'; ctx.beginPath(); ctx.arc(s * .41, -s * .08, s * .07, 0, 7); ctx.fill();
  ctx.restore();
}

/* =================== 4б. ГОРЯЧАЯ КРУЖКА (бытовой перенос: дозирование хвата и покой) ===================
   Модель как у реального протеза: К1 закрывает кисть (скорость ∝ силе), покой держит хват, К2 раскрывает.
   Цикл одной кружки: подвести раскрытую кисть → сжать до зелёной зоны и расслабиться → донести без
   встречных сокращений (на 2–3 уровне кружку доливают — хват нужно чуть усилить) → поставить, раскрыв кисть. */
const CUPS = [
  { n: 'Кружка чая', k: 'mug', c: '#F28C6A', mid: .55, wk: 1, lv: 1, brk: 'Кружка треснула' },
  { n: 'Стакан воды', k: 'glass', c: '#8ECFE8', mid: .5, wk: .9, lv: 1, brk: 'Стакан лопнул' },
  { n: 'Банка варенья', k: 'jar', c: '#C9475B', mid: .74, wk: .9, lv: 1, brk: 'Банка треснула', heavy: true },
  { n: 'Бумажный стакан', k: 'paper', c: '#E9C38E', mid: .36, wk: .85, lv: 2, brk: 'Стакан смялся' },
  { n: 'Яйцо', k: 'egg', c: '#F6E6CF', mid: .22, wk: .7, lv: 3, brk: 'Яйцо раздавлено', noRefill: true }
];
const MUG_POSE = (f) => [lerp(0, 58, f), lerp(0, 72, f), lerp(0, 74, f), lerp(0, 76, f), lerp(0, 80, f), lerp(15, 62, f)];
class MugGame {
  constructor(lv) {
    this.diff = lv; this.T = 0; this.dur = LV(lv, [100, 110, 120]); this.done = false; this.fx = new FX(); this.ban = new Banner();
    this.goalN = LV(lv, [4, 5, 6]); this.ok = 0; this.tries = 0; this.fails = { crack: 0, drop: 0, spill: 0, knock: 0, slow: 0 };
    this.inT = 0; this.carryT = 0; this.sc = 0; this.endT = 0; this.f = .6; this.wave = 0; this.leak = false;
    this.speed = LV(lv, [.55, .7, .85]); this.width = LV(lv, [.26, .2, .16]);
    this.newCup();
  }
  newCup() {
    const pool = CUPS.filter(c => c.lv <= this.diff + .01), cup = pick(pool);
    const w = this.width * cup.wk, mid = clamp(cup.mid + rnd(-.06, .06), w / 2 + .12, .9 - w / 2);
    Object.assign(this, { cup, lo: mid - w / 2, hi: mid + w / 2, ph: 'reach', pt: 0, slipT: 0, crushT: 0, restT: 0, spill: 0, refill: false, crack: 0, fallen: 0, cx: 0, carried: false, lastFail: null });
    this.f = Math.max(this.f, .55); // кисть приходит полузакрытой: сначала её нужно раскрыть
    this.tries++;
  }
  resize(W, H) { this.W = W; this.H = H; }
  progress() { return clamp(this.ok / this.goalN); }
  hud() { return fmtTime(this.dur - this.T); }
  chips() { return [['Донесено', `${this.ok}/${this.goalN}`], ['Хват', Math.round(this.f * 100) + '%', this.f >= this.lo && this.f <= this.hi ? '#3DB37A' : null], ['Пролито', Math.round(this.spill * 100) + '%', this.spill > .5 ? '#EE5D5D' : null]]; }
  hint() {
    if (this.endT) return ['Все кружки на месте!', 'ok'];
    if (this.ph === 'reach') return this.f > .2 ? ['Раскрой кисть (К2), пока рука подходит', 'act'] : ['Кисть раскрыта — жди кружку', 'ok'];
    if (this.ph === 'grip') return this.f < this.lo ? ['Сожми (К1) до зелёной зоны', 'act'] : this.f > this.hi ? ['Слишком сильно! Чуть раскрой (К2)', 'warn'] : ['Теперь расслабь руку — протез держит хват', 'ok'];
    if (this.ph === 'carry') { if (this.leak) return ['Одна мышца за раз — от встречного сигнала чай плещется', 'warn']; if (this.f < this.lo) return ['Выскальзывает — дожми К1', 'warn']; if (this.f > this.hi) return ['Давишь слишком сильно — ослабь К2', 'warn']; return this.refill && this.refillT < 1.5 ? ['Долили — кружка тяжелее, дожми чуть-чуть', 'act'] : ['Неси спокойно, рука расслаблена', 'ok']; }
    if (this.ph === 'release') return ['Поставь: раскрой кисть (К2)', 'act'];
    return '';
  }
  onState(e) {
    if (this.endT) return;
    if (this.ph === 'reach' && e.state === 'CH1') this.ban.show('Сначала раскрой (К2)', '#fff', '#F2A33A', .8, 22);
    if (this.ph === 'release' && e.state === 'CH1') this.ban.show('Раскрой, а не сжимай', '#fff', '#F2A33A', .8, 22);
  }
  fail(kind, msg) {
    this.fails[kind]++; this.lastFail = kind; this.ph = 'fail'; this.pt = 0; Snd.bad(); this.ban.show(msg, '#fff', '#EE5D5D', 1.2, 26);
    const x = this.cupX(), y = this.cupY();
    if (kind === 'spill' || kind === 'knock') this.fx.burst(x, y - 10, ['#C98A5A', '#E3B58C', '#fff'], 22, 220);
    if (kind === 'crack') { this.crack = 1; this.fx.burst(x, y, ['#fff', this.cup.c], 18, 260); }
    if (kind === 'drop') this.fallen = .01;
  }
  win() {
    this.ok++; this.ph = 'placed'; this.pt = 0; Mission.ev('mug:deliver');
    const inK = this.cupCarry ? this.cupIn / this.cupCarry : 0, pts = Math.round((300 + inK * 200 + (1 - this.spill) * 120) * (1 + (this.diff - 1) * .25));
    this.sc += pts; Snd.win(); this.fx.burst(this.cupX(), this.cupY() - 30, ['#FFD27A', '#fff', '#7FD3A8'], 26, 260, true); this.fx.pop(this.cupX(), this.cupY() - 60, '+' + pts, '#fff', 24);
    if (this.ok >= this.goalN) { this.endT = 2; this.ban.show('Все кружки на месте!', '#fff', '#3DB37A', 2, 30); }
  }
  update(dt, c) {
    this.T += dt; this.wave += dt; this.fx.update(dt); this.ban.update(dt);
    if (this.endT) { this.endT -= dt; if (this.endT <= 0) this.done = true; return; }
    if (this.T >= this.dur) { this.done = true; return; }
    this.pt += dt;
    // кисть протеза: К1 закрывает, К2 раскрывает, покой держит; при «обе мышцы» кисть стоит, но чай плещется
    const a0 = clamp(c.a[0]), a1 = clamp(c.a[1]), f0 = this.f;
    if (c.state === 'CH1') this.f += this.speed * dt * (.3 + a0);
    else if (c.state === 'CH2') this.f -= this.speed * 1.3 * dt * (.3 + a1);
    this.f = clamp(this.f); this.df = (this.f - f0) / Math.max(dt, 1e-3);
    this.leak = a0 > C().thr1 * .5 && a1 > C().thr2 * .5;
    const inWin = this.f >= this.lo && this.f <= this.hi;
    if (this.ph === 'reach') {
      const T = LV(this.diff, [2.8, 2.3, 1.9]); this.cx = clamp(this.pt / T);
      if (this.pt >= T) { if (this.f <= .22) { this.ph = 'grip'; this.pt = 0; Snd.tick(); } else this.fail('knock', 'Кисть не раскрыта — кружка опрокинута'); }
    } else if (this.ph === 'grip') {
      if (this.f > this.hi + .1) return this.fail('crack', this.cup.brk);
      this.restT = inWin && c.state === 'REST' ? this.restT + dt : 0;
      if (this.restT >= .35) { this.ph = 'carry'; this.carried = true; this.pt = 0; this.cupIn = 0; this.cupCarry = 0; Snd.ok(); }
      else if (this.pt > 7) this.fail('slow', 'Кружку так и не взяли');
    } else if (this.ph === 'carry') {
      const T = LV(this.diff, [3, 3.6, 4.2]); this.cx = clamp(this.pt / T);
      this.carryT += dt; this.cupCarry += dt; if (inWin) { this.inT += dt; this.cupIn += dt; }
      if (this.diff >= 2 && !this.cup.noRefill && !this.refill && this.cx > .4) { this.refill = true; this.refillT = 0; this.lo += .1; this.hi = Math.min(.97, this.hi + .1); this.ban.show('Долили!', '#fff', '#3E9FD6', .9, 26); Snd.splash(); }
      if (this.refill) this.refillT += dt;
      if (this.leak) this.spill += dt * 1.1;
      if (Math.abs(this.df) > .5) this.spill += dt * .35; // резкие рывки хвата тоже расплёскивают
      const grace = this.refill && this.refillT < 1.6 ? 1.6 : 0; // после доливки есть время дожать
      this.slipT = this.f < this.lo ? this.slipT + dt : 0; this.crushT = this.f > this.hi ? this.crushT + dt : 0;
      if (this.f > this.hi + .1 || this.crushT > .5) return this.fail('crack', this.cup.brk);
      if (this.slipT > .45 + grace) return this.fail('drop', 'Выскользнула!');
      if (this.spill >= 1) return this.fail('spill', 'Пролил…');
      if (this.pt >= T) { this.ph = 'release'; this.pt = 0; }
    } else if (this.ph === 'release') {
      if (this.f > this.hi + .1) return this.fail('crack', this.cup.brk);
      if (this.f <= .12) this.win();
      else if (this.pt > LV(this.diff, [3.5, 3, 2.6])) this.fail('slow', 'Не успел поставить');
    } else if (this.ph === 'placed' || this.ph === 'fail') {
      if (this.fallen) this.fallen = Math.min(1, this.fallen + dt * 2.4);
      if (this.pt > 1.1) this.newCup();
    }
  }
  get score() { return Math.round(this.sc + this.inT * 8); }
  // раскладка: стол внизу, слева — откуда берём, справа — подставка; колонка шкалы хвата справа
  u() { return clamp(Math.min(this.W / 380, this.H / 560), .75, 1.4); }
  mw() { return Math.round(clamp(this.W * .12, 44, 58)); }
  sw() { return this.W - this.mw() - 20; }
  tableY() { return this.H * .74; }
  cupX() { const SW = this.sw(), x0 = SW * .24, x1 = SW * .76; return this.ph === 'carry' ? lerp(x0, x1, easeOut(this.cx)) : this.ph === 'release' || this.ph === 'placed' ? x1 : (this.ph === 'fail' && this.cx > 0 && this.carried) ? lerp(x0, x1, this.cx) : x0; }
  cupY() { const ty = this.tableY(), lift = this.ph === 'carry' ? Math.sin(Math.PI * this.cx) * 70 * this.u() : 0; return ty - lift + (this.fallen ? this.fallen * 40 : 0); }
  draw(ctx) {
    const W = this.W, H = this.H, SW = this.sw(), u = this.u(), ty = this.tableY(), t = this.wave;
    // ---- кухня: тёплая стена, окно, полка ----
    skyG(ctx, W, H, ['#FFE7D2', '#FFF3E6', '#FFE3CC']);
    const wx = SW * .5 - 70 * u, wy = H * .1, ww = 140 * u, wh = 110 * u;
    gum(ctx, wx - 8, wy - 8, ww + 16, wh + 16, 18, '#FFFDFA', 4);
    const sg = ctx.createLinearGradient(0, wy, 0, wy + wh); sg.addColorStop(0, NIGHT() ? '#1F2A4A' : '#BFE6F5'); sg.addColorStop(1, NIGHT() ? '#3A3560' : '#FFF1D6'); rr(ctx, wx, wy, ww, wh, 12); ctx.fillStyle = sg; ctx.fill();
    ctx.save(); rr(ctx, wx, wy, ww, wh, 12); ctx.clip(); sun(ctx, wx + ww * .72, wy + wh * .36, 14 * u); cloud(ctx, wx + ww * .12 + Math.sin(t * .2) * 8, wy + wh * .55, .5 * u, .9); ctx.restore();
    ctx.fillStyle = '#FFFDFA'; ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh); ctx.fillRect(wx, wy + wh / 2 - 3, ww, 6);
    gum(ctx, SW * .06, H * .42, SW * .3, 10 * u, 5, '#E7B98F', 4); // полка
    [[.1, '#9ED8B5'], [.19, '#F7B7A3'], [.28, '#C8B6F2']].forEach(([x, col]) => gum(ctx, SW * x, H * .42 - 26 * u, 18 * u, 26 * u, 6, col, 2));
    // ---- стол и подставки ----
    gum(ctx, -20, ty + 10 * u, W + 40, H - ty, 18, nt('#E9B98C', .4), 6);
    ctx.fillStyle = 'rgba(160,100,60,.12)'; for (let k = 0; k < 6; k++) ctx.fillRect(0, ty + 26 * u + k * 14 * u, W, 2);
    const x0 = SW * .24, x1 = SW * .76;
    shadowE(ctx, x0, ty + 12 * u, 38 * u, 7 * u, .12);
    ctx.fillStyle = '#7FD3A8'; ctx.beginPath(); ctx.ellipse(x1, ty + 12 * u, 40 * u, 9 * u, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#BFEBD3'; ctx.beginPath(); ctx.ellipse(x1, ty + 10 * u, 33 * u, 6 * u, 0, 0, 7); ctx.fill();
    txt(ctx, 'сюда', x1, ty + 34 * u, 11 * u, '#3DB37A', 900);
    // ---- кружка ----
    const cx = this.cupX(), cy = this.cupY(), s = 34 * u, squeeze = this.ph === 'carry' || this.ph === 'grip' ? clamp((this.f - this.hi) * 2.4, 0, .18) : 0;
    const tilt = this.ph === 'carry' ? clamp(this.df * .25, -.25, .25) + (this.leak ? Math.sin(t * 30) * .05 : 0) : this.ph === 'fail' && this.lastFail === 'knock' ? .9 : 0;
    if (!(this.ph === 'fail' && this.fallen >= 1)) {
      shadowE(ctx, cx, ty + 12 * u, s * .9, 6 * u, .18);
      cupSprite(ctx, cx, cy, s, this.cup, clamp(1 - this.spill * .7), tilt, squeeze, this.crack, t);
    } else { ctx.fillStyle = 'rgba(201,138,90,.45)'; ctx.beginPath(); ctx.ellipse(cx, ty + 14 * u, s * 1.4, 7 * u, 0, 0, 7); ctx.fill(); }
    // ---- кисть протеза ----
    const holding = this.ph === 'grip' || this.ph === 'carry' || this.ph === 'release';
    const hx = this.ph === 'reach' ? lerp(-60 * u, cx - s * .95, easeOut(this.cx)) : this.ph === 'placed' || this.ph === 'fail' ? cx - s * .95 - this.pt * 160 * u : cx - s * .95;
    const hy = (holding || this.ph === 'reach' ? cy : ty) - s * .75;
    const key = 'mug' + Math.round(this.f * 12), im = handImg(key, MUG_POSE(Math.round(this.f * 12) / 12));
    if (imgOk(im)) { const hh = s * 3.1, hw = hh * 184 / 272; ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.PI / 2 - .15); ctx.shadowColor = 'rgba(40,52,72,.3)'; ctx.shadowBlur = 10 * u; ctx.shadowOffsetX = 3 * u; ctx.drawImage(im, -hw / 2, -hh * .62, hw, hh); ctx.restore(); }
    this.fx.draw(ctx);
    this.ban.draw(ctx, SW / 2, H * .34);
    // ---- слоты донесённых кружек ----
    const sl = 24 * u, sx = 12, sy = 12;
    gum(ctx, sx, sy, this.goalN * (sl + 4) + 8, sl + 8, 12, '#FFFDFA', 3);
    for (let k = 0; k < this.goalN; k++) { const kx = sx + 4 + k * (sl + 4) + sl / 2 + 2, ky = sy + 4 + sl / 2; if (k < this.ok) cupSprite(ctx, kx, ky + sl * .32, sl * .42, CUPS[0], 1, 0, 0, 0, t); else { ctx.fillStyle = 'rgba(120,90,80,.16)'; ctx.beginPath(); ctx.arc(kx, ky, sl * .3, 0, 7); ctx.fill(); } }
    // ---- шкала пролитого ----
    if (this.ph === 'carry' || this.spill > 0) {
      const px = sx + this.goalN * (sl + 4) + 20, pw = Math.max(60, SW - px - 14);
      rr(ctx, px, sy + 4, pw, sl, sl / 2); ctx.fillStyle = 'rgba(255,253,250,.88)'; ctx.fill();
      rr(ctx, px + 3, sy + 7, (pw - 6) * clamp(1 - this.spill), sl - 6, (sl - 6) / 2); ctx.fillStyle = this.spill < .35 ? '#7FD3A8' : this.spill < .7 ? '#FFD27A' : '#FF9A8A'; ctx.fill();
      txt(ctx, this.cup.n + ' · ' + Math.round(clamp(1 - this.spill) * 100) + '%', px + pw / 2, sy + 4 + sl / 2 + 1, 12, '#3B2F2A', 900);
    }
    // ---- шкала хвата (колонка справа): зелёная зона, зона поломки, текущая сила ----
    const mw = this.mw(), mx = W - mw - 10, my = 12, mh = H - 24;
    ctx.save(); ctx.shadowColor = 'rgba(60,40,30,.18)'; ctx.shadowBlur = 12; rr(ctx, mx, my, mw, mh, mw / 2); ctx.fillStyle = 'rgba(255,250,244,.92)'; ctx.fill(); ctx.restore();
    const ix = mx + 7, iw = mw - 14, iy = my + 26, ih = mh - 52, Y = v => iy + ih * (1 - v);
    rr(ctx, ix, iy, iw, ih, iw / 2); ctx.fillStyle = '#EDE2D6'; ctx.fill();
    const brk = Math.min(1, this.hi + .1);
    ctx.fillStyle = 'rgba(238,93,93,.28)'; ctx.fillRect(ix + 2, Y(1), iw - 4, Y(brk) - Y(1));
    rr(ctx, ix + 2, Y(this.hi), iw - 4, Y(this.lo) - Y(this.hi), 6); ctx.fillStyle = 'rgba(127,211,168,.75)'; ctx.fill();
    const fc = this.f > this.hi ? '#EE5D5D' : this.f >= this.lo ? '#3DB37A' : '#F27D45';
    ctx.fillStyle = fc; rr(ctx, ix - 3, Y(this.f) - 4, iw + 6, 8, 4); ctx.fill();
    txt(ctx, 'хват', mx + mw / 2, my + 13, 10, '#9C8B7F', 900); txt(ctx, this.ph === 'reach' || this.ph === 'release' ? 'К2' : 'К1', mx + mw / 2, my + mh - 13, 11, this.ph === 'reach' || this.ph === 'release' ? '#3E9FD6' : '#F27D45', 900);
  }
  result() {
    const fin = this.tries - (this.ph === 'reach' || this.ph === 'grip' ? 1 : 0) || 1;
    const acc = clamp((this.ok / Math.max(1, fin)) * .6 + (this.carryT ? this.inT / this.carryT : 0) * .4);
    const f = this.fails;
    return { score: this.score, acc: clamp(acc * (this.ok >= this.goalN ? 1 : .85)), win: this.ok >= this.goalN, extra: [['Донесено', `${this.ok} / ${this.goalN}`], ['В зелёной зоне', this.carryT ? Math.round(this.inT / this.carryT * 100) + '%' : '—'], ['Слишком сильно (треснула)', f.crack], ['Слишком слабо (выскользнула)', f.drop], ['Пролито (встречный сигнал)', f.spill], ['Не раскрыл / не успел', f.knock + f.slow]] };
  }
}
function cupSprite(ctx, x, y, s, cup, fill, tilt = 0, squeeze = 0, crack = 0, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(1 - squeeze, 1 + squeeze * .4);
  if (cup.k === 'egg') {
    const h = s * .95, w = s * .7, g = ctx.createRadialGradient(-w * .25, -h * .7, s * .05, 0, -h * .5, h * .7); g.addColorStop(0, '#FFFDF7'); g.addColorStop(1, cup.c);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -h * .48, w * .5, h * .5, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(160,120,80,.35)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-w * .16, -h * .7, w * .1, h * .14, -.4, 0, 7); ctx.fill();
    if (crack) { ctx.strokeStyle = '#8C6A4A'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-w * .5, -h * .5); for (let k = 0; k < 6; k++) ctx.lineTo(-w * .5 + k * w * .2, -h * (.5 + (k % 2 ? .08 : -.06))); ctx.stroke(); ctx.fillStyle = '#FFC93C'; ctx.beginPath(); ctx.ellipse(0, -2, w * .4, h * .1, 0, 0, 7); ctx.fill(); }
    ctx.restore(); return;
  }
  if (cup.k === 'jar') {
    const w = s * 1.05, h = s * 1.2;
    ctx.fillStyle = 'rgba(200,225,235,.5)'; rr(ctx, -w / 2, -h, w, h, w * .18); ctx.fill();
    ctx.save(); rr(ctx, -w / 2 + 3, -h * (.08 + .74 * fill), w - 6, h * (.08 + .74 * fill) - 3, w * .15); ctx.fillStyle = cup.c; ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; rr(ctx, -w * .34, -h * .86, w * .1, h * .6, 4); ctx.fill();
    gum(ctx, -w * .46, -h - s * .2, w * .92, s * .24, 5, '#F2B33A', 2);
    ctx.fillStyle = '#FFFDFA'; rr(ctx, -w * .3, -h * .55, w * .6, h * .24, 4); ctx.fill();
    if (crack) { ctx.strokeStyle = '#3B2F2A'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(w * .1, -h); ctx.lineTo(-w * .05, -h * .6); ctx.lineTo(w * .12, -h * .3); ctx.stroke(); }
    ctx.restore(); return;
  }
  const w = s * (cup.k === 'paper' ? .9 : 1), h = s * 1.15, top = -h, bw = cup.k === 'mug' ? w : w * .8;
  // ручка
  if (cup.k === 'mug') { ctx.strokeStyle = shade(cup.c, -.12); ctx.lineWidth = s * .14; ctx.beginPath(); ctx.ellipse(w * .55, -h * .52, s * .26, s * .3, 0, -1.4, 1.4); ctx.stroke(); }
  const body = () => { ctx.beginPath(); ctx.moveTo(-w / 2, top); ctx.lineTo(w / 2, top); ctx.lineTo(bw / 2, -4); ctx.quadraticCurveTo(bw / 2, 0, bw / 2 - 4, 0); ctx.lineTo(-bw / 2 + 4, 0); ctx.quadraticCurveTo(-bw / 2, 0, -bw / 2, -4); ctx.closePath(); };
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  if (cup.k === 'glass') { g.addColorStop(0, 'rgba(190,230,245,.55)'); g.addColorStop(.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(150,205,230,.55)'); }
  else { g.addColorStop(0, shade(cup.c, .25)); g.addColorStop(.6, cup.c); g.addColorStop(1, shade(cup.c, -.15)); }
  // жидкость
  const lv = top + h * (1 - .82 * fill), liq = cup.k === 'glass' ? 'rgba(110,185,225,.75)' : '#B97A4E';
  if (fill > .02) { ctx.save(); body(); ctx.clip(); ctx.fillStyle = liq; ctx.fillRect(-w, lv + Math.sin(t * 6) * 1.5, w * 2, h); ctx.restore(); }
  body(); ctx.fillStyle = g; ctx.fill();
  if (cup.k === 'paper') { ctx.fillStyle = '#FFFDFA'; ctx.fillRect(-w * .42, top + h * .38, w * .84, h * .22); }
  ctx.fillStyle = 'rgba(255,255,255,.55)'; rr(ctx, -w * .34, top + h * .14, w * .12, h * .6, 4); ctx.fill();
  ctx.fillStyle = shade(cup.c, -.25); ctx.beginPath(); ctx.ellipse(0, top, w / 2, s * .09, 0, 0, 7); ctx.fill();
  if (cup.k !== 'glass' && fill > .02) { ctx.fillStyle = '#9B6038'; ctx.beginPath(); ctx.ellipse(0, top + 1, w / 2 - 3, s * .06, 0, 0, 7); ctx.fill(); }
  // пар над горячим
  if (cup.k === 'mug' && fill > .2 && !crack) { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; for (let k = -1; k <= 1; k++) { const o = (t * .8 + k * .33) % 1; ctx.globalAlpha = 1 - o; ctx.beginPath(); ctx.moveTo(k * s * .2, top - 4 - o * s * .6); ctx.quadraticCurveTo(k * s * .2 + Math.sin(t * 3 + k) * 5, top - 10 - o * s * .9, k * s * .2, top - 16 - o * s * 1.1); ctx.stroke(); } ctx.globalAlpha = 1; }
  if (crack) { ctx.strokeStyle = '#3B2F2A'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-w * .1, top); ctx.lineTo(w * .05, top + h * .3); ctx.lineTo(-w * .08, top + h * .5); ctx.lineTo(w * .1, top + h * .8); ctx.stroke(); }
  ctx.restore();
}

/* =================== 4в. БЕЗ ЭКРАНА (голос и звук вместо картинки) ===================
   Команды звучат голосом и тоном: К1 — низкий, К2 — высокий, покой — мягкий. Экран почти тёмный,
   чтобы человек смотрел на руку, как в жизни. Команды идут цепочкой без обязательного покоя —
   тренируется прямое переключение каналов. Уровень 1 — команда видна текстом, 2 — только точка-индикатор,
   3 — экран пустой. */
class BlindGame {
  constructor(lv) {
    this.diff = lv; this.T = 0; this.done = false; this.fx = new FX(); this.ban = new Banner(); this.endT = 0;
    this.N = LV(lv, [10, 14, 18]); this.hold = LV(lv, [.6, .9, 1.2]); this.lim = LV(lv, [2.2, 1.8, 1.5]);
    this.show = lv < 2 ? 'text' : lv < 3 ? 'dot' : 'none';
    const set = ['CH1', 'CH2', 'REST'].concat(Ctrl.bothOK() && lv >= 2 ? ['BOTH'] : []); this.cmds = [];
    let prev = 'REST'; for (let i = 0; i < this.N; i++) { const opts = set.filter(x => x !== prev && !(x === 'REST' && i === 0)); prev = pick(opts); this.cmds.push(prev); }
    this.i = 0; this.ph = 'gap'; this.pt = 0; this.gap = 1.4; this.ok = 0; this.miss = 0; this.wrong = 0; this.rts = []; this.holdT = 0; this.sc = 0; this.flash = null;
  }
  resize(W, H) { this.W = W; this.H = H; }
  progress() { return clamp(this.i / this.N); }
  hud() { return `${Math.min(this.i + 1, this.N)} / ${this.N}`; }
  chips() { return [['Команда', `${Math.min(this.i + 1, this.N)} из ${this.N}`], ['Верно', this.ok, '#3DB37A'], ['Не тем каналом', this.wrong, this.wrong ? '#F2A33A' : null]]; }
  word(c) { const sp = C().mode === 'spppr'; return { CH1: sp ? 'Согни' : 'Сожми', CH2: sp ? 'Разогни' : 'Раскрой', REST: 'Расслабь', BOTH: sp ? 'Пронация' : 'Обе мышцы' }[c]; }
  hint() { if (this.endT) return ['Готово!', 'ok']; if (this.ph !== 'cue') return 'Слушай команду'; return this.show === 'text' ? [this.word(this.cue), 'act'] : 'Слушай и смотри на руку'; }
  cueSound(c) {
    if (c === 'CH1') Snd.tone(330, .22, 'sine', .07); else if (c === 'CH2') Snd.tone(880, .22, 'sine', .06);
    else if (c === 'BOTH') { Snd.tone(330, .2, 'sine', .05); Snd.tone(880, .2, 'sine', .05); } else Snd.tone(520, .3, 'triangle', .04);
    Native.say(this.word(c), { force: true, rate: 1.1 });
  }
  onState(e) { if (this.ph === 'cue' && e.state !== this.cue && e.state !== 'REST' && e.state !== this.prevCue && !this.wrongNow) { this.wrong++; this.wrongNow = true; } }
  update(dt, c) {
    this.T += dt; this.fx.update(dt); this.ban.update(dt); if (this.flash) this.flash.life -= dt;
    if (this.endT) { this.endT -= dt; if (this.endT <= 0) this.done = true; return; }
    this.pt += dt;
    if (this.ph === 'gap') { if (this.pt >= this.gap) { this.prevCue = this.cue; this.cue = this.cmds[this.i]; this.ph = 'cue'; this.pt = 0; this.holdT = 0; this.rt = null; this.wrongNow = false; this.cueSound(this.cue); } return; }
    if (c.state === this.cue) { if (this.rt == null) this.rt = this.pt; this.holdT += dt; } else this.holdT = Math.max(0, this.holdT - dt * 2);
    if (this.holdT >= this.hold) {
      this.ok++; this.rts.push(this.rt); Mission.ev('blind:ok'); this.sc += Math.round(100 + Math.max(0, this.lim - this.rt) * 120 * this.diff); Snd.ok(); this.flash = { ok: true, life: .5 };
      this.next(); return;
    }
    if (this.pt > this.lim + this.hold + .4) { this.miss++; Snd.bad(); this.flash = { ok: false, life: .6 }; this.next(); }
  }
  next() { this.i++; this.ph = 'gap'; this.pt = 0; this.gap = .55 + Math.random() * .4; if (this.i >= this.N) { this.endT = 1.4; Snd.win(); } }
  get score() { return this.sc; }
  draw(ctx) {
    const W = this.W, H = this.H, cx = W / 2, cy = H * .45, t = this.T;
    ctx.fillStyle = '#0E0F16'; ctx.fillRect(0, 0, W, H);
    txt(ctx, `${Math.min(this.i + 1, this.N)} / ${this.N}`, cx, 26, 13, 'rgba(255,255,255,.28)', 800);
    if (this.flash && this.flash.life > 0) glow(ctx, cx, cy, Math.max(W, H) * .6, this.flash.ok ? '#3DB37A' : '#EE5D5D', .25 * this.flash.life);
    if (this.ph === 'cue') {
      const col = ST[this.cue].hex, k = clamp(this.holdT / this.hold);
      if (this.show === 'text') { txt(ctx, this.word(this.cue).toUpperCase(), cx, cy, Math.min(42, W * .1), rgba(col, .85)); chMark(ctx, { CH1: 0, CH2: 1, BOTH: 2 }[this.cue] ?? -1, cx, cy + 46, 9, rgba(col, .85)); }
      if (this.show !== 'none') { ctx.strokeStyle = rgba(col, .5); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy + (this.show === 'text' ? 110 : 0), 26, -Math.PI / 2, -Math.PI / 2 + 6.283 * k); ctx.stroke(); }
    } else if (this.show !== 'none' || this.i === 0) txt(ctx, this.i === 0 ? 'Положи телефон и смотри на руку' : '…', cx, cy, 15, 'rgba(255,255,255,.35)', 800);
    if (this.endT) txtO(ctx, 'Готово!', cx, cy, 34, '#fff', '#3DB37A', 7);
    this.fx.draw(ctx);
  }
  result() {
    const acc = this.ok / this.N, rt = this.rts.length ? this.rts.reduce((a, b) => a + b, 0) / this.rts.length : null;
    return { score: this.score, acc: clamp(acc - this.wrong * .02), win: acc >= .6, react: rt != null ? rt * 1000 : undefined, extra: [['Верно', `${this.ok} / ${this.N}`], ['Средняя реакция', rt != null ? Math.round(rt * 1000) + ' мс' : '—'], ['Не тем каналом', this.wrong], ['Пропущено', this.miss], ['Экран', this.show === 'text' ? 'с подсказкой' : this.show === 'dot' ? 'только индикатор' : 'выключен']] };
  }
}

/* =================== 5. РЕАКЦИЯ (go/no-go, скорость, изоляция) =================== */
class ReactGame {
  constructor(lv) {
    this.diff = lv; this.done = false; this.fx = new FX(); this.N = LV(lv, [12, 16, 20]); this.lim = LV(lv, [1.8, 1.5, 1.25]);
    this.i = 0; this.ph = 'wait'; this.t = 0; this.wait = 1.6; this.cue = null; this.rts = []; this.ok = 0; this.false_ = 0; this.fb = null; this.sc = 0; this.T = 0; this.marks = [];
  }
  resize(W, H) { this.W = W; this.H = H; }
  progress() { return clamp(this.i / this.N); }
  hud() { return `${Math.min(this.i + 1, this.N)} / ${this.N}`; }
  chips() { return [['Верно', `${this.ok}/${this.N}`, '#3DB37A'], ['Среднее', this.rts.length ? Math.round(this.avg()) + ' мс' : '—'], ['Фальстарты', this.false_]]; }
  hint() { return this.ph === 'wait' ? 'Мышцы расслаблены — жди сигнал' : this.ph === 'fb' && Ctrl.state !== 'REST' ? ['Расслабь руку — следующий сигнал после покоя', 'warn'] : ''; }
  cueSet() {
    const k = ['CH1', 'CH2', 'NOGO'], six = C().mode === 'spppr' && C().spGest === 6;
    if (six) { k.push('G:supination'); if (this.diff >= 2) k.push('G:adduction', 'G:abduction'); }
    if (Ctrl.bothOK() && (this.diff >= 3 || six)) k.push('BOTH');
    return k;
  }
  newCue() {
    const opts = ['CH1', 'CH2', 'CH1', 'CH2', 'NOGO']; if (this.diff >= 2) opts.push('NOGO', 'CH1', 'CH2');
    this.cueSet().slice(3).forEach(k => opts.push(k, k));
    let c; do c = pick(opts); while (c === this.cue && Math.random() < .5);
    this.cue = c; this.ph = 'cue'; this.t = 0; Snd.go();
  }
  onState(e) {
    if (this.done) return;
    if (this.ph === 'wait' && e.state !== 'REST') { this.false_++; this.mark('f'); this.fb = { s: 'Фальстарт', sub: 'дождись сигнала', ok: false }; this.ph = 'fb'; this.t = 0; Snd.bad(); this.i++; return; }
    if (this.ph !== 'cue' || e.state === 'REST') return;
    if (this.cue === 'NOGO') { this.finish(false, 'Нужно было замереть'); return; }
    if (this.cue.startsWith('G:')) { this.finish(false, 'Не тот жест'); return; }
    if (e.state === this.cue) { const rt = this.t * 1000; this.rts.push(rt); if (this.rts.length >= 5 && this.avg() < 450) Mission.ev('react:fast'); this.finish(true, Math.round(rt) + ' мс', rt); }
    else if (!(this.cue === 'BOTH' && (e.state === 'CH1' || e.state === 'CH2'))) this.finish(false, 'Не та мышца');
  }
  /* жесты СПППР вне К1/К2: супинация, приведение, отведение (устойчивый жест — Ctrl.g, единичные ошибки классификатора отфильтрованы) */
  onGesture(g) {
    if (this.done || !['supination', 'adduction', 'abduction'].includes(g)) return;
    if (this.ph === 'wait') { this.false_++; this.mark('f'); this.fb = { s: 'Фальстарт', sub: 'дождись сигнала', ok: false }; this.ph = 'fb'; this.t = 0; Snd.bad(); this.i++; return; }
    if (this.ph !== 'cue') return;
    if (this.cue === 'G:' + g) { const rt = this.t * 1000; this.rts.push(rt); this.finish(true, Math.round(rt) + ' мс', rt); }
    else this.finish(false, this.cue === 'NOGO' ? 'Нужно было замереть' : 'Не тот жест');
  }
  mark(k) { this.marks.push(k); }
  avg() { return this.rts.length ? this.rts.reduce((a, b) => a + b, 0) / this.rts.length : 0; }
  finish(ok, s, rt) {
    this.i++; this.ph = 'fb'; this.t = 0; this.mark(ok ? 'o' : 'x');
    if (ok) { this.ok++; this.sc += rt ? Math.max(100, Math.round(1300 - rt)) : 500; Snd.ok(); this.fx.burst(this.W / 2, this.H * .42, ['#7FD3A8', '#FFD27A', '#fff'], 26, 300, true); }
    else Snd.bad();
    this.fb = { s, sub: ok ? (rt ? (rt < 400 ? 'молниеносно!' : rt < 600 ? 'быстро' : 'хорошо') : 'выдержка!') : '', ok, rt: ok && rt ? rt : null };
  }
  update(dt, c) {
    this.T += dt; this.t += dt; this.fx.update(dt);
    if (c.g !== this.lastG) { this.lastG = c.g; this.onGesture(c.g); }
    if (this.ph === 'wait' && this.t > this.wait) this.newCue();
    else if (this.ph === 'cue') {
      if (this.cue === 'NOGO' && this.t > 1.3) this.finish(true, 'Выдержка!');
      else if (this.cue !== 'NOGO' && this.t > this.lim) this.finish(false, 'Слишком долго');
    } else if (this.ph === 'fb' && this.t > .9) {
      if (this.i >= this.N) { this.done = true; return; }
      if (c.state === 'REST') { this.ph = 'wait'; this.t = 0; this.wait = rnd(1.1, 2.6); }
    }
  }
  get score() { return this.sc; }
  draw(ctx) {
    const W = this.W, H = this.H, now = performance.now() / 1000;
    const M = { CH1: ['#F27D45', 'fist', 'СОЖМИ', 'К1 · сгибатели'], CH2: ['#3E9FD6', 'open', 'РАСКРОЙ', 'К2 · разгибатели'], NOGO: ['#EE5D5D', 'relax', 'ЗАМРИ', 'не двигайся'], 'G:supination': ['#3DB37A', 'open', 'СУПИНАЦИЯ', 'ладонь вверх'], 'G:adduction': ['#E995B6', 'point', 'ПРИВЕДИ', 'кисть к мизинцу'], 'G:abduction': ['#F2A33A', 'open', 'ОТВЕДИ', 'кисть к большому'], BOTH: ['#9B78E8', 'point', 'ОБЕ', 'К1 + К2 вместе'] };
    const col = this.ph === 'cue' ? M[this.cue][0] : this.ph === 'fb' ? (this.fb?.ok ? '#3DB37A' : '#EE5D5D') : '#F2A33A';
    // раскладка подстраивается под размер: легенда, диск, подпись, дорожка попыток
    // широкий и невысокий холст (телефон боком): диск слева, подписи справа
    const keys = this.cueSet(), per = Math.max(1, Math.min(keys.length, Math.floor((W - 18) / 90))), rows = Math.ceil(keys.length / per);
    const wide = W > H * 1.45, top = 50 + (rows - 1) * 32, bottom = H - 40;
    let s, R, cx, cy, tx, ty;
    if (wide) {
      s = clamp(H / 420, .7, 1.2); R = Math.max(30, Math.min((bottom - top) / 2 - 16, W * .2, 150));
      cx = W * .3; cy = (top + bottom) / 2; tx = W * .68; ty = cy - 14 * s;
    } else {
      s = clamp(Math.min(W / 390, H / 600), .75, 1.3); R = Math.max(50, Math.min(W * .3, (H - 210 * s) * .38, 160));
      const block = R * 2 + 28 + 80 * s; cy = top + Math.max(0, (bottom - top - block) / 2) + R + 14; cx = tx = W / 2; ty = cy + R + 40 * s;
    }
    // фон: мягкий градиент с оттенком текущего сигнала
    skyG(ctx, W, H, ['#FFF5EA', '#FFE7D3', '#FFDCC2']);
    glow(ctx, cx, cy, Math.max(W, H) * .7, col, this.ph === 'wait' ? .12 : .22);
    ctx.fillStyle = 'rgba(242,125,69,.06)'; for (let y = 20; y < H; y += 34) for (let x = (y / 34 % 2) * 17 + 10; x < W; x += 34) { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); }
    // легенда сигналов (подсвечивается текущий)
    if (C().mode === 'spppr') { M.CH1 = ['#F27D45', 'fist', 'СОГНИ', 'сгибание']; M.CH2 = ['#3E9FD6', 'open', 'РАЗОГНИ', 'разгибание']; M.BOTH = ['#9B78E8', 'point', 'ПРОНАЦИЯ', 'ладонь вниз']; }
    // легенда: по рядам, если сигналов много (СПППР на 6 жестов)
    const lw = Math.min(92, (W - 24) / per - 6);
    keys.forEach((k, i) => { const row = Math.floor(i / per), inRow = Math.min(per, keys.length - row * per), lx0 = W / 2 - (inRow * (lw + 6) - 6) / 2, x = lx0 + (i % per) * (lw + 6), on = this.ph === 'cue' && this.cue === k; ctx.save(); ctx.translate(0, row * 32); rr(ctx, x, 12, lw, 26, 13); ctx.fillStyle = on ? M[k][0] : 'rgba(255,253,250,.85)'; ctx.fill(); ball(ctx, x + 13, 25, 4.5, on ? '#fff' : M[k][0]); txt(ctx, M[k][2].toLowerCase(), x + lw / 2 + 6, 25.5, 11.5, on ? '#fff' : '#6B5A55', 900); ctx.restore(); });
    // диск
    shadowE(ctx, cx, cy + R + 18, R * .75, 9, .12);
    ctx.fillStyle = '#FFFDFA'; ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, 7); ctx.fill();
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(200,170,150,.22)'; ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, 7); ctx.stroke();
    if (this.ph === 'wait') {
      for (let q = 0; q < 2; q++) { const p = ((now + q * .8) % 1.6) / 1.6; ctx.strokeStyle = `rgba(242,163,58,${.45 * (1 - p)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R * (.55 + p * .45), 0, 7); ctx.stroke(); }
      drawHand(ctx, 'relax', cx, cy, R * 1.45, .32);
      txt(ctx, 'Приготовься…', tx, ty, 22 * s, ink('#3B2F2A')); txt(ctx, 'держи обе мышцы расслабленными', tx, ty + 26 * s, 13 * s, ink('#9C8B7F'), 800);
    } else if (this.ph === 'cue') {
      const [c, im, label, sub] = M[this.cue], lim = this.cue === 'NOGO' ? 1.3 : this.lim, k = clamp(this.t / lim);
      const gg = ctx.createRadialGradient(cx, cy - R * .3, R * .1, cx, cy, R); gg.addColorStop(0, shade(c, .35)); gg.addColorStop(1, c);
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, R - 6, 0, 7); ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, R + 2, -Math.PI / 2, -Math.PI / 2 + 6.283 * (1 - k)); ctx.stroke(); ctx.lineCap = 'butt';
      const s0 = 1 + Math.max(0, .18 - this.t) * 1.6; drawHand(ctx, im, cx, cy, R * 1.5 * s0);
      const big = this.cue === 'BOTH' && C().mode === 'emg' ? 'ОБЕ МЫШЦЫ' : label, pw = Math.min(W - 40, 230 * s); rr(ctx, tx - pw / 2, ty - 23 * s, pw, 46 * s, 23 * s); ctx.fillStyle = c; ctx.fill();
      txt(ctx, big, tx, ty + 1, 24 * s, '#fff'); txt(ctx, sub, tx, ty + 40 * s, 13 * s, ink('#9C8B7F'), 800);
    } else if (this.fb) {
      ball(ctx, cx, cy, R * .56, this.fb.ok ? '#7FD3A8' : '#FF8A80');
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(7, R * .09); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      if (this.fb.ok) { ctx.moveTo(cx - R * .22, cy); ctx.lineTo(cx - R * .05, cy + R * .18); ctx.lineTo(cx + R * .25, cy - R * .16); } else { ctx.moveTo(cx - R * .18, cy - R * .18); ctx.lineTo(cx + R * .18, cy + R * .18); ctx.moveTo(cx + R * .18, cy - R * .18); ctx.lineTo(cx - R * .18, cy + R * .18); }
      ctx.stroke(); ctx.lineCap = 'butt';
      txtO(ctx, this.fb.s, tx, ty, 26 * s, '#fff', this.fb.ok ? '#3DB37A' : '#EE5D5D', 7);
      if (this.fb.rt != null) { // шкала скорости: где реакция относительно лимита
        const bw = Math.min(220 * s, W - 60), bx = tx - bw / 2, by = ty + 26 * s, k = clamp(this.fb.rt / (this.lim * 1000));
        rr(ctx, bx, by, bw, 8, 4); ctx.fillStyle = 'rgba(120,90,80,.14)'; ctx.fill();
        const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#3DB37A'); gr.addColorStop(.5, '#FFC24B'); gr.addColorStop(1, '#EE5D5D'); rr(ctx, bx, by, Math.max(8, bw * k), 8, 4); ctx.fillStyle = gr; ctx.fill();
        ball(ctx, bx + Math.max(4, bw * k), by + 4, 7, '#fff'); txt(ctx, this.fb.sub, tx, by + 24 * s, 13 * s, ink('#9C8B7F'), 800);
      } else if (this.fb.sub) txt(ctx, this.fb.sub, tx, ty + 30 * s, 13.5 * s, ink('#9C8B7F'), 800);
    }
    this.fx.draw(ctx);
    // дорожка попыток
    const dw = Math.min(20, (W - 48) / this.N), ry = H - 22;
    rr(ctx, cx - this.N * dw / 2 - 10, ry - 12, this.N * dw + 20, 24, 12); ctx.fillStyle = 'rgba(255,253,250,.8)'; ctx.fill();
    for (let k = 0; k < this.N; k++) { const m = this.marks[k], x = cx - this.N * dw / 2 + k * dw + dw / 2; if (m) ball(ctx, x, ry, dw * .34, m === 'o' ? '#3DB37A' : m === 'f' ? '#F2A33A' : '#EE5D5D'); else { ctx.fillStyle = k === this.i ? 'rgba(242,125,69,.6)' : 'rgba(120,90,80,.18)'; ctx.beginPath(); ctx.arc(x, ry, dw * (k === this.i ? .32 : .26), 0, 7); ctx.fill(); } }
  }
  result() { return { score: this.sc, acc: this.N ? this.ok / this.N : 0, react: this.avg(), win: this.ok / this.N >= .6, extra: [['Средняя реакция', this.rts.length ? Math.round(this.avg()) + ' мс' : '—'], ['Лучшая', this.rts.length ? Math.round(Math.min(...this.rts)) + ' мс' : '—'], ['Верно', `${this.ok} / ${this.N}`], ['Фальстарты', this.false_]] }; }
}

/* =================== 0. ШКОЛА — режим обучения =================== */
const SCHOOL_STEPS = [
  { t: 'Расслабь руку', d: 'Обе мышцы в покое — 2 секунды', k: 'rest', need: 2, im: 'relax' },
  { t: 'Сожми кулак', d: 'Напряги сгибатели (К1) и держи 1 секунду', k: 'st', st: 'CH1', need: 1, im: 'fist' },
  { t: 'Снова расслабь', d: 'Отпусти — протез ждёт команду', k: 'rest', need: 1.2, im: 'relax' },
  { t: 'Раскрой ладонь', d: 'Напряги разгибатели (К2) и держи 1 секунду', k: 'st', st: 'CH2', need: 1, im: 'open' },
  { t: 'Дозируй силу К1', d: 'Держи К1 в зелёной зоне 2 секунды', k: 'zone', ch: 0, lo: .3, hi: .65, need: 2, im: 'fist' },
  { t: 'Дозируй силу К2', d: 'Держи К2 в зелёной зоне 2 секунды', k: 'zone', ch: 1, lo: .3, hi: .65, need: 2, im: 'open' },
  { t: 'Чередуй', d: 'К1 → К2 → К1, расслабляя между ними', k: 'seq', seq: ['CH1', 'CH2', 'CH1'], im: 'open' },
  { t: 'Обе мышцы', d: 'Напряги обе сразу — так меняется жест', k: 'st', st: 'BOTH', need: .45, im: 'point', both: true }
];
const SCHOOL_SP6 = [
  { t: 'Пронация', d: 'Поверни кисть ладонью вниз и держи', k: 'st', st: 'BOTH', need: .6, im: 'point', both: true },
  { t: 'Супинация', d: 'Поверни кисть ладонью вверх и держи', k: 'g', g: 'supination', need: .6, im: 'open' },
  { t: 'Приведение', d: 'Отведи кисть к мизинцу и держи', k: 'g', g: 'adduction', need: .6, im: 'point' },
  { t: 'Отведение', d: 'Отведи кисть к большому пальцу и держи', k: 'g', g: 'abduction', need: .6, im: 'open' }
];
/* набор шагов под текущий режим: без «обе мышцы» шаг пропускается, в СПППР на 6 жестов добавляются 4 жеста */
function schoolSteps() {
  const six = C().mode === 'spppr' && C().spGest === 6;
  let st = SCHOOL_STEPS.filter(x => !x.both || (Ctrl.bothOK() && !six));
  if (six) st = st.concat(SCHOOL_SP6);
  if (C().mode === 'spppr') st = st.map(x => ({ ...x, t: x.t.replace('Сожми кулак', 'Согни кисть').replace('Раскрой ладонь', 'Разогни кисть'), d: x.d.replace('сгибатели (К1)', 'сгибание').replace('разгибатели (К2)', 'разгибание') }));
  return st;
}
class SchoolGame {
  constructor() { this.steps = schoolSteps(); this.T = 0; this.done = false; this.fx = new FX(); this.ban = new Banner(); this.N = this.steps.length; this.i = 0; this.p = 0; this.err = 0; this.pause = 0; this.si = 0; this.sc = 0; this.stepT = 0; }
  resize(W, H) { this.W = W; this.H = H; }
  progress() { return clamp((this.i + clamp(this.p)) / this.N); }
  hud() { return `${Math.min(this.i + 1, this.N)} / ${this.N}`; }
  chips() { return [['Шаг', `${Math.min(this.i + 1, this.N)} из ${this.N}`], ['Ошибки', this.err, this.err ? '#F2A33A' : null]]; }
  hint() { return this.pause > 0 ? ['Получилось!', 'ok'] : (this.step?.d || ''); }
  get step() { return this.steps[this.i]; }
  onState(e) {
    const s = this.step; if (!s || this.pause > 0) return;
    if ((s.k === 'st' || s.k === 'g') && e.state !== 'REST' && e.state !== s.st && !(s.st === 'BOTH')) { this.err++; this.ban.show('Не та мышца', '#fff', '#F2A33A', .7, 24); Snd.bad(); }
    if (s.k === 'seq') {
      if (e.state === 'REST' || e.state === 'BOTH') return;
      if (e.state === s.seq[this.si]) { this.si++; Snd.note(this.si); this.fx.ring(this.W / 2, this.H * .38, e.state === 'CH1' ? '#F27D45' : '#3E9FD6', 50); if (this.si >= s.seq.length) this.p = 1; }
      else { this.err++; this.si = 0; this.ban.show('Сначала ' + (s.seq[0] === 'CH1' ? 'К1' : 'К2'), '#fff', '#F2A33A', .8, 24); Snd.bad(); }
    }
  }
  update(dt, c) {
    this.T += dt; this.fx.update(dt); this.ban.update(dt);
    if (this.pause > 0) { this.pause -= dt; if (this.pause <= 0) { this.i++; this.p = 0; this.si = 0; this.stepT = 0; if (this.i >= this.N) this.done = true; } return; }
    const s = this.step; if (!s) { this.done = true; return; }
    this.stepT += dt;
    let ok = false;
    if (s.k === 'rest') ok = c.state === 'REST' && c.a[0] < .2 && c.a[1] < .2;
    else if (s.k === 'st') ok = c.state === s.st;
    else if (s.k === 'zone') { const w = s.ch || 0; ok = c.state !== (w ? 'CH1' : 'CH2') && c.state !== 'BOTH' && c.a[w] >= s.lo && c.a[w] <= s.hi; }
    else if (s.k === 'g') ok = c.g === s.g;
    if (s.k !== 'seq') this.p = ok ? this.p + dt / s.need : Math.max(0, this.p - dt / s.need * .6);
    if (this.p >= 1) {
      this.p = 1; this.pause = 1.1; this.sc += Math.max(60, Math.round(200 - this.stepT * 15));
      Snd.ok(); this.ban.show(pick(['Отлично!', 'Супер!', 'Получилось!', 'Так держать!']), '#fff', '#3DB37A', 1, 34);
      this.fx.burst(this.W / 2, this.H * .38, ['#FF9A5E', '#FFD27A', '#7FD3A8', '#86C5F0'], 36, 340, true);
    }
  }
  get score() { return this.sc; }
  draw(ctx) {
    const W = this.W, H = this.H, s = this.step || this.steps[this.N - 1], now = performance.now() / 1000, cx = W / 2, R = Math.min(W * .24, H * .19), cy = Math.max(40 + R + 16, (H - 90) / 2 - 24);
    skyG(ctx, W, H, ['#E9F6EE', '#F7FAF2', '#FFF5EA']);
    const dw = Math.min(30, (W - 40) / this.N);
    for (let k = 0; k < this.N; k++) { const x = W / 2 - (this.N - 1) * dw / 2 + k * dw, done = k < this.i || (k === this.i && this.pause > 0); ctx.fillStyle = done ? '#3DB37A' : k === this.i ? '#F27D45' : 'rgba(120,90,80,.18)'; ctx.beginPath(); ctx.arc(x, 22, k === this.i ? 7 : 5.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#FFFDFA'; ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(200,170,150,.22)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, 7); ctx.stroke();
    const pc = s.k === 'st' ? ST[s.st].hex : s.k === 'g' ? '#3DB37A' : s.k === 'zone' ? '#3DB37A' : s.k === 'seq' ? '#9B78E8' : '#B9A99B';
    ctx.strokeStyle = this.pause > 0 ? '#3DB37A' : pc; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, R + 4, -Math.PI / 2, -Math.PI / 2 + 6.283 * clamp(s.k === 'seq' ? this.si / s.seq.length : this.p)); ctx.stroke(); ctx.lineCap = 'butt';
    drawHand(ctx, s.im, cx, cy, R * 1.6 * (1 + Math.sin(now * 3) * .015));
    const ty = cy + R + 44; txt(ctx, s.t, cx, ty, 24, ink('#3B2F2A'));
    if (s.k === 'seq') s.seq.forEach((q, k) => { const x = cx - 46 + k * 46, y = ty + 38; ball(ctx, x, y, 14, k < this.si ? '#3DB37A' : ST[q].hex); txt(ctx, q === 'CH1' ? 'К1' : 'К2', x, y + 1, 10.5, '#fff'); });
    // две горизонтальные шкалы мышц
    const bw = Math.min(W - 64, 420), bx = (W - bw) / 2;
    [[0, H - 58, '#F27D45', 'К1'], [1, H - 28, '#3E9FD6', 'К2']].forEach(([i, y, col, l]) => {
      txt(ctx, l, bx - 16, y, 12, col); chMark(ctx, i, bx + bw + 14, y, 5, col);
      rr(ctx, bx, y - 7, bw, 14, 7); ctx.fillStyle = NIGHT() ? 'rgba(255,255,255,.14)' : '#EDE3D8'; ctx.fill();
      if (s.k === 'zone' && i === (s.ch || 0)) { rr(ctx, bx + bw * s.lo, y - 7, bw * (s.hi - s.lo), 14, 7); ctx.fillStyle = 'rgba(61,179,122,.35)'; ctx.fill(); }
      const v = clamp(Ctrl.a[i]); if (v > .01) { rr(ctx, bx, y - 7, bw * v, 14, 7); ctx.fillStyle = col; ctx.fill(); }
      const tx = bx + bw * C()['thr' + (i + 1)]; ctx.fillStyle = NIGHT() ? 'rgba(255,255,255,.55)' : 'rgba(59,47,42,.45)'; ctx.fillRect(tx - 1, y - 10, 2, 20);
    });
    this.fx.draw(ctx);
    this.ban.draw(ctx, cx, cy);
  }
  result() { return { score: this.sc, acc: clamp(1 - this.err * .06), win: this.i >= this.N, extra: [['Шагов пройдено', `${Math.min(this.i, this.N)} / ${this.N}`], ['Ошибки каналов', this.err], ['Время', fmtTime(this.T)]] }; }
}

/* =================== Каталог игр =================== */
const GAMES = {
  race: { cls: RaceGame, tone: 'peach', t: 'Нейро-гонка', d: 'Доберись до финиша: руль — разница силы К2 и К1', skill: 'Пропорциональное управление', tile: 't-peach', ic: 'car',
    goal: lv => `Доехать до финиша: ${LV(lv, [2200, 3200, 4200])} м`, ctl: [['К1', 'руль влево (сила = резкость)', '#F27D45'], ['К2', 'руль вправо', '#3E9FD6'], ['Обе', 'нитро-ускорение', '#9B78E8']] },
  flap: { cls: FlapGame, tone: 'sky', t: 'Искра', d: 'Проведи дрона через ворота: цвет ворот — какой мышцей лететь', skill: 'Тайминг, сила и переключение', tile: 't-sky', ic: 'bird',
    goal: lv => `Пролететь ${LV(lv, [12, 16, 20])} ворот, половину и больше — нужным каналом`, ctl: [['К1', 'взмах у оранжевых ворот', '#F27D45'], ['К2', 'взмах у голубых ворот', '#3E9FD6'], ['Сила', 'чем сильнее — тем выше', '#3DB37A'], ['Покой', 'дрон плавно снижается', '#C8BAAE']] },
  rhythm: { cls: RhythmGame, tone: 'lilac', t: 'Ритм-пульс', d: 'Лови ноты нужной мышцей и удерживай длинные', skill: 'Переключение каналов', tile: 't-lilac', ic: 'music',
    goal: lv => `Сыграть мелодию: ${LV(lv, [78, 92, 106])} уд/мин, ≥60% нот`, ctl: [['К1', 'левая дорожка', '#F27D45'], ['К2', 'правая дорожка', '#3E9FD6'], ['Удержание', 'длинные ноты', '#3DB37A'], ...[]] },
  fish: { cls: FishGame, tone: 'mint', t: 'Рыбалка', d: 'Расслабься, подсеки и веди рыбку: К1 подтягивает, К2 отпускает', skill: 'Контроль силы и покой', tile: 't-mint', ic: 'fish',
    goal: lv => `Поймать ${LV(lv, [3, 4, 5])} рыбы`, ctl: [['Покой', 'ждём поклёвку — не шевелись', '#C8BAAE'], ['К1 рывок', 'подсечка, когда клюёт', '#F27D45'], ['Сила К1', 'подтянуть — зона вверх', '#F27D45'], ['Сила К2', 'отпустить — зона вниз', '#3E9FD6']] },
  mug: { cls: MugGame, tone: 'rose', t: 'Горячая кружка', d: 'Возьми, донеси и поставь кружку: не раздави, не урони, не пролей', skill: 'Дозирование хвата', tile: 't-rose', ic: 'cup',
    goal: lv => `Донести ${LV(lv, [4, 5, 6])} кружки до подставки`, ctl: [['К2', 'раскрыть кисть перед кружкой и чтобы поставить', '#3E9FD6'], ['К1', 'сжать до зелёной зоны хвата', '#F27D45'], ['Покой', 'протез держит хват — неси спокойно', '#C8BAAE'], ['Обе', 'нельзя: чай расплёскивается', '#EE5D5D']] },
  blind: { cls: BlindGame, tone: 'lilac', t: 'Без экрана', d: 'Команды звучат голосом — смотри на руку, а не на телефон', skill: 'Связь «мышца — действие»', tile: 't-lilac', ic: 'ear',
    goal: lv => `Выполнить ${LV(lv, [10, 14, 18])} команд, ≥60% верно · ${lv < 2 ? 'команда видна текстом' : lv < 3 ? 'на экране только индикатор' : 'экран выключен'}`, ctl: [['К1', 'низкий тон — «сожми»', '#F27D45'], ['К2', 'высокий тон — «раскрой»', '#3E9FD6'], ['Покой', 'мягкий тон — «расслабь»', '#C8BAAE'], ['Звук', 'включите звук телефона', '#9B78E8']] },
  react: { cls: ReactGame, tone: 'sun', t: 'Реакция', d: 'Сожми, раскрой или замри — как можно быстрее', skill: 'Скорость и изоляция', tile: 't-sun', ic: 'bolt',
    goal: lv => `${LV(lv, [12, 16, 20])} сигналов, ≥60% верно`, ctl: [['К1', '«Сожми»', '#F27D45'], ['К2', '«Раскрой»', '#3E9FD6'], ['Покой', '«Замри» и ожидание', '#EE5D5D'], ['Обе', '«Обе мышцы» (уровень 3)', '#9B78E8']] },
  school: { cls: SchoolGame, tone: 'rose', tut: true, t: 'Школа управления', d: 'Короткие шаги: покой, К1, К2, сила каждой мышцы, чередование, обе мышцы', skill: 'Обучение', tile: 't-mint', ic: 'info',
    goal: () => `Пройти ${schoolSteps().length} упражнений`, ctl: [['К1', 'сгибатели — «закрыть»', '#F27D45'], ['К2', 'разгибатели — «открыть»', '#3E9FD6'], ['Покой', 'обе мышцы расслаблены', '#C8BAAE']] }
};
const ARCADE = () => Object.keys(GAMES).filter(k => !GAMES[k].tut);

/* Живые превью на карточках игр */
function gamePreview(id, ctx, W, H, t) {
  ctx.save(); ctx.clearRect(0, 0, W, H);
  const bob = Math.sin(t * 2.2);
  if (id === 'race') {
    const hor = H * .45; skyG(ctx, W, hor, ['#FFC79A', '#FFF1DE']); sun(ctx, W * .8, hor * .5, 13); cloud(ctx, W * .18, hor * .42, .55, .9);
    hills(ctx, W, hor + 2, 30, '#F2BFA3', 0, 1, 60, hor + 2); hills(ctx, W, hor + 2, 18, '#C9E2B0', 40, 4, 40, hor + 2);
    ctx.fillStyle = '#BFE3A5'; ctx.fillRect(0, hor, W, H);
    const cx = W / 2; ctx.fillStyle = '#FF8F5A'; ctx.beginPath(); ctx.moveTo(cx - 6, hor); ctx.lineTo(cx + 6, hor); ctx.lineTo(cx + W * .36, H); ctx.lineTo(cx - W * .36, H); ctx.fill();
    ctx.fillStyle = '#968990'; ctx.beginPath(); ctx.moveTo(cx - 4, hor); ctx.lineTo(cx + 4, hor); ctx.lineTo(cx + W * .32, H); ctx.lineTo(cx - W * .32, H); ctx.fill();
    for (let k = 0; k < 6; k++) { const z = ((t * .7 + k / 6) % 1), y = hor + (H - hor) * z * z, w = 1.5 + z * 5; ctx.fillStyle = '#FFF7EE'; ctx.fillRect(cx - w / 2, y, w, 2 + z * 10); }
    carRear(ctx, cx + bob * 10, H - 8, 52, '#EE7A45', bob * .06, true);
  } else if (id === 'flap') {
    skyG(ctx, W, H, ['#A9D8FF', '#FFF1DE']); sun(ctx, W * .86, H * .24, 12); cloud(ctx, W * .12, H * .3, .55, .9); cloud(ctx, W * .7, H * .2, .45, .8);
    for (let k = 0; k < 7; k++) { const bw = W / 7; gum(ctx, k * bw + 6, H - 34 - (k % 3) * 10, bw - 12, 60, 10, ['#E8DDFB', '#FBE0D2', '#DCEBFA'][k % 3], 0); }
    ctx.fillStyle = '#A8DB9F'; ctx.fillRect(0, H - 10, W, 10);
    const gx = W * .66, gy = H * .48, gap = H * .5; gum(ctx, gx - 15, -12, 30, gy - gap / 2 + 12, 12, '#7FD3A8', 0); gum(ctx, gx - 15, gy + gap / 2, 30, H, 12, '#7FD3A8', 0);
    drone(ctx, W * .36, H * .48 + bob * 10, 13, t, bob * .15, bob > .4);
  } else if (id === 'rhythm') {
    skyG(ctx, W, H, ['#2E2342', '#5A3550']);
    const n = 9; for (let i = 0; i < n; i++) { const u = (i + .5) / n, bx = u * W, by = 10 + Math.sin(u * Math.PI) * 12, c = ['#FFD27A', '#FF9A6B', '#FFB4C8', '#9FD8FF'][i % 4]; glow(ctx, bx, by, 14, c, .55); ball(ctx, bx, by, 3.5, c); }
    const hy = H - 22;
    [[W / 2 - 40, '#FF9A5E'], [W / 2 + 40, '#6CC0F0']].forEach(([x, c], l) => {
      ctx.fillStyle = 'rgba(255,255,255,.06)'; rr(ctx, x - 18, 26, 36, H - 30, 18); ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, hy, 13, 0, 7); ctx.stroke();
      for (let k = 0; k < 2; k++) { const p = ((t * .45 + k * .5 + l * .25) % 1), y = 30 + p * (hy - 30); ctx.globalAlpha = clamp(p * 4); ball(ctx, x, y, 9, c, 8); ctx.globalAlpha = 1; }
    });
  } else if (id === 'fish') {
    const wy = H * .5; skyG(ctx, W, wy, ['#FFB98C', '#FFEBD6']); sun(ctx, W * .72, wy - 6, 14); hills(ctx, W, wy + 1, 18, '#E8B49C', 0, 1, 50, wy + 1);
    const g = ctx.createLinearGradient(0, wy, 0, H); g.addColorStop(0, '#8ECFE0'); g.addColorStop(1, '#4E98C2'); ctx.fillStyle = g; ctx.fillRect(0, wy, W, H);
    const bx = W * .5, by = wy + 3 + bob * 2; ctx.strokeStyle = '#8A5A3A'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(W * .12, H * .8); ctx.quadraticCurveTo(W * .2, H * .2, W * .32, H * .14); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(W * .32, H * .14); ctx.quadraticCurveTo(bx - 20, wy - 20, bx, by); ctx.stroke();
    ball(ctx, bx, by, 6, '#FF6B6B'); fishSprite(ctx, W * .62 + bob * 14, H * .8, 18, '#F2B33A', Math.cos(t * 1.1) > 0 ? 1 : -1, t);
  } else if (id === 'blind') {
    ctx.fillStyle = '#0E0F16'; ctx.fillRect(0, 0, W, H);
    for (let q = 0; q < 3; q++) { const p = ((t * .6 + q / 3) % 1); ctx.strokeStyle = `rgba(181,151,255,${.6 * (1 - p)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, H / 2, 10 + p * Math.min(W, H) * .45, -.8, .8); ctx.stroke(); ctx.beginPath(); ctx.arc(W / 2, H / 2, 10 + p * Math.min(W, H) * .45, Math.PI - .8, Math.PI + .8); ctx.stroke(); }
    ball(ctx, W / 2, H / 2, 8, '#B597FF');
  } else if (id === 'mug') {
    skyG(ctx, W, H, ['#FFE7D2', '#FFF3E6']); const ty = H * .78; gum(ctx, -10, ty, W + 20, H, 10, '#E9B98C', 4);
    const k = (t * .35) % 1, x = lerp(W * .25, W * .75, easeOut(clamp(k * 1.4))), y = ty - Math.sin(Math.PI * clamp(k * 1.4)) * H * .25;
    shadowE(ctx, x, ty + 2, 16, 3, .15); cupSprite(ctx, x, y, Math.min(W, H) * .22, CUPS[0], 1, Math.sin(t * 3) * .05, 0, 0, t);
    const f = .55 + .1 * Math.sin(t * 2); ctx.fillStyle = '#EDE2D6'; rr(ctx, W - 14, 8, 6, H - 16, 3); ctx.fill(); ctx.fillStyle = 'rgba(127,211,168,.9)'; ctx.fillRect(W - 14, 8 + (H - 16) * .3, 6, (H - 16) * .25); ctx.fillStyle = '#3DB37A'; ctx.fillRect(W - 16, 8 + (H - 16) * (1 - f), 10, 3);
  } else if (id === 'react') {
    // превью в стиле новой «Реакции»: цветной диск сигнала с кольцом времени
    skyG(ctx, W, H, ['#FFF5EA', '#FFDCC2']); const cx = W / 2, cy = H * .52, R = H * .3, k = Math.floor(t / 1.4) % 3, c = ['#F27D45', '#3E9FD6', '#9B78E8'][k], p = (t % 1.4) / 1.4;
    glow(ctx, cx, cy, R * 2.4, c, .28); ctx.fillStyle = '#FFFDFA'; ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, 7); ctx.fill();
    const gg = ctx.createRadialGradient(cx, cy - R * .3, R * .1, cx, cy, R); gg.addColorStop(0, shade(c, .35)); gg.addColorStop(1, c); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, R - 2, 0, 7); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, R + 4, -Math.PI / 2, -Math.PI / 2 + 6.283 * (1 - p)); ctx.stroke(); ctx.lineCap = 'butt';
    drawHand(ctx, ['fist', 'open', 'point'][k], cx, cy, R * 1.5);
  }
  ctx.restore();
}
