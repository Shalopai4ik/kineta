/* =====================================================================
   Native — мост к нативным возможностям мобильной сборки (Capacitor).
   В браузере каждая функция откатывается на веб-API, поэтому прототип
   на localhost и APK работают одним кодом.

   • Bluetooth LE: в WebView Android и iOS нет Web Bluetooth. Здесь
     navigator.bluetooth собирается поверх плагина
     @capacitor-community/bluetooth-le с тем же подмножеством API, которым
     пользуется BT / BleProsthesisDriver в core.js, — драйвер протеза не
     меняется.
   • Вибрация: @capacitor/haptics (на iOS navigator.vibrate нет).
   • Голосовые подсказки: @capacitor-community/text-to-speech, в браузере
     speechSynthesis.
   • Сохранение файлов: @capacitor/filesystem + @capacitor/share (в WebView
     скачивание через <a download> не работает), в браузере — Blob.
   ===================================================================== */
const Native = (() => {
  const cap = window.Capacitor;
  const isNative = !!cap?.isNativePlatform?.();
  const P = name => isNative ? cap.Plugins?.[name] || null : null;

  /* ---------- Bluetooth LE поверх плагина ---------- */
  const BASE = '-0000-1000-8000-00805f9b34fb';
  // имена GATT, которыми пользуется core.js, → 16-битные UUID
  const NAMED = {
    battery_service: 0x180f, battery_level: 0x2a19, device_information: 0x180a,
    manufacturer_name_string: 0x2a29, model_number_string: 0x2a24, serial_number_string: 0x2a25,
    firmware_revision_string: 0x2a26, hardware_revision_string: 0x2a27
  };
  /* число (0xffe0), имя GATT или полный UUID → полный UUID в нижнем регистре, как ждёт плагин */
  function fullUuid(u) {
    if (typeof u === 'string' && NAMED[u] != null) u = NAMED[u];
    if (typeof u === 'number') return u.toString(16).padStart(8, '0') + BASE;
    const s = String(u).trim().toLowerCase();
    if (/^(0x)?[0-9a-f]{4,8}$/.test(s)) return parseInt(s.replace(/^0x/, ''), 16).toString(16).padStart(8, '0') + BASE;
    return s;
  }
  const hexToDv = hex => {
    const b = String(hex || '').replace(/[^0-9a-f]/gi, ''), out = new Uint8Array(b.length >> 1);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(b.substr(i * 2, 2), 16);
    return new DataView(out.buffer);
  };
  const toHex = data => {
    const u8 = data instanceof DataView ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
    return [...u8].map(x => x.toString(16).padStart(2, '0')).join('');
  };
  /* нативный стек BLE не любит параллельные операции — выполняем по очереди, как BleClient */
  let q = Promise.resolve();
  const serial = fn => { const r = q.then(fn, fn); q = r.catch(() => { }); return r; };

  class Emitter {
    constructor() { this._l = {}; }
    addEventListener(t, f) { (this._l[t] ||= new Set()).add(f); }
    removeEventListener(t, f) { this._l[t]?.delete(f); }
    _emit(t, e) { for (const f of [...(this._l[t] || [])]) try { f(e); } catch (err) { console.warn(err); } }
  }
  function makeBluetooth(BLE) {
    let ready = null;
    const init = () => ready ||= BLE.initialize({ androidNeverForLocation: true }).catch(e => { ready = null; throw e; });
    const KNOWN = 'kineta.ble.known';
    const remember = d => { try { const k = JSON.parse(localStorage.getItem(KNOWN) || '[]').filter(x => x !== d); k.unshift(d); localStorage.setItem(KNOWN, JSON.stringify(k.slice(0, 5))); } catch (e) { } };

    class Characteristic extends Emitter {
      constructor(dev, svc, uuid) { super(); this.dev = dev; this.svc = svc; this.uuid = uuid; this.value = null; this.sub = null; }
      get args() { return { deviceId: this.dev.id, service: this.svc, characteristic: this.uuid }; }
      async readValue() { const r = await serial(() => BLE.read(this.args)); return this.value = hexToDv(r?.value); }
      async startNotifications() {
        const key = `notification|${this.dev.id}|${this.svc}|${this.uuid}`;
        await this.sub?.remove?.();
        this.sub = await BLE.addListener(key, ev => { this.value = hexToDv(ev?.value); this._emit('characteristicvaluechanged', { target: this }); });
        await serial(() => BLE.startNotifications(this.args)); return this;
      }
      async stopNotifications() { await this.sub?.remove?.(); this.sub = null; await serial(() => BLE.stopNotifications(this.args)).catch(() => { }); return this; }
      writeValueWithResponse(data) { return serial(() => BLE.write({ ...this.args, value: toHex(data) })); }
      writeValueWithoutResponse(data) { return serial(() => BLE.writeWithoutResponse({ ...this.args, value: toHex(data) })); }
      writeValue(data) { return this.writeValueWithResponse(data); }
    }
    class Service {
      constructor(dev, info) { this.dev = dev; this.uuid = info.uuid; this.info = info; }
      async getCharacteristic(u) {
        const id = fullUuid(u);
        if (!(this.info.characteristics || []).some(c => c.uuid.toLowerCase() === id)) throw new Error('Характеристика не найдена: ' + id);
        return new Characteristic(this.dev, this.uuid, id);
      }
    }
    class Gatt {
      constructor(dev) { this.device = dev; this.connected = false; this.services = null; }
      async connect() {
        await init();
        await this.discSub?.remove?.();
        this.discSub = await BLE.addListener(`disconnected|${this.device.id}`, () => { this.connected = false; this.services = null; this.device._emit('gattserverdisconnected', { target: this.device }); });
        await serial(() => BLE.connect({ deviceId: this.device.id, timeout: 12000 }));
        this.connected = true;
        this.services = (await serial(() => BLE.getServices({ deviceId: this.device.id })))?.services || [];
        return this;
      }
      async getPrimaryService(u) {
        const id = fullUuid(u), s = (this.services || []).find(x => x.uuid.toLowerCase() === id);
        if (!s) throw new Error('Сервис не найден: ' + id);
        return new Service(this.device, s);
      }
      disconnect() { this.connected = false; serial(() => BLE.disconnect({ deviceId: this.device.id })).catch(() => { }); }
    }
    class Device extends Emitter {
      constructor(d) { super(); this.id = d.deviceId; this.name = d.name || d.deviceId; this.gatt = new Gatt(this); }
    }
    return {
      native: true,
      async requestDevice(opt = {}) {
        await init();
        const o = { optionalServices: (opt.optionalServices || []).map(fullUuid) };
        const prefix = opt.filters?.find(f => f.namePrefix)?.namePrefix; if (prefix) o.namePrefix = prefix;
        const d = await serial(() => BLE.requestDevice(o)); // системный список устройств плагина
        remember(d.deviceId); return new Device(d);
      },
      /* устройства, к которым пользователь уже подключался (аналог navigator.bluetooth.getDevices) */
      async getDevices() {
        let ids = []; try { ids = JSON.parse(localStorage.getItem(KNOWN) || '[]'); } catch (e) { }
        if (!ids.length) return [];
        await init();
        const r = await serial(() => BLE.getDevices({ deviceIds: ids })).catch(() => null);
        return (r?.devices || []).map(d => new Device(d));
      }
    };
  }
  const BLE = P('BluetoothLe');
  if (BLE && !navigator.bluetooth) {
    try { Object.defineProperty(navigator, 'bluetooth', { value: makeBluetooth(BLE), configurable: true }); }
    catch (e) { console.warn('[Native] Bluetooth недоступен', e); }
  }

  /* ---------- Вибрация ---------- */
  const H = P('Haptics');
  function vibrate(p) {
    const ms = Array.isArray(p) ? p.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) : +p || 10;
    if (H) { (ms <= 20 ? H.impact({ style: 'LIGHT' }) : H.vibrate({ duration: Math.min(ms, 400) })).catch(() => { }); return; }
    try { navigator.vibrate?.(p); } catch (e) { }
  }

  /* ---------- Голосовые подсказки ----------
     1) Записанный голос: фразы игры заранее озвучены нейросетевым голосом Piper (tools/voiceover.mjs →
        audio/voice/*.mp3 + index.json) — звучит одинаково приятно на любом телефоне и без интернета.
     2) Если записи нет (новая фраза) или выбран «Системный» — синтезатор телефона, лучший русский голос:
        нейросетевой (Natural / Neural / Online / Enhanced) → Google → остальные. */
  const TTS = P('TextToSpeech');
  const voiceKey = s => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[«»"'!?.,…:;()—–-]/g, ' ').replace(/\s+/g, ' ').trim(); // как в tools/voiceover.mjs
  let clips = null, clipsP = null, player = null;
  const loadClips = () => clipsP ||= (typeof fetch === 'function' ? fetch('audio/voice/index.json').then(r => r.ok ? r.json() : null) : Promise.resolve(null))
    .then(j => { clips = j && typeof j.files === 'object' ? j.files : {}; }).catch(() => { clips = {}; });
  if (typeof window !== 'undefined' && window.document) loadClips();
  const voicePref = () => { try { return C().voiceSrc || 'rec'; } catch (e) { return 'rec'; } };
  function playClip(text) {
    if (!clips) return false; const f = clips[voiceKey(text)]; if (!f || typeof Audio === 'undefined') return false;
    try { player?.pause(); player = new Audio('audio/voice/' + f); player.play().catch(() => { }); return true; } catch (e) { return false; }
  }
  const vrank = v => (/natural|neural|online|premium|enhanced|wavenet/i.test(v.name || '') ? 40 : 0) + (/google/i.test(v.name || '') ? 20 : 0) + (/milena|svetlana|dariya|katya|alena|yuri|irina/i.test(v.name || '') ? 5 : 0) + (v.localService ? 1 : 0);
  const bestOf = list => list.filter(v => /^ru/i.test(v.lang || '')).sort((a, b) => vrank(b) - vrank(a))[0] || null;
  let ttsVoice; // индекс лучшего голоса плагина (undefined — ещё не искали, -1 — нет русского)
  async function pluginVoice() { if (ttsVoice !== undefined) return ttsVoice; try { const l = (await TTS.getSupportedVoices())?.voices || [], b = bestOf(l); ttsVoice = b ? l.indexOf(b) : -1; } catch (e) { ttsVoice = -1; } return ttsVoice; }
  let lastSay = '', lastSayT = 0;
  function say(text, { rate = 1, force = false, src } = {}) {
    if (!text) return;
    const now = Date.now(); if (!force && text === lastSay && now - lastSayT < 1500) return; // одна и та же фраза не повторяется очередью
    lastSay = text; lastSayT = now;
    if ((src || voicePref()) === 'rec' && playClip(text)) return;
    if (TTS) { pluginVoice().then(vi => TTS.speak({ text, lang: 'ru-RU', rate, pitch: 1.03, volume: 1, queueStrategy: 0, ...(vi >= 0 ? { voice: vi } : {}) })).catch(() => { }); return; }
    const ss = window.speechSynthesis; if (!ss || typeof SpeechSynthesisUtterance === 'undefined') return;
    try {
      ss.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'ru-RU'; u.rate = rate; u.pitch = 1.03;
      const v = bestOf(ss.getVoices?.() || []); if (v) u.voice = v;
      ss.speak(u);
    } catch (e) { }
  }
  function hush() { try { player?.pause(); } catch (e) { } if (TTS) TTS.stop().catch(() => { }); else try { window.speechSynthesis?.cancel(); } catch (e) { } }
  /* что сейчас доступно — для профиля: есть ли записи и какой системный голос будет выбран */
  function voiceInfo() { const sys = !TTS && window.speechSynthesis ? bestOf(window.speechSynthesis.getVoices?.() || []) : null; return { rec: !!(clips && Object.keys(clips).length), recN: clips ? Object.keys(clips).length : 0, sys: TTS ? 'синтезатор телефона' : sys ? sys.name : 'нет русского голоса' }; }

  /* ---------- Сохранить / поделиться файлом ---------- */
  async function saveFile(name, text, mime = 'application/json', title = name) {
    const FS = P('Filesystem'), SH = P('Share');
    if (FS && SH) {
      const r = await FS.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
      let cancelled = false;
      await SH.share({ title, files: [r.uri], dialogTitle: title }).catch(e => { if (!/cancel/i.test(e?.message || '')) throw e; cancelled = true; });
      return cancelled ? 'cancel' : 'shared';
    }
    if (navigator.canShare && navigator.share && typeof File !== 'undefined') {
      const f = new File([text], name, { type: mime });
      if (navigator.canShare({ files: [f] }) && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ files: [f], title }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancel'; } }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return 'saved';
  }

  /* ---------- Напоминание о тренировке ----------
     APK: @capacitor/local-notifications — придёт, даже если приложение закрыто. Браузер: Notification API,
     пока вкладка открыта. Одно уведомление на ближайший раз (id 1001), приложение переносит его само. */
  const LN = P('LocalNotifications'); let webT = 0;
  async function remind(at, title, body, ask = false) {
    if (LN) {
      try {
        await LN.cancel({ notifications: [{ id: 1001 }] }).catch(() => { }); if (!at) return 'off';
        let p = await LN.checkPermissions(); if (p.display !== 'granted' && ask) p = await LN.requestPermissions();
        if (p.display !== 'granted') return 'denied';
        await LN.schedule({ notifications: [{ id: 1001, title, body, schedule: { at, allowWhileIdle: true } }] }); return 'native';
      } catch (e) { console.warn('[Native] напоминание', e); return 'error'; }
    }
    clearTimeout(webT); if (!at) return 'off';
    if (typeof Notification === 'undefined') return 'none';
    if (Notification.permission === 'default' && ask) await Notification.requestPermission().catch(() => { });
    if (Notification.permission !== 'granted') return 'denied';
    const ms = at - Date.now(); if (ms > 0 && ms < 2 ** 31 - 1) webT = setTimeout(() => { try { new Notification(title, { body, icon: 'img/own/kineta-icon.svg', tag: 'kineta-remind' }); } catch (e) { } }, ms);
    return 'web';
  }

  /* ---------- Статус-бар под тему ---------- */
  const SB = P('StatusBar');
  function statusBar(dark, color) { if (!SB) return; SB.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(() => { }); SB.setBackgroundColor?.({ color }).catch(() => { }); }

  return { isNative, statusBar, vibrate, say, hush, saveFile, fullUuid, hexToDv, toHex, voiceKey, voiceInfo, loadClips, remind, hasTTS: () => !!TTS || 'speechSynthesis' in window };
})();
