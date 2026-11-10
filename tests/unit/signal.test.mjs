// Конвейер сигнала (Ctrl): Поток 1 (ЭМГ) и Поток 2 (СПППР) по требованиям ТЗ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './harness.mjs';

function fresh(mode, cfg) {
  const k = loadCore();
  k.ctx.__log = [];
  k.run(`C().mode = '${mode}'; Object.assign(C(), ${JSON.stringify(cfg || {})}); Ctrl.external = true; Ctrl.restart(); Ctrl.resetMetrics();
    ['state', 'signal:lost', 'signal:back', 'sp:gesture'].forEach(e => Bus.on(e, d => __log.push([e, d])));`);
  return k;
}
const state = k => k.run('Ctrl.state');
const log = k => k.ctx.__log;

/* ЭМГ 100 Гц: f(t) → [a, b] в 0…255; Ctrl.tick вызывается так же, как в главном цикле */
function emg(k, ms, f, step = 10) {
  for (let t = 0; t < ms; t += step) {
    k.advance(step);
    const [a, b] = f(t);
    k.run(`Ctrl.pushEmg({ timestamp_ms: ${Math.round(k.now)}, emg: [${a}, ${b}], thr: [97, 89] }); Ctrl.tick(${k.now});`);
  }
}

test('Поток 1: четыре состояния REST / CH1 / CH2 / BOTH', () => {
  const k = fresh('emg');
  emg(k, 300, () => [8, 8]); assert.equal(state(k), 'REST');
  emg(k, 300, () => [200, 8]); assert.equal(state(k), 'CH1');
  emg(k, 300, () => [8, 8]); assert.equal(state(k), 'REST');
  emg(k, 300, () => [8, 200]); assert.equal(state(k), 'CH2');
  emg(k, 300, () => [200, 200]); assert.equal(state(k), 'BOTH');
});

test('Поток 1: режимы одновременной активации classic и sport', () => {
  let k = fresh('emg', { coMode: 'classic' });
  emg(k, 300, () => [200, 8]); emg(k, 300, () => [200, 210]);
  assert.equal(state(k), 'CH1', 'classic: первый сигнал удерживает управление');
  k = fresh('emg', { coMode: 'sport' });
  emg(k, 300, () => [200, 8]); emg(k, 300, () => [200, 210]);
  assert.equal(state(k), 'CH2', 'sport: второй сигнал перехватывает');
});

test('Поток 1: гистерезис удерживает канал чуть ниже порога', () => {
  const k = fresh('emg');
  emg(k, 300, () => [200, 8]); assert.equal(state(k), 'CH1');
  const thrRaw = k.run('thrToRaw(0)');
  emg(k, 300, () => [Math.round(thrRaw * 0.93), 8]);
  assert.equal(state(k), 'CH1', 'на 7 % ниже порога канал ещё включён');
  emg(k, 400, () => [Math.round(thrRaw * 0.3), 8]);
  assert.equal(state(k), 'REST');
});

test('Поток 1: короткий выброс (20 мс) подавляется как ложное срабатывание', () => {
  const k = fresh('emg');
  emg(k, 200, () => [8, 8]);
  emg(k, 20, () => [255, 8]);
  emg(k, 300, () => [8, 8]);
  assert.ok(!log(k).some(([e, d]) => e === 'state' && d.state === 'CH1'), 'CH1 не должен включиться');
});

test('Поток 1: задержка от превышения порога до смены состояния ≤ 100 мс', () => {
  for (const amp of [140, 180, 255]) {
    const k = fresh('emg');
    emg(k, 300, () => [8, 8]);
    const t0 = k.now;
    let t1 = null;
    for (let i = 0; i < 40 && t1 == null; i++) { emg(k, 10, () => [amp, 8]); if (state(k) === 'CH1') t1 = k.now; }
    assert.ok(t1 != null, `состояние CH1 не наступило при амплитуде ${amp}`);
    assert.ok(t1 - t0 <= 100, `амплитуда ${amp}: ${t1 - t0} мс > 100 мс`);
    assert.ok(k.run('Ctrl.latency()') <= 100);
  }
});

test('Поток 1: пороги протеза 0…255 → шкала игры → обратно без потерь', () => {
  const k = fresh('emg', { thrSrc: 'device' });
  k.run('Ctrl.setDevThr([120, 60])');
  assert.deepEqual([k.run('thrToRaw(0)'), k.run('thrToRaw(1)')], [120, 60]);
});

test('Поток 1: некорректные пакеты отбрасываются и считаются', () => {
  const k = fresh('emg');
  k.run(`Ctrl.pushEmg({ timestamp_ms: 1, emg: ['x', 3] }); Ctrl.pushEmg({ timestamp_ms: 2, ch1: NaN, ch2: 0 });`);
  assert.equal(k.run('Ctrl.bad'), 2);
  assert.equal(state(k), 'REST');
});

test('Потеря связи: > 200 мс — инерция к покою, > 1.5 с — signal:lost, возврат — signal:back', () => {
  const k = fresh('emg');
  emg(k, 300, () => [200, 8]); assert.equal(state(k), 'CH1');
  for (let i = 0; i < 30; i++) { k.advance(10); k.run(`Ctrl.tick(${k.now})`); }
  assert.equal(k.run('Ctrl.lossFlag'), true);
  assert.equal(state(k), 'REST', 'без пакетов управление гаснет к покою');
  for (let i = 0; i < 140; i++) { k.advance(10); k.run(`Ctrl.tick(${k.now})`); }
  assert.ok(log(k).some(([e]) => e === 'signal:lost'));
  emg(k, 50, () => [8, 8]);
  assert.ok(log(k).some(([e]) => e === 'signal:back'));
});

/* ---------------- Поток 2 ---------------- */
const pkt = (ts, d) => JSON.stringify({ timestamp_ms: ts, dist: { neutral: 0, flexion: 0, extension: 0, pronation: 0, supination: 0, adduction: 0, abduction: 0, ...d } });
const push = (k, ts, d) => k.run(`Ctrl.pushSpppr(${JSON.stringify(pkt(ts, d))})`);
function sp(k, ms, fn, { every = 30, mcu = { t: 5_000_000 } } = {}) {
  for (let t = 0; t < ms; t += 10) {
    k.advance(10);
    if (t % every === 0) { mcu.t += every; const d = fn(t); if (d) push(k, mcu.t, d); }
    k.run(`Ctrl.tick(${k.now})`);
  }
  return mcu;
}

test('Поток 2: только разница timestamp_ms; повтор и откат времени отбрасываются', () => {
  const k = fresh('spppr');
  push(k, 1000, { neutral: 1 }); push(k, 1000, { neutral: 1 }); push(k, 900, { neutral: 1 }); push(k, 1040, { neutral: 1 });
  assert.equal(k.run('Ctrl.bad'), 2);
  assert.equal(k.run('Ctrl.pktDt'), 0.04);
});

test('Поток 2: вероятности нормируются (softmax), битый JSON отбрасывается', () => {
  const k = fresh('spppr');
  push(k, 1, { flexion: 2, extension: 2 });
  assert.equal(k.run('Ctrl.tp.flexion'), 0.5);
  k.run(`Ctrl.pushSpppr('{"timestamp_ms": 5, "dist": ')`);
  assert.equal(k.run('Ctrl.bad'), 1);
});

test('Поток 2: сгибание → CH1, разгибание → CH2, нейтраль → REST', () => {
  const k = fresh('spppr');
  const m = sp(k, 400, () => ({ flexion: .85, neutral: .15 })); assert.equal(state(k), 'CH1');
  sp(k, 400, () => ({ neutral: .9, flexion: .1 }), { mcu: m }); assert.equal(state(k), 'REST');
  sp(k, 400, () => ({ extension: .85, neutral: .15 }), { mcu: m }); assert.equal(state(k), 'CH2');
});

test('Поток 2: единичная ошибка классификатора не меняет жест', () => {
  const k = fresh('spppr');
  const m = sp(k, 300, () => ({ neutral: .95, flexion: .05 }));
  sp(k, 30, () => ({ adduction: .93, neutral: .07 }), { mcu: m });
  sp(k, 300, () => ({ neutral: .95, flexion: .05 }), { mcu: m });
  assert.equal(k.run('Ctrl.g'), 'neutral');
  assert.ok(!log(k).some(([e]) => e === 'sp:gesture'));
});

test('Поток 2: джиттер 10…110 мс — управление без рывков', () => {
  const k = fresh('spppr');
  let mcu = 5_000_000, next = 0, prev = 0, maxStep = 0, flip = false;
  for (let t = 0; t < 4000; t += 10) {
    k.advance(10);
    if (t >= next) {
      mcu += 10 + Math.round(Math.random() * 100); next = t + 10 + Math.random() * 100;
      if (t % 800 < 10) flip = !flip;
      push(k, mcu, flip ? { flexion: .9, neutral: .1 } : { neutral: .9, flexion: .1 });
    }
    k.run(`Ctrl.tick(${k.now})`);
    const v = k.run('Ctrl.p.flexion'); maxStep = Math.max(maxStep, Math.abs(v - prev)); prev = v;
  }
  assert.ok(maxStep < 0.35, `шаг сглаженной вероятности за кадр ${maxStep.toFixed(2)} — слишком резко`);
});

test('Поток 2: пропажа пакетов > 200 мс гасит скорость, игра не зависает', () => {
  const k = fresh('spppr');
  sp(k, 400, () => ({ flexion: .9, neutral: .1 }));
  const before = k.run('Ctrl.p.flexion');
  sp(k, 600, () => null);
  assert.equal(k.run('Ctrl.lossFlag'), true);
  assert.ok(k.run('Ctrl.p.flexion') < before * 0.4, 'вероятность сгибания затухает');
  assert.equal(state(k), 'REST');
});

test('Поток 1: все профили чувствительности укладываются в 100 мс (сигнал на 5 % выше порога и сильнее)', async () => {
  const fs = await import('node:fs');
  const ui = fs.readFileSync(new URL('../../prototype/js/ui.js', import.meta.url), 'utf8');
  for (const id of ['soft', 'norm', 'sharp']) {
    const m = ui.match(new RegExp(id + ": \{ n: '[^']+'.*?v: (\{[^}]+\})"));
    assert.ok(m, 'профиль ' + id + ' не найден');
    const v = Function('return ' + m[1])();
    for (const over of [1.05, 1.3, 2]) {
      const k = fresh('emg', v);
      const amp = Math.min(255, Math.round(k.run('thrToRaw(0)') * over));
      emg(k, 300, () => [8, 8]);
      const t0 = k.now; let t1 = null;
      for (let i = 0; i < 30 && t1 == null; i++) { emg(k, 10, () => [amp, 8]); if (state(k) === 'CH1') t1 = k.now; }
      assert.ok(t1 != null && t1 - t0 <= 100, `${id}, ×${over}: ${t1 == null ? 'нет' : t1 - t0} мс`);
    }
  }
});

test('Поток 2: от первого пакета со сгибанием до CH1 ≤ 150 мс при интервале пакетов 20…100 мс', () => {
  for (const every of [20, 50, 100]) {
    const k = fresh('spppr');
    const m = sp(k, 400, () => ({ neutral: .95, flexion: .05 }), { every });
    let t0 = null, t1 = null;
    for (let t = 0; t < 600 && t1 == null; t += 10) {
      k.advance(10);
      if (t % every === 0) { m.t += every; push(k, m.t, { flexion: .8, neutral: .2 }); t0 ??= k.now; }
      k.run(`Ctrl.tick(${k.now})`);
      if (state(k) === 'CH1') t1 = k.now;
    }
    assert.ok(t1 != null && t1 - t0 <= 150, `интервал ${every} мс: ${t1 == null ? 'нет' : t1 - t0} мс`);
  }
});

test('Q&A 10: режим «Блокировка» — оба канала выше порогов блокируют управление, отпускание снимает блок', () => {
  const k = fresh('emg', { coMode: 'lock' });
  emg(k, 300, () => [200, 8]); assert.equal(state(k), 'CH1');
  emg(k, 300, () => [200, 210]); assert.equal(state(k), 'REST'); assert.equal(k.run('Ctrl.blocked'), true);
  assert.equal(k.run('Ctrl.bothOK()'), false, 'игровые действия «обе мышцы» в режиме блокировки отключены');
  emg(k, 300, () => [8, 210]); assert.equal(state(k), 'CH2'); assert.equal(k.run('Ctrl.blocked'), false);
});

test('Q&A 24: поток СПППР 10 Гц — одиночный ошибочный пакет не включает канал, задержка смены ≤ 150 мс', () => {
  // нейтраль, один пакет «сгибание 0.93» (ошибка классификатора), снова нейтраль
  let k = fresh('spppr');
  const m = sp(k, 600, () => ({ neutral: .95, flexion: .05 }), { every: 100 });
  sp(k, 100, () => ({ flexion: .93, neutral: .07 }), { every: 100, mcu: m });
  sp(k, 400, () => ({ neutral: .95, flexion: .05 }), { every: 100, mcu: m });
  assert.ok(!log(k).some(([e, d]) => e === 'state' && d.state === 'CH1'), 'выброс не должен включать К1');
  assert.ok(k.run('Ctrl.forgiven') >= 1, 'выброс засчитан как прощённая ошибка');
  // настоящее сгибание (два и более пакетов подряд) — CH1 не позже 150 мс от первого пакета
  for (const pf of [.6, .8, .95]) {
    k = fresh('spppr'); const mc = sp(k, 400, () => ({ neutral: .95, flexion: .05 }), { every: 100 });
    let t0 = null, t1 = null;
    for (let t = 0; t < 800 && t1 == null; t += 10) {
      k.advance(10);
      if (t % 100 === 0) { mc.t += 100; push(k, mc.t, { flexion: pf, neutral: 1 - pf }); t0 ??= k.now; }
      k.run(`Ctrl.tick(${k.now})`); if (state(k) === 'CH1') t1 = k.now;
    }
    assert.ok(t1 != null && t1 - t0 <= 150, `сгибание ${pf}: ${t1 == null ? 'нет' : t1 - t0} мс`);
  }
});
