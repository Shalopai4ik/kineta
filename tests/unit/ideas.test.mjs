// Идеи 1–2: баланс каналов в подборе заданий (Q&A 5) и 6 жестов СПППР в играх (Q&A 22).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './harness.mjs';

const k0 = () => { const k = loadCore({ games: true }); k.ctx.__mission = []; k.run('Native.say = () => {}; Snd.tone = () => {};'); return k; };
const hist = (k, bal) => k.run(`S.history = [${[1, 2, 3, 4].map(t => `{ t: ${t}, game: 'race', bal: ${bal} }`).join(',')}]`);

test('баланс: перекос К1 80 % → слабый К2, задания для него чаще; ровный баланс — без смещения', () => {
  const k = k0();
  hist(k, 80); assert.deepEqual(JSON.parse(k.run('JSON.stringify(Bias.get())')), { weak: 1, b: .8 });
  hist(k, 50); assert.equal(k.run('Bias.get()'), null);
  hist(k, 20); assert.equal(k.run('Bias.get().weak'), 0);
  k.run('S.history = [{ t: 1, game: "race", bal: 90 }]'); assert.equal(k.run('Bias.get()'), null, 'по одной игре не судим');
  hist(k, 80); k.run('Bias.cur = Bias.get()');
  const share = (expr, n = 40) => { let a = 0, b = 0; for (let i = 0; i < n; i++) { const r = k.run(expr); a += r[0]; b += r[1]; } return b / (a + b); };
  const flap = share("(() => { const s = new FlapGame(2).seq; return [s.filter(x => x === 0).length, s.filter(x => x === 1).length]; })()");
  const rhythm = share("(() => { const n = new RhythmGame(2).notes; return [n.filter(x => x.lane === 0).length, n.filter(x => x.lane === 1).length]; })()");
  const blind = share("(() => { const c = new BlindGame(3).cmds; return [c.filter(x => x === 'CH1').length, c.filter(x => x === 'CH2').length]; })()");
  for (const [n, v] of [['Искра', flap], ['Ритм', rhythm], ['Без экрана', blind]]) assert.ok(v > .55, `${n}: доля К2 ${v.toFixed(2)}`);
  k.run('Bias.cur = null');
  const even = share("(() => { const n = new RhythmGame(2).notes; return [n.filter(x => x.lane === 0).length, n.filter(x => x.lane === 1).length]; })()");
  assert.ok(even > .4 && even < .6, 'без смещения — поровну: ' + even.toFixed(2));
  assert.match(k.run('Bias.cur = Bias.get(); Bias.note()'), /Больше заданий для К2/);
});

const sixOn = k => k.run("C().mode = 'spppr'; C().spGest = 6;");
test('6 жестов: в «Гонке» супинация — гудок, машина впереди уходит из полосы; в ЭМГ жест ничего не делает', () => {
  const k = k0(); sixOn(k);
  const g = k.run('globalThis.__r = new RaceGame(1); __r.resize(390, 600); __r');
  const s0 = Math.floor((g.pos + 840) / g.SEG); k.run(`__r.segs[${s0 + 5}].obj = [{ t: 'car', off: 0, c: '#fff' }]`);
  g.update(1 / 60, { state: 'REST', a: [0, 0], g: 'neutral' }); g.update(1 / 60, { state: 'REST', a: [0, 0], g: 'supination' });
  assert.equal(g.horns, 1); assert.notEqual(k.run(`__r.segs[${s0 + 5}].obj[0].off`), 0, 'машина уступила полосу');
  g.update(1 / 60, { state: 'REST', a: [0, 0], g: 'neutral' }); g.update(1 / 60, { state: 'REST', a: [0, 0], g: 'supination' });
  assert.equal(g.horns, 1, 'перезарядка 5 с');
  assert.ok(g.chips().some(c => c[0].startsWith('Гудок')));
  k.run("C().mode = 'emg'"); const e = k.run('new RaceGame(1)'); e.resize(390, 600);
  e.update(1 / 60, { state: 'REST', a: [0, 0], g: 'neutral' }); e.update(1 / 60, { state: 'REST', a: [0, 0], g: 'supination' }); assert.equal(e.horns, 0);
});

test('6 жестов: в «Искре» супинация — купол гасит удар; в «Рыбалке» приведение — прикормка ускоряет поклёвку', () => {
  const k = k0(); sixOn(k);
  const f = k.run('globalThis.__f = new FlapGame(1); __f.resize(390, 600); __f');
  f.onState({ state: 'CH1' }); f.update(1 / 60, { state: 'REST', a: [0, 0], g: 'neutral' }); f.update(1 / 60, { state: 'REST', a: [0, 0], g: 'supination' });
  assert.equal(f.shields, 1); assert.ok(f.shieldT > 2);
  const lives = f.lives; k.run('__f.y = -100; __f.inv = 0'); f.update(1 / 60, { state: 'REST', a: [0, 0], g: 'supination' });
  const fish = k.run('globalThis.__p = new FishGame(1); __p.resize(390, 600); __p'); fish.wait = 3;
  fish.update(.1, { state: 'REST', a: [0, 0], g: 'neutral' }); fish.update(.1, { state: 'REST', a: [0, 0], g: 'adduction' });
  assert.equal(fish.baits, 1); assert.ok(fish.wait < 1, 'ожидание поклёвки сократилось: ' + fish.wait);
  for (let i = 0; i < 20 && fish.ph === 'wait'; i++) fish.update(.1, { state: 'REST', a: [0, 0], g: 'adduction' });
  assert.equal(fish.ph, 'bite'); assert.equal(fish.baits, 1, 'одна прикормка на рыбу');
  assert.equal(f.lives, lives, 'купол защищает и от удара о край');
});

test('подписи мышц (митап 27): бицепс / трицепс и свои названия в текстах, Школе и Реакции; HTML экранируется', () => {
  const k = k0();
  assert.equal(k.run("musText('Напряги сгибатели (К1)')"), 'Напряги сгибатели (К1)', 'по умолчанию — как было');
  k.run("C().mus = 'arm'");
  assert.equal(k.run("musText('Сильно напрягите разгибатели (К2), сгибатели — отдыхают')"), 'Сильно напрягите трицепс (К2), бицепс — отдыхают');
  assert.ok(k.run("schoolSteps().some(s => s.d.includes('бицепс')) && !schoolSteps().some(s => /сгибател/.test(s.d))"));
  k.run("C().mus = 'custom'; C().musN = ['<b>дельта</b>', '']");
  assert.equal(k.run("musText('сгибатели и разгибатели', true)"), '&lt;b&gt;дельта&lt;/b&gt; и мышца К2');
  const k2 = loadCore({ storage: { 'kineta.app.v2': JSON.stringify({ cfg: { mus: 'zzz', musN: ['<script>x</script>', 5] } }) } });
  assert.equal(k2.run('C().mus'), 'wrist'); assert.deepEqual(JSON.parse(k2.run('JSON.stringify(C().musN)')), ['scriptx/script', '']);
});
