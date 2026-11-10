// Сквозной прогон в headless Chrome через DevTools Protocol (без зависимостей, Node ≥ 22).
// Онбординг → все вкладки → каждая игра с ботом-эмулятором мышц (ЭМГ и СПППР) → экран результата →
// профиль, отчёт для специалиста, демо-режим, тёмная тема, планшет. Критерий: 0 исключений и 0 ошибок консоли.
//   node tests/e2e/smoke.mjs            — скриншоты в tests/e2e/out/
//   CHROME=путь node tests/e2e/smoke.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { launch, sleep, out, root, BOT, STOP } from './cdp.mjs';

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
await step('Сюжет: пролог, закрытые главы, концовка главы и упражнение в жизни на результате', async () => {
  await size(390, 844); await go('?reset=1', 1500); await js('S.onboarded = true; S.perms.bt = "demo"; C().quickCal = false; save(true)'); await go('', 2500);
  if (!(await js('document.body.innerText.includes("Сюжет · Город Кинета")'))) throw new Error('нет карточки сюжета на главной');
  await js('App.go("story", {}, { fade: true })'); await sleep(900);
  if (!(await js('!!document.querySelector(".modal") && document.querySelector(".modal").innerText.includes("Город механизмов")'))) throw new Error('нет пролога при первом входе');
  await shot('26-story-prologue'); await js('document.querySelector(".modal [data-x=go]").click()'); await sleep(400);
  if (!(await js('document.querySelector("[data-ch=\'1\']").classList.contains("lock")'))) throw new Error('глава 1 должна быть закрыта до Школы');
  await shot('27-story-map');
  await js('gst("school").plays = 1; save(true); App.go("story", {}, { fade: true, force: true })'); await sleep(700);
  await js('document.querySelector("[data-ch=\'1\']").click()'); await sleep(700);
  if (!(await js('document.querySelector(".sheet").innerText.includes("Упражнение в жизни")'))) throw new Error('нет упражнения в жизни в главе');
  await shot('28-story-chapter');
  await js('document.querySelector(".sheet [data-ep=\'1\']").click()'); await sleep(900);
  if (!(await js('App.cur.name === "play" && SCR.play.p.story && document.querySelector("#gIntro").innerText.includes("Утренний рейс")'))) throw new Error('эпизод не открыл игру с названием');
  await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(2500);
  await js(`${STOP} gst("race").ls = [1, 1, 1]; SCR.play.finish()`); await sleep(1400);
  if (!(await js('!!document.querySelector(".story-end") && document.body.innerText.includes("Дорога запчастей")'))) throw new Error('нет концовки главы на результате');
  if (!(await js('!!S.story.done.race'))) throw new Error('глава не отмечена пройденной');
  await shot('29-story-result');
});
await step('Дуэль: два хода по очереди, калибровка и статистика владельца не тронуты, рейтинг', async () => {
  await js('C().mode = "emg"; Ctrl.restart(); S.calib.mvc1 = .77; S.calib.done = true; save(true)');
  const hist0 = await js('S.history.length'), xp0 = await js('S.profile.xp');
  await js('App.go("games", {}, { fade: true })'); await sleep(700); await js('document.querySelector("[data-duel]").click()'); await sleep(600);
  await js('document.querySelectorAll("[data-n]")[0].value = "Ира"; document.querySelectorAll("[data-n]")[1].value = "Олег"; document.querySelector("#dG [data-g=react]").click()'); await shot('30-duel-setup');
  await js('document.querySelector("#dGo").click()'); await sleep(600);
  for (const who of ['Ира', 'Олег']) {
    if (!(await js(`document.querySelector(".modal")?.innerText.includes("Ход: ${who}")`))) throw new Error('нет окна хода ' + who);
    await js('document.querySelector(".modal [data-x=go]").click()'); await sleep(900);
    if (!(await js(`SCR.play.p.duel === "${who}"`))) throw new Error('ход не того игрока');
    await js('SCR.play.begin(App.cur.el)'); await sleep(400);
    if (!(await js('!!document.querySelector("#gQc")'))) throw new Error('нет проверки датчиков перед ходом');
    if (who === 'Ира') { await sleep(1300); await js('Intent.auto = [.9, 0]'); await sleep(1800); await js('Intent.auto = [0, .9]'); await sleep(1900); await js('Intent.auto = null'); await sleep(3000); }
    else { await js('document.querySelector("#qcSkip").click()'); await sleep(3600); }
    await js(`${BOT}`); await sleep(2500); await js(`${STOP} SCR.play.finish()`); await sleep(1300);
    if ((await js('App.cur.name')) !== 'duel') throw new Error('после хода нет экрана дуэли');
    if ((await js('S.calib.mvc1')) !== .77) throw new Error('калибровка владельца изменилась');
    if (who === 'Ира' && (await js('Duel.st.cal["Ира"].mvc1')) === .77) throw new Error('калибровка игрока не обновилась проверкой датчиков');
    if (who === 'Ира') { await shot('31-duel-mid'); await js('document.querySelector("#duNext").click()'); await sleep(600); }
  }
  if (!(await js(`/побеждает|Ничья/.test(document.body.innerText)`))) throw new Error("нет итога дуэли");
  await shot('32-duel-result');
  if ((await js('S.history.length')) !== hist0 || (await js('S.profile.xp')) !== xp0) throw new Error('ходы дуэли попали в статистику владельца');
  if ((await js('Board.rows().length')) !== 2) throw new Error('нет рейтинга игроков');
  await js('App.go("duel", {}, { force: true })'); await sleep(300);
  if ((await js('Board.rows().reduce((a, p) => a + p.games, 0)')) !== 2) throw new Error('перерисовка задвоила рейтинг');
  await js('App.go("games", {}, { fade: true })'); await sleep(500);
});
await step('Таблица клуба: relay в локальной сети принимает результат недели, кириллица не искажается', async () => {
  const port = 18000 + Math.floor(Math.random() * 1000);
  const relay = spawn(process.execPath, [root + '/tools/relay.mjs', String(port)], { stdio: 'ignore' });
  try {
    await sleep(900);
    await js(`C().club = "http://127.0.0.1:${port}"; S.profile.name = "Алексей Ёжиков"; save(true)`);
    await js('(() => { const c = Weekly.cur(); App.go("play", { id: c.id, diff: c.lv, weekly: true }); })()'); await sleep(900);
    await js(`SCR.play.begin(App.cur.el); ${BOT}`); await sleep(2500); await js(`${STOP} SCR.play.finish()`); await sleep(1500);
    const wk = await js('Weekly.cur().k'), got = await (await fetch(`http://127.0.0.1:${port}/board?week=${wk}`)).json();
    if (!got.rows?.some(x => x.name === 'Алексей Ёжиков')) throw new Error('результат не дошёл или имя искажено: ' + JSON.stringify(got).slice(0, 200));
    await js('App.go("games", {}, { fade: true })'); await sleep(600); await js('document.querySelector("[data-weekly]").click()'); await sleep(1500);
    if (!(await js('document.querySelector("#wClub").innerText.includes("Алексей Ёжиков (вы)")'))) throw new Error('таблица клуба не показана в испытании недели');
    await shot('33-club-board');
    await js('document.querySelectorAll(".sheet").forEach(s => s.close?.()); C().club = ""; save(true)'); await sleep(400);
  } finally { relay.kill(); }
});
report();
