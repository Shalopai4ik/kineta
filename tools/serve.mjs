// Статический сервер для prototype/ без зависимостей (Node ≥ 18). Используется `npm run serve` и e2e-тестами.
//   node tools/serve.mjs [порт=3000] [хост=127.0.0.1]     — 0.0.0.0, чтобы открыть с телефона в той же сети
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../prototype');
export const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg' };

/* путь вне корня, каталоги и несуществующие файлы — 404; кэш выключен, чтобы правки были видны сразу */
export function staticServer(dir = root, port = 0, host = '127.0.0.1') {
  const base = path.resolve(dir);
  const server = http.createServer((req, res) => {
    let u; try { u = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
    const f = path.resolve(base, '.' + (u.endsWith('/') ? u + 'index.html' : u));
    if ((f !== base && !f.startsWith(base + path.sep)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise((r, j) => { server.once('error', j); server.listen(port, host, () => r({ server, url: `http://${host === '0.0.0.0' ? 'localhost' : host}:${server.address().port}/` })); });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = +process.argv[2] || 3000, host = process.argv[3] || '127.0.0.1';
  staticServer(root, port, host).then(({ url }) => console.log(`Kineta: ${url}  (F — К1, J — К2; Ctrl+C — остановить)`))
    .catch(e => { console.error(e.code === 'EADDRINUSE' ? `Порт ${port} занят: node tools/serve.mjs <другой порт>` : e.message); process.exit(1); });
}
