// Документы для сдачи (DOCX): отчёт об использовании ИИ и техническая документация.
// Схемы — снимки из слайдов (сначала node tools/docs/presentation.mjs), кадры — из tests/e2e/out.
//   node tools/docs/docs.mjs → docs/Kineta-AI-report.docx, docs/Kineta-technical-documentation.docx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, ImageRun, AlignmentType, LevelFormat, BorderStyle, Footer, PageNumber, TableLayoutType } from 'docx';
import { launch, sleep } from '../../tests/e2e/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..'), OUT = path.join(here, 'out');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

/* ---------- схемы из слайдов в двойном разрешении ---------- */
const slidesHtml = path.join(OUT, 'slides.html');
if (!fs.existsSync(slidesHtml)) throw new Error('нет tools/docs/out/slides.html — сначала node tools/docs/presentation.mjs');
const { cdp, size, report } = await launch();
await size(1280, 720, false); await cdp('Page.navigate', { url: pathToFileURL(slidesHtml).href }); await sleep(2200);
async function clip(slide, sel) { // прямоугольник элементов sel на слайде slide (с 1)
  const r = (await cdp('Runtime.evaluate', { expression: `(() => { const s = document.querySelectorAll('.slide')[${slide - 1}], els = [...s.querySelectorAll(${JSON.stringify(sel)})], R = els.map(e => e.getBoundingClientRect()); return { x: Math.min(...R.map(r => r.left)) - 8, y: Math.min(...R.map(r => r.top)) + scrollY - 8, w: Math.max(...R.map(r => r.right)) - Math.min(...R.map(r => r.left)) + 16, h: Math.max(...R.map(r => r.bottom)) - Math.min(...R.map(r => r.top)) + 16 }; })()`, returnByValue: true })).result.value;
  const sh = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 2 }, captureBeyondViewport: true });
  return { data: Buffer.from(sh.data, 'base64'), w: r.w, h: r.h };
}
const DIA_ARCH = await clip(8, '.arch'), DIA_PIPE = await clip(3, '.pipe, .states');
report();
const shot = n => fs.readFileSync(path.join(ROOT, 'tests/e2e/out', n + '.png'));

/* ---------- общий стиль ---------- */
const FONT = 'Calibri', MONO = 'Consolas', ACCENT = 'C4581F', MUTED = '6B5E55', CW = 9638; // ширина текста A4 при полях 2 см, DXA
const styles = {
  default: { document: { run: { font: FONT, size: 22 }, paragraph: { spacing: { after: 100, line: 276 } } } },
  paragraphStyles: [
    { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: FONT, size: 44, bold: true, color: '2B2420' }, paragraph: { spacing: { before: 0, after: 80 } } },
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 30, bold: true, color: ACCENT }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, keepLines: true, outlineLevel: 0 } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 25, bold: true, color: '2B2420' }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, keepLines: true, outlineLevel: 1 } },
    { id: 'Code', name: 'Code', basedOn: 'Normal', run: { font: MONO, size: 17, color: '2B2420' }, paragraph: { spacing: { before: 0, after: 0, line: 240 }, shading: { type: ShadingType.CLEAR, fill: 'F5EFE8', color: 'auto' }, indent: { left: 120, right: 120 } } }
  ]
};
const numbering = { config: [
  { reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] },
  { reference: 'n', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 300 } } } }] }
] };
/* разметка в строке: **жирный**, `код` */
const runs = (t, base = {}) => String(t).split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean).map(x => x.startsWith('**') ? new TextRun({ text: x.slice(2, -2), bold: true, ...base }) : x.startsWith('`') ? new TextRun({ text: x.slice(1, -1), font: MONO, size: 19, ...base }) : new TextRun({ text: x, ...base }));
const P = (t, o = {}) => new Paragraph({ children: runs(t, o.run), spacing: o.spacing, alignment: o.align });
const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const B = list => list.map(t => new Paragraph({ numbering: { reference: 'b', level: 0 }, children: runs(t), spacing: { after: 60 } }));
const N = (list, inst) => list.map(t => new Paragraph({ numbering: { reference: 'n', level: 0, instance: inst }, children: runs(t), spacing: { after: 60 } }));
const CODE = text => [new Paragraph({ style: 'Code', children: [new TextRun('')], spacing: { before: 60 } }), ...text.split('\n').map(l => new Paragraph({ style: 'Code', children: [new TextRun({ text: l || ' ', font: MONO, size: 17 })] })), new Paragraph({ style: 'Code', children: [new TextRun('')], spacing: { after: 120 } })];
const border = { style: BorderStyle.SINGLE, size: 4, color: 'D9CFC6' };
function T(rows, widths, { head = true } = {}) {
  const total = widths.reduce((a, b) => a + b, 0), W = widths.map(w => Math.round(w / total * CW)); W[W.length - 1] += CW - W.reduce((a, b) => a + b, 0);
  return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: W, layout: TableLayoutType.FIXED,
    rows: rows.map((r, i) => new TableRow({ tableHeader: head && i === 0, cantSplit: true, children: r.map((c, j) => new TableCell({ width: { size: W[j], type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
      shading: head && i === 0 ? { type: ShadingType.CLEAR, fill: 'F3E6D9', color: 'auto' } : undefined, borders: { top: border, bottom: border, left: border, right: border },
      children: String(c).split('\n').map(line => new Paragraph({ children: runs(line, head && i === 0 ? { bold: true } : {}), spacing: { after: 20 } })) })) })) });
}
const gap = () => new Paragraph({ children: [], spacing: { after: 60 } });
const IMG = (img, widthPx, cap) => [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, children: [new ImageRun({ type: 'png', data: img.data, transformation: { width: widthPx, height: Math.round(widthPx * img.h / img.w) } })] }),
  ...(cap ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: cap, italics: true, size: 19, color: MUTED })] })] : [])];
const PHONES = (names, caps, wPx = 150) => [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, children: names.flatMap((n, i) => [new ImageRun({ type: 'png', data: shot(n), transformation: { width: wPx, height: Math.round(wPx * 844 / 390) } }), new TextRun(i < names.length - 1 ? '   ' : '')]) }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: caps, italics: true, size: 19, color: MUTED })] })];
const footer = name => ({ default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${name} · Kineta ${VERSION} · стр. `, size: 17, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], size: 17, color: MUTED })] })] }) });
const page = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } };
const title = (t, sub) => [new Paragraph({ style: 'Title', children: [new TextRun(t)] }), new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: sub, color: MUTED, size: 21 })] })];
async function write(file, name, children) {
  const doc = new Document({ creator: 'Команда Kineta', title: name, styles, numbering, sections: [{ properties: page, footers: footer(name), children }] });
  const out = path.join(ROOT, 'docs', file); fs.writeFileSync(out, await Packer.toBuffer(doc));
  console.log(`${file}: ${(fs.statSync(out).size / 1024).toFixed(0)} КБ`); return out;
}

/* =====================================================================
   1. ОТЧЁТ ОБ ИСПОЛЬЗОВАНИИ ИИ (1–3 страницы)
   ===================================================================== */
const ai = [
  ...title('Kineta — отчёт об использовании ИИ', `Игра-тренажёр управления бионическим протезом · версия ${VERSION} · ${today}`),
  H1('1. Использованные ИИ-инструменты и модели'),
  T([['Инструмент / модель', 'Назначение в проекте', 'Входит в приложение'],
    ['**Claude Code** (модель Claude Opus 5.5, Anthropic)', 'ИИ-ассистент разработки: код игры и обработки сигнала, эмуляторы, тесты, документация, презентация', 'Нет — только разработка'],
    ['**Piper TTS** (нейросетевой синтез речи, голос `ru_RU-irina-medium`, лицензия MIT)', 'Заранее записанные голосовые подсказки игры и озвучка демо-ролика (`tools/voiceover.mjs`)', 'Да — как готовые mp3-файлы, модель в приложение не входит'],
    ['**Синтезатор речи ОС** (Android TTS, iOS / браузер speechSynthesis)', 'Голосовые подсказки для фраз без записи; выбирается лучший русский голос (нейросетевой, если есть)', 'Да — сервис телефона'],
    ['**СПППР** — внешняя нейросеть распознавания жестов', 'Источник Потока 2: игра принимает её вероятностный вектор (сама сеть не входит в решение, по ТЗ)', 'Вход, не часть решения']], [27, 47, 26]),
  P('Генеративные модели изображений, музыки и языковые модели в приложении **не используются**: графика игр рисуется кодом на Canvas 2D, звуки синтезируются Web Audio.', { spacing: { before: 120 } }),

  H1('2. Роль СПППР (Поток 2)'),
  P('Нейросеть распознавания жестов работает на стороне протеза. Игра получает пакеты `{timestamp_ms, dist}` с вероятностями 7 состояний (нейтраль, сгибание, разгибание, пронация, супинация, приведение, отведение) и превращает вектор в управление:'),
  ...N(['**Проверка и нормировка.** Битый JSON, пакет без полей, повтор или откат времени — в брак; вероятности нормируются на сумму; для модели на 2 жеста прочие классы относятся к нейтрали.',
    '**Время — только по часам МК.** Интервал между пакетами = разница `timestamp_ms`; часы телефона не используются.',
    '**Прощение единичных ошибок.** Пакет, в котором сменился ведущий класс, учитывается с весом 0.3; полностью — после подтверждения следующим пакетом. Одиночный выброс не включает канал.',
    '**Интерполяция.** Сглаживание с постоянной времени 0.6 × интервала пакетов — без рывков при джиттере 10–110 мс.',
    '**Отображение в управление.** Вектор джойстика = flexion − extension (руль в гонке, натяжение в рыбалке); сгибание → К1, разгибание → К2, пронация → «обе мышцы»; супинация, приведение, отведение — устойчивый жест (≥ 2 пакетов и ≥ 120 мс) для команд в 6 играх.',
    '**Потеря связи.** Нет пакетов > 200 мс — вероятности жестов плавно гаснут к нейтрали (τ = 180 мс); > 1.5 с — пауза «Сигнал потерян».'], 1),
  P('Эмулятор СПППР (`SppprEmulator`) строит логиты по «намерению» с клавиатуры или панелей, добавляет шум, softmax, ошибки классификатора (4 %), потери (5 %), пачки потерь и джиттер 10–110 мс — так проверяется устойчивость игры.'),

  H1('3. Генеративные модели для ресурсов'),
  T([['Модель', 'Для чего', 'Объём'],
    ['Piper TTS, голос irina (женский)', 'Голосовые подсказки и команды игры', 'Фразы собираются из кода (подсказки с призывом к действию и предупреждения, шаги Школы, команды «Без экрана», системные сообщения) — около 40 коротких mp3 по 1–3 с, сотни килобайт'],
    ['Piper TTS', 'Озвучка демо-ролика', '16 комментариев по сценарию `tests/e2e/narration.mjs`, около 2 минут речи']], [26, 30, 44]),
  P('Если записи не сгенерированы, приложение работает так же, только фразы звучат синтезатором телефона. Изображения, иконки, музыка генеративными моделями не создавались.', { spacing: { before: 120 } }),

  H1('4. LLM в работе приложения'),
  P('**Не используется.** Приложение не обращается к языковым моделям и вообще не требует интернета: вся логика (обработка сигнала, адаптация сложности, советы на экране результата) — детерминированный код.'),

  H1('5. ИИ-ассистенты при разработке'),
  P('Код писался с **Claude Code** (Claude Opus 5.5): постановка задач, ревью и решения — за командой, реализация и проверка — с ассистентом. Основные задачи:'),
  ...B(['конвейер сигнала обоих потоков, эмуляторы, Bluetooth-драйвер и мост к плагинам Capacitor;',
    '7 игр, Школа управления, сюжет, дуэль, мотивация, экраны и тема оформления;',
    'автотесты: 68 юнит-тестов на искусственных часах (задержка, потери, джиттер), 34 сквозных сценария в headless Chrome, стресс-тест «обезьяна» с фаззингом входов;',
    'документация, интеграция, презентация, демо-ролик.']),
  P('Перечень ИИ-фич (F1–F24), план и отчёт о верификации критичных модулей — в `docs/AI_REPORT.md`. Тесты нашли и закрыли, среди прочего: XSS через ссылку возврата, загрязнение прототипа через postMessage, белый экран на повреждённом сохранении, срабатывание канала от одного ошибочного пакета СПППР, звезду за бездействие в гонке.'),

  H1('6. Ограничения ИИ-компонентов и как они учтены'),
  T([['Ограничение', 'Как учтено в механике'],
    ['СПППР ошибается в классификации, особенно на смене жеста', 'Вес 0.3 до подтверждения, устойчивый жест ≥ 2 пакетов и ≥ 120 мс. Цена — +1 интервал пакетов к задержке смены класса: на 10 Гц 130–150 мс (ориентир отклика 100–150 мс)'],
    ['Пакеты теряются и приходят неравномерно', 'Интерполяция по фактическому интервалу, инерция к покою после 200 мс, пауза после 1.5 с без «залипания» последнего значения'],
    ['Модель на 2 жеста не различает «обе мышцы»', 'Игры перестраиваются: ноты «обе» уходят на К1 / К2, шаги Школы с «обе» пропускаются, нитро скрыто'],
    ['Пронация как «обе мышцы» — условность сопоставления', 'Подписи в играх для СПППР меняются («Согни / Разогни / Пронация»)'],
    ['Синтез речи запаздывает на сотни миллисекунд, качество системного голоса разное', 'В «Реакции» голос выключен, чтобы не искажать замер; фразы заранее записаны одним голосом'],
    ['Код, написанный с ИИ, может содержать логические ошибки', 'Каждая критичная фича закрыта тестом; стресс-тест игр и фаззинг; замеры задержки на искусственных часах'],
    ['Нет проверки на реальном протезе', 'Жёсткий контракт данных: эмулятор и драйвер МК выдают одинаковые пакеты; подключение реального протеза — профиль GATT без изменения игр']], [38, 62])
];

/* =====================================================================
   2. ТЕХНИЧЕСКАЯ ДОКУМЕНТАЦИЯ
   ===================================================================== */
const tech = [
  ...title('Kineta — техническая документация', `Игра-тренажёр управления бионическим протезом через ЭМГ и СПППР · версия ${VERSION} · ${today}`),
  P('Документ достаточен, чтобы собрать, установить и проверить игру без участия команды. Исходный код — репозиторий проекта; готовый Android APK приложен к релизу. Подробности по разделам — в `docs/BUILD.md`, `docs/INTEGRATION.md`, `prototype/README.md`.'),
  P('**Содержание:** 1. Технический стек · 2. Архитектура · 3. Способ управления · 4. Формат данных · 5. Сборка и установка · 6. Запуск и использование · 7. Эмулятор и подключение протеза · 8. Интеграция в стороннее приложение'),

  H1('1. Технический стек'),
  T([['Слой', 'Решение'],
    ['Игровой движок', 'Собственный на Canvas 2D (без сторонних движков): сцены 7 игр и Школы, процедурная графика, частицы, 60 кадров/с'],
    ['Язык', 'JavaScript (ES2022), без сборщика и транспиляции — файлы `prototype/js/*.js` подключаются напрямую'],
    ['Звук и голос', 'Web Audio (синтез тонов); голос — записанные mp3 (Piper) или синтезатор речи ОС'],
    ['Мобильная оболочка', 'Capacitor 7: Android (minSdk 26, targetSdk 35) и iOS (проект Xcode `mobile/ios`)'],
    ['Плагины', '`@capacitor-community/bluetooth-le` (протез по BLE), `@capacitor-community/text-to-speech`, `@capacitor/haptics`, `@capacitor/local-notifications`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/status-bar`, `@capacitor/app` (deep link, кнопка «Назад»)'],
    ['Библиотеки в приложении', 'qrcode-generator 1.4.4 (MIT) — QR-код ссылки на отчёт. Больше зависимостей нет'],
    ['Хранение', '`localStorage` (профиль, история, настройки), проверка и восстановление повреждённого сохранения'],
    ['Инструменты', 'Node.js ≥ 22: локальный сервер, relay-сервер пульта и клуба, тесты (node:test, Chrome DevTools Protocol)'],
    ['Целевые платформы', 'Android (APK ≈ 4 МБ) и iOS; веб-версия для отладки в Chrome / Edge']], [24, 76]),

  H1('2. Архитектура'),
  ...IMG(DIA_ARCH, 640, 'Рис. 1. Компоненты: источники сигнала → выбор источника → обработка → игры, модель протеза и интерфейс'),
  T([['Модуль', 'Файл', 'Ответственность'],
    ['Мост к платформе', '`js/native.js`', '`navigator.bluetooth` поверх BLE-плагина, вибрация, голос, файлы, уведомления, статус-бар; в браузере — веб-API'],
    ['Ввод сигнала', '`js/core.js`: `Intent`, `EmgEmulator`, `SppprEmulator`, `BleProsthesisDriver`, `createSource`', 'Источники Потока 1 и 2 с одним контрактом `start(cb) / stop()`; выбор источника — в одной функции'],
    ['Обработка сигнала', '`js/core.js`: `Ctrl`', 'Нормализация, фильтры, пороги, 4 состояния, метрики (чистота, баланс, утомление, задержка), потеря связи'],
    ['Модель протеза', '`js/core.js`: `Prosthesis`, `BT`; `js/hand.js`', 'Жесты и группа ротации, пропорциональное сжатие, команды протезу по BLE, отрисовка кисти'],
    ['Игровой движок', '`js/games.js`', '7 игр + Школа: контракт сцены `update / draw / onState / result`, уровни, бесконечный режим, баланс каналов'],
    ['UI', '`js/ui.js`, `js/charts.js`, `js/story.js`, `css/app.css`', 'Роутер экранов, игровой экран, результат, прогресс, датчики, профиль, сюжет, дуэль, рейтинг, отчёт'],
    ['Запуск и интеграция', '`js/main.js`', 'Главный цикл, клавиатура и джойстик, deep link, JS API `KinetaTrainer`, postMessage, пульт по SSE'],
    ['Серверная часть (необязательно)', '`prototype/tools/relay.mjs`', 'Пульт на втором телефоне, таблица клуба, отчёты по ссылке — в локальной сети']], [20, 32, 48]),

  H1('3. Способ управления'),
  P('Реализованы **оба потока**; переключение — Датчики → «Поток 1 · ЭМГ / Поток 2 · СПППР» или параметр `mode` при запуске. Все игры полностью работают в обоих потоках.'),
  ...IMG(DIA_PIPE, 640, 'Рис. 2. Преобразование входного сигнала в четыре игровых состояния'),
  H2('3.1. Поток 1 — двухканальная ЭМГ'),
  P('Каждый отсчёт (около 100 Гц) проходит цепочку: нормализация по калибровке и чувствительности → EMA-сглаживание с ограничением скачка → dead-zone → порог с гистерезисом → подавление ложных срабатываний → состояние. Задержка от превышения порога до смены состояния — 60–80 мс в профиле «Норма», не больше 100 мс во всех профилях (тест `signal.test.mjs`).'),
  T([['Параметр', 'По умолчанию', 'Где меняется', 'Смысл'],
    ['Порог К1 / К2', '0.38 / 0.35', 'Датчики → график', 'Включение канала (в шкале игры; к протезу — 0…255)'],
    ['Чувствительность', '10 (×1.0)', 'Датчики', '1…20 → ×0.1…×2.0'],
    ['Гистерезис', '0.75', 'Тонкая настройка', 'Выключение при доле порога — без дребезга'],
    ['Dead-zone', '0.05', 'Тонкая настройка', 'Фон ниже уровня считается покоем'],
    ['Сглаживание / скачок', '0.35 / 0.15', 'Тонкая настройка', 'EMA и ограничение изменения за отсчёт'],
    ['Подавление ложных', '30 мс', 'Тонкая настройка', 'Сколько состояние должно держаться'],
    ['Удержание для смены жеста', '280 мс', 'Тонкая настройка', '«Обе мышцы» дольше — следующий жест в ротации']], [24, 16, 22, 38]),
  P('**Пороговый режим (4 состояния):** К1 изолированно → действие 1 («закрыть»), К2 → действие 2 («открыть»), К1 + К2 → действие 3, покой → действие 4. **Пропорциональный режим:** амплитуда задаёт силу и скорость (руль в гонке, высота взлёта в «Искре», сила хвата в «Кружке»). Одновременная активация — 4 режима, как у протеза: «Действие 3» (по ТЗ), «Классика» (первый сигнал держит управление), «Спорт» (второй перехватывает), «Блокировка» (оба выше порогов — управление стоит).', { spacing: { before: 120 } }),
  H2('3.2. Поток 2 — СПППР'),
  P('Пакет → проверка → нормировка → прощение единичной ошибки (вес 0.3 до подтверждения) → интерполяция по интервалу пакетов → вектор flexion − extension и устойчивый жест. Сгибание → К1, разгибание → К2, пронация → «обе мышцы», супинация / приведение / отведение → команды в играх. Словарь: 2 жеста + нейтраль или 6 жестов + нейтраль (Датчики → «Словарь СПППР»). На 10 Гц отклик 130–150 мс.'),
  H2('3.3. Состояния → игровые команды'),
  T([['Игра', 'К1', 'К2', 'Обе мышцы / доп. жест'],
    ['Школа управления', 'сжатие, сила в зоне', 'раскрытие, сила в зоне', 'обе; на 6 жестах — 4 шага жестов'],
    ['Нейро-гонка', 'руль влево (пропорционально)', 'руль вправо', 'нитро; супинация — гудок'],
    ['Искра', 'взмах у оранжевых ворот', 'взмах у голубых', 'супинация — купол'],
    ['Ритм-пульс', 'левая дорожка', 'правая дорожка', 'ноты «обе»'],
    ['Рыбалка', 'подсечка, подтянуть', 'отпустить леску', 'приведение — прикормка'],
    ['Горячая кружка', 'сжать до зелёной зоны', 'раскрыть, поставить', 'встречное — проливает; долгое «обе» — смена хвата, кружка падает'],
    ['Без экрана', 'команда «сожми»', 'команда «раскрой»', '«обе»; на 6 жестах — ладонь вверх, приведи, отведи'],
    ['Реакция', '«Сожми»', '«Раскрой»', '«Обе» / жесты; покой — «Замри»']], [20, 25, 23, 32]),
  P('**Потеря связи (оба потока):** нет данных > 200 мс — плавная инерция к покою, игра не зависает; > 1.5 с — пауза «Сигнал потерян», продолжить можно после восстановления.', { spacing: { before: 120 } }),

  H1('4. Формат данных'),
  H2('4.1. Поток 2 — JSON-пакет СПППР'),
  ...CODE('{\n  "timestamp_ms": 1720000000123,\n  "dist": {\n    "neutral": 0.05, "flexion": 0.65, "extension": 0.15,\n    "pronation": 0.05, "supination": 0.05,\n    "adduction": 0.03, "abduction": 0.02\n  }\n}'),
  T([['Поле', 'Тип', 'Пояснение'],
    ['`timestamp_ms`', 'число, мс', 'Внутренний таймер микроконтроллера протеза от старта устройства; не синхронизирован с телефоном. Игра использует только разницу между соседними пакетами; повтор и откат времени отбрасываются'],
    ['`dist`', 'объект', 'Вероятности 7 состояний (выход softmax классификатора). Сумма нормируется игрой; отсутствующее или отрицательное значение = 0'],
    ['`dist.neutral`', '0…1', 'Нейтраль, покой'],
    ['`dist.flexion`', '0…1', 'Сгибание → К1 («закрыть»), положительная часть вектора джойстика'],
    ['`dist.extension`', '0…1', 'Разгибание → К2 («открыть»); вектор = flexion − extension'],
    ['`dist.pronation`', '0…1', 'Пронация → «обе мышцы» (на словаре из 6 жестов)'],
    ['`dist.supination`', '0…1', 'Супинация → гудок, купол, команды «Ладонь вверх»'],
    ['`dist.adduction`', '0…1', 'Приведение → прикормка, команда «Приведи»'],
    ['`dist.abduction`', '0…1', 'Отведение → команда «Отведи»']], [22, 14, 64]),
  P('Принимается строка JSON или объект. Частота ~10 Гц, джиттер 10…100+ мс.', { spacing: { before: 100 } }),
  H2('4.2. Поток 1 — пакет ЭМГ'),
  ...CODE('{ "timestamp_ms": 1720000000123, "emg": [142, 18], "thr": [97, 89] }'),
  T([['Поле', 'Тип', 'Пояснение'],
    ['`timestamp_ms`', 'число, мс', 'Время отсчёта (информативно)'],
    ['`emg`', '[0…255, 0…255]', 'Амплитуды датчиков К1 (сгибатели, «закрыть») и К2 (разгибатели, «открыть»)'],
    ['`thr`', '[0…255, 0…255]', 'Пороги протеза для К1 и К2. В режиме «Пороги из протеза» применяются сразу']], [22, 20, 58]),
  P('Совместимость: `{ "ch1": 0.56, "ch2": 0.07 }` в долях 0…1. По Bluetooth LE дополнительно поддерживаются бинарные форматы `u16le2` (2 × uint16 LE, шкала АЦП), `u8x2`, `f32le2` и строки JSON (в том числе разрезанные по 20 байт).', { spacing: { before: 100 } }),

  H1('5. Сборка и установка'),
  P('Требуется: Node.js ≥ 22, Git. Для Android — JDK 21 и Android SDK (Android Studio); для iOS — Mac с Xcode и CocoaPods.'),
  H2('5.1. Android'),
  ...CODE('git clone <репозиторий> kineta && cd kineta\nnpm --prefix mobile install\nnpm run apk                          # → mobile/dist/kineta-' + VERSION + '-debug.apk\nadb install -r mobile/dist/kineta-' + VERSION + '-debug.apk'),
  P('Скрипт копирует игру в `mobile/www`, выполняет `npx cap sync android` и собирает `gradlew assembleDebug` (на Windows — во временной папке с латинским путём: Gradle не работает с кириллицей в пути). Без сборки: скачать APK из релиза репозитория, на телефоне разрешить установку из неизвестных источников и открыть файл.'),
  H2('5.2. iOS'),
  ...CODE('cd mobile && npm install\nnode scripts/copy-www.mjs && npx cap sync ios\nnpx cap open ios                     # в Xcode: Signing & Capabilities → команда разработчика → Run на iPhone'),
  P('В `Info.plist` уже есть разрешения Bluetooth, геолокации и локальной сети и схема `kineta://`.'),
  H2('5.3. Веб-версия для отладки'),
  ...CODE('npm run serve        # http://127.0.0.1:3000 (без зависимостей)\nnpm run serve:lan    # с телефона в той же сети: http://<IP компьютера>:3000\nnpm test             # юнит-тесты + сквозные сценарии + стресс-тест (нужен Chrome или Edge)'),

  H1('6. Запуск и использование'),
  H2('6.1. Первый запуск'),
  ...N(['Онбординг (3 слайда) → экран разрешений: Bluetooth (протез) и геолокация («Где мой протез»).',
    'Без протеза — кнопка **«Без протеза — демо-режим»**: сигнал даёт встроенный эмулятор.',
    'Главная → «Сюжет» или вкладка «Игры» → **«Школа управления»** — обучающий режим.'], 2),
  H2('6.2. Эмулятор сигнала: управление'),
  T([['Способ', 'К1 («закрыть»)', 'К2 («открыть»)', 'Прочее'],
    ['Клавиатура', 'F, A или ←', 'J, L или →', 'F + J — обе мышцы; удержание наращивает силу; 1–4 — пронация, супинация, приведение, отведение (СПППР); Esc / P — пауза'],
    ['Тач-панели на экране', 'левая панель', 'правая панель', 'сила — высота касания; на телефоне — кнопка «Эмулятор мышц» внизу'],
    ['Джойстик (Gamepad)', 'LT (пропорционально), A, LB', 'RT, B, RB', 'крестовина — жесты СПППР'],
    ['Пульт на втором телефоне', 'ползунки пульта', 'ползунки пульта', '`node prototype/tools/relay.mjs` на компьютере → открыть адрес на телефоне-пульте; в игре: Датчики → «Удалённый эмулятор»'],
    ['Панель эмулятора (компьютер)', '—', '—', 'шум, наводка, джиттер, потери, ошибки классификатора, кнопка «Обрыв связи на 2.5 с»']], [22, 18, 18, 42]),
  H2('6.3. Обучающий режим и уровни'),
  P('**Школа управления** — 7–11 коротких шагов: покой, К1, К2, сила в зоне, чередование, «обе мышцы» (на 6 жестах СПППР — 4 шага жестов). Шаг засчитывается, когда нужное состояние держится заданное время; не та мышца — ошибка. Затем каждая из 7 игр — **3 уровня**: следующий открывается одной звездой, очень чистая игра открывает его сразу, при точности ниже 45 % игра советует уровень проще. После уровня 3 — бесконечный режим. Перед игрой в режиме ЭМГ проходит 5-секундная проверка датчиков (покой → К1 → К2).'),
  ...PHONES(['04-school-play', '03-race-intro', '12-result-map'], 'Школа управления · карточка уровня с управлением · результат с картой игры'),
  H2('6.4. Что смотреть жюри'),
  ...B(['**Датчики** — график сигнала, пороги на графике, 4 режима одновременной активации, «Путь сигнала» вживую (задержка, вероятности СПППР);',
    '**Результат** каждой игры — точность, чистота, баланс К1/К2, утомление, карта встречных сокращений;',
    '**Прогресс** — тренды, навыки, отчёт для специалиста (файл или ссылка с QR);',
    '**Профиль** — тема, крупный и детский режимы, сторона протеза (зеркальный интерфейс), голос, напоминание.']),

  H1('7. Эмулятор и подключение реального протеза'),
  P('На период хакатона реальный сигнал заменяют `EmgEmulator` (Поток 1: пакет `{timestamp_ms, emg, thr}` каждые 10 мс; шум, перекрёстная наводка, дыхательный дрейф) и `SppprEmulator` (Поток 2: логиты по намерению → softmax, джиттер 10–110 мс, потери 5 %, пачки потерь, ошибки классификатора 4 %). «Намерение» задают клавиатура, панели, джойстик или пульт. Контракт жёсткий: эмулятор выдаёт ровно те пакеты, что придут от протеза.'),
  H2('7.1. Без изменения кода — Bluetooth LE'),
  P('Мой протез → «Протокол протеза»: UUID сервиса сигнала, характеристика notify, необязательная характеристика команд, формат пакета, шкала АЦП. После подключения источник переключается автоматически (`BT.streaming()`), игры не меняются. Тот же профиль задаётся из кода:'),
  ...CODE("KinetaTrainer.bluetooth.setProfile({ service: '0xFFE0', emgChar: '0xFFE1', cmdChar: '0xFFE2', format: 'u16le2', fullScale: 4095 });\nawait KinetaTrainer.bluetooth.connect();   // по жесту пользователя: окно выбора устройства"),
  H2('7.2. Замена эмулятора драйвером МК — одна строка'),
  P('Единственная точка выбора источника — `createSource` в `prototype/js/core.js`. Драйвер реализует `start(cb)` / `stop()` и передаёт в `cb` пакеты того же формата:'),
  ...CODE("// свой драйвер микроконтроллера (USB, BLE-шлюз, WebSocket…)\nclass McuDriver {\n  constructor(port) { this.port = port; }\n  start(cb) { this.port.onLine = line => cb(line); }   // строка JSON {timestamp_ms, dist} или объект {timestamp_ms, emg, thr}\n  stop() { this.port.onLine = null; }\n}\n\n// prototype/js/core.js — было:\nconst createSource = mode => BT.streaming() ? new BleProsthesisDriver(mode) : mode === 'emg' ? new EmgEmulator(Intent) : new SppprEmulator(Intent);\n// стало:\nconst createSource = mode => new McuDriver(myPort);"),

  H1('8. Интеграция в стороннее приложение'),
  P('Встраивание — **через роутинг**: хост (например, Motorika Start) открывает игру ссылкой с параметрами и получает обратную ссылку с результатом. Точки входа:'),
  T([['Точка входа', 'Где', 'Для чего'],
    ['Deep link `kineta://train?…`', '`Host.apply` в `js/main.js`, плагин `@capacitor/app`', 'Запуск с параметрами: сторона руки, пороги, чувствительность, поток, экран и уровень, адрес возврата'],
    ['Возврат `return=<URL хоста>`', '`Host.back`', 'Пороги, чувствительность, итоги сеанса; разрешены http(s) и схемы приложений'],
    ['JS API `window.KinetaTrainer`', '`js/main.js`', 'Внешний поток сигнала, настройки, события, прогресс, открытие экранов, Bluetooth'],
    ['`postMessage`', '`js/main.js`', 'То же из WebView / iframe: `kineta:emg`, `kineta:spppr`, `kineta:config`, `kineta:external`, `kineta:open`'],
    ['Команды протезу', '`BT.send`', 'Игровой режим (`{"cmd":"game","active":true}`), жест, хват, поза']], [28, 30, 42]),
  H2('8.1. Запуск из хоста и возврат'),
  ...CODE('kineta://train?hand=left&thr1=97&thr2=89&gain1=10&gain2=10&mode=emg&return=motorika://kineta/result&host=Motorika%20Start&session=abc123\n\n→ motorika://kineta/result?thr1=97&thr2=89&gain1=10&gain2=10&hand=left&mode=emg&session=abc123&minutes=8&games=3&score=4120&stars=7&acc=82&purity=76'),
  P('Android (Kotlin):'),
  ...CODE('val uri = Uri.parse("kineta://train").buildUpon()\n    .appendQueryParameter("hand", "left")\n    .appendQueryParameter("thr1", "97").appendQueryParameter("thr2", "89")\n    .appendQueryParameter("return", "motorika://kineta/result")\n    .build()\nstartActivity(Intent(Intent.ACTION_VIEW, uri))'),
  P('iOS (Swift): `UIApplication.shared.open(URL(string: "kineta://train?hand=left&thr1=97&thr2=89&return=motorika://kineta/result")!)`. Параметры запуска: `hand`, `thr1`, `thr2` (0…255), `gain1`, `gain2` (1…20), `mode` (`emg` | `spppr`), `gestures` (2 | 6), `source=external`, `screen`, `diff`, `return`, `host`, `session`.'),
  H2('8.2. Минимальный код: управление через ЭМГ от хоста'),
  ...CODE("// игра в WebView хоста: хост подаёт свой поток, встроенный эмулятор выключается\nKinetaTrainer.useExternalSource('emg');\nonEmgSample = (a1, a2, t1, t2) => KinetaTrainer.pushEmg({ timestamp_ms: Date.now(), emg: [a1, a2], thr: [t1, t2] });\nKinetaTrainer.on('state', e => console.log(e.state));          // REST | CH1 | CH2 | BOTH\nKinetaTrainer.on('level:end', r => saveResult(r));             // итоги уровня\nKinetaTrainer.open('race', { diff: 1 });\n\n// или из нативного кода в WebView:\nwebView.evaluateJavascript(\"postMessage({type:'kineta:emg',payload:{timestamp_ms:0,emg:[142,18],thr:[97,89]}},'*')\", null)"),
  H2('8.3. Поток 2: реальный драйвер МК вместо эмулятора'),
  ...CODE("KinetaTrainer.useExternalSource('spppr');\nmcu.onPacket = json => KinetaTrainer.pushSpppr(json);   // строка JSON {timestamp_ms, dist} как приходит от МК"),
  P('Либо заменить `createSource` (раздел 7.2) — тогда драйвер работает внутри игры без хоста.'),
  H2('8.4. Зависимости для встраивания'),
  P('Игра — самостоятельное приложение: хосту не нужны её библиотеки, достаточно открыть ссылку и принять возврат. Для сборки самой игры — плагины Capacitor из раздела 1 (`mobile/package.json`). Для встраивания веб-части в собственный WebView достаточно папки `prototype/` (без сборщика) и, при Bluetooth-управлении, плагина `@capacitor-community/bluetooth-le` либо собственного драйвера по разделу 7.2.'),
  P('Полное описание событий и API — `docs/INTEGRATION.md`.', { spacing: { before: 120 } })
];

await write('Kineta-AI-report.docx', 'Отчёт об использовании ИИ', ai);
await write('Kineta-technical-documentation.docx', 'Техническая документация', tech);
