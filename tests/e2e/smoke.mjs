// Сквозной прогон в headless Chrome через DevTools Protocol (без зависимостей, Node ≥ 22).
// Онбординг → все вкладки → каждая игра с ботом-эмулятором мышц (ЭМГ и СПППР) → экран результата →
// профиль, отчёт для специалиста, демо-режим, тёмная тема, планшет. Критерий: 0 исключений и 0 ошибок консоли.
//   node tests/e2e/smoke.mjs            — скриншоты в tests/e2e/out/
//   CHROME=путь node tests/e2e/smoke.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, out, BOT, STOP } from './cdp.mjs';

const { js, shot, size, go, step, report } = await launch();

await step('Онбординг на чистой установке, без демо-данных', async () => {
  await go('?reset=1');
  await shot('01-onboard');
  const h = await js('S.history.length + Object.keys(S.stats.days).length');
  if (h !== 0) throw new Error('у нового пользователя есть история: ' + h);
  if (await js('!!document.querySelector("#demoTag")')) throw new Error('плашка демо на чистой установке');
});
await step('Все вкладки и вложенные экраны', async () => {
  await js('S.onboarded = true; S.perms.bt = "demo"; save(true)');
  await go('');
  for (const t of ['home', 'gestures', 'sensors', 'games', 'progress', 'profile', 'achievements', 'calib', 'device']) {
    await js(`App.go(${JSON.stringify(t)}, {}, { fade: true })`).catch(() => { });
    await sleep(700); await shot('02-' + t);
  }
  if (!(await js('document.body.innerText.includes("Здесь появится ваш прогресс")') || (await js('App.cur.name')) !== 'progress')) { /* пустое состояние проверяется ниже */ }
});
await step('Прогресс без истории показывает пустое состояние', async () => {
  await js('App.go("progress", {}, { fade: true })'); await sleep(800);
  if (!(await js('document.body.innerText.includes("Здесь появится ваш прогресс")'))) throw new Error('нет пустого состояния');
});

await js('C().quickCal = false; save(true)');
const games = await js('Object.keys(GAMES)');
for (const mode of ['emg', 'spppr']) {
  for (const g of games) {
    await step(`Игра «${g}» (${mode}): запуск, 7 с с ботом, результат`, async () => {
      await js(`C().mode = '${mode}'; Ctrl.restart(); KinetaTrainer.open('${g}', { diff: 1 })`); await sleep(900);
      if (mode === 'emg') await shot(`03-${g}-intro`);
      await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(7000);
      if (mode === 'emg') await shot(`04-${g}-play`);
      await js(`${STOP} SCR.play.finish()`); await sleep(1500);
      if (mode === 'emg') await shot(`05-${g}-result`);
      if (await js('App.cur.name') !== 'result') throw new Error('нет экрана результата: ' + await js('App.cur.name'));
    });
  }
}
await js(`C().mode = 'emg'; Ctrl.restart();`);
await step('История записана, прогресс и отчёт для специалиста строятся', async () => {
  const n = await js('S.history.length'); if (n < games.length) throw new Error('история: ' + n);
  await js('App.go("progress", {}, { fade: true })'); await sleep(900); await shot('06-progress-after');
  const html = await js('specialistReport(30)');
  for (const s of ['Ключевые показатели', 'Чистота сигнала', 'Горячая кружка']) if (!html.includes(s)) throw new Error('в отчёте нет «' + s + '»');
  fs.writeFileSync(path.join(out, 'report.html'), html);
});
await step('Голосовые подсказки включаются без ошибок', async () => {
  await js('App.go("profile", {}, { fade: true })'); await sleep(700);
  await js('document.querySelector(\'[data-sw="voice"]\').click()'); await sleep(300);
  if (!(await js('C().voice'))) throw new Error('настройка не включилась');
  await js('Voice.hint(["Сожми (К1) до зелёной зоны", "act"], "mug")');
});
await step('Демо-режим ?demo=1: данные помечены плашкой', async () => {
  await go('?reset=1'); await js('S.onboarded = true; save(true)'); await go('?demo=1');
  await js('App.go("progress", {}, { fade: true })'); await sleep(900); await shot('07-demo-progress');
  if (!(await js('S.demo && !!document.querySelector("#demoTag")'))) throw new Error('нет плашки демо');
  if (!(await js('specialistReport(30).includes("демонстрационные данные")'))) throw new Error('отчёт не предупреждает о демо');
});
await step('Тёмная тема и планшет', async () => {
  await js('C().theme = "dark"; applyTheme(); App.go("home", {}, { fade: true })'); await sleep(800); await shot('08-dark-home');
  await js('KinetaTrainer.open("mug", { diff: 2 })'); await sleep(700); await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(3000); await shot('09-dark-mug');
  await js(STOP + ' SCR.play.finish()'); await sleep(800);
  await size(1024, 768, false); await js('C().theme = "light"; applyTheme(); App.go("games", {}, { fade: true })'); await sleep(900); await shot('10-tablet-games');
});

await step('Проверка датчиков перед игрой подстраивает калибровку', async () => {
  await size(390, 844); await js('C().theme = "light"; applyTheme(); C().quickCal = true; S.lastQC = 0; C().mode = "emg"; Ctrl.restart(); S.calib.done = true; save(true)');
  const before = await js('S.calib.mvc1');
  await js('KinetaTrainer.open("race", { diff: 1 })'); await sleep(800); await js('SCR.play.begin(App.cur.el)'); await sleep(400);
  if (!(await js('!!document.querySelector("#gQc")'))) throw new Error('нет экрана проверки');
  await shot('11-quickcal'); await sleep(1300); await js('Intent.auto = [.7, 0]'); await sleep(1800); await js('Intent.auto = [0, .7]'); await sleep(1900); await js('Intent.auto = null');
  if (await js('!!document.querySelector("#gQc")')) throw new Error('проверка не завершилась');
  if ((await js('S.calib.mvc1')) === before) throw new Error('калибровка не изменилась');
  await js(BOT); await sleep(6500); await js(STOP + ' SCR.play.finish()'); await sleep(1200);
  if (!(await js('!!document.querySelector(".emap")'))) throw new Error('нет карты игры на результате');
  await shot('12-result-map');
});
await step('Бесконечный режим: открывается после уровня 3, сложность меняется', async () => {
  await js('gst("flap").ls = [1, 1, 1]; save(true); App.go("games", {}, { fade: true })'); await sleep(700);
  await js('openGame("flap")'); await sleep(700); await js('document.querySelector(\'#lvP [data-l="4"]\').click()'); await sleep(300); await shot('13-endless-pick');
  await js('document.querySelector("#gGo").click()'); await sleep(900);
  if (!(await js('SCR.play.p.endless && SCR.play.p.diff === 3'))) throw new Error('не запустился бесконечный режим');
  await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(3500); await js(STOP + ' SCR.play.finish()'); await sleep(1200);
  if (!(await js('typeof gst("flap").adapt === "number"'))) throw new Error('сложность не записана');
  await shot('14-endless-result');
});
await step('Испытание недели и мастерская', async () => {
  await js('App.go("games", {}, { fade: true })'); await sleep(700); await js('document.querySelector("[data-weekly]").click()'); await sleep(600); await shot('15-weekly');
  await js('document.querySelector("#wGo").click()'); await sleep(900);
  if (!(await js('SCR.play.p.weekly'))) throw new Error('испытание недели не запустилось');
  await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(2500); await js(STOP + ' SCR.play.finish()'); await sleep(1200);
  if (!(await js('Weekly.cur().w.tries.length >= 1'))) throw new Error('попытка не записана');
  await js('Workshop.add("тест"); App.go("home", {}, { fade: true })'); await sleep(900);
  await js('document.querySelector("[data-ws]").scrollIntoView()'); await sleep(300); await shot('16-home-workshop');
  await js('document.querySelector("[data-ws]").click()'); await sleep(600); await shot('17-workshop');
  await js('document.querySelectorAll(".sheet").forEach(s => s.close?.())'); await sleep(400);
});
await step('Экран «Как работает сигнал» в ЭМГ и СПППР', async () => {
  await js('App.go("signal", {}, { fade: true }); Intent.auto = [.6, 0]'); await sleep(1500); await shot('18-signal-emg');
  await js('Intent.auto = null; C().mode = "spppr"; Ctrl.restart(); App.go("signal", {}, { fade: true, force: true }); Intent.auto = [0, .7]'); await sleep(1500); await shot('19-signal-spppr');
  await js('Intent.auto = null; C().mode = "emg"; Ctrl.restart()');
});
await step('Тёмная тема: ночные сцены во всех играх', async () => {
  await js('C().theme = "dark"; C().quickCal = false; applyTheme()');
  for (const g of games) { await js(`KinetaTrainer.open('${g}', { diff: 3 })`); await sleep(700); await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(4200); await shot(`20-dark-${g}`); await js(STOP + ' SCR.play.finish()'); await sleep(900); }
});
await step('Цвета руки, формы каналов, крупный режим, системная тема', async () => {
  await js('App.go("profile", {}, { fade: true })'); await sleep(700);
  for (const pal of ['graphite', 'warm', 'bright', 'titan']) { await js(`document.querySelector('[data-pal="${pal}"]').click()`); await sleep(200); }
  await js('document.querySelector(\'[data-pal="warm"]\').click()'); await js('App.go("home", {}, { fade: true })'); await sleep(800); await shot('21-hand-warm-dark');
  await js('C().handPal = "titan"; applyHand(); C().theme = "auto"; applyTheme(); C().big = true; applyBig(); App.go("home", {}, { fade: true })'); await sleep(800);
  if (!(await js('document.body.classList.contains("big") && ["light","dark"].includes(document.documentElement.dataset.theme)'))) throw new Error('крупный режим или авто-тема');
  await size(360, 780); await shot('22-big-360');
  const over = await js('document.querySelector("#view").scrollWidth - document.querySelector("#view").clientWidth'); if (over > 2) throw new Error('горизонтальная прокрутка в крупном режиме: ' + over);
  await js('App.go("profile", {}, { fade: true })'); await sleep(800); await shot('23-profile-big');
  await js('C().big = false; applyBig(); C().theme = "light"; applyTheme()'); await size(390, 844);
});

await step('Q&A 10: режим «Блокировка» — 4 варианта помещаются на 360 px, игра подсказывает о блокировке; без сокращений звёзд нет', async () => {
  await size(360, 780); await js('C().quickCal = false; C().coMode = "lock"; C().mode = "emg"; Ctrl.restart(); save(true)');
  await js('App.go("sensors", {}, { force: true })'); await sleep(800);
  await js('document.querySelector("[data-seg=co]").scrollIntoView({ block: "center" })'); await sleep(300);
  await js('Intent.auto = [.8, .8]'); await sleep(900); await shot('24-sensors-lock-360');
  const over = await js('document.querySelector("#view").scrollWidth - document.querySelector("#view").clientWidth'); if (over > 2) throw new Error('горизонтальная прокрутка ' + over);
  const segW = await js('(() => { const s = document.querySelector("[data-seg=co]"); return [...s.querySelectorAll("button")].map(b => b.scrollWidth - b.clientWidth); })()');
  if (segW.some(x => x > 1)) throw new Error('текст кнопок режима не помещается: ' + segW);
  await js('KinetaTrainer.open("race", { diff: 1 })'); await sleep(800); await js('SCR.play.begin(App.cur.el)'); await sleep(4500); await shot('24-race-lock');
  if (!(await js('document.querySelector("#gHint").textContent.includes("Блокировка")'))) throw new Error('нет подсказки о блокировке');
  await js('Intent.auto = null; SCR.play.finish()'); await sleep(1200); await shot('25-race-noact');
  if (!(await js('document.body.innerText.includes("Сокращений мышц почти не было")'))) throw new Error('нет совета «без сокращений звёзд нет»');
  await js('C().coMode = "both"; save(true)'); await size(390, 844);
});
report();
