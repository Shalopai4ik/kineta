// Мост к нативным плагинам (js/native.js) и демо-данные (core.js load()).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './harness.mjs';

test('UUID: 16-битные, имена GATT и полные приводятся к формату плагина', () => {
  const k = loadCore();
  assert.equal(k.run(`Native.fullUuid(0xffe0)`), '0000ffe0-0000-1000-8000-00805f9b34fb');
  assert.equal(k.run(`Native.fullUuid('0xFFE1')`), '0000ffe1-0000-1000-8000-00805f9b34fb');
  assert.equal(k.run(`Native.fullUuid('battery_service')`), '0000180f-0000-1000-8000-00805f9b34fb');
  assert.equal(k.run(`Native.fullUuid('6E400001-B5A3-F393-E0A9-E50E24DCCA9E')`), '6e400001-b5a3-f393-e0a9-e50e24dcca9e');
  assert.equal(k.run(`Native.toHex(Native.hexToDv('0a ff 10'))`), '0aff10');
});

test('В браузере без Capacitor navigator.bluetooth не подменяется', () => {
  const k = loadCore();
  assert.equal(k.run('navigator.bluetooth'), undefined);
  assert.equal(k.run('Native.isNative'), false);
});

/* поддельный плагин @capacitor-community/bluetooth-le: один протез с сервисом ЭМГ 0xFFE0 */
function fakeCapacitor() {
  const L = {}, calls = [];
  const SVC = '0000ffe0-0000-1000-8000-00805f9b34fb', EMG = '0000ffe1-0000-1000-8000-00805f9b34fb', CMD = '0000ffe2-0000-1000-8000-00805f9b34fb';
  const BluetoothLe = {
    async initialize() { calls.push('init'); },
    async requestDevice(o) { calls.push(['request', o]); return { deviceId: 'AA:BB', name: 'Kineta-01' }; },
    async getDevices({ deviceIds }) { return { devices: deviceIds.map(id => ({ deviceId: id, name: 'Kineta-01' })) }; },
    async connect(o) { calls.push(['connect', o.deviceId]); },
    async disconnect() { calls.push('disconnect'); },
    async getServices() {
      return { services: [
        { uuid: '0000180f-0000-1000-8000-00805f9b34fb', characteristics: [{ uuid: '00002a19-0000-1000-8000-00805f9b34fb' }] },
        { uuid: SVC, characteristics: [{ uuid: EMG }, { uuid: CMD }] }
      ] };
    },
    async read(o) { calls.push(['read', o.characteristic]); return { value: '57' }; },
    async write(o) { calls.push(['write', o.characteristic, o.value]); },
    async startNotifications(o) { calls.push(['notify', o.characteristic]); },
    async stopNotifications() { },
    async addListener(key, cb) { L[key] = cb; return { remove: async () => { delete L[key]; } }; }
  };
  return { cap: { isNativePlatform: () => true, Plugins: { BluetoothLe } }, L, calls, EMG, SVC };
}

test('Bluetooth в APK: navigator.bluetooth поверх плагина — подключение, заряд, поток ЭМГ, команды, обрыв', async () => {
  const f = fakeCapacitor();
  const k = loadCore({ capacitor: f.cap });
  assert.equal(k.run('BT.supported()'), true);
  k.run(`Object.assign(C().ble, { namePrefix: 'Kineta', service: '0xFFE0', emgChar: '0xFFE1', cmdChar: '0xFFE2', format: 'u16le2', fullScale: 4095 }); C().mode = 'emg';`);
  // в реальном приложении toast/Geo живут в ui.js — здесь заглушки
  k.run(`globalThis.toast = () => {};`);
  await k.run('BT.request()');
  assert.equal(k.run('S.device.battery'), 0x57);
  assert.equal(k.run('S.device.connected'), true);
  assert.equal(k.run('BT.streaming()'), true);
  assert.equal(k.run('Ctrl.src.constructor.name'), 'BleProsthesisDriver');
  await new Promise(r => setImmediate(r));
  // протез шлёт пару uint16 LE: К1 = 4095 (максимум), К2 = 0
  const key = `notification|AA:BB|${f.SVC}|${f.EMG}`;
  assert.ok(f.L[key], 'подписка на уведомления ЭМГ');
  for (let i = 0; i < 30; i++) { k.advance(10); f.L[key]({ value: 'ff0f0000' }); k.run(`Ctrl.tick(${k.now})`); }
  assert.equal(k.run('Ctrl.state'), 'CH1');
  assert.equal(k.run('Ctrl.source()'), 'протез (Bluetooth)');
  // команда протезу уходит hex-строкой JSON
  await k.run(`BT.send({ cmd: 'grip', value: 1 })`);
  const w = f.calls.find(c => c[0] === 'write');
  assert.equal(Buffer.from(w[2], 'hex').toString(), '{"cmd":"grip","value":1}\n');
  // обрыв связи → драйвер снят, автопереподключение запланировано
  f.L['disconnected|AA:BB']();
  assert.equal(k.run('S.device.connected'), false);
  assert.equal(k.run('BT.state'), 'reconnecting');
  // известный протез восстанавливается без окна выбора
  assert.equal((await k.run('navigator.bluetooth.getDevices()')).length, 1);
});

test('Демо-история появляется только с ?demo=1', () => {
  const a = loadCore();
  assert.equal(a.run('S.history.length'), 0);
  assert.equal(a.run('S.profile.xp'), 0);
  assert.ok(!a.run('S.demo'));
  const b = loadCore({ search: '?demo=1' });
  assert.ok(b.run('S.history.length') > 0);
  assert.equal(b.run('S.demo'), true);
  assert.ok(b.run('S.history.every(h => h.seed)'));
});

test('Сохранение старой версии с демо-историей помечается как демо', () => {
  const old = { stats: { days: {}, gestTotal: {}, seeded: true }, history: [{ t: 1, game: 'race', seed: true }] };
  const k = loadCore({ storage: { 'kineta.app.v2': JSON.stringify(old) } });
  assert.equal(k.run('S.demo'), true);
});
