// Загрузка js/native.js + js/core.js в изолированный vm-контекст с искусственными часами.
// Верхнеуровневые const/class скриптов доступны через ctx.run('Ctrl') и т. п.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../prototype/js');
const src = f => fs.readFileSync(path.join(root, f), 'utf8');

export function loadCore({ search = '', storage = {}, capacitor = null, games = false } = {}) {
  let now = 1000;
  const timers = [];
  const store = { ...storage };
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const navigator = {};
  const win = {
    localStorage, navigator, location: { search, href: 'http://localhost/' + search },
    performance: { now: () => now },
    setTimeout: (f, ms) => { timers.push({ f, at: now + (ms || 0), every: 0 }); return timers.length; },
    clearTimeout: id => { if (timers[id - 1]) timers[id - 1].dead = true; },
    setInterval: (f, ms) => { timers.push({ f, at: now + ms, every: ms }); return timers.length; },
    clearInterval: id => { if (timers[id - 1]) timers[id - 1].dead = true; },
    structuredClone, console, URLSearchParams, TextEncoder, TextDecoder, DataView, Uint8Array, ArrayBuffer, Math, JSON, Date, Promise,
    isSecureContext: true, Capacitor: capacitor
  };
  win.window = win; win.parent = win; win.self = win;
  const ctx = vm.createContext(win);
  vm.runInContext(src('native.js'), ctx, { filename: 'native.js' });
  vm.runInContext(src('core.js'), ctx, { filename: 'core.js' });
  if (games) { vm.runInContext('var Mission = { ev(e) { (globalThis.__mission ||= []).push(e); } };', ctx); vm.runInContext(src('games.js'), ctx, { filename: 'games.js' }); }
  const run = code => vm.runInContext(code, ctx);
  return {
    ctx, run, store,
    get now() { return now; },
    /* сдвинуть часы на ms, по пути исполняя таймеры */
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const t = timers.filter(x => !x.dead && x.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!t) break;
        now = Math.max(now, t.at);
        if (t.every) t.at += t.every; else t.dead = true;
        t.f();
      }
      now = end;
    }
  };
}
