// Ретранслятор удалённого эмулятора (без зависимостей, Node 18+).
//   node tools/relay.mjs [порт]          — по умолчанию 8787
// Второй телефон/планшет открывает http://<IP компьютера>:8787/ — это пульт (emulator.html).
// Пульт шлёт пакеты POST /push, игра слушает GET /stream (Server-Sent Events).
// Формат пакетов — тот же жёсткий контракт, что у протеза:
//   Поток 1: {"timestamp_ms":…, "emg":[0…255, 0…255], "thr":[0…255, 0…255]}
//   Поток 2: {"timestamp_ms":…, "dist":{"neutral":…, …, "abduction":…}}
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
    let body = '';
    q.on('data', d => { body += d; if (body.length > 1e5) q.destroy(); });
    q.on('end', () => {
      let list; try { list = JSON.parse(body); } catch (e) { r.writeHead(400, cors); return r.end('bad json'); }
      for (const p of Array.isArray(list) ? list : [list]) { const line = 'data: ' + JSON.stringify(p) + '\n\n'; for (const c of clients) c.write(line); pkts++; }
      r.writeHead(204, cors); r.end();
    });
    return;
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
  for (const ip of ips) console.log(`  пульт:  http://${ip}:${port}/      в игре: Датчики → Удалённый эмулятор → http://${ip}:${port}`);
});
