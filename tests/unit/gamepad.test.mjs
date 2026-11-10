// Эмулятор потока 1 с джойстика (ТЗ: «эмулятор двух кнопок/слайдеров — клавиатура, мышь, джойстик»).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './harness.mjs';

/* имитация navigator.getGamepads(): стандартная раскладка, 17 кнопок */
function pad(k, set) {
  k.ctx.__pad = { connected: true, buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })) };
  k.run('navigator.getGamepads = () => [null, __pad]');
  set(k.ctx.__pad.buttons);
}
const press = (b, i, v = 1) => { b[i].value = v; b[i].pressed = v > .5; };

test('курки LT / RT дают К1 / К2 пропорционально нажатию, отпускание — покой', () => {
  const k = loadCore(); k.run("C().mode = 'emg'; Ctrl.restart();");
  pad(k, b => press(b, 6, .7));
  for (let t = 0; t < 400; t += 10) { k.advance(10); k.run(`Ctrl.tick(${k.now})`); }
  assert.ok(Math.abs(k.run('Intent.lvl[0]') - .7) < .05, 'сила К1 = нажатие курка');
  assert.equal(k.run('Ctrl.state'), 'CH1');
  pad(k, b => press(b, 7, .9));
  for (let t = 0; t < 400; t += 10) { k.advance(10); k.run(`Ctrl.tick(${k.now})`); }
  assert.equal(k.run('Ctrl.state'), 'CH2');
  pad(k, () => {});
  for (let t = 0; t < 600; t += 10) { k.advance(10); k.run(`Ctrl.tick(${k.now})`); }
  assert.equal(k.run('Ctrl.state'), 'REST'); assert.equal(k.run('Intent.gp'), null, 'управление вернулось клавишам');
});

test('кнопки A + B вместе — «обе мышцы»; крестовина — жесты СПППР; без джойстика ничего не ломается', () => {
  const k = loadCore(); k.run("C().mode = 'emg'; Ctrl.restart();");
  pad(k, b => { press(b, 0); press(b, 1); });
  for (let t = 0; t < 400; t += 10) { k.advance(10); k.run(`Ctrl.tick(${k.now})`); }
  assert.equal(k.run('Ctrl.state'), 'BOTH');
  pad(k, b => press(b, 12));
  k.advance(50); assert.equal(k.run('Intent.gpG'), 'supination');
  k.run('navigator.getGamepads = () => [null, null]'); k.advance(50);
  assert.equal(k.run('Intent.gp'), null); assert.equal(k.run('Intent.gpG'), null);
  k.run('delete navigator.getGamepads'); k.advance(50); // браузер без Gamepad API
});
