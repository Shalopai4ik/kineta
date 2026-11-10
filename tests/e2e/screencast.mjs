// Демонстрационный скринкаст: сценарий проходит игру в headless Chrome с ботом-«мышцами»,
// подписи-комментарии выводятся поверх приложения, кадры склеиваются ffmpeg в MP4.
//   node tests/e2e/screencast.mjs [выход.mp4]       FFMPEG=путь — если ffmpeg не в PATH
// Голос: если есть записи tests/e2e/out/voice/<id>.wav (node tools/voiceover.mjs cast), подпись держится, пока звучит
// фраза, и звук сводится с видео по отметкам времени. Тексты комментариев — tests/e2e/narration.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, sleep, BOT, STOP } from './cdp.mjs';
import { N } from './narration.mjs';

const outFile = path.resolve(process.argv[2] || 'docs/media/kineta-demo.mp4');
const ff = process.env.FFMPEG || ['ffmpeg', 'C:/OSPanel/modules/PHP-8.2/PHP/ffmpeg.exe', 'C:/ffmpeg/bin/ffmpeg.exe'].find(p => spawnSync(p, ['-version']).status === 0);
if (!ff) { console.error('ffmpeg не найден: задайте FFMPEG=путь'); process.exit(2); }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kineta-cast-')), frames = [], spoken = [];
const VOICE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'voice');
/* длительность WAV по заголовку: байты блока data / (частота × байт на отсчёт) */
const wavDur = f => { const b = fs.readFileSync(f); let o = 12; while (o + 8 <= b.length) { const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4); if (id === 'fmt ') var rate = b.readUInt32LE(o + 12), align = b.readUInt16LE(o + 20); if (id === 'data') return n / (rate * align); o += 8 + n + (n & 1); } return 0; };
const clip = id => { const f = path.join(VOICE, id + '.wav'); return fs.existsSync(f) ? { f, d: wavDur(f) } : null; };
const { js, size, go, cdp, on, close } = await launch();
await size(390, 844);
on('Page.screencastFrame', p => { const f = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`); fs.writeFileSync(f, Buffer.from(p.data, 'base64')); frames.push([f, p.metadata.timestamp]); cdp('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => { }); });

/* подпись внизу экрана: короткий комментарий к тому, что происходит */
const CAP = `(t => { let c = document.getElementById('castCap'); if (!c) { c = document.createElement('div'); c.id = 'castCap'; c.style.cssText = 'position:fixed;left:10px;right:10px;bottom:84px;z-index:99999;background:rgba(27,22,19,.86);color:#fff;font:700 15px/1.35 Nunito,system-ui,sans-serif;padding:10px 14px;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.25);transition:opacity .3s;pointer-events:none'; document.body.appendChild(c); } c.style.opacity = t ? 1 : 0; if (t) c.textContent = t; })`;
const hide = async (ms = 100) => { await js(`${CAP}("")`); await sleep(ms); };
/* комментарий: подпись на экране; с записью голоса — ждём конца фразы (не меньше ms) */
const say = async (id, ms = 3200) => {
  const n = N(id), c = clip(id); await js(`${CAP}(${JSON.stringify(n.text)})`);
  if (c) spoken.push({ f: c.f, t: Date.now() / 1000 }); await sleep(c ? Math.max(ms, c.d * 1000 + 450) : ms);
};
const play = async (id, diff, ms, extra = '') => { await js(`KinetaTrainer.open('${id}', { diff: ${diff} })${extra}`); await sleep(1200); await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(ms); await js(`${STOP} SCR.play.finish()`); await sleep(1500); };

await go('?reset=1', 1200); await js('C().quickCal = false; save(true)'); await go('', 2400);
await cdp('Page.startScreencast', { format: 'jpeg', quality: 78, maxWidth: 390, maxHeight: 844, everyNthFrame: 1 });
await say('intro', 4200);
await js('document.querySelector("#oNext").click()'); await sleep(1400); await js('document.querySelector("#oNext").click()'); await sleep(1400);
await js('document.querySelector("#oNext").click()'); await sleep(900);
await say('demo', 3600);
await js('document.querySelector("#pLater").click()'); await sleep(1800);
await say('home', 2400);
await js('Intent.auto = [.8, 0]'); await sleep(1100); await js('Intent.auto = [0, .8]'); await sleep(1100); await js('Intent.auto = null'); await sleep(800);
await js('App.go("story", {}, { fade: true })'); await sleep(900);
await say('story', 3800);
await js('document.querySelector(".modal [data-x=go]")?.click()'); await sleep(700);
await js('document.querySelector("[data-ch=\'0\']").click()'); await sleep(1200);
await say('school', 2800);
await js('document.querySelectorAll(".sheet").forEach(s => s.close?.())'); await sleep(500);
await hide(); await play('school', 1, 9000);
await say('race', 300); await play('race', 1, 9500);
await say('result', 3800);
await js('document.querySelector(".emap")?.scrollIntoView({ block: "center", behavior: "smooth" })'); await sleep(2600);
await say('mug', 300); await play('mug', 1, 10000);
await say('flap', 300); await play('flap', 2, 8000);
await js('App.go("sensors", {}, { fade: true })'); await sleep(900);
await say('sensors', 2200);
await js('Intent.auto = [.7, 0]'); await sleep(1200); await js('Intent.auto = [0, .7]'); await sleep(1200); await js('Intent.auto = null'); await sleep(600);
await js('App.go("signal", {}, { fade: true })'); await sleep(800);
await say('signal', 1600);
await js('Intent.auto = [.75, 0]'); await sleep(1500); await js('Intent.auto = null'); await sleep(1200);
await js('C().mode = "spppr"; Ctrl.restart(); App.go("signal", {}, { fade: true, force: true })'); await sleep(800);
await say('spppr', 1500);
await js('Intent.auto = [0, .8]'); await sleep(1600); await js('Intent.auto = null'); await sleep(900);
await js('C().mode = "emg"; Ctrl.restart(); App.go("games", {}, { fade: true })'); await sleep(900);
await say('motiv', 3400);
await js('document.querySelector("[data-duel]").click()'); await sleep(900);
await say('duel', 3200);
await js('document.querySelectorAll(".sheet").forEach(s => s.close?.())'); await sleep(500);
await js('App.go("progress", {}, { fade: true })'); await sleep(900);
await say('progress', 3600);
await js('C().theme = "dark"; applyTheme(); App.go("home", {}, { fade: true })'); await sleep(900);
await say('theme', 3600);
await hide(600);
await cdp('Page.stopScreencast'); await sleep(300); close();

/* склейка: каждый кадр держится до следующего — ровный темп независимо от частоты кадров */
if (frames.length < 10) { console.error('мало кадров: ' + frames.length); process.exit(1); }
// Chrome шлёт кадры чаще 25/с, а кадр короче 1/25 с ffmpeg растягивает до 1/25 — ролик выходил длиннее реального
// времени (154 с вместо 131), и голос разъехался бы с картинкой. Оставляем не больше 25 кадров в секунду.
const kept = frames.reduce((a, x) => { if (!a.length || x[1] - a.at(-1)[1] >= .04) a.push(x); return a; }, []);
const list = kept.map(([f, t], i) => `file '${f.replace(/\\/g, '/')}'\nduration ${((kept[i + 1]?.[1] ?? t + .5) - t).toFixed(3)}`).join('\n') + `\nfile '${kept.at(-1)[0].replace(/\\/g, '/')}'\n`;
fs.writeFileSync(path.join(dir, 'list.txt'), list);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const t0 = frames[0][1], video = spoken.length ? path.join(dir, 'video.mp4') : outFile;
let r = spawnSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'fps=25,scale=390:844:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-movflags', '+faststart', video], { stdio: 'inherit' });
if (r.status === 0 && spoken.length) {
  // каждая фраза — со своей задержкой от начала ролика; amix без нормировки, чтобы громкость не «плавала»
  const ins = spoken.flatMap(x => ['-i', x.f]), fl = spoken.map((x, i) => { const ms = Math.max(0, Math.round((x.t - t0) * 1000)); return `[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`; }).join(';');
  const mix = `${fl};${spoken.map((_, i) => `[a${i}]`).join('')}amix=inputs=${spoken.length}:normalize=0:dropout_transition=0,volume=1.0,apad[a]`;
  r = spawnSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', video, ...ins, '-filter_complex', mix, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', outFile], { stdio: 'inherit' });
}
fs.rmSync(dir, { recursive: true, force: true });
if (r.status !== 0) { console.error('ffmpeg завершился с ошибкой'); process.exit(1); }
const dur = frames.at(-1)[1] - frames[0][1];
console.log(`Скринкаст: ${outFile} · ${Math.round(dur)} с · ${(fs.statSync(outFile).size / 1048576).toFixed(1)} МБ · кадров ${frames.length} · ${spoken.length ? 'голос: ' + spoken.length + ' фраз' : 'без голоса (нет tests/e2e/out/voice — node tools/voiceover.mjs cast)'}`);
