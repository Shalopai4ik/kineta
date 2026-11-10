// Стресс-тест в headless Chrome: «обезьяна» + фаззинг входов.
//   1) повреждённые и чужие сохранения в localStorage — приложение стартует;
//   2) deep link и postMessage с мусором, попытка javascript: в return — без исключений и без выполнения кода;
//   3) мусорные пакеты потоков 1 и 2;
//   4) случайные настоящие нажатия мышью / клавиши F и J / Escape по всем экранам (по умолчанию 700 действий).
//   node tests/e2e/monkey.mjs [действий] [зерно]
import { launch, sleep } from './cdp.mjs';

const N = +process.argv[2] || 700, SEED = +process.argv[3] || 20261110;
let seed = SEED; const R = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296); const pickR = a => a[Math.floor(R() * a.length)];
const { js, shot, size, go, tap, key, step, errors, report } = await launch();
const ready = () => js('!!(typeof App !== "undefined" && App.cur && App.cur.el && document.body.contains(App.cur.el))');

/* ---------- 1. сохранения ---------- */
const BROKEN = [
  '{не json', 'null', '[]', '"строка"', '42', '{}',
  JSON.stringify({ onboarded: true, cfg: null, games: 5, history: {}, profile: null, stats: null, gestures: [{}], rotation: 'x', workshop: null, weekly: null, missions: 'x', ach: null, calib: null, device: null, perms: null }),
  JSON.stringify({ onboarded: true, cfg: { mode: 'xyz', theme: 'neon', handPal: 'нет', thr1: 'abc', gain1: -5, emu: null, ble: 7, sessionMin: 0 }, games: { race: { ls: 'x', best: null, ghost: { 1: { T: 'a', d: 5 } } }, flap: null }, history: [null, 5, { t: 'x' }] }),
  JSON.stringify({ onboarded: true, stats: { days: { '2026-01-01': null, bad: { min: 'x' } }, gestTotal: null }, profile: { xp: 'много', streak: null, name: '<img src=x onerror=alert(1)>' }, missions: { day: 'x', list: null } }),
];
for (const [i, raw] of BROKEN.entries()) {
  await step(`Сохранение №${i + 1} (${raw.slice(0, 40)}) — приложение стартует`, async () => {
    await go('?reset=1', 1500);
    await js(`localStorage.setItem('kineta.app.v2', ${JSON.stringify(raw)})`);
    await go('', 2600);
    if (!(await ready())) throw new Error('приложение не открылось');
    for (const t of ['home', 'games', 'progress', 'profile', 'gestures', 'sensors', 'achievements']) { await js(`App.go('${t}', {}, { force: true })`); await sleep(350); if (!(await ready())) throw new Error('экран ' + t); }
  });
}

/* ---------- 2. deep link и postMessage ---------- */
await go('?reset=1', 1500); await js('S.onboarded = true; S.perms.bt = "demo"; C().quickCal = false; save(true)');
const LINKS = ['?screen=__proto__', '?screen=constructor', '?screen=toString', '?screen=нет', '?screen=race&diff=999', '?screen=flap&diff=-5', '?screen=fish&diff=abc',
  '?thr1=abc&thr2=1e999', '?thr1=-50&thr2=900', '?gain1=NaN&gain2=Infinity', '?gestures=99', '?mode=zzz', '?hand=up', '?source=external&mode=spppr', '?embed=1&screen=mug'];
for (const q of LINKS) {
  await step(`Deep link ${q}`, async () => { await go(q, 2200); if (!(await ready())) throw new Error('приложение не открылось'); await js('KinetaTrainer.useEmulator(); App.go("home", {}, { force: true })'); await sleep(300); });
}
await step('Deep link: return=javascript: не выполняет код', async () => {
  for (const r of ['javascript:window.__pwn=1', 'JaVaScRiPt:window.__pwn=1', ' javascript:window.__pwn=1', 'data:text/html,<script>parent.__pwn=1</script>', 'vbscript:x']) {
    await go('?return=' + encodeURIComponent(r) + '&host=test', 1800);
    await js('KinetaTrainer.finishSession()'); await sleep(400);
    if (await js('window.__pwn === 1')) throw new Error('выполнен код из return: ' + r);
    if (!(await js('location.protocol.startsWith("http")'))) throw new Error('ушли со страницы на ' + r);
  }
});
await step('Deep link: return=https и kineta:// принимаются', async () => {
  await go('?return=' + encodeURIComponent('https://example.org/back?x=1'), 1500);
  const ok = await js('Host.safeReturn ? Host.safeReturn(Host.ret) : true'); if (!ok) throw new Error('https отклонён');
  const ok2 = await js('Host.safeReturn ? Host.safeReturn("vendorapp://done") : true'); if (!ok2) throw new Error('схема приложения отклонена');
  await go('?reset=1', 1200); await js('S.onboarded = true; S.perms.bt = "demo"; C().quickCal = false; save(true)'); await go('', 2200);
});
await step('postMessage с мусором', async () => {
  const msgs = [null, 5, 'x', { type: 'kineta:emg' }, { type: 'kineta:emg', payload: null }, { type: 'kineta:emg', payload: { emg: 'ab' } }, { type: 'kineta:emg', payload: { emg: [1e9, -1e9], thr: [NaN, 'x'] } },
    { type: 'kineta:spppr', payload: 'null' }, { type: 'kineta:spppr', payload: '{"timestamp_ms":1,"dist":null}' }, { type: 'kineta:spppr', payload: { timestamp_ms: 2, dist: { flexion: Infinity, neutral: -1 } } },
    { type: 'kineta:open', payload: '__proto__' }, { type: 'kineta:open', payload: 'constructor' }, { type: 'kineta:open', payload: 42 }, { type: 'kineta:open' },
    { type: 'kineta:config', payload: null }, { type: 'kineta:config', payload: { thr1: 'x', mode: 'emg' } }, { type: 'kineta:config', payload: { __proto__: { polluted: 1 } } }, { type: 'kineta:ble', payload: 'x' }, { type: 'kineta:external', payload: 'zzz' }];
  for (const m of msgs) { await js(`window.postMessage(${JSON.stringify(m)}, '*')`); await sleep(60); }
  await js(`window.postMessage({ type: 'kineta:config', payload: JSON.parse('{"__proto__": {"polluted": 1}}') }, '*')`); await sleep(100);
  if (await js('({}).polluted === 1')) throw new Error('загрязнение прототипа через kineta:config');
  await sleep(500); if (!(await ready())) throw new Error('приложение упало');
  await js('KinetaTrainer.useEmulator(); C().mode = "emg"; App.go("home", {}, { force: true })'); await sleep(400);
});

/* ---------- 3. пакеты ---------- */
await step('Мусорные пакеты потоков 1 и 2', async () => {
  await js(`(() => { const E = [null, undefined, 0, '', 'x', [], {}, { emg: null }, { emg: [] }, { emg: [NaN, 1] }, { emg: ['1', '2'], thr: [1] }, { ch1: 'a', ch2: 2 }, { ch1: Infinity, ch2: 0 }, { emg: [300, -20], thr: [999, -999] }];
    C().mode = 'emg'; Ctrl.external = true; Ctrl.restart(); for (const e of E) Ctrl.pushEmg(e);
    const P = [null, 'null', '[]', '{', '{"timestamp_ms":"1","dist":{}}', '{"timestamp_ms":1,"dist":"x"}', { timestamp_ms: NaN, dist: {} }, { timestamp_ms: 5, dist: { flexion: 'x', neutral: null } }, { timestamp_ms: 4, dist: {} }, { timestamp_ms: 6, dist: { flexion: 1e308, extension: 1e308 } }];
    C().mode = 'spppr'; Ctrl.restart(); for (const p of P) Ctrl.pushSpppr(p); for (let t = 0; t < 30; t++) Ctrl.tick(performance.now() + t * 16);
    for (const v of Object.values(Ctrl.p)) if (!Number.isFinite(v)) throw new Error('вероятность стала ' + v);
    if (!Ctrl.a.every(Number.isFinite)) throw new Error('активация стала NaN');
    Ctrl.external = false; C().mode = 'emg'; Ctrl.restart(); })()`);
  await js(`(() => { const d = new BleProsthesisDriver('spppr'); d.cb = () => {}; C().ble.format = 'json'; for (const s of ['null\\n', '5\\n', '{"dist":', '{}}\\n', '}}}{', '"x"\\n', '{"dist":null}\\n']) d.handle(new DataView(new TextEncoder().encode(s).buffer));
    const e = new BleProsthesisDriver('emg'); e.cb = () => {}; for (const s of ['null\\n', '{"emg":5}\\n', '{"ch1":null}\\n']) e.handle(new DataView(new TextEncoder().encode(s).buffer)); C().ble.format = 'u16le2'; })()`);
});

/* ---------- 4. обезьяна ---------- */
const CLICKABLE = `(() => {
  const vw = innerWidth, vh = innerHeight, out = [];
  for (const el of document.querySelectorAll('button, a, input, select, textarea, [data-go], [data-back], [role=button], [onclick], .sw, .card, .lrow, .chipbtn, canvas, .pad, .seg button, .grab, .scrim')) {
    const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
    const x = Math.min(vw - 2, Math.max(2, r.left + r.width * (.2 + Math.random() * .6))), y = Math.min(vh - 2, Math.max(2, r.top + r.height * (.2 + Math.random() * .6)));
    if (x < 0 || y < 0 || x > vw || y > vh) continue;
    const top = document.elementFromPoint(x, y); if (!top || !(top === el || el.contains(top) || top.contains(el))) continue;
    if (el.matches('[data-x="reset"], [data-act="reset"], #pReset, [data-reset]') && Math.random() < .9) continue; // сброс — изредка
    out.push([Math.round(x), Math.round(y), (el.id ? '#' + el.id : el.tagName.toLowerCase()) + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + ' «' + (el.innerText || el.value || '').trim().slice(0, 18) + '»']);
  }
  return out; })()`;
const SCREENS = ['home', 'gestures', 'sensors', 'games', 'progress', 'profile', 'achievements', 'calib', 'device', 'signal', 'editor', 'scan', 'perms'];
await step(`Обезьяна: ${N} случайных действий (зерно ${SEED})`, async () => {
  await go('?reset=1', 1500); await js('S.onboarded = false; save(true)'); await go('', 2600);
  const log = []; const e0 = errors.length;
  for (let i = 0; i < N; i++) {
    const r = R(); let act;
    try {
      if (r < .70) {
        const els = await js(CLICKABLE);
        if (!els?.length) { act = 'нет кнопок → назад'; await js('App.back()'); }
        else { const [x, y, d] = pickR(els); act = `тап ${d} (${x},${y})`; await tap(x, y); }
      } else if (r < .80) { const c = pickR(['KeyF', 'KeyJ']), ms = Math.floor(R() * 900); act = `держать ${c} ${ms} мс`; await key(c, true); await sleep(ms); await key(c, false); }
      else if (r < .85) { act = 'Escape'; await key('Escape', true); await key('Escape', false); }
      else if (r < .90) { const s = pickR(SCREENS); act = 'экран ' + s; await js(`App.go('${s}', {}, { force: true })`); }
      else if (r < .93) { const g = pickR(await js('Object.keys(GAMES)')), d = 1 + Math.floor(R() * 4); act = `игра ${g} ур.${d}`; await js(`KinetaTrainer.open('${g}', { diff: ${d} })`); await sleep(700); await js('App.cur?.name === "play" && SCR.play.intro && SCR.play.begin(App.cur.el)'); }
      else if (r < .95) { const m = pickR(['emg', 'spppr']); act = 'поток ' + m; await js(`C().mode = '${m}'; Ctrl.restart()`); }
      else if (r < .97) { const t = pickR(['light', 'dark', 'auto']); act = 'тема ' + t; await js(`C().theme = '${t}'; applyTheme()`); }
      else if (r < .98) { const [w, h] = pickR([[360, 740], [390, 844], [430, 932], [820, 1180], [1280, 800]]); act = `размер ${w}×${h}`; await size(w, h, w < 800); }
      else if (r < .99) { act = 'обрыв связи'; await js('Intent.drop(2000)'); }
      else { act = 'перезагрузка'; await go('', 2200); }
    } catch (e) { errors.push(`действие ${i} (${act}): ${e.message}`); }
    log.push(act); await sleep(90 + Math.floor(R() * 160));
    if (errors.length > e0) { console.log('Ошибка после действий:\n  ' + log.slice(-8).join('\n  ')); await shot('monkey-fail'); break; }
    if (!(await ready().catch(() => false))) { errors.push(`после действия ${i} (${act}) нет текущего экрана`); console.log(log.slice(-8).join('\n')); await shot('monkey-fail'); break; }
    if (i % 100 === 99) process.stdout.write(`  … ${i + 1} действий\n`);
  }
  await size(390, 844);
});

/* ---------- 5. быстрая навигация ---------- */
await step('Быстрая смена экранов и шторки', async () => {
  await js(`(async () => { for (let i = 0; i < 60; i++) { App.go(['home','games','profile','progress','gestures','sensors'][i % 6], {}, { force: true }); if (i % 7 === 0) { workshopSheet(); weeklySheet(); } if (i % 11 === 0) App.back(); await new Promise(r => setTimeout(r, 15)); } document.querySelectorAll('.sheet').forEach(s => s.close?.()); })()`);
  await sleep(800); if (!(await ready())) throw new Error('нет экрана');
  const leftovers = await js('document.querySelectorAll("#view > .page").length'); if (leftovers > 2) throw new Error('страниц в DOM: ' + leftovers);
});

report();
