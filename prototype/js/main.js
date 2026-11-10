/* =====================================================================
   Kineta — запуск: главный цикл, панель эмулятора, клавиатура,
   мобильный эмулятор, восстановление связи с протезом, API встраивания.
   ===================================================================== */

/* ---------------- Нижняя навигация ---------------- */
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b && App.cur?.name !== b.dataset.tab) { App.go(b.dataset.tab, {}, { fade: true }); vib(6); } });

/* ---------------- Клавиатура эмулятора: F — К1 (закрытие), J — К2 (открытие); 1–4 — жесты СПППР ---------------- */
const KEYMAP = { KeyF: 0, KeyA: 0, ArrowLeft: 0, KeyJ: 1, KeyL: 1, ArrowRight: 1 };
const GKEYS = { Digit1: 'pronation', Digit2: 'supination', Digit3: 'adduction', Digit4: 'abduction' };
addEventListener('keydown', e => {
  if (e.target?.matches?.('input,textarea,select,[contenteditable]')) return;
  if (e.code in KEYMAP) { e.preventDefault(); Intent.keys[KEYMAP[e.code]] = true; Snd.init(); }
  if (e.code in GKEYS) { e.preventDefault(); Intent.gKeys[GKEYS[e.code]] = true; Snd.init(); }
  if ((e.code === 'Escape' || e.code === 'KeyP') && App.cur?.name === 'play') { SCR.play.pause(); return; }
  // Escape: закрыть верхнюю шторку, иначе вернуться назад с вложенного экрана
  if (e.code === 'Escape') {
    const sh = [...$$('.sheet')].filter(x => !x._closing).pop(); if (sh) { sh.close(); return; }
    if ($('.modal')) return; // модальные окна закрываются только кнопками
    if (App.cur && !App.cur.sc.tab && $('[data-back], #eBack', App.cur.el)) ($('#eBack', App.cur.el) || $('[data-back]', App.cur.el)).click();
  }
});
addEventListener('keyup', e => { if (e.code in KEYMAP) Intent.keys[KEYMAP[e.code]] = false; if (e.code in GKEYS) Intent.gKeys[GKEYS[e.code]] = false; });
addEventListener('blur', () => { Intent.keys = [false, false]; Intent.pad = [null, null]; Intent.gKeys = {}; });

/* ---------------- Панель эмулятора (десктоп) ---------------- */
$$('#emu .pad').forEach(bindPad);
const EMU_FMT = { noise: v => (+v).toFixed(3), crosstalk: pct, rise: v => v + '/с', jMax: v => v + ' мс', loss: pct, misclass: pct };
function renderEmu() {
  const e = C().emu, m = C().mode;
  $('#emuMode').innerHTML = seg('emode', [['emg', 'Поток 1 · ЭМГ'], ['spppr', 'Поток 2 · СПППР']], m);
  bindSeg($('#emu'), 'emode', v => {
    if (C().mode === v) return; C().mode = v; save(); Ctrl.restart(); renderEmu(); toast(v === 'emg' ? 'bolt' : 'layers', v === 'emg' ? 'Поток 1: двухканальная ЭМГ' : 'Поток 2: СПППР');
    // экраны, где виден режим потока, перерисовываем — иначе переключатель на экране показывает старый режим
    if (['sensors', 'home', 'device', 'calib'].includes(App.cur?.name)) setTimeout(() => App.refresh(), 380);
  });
  const r = (k, n, min, max, step) => `<div class="set" style="display:block"><div class="between"><span>${n}</span><span class="tag soft" id="ev_${k}">${EMU_FMT[k](e[k])}</span></div><input type="range" min="${min}" max="${max}" step="${step}" value="${e[k]}" data-emu="${k}"></div>`;
  const gb = m === 'spppr' && C().spGest === 6 ? `<div class="emu-g">${SP_KEYS.map((k, i) => `<button type="button" data-g="${k}"><kbd>${i + 1}</kbd>${SPN[k]}</button>`).join('')}</div>` : '';
  $('#emuParams').innerHTML = gb + (m === 'emg'
    ? r('noise', 'Шум', 0, .15, .005) + r('crosstalk', 'Перекрёстная наводка', 0, .5, .01) + r('rise', 'Нарастание (клав.)', .5, 5, .1)
    : r('jMax', 'Джиттер макс.', 20, 200, 1) + r('loss', 'Потеря пакетов', 0, .5, .01) + r('misclass', 'Ошибки классификации', 0, .3, .01))
    + `<button type="button" class="btn ghost sm" id="emuDrop" style="margin-top:8px">${ic('bt')} Обрыв связи на 2.5 с</button>`;
  bindGestureBtns($('#emuParams'));
  $('#emuDrop').onclick = () => { Intent.drop(2500); toast('bt', 'Эмулятор: обрыв связи', 'Сигнал пропадёт на 2.5 с'); };
  $$('#emuParams [data-emu]').forEach(inp => { rangeFill(inp); inp.addEventListener('input', () => { const k = inp.dataset.emu; e[k] = +inp.value; save(); rangeFill(inp); $('#ev_' + k).textContent = EMU_FMT[k](e[k]); }); });
}
let statT = 0;
function drawEmu(now) {
  if (!$('#emu')?.offsetWidth) return;
  drawTrace($('#emuScope'), 260, { states: true, pad: 6, lw: 1.6 });
  $$('#emu .pad').forEach(p => { const i = +p.dataset.ch; $('.fill', p).style.height = pct(Intent.lvl[i]); $('.thl', p).style.bottom = pct(C()['thr' + (i + 1)]); p.classList.toggle('hot', Intent.lvl[i] > .3); });
  if (now - statT < 250) return; statT = now;
  const s = ST[Ctrl.state], st = `<div>Состояние<b style="color:${s.hex}">${s.n}</b></div>`, src = `<div>Источник<b>${Ctrl.source()}</b></div>`;
  $('#emuStats').innerHTML = C().mode === 'emg'
    ? `${src}<div>Частота<b>${Ctrl.lossFlag ? 'нет данных' : Ctrl.rate + ' Гц'}</b></div><div>Сырой К1 / К2<b>${Ctrl.raw[0].toFixed(2)} / ${Ctrl.raw[1].toFixed(2)}</b></div><div>Задержка<b>${Ctrl.latency() ? Math.round(Ctrl.latency()) + " мс" : "—"}</b></div>${st}`
    : `${src}<div>Пакетов<b>${Ctrl.pkts}</b></div><div>Δt МК<b>${Math.round(Ctrl.pktDt * 1000)} мс</b></div><div>Связь<b>${Ctrl.lossFlag ? 'потеря' : 'ok'}</b></div>${st}`;
}

/* кнопки жестов СПППР: держать = жест (пронация, супинация, приведение, отведение) */
function bindGestureBtns(root) {
  $$('[data-g]', root).forEach(b => {
    const k = b.dataset.g, up = () => { Intent.gKeys[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', e => { b.setPointerCapture(e.pointerId); Intent.gKeys[k] = true; b.classList.add('on'); Snd.init(); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, up));
  });
}
/* ---------------- Удалённый эмулятор: пульт на другом устройстве (tools/relay.mjs + emulator.html) ----------------
   Пакеты идут по SSE в том же формате, что от протеза, и попадают в Ctrl.pushEmg / Ctrl.pushSpppr. */
const Remote = {
  es: null, on: false, owned: false,
  connect(url) {
    url = String(url || '').trim().replace(/\/$/, ''); if (!/^https?:\/\//.test(url)) { toast('info', 'Нужен адрес вида http://192.168.1.5:8787'); return; }
    this.stop(true); C().remote = url; save();
    try { this.es = new EventSource(url + '/stream'); } catch (e) { toast('bt', 'Не удалось подключиться', String(e.message || e)); return; }
    this.es.onopen = () => {
      const first = !this.on; this.on = true;
      if (!Ctrl.external) { this.owned = true; Ctrl.external = true; Ctrl.restart(); }
      Ctrl.remote = true;
      if (first) { toast('wave', 'Удалённый эмулятор подключён', url); if (App.cur?.name === 'sensors') App.refresh(); }
    };
    this.es.onmessage = e => {
      let p; try { p = JSON.parse(e.data); } catch (_) { Ctrl.bad++; return; }
      const m = p && p.dist ? 'spppr' : 'emg';
      if (C().mode !== m) { C().mode = m; save(); Ctrl.restart(); renderEmu(); }
      m === 'spppr' ? Ctrl.pushSpppr(p) : Ctrl.pushEmg(p);
    };
    this.es.onerror = () => { if (this.on) toast('bt', 'Удалённый эмулятор: нет связи', 'Переподключаюсь автоматически'); this.on = false; };
  },
  stop(silent) {
    this.es?.close(); this.es = null; this.on = false; Ctrl.remote = false;
    if (this.owned) { this.owned = false; Ctrl.external = false; Ctrl.restart(); }
    if (!silent) { C().remote = ''; save(); }
  }
};
/* ---------------- Мобильный эмулятор (выдвижные панели) ---------------- */
$('#mEmuBtn').addEventListener('click', () => { $('#mEmu').classList.toggle('open'); Snd.init(); });
$$('#mEmu .pad').forEach(bindPad);

/* ---------------- Главный цикл ---------------- */
let lastF = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - lastF) / 1000); lastF = now;
  Ctrl.tick(now); Prosthesis.locked = ['play', 'calib', 'editor', 'onboard'].includes(App.cur?.name); Prosthesis.update(dt, now); Sig.push();
  if (App.cur?.sc.frame) { try { App.cur.sc.frame(dt, now, App.cur.el); } catch (e) { console.error(e); } }
  $$('#mEmu .pad').forEach(p => { const i = +p.dataset.ch; $('.fill', p).style.height = pct(Ctrl.a[i]); });
  // живой источник (протез или хост-приложение): экранные панели-эмуляторы скрыты — мультитач в реальном применении недопустим
  const live = Ctrl.external || BT.streaming(); if (live !== loop.live) { loop.live = live; document.body.classList.toggle('live-src', live); }
  drawEmu(now); drawFX(dt);
  requestAnimationFrame(loop);
}
// демо-протез понемногу разряжается; заряд реального протеза приходит по Bluetooth
setInterval(() => { if (S.device.connected && !S.device.real && Math.random() < .3) { S.device.battery = Math.max(5, S.device.battery - 1); save(); Bus.emit('battery', S.device.battery); } }, 90000);
Bus.on('state', e => { if (e.state === 'BOTH') vib(15); });
// свернули вкладку или ушли в другое приложение — игру на паузу, клавиши отпускаем
document.addEventListener('visibilitychange', () => { if (!document.hidden) return; Intent.keys = [false, false]; Intent.pad = [null, null]; if (App.cur?.name === 'play' && !SCR.play.intro) SCR.play.pause(); });

/* =====================================================================
   API встраивания — см. README.md
   ===================================================================== */
/* =====================================================================
   Интеграция через роутинг (deep link). Вход: kineta://train?… (или index.html?…),
   выход: переход на return=<url хоста>?… с порогами, чувствительностью и итогами. См. docs/INTEGRATION.md
   ===================================================================== */
const Host = {
  ret: null, session: null, name: null, t0: Date.now(), games: [],
  apply(url) {
    let q; try { q = new URL(url, location.href).searchParams; } catch (e) { return false; }
    const c = C(), num = (k, a, b) => { const v = +q.get(k); return q.has(k) && q.get(k) !== '' && Number.isFinite(v) ? clamp(v, a, b) : null; };
    const hand = q.get('hand'); if (hand === 'left' || hand === 'right') { c.hand = hand; c.mirror = hand === 'right'; applyMirror(); } // протез справа — здоровая рука левая
    for (const i of [1, 2]) { const g = num('gain' + i, 1, 20); if (g != null) c['gain' + i] = Math.round(g); }
    const t1 = num('thr1', 0, 255), t2 = num('thr2', 0, 255);
    if (t1 != null && t2 != null) { c.thrSrc = 'device'; Ctrl.devThr = null; Ctrl.setDevThr([t1, t2]); }
    const sp = num('gestures', 2, 6); if (sp != null) c.spGest = sp >= 6 ? 6 : 2;
    const mode = q.get('mode'), ext = q.get('source') === 'external' && !Ctrl.external;
    if (ext) Ctrl.external = true;
    if ((mode === 'emg' || mode === 'spppr') && mode !== c.mode) c.mode = mode;
    if (ext || mode) Ctrl.restart();
    if (q.get('return') && !this.safeReturn(q.get('return'))) console.warn('[Host] return отклонён: разрешены http(s) и схемы приложений');
    else if (q.get('return')) { this.ret = q.get('return'); this.name = q.get('host') || 'приложение'; this.session = q.get('session'); document.body.classList.add('hosted'); }
    Ctrl.applyDevThr(); save();
    const scr = q.get('screen'); if (scr && S.onboarded && window.App) setTimeout(() => KinetaTrainer.open(scr, { diff: +q.get('diff') || 1 }), 50);
    return true;
  },
  /* адрес возврата из deep link: http(s) или собственная схема приложения производителя (vendorapp://…).
     javascript:, data:, vbscript:, file:, blob: запрещены — иначе ссылка ?return=javascript:… выполнила бы чужой код. */
  safeReturn(url) {
    let u; try { u = new URL(String(url)); } catch (e) { return false; }
    const p = u.protocol.toLowerCase();
    if (p === 'http:' || p === 'https:') return true;
    return /^[a-z][a-z0-9+.-]*:$/.test(p) && !['javascript:', 'data:', 'vbscript:', 'file:', 'blob:', 'about:', 'filesystem:'].includes(p);
  },
  /* что игра возвращает хосту: пороги и чувствительность (их можно поменять в игре) + итоги сеанса */
  result() {
    const g = this.games, avg = (a, k) => a.length ? Math.round(a.reduce((s, x) => s + x[k], 0) / a.length * 100) : '';
    return {
      thr1: thrToRaw(0), thr2: thrToRaw(1), gain1: C().gain1, gain2: C().gain2, hand: C().hand, mode: C().mode,
      session: this.session || '', minutes: Math.round((Date.now() - this.t0) / 6e4), games: g.length,
      score: g.reduce((s, x) => s + (x.score || 0), 0), stars: g.reduce((s, x) => s + (x.stars || 0), 0),
      acc: avg(g, 'acc'), purity: avg(g.filter(x => x.purity != null), 'purity')
    };
  },
  back() {
    const r = this.result(); Bus.emit('host:return', r); save(true);
    if (!this.ret) return r;
    if (!this.safeReturn(this.ret)) { console.warn('[Host] return отклонён'); return r; }
    try { const u = new URL(this.ret); for (const k in r) u.searchParams.set(k, r[k]); location.href = u.toString(); } catch (e) { console.warn('[Host] неверный return', e); }
    return r;
  }
};
Bus.on('level:end', r => Host.games.push({ game: r.game, score: r.score, stars: r.stars, acc: r.acc, purity: r.purity }));

window.KinetaTrainer = {
  version: APP_VERSION,
  host: Host,
  finishSession: () => Host.back(),
  useExternalSource(mode = 'emg') { Ctrl.external = true; C().mode = mode; save(); Ctrl.restart(); },
  useEmulator() { Ctrl.external = false; Ctrl.restart(); },
  pushEmg: s => Ctrl.pushEmg(s),
  pushSpppr: p => Ctrl.pushSpppr(p),
  on: (ev, cb) => Bus.on(ev, cb),            // 'state' | 'sp:gesture' | 'level:end' | 'feedback' | 'gesture' | 'switch' | 'gesture:count' | 'device' | 'device:lost' | 'signal:lost' | 'signal:back' | 'thr:device' | 'host:return' | 'battery'
  remote: { connect: url => Remote.connect(url), stop: () => Remote.stop(), status: () => ({ on: Remote.on, url: C().remote || '' }) },
  getThresholds: () => ({ thr1: thrToRaw(0), thr2: thrToRaw(1), gain1: C().gain1, gain2: C().gain2, source: C().thrSrc }),
  setConfig(p) { const m = C().mode; merge(S.cfg, p || {}); Ctrl.applyDevThr(); applyMirror(); save(); if (C().mode !== m) Ctrl.restart(); },
  getState: () => ({ state: Ctrl.state, a: Ctrl.a.slice(), grip: Prosthesis.grip, gesture: S.activeId, pose: Prosthesis.pose.slice(), source: Ctrl.source(), blocked: Ctrl.blocked }),
  getProgress: () => structuredClone({ profile: S.profile, games: S.games, history: S.history, stats: S.stats, feedback: S.feedback || [] }),
  getGestures: () => structuredClone({ gestures: S.gestures, rotation: S.rotation, active: S.activeId }),
  setGesture: id => Prosthesis.setActive(id),
  open: (screen, params) => { if (typeof screen !== 'string') return; const p = isObj(params) ? params : {}; return Object.hasOwn(GAMES, screen) ? App.go('play', { id: screen, diff: p.diff || 1, endless: !!p.endless }) : App.go(screen, p); },
  /* Bluetooth-протез: профиль GATT производителя, подключение (вызывать по жесту пользователя), команды */
  bluetooth: {
    setProfile(p) { Object.assign(C().ble, p || {}); save(); },
    getProfile: () => ({ ...C().ble }),
    connect: () => BT.request(),
    disconnect: () => BT.disconnect(),
    send: cmd => BT.send(cmd),
    status: () => ({ state: BT.state, connected: !!S.device.connected, real: !!S.device.real, streaming: BT.streaming(), battery: S.device.battery, info: S.device.info })
  }
};
addEventListener('message', e => {
  const d = e.data; if (!d || typeof d !== 'object') return;
  if (d.type === 'kineta:emg') Ctrl.pushEmg(d.payload);
  else if (d.type === 'kineta:spppr') Ctrl.pushSpppr(d.payload);
  else if (d.type === 'kineta:config') KinetaTrainer.setConfig(d.payload || {});
  else if (d.type === 'kineta:ble') KinetaTrainer.bluetooth.setProfile(d.payload || {});
  else if (d.type === 'kineta:external') KinetaTrainer.useExternalSource(d.payload || 'emg');
  else if (d.type === 'kineta:open') KinetaTrainer.open(d.payload);
});

/* ---------------- Старт ---------------- */
const qs = new URLSearchParams(location.search);
if (qs.has('reset')) { localStorage.removeItem(KEY); load(); }
if (qs.has('embed')) document.body.classList.add('embed');
if (qs.get('source') === 'external') Ctrl.external = true;
if (qs.get('mode') === 'spppr' || qs.get('mode') === 'emg') C().mode = qs.get('mode');
Host.apply(location.href);
/* мобильная сборка (Capacitor): deep link при запуске и во время работы, системная кнопка «Назад» */
const Cap = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.App : null;
if (Cap) {
  document.body.classList.add('native');
  Cap.getLaunchUrl?.().then(r => r?.url && Host.apply(r.url)).catch(() => { });
  Cap.addListener?.('appUrlOpen', e => e?.url && Host.apply(e.url));
  Cap.addListener?.('backButton', () => {
    const sh = [...$$('.sheet')].filter(x => !x._closing).pop(); if (sh) return sh.close();
    if ($('.modal')) return;
    if (App.cur?.name === 'play') return SCR.play.intro ? App.back() : SCR.play.pause();
    const bk = App.cur && !App.cur.sc.tab && ($('#eBack', App.cur.el) || $('[data-back]', App.cur.el)); if (bk) return bk.click();
    if (App.cur?.name !== 'home' && S.onboarded) return App.go('home', {}, { fade: true });
    Host.ret ? Host.back() : Cap.exitApp?.();
  });
}
{ const sh = $('#splHand'); if (sh) sh.innerHTML = handSVG([10, 8, 10, 14, 18, 30]); }
// Bluetooth-связь не переживает перезагрузку страницы: сбрасываем флаг и пробуем подключиться к уже разрешённому протезу
if (S.device.real) { S.device.connected = false; save(); }
if (qs.get('demo') === '0' && S.demo) { S.stats = { days: {}, gestTotal: {}, seeded: false }; S.history = []; S.games = {}; S.profile.xp = 0; S.profile.streak = 0; S.demo = false; save(true); }
if (S.demo) { document.body.classList.add('demo'); $('#phone').insertAdjacentHTML('beforeend', '<div id="demoTag" title="Статистика заполнена демо-данными. Сброс: Профиль → Сбросить статистику">Демо-данные</div>'); }
applyTheme(); applyMirror(); applyBig(); renderEmu(); Ctrl.restart(); Mission.ensure();
if (C().remote) Remote.connect(C().remote);
App.go(S.onboarded ? 'home' : 'onboard', {}, { fade: true });
if (S.onboarded) touchStreak();
if (S.device.real) BT.restore().then(ok => { if (!ok) setTimeout(() => toast('bt', 'Подключите протез снова', 'Экран «Мой протез» → Подключить'), 1500); });
setTimeout(() => $('#splash').classList.add('out'), qs.has('embed') ? 0 : 1500);
setTimeout(() => $('#splash')?.remove(), 2300);
requestAnimationFrame(loop);
