// Презентация для сдачи (≤ 10 слайдов, PDF): HTML-слайды 1280×720 → печать в PDF через headless Chrome.
// Кадры игры — скриншоты сквозных тестов (tests/e2e/out, сначала npm run test:e2e).
//   node tools/docs/presentation.mjs        → docs/Kineta-presentation.pdf + tools/docs/out/slide-N.png (проверка)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, sleep } from '../../tests/e2e/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..');
const OUT = path.join(here, 'out'); fs.mkdirSync(OUT, { recursive: true });
const shots = path.join(ROOT, 'tests/e2e/out');
const img = n => { const f = path.join(shots, n + '.png'); if (!fs.existsSync(f)) throw new Error('нет кадра ' + n + ' — сначала npm run test:e2e'); return pathToFileURL(f).href; };
const font = f => pathToFileURL(path.join(ROOT, 'prototype/fonts', f)).href;
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const phone = (n, cap = '', h = 470) => `<figure class="ph" style="height:${h}px"><img src="${img(n)}" alt="${cap}">${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
const dot = (c, t) => `<span class="dot" style="background:${c}">${t}</span>`;
const box = (t, s = '', cls = '') => `<div class="bx ${cls}"><b>${t}</b>${s ? `<small>${s}</small>` : ''}</div>`;
const arrow = '<i class="ar"></i>';

const slides = [
// 1 — титул
`<section class="slide dark s1">
  <div class="l"><div class="logo"><span>✋</span>kineta</div>
    <h1>Игра-тренажёр управления бионическим протезом</h1>
    <p class="lead">Учит раздельно сокращать мышцы-антагонисты, дозировать силу и быстро переключаться — через игры, сюжет и понятную обратную связь</p>
    <div class="chips"><span>7 игр · 21 уровень + Школа</span><span>Поток 1 ЭМГ и Поток 2 СПППР</span><span>Android APK · iOS-проект</span></div>
    <p class="foot">Геймджем «Моторика. Код движения» · версия ${VERSION}</p></div>
  <div class="r">${phone('02-home', '', 540)}${phone('04-race-play', '', 540)}</div>
</section>`,
// 2 — цель и аудитория
`<section class="slide">
  <h2>Цель — чистые сигналы мышц, а не просто прохождение уровней</h2>
  <div class="cols">
    <div class="col">
      <div class="card"><h3>Проблема</h3><p>После выдачи протеза обучение короткое, дальше человек тренируется сам. Встречные сокращения мышцы-антагониста дают ошибки хвата — опасные, например, с горячей кружкой.</p></div>
      <div class="card"><h3>Решение</h3><p>Мобильный тренажёр: каждая игра отрабатывает конкретный навык управления, а качество сигнала (чистота, баланс каналов, утомление) видно после каждой игры.</p></div>
      <h3 class="h3">Для кого</h3>
      <div class="aud">${dot('#EE7A45', '1')}<div><b>Новые пользователи протезов</b><small>взрослые и подростки с 12 лет, с первого дня знакомства с протезом</small></div></div>
      <div class="aud">${dot('#3E9FD6', '2')}<div><b>Опытные пользователи</b><small>поддержание навыка: бесконечный режим, испытания, дуэль</small></div></div>
      <div class="aud">${dot('#9B78E8', '3')}<div><b>Специалисты по реабилитации</b><small>отчёт о динамике файлом или по QR-коду</small></div></div>
    </div>
    <div class="col stats">
      <div class="st"><b>≤ 100 мс</b><small>задержка управления, поток 1 (замер: 60–80 мс)</small></div>
      <div class="st"><b>60–80 %</b><small>времени — тайминги и удержание сигнала</small></div>
      <div class="st"><b>5–10 мин</b><small>сеанс, затем пауза на отдых; раньше — при спаде силы</small></div>
      <div class="st"><b>4 МБ</b><small>APK, без интернета</small></div>
    </div>
  </div>
</section>`,
// 3 — ввод сигнала
`<section class="slide">
  <h2>Ввод: два канала ЭМГ или вероятности СПППР → четыре состояния</h2>
  <div class="pipe"><span class="tag t1">Поток 1 · ЭМГ</span>
    ${box('Амплитуды', 'К1,&nbsp;К2: 0…255 + 2&nbsp;порога в пакете')}${arrow}${box('Нормализация', 'калибровка × чувствительность')}${arrow}${box('Сглаживание', 'EMA + ограничение скачков')}${arrow}${box('Dead-zone', 'фон = покой')}${arrow}${box('Порог + гистерезис', 'без дребезга')}${arrow}${box('Подавление ложных', '30&nbsp;мс')}</div>
  <div class="pipe"><span class="tag t2">Поток 2 · СПППР</span>
    ${box('JSON-пакет', 'timestamp_ms + 7&nbsp;вероятностей, ~10&nbsp;Гц')}${arrow}${box('Δt по часам МК', 'повтор и откат — в брак')}${arrow}${box('Интерполяция', 'τ = 0.6 × интервал')}${arrow}${box('Прощение ошибок', '1 пакет — вес 0.3')}${arrow}${box('flexion − extension', 'пронация = «обе»')}${arrow}${box('Устойчивый жест', '≥&nbsp;2&nbsp;пакетов, ≥&nbsp;120&nbsp;мс')}</div>
  <div class="states">
    <div class="sx" style="--c:#C8BAAE"><b>Покой</b><small>действие 4</small></div>
    <div class="sx" style="--c:#EE7A45"><b>К1 · закрыть</b><small>действие 1, сила = амплитуда</small></div>
    <div class="sx" style="--c:#3E9FD6"><b>К2 · открыть</b><small>действие 2, сила = амплитуда</small></div>
    <div class="sx" style="--c:#9B78E8"><b>Обе мышцы</b><small>действие 3 · смена жеста, нитро</small></div>
  </div>
  <p class="note2">Одновременная активация — 4 режима как у протеза: действие 3 · классика · спорт · блокировка. Нет пакетов &gt; 200 мс — плавная инерция к покою, &gt; 1.5 с — пауза «Сигнал потерян».</p>
</section>`,
// 4 — механики и навыки
`<section class="slide">
  <h2>Восемь механик — восемь навыков управления протезом</h2>
  <div class="grid4">
    ${[['Школа управления', 'режим обучения', 'раздельная активация, сила в зоне, чередование', '#DD6E96'],
       ['Нейро-гонка', 'руль = К2 − К1', 'пропорциональная сила, плавность', '#EE7A45'],
       ['Искра', 'цвет ворот = канал', 'быстрое переключение, сила = высота', '#3E9FD6'],
       ['Ритм-пульс', 'ноты К1 / К2 / обе', 'тайминг и удержание сокращения', '#9B78E8'],
       ['Рыбалка', 'натяжение в зоне', 'удержание силы, покой до поклёвки', '#36A872'],
       ['Горячая кружка', 'взять — нести — поставить', 'дозирование хвата, перенос в быт', '#D9574B'],
       ['Без экрана', 'команды голосом', 'связь «мышца — действие» без зрения', '#2BAAA8'],
       ['Реакция', 'сожми / раскрой / замри', 'скорость реакции, нет фальстартов', '#E3AE2D']]
      .map(([t, m, s, c]) => `<div class="gc" style="--c:${c}"><i></i><b>${t}</b><small class="m">${m}</small><small>${s}</small></div>`).join('')}
  </div>
  <p class="note2">В каждой игре работают оба канала; баланс К1/К2 считается, и при перекосе больше 60/40 задания сами смещаются к слабому каналу. На 6 жестах СПППР супинация, приведение и отведение задействованы в шести играх.</p>
</section>`,
// 5 — обучение и уровни
`<section class="slide">
  <h2>Обучающий режим, три уровня и сюжет от начала до конца</h2>
  <div class="cols c3">
    <div class="col">
      <div class="flow">
        <div class="fl">${dot('#EE7A45', '1')}<div><b>Проверка датчиков, 5 с</b><small>покой → К1 → К2: калибровка подстраивается под сегодняшнее положение электродов</small></div></div>
        <div class="fl">${dot('#DD6E96', '2')}<div><b>Школа управления</b><small>7–11 коротких шагов: покой, К1, К2, сила в зоне, чередование, обе мышцы</small></div></div>
        <div class="fl">${dot('#3E9FD6', '3')}<div><b>7 игр × 3 уровня</b><small>уровень открывается звездой; очень чисто — сразу следующий, точность ниже 45 % — совет уровень проще</small></div></div>
        <div class="fl">${dot('#9B78E8', '4')}<div><b>Бесконечный режим</b><small>дробная сложность 2…4.5: растёт после чистой игры, снижается после трудной</small></div></div>
        <div class="fl">${dot('#36A872', '5')}<div><b>Сюжет «Город Кинета»</b><small>8 районов с концовками, в каждой главе — «упражнение в жизни» с настоящим протезом</small></div></div>
      </div>
    </div>
    <div class="col phones">${phone('04-school-play', 'Школа управления', 540)}${phone('27-story-map', 'Карта сюжета', 540)}</div>
  </div>
</section>`,
// 6 — игровой процесс в кадрах
`<section class="slide">
  <h2>Игровой процесс в кадрах</h2>
  <div class="row4">${phone('04-race-play', 'Гонка: руль силой', 470)}${phone('04-mug-play', 'Кружка: хват в зоне', 470)}${phone('20-dark-flap', 'Искра: цвет = канал', 470)}${phone('12-result-map', 'Итоги и карта игры', 470)}</div>
  <div class="loop"><span>Проверка датчиков, 5 с</span>${arrow}<span>Уровень 1.5–2 мин</span>${arrow}<span>Итоги и карта сокращений</span>${arrow}<span>Звёзды, миссии, новый уровень</span></div>
</section>`,
// 7 — обратная связь и мотивация
`<section class="slide">
  <h2>Понятная обратная связь, мотивация и бережный режим</h2>
  <div class="cols c3">
    <div class="col phones">${phone('05-race-result', 'Итоги игры', 540)}${phone('07-demo-progress', 'Прогресс', 540)}</div>
    <div class="col">
      <div class="card"><h3>Качество управления</h3><p>Точность, чистота сигнала без встречных сокращений, баланс К1/К2, спад силы к концу игры (утомление), реакция, задержка — после каждой игры и в трендах за неделю и месяц.</p></div>
      <div class="card"><h3>Мотивация и удержание</h3><p>XP и ранги, 13 достижений, 3 миссии в день из 16 типов, испытания дня и недели, мастерская роботов, призрак лучшего заезда, дуэль на одном телефоне и рейтинг.</p></div>
      <div class="card"><h3>Бережно и доступно</h3><p>Пауза после 10 мин или при спаде силы, голосовые подсказки, детский и крупный режимы, тёмная тема, зеркальный интерфейс под здоровую руку, напоминание о тренировке.</p></div>
    </div>
  </div>
</section>`,
// 8 — техническая реализация и эмулятор
`<section class="slide">
  <h2>Техническая реализация и эмулятор сигнала</h2>
  <div class="arch">
    <div class="ac src"><b>Источники сигнала</b>
      <div class="mini">Эмулятор ЭМГ: клавиши F / J, тач-панели, джойстик</div>
      <div class="mini">Эмулятор СПППР: JSON с джиттером 10–110 мс, потерями и ошибками</div>
      <div class="mini">Пульт на втором телефоне (relay, SSE)</div>
      <div class="mini hl">Протез по Bluetooth LE</div></div>
    ${arrow}<div class="ac"><b>createSource()</b><small>одна точка выбора: эмулятор ↔ драйвер МК — одна строка</small></div>
    ${arrow}<div class="ac"><b>Ctrl — обработка</b><small>фильтры, пороги, 4 состояния, метрики, потеря связи</small></div>
    ${arrow}<div class="ac out"><b>Игры · Canvas 2D</b><b>Модель протеза</b><b>Интерфейс, прогресс</b><small>сохранение — localStorage</small></div>
  </div>
  <div class="cols">
    <div class="card"><h3>Стек</h3><p>JavaScript без сборщика, Canvas 2D, процедурная графика и звук (Web Audio). Мобильная оболочка Capacitor 7: Android APK и iOS-проект. Плагины: Bluetooth LE, синтез речи, вибрация, уведомления, файлы.</p></div>
    <div class="card"><h3>Жёсткий контракт данных</h3><p>Эмулятор, протез, пульт и хост-приложение выдают одинаковые пакеты: <code>{timestamp_ms, emg:[a1,a2], thr:[t1,t2]}</code> и <code>{timestamp_ms, dist:{…7 жестов…}}</code> — замена эмулятора не трогает игры.</p></div>
  </div>
  <pre class="light">// js/core.js — единственная точка выбора источника сигнала
const createSource = mode =&gt; BT.streaming() ? new BleProsthesisDriver(mode)
  : mode === 'emg' ? new EmgEmulator(Intent) : new SppprEmulator(Intent);</pre>
</section>`,
// 9 — результаты проверки
`<section class="slide">
  <h2>Результаты проверки</h2>
  <div class="tiles">
    <div class="tl"><b>68</b><small>юнит-тестов: конвейер сигнала, задержка, потеря пакетов, сохранения, стресс всех игр</small></div>
    <div class="tl"><b>34</b><small>сквозных сценария в Chrome: все игры в ЭМГ и СПППР, экраны 360–1280 px, 0 ошибок консоли</small></div>
    <div class="tl"><b>7 500</b><small>случайных нажатий «обезьяны» (5 прогонов) + фаззинг сохранений, ссылок, пакетов</small></div>
    <div class="tl"><b>60–80 мс</b><small>задержка ЭМГ в профиле «Норма»; ≤ 100 мс во всех профилях</small></div>
    <div class="tl"><b>130–150 мс</b><small>СПППР на 10 Гц с прощением единичной ошибки классификатора</small></div>
    <div class="tl"><b>4 МБ</b><small>APK; работает офлайн, без протеза — на эмуляторе</small></div>
  </div>
  <div class="card wide"><h3>Найдено тестами и исправлено</h3><p>XSS через ссылку возврата, загрязнение прототипа через postMessage, белый экран на повреждённом сохранении, звезда за бездействие в гонке, срабатывание канала от одного ошибочного пакета СПППР — всё закрыто тестами-регрессиями. Подробно: docs/AI_REPORT.md.</p></div>
</section>`,
// 10 — интеграция и развитие
`<section class="slide dark s10">
  <h2>Интеграция и развитие</h2>
  <div class="cols">
    <div class="col">
      <h3>Встраивание через роутинг</h3>
      <pre>kineta://train?hand=left&amp;thr1=97&amp;thr2=89
  &amp;return=motorika://kineta/result</pre>
      <pre>motorika://kineta/result?thr1=97&amp;thr2=89
  &amp;gain1=10&amp;gain2=10&amp;score=4120&amp;purity=76</pre>
      <p>Хост передаёт сторону руки и пороги, игра возвращает пороги, чувствительность и итоги сеанса. Плюс JS API и postMessage для потока сигнала, профиль GATT протеза, команда игрового режима протезу.</p>
      <h3>Уже работает</h3><p>Сюжет, дуэль и рейтинг, таблица клуба и отчёт специалисту по QR в локальной сети центра реабилитации.</p>
    </div>
    <div class="col">
      <h3>Следующие шаги</h3>
      <div class="aud">${dot('#EE7A45', '1')}<div><b>Тесты с пользователями протезов</b><small>на реальных телефонах и протезах «Инди», «Манифесто»</small></div></div>
      <div class="aud">${dot('#3E9FD6', '2')}<div><b>Облачный рейтинг и отчёты</b><small>через бэкенд Motorica Start вместо сервера клуба</small></div></div>
      <div class="aud">${dot('#9B78E8', '3')}<div><b>Многоканальная ЭМГ и новые жесты</b><small>расширение словаря состояний</small></div></div>
      <div class="aud">${dot('#36A872', '4')}<div><b>Коадаптация с СПППР</b><small>игровые сессии как разметка для дообучения классификатора</small></div></div>
    </div>
  </div>
</section>`
];

const css = `
@font-face{font-family:Nunito;src:url(${font('nunito-cyrillic.woff2')}) format('woff2');unicode-range:U+0400-04FF}
@font-face{font-family:Nunito;src:url(${font('nunito-latin.woff2')}) format('woff2')}
@page{size:1280px 720px;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Nunito,Arial,sans-serif;color:#2B2420;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.slide{width:1280px;height:720px;padding:46px 60px 40px;display:flex;flex-direction:column;position:relative;overflow:hidden;background:#FFFFFF;page-break-after:always;break-after:page}
.slide.dark{background:#211B18;color:#FFF7EE}
h1{font-size:48px;line-height:1.1;font-weight:900;margin:18px 0 16px}
h2{font-size:36px;line-height:1.15;font-weight:900;margin-bottom:10px;max-width:1120px;flex:none}
.fill{flex:1;display:flex;flex-direction:column;justify-content:center;gap:20px;min-height:0}
h3{font-size:21px;font-weight:900;margin-bottom:6px}
p,small{font-size:17px;line-height:1.45}
small{display:block;color:#7D6E63;font-weight:600}
.dark small{color:#CDBFB3}
.lead{font-size:20px;color:#EBDCCF;max-width:560px}
.logo{font-size:30px;font-weight:900;display:flex;align-items:center;gap:12px}.logo span{width:52px;height:52px;border-radius:16px;background:#EE7A45;display:grid;place-items:center;font-size:28px}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px;max-width:600px}.chips span{background:#3A302B;border-radius:999px;padding:9px 16px;font-weight:800;font-size:15px}
.foot{position:absolute;left:60px;bottom:40px;font-size:14px;color:#A8988C}
.s1{display:flex;flex-direction:row;gap:30px}.s1 .l{flex:1;padding-top:40px}.s1 .r{display:flex;gap:22px;align-items:center}
.ph{border-radius:26px;overflow:hidden;box-shadow:0 14px 34px rgba(40,25,15,.22);border:5px solid #2B2420;position:relative;aspect-ratio:390/844;background:#2B2420}
.ph img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.ph figcaption{position:absolute;left:0;right:0;bottom:0;padding:24px 10px 9px;background:linear-gradient(transparent,rgba(20,14,10,.88));color:#fff;font-weight:800;font-size:13.5px;text-align:center}
.cols{display:flex;gap:30px;align-items:stretch}.cols>.col{justify-content:center}.cols>.col{flex:1;display:flex;flex-direction:column;gap:14px}.cols.c3>.col:first-child{flex:1.25}
.card{background:#FBF4EA;border-radius:20px;padding:16px 20px}.card p{color:#4A3F38}
.dark .card{background:#2F2622}
.h3{margin-top:6px}
.aud,.fl{display:flex;gap:14px;align-items:flex-start}.aud b,.fl b{font-size:19px;font-weight:900}
.dot{flex:none;width:34px;height:34px;border-radius:50%;color:#fff;display:grid;place-items:center;font-weight:900;font-size:16px}
.stats{flex:.8!important;justify-content:center}.st{background:#FBF4EA;border-radius:20px;padding:16px 22px}.st b{font-size:40px;font-weight:900;color:#EE7A45;line-height:1}.st small{margin-top:4px}
.pipe{display:flex;align-items:center;gap:8px;position:relative;padding-top:30px}
.pipe .tag{position:absolute;top:0;left:0;font-weight:900;font-size:15px;border-radius:999px;padding:3px 12px;color:#fff}.t1{background:#EE7A45}.t2{background:#9B78E8}
.bx{flex:1;background:#FBF4EA;border-radius:16px;padding:14px 14px;min-height:112px}.bx b{display:block;font-size:17px;font-weight:900;line-height:1.2}.bx small{font-size:14.5px;margin-top:4px;line-height:1.35}
.ar{flex:none;width:14px;height:14px;border-top:3px solid #C9B6A6;border-right:3px solid #C9B6A6;transform:rotate(45deg);margin:0 2px}
.states{display:flex;gap:14px}.sx{flex:1;border-radius:16px;padding:16px 18px;background:color-mix(in srgb,var(--c) 16%,#fff);border:2px solid var(--c)}.sx b{font-size:19px;font-weight:900}
.note2{font-size:17px;color:#4A3F38;max-width:1150px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.gc{background:#FBF4EA;border-radius:20px;padding:20px 20px 20px;min-height:206px}.gc i{display:block;width:44px;height:44px;border-radius:50%;background:var(--c);margin-bottom:10px}.gc b{font-size:21px;font-weight:900;display:block}.gc .m{color:var(--c);font-weight:800;margin:2px 0 6px}
.flow{display:flex;flex-direction:column;gap:22px;justify-content:center;height:100%}
.phones{flex-direction:row!important;justify-content:center;gap:24px!important;flex:1!important}
.row4{display:flex;gap:22px;justify-content:center}
.loop{display:flex;align-items:center;gap:12px;justify-content:center}.loop span{background:#FBF4EA;border-radius:999px;padding:10px 18px;font-weight:800;font-size:16px;white-space:nowrap}
.arch{display:flex;align-items:stretch;gap:10px}
.ac{flex:1;background:#FBF4EA;border-radius:18px;padding:16px 18px;display:flex;flex-direction:column;justify-content:center;gap:6px}.ac b{font-size:16.5px;font-weight:900}
.arch .ar{align-self:center}.ac.src{flex:1.6}.ac.out{background:#FFE9DB}
.mini{background:#fff;border-radius:10px;padding:7px 11px;font-size:14.5px;font-weight:700}.mini.hl{background:#E6F2FB}
code{font-size:13.5px;background:#fff;border-radius:6px;padding:1px 5px}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.tl{background:#FBF4EA;border-radius:20px;padding:20px 22px;min-height:150px}.tl b{font-size:48px;font-weight:900;color:#EE7A45;line-height:1.05}.tl small{margin-top:6px}
.card.wide p{max-width:1100px}
.s10 h3{color:#FFB98A;margin-top:4px}.s10 .aud{margin-bottom:10px}.s10 p{color:#EBDCCF}.s10 .col{gap:12px}.s10 b{color:#FFF7EE}
pre{background:#2F2622;border-radius:14px;padding:14px 16px;font-size:16px;line-height:1.5;color:#FFD9BE;font-family:Consolas,monospace;white-space:pre}
pre.light{background:#2B2420;color:#FFD9BE;font-size:15.5px}
`;
const wrapped = slides.map((x, i) => i === 0 ? x : x.replace('</h2>', '</h2><div class="fill">').replace(/<\/section>$/, '</div></section>'));
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Kineta — презентация</title><style>${css}</style></head><body>${wrapped.join('\n')}</body></html>`;
const htmlFile = path.join(OUT, 'slides.html'); fs.writeFileSync(htmlFile, html);

const { cdp, size, report } = await launch();
await size(1280, 720, false);
await cdp('Page.navigate', { url: pathToFileURL(htmlFile).href }); await sleep(2500);
// проверка: каждый слайд отдельным PNG; переполнение текста по слайдам
for (let i = 0; i < slides.length; i++) {
  const r = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: i * 720, width: 1280, height: 720, scale: 1 }, captureBeyondViewport: true });
  fs.writeFileSync(path.join(OUT, `slide-${i + 1}.png`), Buffer.from(r.data, 'base64'));
}
const over = await cdp('Runtime.evaluate', { expression: `[...document.querySelectorAll('.slide')].map((s, i) => { const b = s.getBoundingClientRect(), bad = [...s.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > b.right - 30 || r.bottom > b.bottom - 20); }).map(e => e.className || e.tagName).slice(0, 3); return bad.length ? (i + 1) + ': ' + bad.join(',') : ''; }).filter(Boolean)`, returnByValue: true });
const pdf = await cdp('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
const outPdf = path.join(ROOT, 'docs', 'Kineta-presentation.pdf'); fs.writeFileSync(outPdf, Buffer.from(pdf.data, 'base64'));
console.log(`PDF: ${outPdf} · ${slides.length} слайдов · ${(fs.statSync(outPdf).size / 1048576).toFixed(1)} МБ`);
if (over.result.value.length) console.log('Выходит за поля: ' + over.result.value.join(' | '));
report();
