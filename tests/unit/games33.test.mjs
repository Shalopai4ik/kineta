// 3.3: бесконечная сложность (LV), «Без экрана», призрак в «Нейро-гонке», новые предметы «Кружки».
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './harness.mjs';

const k0 = () => { const k = loadCore({ games: true }); k.ctx.__mission = []; k.run('Native.say = () => {}; Snd.tone = () => {};'); return k; };

test('LV: уровни 1–3 как раньше, дробные — интерполяция, выше 3 — продолжение с ограничением', () => {
  const k = k0();
  assert.equal(k.run('LV(2, [10, 14, 18])'), 14);
  assert.equal(k.run('LV(2.5, [10, 14, 18])'), 16);
  assert.equal(k.run('LV(4, [10, 14, 18])'), 22);
  assert.equal(k.run('LV(4.5, [3, 2, 1])'), 1, 'счётчик не уходит ниже минимума');
  assert.ok(Math.abs(k.run('LV(3.5, [2.8, 2.3, 1.9])') - 1.7) < 1e-9);
  assert.ok(k.run('LV(4.5, [.26, .2, .16])') > 0);
  assert.equal(k.run("LV(3.6, ['a', 'b', 'c'])"), 'c', 'нечисловые параметры — ближайший уровень');
});

test('все игры создаются и обновляются на дробной сложности 3.7 без ошибок', () => {
  const k = k0();
  k.run(`for (const id of Object.keys(GAMES)) { const g = new GAMES[id].cls(3.7); g.resize(390, 600); for (let i = 0; i < 300; i++) g.update(1 / 60, { state: i % 90 < 30 ? 'CH1' : i % 90 < 60 ? 'CH2' : 'REST', a: [i % 90 < 30 ? .7 : 0, i % 90 >= 30 && i % 90 < 60 ? .7 : 0] }, i * 16); const r = g.result(); if (!Number.isFinite(r.score) || !Number.isFinite(r.acc)) throw new Error(id); }`);
});

function blindBot(lv) {
  const k = k0(); const g = k.run(`globalThis.__b = new BlindGame(${lv}); __b.resize(390, 600); __b`);
  let st = 'REST';
  for (let i = 0; i < 60 * 120 && !g.done; i++) {
    if (g.ph === 'cue' && g.pt > .3) st = g.cue; // человек реагирует через 0.3 с
    g.update(1 / 60, { state: st, a: [st === 'CH1' || st === 'BOTH' ? .7 : 0, st === 'CH2' || st === 'BOTH' ? .7 : 0] });
  }
  return { k, g };
}
for (const lv of [1, 2, 3]) {
  test(`«Без экрана», уровень ${lv}: внимательный игрок выполняет все команды`, () => {
    const { k, g } = blindBot(lv);
    const r = g.result();
    assert.equal(g.ok, g.N); assert.equal(r.win, true); assert.ok(r.react > 250 && r.react < 450, 'реакция ' + r.react);
    assert.equal(k.ctx.__mission.filter(e => e === 'blind:ok').length, g.N);
  });
}
test('«Без экрана»: команды идут без повторов подряд, на уровне 3 экран пустой', () => {
  const k = k0(); const g = k.run('new BlindGame(3)');
  for (let i = 1; i < g.cmds.length; i++) assert.notEqual(g.cmds[i], g.cmds[i - 1]);
  assert.equal(g.show, 'none');
});

test('«Нейро-гонка»: финиш записывает призрака, следующий заезд видит его и считает отрыв', () => {
  const k = k0();
  const drive = () => { const g = k.run('globalThis.__r = new RaceGame(1); __r.resize(390, 600); __r'); for (let i = 0; i < 60 * 100 && !g.done; i++) g.update(1 / 60, { state: 'REST', a: [0, 0] }); return g; };
  const g1 = drive(); assert.equal(g1.finished, true);
  const r1 = g1.result(); assert.match(r1.extra[0][1], /записан/);
  const gh = k.run('S.games.race.ghost["1"]'); assert.ok(gh.T > 10 && gh.d.length > 40);
  const g2 = k.run('globalThis.__r2 = new RaceGame(1); __r2.resize(390, 600); __r2');
  for (let i = 0; i < 60 * 5; i++) g2.update(1 / 60, { state: 'REST', a: [0, 0] });
  const chip = g2.chips().find(c => c[0] === 'Призрак'); assert.ok(chip, 'фишка призрака'); assert.match(chip[1], /м$/);
});

test('«Кружка»: яйцо только с уровня 3, банка тяжёлая, у яйца нет доливки', () => {
  const k = k0();
  const pools = [1, 2, 3].map(lv => k.run(`CUPS.filter(c => c.lv <= ${lv} + .01).map(c => c.k).join()`));
  assert.ok(!pools[0].includes('egg') && !pools[1].includes('egg') && pools[2].includes('egg'));
  assert.ok(k.run("CUPS.find(c => c.k === 'jar').mid") > .7);
  assert.equal(k.run("CUPS.find(c => c.k === 'egg').noRefill"), true);
});
