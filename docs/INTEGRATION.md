# Интеграция Kineta в стороннее приложение

Kineta — отдельное мобильное приложение (Android, iOS через Capacitor). Хост-приложение (например, Motorika Start) встраивает его **через роутинг**: открывает игру ссылкой с параметрами, а по окончании получает обратную ссылку с результатами. Игровой компонент внутрь хоста не помещается, обмен данными идёт через параметры запуска и поток сигнала.

## 1. Запуск игры из хоста

```
kineta://train?hand=left&thr1=97&thr2=89&gain1=10&gain2=10&mode=emg&return=motorika://kineta/result&host=Motorika%20Start&session=abc123
```

Android, Kotlin:

```kotlin
val uri = Uri.parse("kineta://train").buildUpon()
    .appendQueryParameter("hand", "left")          // сторона протеза
    .appendQueryParameter("thr1", "97")            // порог К1, 0…255
    .appendQueryParameter("thr2", "89")            // порог К2, 0…255
    .appendQueryParameter("return", "motorika://kineta/result")
    .appendQueryParameter("session", sessionId)
    .build()
startActivity(Intent(Intent.ACTION_VIEW, uri))
```

iOS, Swift: `UIApplication.shared.open(URL(string: "kineta://train?hand=left&thr1=97&thr2=89&return=motorika://kineta/result")!)`. Для iOS схема `kineta` добавляется в `Info.plist` → `CFBundleURLTypes`; см. [BUILD.md](BUILD.md).

| Параметр | Значения | Что делает |
|---|---|---|
| `hand` | `left` \| `right` | Сторона протеза. Интерфейс раскладывается под **здоровую** руку: `right` включает зеркальный интерфейс под левую руку |
| `thr1`, `thr2` | 0…255 | Пороги датчиков из настроек протеза. Игра переходит в режим «Пороги из протеза» (`thrSrc = device`) |
| `gain1`, `gain2` | 1…20 | Чувствительность датчиков (×0.1…×2.0) |
| `mode` | `emg` \| `spppr` | Поток 1 (двухканальная ЭМГ) или Поток 2 (СПППР) |
| `gestures` | `2` \| `6` | Словарь СПППР: 2 жеста + нейтраль или 6 жестов + нейтраль |
| `source` | `external` | Сигнал подаёт хост (см. п. 3), встроенный эмулятор выключается |
| `screen`, `diff` | `race`, `flap`, `rhythm`, `fish`, `react`, `school`, `home`, `sensors`…; 1…3 | Сразу открыть игру и уровень |
| `return` | URL со схемой хоста | Куда вернуть результат |
| `host` | строка | Имя хоста на кнопке «Вернуться в …» |
| `session` | строка | Идентификатор сеанса, возвращается без изменений |

В веб-сборке те же параметры передаются в строке запроса `index.html?hand=left&thr1=97…`.

## 2. Возврат в хост

Кнопка «Вернуться в {host}» на экране результата, системная кнопка «Назад» на главном экране или вызов `KinetaTrainer.finishSession()` открывают:

```
motorika://kineta/result?thr1=97&thr2=89&gain1=10&gain2=10&hand=left&mode=emg&session=abc123&minutes=8&games=3&score=4120&stars=7&acc=82&purity=76
```

| Поле | Смысл |
|---|---|
| `thr1`, `thr2` | Пороги 0…255 в шкале датчика. Если пользователь поменял их в игре, здесь новые значения |
| `gain1`, `gain2` | Чувствительность 1…20 |
| `minutes`, `games`, `score`, `stars` | Итоги сеанса |
| `acc`, `purity` | Средняя точность и чистота сигнала, % (чистота = доля времени без встречной активации мышцы-антагониста) |

Пороги и чувствительность — утверждённая часть контракта: игра может их менять и возвращает хосту. Очки, звёзды и время передаются как перспективная часть: хост может их игнорировать.

## 3. Поток сигнала (жёсткий контракт)

Источник сигнала выбирается в одном месте — `createSource()` в `prototype/js/core.js`. Эмулятор, Bluetooth-драйвер, удалённый пульт и хост выдают одни и те же пакеты, поэтому замена эмулятора на драйвер реального микроконтроллера — одна строка.

**Поток 1, двухканальная ЭМГ**, около 100 Гц:

```json
{ "timestamp_ms": 1720000000123, "emg": [142, 18], "thr": [97, 89] }
```

`emg` — амплитуды двух датчиков 0…255 (К1 — сгибатели, «закрыть»; К2 — разгибатели, «открыть»). `thr` — пороги 0…255, передаются в каждом пакете. Если пороги в потоке меняются, игра в режиме «Пороги из протеза» сразу их применяет. Для совместимости принимается и `{ "ch1": 0.56, "ch2": 0.07 }` в долях 0…1.

**Поток 2, СПППР**, около 10 Гц, джиттер 10…100+ мс:

```json
{ "timestamp_ms": 1720000000123, "dist": { "neutral": 0.05, "flexion": 0.65, "extension": 0.15, "pronation": 0.05, "supination": 0.05, "adduction": 0.03, "abduction": 0.02 } }
```

`timestamp_ms` — часы микроконтроллера. Игра использует только разницу между пакетами, а пакеты с повтором или откатом времени отбрасывает.

Как подать поток:

```js
KinetaTrainer.useExternalSource('emg');               // или 'spppr'
KinetaTrainer.pushEmg({ timestamp_ms, emg: [a1, a2], thr: [t1, t2] });
KinetaTrainer.pushSpppr('{"timestamp_ms":…,"dist":{…}}');   // строка JSON или объект
```

Подать поток можно тремя способами:
- через `postMessage` из WebView или iframe: `{ type: 'kineta:emg' | 'kineta:spppr' | 'kineta:config' | 'kineta:external' | 'kineta:open', payload }`;
- через Bluetooth LE, см. раздел «Подключение реального протеза» в `prototype/README.md`;
- через удалённый пульт по SSE, см. [BUILD.md](BUILD.md).

## 4. Обработка потерь и ошибок

| Ситуация | Поведение |
|---|---|
| Нет пакетов > 200 мс | Инерция: активация плавно гасится к покою (ЭМГ — ×0.8 за кадр, СПППР — экспонента τ = 180 мс). Последнее значение не «залипает», игра не зависает |
| Нет пакетов > 1.5 с | Критическая потеря: событие `signal:lost`, игра встаёт на паузу «Сигнал потерян», кнопка «Продолжить» неактивна до `signal:back` |
| Единичная ошибка классификатора СПППР | Прощается: новый жест принимается, только если держится ≥ 2 пакетов и ≥ 120 мс |
| Битый JSON, нет полей, время назад | Пакет отбрасывается, счётчик `Ctrl.bad` |
| Одновременно К1 + К2 | Зависит от режима (Датчики → Режим управления): «Действие 3» — отдельное состояние `BOTH` (по ТЗ); «Классический» — первый сигнал держит управление; «Спортивный» — второй перехватывает; «Блокировка» — пока оба выше порогов, состояние `REST` и `KinetaTrainer.getState().blocked = true` (как функция блокировки протеза). Значение `coMode`: `both` · `classic` · `sport` · `lock` |

## 5. События и API

```js
KinetaTrainer.on('level:end', r => …);   // { game, score, acc, purity, stars, bal, fat, … }
KinetaTrainer.on('host:return', r => …); // то же, что уходит в return-URL
// state · sp:gesture · signal:lost · signal:back · thr:device · gesture · switch · gesture:count · feedback · device · device:lost · battery
KinetaTrainer.getThresholds();           // { thr1, thr2 (0…255), gain1, gain2, source }
KinetaTrainer.setConfig({ hand: 'right', coMode: 'classic', spGest: 2, sessionMin: 8 });
KinetaTrainer.getProgress();             // профиль, история игр, статистика, отзывы
KinetaTrainer.open('fish', { diff: 2 });
KinetaTrainer.finishSession();           // вернуть результат хосту
```
