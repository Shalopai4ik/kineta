// Презентация, вариант 2.0 (строгий деловой стиль, ≤ 10 слайдов, PDF). Первый вариант — presentation.mjs.
//   node tools/docs/presentation-v2.mjs → docs/Kineta-presentation-v2.0.pdf + tools/docs/out/v2-slide-N.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, sleep } from '../../tests/e2e/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..');
const OUT = path.join(here, 'out'); fs.mkdirSync(OUT, { recursive: true });
const shots = path.join(ROOT, 'tests/e2e/out');
const img = n => { const f = path.join(shots, n + '.png'); if (!fs.existsSync(f)) throw new Error('нет кадра ' + n + ' — сначала npm run test:e2e'); return pathToFileURL(f).href; };
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const DATE = new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

const ph = (n, cap, h = 440) => `<figure class="ph" style="height:${h}px"><img src="${img(n)}" alt="${cap}"><figcaption>${cap}</figcaption></figure>`;
const tbl = (head, rows) => `<table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const num = (n, t, s) => `<div class="num"><span>${n}</span><div><b>${t}</b>${s ? `<small>${s}</small>` : ''}</div></div>`;
const bx = (t, s) => `<div class="bx"><b>${t}</b>${s ? `<small>${s}</small>` : ''}</div>`;
const ar = '<i class="ar"></i>';

const slides = [
`<section class="slide cover">
  <div class="cv">
    <p class="kicker">Геймджем «Моторика. Код движения» · ${DATE}</p>
    <h1>Kineta</h1>
    <p class="sub">Мобильная игра-тренажёр управления бионическим протезом верхней конечности через двухканальную ЭМГ и систему распознавания жестов (СПППР)</p>
    <table class="meta"><tr><td>Платформы</td><td>Android (APK), iOS (проект Xcode)</td></tr><tr><td>Потоки управления</td><td>Поток 1 — ЭМГ, Поток 2 — СПППР</td></tr><tr><td>Содержание</td><td>Школа управления, 7 игр × 3 уровня, бесконечный режим, сюжет</td></tr><tr><td>Версия</td><td>${VERSION}</td></tr></table>
  </div>
  <div class="cvr">${ph('02-home', 'Главный экран', 560)}</div>
</section>`,

`<section class="slide">
  <header><h2>1. Цель и аудитория</h2></header>
  <div class="two">
    <div>
      <h3>Задача</h3>
      <p>Новые пользователи протезов после короткого обучения тренируются самостоятельно. Главная ошибка — совместное сокращение мышц-антагонистов: протез выполняет не то действие, предмет падает или сдавливается.</p>
      <h3>Цель игры</h3>
      <p>Довести до автоматизма изолированное сокращение сгибателей и разгибателей, дозирование силы и длительности, быстрое переключение каналов и устойчивую связь «мышца — действие» — в безопасной игровой среде с измеримым прогрессом.</p>
      <h3>Аудитория</h3>
      ${tbl(['Группа', 'Что получает'], [['Новые пользователи, от 12 лет', 'Школа управления, сюжет с понятной целью, детский режим'], ['Опытные пользователи', 'Бесконечный режим, испытания дня и недели, дуэль, рейтинг'], ['Специалист по реабилитации', 'Отчёт о динамике чистоты сигнала, баланса и утомления — файлом или по QR-коду']])}
    </div>
    <div class="kpis">
      <div class="kpi"><b>≤ 100 мс</b><small>задержка управления в Потоке 1 (измерено: 60–80 мс)</small></div>
      <div class="kpi"><b>60–80 %</b><small>времени сеанса — управление с критичными таймингами</small></div>
      <div class="kpi"><b>5–10 мин</b><small>сеанс; пауза по времени или по спаду силы</small></div>
      <div class="kpi"><b>4 МБ</b><small>размер APK; работает без интернета</small></div>
    </div>
  </div>
</section>`,

`<section class="slide">
  <header><h2>2. Ввод сигнала: Поток 1 (ЭМГ) и Поток 2 (СПППР)</h2></header>
  <h3>Поток 1 — две амплитуды 0…255 и два порога в каждом пакете, ~100 Гц</h3>
  <div class="pipe">${bx('Нормализация', 'калибровка, чувствительность')}${ar}${bx('Сглаживание', 'EMA, ограничение скачка')}${ar}${bx('Dead-zone', 'фон = покой')}${ar}${bx('Порог с гистерезисом', 'без дребезга')}${ar}${bx('Подавление ложных', '30 мс')}${ar}${bx('Состояние', 'покой · К1 · К2 · обе')}</div>
  <h3>Поток 2 — JSON с вероятностями 7 жестов, ~10 Гц, джиттер 10–100+ мс</h3>
  <div class="pipe">${bx('Δt по часам МК', 'повтор и откат — брак')}${ar}${bx('Нормировка', 'softmax, 2 или 6 жестов')}${ar}${bx('Прощение ошибки', 'вес 0.3 до подтверждения')}${ar}${bx('Интерполяция', 'τ = 0.6 × интервал')}${ar}${bx('flexion − extension', 'пронация = «обе»')}${ar}${bx('Устойчивый жест', '≥ 2 пакетов, ≥ 120 мс')}</div>
  ${tbl(['Состояние', 'Пороговый режим', 'Пропорциональный режим', 'Потеря связи'], [
    ['К1 изолированно', 'действие 1 — «закрыть»', 'амплитуда = сила, скорость', '> 200 мс — инерция к покою'],
    ['К2 изолированно', 'действие 2 — «открыть»', 'амплитуда = сила, скорость', '> 1,5 с — пауза «Сигнал потерян»'],
    ['К1 + К2', 'действие 3 (режимы: действие 3 · классика · спорт · блокировка)', '—', 'возврат — по восстановлению'],
    ['Покой', 'действие 4', '—', '—']])}
</section>`,

`<section class="slide">
  <header><h2>3. Механики и тренируемые навыки</h2></header>
  ${tbl(['Игра', 'Управление', 'Навык по ТЗ', 'Метрика результата'], [
    ['Школа управления (режим обучения)', 'покой, К1, К2, сила в зоне, чередование, обе мышцы', 'раздельная активация мышечных групп', 'ошибки «не та мышца», шаги'],
    ['Нейро-гонка', 'руль = разница силы К2 и К1; обе — нитро', 'контроль силы, плавность', 'время на обочине, аварии, баланс'],
    ['Искра', 'взмах мышцей по цвету ворот; сила = высота', 'быстрое переключение каналов', 'ворота, не тем каналом'],
    ['Ритм-пульс', 'ноты К1 / К2 / обе, длинные — удержание', 'тайминг, длительность сокращения', 'точность, комбо, сорванные удержания'],
    ['Рыбалка', 'покой до поклёвки, подсечка, натяжение в зоне', 'удержание уровня сокращения', 'время в зоне, сорвалось, испугал'],
    ['Горячая кружка', 'раскрыть, сжать в зону, расслабиться, нести, поставить', 'дозирование хвата, перенос в быт', 'треснула, выскользнула, пролито'],
    ['Без экрана', 'голосовые команды, экран выключен', 'связь «мышца — действие», снижение когнитивной нагрузки', 'верно, реакция, не тем каналом'],
    ['Реакция', 'сожми / раскрой / замри по сигналу', 'скорость реакции, нет фальстартов', 'мс, фальстарты, изоляция']])}
  <p class="foot">В каждой игре задействованы оба канала; при перекосе баланса больше 60/40 задания для слабого канала выпадают чаще. На словаре из 6 жестов СПППР супинация, приведение и отведение используются в шести играх.</p>
</section>`,

`<section class="slide">
  <header><h2>4. Обучающий режим, уровни и адаптация сложности</h2></header>
  <div class="two">
    <div>
      ${num('1', 'Проверка датчиков перед игрой', '5 с: покой → К1 → К2; калибровка подстраивается под положение электродов (не чаще раза в 10 мин)')}
      ${num('2', 'Школа управления', '7–11 шагов; шаг засчитывается удержанием нужного состояния; на 6 жестах СПППР — 4 дополнительных шага')}
      ${num('3', 'Три уровня в каждой игре', 'следующий открывается одной звездой; очень чистая игра открывает его сразу; точность ниже 45 % — совет уровень проще')}
      ${num('4', 'Бесконечный режим', 'дробная сложность 2…4,5: +0,3 после чистой победы, −0,25 после трудной игры')}
      ${num('5', 'Сюжет «Город Кинета»', 'пролог → 7 глав по 3 эпизода → эпилог; в каждой главе «упражнение в жизни» с настоящим протезом')}
      ${num('6', 'Бережный режим', 'пауза после 10 мин или при спаде силы > 25 %; без сокращений мышц звёзды не начисляются')}
    </div>
    <div class="row">${ph('04-school-play', 'Школа управления', 470)}${ph('13-endless-pick', 'Выбор уровня и бесконечный режим', 470)}</div>
  </div>
</section>`,

`<section class="slide">
  <header><h2>5. Игровой процесс</h2></header>
  <div class="row4">${ph('04-race-play', 'Нейро-гонка', 450)}${ph('04-rhythm-play', 'Ритм-пульс', 450)}${ph('04-fish-play', 'Рыбалка', 450)}${ph('04-mug-play', 'Горячая кружка', 450)}</div>
  <div class="pipe steps">${bx('Карточка уровня', 'цель и управление')}${ar}${bx('Проверка датчиков', '5 с')}${ar}${bx('Уровень', '1,5–2 мин непрерывного управления')}${ar}${bx('Результат', 'точность, чистота, баланс, карта')}${ar}${bx('Награды', 'звёзды, миссии, следующий уровень')}</div>
</section>`,

`<section class="slide">
  <header><h2>6. Обратная связь и мотивация</h2></header>
  <div class="two">
    <div class="row">${ph('12-result-map', 'Результат: метрики и карта встречных сокращений', 500)}${ph('07-demo-progress', 'Прогресс: тренды и навыки', 500)}</div>
    <div>
      ${tbl(['Показатель', 'Как считается'], [['Точность', 'доля верно выполненных заданий игры'], ['Чистота сигнала', 'доля времени без встречной активации антагониста'], ['Баланс К1 / К2', 'доля работы каждого канала (норма ≈ 50/50)'], ['Утомление', 'спад пиковой амплитуды к концу игры'], ['Реакция, задержка', 'мс от сигнала до действия; от порога до состояния']])}
      <h3>Удержание пользователя</h3>
      <p>XP и ранги, 13 достижений, 3 миссии в день из пула 16 типов, испытания дня (×2 XP) и недели, мастерская роботов, призрак лучшего заезда, дуэль на одном телефоне, рейтинг, напоминание о тренировке.</p>
      <p>Обратная связь от пользователя: оценка «тяжело / нормально / легко» после каждой игры, отзыв в профиле, экспорт данных.</p>
    </div>
  </div>
</section>`,

`<section class="slide">
  <header><h2>7. Техническая реализация и эмулятор сигнала</h2></header>
  <div class="arch">
    <div class="ac"><b>Источники сигнала</b><ul><li>Эмулятор ЭМГ: клавиатура, тач-панели, джойстик</li><li>Эмулятор СПППР: шум, ошибки 4 %, потери 5 %, джиттер 10–110 мс</li><li>Пульт на втором телефоне</li><li>Протез по Bluetooth LE</li></ul></div>${ar}
    <div class="ac"><b>createSource()</b><small>единственная точка выбора источника; контракт start(cb) / stop()</small></div>${ar}
    <div class="ac"><b>Ctrl — обработка</b><small>фильтры, пороги, 4 состояния, метрики, потеря связи</small></div>${ar}
    <div class="ac"><b>Игры · модель протеза · интерфейс</b><small>Canvas 2D, localStorage</small></div>
  </div>
  ${tbl(['Слой', 'Решение'], [['Движок и язык', 'Собственный движок на Canvas 2D, JavaScript без сборщика; графика и звук процедурные'], ['Мобильная оболочка', 'Capacitor 7: Android (minSdk 26), iOS; плагины Bluetooth LE, TTS, вибрация, уведомления, файлы'], ['Контракт данных', '<code>{timestamp_ms, emg:[a1,a2], thr:[t1,t2]}</code> и <code>{timestamp_ms, dist:{…7 жестов…}}</code> — одинаковы для эмулятора и протеза'], ['Замена эмулятора', 'Драйвер микроконтроллера подставляется в одну строку <code>createSource</code> или подаёт поток через <code>KinetaTrainer.pushEmg / pushSpppr</code>']])}
</section>`,

`<section class="slide">
  <header><h2>8. Результаты проверки</h2></header>
  ${tbl(['Проверка', 'Объём', 'Результат'], [
    ['Юнит-тесты (node:test, искусственные часы)', '68 тестов: конвейер сигнала обоих потоков, задержка, потери, джиттер, сохранения, стресс всех игр', 'все пройдены'],
    ['Сквозные сценарии (headless Chrome, DevTools Protocol)', '34 сценария: все игры в ЭМГ и СПППР, экраны 360–1280 px, темы, дуэль, сюжет, отчёт по QR', '34 / 34, 0 ошибок консоли'],
    ['Стресс-тест и фаззинг', 'повреждённые сохранения, мусорные deep link, postMessage и пакеты; 7 500 случайных нажатий (5 прогонов)', '30 / 30 сценариев'],
    ['Задержка, Поток 1', 'от превышения порога до смены состояния, три профиля чувствительности', '60–80 мс («Норма»), ≤ 100 мс во всех'],
    ['Отклик, Поток 2', 'на 10 Гц с прощением единичной ошибки классификатора', '130–150 мс'],
    ['Сборка', 'Android APK (Gradle), iOS-проект (Xcode)', 'APK 4 МБ собран; iOS — требуется Mac']])}
  <h3>Найдено тестами и исправлено</h3>
  <p>Выполнение кода через ссылку возврата (XSS), загрязнение прототипа через postMessage, белый экран на повреждённом сохранении, начисление звезды за бездействие, срабатывание канала от одного ошибочного пакета СПППР. Все случаи закрыты регрессионными тестами.</p>
</section>`,

`<section class="slide">
  <header><h2>9. Интеграция и развитие</h2></header>
  <div class="two">
    <div>
      <h3>Встраивание через роутинг</h3>
      <pre>kineta://train?hand=left&amp;thr1=97&amp;thr2=89&amp;mode=emg
       &amp;return=motorika://kineta/result
→ motorika://kineta/result?thr1=97&amp;thr2=89&amp;gain1=10
       &amp;gain2=10&amp;score=4120&amp;acc=82&amp;purity=76</pre>
      <p>Хост передаёт сторону руки, пороги и чувствительность; игра возвращает их (с правками пользователя) и итоги сеанса. Для потока сигнала — JS API <code>KinetaTrainer</code> и <code>postMessage</code>; для протеза — профиль GATT и команда игрового режима.</p>
      <h3>Документация</h3>
      <p>Техническая документация, инструкция по интеграции, отчёт об использовании ИИ, таблица соответствия ТЗ — в составе решения.</p>
    </div>
    <div>
      <h3>Дальнейшие шаги</h3>
      ${num('1', 'Испытания с пользователями протезов', 'на реальных устройствах и протезах с двухканальной ЭМГ')}
      ${num('2', 'Облачный рейтинг и отчёты', 'через серверную часть приложения производителя')}
      ${num('3', 'Многоканальная ЭМГ', 'расширение словаря состояний и игровых команд')}
      ${num('4', 'Коадаптация с СПППР', 'игровые сессии как размеченные данные для дообучения классификатора')}
    </div>
  </div>
</section>`
];

const css = `
@page{size:1280px 720px;margin:0}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;color:#1A1F2B;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.slide{width:1280px;height:720px;padding:40px 60px 36px;position:relative;overflow:hidden;background:#fff;page-break-after:always;break-after:page;display:flex;flex-direction:column;gap:14px}
header h2{font-size:30px;font-weight:700;color:#1E2A44;padding-bottom:10px;border-bottom:2px solid #1E2A44}
h3{font-size:19px;font-weight:700;color:#1E2A44;margin:6px 0 6px}
p,small,li,td,th{font-size:16px;line-height:1.4}
small{display:block;color:#4C5566}
.cover{background:#1E2A44;color:#fff;flex-direction:row;align-items:center;gap:50px;padding:60px}
.cv{flex:1}.kicker{font-size:15px;color:#B9C4DC;letter-spacing:.04em;text-transform:uppercase}
.cover h1{font-size:72px;font-weight:700;margin:14px 0 10px}.cover .sub{font-size:21px;line-height:1.4;color:#E4E9F4;max-width:600px;margin-bottom:28px}
.meta{border-collapse:collapse}.meta td{font-size:15px;padding:6px 14px 6px 0;color:#E4E9F4;border-bottom:1px solid #3A4866}.meta td:first-child{color:#B9C4DC;width:190px}
.cvr{flex:none}
.ph{border:1px solid #CBD2DF;border-radius:10px;overflow:hidden;aspect-ratio:390/844;position:relative;background:#fff}
.ph img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.ph figcaption{position:absolute;left:0;right:0;bottom:0;background:#1E2A44;color:#fff;font-size:12.5px;padding:6px 8px;text-align:center}
.two{display:flex;gap:36px;flex:1;min-height:0}.two>div{flex:1;min-width:0}.two>.row{flex:none}
.row{display:flex;gap:20px;justify-content:center;align-items:flex-start}.row4{display:flex;gap:22px;justify-content:center}
.kpis{display:flex;flex-direction:column;gap:14px;justify-content:center;flex:.7!important}.kpi{border:1px solid #CBD2DF;border-left:6px solid #1E2A44;padding:12px 16px}.kpi b{font-size:30px;color:#1E2A44;display:block}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #CBD2DF;padding:8px 12px;text-align:left;vertical-align:top}th{background:#EEF1F7;font-weight:700;color:#1E2A44}
.pipe{display:flex;align-items:stretch;gap:8px}.bx{flex:1;border:1px solid #CBD2DF;padding:11px 13px;min-height:80px}.bx b{display:block;font-size:16.5px;color:#1E2A44}.bx small{font-size:14px;margin-top:3px}
.ar{flex:none;width:12px;height:12px;border-top:2px solid #7A869C;border-right:2px solid #7A869C;transform:rotate(45deg);align-self:center}
.steps .bx{min-height:60px}
.num{display:flex;gap:12px;align-items:flex-start;margin-bottom:18px}.num span{flex:none;width:30px;height:30px;border-radius:50%;background:#1E2A44;color:#fff;font-weight:700;display:grid;place-items:center;font-size:15px}.num b{font-size:18px;color:#1E2A44}
.foot{color:#4C5566;font-size:14.5px}
.arch{display:flex;gap:10px;align-items:stretch}.ac{flex:1;border:1px solid #CBD2DF;padding:12px 14px}.ac b{display:block;font-size:16px;color:#1E2A44;margin-bottom:4px}.ac ul{padding-left:18px}.ac li{font-size:15px;margin-bottom:4px}.ac:first-child{flex:1.4}
pre{font-family:Consolas,monospace;font-size:15.5px;line-height:1.5;background:#EEF1F7;padding:12px 14px;border:1px solid #CBD2DF;white-space:pre;margin-bottom:10px}
code{font-family:Consolas,monospace;font-size:13.5px;background:#EEF1F7;padding:1px 4px}
.pn{position:absolute;right:60px;bottom:16px;font-size:12px;color:#7A869C}
`;
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Kineta — презентация v2.0</title><style>${css}</style></head><body>${slides.map((s, i) => s.replace(/<\/section>$/, `<span class="pn">Kineta · ${i + 1} / ${slides.length}</span></section>`)).join('\n')}</body></html>`;
const htmlFile = path.join(OUT, 'slides-v2.html'); fs.writeFileSync(htmlFile, html);

const { cdp, size, report } = await launch();
await size(1280, 720, false); await cdp('Page.navigate', { url: pathToFileURL(htmlFile).href }); await sleep(2500);
for (let i = 0; i < slides.length; i++) { const r = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: i * 720, width: 1280, height: 720, scale: 1 }, captureBeyondViewport: true }); fs.writeFileSync(path.join(OUT, `v2-slide-${i + 1}.png`), Buffer.from(r.data, 'base64')); }
const over = await cdp('Runtime.evaluate', { expression: `[...document.querySelectorAll('.slide')].map((s, i) => { const b = s.getBoundingClientRect(), bad = [...s.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > b.right - 30 || r.bottom > b.bottom - 14); }).map(e => e.className || e.tagName).slice(0, 3); return bad.length ? (i + 1) + ': ' + bad.join(',') : ''; }).filter(Boolean)`, returnByValue: true });
const pdf = await cdp('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
const outPdf = path.join(ROOT, 'docs', 'Kineta-presentation-v2.0.pdf'); fs.writeFileSync(outPdf, Buffer.from(pdf.data, 'base64'));
console.log(`PDF: ${outPdf} · ${slides.length} слайдов · ${(fs.statSync(outPdf).size / 1048576).toFixed(1)} МБ`);
if (over.result.value.length) console.log('Выходит за поля: ' + over.result.value.join(' | '));
report();
