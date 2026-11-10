// Предпросмотр DOCX без Word: mammoth → HTML (A4, поля 2 см, Calibri 11) → PDF и PNG страниц в tools/docs/out.
// Вёрстка приблизительная (Word переносит строки чуть иначе), но содержание, таблицы, картинки и объём видны.
//   node tools/docs/preview.mjs docs/Kineta-AI-report.docx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mammoth from 'mammoth';
import { launch, sleep } from '../../tests/e2e/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(here, 'out');
const file = path.resolve(process.argv[2]), base = path.basename(file, '.docx');
const { value: body, messages } = await mammoth.convertToHtml({ path: file });
const css = `@page{size:A4;margin:20mm}body{font-family:Calibri,Carlito,Arial,sans-serif;font-size:11pt;line-height:1.15;color:#2B2420}
h1{font-size:15pt;color:#C4581F;margin:14pt 0 6pt}h2{font-size:12.5pt;margin:10pt 0 4pt}p{margin:0 0 5pt}table{border-collapse:collapse;width:100%;margin:4pt 0 8pt;font-size:10.5pt}td,th{border:1px solid #D9CFC6;padding:3pt 5pt;vertical-align:top}
img{max-width:100%}code,pre{font-family:Consolas,monospace;font-size:8.5pt}ul,ol{margin:0 0 5pt 18pt;padding:0}li{margin-bottom:3pt}`;
const html = path.join(OUT, base + '.html'); fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>${css}</style>${body}`);
const { cdp, size, report } = await launch();
await size(794, 1123, false); await cdp('Page.navigate', { url: pathToFileURL(html).href }); await sleep(1500);
const pdf = Buffer.from((await cdp('Page.printToPDF', { printBackground: true, preferCSSPageSize: true })).data, 'base64');
fs.writeFileSync(path.join(OUT, base + '.preview.pdf'), pdf);
const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const words = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
for (let i = 0; i < Math.min(pages, 3); i++) { const r = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: i * 1123, width: 794, height: 1123, scale: 1 }, captureBeyondViewport: true }); fs.writeFileSync(path.join(OUT, `${base}-p${i + 1}.png`), Buffer.from(r.data, 'base64')); }
console.log(`${base}: ~${pages} стр. A4 · ${words} слов · картинок ${(body.match(/<img/g) || []).length} · таблиц ${(body.match(/<table/g) || []).length}${messages.length ? ' · mammoth: ' + messages.map(m => m.message).slice(0, 3).join('; ') : ''}`);
report();
