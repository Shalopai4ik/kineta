/* =====================================================================
   Kineta — сюжет, дуэль и рейтинг.
   • Сюжет «Город Кинета»: пролог (Школа) → 7 глав (игры) по 3 эпизода (уровни) → эпилог.
     Главы не запирают игры — это путь с понятной целью и финалом поверх тех же уровней.
     В конце каждой главы — «упражнение в жизни»: перенос навыка на реальный протез.
   • Дуэль: 2–4 игрока по очереди на одном телефоне. У каждого своя калибровка (проверка датчиков
     перед каждым ходом), гостевые ходы не пишутся в статистику владельца.
   • Рейтинг игроков на этом телефоне и общая таблица клуба (tools/relay.mjs в локальной сети:
     центр реабилитации, кружок, семья) — без облачного сервера.
   ===================================================================== */

/* ---------------- Сюжет ---------------- */
const STORY = {
  title: 'Город Кинета',
  prologue: 'Город механизмов Кинета замер: буря помех перепутала сигналы, и машины больше не понимают, где «сжать», а где «раскрыть». Робот-механик Кинетик нашёл тебя — оператора, чья рука умеет посылать два чистых сигнала. Верни городу движение: район за районом.',
  chapters: [
    { id: 'school', game: 'school', n: 'Мастерская', place: 'Пролог', ic: 'gear',
      intro: 'Кинетик просыпается в старой мастерской. «Сначала научимся говорить с машинами: сжать — К1, раскрыть — К2, покой — ничего. И главное — по одному сигналу за раз».',
      eps: ['Первые сигналы'],
      outro: 'Мастерская загудела. Кинетик: «Ты говоришь чисто — машины тебя слышат. Пора в город».',
      life: 'Положи предплечье на стол. 5 раз сожми и раскрой протез, следя, чтобы вторая мышца отдыхала. Между движениями — полный покой.' },
    { id: 'race', game: 'race', n: 'Дорога запчастей', place: 'Глава 1', ic: 'car',
      intro: 'Склад запчастей за перевалом, а машина доставки слушается только плавного руления: К1 — влево, К2 — вправо, сила — насколько круто.',
      eps: ['Утренний рейс', 'Серпантин', 'Срочная доставка'],
      outro: 'Запчасти доставлены, в мастерской снова кипит работа. Ты научился дозировать силу сигнала, а не просто включать его.',
      life: 'Медленно открой и закрой кисть, глядя на пальцы: попробуй остановить их на половине пути и подержать 3 секунды.' },
    { id: 'flap', game: 'flap', n: 'Искры над крышами', place: 'Глава 2', ic: 'bird',
      intro: 'Фонари на крышах погасли. Дрон-искра зажигает их, но каждый фонарь откликается только на свой сигнал: оранжевый — К1, голубой — К2.',
      eps: ['Первые фонари', 'Переулки', 'Звёздная ночь'],
      outro: 'Город светится. Ты переключаешься между мышцами быстро и без «хвостов» второй.',
      life: 'Переложи 10 мелких предметов (кубики, крышки) из одной коробки в другую: хват — перенос — раскрытие, без пауз между движениями.' },
    { id: 'rhythm', game: 'rhythm', n: 'Сердце фабрики', place: 'Глава 3', ic: 'music',
      intro: 'Главный генератор фабрики заводится только в ритм. Лови ноты нужной мышцей и держи длинные — генератор не прощает поспешности.',
      eps: ['Разогрев', 'Смена ритма', 'Полная мощность'],
      outro: 'Генератор ровно гудит. Тайминг и удержание сокращения — теперь твои.',
      life: 'Включи любимую песню: сжимай протез на сильную долю, раскрывай на слабую — одна минута.' },
    { id: 'fish', game: 'fish', n: 'Тихая пристань', place: 'Глава 4', ic: 'fish',
      intro: 'На пристани механические рыбы рвут леску. Подсекай в момент поклёвки и держи натяжение в зелёной зоне — слишком сильно рвётся, слабо — уходит.',
      eps: ['Мелкая рыбёшка', 'Течение', 'Королевский улов'],
      outro: 'Рыбаки снова в деле. Ты держишь ровное усилие — так держат стакан, сумку, ручку двери.',
      life: 'Держи бумажный стаканчик 20 секунд, не смяв и не уронив его. Потом — с водой на донышке.' },
    { id: 'mug', game: 'mug', n: 'Кафе «Горячая кружка»', place: 'Глава 5', ic: 'cup',
      intro: 'Жители вернулись и хотят чаю. Возьми кружку, донеси, не пролив, и поставь. Не раздави и не урони — а смена хвата с кружкой в руке её выронит.',
      eps: ['Первый заказ', 'Доливка', 'Час пик'],
      outro: 'Кафе полно гостей. Самое бытовое умение — нести горячее спокойно — у тебя получается.',
      life: 'Возьми пустую кружку, донеси её до другого края стола и поставь. Получилось трижды подряд — повтори с водой наполовину.' },
    { id: 'react', game: 'react', n: 'Диспетчерская', place: 'Глава 6', ic: 'bolt',
      intro: 'Поезда снова ходят, и диспетчеру нужны мгновенные команды: «сожми», «раскрой» или «замри» — и никаких фальстартов.',
      eps: ['Пробный рейс', 'Расписание', 'Час пик на вокзале'],
      outro: 'Поезда идут по графику. Реакция быстрая, а лишних движений нет.',
      life: 'Попроси кого-нибудь называть «сожми / раскрой / замри» в случайном порядке — выполняй сразу. 20 команд.' },
    { id: 'blind', game: 'blind', n: 'Ночная смена', place: 'Глава 7', ic: 'ear',
      intro: 'Ночью в цехах темно, видно только руку. Кинетик подаёт команды голосом — смотри на кисть, а не на экран.',
      eps: ['Сумерки', 'Полночь', 'Без света'],
      outro: 'Ты управляешь, не глядя на подсказки, — связь «мышца — действие» стала твоей.',
      life: 'Сделай 10 хватов, не глядя на телефон и не считая вслух: только кисть и предмет.' }
  ],
  epilogue: 'Кинета снова в движении: дороги, фонари, фабрика, пристань, кафе, вокзал и ночные цеха. Кинетик: «Город держится на чистых сигналах — твоих. Дальше — бесконечный режим, испытания недели и мастерская. Но главное поле тренировок теперь — обычный день: протез в каждом деле».'
};
const Story = {
  get s() { const s = S.story ||= {}; s.seen ||= {}; s.done ||= {}; return s; },
  ch: id => STORY.chapters.find(c => c.game === id),
  idx: id => STORY.chapters.findIndex(c => c.game === id),
  levels: c => GAMES[c.game].tut ? 1 : 3,
  passed(c) { const st = gst(c.game); return GAMES[c.game].tut ? (st.plays > 0 ? 1 : 0) : st.ls.filter(x => x >= 1).length; },
  restored(c) { return this.passed(c) >= this.levels(c); },
  /* глава открыта, когда в предыдущей пройден первый эпизод */
  open(i) { return i === 0 || this.passed(STORY.chapters[i - 1]) >= 1; },
  progress() { const all = STORY.chapters.reduce((a, c) => a + this.levels(c), 0); return STORY.chapters.reduce((a, c) => a + Math.min(this.levels(c), this.passed(c)), 0) / all; },
  current() { const i = STORY.chapters.findIndex((c, k) => this.open(k) && !this.restored(c)); return i < 0 ? null : i; },
  done() { return STORY.chapters.every(c => this.restored(c)); },
  epTitle(id, lv) { const c = this.ch(id); return c ? `${c.place} · «${c.eps[Math.min(c.eps.length, Math.max(1, Math.round(lv))) - 1]}»` : ''; },
  /* после игры: глава восстановлена впервые — награда, текст концовки и упражнение в жизни */
  after(id) {
    const c = this.ch(id); if (!c || !this.restored(c) || this.s.done[c.id]) return null;
    this.s.done[c.id] = Date.now(); addXP(100); const fin = this.done() && !this.s.done.epilogue;
    if (fin) { this.s.done.epilogue = Date.now(); addXP(300); reward('trophy', 'Город Кинета восстановлен!', 'Сюжет пройден · +300 XP', 140); }
    else reward(c.ic, `${c.place} пройдена: ${c.n}`, '+100 XP · открыт следующий район', 80);
    save(); return { id: c.id, n: c.n, place: c.place, outro: c.outro, life: c.life, fin };
  }
};

function storySheet(i) {
  const c = STORY.chapters[i], g = GAMES[c.game], tut = g.tut, U = tut ? 1 : unlockedLv(c.game), st = gst(c.game);
  Story.s.seen[c.id] = Date.now(); save();
  sheet(`<div class="sh-head">${gIcon(c.game, 'lg')}<div><small class="muted">${c.place}</small><h2 style="margin:0">${c.n}</h2></div></div>
    <p class="story-txt">${c.intro}</p>
    <h3 class="h3">Эпизоды</h3><div class="list">${c.eps.map((e, k) => { const lv = k + 1, done = tut ? st.plays > 0 : st.ls[k] >= 1, lock = !tut && lv > U;
      return `<button class="lrow ep ${lock ? 'lock' : ''}" data-ep="${lv}">${badge(done ? 'check' : lock ? 'shield' : 'play', done ? 'mint' : lock ? 'peach' : 'sky')}<div><b>${esc(e)}</b><small>${tut ? 'Режим обучения' : 'Уровень ' + lv + ' · ' + g.goal(lv)}</small></div>${tut ? '' : `<span class="tag soft">${starStr(st.ls[k] || 0)}</span>`}</button>`; }).join('')}</div>
    ${Story.restored(c) ? `<div class="note ok">${ic('check')}<span><b>Район восстановлен.</b> ${c.outro}</span></div>` : ''}
    <div class="note life">${ic('hand')}<span><b>Упражнение в жизни.</b> ${c.life}</span></div>`, (sh, close) => {
    sh.addEventListener('click', e => {
      const b = e.target.closest('[data-ep]'); if (!b || sh._closing) return; const lv = +b.dataset.ep;
      if (b.classList.contains('lock')) { toast('shield', 'Эпизод закрыт', `Пройди эпизод ${lv - 1} хотя бы на одну звезду`); return; }
      close(); App.go('play', { id: c.game, diff: lv, story: true });
    });
  });
}
function prologueModal(then) {
  modal(`${badge('robot', 'lilac', 'xl')}<div style="font-size:20px;font-weight:800;margin-top:10px">${STORY.title}</div><p class="sub story-txt">${STORY.prologue}</p><button class="btn" data-x="go">${ic('play')} Начать</button>`,
    (m, close) => { m.onclick = e => { if (!e.target.closest('[data-x]')) return; close(); Story.s.seen.prologue = Date.now(); save(); then?.(); }; });
}

SCR.story = {
  render() {
    const P = Story.progress(), cur = Story.current(), fin = Story.done();
    return `<div class="back"><button class="ib" data-back>${ic('back')}</button><span class="grow">Сюжет</span><span class="tag soft">${Math.round(P * 100)}%</span></div>
      <div class="card story-hero">${robotSVG(Math.round(P * PARTS.length), 70)}<div class="grow"><b>${STORY.title}</b><small>${fin ? 'Город восстановлен — сюжет пройден' : `Восстановлено ${Math.round(P * 100)}% города`}</small><div class="pbar"><i style="width:${P * 100}%"></i></div></div></div>
      <button class="lnk" id="stPro" style="margin:2px 2px 10px">${ic('info')} Пролог: что случилось с городом</button>
      <div class="list chaps">${STORY.chapters.map((c, i) => { const open = Story.open(i), rest = Story.restored(c), n = Story.passed(c), L = Story.levels(c);
        return `<button class="lrow chap ${open ? '' : 'lock'} ${i === cur ? 'cur' : ''}" data-ch="${i}">${badge(rest ? 'check' : open ? c.ic : 'shield', rest ? 'mint' : open ? GAMES[c.game].tone : 'peach')}<div><small class="muted">${c.place}</small><b>${c.n}</b><small>${open ? (rest ? 'восстановлено' : `эпизоды ${n} из ${L}`) : 'откроется после первого эпизода предыдущей главы'}</small></div>${i === cur ? '<span class="tag soft">сейчас</span>' : rest ? `<span class="tag ok">${ic('check')}</span>` : ''}</button>`; }).join('')}</div>
      ${fin ? `<div class="card story-end"><h3>Эпилог</h3><p class="story-txt">${STORY.epilogue}</p></div>` : `<div class="note">${ic('target')}<span>Цель — восстановить все 8 районов: пройти Школу и все 21 уровень игр. Каждая глава — +100 XP, весь город — +300 XP и достижение «Мастер управления».</span></div>`}`;
  },
  mount(el) {
    el.addEventListener('click', e => { const b = e.target.closest('[data-ch]'); if (!b) return; const i = +b.dataset.ch; if (!Story.open(i)) { toast('shield', 'Район пока закрыт', 'Пройди первый эпизод предыдущей главы'); return; } storySheet(i); });
    $('#stPro', el).onclick = () => prologueModal();
    if (!Story.s.seen.prologue) setTimeout(() => App.cur?.name === 'story' && prologueModal(), 350);
  }
};
/* карточка сюжета для главной и вкладки «Игры» */
function storyCard() {
  const P = Story.progress(), i = Story.current(), c = i == null ? null : STORY.chapters[i];
  return `<button class="lrow" data-go="story">${badge('robot', 'lilac')}<div><b>Сюжет · ${STORY.title}</b><small>${c ? `${c.place}: ${c.n} · город восстановлен на ${Math.round(P * 100)}%` : 'Город восстановлен — эпилог открыт'}</small></div>${ic('chev', 'chev')}</button>`;
}

/* ---------------- Рейтинг игроков на этом телефоне ---------------- */
const Board = {
  get b() { const b = S.board ||= {}; b.players ||= {}; return b; },
  key: n => String(n).trim().slice(0, 20),
  add(name, game, r, win) {
    const k = this.key(name); if (!k) return; const p = this.b.players[k] ||= { games: 0, wins: 0, best: {}, pur: [] };
    p.games++; if (win) p.wins++; if (!p.best[game] || r.score > p.best[game]) p.best[game] = r.score;
    if (r.purity != null) { p.pur.push(Math.round(r.purity * 100)); if (p.pur.length > 20) p.pur.shift(); }
    p.t = Date.now(); save();
  },
  rows() {
    return Object.entries(this.b.players).map(([n, p]) => ({ n, ...p, avgPur: p.pur?.length ? Math.round(p.pur.reduce((a, b) => a + b, 0) / p.pur.length) : null }))
      .sort((a, b) => b.wins - a.wins || (b.avgPur ?? -1) - (a.avgPur ?? -1) || b.games - a.games);
  },
  html(limit = 8) {
    const r = this.rows().slice(0, limit);
    return r.length ? `<div class="card board" style="padding:4px 14px">${r.map((p, i) => `<div class="kv"><span class="l">${i + 1}. ${esc(p.n)}</span><b>${plur(p.wins, 'победа', 'победы', 'побед')} · ${p.avgPur == null ? '—' : 'чистота ' + p.avgPur + '%'}</b></div>`).join('')}</div>` : '<p class="sub">Сыграйте первую дуэль — здесь появится рейтинг.</p>';
  }
};

/* ---------------- Дуэль: по очереди на одном телефоне ---------------- */
const Duel = {
  st: null,
  start(names, game, lv) {
    this.st = { names, game, lv, i: 0, res: [], cal: Object.fromEntries(names.map(n => [n, structuredClone(S.calib)])), t: Date.now() };
    this.turn();
  },
  get name() { return this.st?.names[this.st.i]; },
  turn() {
    const d = this.st, g = GAMES[d.game];
    modal(`${badge('user', 'sky', 'xl')}<div style="font-size:20px;font-weight:800;margin-top:10px">Ход: ${esc(this.name)}</div><p class="sub">${d.i ? 'Передай телефон следующему игроку.' : 'Первый игрок.'} «${g.t}», уровень ${d.lv}.${C().mode === 'emg' ? ' Перед игрой — проверка датчиков (5 с): калибровка своя у каждого.' : ''}</p><button class="btn" data-x="go">${ic('play')} Я готов</button><button class="btn ghost" data-x="ex" style="margin-top:8px">Отменить дуэль</button>`,
      (m, close) => { m.onclick = e => { const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return; close(); if (x === 'ex') { this.st = null; App.go('games', {}, { back: true }); return; } App.go('play', { id: d.game, diff: d.lv, duel: this.name }); }; });
  },
  /* калибровка игрока на время его хода; владелец телефона получает свою обратно при выходе с экрана игры */
  useCal(name) { if (!this.st) return; this.own = { calib: structuredClone(S.calib), lastQC: S.lastQC }; Object.assign(S.calib, this.st.cal[name] || {}); S.lastQC = 0; },
  endCal(name) { if (!this.own) return; if (this.st && name) this.st.cal[name] = structuredClone(S.calib); Object.assign(S.calib, this.own.calib); S.lastQC = this.own.lastQC; this.own = null; save(); },
  done(r) {
    const d = this.st; if (!d) return;
    d.res.push({ n: this.name, score: r.score, acc: r.acc, purity: r.purity, stars: r.stars, win: r.win !== false });
    d.i++;
  },
  over() { return this.st && this.st.i >= this.st.names.length; },
  finish() {
    const d = this.st, r = [...d.res].sort((a, b) => b.score - a.score || (b.purity ?? 0) - (a.purity ?? 0));
    const tie = r.length > 1 && r[0].score === r[1].score && (r[0].purity ?? 0) === (r[1].purity ?? 0), w = tie ? null : r[0];
    const pr = d.res.filter(x => x.purity != null).sort((a, b) => b.purity - a.purity), pure = pr.length && !(pr[1] && pr[1].purity === pr[0].purity) ? pr[0] : null;
    for (const x of d.res) Board.add(x.n, d.game, x, x === w);
    Bus.emit('duel:end', { game: d.game, lv: d.lv, results: d.res.map(x => ({ ...x })) });
    return { w, pure };
  }
};
function duelSheet() {
  const recent = Board.rows().slice(0, 4).map(p => p.n), names = [S.profile.name, ...recent.filter(n => n !== S.profile.name)].slice(0, 2);
  while (names.length < 2) names.push('Игрок ' + (names.length + 1));
  const games = ARCADE();
  sheet(`<div class="sh-head">${badge('user', 'sky', 'lg')}<div><h2 style="margin:0">Дуэль</h2><small class="muted">2–4 игрока по очереди на одном телефоне</small></div></div>
    <div class="note">${ic('info')}<span>Каждый играет тот же уровень. Побеждает больше очков, при равенстве — чище сигнал. Отдельно отмечается самый чистый сигнал. Гостевые ходы не попадают в статистику владельца.</span></div>
    <h3 class="h3">Игроки</h3><div id="dN">${names.map((n, i) => `<input class="txt" data-n="${i}" maxlength="20" value="${esc(n)}" style="margin-bottom:8px">`).join('')}</div>
    <div class="row"><button class="btn ghost sm" id="dAdd">${ic('plus')} Игрок</button><button class="btn ghost sm" id="dDel">${ic('x')} Убрать</button></div>
    <h3 class="h3">Игра</h3><div class="gbtns" id="dG">${games.map((id, i) => `<button class="chipbtn ${i ? '' : 'on'}" data-g="${id}">${GAMES[id].t}</button>`).join('')}</div>
    <h3 class="h3">Уровень</h3>${seg('dlv', [['1', '1'], ['2', '2'], ['3', '3']], '1')}
    <h3 class="h3">Рейтинг на этом телефоне</h3>${Board.html(5)}
    <button class="btn" id="dGo" style="margin-top:14px">${ic('play')} Начать дуэль</button>`, (sh, close) => {
    let game = games[0], lv = 1;
    $('#dG', sh).onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; game = b.dataset.g; $$('#dG button', sh).forEach(x => x.classList.toggle('on', x === b)); };
    bindSeg(sh, 'dlv', v => { lv = +v; });
    const N = () => $$('[data-n]', sh);
    $('#dAdd', sh).onclick = () => { if (N().length >= 4) return toast('info', 'Не больше 4 игроков'); $('#dN', sh).insertAdjacentHTML('beforeend', `<input class="txt" data-n="${N().length}" maxlength="20" value="Игрок ${N().length + 1}" style="margin-bottom:8px">`); };
    $('#dDel', sh).onclick = () => { if (N().length <= 2) return toast('info', 'Нужно хотя бы 2 игрока'); N().at(-1).remove(); };
    $('#dGo', sh).onclick = () => {
      const list = N().map(i => Board.key(i.value)).filter(Boolean);
      if (list.length < 2) return toast('info', 'Нужно хотя бы 2 игрока');
      if (new Set(list).size !== list.length) return toast('info', 'Имена игроков не должны повторяться');
      close(); Duel.start(list, game, lv);
    };
  });
}
SCR.duel = {
  valid: () => !!Duel.st,
  render() {
    const d = Duel.st, g = GAMES[d.game], over = Duel.over(), fin = over ? (d.fin ||= Duel.finish()) : null; // итог фиксируется один раз — перерисовка не задваивает рейтинг
    const rows = [...d.res].sort((a, b) => b.score - a.score || (b.purity ?? 0) - (a.purity ?? 0));
    return `<div class="back"><button class="ib" data-go="games">${ic('back')}</button><span class="grow">Дуэль · ${g.t}, ур. ${d.lv}</span></div>
      ${over ? `<div class="result-hero">${badge(fin.w ? 'trophy' : 'user', 'sun', 'xxl')}<h1>${fin.w ? esc(fin.w.n) + ' побеждает!' : 'Ничья'}</h1><p class="sub" style="margin:0">${fin.w ? fmtN(fin.w.score) + ' очков' : 'Одинаковые очки и чистота сигнала'}${fin.pure && fin.pure !== fin.w ? ` · самый чистый сигнал — ${esc(fin.pure.n)} (${Math.round(fin.pure.purity * 100)}%)` : fin.pure ? ' · и самый чистый сигнал' : ''}</p></div>` : `<p class="sub">Сыграли ${d.res.length} из ${d.names.length}. Следующий: <b>${esc(Duel.name)}</b>.</p>`}
      <div class="card" style="padding:4px 14px;margin-top:12px">${rows.map((x, i) => `<div class="kv"><span class="l">${over ? i + 1 + '. ' : ''}${esc(x.n)}</span><b>${fmtN(x.score)} · точн. ${Math.round(x.acc * 100)}% · чист. ${x.purity == null ? '—' : Math.round(x.purity * 100) + '%'}</b></div>`).join('') || '<p class="sub">Ходов ещё не было.</p>'}</div>
      ${over ? `<h3 class="h3">Рейтинг на этом телефоне</h3>${Board.html()}<div class="row" style="margin-top:16px"><button class="btn ghost" data-go="games">К играм</button><button class="btn" id="duAgain">${ic('refresh')} Реванш</button></div>`
        : `<button class="btn" id="duNext" style="margin-top:16px">${ic('play')} Ход: ${esc(Duel.name)}</button>`}`;
  },
  mount(el) {
    // состояние дуэли живёт до следующей дуэли: перерисовка экрана итога безопасна, итог зафиксирован один раз (d.fin)
    if (Duel.over()) { if (!Duel.st.cele) { Duel.st.cele = true; confetti(110); Snd.win(); } const d = Duel.st; $('#duAgain', el).onclick = () => Duel.start(d.names, d.game, d.lv); }
    else $('#duNext', el).onclick = () => Duel.turn();
  }
};

/* ---------------- Общая таблица клуба (tools/relay.mjs в локальной сети) ---------------- */
const Club = {
  url: () => String(C().club || '').trim().replace(/\/$/, ''),
  id: () => S.clubId ||= 'p' + uid() + uid(),
  async req(path, body) {
    const u = this.url(); if (!/^https?:\/\//.test(u)) throw new Error('адрес клуба не задан');
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
    try { const r = await fetch(u + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal } : { signal: ctl.signal }); if (!r.ok) throw new Error('сервер ответил ' + r.status); return r.status === 204 ? null : r.json(); }
    finally { clearTimeout(t); }
  },
  send(week, game, lv, r) { if (!this.url()) return; this.req('/board', { id: this.id(), name: S.profile.name, week, game, lv, score: r.score, acc: Math.round(r.acc * 100), purity: r.purity == null ? null : Math.round(r.purity * 100) }).catch(e => console.warn('[Club]', e.message)); },
  list: week => Club.req('/board?week=' + encodeURIComponent(week))
};
