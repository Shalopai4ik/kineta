// Записанный голос: фразы для озвучки собираются из кода игры, ключи совпадают с приложением,
// в приложении фраза с записью играет файл, без записи — синтезатор телефона.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadCore } from './harness.mjs';
import { gamePhrases, voiceKey, speakable } from '../../tools/voice-phrases.mjs';

test('фразы игры собираются из кода: подсказки, шаги Школы, команды «Без экрана», системные', () => {
  const list = gamePhrases();
  assert.ok(list.length >= 25, 'фраз: ' + list.length);
  for (const s of ['Сожми ка один до зелёной зоны', 'Расслабь', 'Ладонь вверх', 'Сигнал потерян', 'Блокировка: обе мышцы выше порога, расслабь лишнюю'])
    assert.ok(list.some(x => voiceKey(x) === voiceKey(s)), 'нет фразы: ' + s);
  assert.ok(!list.some(x => /К1|К2|\$\{/.test(x)), 'фразы без «К1» и шаблонов');
});

test('ключ фразы в генераторе и в приложении один и тот же; speakable совпадает с Voice.speakable из ui.js', () => {
  const k = loadCore();
  for (const s of [...gamePhrases(), 'Ёлка, «кавычки» — тире… и (скобки)!']) assert.equal(k.run(`Native.voiceKey(${JSON.stringify(s)})`), voiceKey(s), s);
  const ui = fs.readFileSync(new URL('../../prototype/js/ui.js', import.meta.url), 'utf8');
  assert.ok(ui.includes(`speakable: s => String(s).replace(/\\(?К1\\)?/g, 'ка один').replace(/\\(?К2\\)?/g, 'ка два').replace(/[«»!…]/g, '').replace(/\\s+—\\s+/g, ', ').trim(),`), 'Voice.speakable в ui.js изменился — обновите tools/voice-phrases.mjs');
  assert.equal(speakable('Сожми (К1) до зелёной зоны'), 'Сожми ка один до зелёной зоны');
});

test('приложение: есть запись — играет файл, выбран «Системный» или записи нет — синтезатор телефона', async () => {
  const played = [], spoken = [];
  const k = loadCore();
  k.ctx.Audio = class { constructor(src) { this.src = src; } play() { played.push(this.src); return Promise.resolve(); } pause() { } };
  k.ctx.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  k.ctx.speechSynthesis = { cancel() { }, speak: u => spoken.push([u.text, u.voice?.name]), getVoices: () => [{ name: 'Microsoft Irina', lang: 'ru-RU', localService: true }, { name: 'Microsoft Svetlana Online (Natural)', lang: 'ru-RU' }, { name: 'Google US English', lang: 'en-US' }] };
  k.ctx.fetch = async () => ({ ok: true, json: async () => ({ voice: 'irina', files: { [voiceKey('Сожми ка один до зелёной зоны')]: 'abc.mp3' } }) });
  await k.run('Native.loadClips()');
  k.run("Native.say('Сожми ка один до зелёной зоны', { force: true })");
  assert.deepEqual(played, ['audio/voice/abc.mp3']); assert.equal(spoken.length, 0);
  k.run("Native.say('Новая фраза без записи', { force: true })");
  assert.equal(spoken.at(-1)[1], 'Microsoft Svetlana Online (Natural)', 'системный — лучший русский голос (нейросетевой)');
  k.run("C().voiceSrc = 'sys'; Native.say('Сожми ка один до зелёной зоны', { force: true })");
  assert.equal(played.length, 1); assert.equal(spoken.at(-1)[0], 'Сожми ка один до зелёной зоны');
});
