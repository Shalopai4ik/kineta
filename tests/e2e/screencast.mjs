// Демонстрационный скринкаст: сценарий проходит игру в headless Chrome с ботом-«мышцами»,
// подписи-комментарии выводятся поверх приложения, кадры склеиваются ffmpeg в MP4.
//   node tests/e2e/screencast.mjs [выход.mp4]       FFMPEG=путь — если ffmpeg не в PATH
// Голосовой комментарий команда записывает поверх этого ролика (ТЗ: «скринкаст работы игры с комментариями»).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { launch, sleep, BOT, STOP } from './cdp.mjs';

const outFile = path.resolve(process.argv[2] || 'docs/media/kineta-demo.mp4');
const ff = process.env.FFMPEG || ['ffmpeg', 'C:/OSPanel/modules/PHP-8.2/PHP/ffmpeg.exe', 'C:/ffmpeg/bin/ffmpeg.exe'].find(p => spawnSync(p, ['-version']).status === 0);
if (!ff) { console.error('ffmpeg не найден: задайте FFMPEG=путь'); process.exit(2); }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kineta-cast-')), frames = [];
const { js, size, go, cdp, on, close } = await launch();
await size(390, 844);
on('Page.screencastFrame', p => { const f = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`); fs.writeFileSync(f, Buffer.from(p.data, 'base64')); frames.push([f, p.metadata.timestamp]); cdp('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => { }); });

/* подпись внизу экрана: короткий комментарий к тому, что происходит */
const CAP = `(t => { let c = document.getElementById('castCap'); if (!c) { c = document.createElement('div'); c.id = 'castCap'; c.style.cssText = 'position:fixed;left:10px;right:10px;bottom:84px;z-index:99999;background:rgba(27,22,19,.86);color:#fff;font:700 15px/1.35 Nunito,system-ui,sans-serif;padding:10px 14px;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.25);transition:opacity .3s;pointer-events:none'; document.body.appendChild(c); } c.style.opacity = t ? 1 : 0; if (t) c.textContent = t; })`;
const say = async (t, ms = 3200) => { await js(`${CAP}(${JSON.stringify(t)})`); await sleep(ms); };
const play = async (id, diff, ms, extra = '') => { await js(`KinetaTrainer.open('${id}', { diff: ${diff} })${extra}`); await sleep(1200); await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(ms); await js(`${STOP} SCR.play.finish()`); await sleep(1500); };

await go('?reset=1', 1200); await js('C().quickCal = false; save(true)'); await go('', 2400);
await cdp('Page.startScreencast', { format: 'jpeg', quality: 78, maxWidth: 390, maxHeight: 844, everyNthFrame: 1 });
await say('Kineta — игра-тренажёр управления бионическим протезом двумя сигналами мышц (ЭМГ) или потоком СПППР', 4200);
await js('document.querySelector("#oNext").click()'); await sleep(1400); await js('document.querySelector("#oNext").click()'); await sleep(1400);
await js('document.querySelector("#oNext").click()'); await sleep(900);
await say('Без протеза работает демо-режим: сигналы мышц даёт эмулятор (клавиши F/J, панели, джойстик, пульт на втором телефоне)', 3600);
await js('document.querySelector("#pLater").click()'); await sleep(1800);
await say('Главная: модель протеза повторяет сигнал, К1 — закрыть, К2 — открыть, обе мышцы — сменить жест', 2400);
await js('Intent.auto = [.8, 0]'); await sleep(1100); await js('Intent.auto = [0, .8]'); await sleep(1100); await js('Intent.auto = null'); await sleep(800);
await js('App.go("story", {}, { fade: true })'); await sleep(900);
await say('Сюжет «Город Кинета»: 8 районов — Школа и 7 игр по 3 эпизода, у каждой главы — упражнение в жизни', 3800);
await js('document.querySelector(".modal [data-x=go]")?.click()'); await sleep(700);
await js('document.querySelector("[data-ch=\'0\']").click()'); await sleep(1200);
await say('Пролог — Школа управления: раздельные сокращения, сила в зоне, чередование', 2800);
await js('document.querySelectorAll(".sheet").forEach(s => s.close?.())'); await sleep(500);
await say('', 100); await play('school', 1, 9000);
await say('Нейро-гонка: руль пропорционален разнице силы К2 и К1, обе мышцы — нитро', 300); await play('race', 1, 9500);
await say('Результат: точность, чистота сигнала (без встречных сокращений), баланс каналов и карта игры', 3800);
await js('document.querySelector(".emap")?.scrollIntoView({ block: "center", behavior: "smooth" })'); await sleep(2600);
await say('Горячая кружка — бытовой навык: раскрыть, сжать до зелёной зоны, расслабиться и донести, не пролив', 300); await play('mug', 1, 10000);
await say('Искра: цвет ворот подсказывает мышцу, сила сокращения — высота взлёта', 300); await play('flap', 2, 8000);
await js('App.go("sensors", {}, { fade: true })'); await sleep(900);
await say('Датчики: пороги тянутся прямо на графике, чувствительность, 4 режима одновременной активации', 2200);
await js('Intent.auto = [.7, 0]'); await sleep(1200); await js('Intent.auto = [0, .7]'); await sleep(1200); await js('Intent.auto = null'); await sleep(600);
await js('App.go("signal", {}, { fade: true })'); await sleep(800);
await say('Путь сигнала вживую: сырой сигнал → сглаживание → порог с гистерезисом → состояние, задержка ≤ 100 мс', 1600);
await js('Intent.auto = [.75, 0]'); await sleep(1500); await js('Intent.auto = null'); await sleep(1200);
await js('C().mode = "spppr"; Ctrl.restart(); App.go("signal", {}, { fade: true, force: true })'); await sleep(800);
await say('Поток 2 — СПППР: вероятности 7 жестов, интерполяция при джиттере, прощение единичных ошибок классификатора', 1500);
await js('Intent.auto = [0, .8]'); await sleep(1600); await js('Intent.auto = null'); await sleep(900);
await js('C().mode = "emg"; Ctrl.restart(); App.go("games", {}, { fade: true })'); await sleep(900);
await say('Мотивация: миссии дня, испытания дня и недели, бесконечный режим, мастерская, рейтинг', 3400);
await js('document.querySelector("[data-duel]").click()'); await sleep(900);
await say('Дуэль: 2–4 игрока по очереди на одном телефоне, у каждого своя проверка датчиков', 3200);
await js('document.querySelectorAll(".sheet").forEach(s => s.close?.())'); await sleep(500);
await js('App.go("progress", {}, { fade: true })'); await sleep(900);
await say('Прогресс: тренды точности и чистоты, навыки, отчёт для специалиста', 3600);
await js('C().theme = "dark"; applyTheme(); App.go("home", {}, { fade: true })'); await sleep(900);
await say('Светлая и тёмная тема, крупный режим, зеркальный интерфейс под здоровую руку', 3600);
await say('', 600);
await cdp('Page.stopScreencast'); await sleep(300); close();

/* склейка: каждый кадр держится до следующего — ровный темп независимо от частоты кадров */
if (frames.length < 10) { console.error('мало кадров: ' + frames.length); process.exit(1); }
const list = frames.map(([f, t], i) => `file '${f.replace(/\\/g, '/')}'\nduration ${Math.max(.02, ((frames[i + 1]?.[1] ?? t + .5) - t)).toFixed(3)}`).join('\n') + `\nfile '${frames.at(-1)[0].replace(/\\/g, '/')}'\n`;
fs.writeFileSync(path.join(dir, 'list.txt'), list);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const r = spawnSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'fps=25,scale=390:844:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-movflags', '+faststart', outFile], { stdio: 'inherit' });
fs.rmSync(dir, { recursive: true, force: true });
if (r.status !== 0) { console.error('ffmpeg завершился с ошибкой'); process.exit(1); }
const dur = frames.at(-1)[1] - frames[0][1];
console.log(`Скринкаст: ${outFile} · ${Math.round(dur)} с · ${(fs.statSync(outFile).size / 1048576).toFixed(1)} МБ · кадров ${frames.length}`);
