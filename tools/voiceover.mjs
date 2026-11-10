// Озвучка нейросетевым голосом Piper (офлайн, MIT, https://github.com/rhasspy/piper):
//   1) фразы игры → prototype/audio/voice/*.mp3 + index.json — в приложении (и в APK) звучит записанный
//      голос вместо системного синтезатора телефона; фразы собираются из кода игры, а не вручную;
//   2) комментарии к демо-ролику → tests/e2e/out/voice/*.wav — их подхватывает tests/e2e/screencast.mjs.
//
//   node tools/voiceover.mjs [game|cast|all] [голос]          голос: irina (по умолчанию), denis, dmitri, ruslan
//   PIPER_DIR=C:/kineta-build/tts — где лежат piper/piper.exe и ru_RU-<голос>-medium.onnx
//   FFMPEG=путь — если ffmpeg не в PATH
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gamePhrases, voiceKey } from './voice-phrases.mjs';
import { NARRATION } from '../tests/e2e/narration.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const what = process.argv[2] || 'all', voice = process.argv[3] || 'irina';
const PD = process.env.PIPER_DIR || 'C:/kineta-build/tts';
const piper = [path.join(PD, 'piper', 'piper.exe'), path.join(PD, 'piper', 'piper'), 'piper'].find(p => spawnSync(p, ['--help']).status === 0);
const model = path.join(PD, `ru_RU-${voice}-medium.onnx`);
const ff = process.env.FFMPEG || ['ffmpeg', 'C:/OSPanel/modules/PHP-8.2/PHP/ffmpeg.exe'].find(p => spawnSync(p, ['-version']).status === 0);
if (!piper || !fs.existsSync(model)) { console.error(`Нужны piper и голос: ${model}\nСкачать: https://github.com/rhasspy/piper/releases и https://huggingface.co/rhasspy/piper-voices (ru/ru_RU/${voice}/medium)`); process.exit(2); }
if (!ff) { console.error('ffmpeg не найден: задайте FFMPEG=путь'); process.exit(2); }

/* синтез: чуть медленнее и с паузами между предложениями — спокойная, дружелюбная подача; громкость выровнена */
function synth(text, outWav, { pace = 1.08 } = {}) {
  const raw = outWav + '.raw.wav';
  const r = spawnSync(piper, ['-m', model, '--length_scale', String(pace), '--noise_scale', '0.6', '--noise_w', '0.75', '--sentence_silence', '0.28', '-f', raw], { input: text + '\n' });
  if (r.status !== 0 || !fs.existsSync(raw)) throw new Error('piper: ' + (r.stderr?.toString().slice(-300) || r.status));
  const f = spawnSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw, '-af', 'highpass=f=70,afade=t=in:d=0.03,loudnorm=I=-16:TP=-1.5:LRA=9', '-ar', '44100', outWav]);
  fs.rmSync(raw, { force: true }); if (f.status !== 0) throw new Error('ffmpeg: ' + f.stderr?.toString().slice(-300));
}

if (what === 'game' || what === 'all') {
  const dir = path.join(ROOT, 'prototype/audio/voice'); fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f));
  const index = { voice, files: {} }, list = gamePhrases();
  for (const text of list) {
    const key = voiceKey(text), name = crypto.createHash('sha1').update(key).digest('hex').slice(0, 10) + '.mp3', wav = path.join(dir, name + '.wav');
    synth(text, wav, { pace: 1.0 });
    const r = spawnSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '48k', path.join(dir, name)]);
    fs.rmSync(wav, { force: true }); if (r.status !== 0) throw new Error('mp3: ' + r.stderr);
    index.files[key] = name; process.stdout.write('.');
  }
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1));
  const kb = fs.readdirSync(dir).reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0) / 1024;
  console.log(`\nФразы игры: ${list.length} · голос ${voice} · ${Math.round(kb)} КБ → prototype/audio/voice/`);
}
if (what === 'cast' || what === 'all') {
  const dir = path.join(ROOT, 'tests/e2e/out/voice'); fs.mkdirSync(dir, { recursive: true });
  for (const n of NARRATION) { synth(n.say, path.join(dir, n.id + '.wav')); process.stdout.write('.'); }
  fs.writeFileSync(path.join(dir, 'voice.txt'), voice);
  console.log(`\nКомментарии ролика: ${NARRATION.length} · голос ${voice} → tests/e2e/out/voice/ (дальше: node tests/e2e/screencast.mjs)`);
}
