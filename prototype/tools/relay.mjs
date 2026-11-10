// Ретранслятор удалённого эмулятора (без зависимостей, Node 18+).
//   node tools/relay.mjs [порт]          — по умолчанию 8787
// Второй телефон/планшет открывает http://<IP компьютера>:8787/ — это пульт (emulator.html).
// Пульт шлёт пакеты POST /push, игра слушает GET /stream (Server-Sent Events).
// Формат пакетов — тот же жёсткий контракт, что у протеза:
//   Поток 1: {"timestamp_ms":…, "emg":[0…255, 0…255], "thr":[0…255, 0…255]}
//   Поток 2: {"timestamp_ms":…, "dist":{"neutral":…, …, "abduction":…}}
// Общая таблица клуба (испытание недели): POST /board {id, name, week, game, lv, score, acc, purity},
// GET /board?week=YYYY-MM-DD → {week, rows}. Хранится в tools/board.json, лучший результат игрока за неделю.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = +process.argv[2] || 8787;
const here = path.dirname(fileURLToPath(import.meta.url));
const page = path.resolve(here, '../emulator.html');
const clients = new Set();
let pkts = 0;
const BOARD_FILE = path.resolve(here, 'board.json');
let board = {}; try { board = JSON.parse(fs.readFileSync(BOARD_FILE, 'utf8')) || {}; } catch (e) { board = {}; }
let saveT = 0; const saveBoard = () => { clearTimeout(saveT); saveT = setTimeout(() => fs.writeFile(BOARD_FILE, JSON.stringify(board), () => { }), 500); };
/* строгая проверка записи: чужой клиент в сети не должен испортить таблицу */
function entry(o) {
  if (!o || typeof o !== 'object') return null;
  const num = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
  const name = typeof o.name === 'string' ? o.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20) : '';
  if (!/^[\w-]{4,40}$/.test(o.id || '') || !name || !/^\d{4}-\d\d-\d\d$/.test(o.week || '') || !/^[a-z]{2,12}$/.test(o.game || '')) return null;
  if (!num(o.lv, 1, 4.5) || !num(o.score, 0, 1e6) || !num(o.acc, 0, 100) || !(o.purity == null || num(o.purity, 0, 100))) return null;
  return { id: o.id, name, game: o.game, lv: o.lv, score: Math.round(o.score), acc: Math.round(o.acc), purity: o.purity == null ? null : Math.round(o.purity), t: Date.now() };
}
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };

http.createServer((q, r) => {
  const url = q.url.split('?')[0];
  if (q.method === 'OPTIONS') { r.writeHead(204, cors); return r.end(); }
  if (url === '/stream') {
    r.writeHead(200, { ...cors, 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    r.write('retry: 1000\n\n'); clients.add(r);
    const ka = setInterval(() => r.write(': ka\n\n'), 15000);
    q.on('close', () => { clearInterval(ka); clients.delete(r); });
    return;
  }
  if (url === '/push' && q.method === 'POST') {
    const parts = []; let len = 0;
    q.on('data', d => { parts.push(d); len += d.length; if (len > 1e5) q.destroy(); });
    q.on('end', () => {
      const body = Buffer.concat(parts).toString('utf8');
      let list; try { list = JSON.parse(body); } catch (e) { r.writeHead(400, cors); return r.end('bad json'); }
      for (const p of Array.isArray(list) ? list : [list]) { const line = 'data: ' + JSON.stringify(p) + '\n\n'; for (const c of clients) c.write(line); pkts++; }
      r.writeHead(204, cors); r.end();
    });
    return;
  }
  if (url === '/board' && q.method === 'POST') {
    const parts = []; let len = 0; // куски собираем как байты: многобайтовая кириллица не рвётся на границе куска
    q.on('data', d => { parts.push(d); len += d.length; if (len > 4000) q.destroy(); });
    q.on('end', () => {
      const body = Buffer.concat(parts).toString('utf8');
      let o; try { o = JSON.parse(body); } catch (e) { r.writeHead(400, cors); return r.end('bad json'); }
      const e = entry(o); if (!e) { r.writeHead(422, cors); return r.end('bad entry'); }
      const w = board[o.week] ||= {}; if (!w[e.id] && Object.keys(w).length >= 500) { r.writeHead(507, cors); return r.end('full'); }
      if (!w[e.id] || e.score > w[e.id].score) w[e.id] = e; else w[e.id].name = e.name;
      const weeks = Object.keys(board).sort(); while (weeks.length > 12) delete board[weeks.shift()];
      saveBoard(); r.writeHead(204, cors); r.end();
    });
    return;
  }
  if (url === '/board') {
    const week = new URL(q.url, 'http://x').searchParams.get('week') || '';
    const rows = Object.values(board[week] || {}).sort((a, b) => b.score - a.score || (b.purity ?? 0) - (a.purity ?? 0)).slice(0, 50);
    r.writeHead(200, { ...cors, 'content-type': 'application/json' }); return r.end(JSON.stringify({ week, rows }));
  }
  if (url === '/status') { r.writeHead(200, { ...cors, 'content-type': 'application/json' }); return r.end(JSON.stringify({ games: clients.size, pkts })); }
  if (url === '/' || url === '/emulator.html') {
    fs.readFile(page, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(d); });
    return;
  }
  r.writeHead(404, cors); r.end();
}).listen(port, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log(`Kineta relay: порт ${port}`);
  for (const ip of ips) console.log(`  пульт:  http://${ip}:${port}/      в игре: Датчики → Удалённый эмулятор → http://${ip}:${port}
  таблица клуба: Игры → Испытание недели → http://${ip}:${port}`);
});
