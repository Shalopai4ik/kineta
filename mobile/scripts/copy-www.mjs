// Копирует рабочие файлы веб-части (prototype/) в www/ — только то, что нужно игре
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../prototype'), dst = path.resolve(here, '../www');
fs.rmSync(dst, { recursive: true, force: true });
const items = ['index.html', 'css', 'js', 'fonts', 'img/own'];
let n = 0, bytes = 0;
const copy = (a, b) => {
  const st = fs.statSync(a);
  if (st.isDirectory()) { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) copy(path.join(a, f), path.join(b, f)); }
  else { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); n++; bytes += st.size; }
};
for (const it of items) copy(path.join(src, it), path.join(dst, it));
console.log(`www: ${n} файлов, ${(bytes / 1024).toFixed(0)} КБ`);
