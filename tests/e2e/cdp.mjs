// Общая обвязка e2e: статический сервер prototype/, headless Chrome и DevTools Protocol без зависимостей (Node ≥ 22).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { staticServer, root } from '../../tools/serve.mjs';
export { root };

const here = path.dirname(fileURLToPath(import.meta.url));
export const out = path.join(here, 'out');
export const sleep = ms => new Promise(r => setTimeout(r, ms));
/* Chrome + одна вкладка. errors копит исключения страницы и ошибки консоли. */
export async function launch() {
  fs.mkdirSync(out, { recursive: true });
  const { server, url: base } = await staticServer();
  const candidates = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const exe = candidates.find(p => fs.existsSync(p));
  if (!exe) { console.error('Chrome не найден, задайте CHROME=путь'); server.close(); process.exit(2); }
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'kineta-e2e-'));
  const chrome = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  let port = null;
  for (let i = 0; i < 100 && !port; i++) { await sleep(100); try { port = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch (e) { } }
  if (!port) { console.error('Chrome не открыл порт отладки'); chrome.kill(); server.close(); process.exit(2); }
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(), errors = [], dialogs = [], subs = {};
  const cdp = (method, params = {}) => new Promise((r, j) => { const i = ++id; pending.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { r, j } = pending.get(m.id); pending.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push('exception: ' + (d.exception?.description || d.text) + (d.url ? ` @ ${d.url.split('/').pop()}:${d.lineNumber + 1}` : '')); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.url || '')) errors.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
    if (m.method && subs[m.method]) for (const f of subs[m.method]) f(m.params);
    if (m.method === 'Page.javascriptDialogOpening') { dialogs.push(m.params.message); cdp('Page.handleJavaScriptDialog', { accept: false }).catch(() => { }); }
  };
  const js = async expr => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(expr.slice(0, 80) + ' → ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
  const shot = async name => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(r.data, 'base64')); };
  const size = (w, h, mobile = true) => cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  const go = async (q, wait = 2600) => { await cdp('Page.navigate', { url: base + q }); await sleep(wait); };
  /* настоящий клик мышью в точку (как палец), а не el.click() */
  const tap = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); };
  const key = async (code, down = true) => cdp('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', code, key: code.replace(/^Key/, '').toLowerCase() });
  await cdp('Runtime.enable'); await cdp('Log.enable'); await cdp('Page.enable');
  await size(390, 844);

  const results = [];
  const step = async (name, fn) => { const e0 = errors.length; try { await fn(); results.push([errors.length === e0 ? 'PASS' : 'FAIL', name]); } catch (e) { errors.push(name + ': ' + e.message); results.push(['FAIL', name]); } };
  const close = () => { ws.close(); chrome.kill(); server.close(); setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { } }, 300); };
  /* итог: список сценариев и ошибки; код выхода 1 при любой ошибке или системном диалоге */
  const report = () => {
    close();
    for (const [s, n] of results) console.log(`${s}  ${n}`);
    if (dialogs.length) errors.push('системные диалоги (alert/confirm) блокируют приложение: ' + dialogs.join(' | '));
    console.log(`\n${results.filter(r => r[0] === 'PASS').length}/${results.length} сценариев, ошибок: ${errors.length}. Скриншоты: ${out}`);
    if (errors.length) { console.log(errors.slice(0, 40).join('\n')); process.exitCode = 1; }
  };
  const on = (method, f) => (subs[method] ||= []).push(f); // подписка на события DevTools (кадры скринкаста)
  return { base, cdp, js, shot, size, go, tap, key, step, results, errors, report, on, close };
}

/* бот-«мышцы»: циклы К1 → покой → К2 → покой по 0.7 с */
export const BOT = `(() => { clearInterval(window.__bot); let k = 0; window.__bot = setInterval(() => { k++; const p = k % 24; Intent.auto = p < 6 ? [.75, 0] : p < 12 ? [0, 0] : p < 18 ? [0, .75] : [0, 0]; }, 120); })()`;
export const STOP = `clearInterval(window.__bot); Intent.auto = null;`;
