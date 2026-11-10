// Загрузка сохранения: повреждённые и чужие данные не ломают приложение, прототип не загрязняется,
// значения настроек остаются в допустимых пределах, законные null (заряд протеза) сохраняются.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './harness.mjs';

const KEY = 'kineta.app.v2';
const J = (k, expr) => JSON.parse(k.run(`JSON.stringify(${expr})`)); // массивы из vm-контекста сравниваем через JSON
const boot = raw => loadCore({ storage: raw == null ? {} : { [KEY]: typeof raw === 'string' ? raw : JSON.stringify(raw) } });

test('битый JSON и не-объекты: старт с настройками по умолчанию, копия в .broken', () => {
  for (const raw of ['{не json', 'null', '[]', '"строка"', '42', 'true']) {
    const k = boot(raw);
    assert.equal(k.run('S.cfg.mode'), 'emg', raw);
    assert.ok(k.run('S.gestures.length') >= 9, raw);
    assert.equal(k.run('S.rotation.length') > 0, true, raw);
  }
  assert.equal(boot('{не json').store[KEY + '.broken'], '{не json');
});

test('загрязнение прототипа через __proto__ в сохранении невозможно', () => {
  const k = boot('{"cfg": {"__proto__": {"polluted": 1}}, "__proto__": {"polluted": 2}, "constructor": {"prototype": {"polluted": 3}}}');
  assert.equal(k.run('({}).polluted'), undefined);
  assert.equal(k.run('S.cfg.polluted'), undefined);
});

test('неверные типы не заменяют объекты и числа по умолчанию', () => {
  const k = boot({ onboarded: true, cfg: null, games: 5, history: {}, profile: null, stats: null, gestures: [{}], rotation: 'x', workshop: null, weekly: null, missions: 'x', ach: null, calib: null, device: null, perms: null });
  assert.equal(k.run('typeof S.cfg'), 'object'); assert.equal(k.run('S.cfg.thr1'), .38);
  assert.equal(k.run('Array.isArray(S.history)'), true); assert.equal(k.run('typeof S.games'), 'object');
  assert.equal(k.run('S.profile.name'), 'Алексей'); assert.equal(k.run('typeof S.stats.days'), 'object');
  assert.equal(k.run('S.missions'), undefined); assert.equal(k.run('S.workshop.parts'), 0);
  assert.equal(k.run('S.onboarded'), true, 'годные поля сохранения сохраняются');
});

test('настройки вне допустимых значений приводятся к безопасным', () => {
  const k = boot({ cfg: { mode: 'xyz', theme: 'neon', handPal: 'нет', thr1: 5, thr2: -1, gain1: -5, gain2: 99, emu: null, ble: { format: 'zzz', fullScale: 'x' }, sessionMin: 0, spGest: 4, coMode: 1, devThr: [1] }, calib: { base1: 2, mvc1: -1 } });
  assert.equal(k.run('S.cfg.mode'), 'emg'); assert.equal(k.run('S.cfg.theme'), 'light'); assert.equal(k.run('S.cfg.handPal'), 'titan');
  assert.equal(k.run('S.cfg.thr1'), .95); assert.equal(k.run('S.cfg.thr2'), .08); assert.equal(k.run('S.cfg.gain1'), 1); assert.equal(k.run('S.cfg.gain2'), 20);
  assert.equal(k.run('typeof S.cfg.emu.noise'), 'number'); assert.equal(k.run('S.cfg.ble.format'), 'u16le2'); assert.equal(k.run('S.cfg.ble.fullScale'), 4095);
  assert.equal(k.run('S.cfg.spGest'), 6); assert.equal(k.run('S.cfg.coMode'), 'both'); assert.deepEqual(J(k, 'S.cfg.devThr.slice()'), [97, 89]);
  assert.ok(k.run('S.calib.mvc1 > S.calib.base1'), 'максимум калибровки выше покоя');
});

test('игры, история, дни: мусорные записи отбрасываются, звёзды не становятся NaN', () => {
  const k = boot({ games: { race: { ls: 'x', best: null, ghost: { 1: { T: 'a', d: 5 } } }, flap: null, fish: { ls: [1, 'x', 9], best: 100, plays: 2.7 } }, history: [null, 5, { t: 'x' }, { t: 1, game: 'race', score: 5 }], stats: { days: { '2026-01-01': null, bad: { min: 'x' }, '2026-01-02': { min: 'x', gest: 5 } }, gestTotal: { a: 'b', fist: 3 } }, ach: { first: 'x', clean: 5 }, weekly: { '2026-01-05': null, '2026-01-12': { tries: [] } } });
  assert.equal(k.run('S.games.flap'), undefined);
  assert.equal(k.run('S.games.race.ls'), undefined, 'gst() восстановит ls');
  assert.equal(k.run('S.games.race.ghost["1"]'), undefined);
  assert.deepEqual(J(k, 'S.games.fish.ls.slice()'), [1, 0, 3]); assert.equal(k.run('S.games.fish.plays'), 3);
  assert.equal(k.run('S.history.length'), 1);
  assert.deepEqual(J(k, 'Object.keys(S.stats.days)'), ['2026-01-02']); assert.equal(k.run('S.stats.days["2026-01-02"].min'), 0);
  assert.deepEqual(J(k, 'Object.keys(S.stats.gestTotal)'), ['fist']); assert.deepEqual(J(k, 'Object.keys(S.ach)'), ['clean']);
  assert.deepEqual(J(k, 'Object.keys(S.weekly)'), ['2026-01-12']);
});

test('жесты: id с HTML-разметкой и неполные позы не загружаются, ротация чистится', () => {
  const k = boot({ gestures: [{ id: '"><img src=x onerror=alert(1)>', name: 'x', open: [0, 0, 0, 0, 0, 0], closed: [0, 0, 0, 0, 0, 0] }, { id: 'u1', name: '', open: [1, 2, 3, 4, 5, 6], closed: [1, 2, 3, 4, 5, 6] }, { id: 'u2', open: [1], closed: [1] }], rotation: ['u1', 'u1', 'нет'], activeId: 'нет' });
  assert.deepEqual(J(k, 'S.gestures.map(g => g.id)'), ['u1']); assert.equal(k.run('S.gestures[0].name'), 'Жест');
  assert.deepEqual(J(k, 'S.rotation.slice()'), ['u1']); assert.equal(k.run('S.activeId'), 'u1');
});

test('заряд протеза null (протез его не сообщает) переживает перезагрузку', () => {
  const k = boot({ device: { battery: null, real: true, name: 'Протез' } });
  assert.equal(k.run('S.device.battery'), null); assert.equal(k.run('S.device.name'), 'Протез');
});

test('сохранение старой версии без новых полей дополняется значениями по умолчанию', () => {
  const k = boot({ onboarded: true, cfg: { thr1: .5 }, profile: { name: 'Ира', xp: 300 } });
  assert.equal(k.run('S.cfg.thr1'), .5); assert.equal(k.run('S.cfg.quickCal'), true); assert.equal(k.run('S.cfg.handPal'), 'titan');
  assert.equal(k.run('S.profile.name'), 'Ира'); assert.equal(k.run('S.workshop.parts'), 0); assert.equal(k.run('typeof S.weekly'), 'object');
});

test('BLE JSON: пакеты null, числа и массивы считаются ошибочными, а не роняют драйвер', () => {
  const k = loadCore();
  k.run(`globalThis.__got = []; C().ble.format = 'json';
    for (const mode of ['emg', 'spppr']) { const d = new BleProsthesisDriver(mode); d.cb = p => __got.push(p);
      for (const s of ['null\\n', '5\\n', '[1,2]\\n', '"x"\\n', '{"dist":null}\\n', '{"emg":5}\\n', '{"ch1":0.5,"ch2":0.1}\\n', '{"timestamp_ms":1,"dist":{"flexion":1}}\\n']) d.handle(new DataView(new TextEncoder().encode(s).buffer)); }`);
  assert.equal(k.run('__got.length'), 2, 'прошли только корректные пакеты: ЭМГ {ch1,ch2} и СПППР {dist}');
  assert.ok(k.run('Ctrl.bad') >= 8);
});

test('СПППР: бесконечная сумма вероятностей отбрасывается, вероятности остаются конечными', () => {
  const k = loadCore();
  k.run(`C().mode = 'spppr'; Ctrl.external = true; Ctrl.restart(); Ctrl.pushSpppr({ timestamp_ms: 1, dist: { neutral: 1 } }); Ctrl.pushSpppr({ timestamp_ms: 2, dist: { flexion: 1e308, extension: 1e308 } });`);
  k.advance(50); k.run('Ctrl.tick(performance.now())');
  assert.ok(k.run('Object.values(Ctrl.p).every(Number.isFinite)'));
  assert.ok(k.run('Ctrl.bad') >= 1);
});
