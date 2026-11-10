// Стресс всех игр: каждый уровень (1–3) и бесконечный режим (2…4.5), три стиля игрока —
// бездействие, случайные сокращения, «дребезг» состояний каждый кадр. Проверяется:
//   игра заканчивается сама (таймер, жизни или число заданий), а не висит вечно;
//   score, acc, progress — конечные числа в допустимых пределах на каждом кадре;
//   draw() на заглушке canvas не бросает исключений (в светлой и тёмной теме).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './harness.mjs';

/* canvas 2D, который принимает любой вызов */
const CANVAS = `(() => {
  const grad = { addColorStop() {} };
  const target = { measureText: s => ({ width: String(s).length * 7 }), createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => null, getImageData: () => ({ data: new Uint8ClampedArray(4) }), isPointInPath: () => false };
  return new Proxy(target, { get: (t, k) => k in t ? t[k] : () => {}, set: (t, k, v) => { if (typeof v === 'number' && !Number.isFinite(v) && k !== 'lineDashOffset') throw new Error('ctx.' + String(k) + ' = ' + v); return true; } });
})()`;

function boot() {
  const k = loadCore({ games: true });
  k.run(`Native.say = () => {}; Snd.tone = () => {}; globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 368; } };
    globalThis.Uint8ClampedArray = Uint8ClampedArray; globalThis.__ctx = ${CANVAS};`);
  return k;
}

/* один прогон: style — 'idle' | 'random' | 'jitter'; возвращает игру и число кадров */
function play(k, id, lv, style, seed, maxS = 420) {
  let s = seed; const R = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const g = k.run(`globalThis.__g = new GAMES['${id}'].cls(${lv}); __g.resize(390, 620); __g`);
  const Ctrl = k.run('Ctrl');
  let st = 'REST', hold = 0, t = 0, frames = 0;
  const dt = 1 / 60;
  for (; t < maxS && !g.done; t += dt, frames++) {
    let next = st;
    if (style === 'random') { hold -= dt; if (hold <= 0) { hold = .1 + R() * .7; next = ['REST', 'REST', 'CH1', 'CH2', 'BOTH'][Math.floor(R() * 5)]; } }
    else if (style === 'jitter') next = ['REST', 'CH1', 'CH2', 'BOTH'][frames % 4];
    const a = [next === 'CH1' || next === 'BOTH' ? .4 + R() * .6 : R() * .05, next === 'CH2' || next === 'BOTH' ? .4 + R() * .6 : R() * .05];
    Ctrl.a[0] = a[0]; Ctrl.a[1] = a[1]; Ctrl.on[0] = a[0] > .38; Ctrl.on[1] = a[1] > .35; Ctrl.state = next;
    if (next !== st) { const prev = st; st = next; g.onState({ state: st, prev, t: t * 1000 }); }
    g.update(dt, { state: st, a, on: Ctrl.on }, 1000 + t * 1000);
    if (frames % 7 === 0) {
      const p = g.progress?.() ?? 0, sc = g.score ?? 0;
      assert.ok(Number.isFinite(p) && p >= 0 && p <= 1, `${id} ур.${lv} ${style}: progress = ${p}`);
      assert.ok(Number.isFinite(sc), `${id} ур.${lv} ${style}: score = ${sc}`);
      g.hud?.(); g.chips?.(); g.hint?.();
    }
    if (frames % 29 === 0) g.draw(k.ctx.__ctx);
  }
  return { g, t, frames };
}

const ARC = ['race', 'flap', 'rhythm', 'fish', 'mug', 'blind', 'react'];
const LEVELS = [1, 2, 3, 2.35, 3.7, 4.5];

for (const id of ARC) {
  test(`«${id}»: все уровни и бесконечный режим × три стиля игры — завершается, результат корректен`, () => {
    const k = boot(); let seed = 7;
    for (const theme of ['light', 'dark']) {
      k.run(`globalThis.document = { documentElement: { dataset: { theme: '${theme}' } } }`);
      for (const lv of LEVELS) for (const style of ['idle', 'random', 'jitter']) {
        const { g, t } = play(k, id, lv, style, seed++);
        // «Искра» ждёт первого взмаха (дрон висит, подсказка «сожми») — это явное ожидание старта, а не зависание
        if (!(style === 'idle' && g.started === false)) assert.ok(g.done, `${id} ур.${lv} ${style}: игра не закончилась за ${Math.round(t)} с`);
        else continue;
        g.draw(k.ctx.__ctx);
        const r = g.result();
        assert.ok(Number.isFinite(r.score) && r.score >= 0, `${id} ур.${lv} ${style}: score ${r.score}`);
        assert.ok(Number.isFinite(r.acc) && r.acc >= 0 && r.acc <= 1, `${id} ур.${lv} ${style}: acc ${r.acc}`);
        assert.ok(Array.isArray(r.extra) && r.extra.every(x => Array.isArray(x) && x.length >= 2 && !String(x[1]).includes('NaN') && !String(x[1]).includes('undefined')), `${id} ур.${lv} ${style}: extra ${JSON.stringify(r.extra)}`);
        if (r.react != null) assert.ok(Number.isFinite(r.react) || r.react === 0, `${id}: react ${r.react}`);
        if (style === 'idle') assert.equal(r.win === false ? 0 : k.run(`starsFor(${r.acc}, ${r.acc})`), 0, `${id} ур.${lv}: бездействие получило звёзды (acc ${r.acc})`);
      }
    }
    k.run('delete globalThis.document');
  });
}

test('«Школа управления»: бездействие, случайный игрок и дребезг не ломают шаги', () => {
  const k = boot();
  for (const style of ['idle', 'random', 'jitter']) { const { g } = play(k, 'school', 1, style, 3, 240); const p = g.progress(); assert.ok(Number.isFinite(p)); g.draw(k.ctx.__ctx); }
});

test('превью игр на экране «Игры» рисуются для всех игр', () => {
  const k = boot();
  for (const id of [...ARC, 'school']) for (const t of [0, 1.7, 9.3]) k.run(`gamePreview('${id}', __ctx, 300, 160, ${t})`);
});
