/* =====================================================================
   Kineta — ядро: утилиты, хранилище, звук, иконки, источники сигнала,
   обработка ЭМГ (Ctrl), модель протеза (Prosthesis), BLE-протез и геолокация.
   ===================================================================== */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pct = v => Math.round(v * 100) + '%';
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const dayKey = (d = new Date()) => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtTime = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const fmtN = n => Math.round(n).toLocaleString('ru-RU');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const APP_VERSION = '3.2.0';

/* ---------------- Шина событий ---------------- */
const Bus = {
  h: {},
  on(e, f) { (this.h[e] ||= []).push(f); return () => this.h[e] = this.h[e].filter(x => x !== f); },
  emit(e, d) {
    (this.h[e] || []).forEach(f => { try { f(d); } catch (err) { console.error(err); } });
    if (window.parent !== window && e !== 'state' && e !== 'pose') window.parent.postMessage({ type: 'kineta:' + e, data: d }, '*');
  }
};

/* ---------------- Жесты по умолчанию ----------------
   Поза = [большой, указательный, средний, безымянный, мизинец, оппозиция большого], 0..100 % сгибания. */
const FINGERS = ['Большой', 'Указательный', 'Средний', 'Безымянный', 'Мизинец'];
const DEF_GESTURES = [
  { id: 'natural', name: 'Натуральное положение', open: [10, 8, 10, 14, 18, 30], closed: [35, 40, 45, 50, 55, 45] },
  { id: 'fist', name: 'Кулак', open: [5, 0, 0, 0, 0, 20], closed: [70, 96, 96, 96, 96, 55] },
  { id: 'pinch', name: 'Щепоть', open: [10, 10, 10, 92, 92, 85], closed: [52, 58, 58, 92, 92, 95] },
  { id: 'point', name: 'Указательный', open: [65, 0, 95, 95, 95, 70], closed: [65, 40, 95, 95, 95, 70] },
  { id: 'ok', name: 'Ок', open: [10, 8, 5, 5, 5, 80], closed: [55, 68, 8, 14, 20, 95] },
  { id: 'call', name: 'Позвони мне', open: [0, 95, 95, 95, 0, 0], closed: [0, 95, 95, 95, 0, 0] },
  { id: 'tweezer', name: 'Пинцет', open: [10, 12, 95, 95, 95, 80], closed: [55, 62, 95, 95, 95, 95] },
  { id: 'key', name: 'Хват ключа', open: [0, 70, 76, 82, 86, 0], closed: [62, 80, 85, 88, 90, 8] },
  { id: 'mug', name: 'Цилиндрический хват', open: [10, 5, 5, 5, 5, 60], closed: [45, 62, 64, 66, 68, 80] }
];

/* ---------------- Хранилище ---------------- */
const KEY = 'kineta.app.v2';
const DEF = {
  onboarded: false,
  perms: { bt: 'none', geo: 'none' },
  device: { id: null, name: null, real: false, connected: false, battery: 82, info: null, fw: { hand: '2.4.1', gui: '0.4.4', emg: '1.7.0' }, lastSeen: null },
  geo: null,
  cfg: {
    mode: 'emg', thr1: .38, thr2: .35, gain1: 10, gain2: 10, hyst: .75, deadzone: .05, smoothing: .35, slew: .15,
    suppressMs: 30, bothThr: .4, switchMs: 280, speed: 2.2, preset: 'norm',
    // coMode — одновременная активация К1+К2: 'both' — отдельное действие 3 (по ТЗ), 'classic' — первый сигнал держит управление, 'sport' — второй перехватывает
    // thrSrc — откуда пороги: 'game' — свои игровые (калибровка), 'device' — пороги, пришедшие от протеза в потоке (0…255)
    // spGest — словарь СПППР: 2 жеста + нейтраль или 6 жестов + нейтраль; hand — сторона протеза (здоровая рука — противоположная)
    coMode: 'both', thrSrc: 'game', devThr: [97, 89], spGest: 6, hand: 'left', sessionMin: 10, remote: '',
    sound: true, vibro: true, voice: false, mirror: false, theme: 'light',
    ble: { namePrefix: '', service: '', emgChar: '', cmdChar: '', format: 'u16le2', fullScale: 4095 },
    emu: { noise: .03, crosstalk: .06, rise: 1.8, fall: 3.0, jMin: 10, jMax: 110, loss: .05, burst: .01, misclass: .04 }
  },
  calib: { done: false, base1: .03, base2: .03, mvc1: 1, mvc2: 1, at: null },
  profile: { name: 'Алексей', xp: 0, streak: 0, lastDay: null, goalMin: 15 },
  gestures: null, rotation: ['natural', 'fist', 'pinch', 'point'], activeId: 'natural',
  stats: { days: {}, gestTotal: {}, seeded: false },
  games: {}, history: [], ach: {}, demo: null
};
function merge(a, b) { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], b[k]); else a[k] = b[k]; } return a; }
let S;
function load() {
  S = structuredClone(DEF);
  let raw = null;
  try { raw = localStorage.getItem(KEY); if (raw) merge(S, JSON.parse(raw)); }
  catch (e) { try { localStorage.setItem(KEY + '.broken', raw); } catch (_) { } console.warn('[Kineta] сохранение повреждено, копия в ' + KEY + '.broken'); }
  if (!Array.isArray(S.gestures) || !S.gestures.length) S.gestures = structuredClone(DEF_GESTURES).map(g => ({ ...g, builtin: true }));
  // ссылки из старых сохранений: только существующие жесты в ротации и активный жест
  S.gestures = S.gestures.filter(g => g && g.id && Array.isArray(g.open) && Array.isArray(g.closed));
  S.rotation = (Array.isArray(S.rotation) ? S.rotation : []).filter((id, i, a) => G(id) && a.indexOf(id) === i);
  if (!S.rotation.length) S.rotation = [S.gestures[0].id];
  if (!G(S.activeId)) S.activeId = S.rotation[0];
  // демо-история только по явному флагу ?demo=1 (показ жюри / скриншоты); новый пользователь начинает с чистого листа
  const demoQ = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('demo') : null;
  if (S.stats.seeded && S.demo == null) S.demo = S.history.some(h => h.seed); // сохранения старых версий: помечаем, что данные демо
  if (demoQ === '1' && !S.demo && !S.history.some(h => !h.seed)) { seedStats(); S.demo = true; }
}
let saveT = 0;
function save(now = false) {
  clearTimeout(saveT);
  const w = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
  now ? w() : saveT = setTimeout(w, 250);
}
const C = () => S.cfg;
const G = id => S.gestures.find(g => g.id === id);

/* Демо-история за 5 недель для показа дашбордов (?demo=1). Записи помечены seed: true,
   включён флаг S.demo — интерфейс показывает плашку «Демо-данные»; сброс — в профиле. */
function seedStats() {
  const today = new Date();
  const w = { natural: 24, fist: 120, pinch: 60, point: 340, ok: 14, call: 6, tweezer: 18, key: 30, mug: 45 };
  for (let i = 34; i >= 1; i--) {
    const d = addDays(today, -i), k = dayKey(d), skip = Math.random() < (i > 20 ? .35 : .18);
    if (skip) continue;
    const prog = 1 - i / 40;
    const day = { min: Math.round(rnd(4, 18) + prog * 8), acts: 0, acc: Math.round(clamp(rnd(.55, .72) + prog * .2, 0, .97) * 100), purity: Math.round(clamp(rnd(.5, .68) + prog * .22, 0, .97) * 100), react: Math.round(rnd(520, 700) - prog * 180), gest: {} };
    for (const id in w) { const n = Math.max(0, Math.round(w[id] * rnd(.5, 1.4) * (.6 + prog))); if (n) { day.gest[id] = n; day.acts += n; S.stats.gestTotal[id] = (S.stats.gestTotal[id] || 0) + n; } }
    S.stats.days[k] = day;
  }
  const gm = ['race', 'flap', 'rhythm', 'fish', 'mug', 'react'];
  for (let i = 0; i < 14; i++) {
    const g = pick(gm), t = addDays(today, -Math.floor(rnd(1, 20))).getTime();
    S.history.push({ t, game: g, score: Math.round(rnd(400, 2400)), acc: Math.round(rnd(58, 92)), purity: Math.round(rnd(55, 90)), dur: Math.round(rnd(60, 180)), seed: true });
  }
  S.history.sort((a, b) => a.t - b.t);
  S.profile.xp = 1340; S.profile.streak = 5; S.profile.lastDay = dayKey(addDays(today, -1));
  S.stats.seeded = true;
}
function today() {
  const k = dayKey();
  return S.stats.days[k] ||= { min: 0, acts: 0, acc: 0, purity: 0, react: 0, gest: {}, n: 0 };
}
function touchStreak() {
  const t = dayKey(), y = dayKey(addDays(new Date(), -1)), p = S.profile;
  if (p.lastDay === t) return;
  p.streak = p.lastDay === y ? p.streak + 1 : 1; p.lastDay = t; save();
}
load();

/* ---------------- Звук ---------------- */
const Snd = {
  ctx: null,
  init() { if (!this.ctx) try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } if (this.ctx?.state === 'suspended') this.ctx.resume(); },
  tone(f, d = .12, type = 'sine', v = .06, delay = 0, slide = 0) {
    if (!C().sound || !this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + d + .05);
  },
  tap() { this.tone(1200, .05, 'sine', .025); },
  ok() { this.tone(660, .1); this.tone(990, .16, 'sine', .05, .07); vib(12); },
  coin() { this.tone(988, .07, 'square', .03); this.tone(1319, .14, 'square', .03, .06); },
  bad() { this.tone(180, .25, 'triangle', .06, 0, .6); vib([30, 40, 30]); },
  flap() { this.tone(420, .1, 'sine', .04, 0, 1.8); },
  tick() { this.tone(880, .04, 'sine', .03); },
  go() { this.tone(523, .1, 'sine', .05); this.tone(784, .2, 'sine', .05, .1); },
  swap() { this.tone(520, .06, 'triangle', .04); this.tone(780, .08, 'triangle', .04, .05); vib(20); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .22, 'sine', .05, i * .11)); },
  note(i) { this.tone([523, 659, 784, 988][i % 4], .14, 'triangle', .05); },
  // мягкие игровые звуки
  pluck(f, v = .045) { this.tone(f, .22, 'triangle', v); this.tone(f * 2, .12, 'sine', v * .35, .01); },
  kick() { this.tone(110, .16, 'sine', .07, 0, .45); },
  hat() { this.tone(5200, .03, 'square', .006); },
  whoosh() { this.tone(300, .25, 'sine', .03, 0, 2.2); },
  splash() { this.tone(900, .18, 'triangle', .03, 0, .4); this.tone(600, .2, 'sine', .02, .05, .5); },
  reel() { this.tone(1400, .02, 'square', .008); }
};
function vib(p) { if (!Native.isNative && navigator.userActivation && !navigator.userActivation.hasBeenActive) return; if (C().vibro) Native.vibrate(p); }

/* ---------------- Иконки (линейные, 24×24) ---------------- */
const IC = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 013 0V12"/><path d="M11 11V4a1.5 1.5 0 013 0v7"/><path d="M14 11V5.5a1.5 1.5 0 013 0V13"/><path d="M17 9.5a1.5 1.5 0 013 0V15a7 7 0 01-7 7h-1a7 7 0 01-5.6-2.8L3.6 15a1.6 1.6 0 012.5-2L8 15"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  wave: '<path d="M2 12h3l2-6 3 12 3-9 2 6 2-3h5"/>',
  game: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="18" cy="14" r="1"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  bt: '<path d="M7 7l10 10-5 4V3l5 4L7 17"/>',
  gps: '<path d="M12 22s7-6.5 7-12a7 7 0 00-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  drag: '<path d="M4 9h16M4 15h16"/><path d="M9 4l3-2 3 2M9 20l3 2 3-2"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-9-1 2-2 3-3 3 0-2-1-4-3-6 0 4-4 6-4 12 0 4 3 7 7 7z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 01-8 0V4zM8 6H4v2a3 3 0 003 3M16 6h4v2a3 3 0 01-3 3M12 13v4M8 21h8M9 17h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 .5c0 2-2.5 2-2.5 4M12 17.5v.5"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
  mirror: '<path d="M12 3v18M8 7L3 12l5 5M16 7l5 5-5 5"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>',
  vibro: '<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M4 8v8M20 8v8M2 10v4M22 10v4"/>',
  down: '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
  swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/>',
  battery: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  heart: '<path d="M12 20s-8-4.5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 9c0 6.5-8 11-8 11z"/>',
  calib: '<circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  cup: '<path d="M4 8h12v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8z"/><path d="M16 10h1.5a2.5 2.5 0 010 5H16"/><path d="M8 2.5c-.6.8.6 1.7 0 2.5M12 2.5c-.6.8.6 1.7 0 2.5"/>',
  fish: '<path d="M2 12c3-4 7-6 11-6 4 0 7 3 9 6-2 3-5 6-9 6-4 0-8-2-11-6zM2 12l-1-4M2 12l-1 4"/><circle cx="16" cy="11" r="1"/>',
  car: '<path d="M5 17h14v-5l-2-5H7l-2 5z"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/><path d="M5 12h14"/>',
  bird: '<path d="M4 14c2-6 8-8 12-6l4-1-2 3c0 5-4 8-9 8-3 0-5-1-5-4z"/><circle cx="15" cy="10" r="1"/>'
};
const ic = (n, cls = '', sw = 2) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ''}</svg>`;

/* =====================================================================
   ИСТОЧНИКИ СИГНАЛА
   Intent — «намерение» пользователя с клавиатуры / тач-панелей → активация мышц.
   EmgEmulator — Поток 1 {timestamp_ms, ch1, ch2} @100 Гц.
   SppprEmulator — Поток 2: JSON {timestamp_ms, dist} с джиттером и потерями.
   ===================================================================== */
/* жесты СПППР, которые эмулятор умеет «изображать» отдельными клавишами (сгибание/разгибание идут от К1/К2) */
const SP_KEYS = ['pronation', 'supination', 'adduction', 'abduction'];
const Intent = {
  lvl: [0, 0], keys: [false, false], pad: [null, null], auto: null, last: 0, id: 0,
  g: null, gl: 0, gKeys: {}, gAuto: null, dropUntil: 0,
  start() {
    if (this.id) return; this.last = performance.now();
    this.id = setInterval(() => {
      const now = performance.now(), dt = Math.min(.05, (now - this.last) / 1000), e = C().emu; this.last = now;
      for (let i = 0; i < 2; i++) {
        const p = this.pad[i], a = this.auto?.[i];
        if (p != null) this.lvl[i] += (p - this.lvl[i]) * Math.min(1, dt / .04);
        else if (a != null) this.lvl[i] += (a - this.lvl[i]) * Math.min(1, dt / .06);
        else if (this.keys[i]) this.lvl[i] = Math.min(1, this.lvl[i] + e.rise * dt);
        else this.lvl[i] = Math.max(0, this.lvl[i] - e.fall * dt);
      }
      // дополнительный жест СПППР (пронация, супинация, приведение, отведение)
      const want = this.gAuto || SP_KEYS.find(k => this.gKeys[k]) || null;
      if (want) { if (want !== this.g) { this.g = want; this.gl = Math.min(this.gl, .2); } this.gl = Math.min(1, this.gl + e.rise * 1.4 * dt); }
      else { this.gl = Math.max(0, this.gl - e.fall * dt); if (!this.gl) this.g = null; }
    }, 5);
  },
  /* имитация обрыва связи: источник молчит ms миллисекунд (проверка инерции и критической потери) */
  drop(ms = 2500) { this.dropUntil = performance.now() + ms; }
};
/* Поток 1 — пакет как у системы управления протезом: амплитуды двух датчиков 0…255 и пороги 0…255 */
class EmgEmulator {
  constructor(intent) { this.intent = intent; }
  start(cb) {
    this.intent.start();
    this.id = setInterval(() => {
      if (performance.now() < this.intent.dropUntil) return;
      const e = C().emu, [a, b] = this.intent.lvl, t = performance.now() / 1000;
      const art = .006 * Math.sin(t * 2 * Math.PI * 1.3); // дыхательный дрейф
      const ch1 = clamp(.03 + art + .82 * a + e.crosstalk * b + gauss() * e.noise * (1 + 2 * a));
      const ch2 = clamp(.03 - art + .82 * b + e.crosstalk * a + gauss() * e.noise * (1 + 2 * b));
      cb({ timestamp_ms: Math.round(performance.now()), emg: [Math.round(ch1 * 255), Math.round(ch2 * 255)], thr: C().devThr.slice() });
    }, 10);
  }
  stop() { clearInterval(this.id); }
}
class SppprEmulator {
  constructor(intent) { this.intent = intent; this.boot = 1e6 + Math.floor(Math.random() * 5e6); this.t0 = performance.now(); this.burstUntil = 0; this.sent = 0; this.dropped = 0; }
  start(cb) { this.intent.start(); this.cb = cb; this.alive = true; this.schedule(); }
  stop() { this.alive = false; clearTimeout(this.to); }
  schedule() { const e = C().emu, r = Math.random(); this.to = setTimeout(() => { if (!this.alive) return; this.emit(); this.schedule(); }, e.jMin + (e.jMax - e.jMin) * r * r); }
  emit() {
    const now = performance.now(), e = C().emu;
    if (now < this.burstUntil || now < this.intent.dropUntil) { this.dropped++; return; }
    if (Math.random() < e.burst) { this.burstUntil = now + 220 + Math.random() * 300; this.dropped++; return; }
    if (Math.random() < e.loss) { this.dropped++; return; }
    const [f, x] = this.intent.lvl, g = this.intent.g, gl = g ? this.intent.gl : 0, six = C().spGest === 6;
    // «обе мышцы» в словаре СПППР нет — со-сокращение классификатор видит как пронацию (так же разбирает и Ctrl)
    const L = { neutral: 3 * (1 - Math.max(f, x, gl)), flexion: 5 * f * (1 - .8 * x), extension: 5 * x * (1 - .8 * f), pronation: 9 * Math.min(f, x) - .4, supination: -.5, adduction: -.8, abduction: -.8 };
    if (g) L[g] = Math.max(L[g], 5.4 * gl);
    if (!six) { L.neutral += Math.max(0, L.pronation); L.pronation = L.supination = L.adduction = L.abduction = -2.5; } // модель обучена на 2 жеста
    for (const k in L) L[k] += gauss() * .25;
    if (Math.random() < e.misclass) { const ks = Object.keys(L); L[pick(ks)] += 4; }
    const mx = Math.max(...Object.values(L)); let sum = 0; const dist = {};
    for (const k in L) { dist[k] = Math.exp(L[k] - mx); sum += dist[k]; }
    for (const k in dist) dist[k] = +(dist[k] / sum).toFixed(3);
    this.sent++;
    this.cb(JSON.stringify({ timestamp_ms: this.boot + Math.round(now - this.t0), dist }));
  }
}

/* =====================================================================
   ControlProcessor — нормализация, усиление (чувствительность), EMA + slew,
   dead-zone, пороги с гистерезисом, подавление ложных, 4 состояния, метрики.
   ===================================================================== */
/* словарь СПППР (7 состояний) */
const SP_ALL = ['neutral', 'flexion', 'extension', 'pronation', 'supination', 'adduction', 'abduction'];
const SPN = { neutral: 'Нейтраль', flexion: 'Сгибание', extension: 'Разгибание', pronation: 'Пронация', supination: 'Супинация', adduction: 'Приведение', abduction: 'Отведение' };
const zeroP = () => Object.fromEntries(SP_ALL.map(k => [k, 0]));
const LOSS_SOFT = 200, LOSS_CRIT = 1500; // мс: > 200 — гасим скорость (инерция), > 1.5 с — критическая потеря, игра встаёт на паузу
/* порог в шкале игры (после калибровки, чувствительности и dead-zone) ↔ амплитуда датчика 0…255 */
function thrToRaw(i) {
  const c = C(), k = S.calib, dz = c.deadzone, base = k['base' + (i + 1)], span = Math.max(.08, k['mvc' + (i + 1)] - base);
  const n = c['thr' + (i + 1)] * (1 - dz) + dz;
  return Math.round(clamp(n / Ctrl.gainK(i + 1) * span + base) * 255);
}
function rawToThr(i, raw) {
  const c = C(), k = S.calib, dz = c.deadzone, base = k['base' + (i + 1)], span = Math.max(.08, k['mvc' + (i + 1)] - base);
  const n = (raw / 255 - base) / span * Ctrl.gainK(i + 1);
  return +clamp((n - dz) / (1 - dz), .08, .95).toFixed(3);
}
const Ctrl = {
  a: [0, 0], s: [0, 0], raw: [0, 0], nRaw: [0, 0], on: [false, false], onT: [0, 0], lastEmg: 0, rate: 0, nS: 0, rateT: 0,
  state: 'REST', cand: 'REST', candT: 0, stateT: 0, lastT: 0, rawCand: 'REST', rawCandT: 0, lat: [], m: null,
  p: zeroP(), tp: null, lastTs: null, lastArr: 0, pktDt: .05, pkts: 0, bad: 0, lossFlag: false, lost: false, lastTick: 0,
  g: 'neutral', gCand: 'neutral', gCandT: 0, gCandPk: 0, devThr: null,
  external: false, src: null,
  restart() {
    this.src?.stop(); this.src = null;
    const was = this.state, wasLost = this.lost;
    Object.assign(this, { a: [0, 0], s: [0, 0], raw: [0, 0], nRaw: [0, 0], on: [false, false], state: 'REST', cand: 'REST', tp: null, lastTs: null, p: zeroP(), pkts: 0, bad: 0, lat: [], lastEmg: 0, lastArr: 0, lossFlag: false, lost: false, rate: 0, nS: 0, rateT: 0, g: 'neutral', gCand: 'neutral' });
    if (was !== 'REST') Bus.emit('state', { state: 'REST', prev: was, t: performance.now() });
    if (wasLost) Bus.emit('signal:back');
    if (this.external) return;
    this.src = createSource(C().mode);
    this.src.start(C().mode === 'emg' ? s => this.pushEmg(s) : j => this.pushSpppr(j));
  },
  gainK: i => C()['gain' + i] / 10, // чувствительность 1..20 → множитель 0.1..2.0
  /* доступно ли «обе мышцы» как отдельное действие 3: в ЭМГ — только в режиме 'both', в СПППР — на словаре из 6 жестов (пронация) */
  bothOK: () => C().mode === 'spppr' ? C().spGest === 6 : C().coMode === 'both',
  /* жесты СПППР, на которых обучена модель (без нейтрали) */
  spSet: () => C().spGest === 6 ? SP_ALL.slice(1) : ['flexion', 'extension'],
  resetMetrics() { this.m = { active: 0, leak: 0, t1: 0, t2: 0, tb: 0, n1: 0, n2: 0, peaks: [[], []], pk: 0, gest: {} }; },
  remote: false,
  source: () => Ctrl.remote ? 'пульт по сети' : Ctrl.external ? 'внешний источник' : BT.streaming() ? 'протез (Bluetooth)' : 'эмулятор',
  clean() { return !this.m || this.m.active < .2 ? 1 : clamp(1 - this.m.leak / this.m.active); },
  latency() { return this.lat.length ? this.lat.reduce((a, b) => a + b, 0) / this.lat.length : 0; },
  /* доля работы К1 среди изолированных активаций: 0.5 — каналы нагружены поровну */
  balance() { const m = this.m; if (!m) return null; if (m.t1 + m.t2 >= 1.5) return m.t1 / (m.t1 + m.t2); const n = m.n1 + m.n2; return n >= 4 ? m.n1 / n : null; }, // короткие импульсы — по числу активаций
  /* утомление: насколько пиковая амплитуда последней трети сокращений ниже первой трети (по худшему каналу) */
  fatigue() {
    const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
    const r = [0, 1].map(i => { const p = this.m?.peaks[i] || []; if (p.length < 6) return null; const k = Math.floor(p.length / 3); return 1 - avg(p.slice(-k)) / Math.max(.05, avg(p.slice(0, k))); }).filter(x => x != null);
    return r.length ? clamp(Math.max(...r), 0, 1) : null;
  },
  /* пороги от протеза (0…255): в режиме thrSrc='device' игра пользуется ими напрямую */
  setDevThr(t) {
    const v = t.map(x => Math.round(clamp(+x, 0, 255)));
    if (this.devThr && v[0] === this.devThr[0] && v[1] === this.devThr[1]) return;
    this.devThr = v; C().devThr = v.slice(); this.applyDevThr(); Bus.emit('thr:device', v);
  },
  applyDevThr() { const c = C(); if (c.thrSrc !== 'device' || !this.devThr) return; c.thr1 = rawToThr(0, this.devThr[0]); c.thr2 = rawToThr(1, this.devThr[1]); },
  /* Поток 1. Основной формат: {timestamp_ms, emg:[0…255, 0…255], thr:[0…255, 0…255]}; совместимость: {ch1, ch2} в 0…1 */
  pushEmg(smp) {
    if (C().mode !== 'emg' || !smp) return;
    let a, b;
    if (Array.isArray(smp.emg)) { a = +smp.emg[0] / 255; b = +smp.emg[1] / 255; } else { a = +smp.ch1; b = +smp.ch2; }
    if (!Number.isFinite(a) || !Number.isFinite(b)) { this.bad++; return; }
    if (Array.isArray(smp.thr) && smp.thr.length === 2 && smp.thr.every(x => Number.isFinite(+x))) this.setDevThr(smp.thr);
    const c = C(), k = S.calib, t = performance.now();
    this.raw = [clamp(a), clamp(b)]; this.lastEmg = t; this.lossFlag = false; this.nS++; if (!this.rateT) this.rateT = t;
    if (t - this.rateT > 1000) { this.rate = Math.round(this.nS * 1000 / (t - this.rateT || 1000)); this.nS = 0; this.rateT = t; }
    const n = [0, 1].map(i => clamp((this.raw[i] - k['base' + (i + 1)]) / Math.max(.08, k['mvc' + (i + 1)] - k['base' + (i + 1)]) * this.gainK(i + 1)));
    this.nRaw = n;
    const al = 1 - c.smoothing;
    this.s = this.s.map((s, i) => { const x = s + (n[i] - s) * al; return s + clamp(x - s, -c.slew, c.slew); });
    this.evaluate(this.s[0], this.s[1], null, t);
  },
  /* Поток 2: {timestamp_ms, dist:{neutral…abduction}} — строка JSON или объект */
  pushSpppr(input) {
    if (C().mode !== 'spppr') return;
    let p = input;
    if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { this.bad++; return; } }
    if (!p || typeof p.timestamp_ms !== 'number' || !p.dist || typeof p.dist !== 'object') { this.bad++; return; }
    // timestamp_ms — часы микроконтроллера: используем только разницу между пакетами, повторы и «назад во времени» отбрасываем
    if (this.lastTs != null) { const dt = p.timestamp_ms - this.lastTs; if (dt <= 0) { this.bad++; return; } this.pktDt = Math.min(dt, 300) / 1000; }
    this.lastTs = p.timestamp_ms; this.lastArr = performance.now(); this.pkts++; this.lastPkt = p;
    const d = p.dist, tp = zeroP(); let sum = 0;
    for (const k of SP_ALL) { const v = +d[k]; tp[k] = Number.isFinite(v) && v > 0 ? v : 0; sum += tp[k]; }
    if (sum > 0) for (const k of SP_ALL) tp[k] /= sum; else tp.neutral = 1;
    if (C().spGest !== 6) { for (const k of SP_KEYS) { tp.neutral += tp[k]; tp[k] = 0; } } // модель на 2 жеста: прочие классы — нейтраль
    this.tp = tp;
  },
  tick(now) {
    // сторож связи для обоих потоков: > 200 мс — инерция к покою, > 1.5 с — критическая потеря (signal:lost), возврат — signal:back
    const last = C().mode === 'emg' ? this.lastEmg : this.lastArr;
    if (last) {
      const gap = now - last;
      if (gap > LOSS_CRIT && !this.lost) { this.lost = true; Bus.emit('signal:lost', { gap }); }
      else if (gap < LOSS_SOFT && this.lost) { this.lost = false; Bus.emit('signal:back'); }
    }
    if (C().mode === 'emg') {
      if (this.lastEmg && now - this.lastEmg > LOSS_SOFT) { this.lossFlag = true; this.s = this.s.map(v => v * .8); this.nRaw = [0, 0]; this.evaluate(this.s[0], this.s[1], null, now); }
      return;
    }
    if (!this.tp) return;
    const dt = Math.min(.1, (now - (this.lastTick || now)) / 1000); this.lastTick = now;
    this.lossFlag = now - this.lastArr > LOSS_SOFT;
    if (this.lossFlag) { const k = Math.exp(-dt / .18); for (const key in this.tp) if (key !== 'neutral') this.tp[key] *= k; }
    // интерполяция между пакетами: постоянная времени = фактический интервал по часам МК (джиттер 10…100+ мс без рывков)
    const tau = clamp(this.pktDt, .03, .12), f = 1 - Math.exp(-dt / tau);
    for (const key of SP_ALL) this.p[key] += (this.tp[key] - this.p[key]) * f;
    this.stableGesture(now);
    const map = (v, i) => clamp((v - .12) / .7 * this.gainK(i));
    this.nRaw = [map(this.tp.flexion, 1), map(this.tp.extension, 2)];
    this.evaluate(map(this.p.flexion, 1), map(this.p.extension, 2), C().spGest === 6 && this.p.pronation > C().bothThr, now);
  },
  /* устойчивый жест СПППР: единичная ошибка классификации прощается — новый жест принимается, если держится ≥ 2 пакетов и ≥ 120 мс */
  stableGesture(now) {
    let best = 'neutral', bv = .4;
    for (const k of this.spSet()) if (this.p[k] > bv) { bv = this.p[k]; best = k; }
    if (best === this.g) { this.gCand = best; return; }
    if (best !== this.gCand) { this.gCand = best; this.gCandT = now; this.gCandPk = this.pkts; return; }
    if (now - this.gCandT >= 120 && this.pkts - this.gCandPk >= 2) {
      const prev = this.g; this.g = best;
      if (this.m && best !== 'neutral') this.m.gest[best] = (this.m.gest[best] || 0) + 1;
      Bus.emit('sp:gesture', { g: best, prev, t: now });
    }
  },
  evaluate(v1, v2, bothFlag, t) {
    const c = C(), dz = c.deadzone, f = x => x < dz ? 0 : (x - dz) / (1 - dz), thr = [c.thr1, c.thr2];
    this.a = [f(v1), f(v2)];
    for (let i = 0; i < 2; i++) { const was = this.on[i]; this.on[i] = was ? this.a[i] > thr[i] * c.hyst : this.a[i] > thr[i]; if (this.on[i] && !was) this.onT[i] = t; }
    // одновременная активация: 'both' — отдельное состояние, 'classic' — первый сигнал держит, 'sport' — последний перехватывает
    const pickBoth = (on0, on1, cur, a0, a1, t0, t1) => {
      if (!(on0 && on1)) return on0 ? 'CH1' : on1 ? 'CH2' : 'REST';
      if (c.coMode === 'classic') return cur === 'CH1' || cur === 'CH2' ? cur : a0 >= a1 ? 'CH1' : 'CH2';
      if (c.coMode === 'sport') return t1 > t0 ? 'CH2' : 'CH1';
      return 'BOTH';
    };
    const cand = bothFlag != null ? (bothFlag ? 'BOTH' : this.on[0] ? 'CH1' : this.on[1] ? 'CH2' : 'REST')
      : pickBoth(this.on[0], this.on[1], this.cand, this.a[0], this.a[1], this.onT[0], this.onT[1]);
    const r = this.nRaw.map(f), rc = bothFlag != null ? (bothFlag ? 'BOTH' : r[0] > thr[0] ? 'CH1' : r[1] > thr[1] ? 'CH2' : 'REST')
      : pickBoth(r[0] > thr[0], r[1] > thr[1], this.rawCand, r[0], r[1], this.onT[0], this.onT[1]);
    if (rc !== this.rawCand) { this.rawCand = rc; this.rawCandT = bothFlag != null ? this.lastArr : t; }
    if (cand !== this.cand) { this.cand = cand; this.candT = t; }
    if (cand !== this.state && t - this.candT >= c.suppressMs) {
      const prev = this.state; this.state = cand; this.stateT = t;
      if (cand === this.rawCand && this.rawCandT) { this.lat.push(t - this.rawCandT); if (this.lat.length > 40) this.lat.shift(); this.rawCandT = 0; }
      if (this.m) {
        if (prev === 'CH1' || prev === 'CH2') this.m.peaks[prev === 'CH1' ? 0 : 1].push(this.m.pk);
        if (cand === 'CH1') this.m.n1++; else if (cand === 'CH2') this.m.n2++;
        this.m.pk = 0;
      }
      Bus.emit('state', { state: cand, prev, t });
    }
    const dt = this.lastT ? Math.min(.1, (t - this.lastT) / 1000) : 0; this.lastT = t;
    if (this.m) {
      const st = this.state;
      if (st === 'CH1' || st === 'CH2') {
        const w = st === 'CH1' ? 0 : 1, o = 1 - w, leak = this.a[o] > thr[o] * .5;
        this.m.active += dt; if (leak) this.m.leak += dt;
        this.m['t' + (w + 1)] += dt; this.m.pk = Math.max(this.m.pk, this.a[w]);
      } else if (st === 'BOTH') this.m.tb += dt;
    }
  }
};
const ST = {
  REST: { n: 'Покой', hex: '#C8BAAE' },
  CH1: { n: 'Закрытие', hex: '#EE7A45' },
  CH2: { n: 'Открытие', hex: '#3E9FD6' },
  BOTH: { n: 'Обе мышцы', hex: '#9B78E8' }
};

/* =====================================================================
   Модель протеза: пропорциональное сжатие активного жеста.
   К1 — закрыть, К2 — открыть, «обе мышцы» ≥ switchMs — следующий жест в ротации.
   ===================================================================== */
const Prosthesis = {
  grip: 0, pose: [0, 0, 0, 0, 0, 0], locked: false, closedCounted: false, bothSince: 0, switched: false, override: null,
  get gesture() { return G(S.activeId) || S.gestures[0]; },
  update(dt, now) {
    const c = C(), st = Ctrl.state;
    // в игре, калибровке и редакторе сигнал управляет сценой, а не протезом: кисть не сжимается сама и захваты не накручиваются
    if (this.locked) { /* поза держится */ }
    else if (st === 'CH1') this.grip += c.speed * dt * (.35 + Ctrl.a[0]);
    else if (st === 'CH2') this.grip -= c.speed * dt * (.35 + Ctrl.a[1]);
    this.grip = clamp(this.grip);
    if (st === 'BOTH') {
      if (!this.bothSince) this.bothSince = now;
      if (!this.switched && now - this.bothSince > c.switchMs && now - (this.lastSwitch || 0) > 900 && !this.locked) { this.switched = true; this.lastSwitch = now; this.next(); }
    } else { this.bothSince = 0; this.switched = false; }
    if (this.grip > .85 && !this.closedCounted) { this.closedCounted = true; countGesture(this.gesture.id); }
    if (this.grip < .3) this.closedCounted = false;
    const g = this.gesture, src = this.override;
    for (let i = 0; i < 6; i++) {
      const target = src ? src[i] : lerp(g.open[i], g.closed[i], this.grip);
      this.pose[i] += (target - this.pose[i]) * Math.min(1, dt * 14);
    }
  },
  setActive(id, silent) {
    const g = G(id); if (!g) return; S.activeId = id; this.grip = 0; save();
    BT.send({ cmd: 'gesture', id, open: g.open, closed: g.closed });
    if (!silent) Bus.emit('gesture', id);
  },
  /* ручная команда: 'open' | 'close' | поза из редактора; true — ушла на реальный протез */
  async command(kind, pose) {
    if (kind === 'pose') { this.override = pose.slice(); clearTimeout(this.ovT); this.ovT = setTimeout(() => this.override = null, 3000); return BT.send({ cmd: 'pose', pose }); }
    this.grip = kind === 'close' ? 1 : 0; return BT.send({ cmd: 'grip', value: this.grip });
  },
  next() {
    const r = S.rotation.filter(G); if (!r.length) return;
    const i = r.indexOf(S.activeId), nx = r[(i + 1) % r.length];
    this.setActive(nx); Snd.swap(); Bus.emit('switch', nx);
    toast('swap', 'Жест: ' + G(nx).name, 'Переключено со-сокращением');
  }
};
function countGesture(id) {
  const d = today(); d.gest[id] = (d.gest[id] || 0) + 1; d.acts++;
  S.stats.gestTotal[id] = (S.stats.gestTotal[id] || 0) + 1; S.stats.gestLive = (S.stats.gestLive || 0) + 1; save();
  Bus.emit('gesture:count', id);
}

/* =====================================================================
   BLE-ПРОТЕЗ (Web Bluetooth: Chrome / Edge / Android, https или localhost)
   Профиль протокола (S.cfg.ble) задаёт производитель протеза:
     service  — UUID сервиса с ЭМГ / СПППР          (пусто — только заряд и паспорт)
     emgChar  — характеристика notify с сигналом
     cmdChar  — характеристика write для команд протезу (необязательно)
     format   — u16le2 | u8x2 | f32le2 | json       (см. BLE_FORMATS)
     fullScale— максимум АЦП для нормализации целочисленных форматов
     namePrefix — фильтр устройств в окне выбора
   Пока сервис не задан, с протеза читаются заряд и паспорт, а сигнал идёт
   с эмулятора — приложение остаётся рабочим.
   ===================================================================== */
const BLE_DEFAULT = { namePrefix: '', service: '', emgChar: '', cmdChar: '', format: 'u16le2', fullScale: 4095 };
const BLE_FORMATS = {
  // пары каналов подряд; в одном уведомлении может быть несколько пар
  u16le2: (dv, fs) => { const o = []; for (let i = 0; i + 4 <= dv.byteLength; i += 4) o.push([dv.getUint16(i, true) / fs, dv.getUint16(i + 2, true) / fs]); return o; },
  u8x2: (dv, fs) => { const o = []; for (let i = 0; i + 2 <= dv.byteLength; i += 2) o.push([dv.getUint8(i) / fs, dv.getUint8(i + 1) / fs]); return o; },
  f32le2: dv => { const o = []; for (let i = 0; i + 8 <= dv.byteLength; i += 8) o.push([dv.getFloat32(i, true), dv.getFloat32(i + 4, true)]); return o; }
};
/* '0xFFE0' / 'ffe0' → 0xffe0, полный UUID → строка, имя GATT ('battery_service') → как есть */
function normUuid(s) {
  s = String(s || '').trim().toLowerCase(); if (!s) return null;
  if (/^(0x)?[0-9a-f]{4,8}$/.test(s)) return parseInt(s.replace(/^0x/, ''), 16);
  return s;
}
const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

/* Драйвер сигнала с протеза — тот же контракт, что у эмуляторов: start(cb) / stop() */
class BleProsthesisDriver {
  constructor(mode) { this.mode = mode; this.buf = ''; this.onVal = e => this.handle(e.target.value); }
  async start(cb) {
    this.cb = cb; const ch = this.ch = BT.emgChar; if (!ch) return; // своя ссылка: при обрыве BT.emgChar обнуляется раньше stop()
    ch.addEventListener('characteristicvaluechanged', this.onVal);
    try { await ch.startNotifications(); } catch (e) { console.warn('[BLE] уведомления ЭМГ недоступны', e); }
  }
  stop() { const ch = this.ch; this.ch = null; if (!ch) return; ch.removeEventListener('characteristicvaluechanged', this.onVal); if (BT.server) ch.stopNotifications?.().catch(() => { }); }
  handle(dv) {
    const p = C().ble, now = Math.round(performance.now());
    if (p.format === 'json') { // JSON может прийти кусками (MTU 20 байт) — собираем по строкам или по балансу скобок
      this.buf = (this.buf + new TextDecoder().decode(dv)).slice(-4096);
      let i; while ((i = this.jsonEnd(this.buf)) > 0) { const part = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i); if (part) this.emitJson(part, now); }
      return;
    }
    const parse = BLE_FORMATS[p.format] || BLE_FORMATS.u16le2, fs = +p.fullScale || 4095;
    for (const [a, b] of parse(dv, fs)) this.cb({ timestamp_ms: now, ch1: clamp(a), ch2: clamp(b) });
  }
  jsonEnd(s) { const nl = s.indexOf('\n'); if (nl >= 0) return nl + 1; let d = 0, st = s.indexOf('{'); if (st < 0) return 0; for (let k = st; k < s.length; k++) { if (s[k] === '{') d++; else if (s[k] === '}' && !--d) return k + 1; } return 0; }
  emitJson(txt, now) {
    let o; try { o = JSON.parse(txt); } catch (e) { Ctrl.bad++; return; }
    if (this.mode === 'spppr') { if (o.dist) this.cb(o); }
    else if (o && Array.isArray(o.emg)) this.cb({ timestamp_ms: o.timestamp_ms ?? now, emg: o.emg, thr: o.thr });
    else if (o && o.ch1 != null) this.cb({ timestamp_ms: o.timestamp_ms ?? now, ch1: clamp(+o.ch1), ch2: clamp(+o.ch2) });
  }
}
/* Единственная точка выбора источника: протез по BLE, если настроен и на связи, иначе эмулятор */
const createSource = mode => BT.streaming() ? new BleProsthesisDriver(mode) : mode === 'emg' ? new EmgEmulator(Intent) : new SppprEmulator(Intent);

const BT = {
  device: null, server: null, emgChar: null, cmdChar: null, state: 'idle', manual: false, retry: 0, retryT: 0,
  supported: () => !!(navigator.bluetooth && window.isSecureContext),
  streaming() { return !!(S.device.real && S.device.connected && this.emgChar); },
  services() { const p = C().ble, s = normUuid(p.service); return ['battery_service', 'device_information', ...(s ? [s] : [])]; },
  /* окно выбора устройства → подключение */
  async request() {
    const p = C().ble, opt = { optionalServices: this.services() };
    if (p.namePrefix) opt.filters = [{ namePrefix: p.namePrefix }]; else opt.acceptAllDevices = true;
    const dev = await navigator.bluetooth.requestDevice(opt);
    this.attach(dev); return this.connect();
  },
  attach(dev) {
    if (this.device && this.device !== dev) { // выбран другой протез — старый отключаем без автопереподключения
      this.device.removeEventListener('gattserverdisconnected', this.onDisc);
      try { if (this.device.gatt?.connected) this.device.gatt.disconnect(); } catch (e) { }
    }
    this.device = dev; dev.addEventListener('gattserverdisconnected', this.onDisc);
    S.device.id = dev.id; S.device.name = dev.name || 'Протез';
  },
  onDisc: () => BT.handleDisconnect(),
  connect() { // одно подключение за раз: автопереподключение и нажатие пользователя не мешают друг другу
    if (!this.pending) this.pending = this.doConnect().finally(() => this.pending = null);
    return this.pending;
  },
  async doConnect() {
    const dev = this.device; if (!dev) throw new Error('Устройство не выбрано');
    this.setState('connecting'); clearTimeout(this.retryT);
    try { this.server = await withTimeout(dev.gatt.connect(), 12000, 'Протез не отвечает'); }
    catch (e) { this.setState(S.device.connected ? 'connected' : 'idle'); throw e; }
    this.manual = false; this.retry = 0;
    Object.assign(S.device, { real: true, connected: true, lastSeen: Date.now(), battery: null }); S.perms.bt = 'granted'; // заряд — только если протез его сообщает
    await this.readBattery(); await this.readInfo(); await this.findSignal();
    save(); this.setState('connected'); Ctrl.restart();
    if (S.perms.geo === 'granted') Geo.request().catch(() => { }); // «Где мой протез» — место последнего подключения
    return { name: S.device.name, battery: S.device.battery };
  },
  async readBattery() {
    try {
      const ch = await (await this.server.getPrimaryService('battery_service')).getCharacteristic('battery_level');
      S.device.battery = (await ch.readValue()).getUint8(0);
      ch.addEventListener('characteristicvaluechanged', e => { S.device.battery = e.target.value.getUint8(0); save(); Bus.emit('battery', S.device.battery); });
      await ch.startNotifications().catch(() => { });
    } catch (e) { /* у протеза нет стандартного сервиса заряда */ }
  },
  async readInfo() {
    S.device.info = null;
    try {
      const s = await this.server.getPrimaryService('device_information'), dec = new TextDecoder();
      const rd = async n => { try { return dec.decode(await (await s.getCharacteristic(n)).readValue()).replace(/\0/g, '').trim() || null; } catch (e) { return null; } };
      S.device.info = { maker: await rd('manufacturer_name_string'), model: await rd('model_number_string'), serial: await rd('serial_number_string'), fw: await rd('firmware_revision_string'), hw: await rd('hardware_revision_string') };
    } catch (e) { /* нет Device Information Service */ }
  },
  async findSignal() {
    this.emgChar = this.cmdChar = null; const p = C().ble, sid = normUuid(p.service); if (!sid) return;
    try {
      const s = await this.server.getPrimaryService(sid);
      if (p.emgChar) this.emgChar = await s.getCharacteristic(normUuid(p.emgChar));
      if (p.cmdChar) this.cmdChar = await s.getCharacteristic(normUuid(p.cmdChar)).catch(() => null);
    } catch (e) { console.warn('[BLE] сервис сигнала не найден — проверьте профиль протокола', e); }
  },
  handleDisconnect() {
    this.server = this.emgChar = this.cmdChar = null;
    const was = S.device.connected; S.device.connected = false; save(); Ctrl.restart();
    if (this.manual) { this.setState('idle'); return; }
    if (was) Bus.emit('device:lost');
    this.retry = 0; this.scheduleRetry();
  },
  scheduleRetry() {
    clearTimeout(this.retryT);
    if (this.retry >= 6) { this.setState('lost'); toast('bt', 'Связь с протезом потеряна', 'Проверьте питание и подключите снова'); return; }
    this.setState('reconnecting');
    this.retryT = setTimeout(() => this.connect().then(() => { toast('bt', 'Протез снова на связи', S.device.name); Bus.emit('device:back'); }).catch(() => this.scheduleRetry()), Math.min(16000, 1000 * 2 ** this.retry++));
  },
  /* после перезагрузки страницы: подключаемся к уже разрешённому протезу без окна выбора */
  async restore() {
    if (!S.device.real || !this.supported() || !navigator.bluetooth.getDevices) return false;
    try {
      const list = await navigator.bluetooth.getDevices(), dev = list.find(d => d.id === S.device.id) || list.find(d => d.name === S.device.name);
      if (!dev) return false; this.attach(dev); await this.connect(); return true;
    } catch (e) { return false; }
  },
  /* команда протезу (протокол производителя; по умолчанию — строка JSON) */
  async send(cmd) {
    if (!this.cmdChar) return false;
    try {
      const data = new TextEncoder().encode(JSON.stringify(cmd) + '\n'), ch = this.cmdChar;
      await (ch.writeValueWithResponse ? ch.writeValueWithResponse(data) : ch.writeValue(data)); return true;
    } catch (e) { console.warn('[BLE] команда не отправлена', e); return false; }
  },
  setState(s) { this.state = s; Bus.emit('device', s); },
  connectDemo(name) { this.disconnect(true); Object.assign(S.device, { name, real: false, connected: true, lastSeen: Date.now(), info: null, battery: S.device.battery ?? 82 }); S.perms.bt = 'demo'; save(); this.setState('connected'); },
  disconnect(silent) {
    this.manual = true; clearTimeout(this.retryT);
    try { if (this.device?.gatt?.connected) this.device.gatt.disconnect(); } catch (e) { }
    this.server = this.emgChar = this.cmdChar = null;
    if (!silent) { S.device.connected = false; save(); this.setState('idle'); Ctrl.restart(); }
  }
};

const Geo = {
  supported: () => 'geolocation' in navigator,
  request() {
    return new Promise((res, rej) => {
      if (!this.supported()) return rej(new Error('Геолокация недоступна'));
      navigator.geolocation.getCurrentPosition(p => {
        S.geo = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy), t: Date.now() };
        S.perms.geo = 'granted'; save(); Bus.emit('geo'); res(S.geo);
      }, e => { S.perms.geo = 'denied'; save(); rej(e); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  },
  // Крупные города (координаты реальных городов) — для подсказки «ближайший город».
  CITIES: [['Москва', 55.7558, 37.6173], ['Санкт-Петербург', 59.9343, 30.3351], ['Казань', 55.7963, 49.1088], ['Екатеринбург', 56.8389, 60.6057], ['Новосибирск', 55.0084, 82.9357], ['Нижний Новгород', 56.2965, 43.9361], ['Краснодар', 45.0355, 38.9753], ['Самара', 53.1959, 50.1002], ['Ростов-на-Дону', 47.2357, 39.7015], ['Владивосток', 43.1155, 131.8855]],
  dist(a, b, c, d) { const R = 6371, r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); },
  nearest() { if (!S.geo) return null; return this.CITIES.map(([n, la, lo]) => ({ n, km: this.dist(S.geo.lat, S.geo.lon, la, lo) })).sort((a, b) => a.km - b.km)[0]; }
};
