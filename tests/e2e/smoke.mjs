// Сквозной прогон в headless Chrome через DevTools Protocol (без зависимостей, Node ≥ 22).
// Онбординг → все вкладки → каждая игра с ботом-эмулятором мышц (ЭМГ и СПППР) → экран результата →
// профиль, отчёт для специалиста, демо-режим, тёмная тема, планшет. Критерий: 0 исключений и 0 ошибок консоли.
//   node tests/e2e/smoke.mjs            — скриншоты в tests/e2e/out/
//   CHROME=путь node tests/e2e/smoke.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../prototype');
const out = path.join(here, 'out');
fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- статический сервер ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

/* ---------- Chrome ---------- */
const candidates = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const exe = candidates.find(p => fs.existsSync(p));
if (!exe) { console.error('Chrome не найден, задайте CHROME=путь'); process.exit(2); }
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'kineta-e2e-'));
const chrome = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
let port = null;
for (let i = 0; i < 100 && !port; i++) { await sleep(100); try { port = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch (e) { } }
if (!port) { console.error('Chrome не открыл порт отладки'); chrome.kill(); process.exit(2); }
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map(), errors = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { r, j } = pending.get(m.id); pending.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.url || '')) errors.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
};
const cdp = (method, params = {}) => new Promise((r, j) => { const i = ++id; pending.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(expr.slice(0, 80) + ' → ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
const shot = async name => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(r.data, 'base64')); };
const size = (w, h, mobile = true) => cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
const go = async (q, wait = 2600) => { await cdp('Page.navigate', { url: base + q }); await sleep(wait); };

const results = [];
const step = async (name, fn) => { const e0 = errors.length; try { await fn(); results.push([errors.length === e0 ? 'PASS' : 'FAIL', name]); } catch (e) { errors.push(name + ': ' + e.message); results.push(['FAIL', name]); } };

await cdp('Runtime.enable'); await cdp('Log.enable'); await cdp('Page.enable');
await size(390, 844);

await step('Онбординг на чистой установке, без демо-данных', async () => {
  await go('?reset=1');
  await shot('01-onboard');
  const h = await js('S.history.length + Object.keys(S.stats.days).length');
  if (h !== 0) throw new Error('у нового пользователя есть история: ' + h);
  if (await js('!!document.querySelector("#demoTag")')) throw new Error('плашка демо на чистой установке');
});
await step('Все вкладки и вложенные экраны', async () => {
  await js('S.onboarded = true; S.perms.bt = "demo"; save(true)');
  await go('');
  for (const t of ['home', 'gestures', 'sensors', 'games', 'progress', 'profile', 'achievements', 'calib', 'device']) {
    await js(`App.go(${JSON.stringify(t)}, {}, { fade: true })`).catch(() => { });
    await sleep(700); await shot('02-' + t);
  }
  if (!(await js('document.body.innerText.includes("Здесь появится ваш прогресс")') || (await js('App.cur.name')) !== 'progress')) { /* пустое состояние проверяется ниже */ }
});
await step('Прогресс без истории показывает пустое состояние', async () => {
  await js('App.go("progress", {}, { fade: true })'); await sleep(800);
  if (!(await js('document.body.innerText.includes("Здесь появится ваш прогресс")'))) throw new Error('нет пустого состояния');
});

const BOT = `(() => { clearInterval(window.__bot); let k = 0; window.__bot = setInterval(() => { k++; const p = k % 24; Intent.auto = p < 6 ? [.75, 0] : p < 12 ? [0, 0] : p < 18 ? [0, .75] : [0, 0]; }, 120); })()`;
const STOP = `clearInterval(window.__bot); Intent.auto = null;`;
await js('C().quickCal = false; save(true)');
const games = await js('Object.keys(GAMES)');
for (const mode of ['emg', 'spppr']) {
  for (const g of games) {
    await step(`Игра «${g}» (${mode}): запуск, 7 с с ботом, результат`, async () => {
      await js(`C().mode = '${mode}'; Ctrl.restart(); KinetaTrainer.open('${g}', { diff: 1 })`); await sleep(900);
      if (mode === 'emg') await shot(`03-${g}-intro`);
      await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(7000);
      if (mode === 'emg') await shot(`04-${g}-play`);
      await js(`${STOP} SCR.play.finish()`); await sleep(1500);
      if (mode === 'emg') await shot(`05-${g}-result`);
      if (await js('App.cur.name') !== 'result') throw new Error('нет экрана результата: ' + await js('App.cur.name'));
    });
  }
}
await js(`C().mode = 'emg'; Ctrl.restart();`);
await step('История записана, прогресс и отчёт для специалиста строятся', async () => {
  const n = await js('S.history.length'); if (n < games.length) throw new Error('история: ' + n);
  await js('App.go("progress", {}, { fade: true })'); await sleep(900); await shot('06-progress-after');
  const html = await js('specialistReport(30)');
  for (const s of ['Ключевые показатели', 'Чистота сигнала', 'Горячая кружка']) if (!html.includes(s)) throw new Error('в отчёте нет «' + s + '»');
  fs.writeFileSync(path.join(out, 'report.html'), html);
});
await step('Голосовые подсказки включаются без ошибок', async () => {
  await js('App.go("profile", {}, { fade: true })'); await sleep(700);
  await js('document.querySelector(\'[data-sw="voice"]\').click()'); await sleep(300);
  if (!(await js('C().voice'))) throw new Error('настройка не включилась');
  await js('Voice.hint(["Сожми (К1) до зелёной зоны", "act"], "mug")');
});
await step('Демо-режим ?demo=1: данные помечены плашкой', async () => {
  await go('?reset=1'); await js('S.onboarded = true; save(true)'); await go('?demo=1');
  await js('App.go("progress", {}, { fade: true })'); await sleep(900); await shot('07-demo-progress');
  if (!(await js('S.demo && !!document.querySelector("#demoTag")'))) throw new Error('нет плашки демо');
  if (!(await js('specialistReport(30).includes("демонстрационные данные")'))) throw new Error('отчёт не предупреждает о демо');
});
await step('Тёмная тема и планшет', async () => {
  await js('C().theme = "dark"; applyTheme(); App.go("home", {}, { fade: true })'); await sleep(800); await shot('08-dark-home');
  await js('KinetaTrainer.open("mug", { diff: 2 })'); await sleep(700); await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(3000); await shot('09-dark-mug');
  await js(STOP + ' SCR.play.finish()'); await sleep(800);
  await size(1024, 768, false); await js('C().theme = "light"; applyTheme(); App.go("games", {}, { fade: true })'); await sleep(900); await shot('10-tablet-games');
});

await step('Проверка датчиков перед игрой подстраивает калибровку', async () => {
  await size(390, 844); await js('C().theme = "light"; applyTheme(); C().quickCal = true; S.lastQC = 0; C().mode = "emg"; Ctrl.restart(); S.calib.done = true; save(true)');
  const before = await js('S.calib.mvc1');
  await js('KinetaTrainer.open("race", { diff: 1 })'); await sleep(800); await js('SCR.play.begin(App.cur.el)'); await sleep(400);
  if (!(await js('!!document.querySelector("#gQc")'))) throw new Error('нет экрана проверки');
  await shot('11-quickcal'); await sleep(1300); await js('Intent.auto = [.7, 0]'); await sleep(1800); await js('Intent.auto = [0, .7]'); await sleep(1900); await js('Intent.auto = null');
  if (await js('!!document.querySelector("#gQc")')) throw new Error('проверка не завершилась');
  if ((await js('S.calib.mvc1')) === before) throw new Error('калибровка не изменилась');
  await js(BOT); await sleep(6500); await js(STOP + ' SCR.play.finish()'); await sleep(1200);
  if (!(await js('!!document.querySelector(".emap")'))) throw new Error('нет карты игры на результате');
  await shot('12-result-map');
});
await step('Бесконечный режим: открывается после уровня 3, сложность меняется', async () => {
  await js('gst("flap").ls = [1, 1, 1]; save(true); App.go("games", {}, { fade: true })'); await sleep(700);
  await js('openGame("flap")'); await sleep(700); await js('document.querySelector(\'#lvP [data-l="4"]\').click()'); await sleep(300); await shot('13-endless-pick');
  await js('document.querySelector("#gGo").click()'); await sleep(900);
  if (!(await js('SCR.play.p.endless && SCR.play.p.diff === 3'))) throw new Error('не запустился бесконечный режим');
  await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(3500); await js(STOP + ' SCR.play.finish()'); await sleep(1200);
  if (!(await js('typeof gst("flap").adapt === "number"'))) throw new Error('сложность не записана');
  await shot('14-endless-result');
});
await step('Испытание недели и мастерская', async () => {
  await js('App.go("games", {}, { fade: true })'); await sleep(700); await js('document.querySelector("[data-weekly]").click()'); await sleep(600); await shot('15-weekly');
  await js('document.querySelector("#wGo").click()'); await sleep(900);
  if (!(await js('SCR.play.p.weekly'))) throw new Error('испытание недели не запустилось');
  await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(2500); await js(STOP + ' SCR.play.finish()'); await sleep(1200);
  if (!(await js('Weekly.cur().w.tries.length >= 1'))) throw new Error('попытка не записана');
  await js('Workshop.add("тест"); App.go("home", {}, { fade: true })'); await sleep(900);
  await js('document.querySelector("[data-ws]").scrollIntoView()'); await sleep(300); await shot('16-home-workshop');
  await js('document.querySelector("[data-ws]").click()'); await sleep(600); await shot('17-workshop');
  await js('document.querySelectorAll(".sheet").forEach(s => s.close?.())'); await sleep(400);
});
await step('Экран «Как работает сигнал» в ЭМГ и СПППР', async () => {
  await js('App.go("signal", {}, { fade: true }); Intent.auto = [.6, 0]'); await sleep(1500); await shot('18-signal-emg');
  await js('Intent.auto = null; C().mode = "spppr"; Ctrl.restart(); App.go("signal", {}, { fade: true, force: true }); Intent.auto = [0, .7]'); await sleep(1500); await shot('19-signal-spppr');
  await js('Intent.auto = null; C().mode = "emg"; Ctrl.restart()');
});
await step('Тёмная тема: ночные сцены во всех играх', async () => {
  await js('C().theme = "dark"; C().quickCal = false; applyTheme()');
  for (const g of games) { await js(`KinetaTrainer.open('${g}', { diff: 3 })`); await sleep(700); await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(4200); await shot(`20-dark-${g}`); await js(STOP + ' SCR.play.finish()'); await sleep(900); }
});
await step('Цвета руки, формы каналов, крупный режим, системная тема', async () => {
  await js('App.go("profile", {}, { fade: true })'); await sleep(700);
  for (const pal of ['graphite', 'warm', 'bright', 'titan']) { await js(`document.querySelector('[data-pal="${pal}"]').click()`); await sleep(200); }
  await js('document.querySelector(\'[data-pal="warm"]\').click()'); await js('App.go("home", {}, { fade: true })'); await sleep(800); await shot('21-hand-warm-dark');
  await js('C().handPal = "titan"; applyHand(); C().theme = "auto"; applyTheme(); C().big = true; applyBig(); App.go("home", {}, { fade: true })'); await sleep(800);
  if (!(await js('document.body.classList.contains("big") && ["light","dark"].includes(document.documentElement.dataset.theme)'))) throw new Error('крупный режим или авто-тема');
  await size(360, 780); await shot('22-big-360');
  const over = await js('document.querySelector("#view").scrollWidth - document.querySelector("#view").clientWidth'); if (over > 2) throw new Error('горизонтальная прокрутка в крупном режиме: ' + over);
  await js('App.go("profile", {}, { fade: true })'); await sleep(800); await shot('23-profile-big');
  await js('C().big = false; applyBig(); C().theme = "light"; applyTheme()'); await size(390, 844);
});

ws.close(); chrome.kill(); server.close();
try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { }
for (const [s, n] of results) console.log(`${s}  ${n}`);
console.log(`\n${results.filter(r => r[0] === 'PASS').length}/${results.length} сценариев, ошибок: ${errors.length}. Скриншоты: ${out}`);
if (errors.length) { console.log(errors.slice(0, 30).join('\n')); process.exit(1); }
