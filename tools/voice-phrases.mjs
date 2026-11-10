// Какие фразы игра произносит — собирается из кода игры (без синтеза). Используется tools/voiceover.mjs и тестами.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCore } from '../tests/unit/harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ключ фразы — тот же, что Native.voiceKey в приложении: регистр, «ё», кавычки и знаки не важны */
export const voiceKey = s => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[«»"'!?.,…:;()—–-]/g, ' ').replace(/\s+/g, ' ').trim();
/* то же преобразование, что Voice.speakable в ui.js: «К1» → «ка один» */
export const speakable = s => String(s).replace(/\(?К1\)?/g, 'ка один').replace(/\(?К2\)?/g, 'ка два').replace(/[«»!…]/g, '').replace(/\s+—\s+/g, ', ').trim();

/* подсказки-призывы и предупреждения из hint(), шаги Школы, команды «Без экрана», системные сообщения */
export function gamePhrases() {
  const k = loadCore({ games: true }); k.run('Native.say = () => {};');
  const src = fs.readFileSync(path.join(ROOT, 'prototype/js/games.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'prototype/js/ui.js'), 'utf8');
  const set = new Set();
  for (const m of src.matchAll(/\[['`]([^'`$]{3,120})['`], '(act|warn)'\]/g)) set.add(speakable(m[1]));
  for (const s of k.run('SCHOOL_STEPS.map(x => x.d)')) set.add(speakable(s));
  for (const mode of ['emg', 'spppr']) { k.run(`C().mode = '${mode}'`); for (const c of ['CH1', 'CH2', 'REST', 'BOTH', 'G:supination', 'G:adduction', 'G:abduction']) set.add(k.run(`BlindGame.prototype.word('${c}')`)); }
  ['Сигнал потерян', 'Голосовые подсказки включены', speakable('Получилось!')].forEach(s => set.add(s));
  return [...set].filter(Boolean);
}
