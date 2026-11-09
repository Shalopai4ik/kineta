// «Горячая кружка»: правила хвата (без отрисовки).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './harness.mjs';

function game(lv = 1) {
  const k = loadCore({ games: true });
  k.run(`globalThis.__g = new MugGame(${lv}); __g.resize(390, 600);`);
  const g = k.run('__g');
  return { k, g };
}
/* шаг 1/60 с с заданным состоянием и амплитудами */
const step = (g, state, a0 = 0, a1 = 0) => g.update(1 / 60, { state, a: [a0, a1] });
/* «идеальный пользователь»: раскрыть до подхода, сжать до середины зоны, расслабиться, дожать при доливке, раскрыть на подставке */
function bot(g) {
  const mid = (g.lo + g.hi) / 2;
  if (g.ph === 'reach') return g.f > .1 ? step(g, 'CH2', 0, .7) : step(g, 'REST');
  if (g.ph === 'grip') return g.f < mid ? step(g, 'CH1', .45) : step(g, 'REST');
  if (g.ph === 'carry') return g.f < g.lo + .03 ? step(g, 'CH1', .4) : step(g, 'REST');
  if (g.ph === 'release') return step(g, 'CH2', 0, .7);
  return step(g, 'REST');
}

for (const lv of [1, 2, 3]) {
  test(`уровень ${lv}: аккуратный бот проходит уровень без ошибок`, () => {
    const { k, g } = game(lv);
    for (let i = 0; i < 60 * 130 && !g.done; i++) bot(g);
    const r = g.result();
    assert.equal(r.win, true, JSON.stringify(g.fails));
    assert.equal(Object.values(g.fails).reduce((a, b) => a + b, 0), 0);
    assert.ok(r.acc >= .85, 'точность ' + r.acc);
    assert.ok(k.ctx.__mission.filter(e => e === 'mug:deliver').length >= g.goalN);
  });
}

test('пережал (К1 без остановки) — кружка трескается', () => {
  const { g } = game(1);
  while (g.ph === 'reach') step(g, 'CH2', 0, .8);
  for (let i = 0; i < 300 && g.ph === 'grip'; i++) step(g, 'CH1', .9);
  assert.equal(g.fails.crack, 1);
});

test('кисть не раскрыта к подходу — кружка опрокинута', () => {
  const { g } = game(1);
  for (let i = 0; i < 400 && g.ph === 'reach'; i++) step(g, 'REST');
  assert.equal(g.fails.knock, 1);
});

test('встречное сокращение при переноске расплёскивает чай', () => {
  const { k, g } = game(1);
  k.run('C().thr1 = .38; C().thr2 = .35;');
  for (let i = 0; i < 2000 && g.ph !== 'carry'; i++) bot(g);
  assert.equal(g.ph, 'carry');
  for (let i = 0; i < 400 && g.ph === 'carry'; i++) step(g, 'BOTH', .6, .6);
  assert.equal(g.fails.spill, 1);
});
