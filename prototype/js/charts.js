/* =====================================================================
   Графики (SVG, без библиотек): кольцо, пончик, столбцы, линии, радар,
   тепловая карта, полукруглый индикатор. Все с анимацией и подсказками.
   Категориальные цвета — фиксированный порядок --s1..--s8, «Другое» — серый.
   ===================================================================== */
const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)'];
const OTHER = 'var(--rest)';

function ring(p, color = 'var(--primary)', size = 56, sw = 7, inner = '') {
  const r = (size - sw) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="ring">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${sw}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${c * (1 - clamp(p))}" transform="rotate(-90 ${size / 2} ${size / 2})" style="transition:stroke-dashoffset 1.2s var(--ease)"/>
    ${inner}</svg>`;
}
/* запускает анимации колец/полос после вставки в DOM */
function animateIn(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('[data-off]', root).forEach(c => c.style.strokeDashoffset = c.dataset.off);
    $$('[data-w]', root).forEach(b => b.style.width = b.dataset.w);
    $$('[data-count]', root).forEach(el => countUp(el, +el.dataset.count, el.dataset.fmt));
  }));
}
function countUp(el, to, fmt, dur = 1100) {
  const t0 = performance.now(), from = 0;
  const f = fmt === '%' ? v => Math.round(v) + '%' : fmt === 'ms' ? v => Math.round(v) + ' мс' : fmt === 'min' ? v => Math.round(v) + ' мин' : fmt === 'dec' ? v => v.toFixed(1) : v => fmtN(v);
  const step = now => { const k = clamp((now - t0) / dur); el.textContent = f(from + (to - from) * easeOut(k)); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function tipEl(host) { let t = host.querySelector('.tip'); if (!t) { t = document.createElement('div'); t.className = 'tip'; host.appendChild(t); } return t; }

/* ---------- пончик: счётчик жестов ---------- */
function donut(host, items, opt = {}) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1, R = 72, r = 50, cx = 80, cy = 80;
  let a0 = -Math.PI / 2, paths = '';
  const arc = (a1, a2, ro, ri) => {
    const g = 0.012, s = a1 + g, e = Math.max(s + .001, a2 - g), lg = e - s > Math.PI ? 1 : 0;
    const p = (rad, a) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
    return `M${p(ro, s)} A${ro} ${ro} 0 ${lg} 1 ${p(ro, e)} L${p(ri, e)} A${ri} ${ri} 0 ${lg} 0 ${p(ri, s)} Z`;
  };
  items.forEach((it, i) => {
    const a1 = a0 + it.value / total * Math.PI * 2;
    paths += `<path d="${arc(a0, a1, R, r)}" fill="${it.color}" data-i="${i}" style="animation:pop2 .6s ${i * .06}s var(--spring) both"/>`;
    a0 = a1;
  });
  host.innerHTML = `<div class="donut-wrap"><div class="donut-c"><svg viewBox="0 0 160 160" width="160" height="160">${paths}</svg>
    <div class="ctr"><div><small class="dl-l">${opt.centerLabel || 'Всего'}</small><b class="dl-v" data-count="${total}">0</b><small class="dl-p">&nbsp;</small></div></div></div>
    <div class="lg-list">${items.map((it, i) => `<button data-i="${i}"><i style="background:${it.color}"></i><span>${esc(it.label)}</span><em>${fmtN(it.value)}</em></button>`).join('')}</div></div>`;
  const ps = $$('path', host), bs = $$('.lg-list button', host), L = $('.dl-l', host), V = $('.dl-v', host), P = $('.dl-p', host);
  const hl = i => {
    ps.forEach((p, k) => { p.style.transform = k === i ? 'scale(1.07)' : ''; p.style.opacity = i == null || k === i ? 1 : .35; });
    bs.forEach((b, k) => b.classList.toggle('on', k === i));
    if (i == null) { L.textContent = opt.centerLabel || 'Всего'; V.textContent = fmtN(total); P.innerHTML = '&nbsp;'; }
    else { L.textContent = items[i].label; V.textContent = fmtN(items[i].value); P.textContent = Math.round(items[i].value / total * 100) + '%'; }
  };
  [...ps, ...bs].forEach(el => { el.addEventListener('pointerenter', () => hl(+el.dataset.i)); el.addEventListener('pointerleave', () => hl(null)); el.addEventListener('click', () => { hl(+el.dataset.i); opt.onPick?.(items[+el.dataset.i]); }); });
  animateIn(host);
}

/* ---------- столбцы ---------- */
function bars(host, data, opt = {}) {
  const W = 340, H = 170, pl = 28, pb = 22, pt = 10, n = data.length, raw = Math.max(opt.goal || 0, ...data.map(d => d.value), 1) * 1.1, stepV = [1, 2, 5, 10, 15, 20, 25, 50, 100].find(k => k * 3 >= raw) || Math.ceil(raw / 3), max = stepV * 3;
  const bw = (W - pl) / n, y = v => H - pb - (v / max) * (H - pb - pt);
  let s = '';
  for (let k = 0; k <= 3; k++) { const v = stepV * k; s += `<line class="grid" x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pl - 6}" y="${y(v) + 3}" text-anchor="end">${Math.round(v)}</text>`; }
  data.forEach((d, i) => {
    const x = pl + i * bw + bw * .18, w = bw * .64, h = Math.max(0, H - pb - y(d.value));
    s += `<rect x="${x}" y="${y(d.value)}" width="${w}" height="${h}" rx="${Math.min(5, w / 2)}" fill="${d.value ? (d.hi ? 'var(--primary)' : 'var(--primary-2)') : 'var(--line)'}" style="transform-origin:${x}px ${H - pb}px;animation:barUp .8s ${i * .03}s var(--ease) both" data-i="${i}"/>`;
    if (d.lbl !== false && (n <= 14 || i % Math.ceil(n / 10) === 0)) s += `<text class="axis" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${d.label}</text>`;
    s += `<rect x="${pl + i * bw}" y="${pt}" width="${bw}" height="${H - pb - pt}" fill="transparent" data-h="${i}"/>`;
  });
  if (opt.goal) s += `<line x1="${pl}" x2="${W}" y1="${y(opt.goal)}" y2="${y(opt.goal)}" stroke="var(--ok)" stroke-width="1.5" stroke-dasharray="4 4"/><text class="axis" x="${W}" y="${y(opt.goal) - 4}" text-anchor="end" style="fill:var(--ok)">цель ${opt.goal}</text>`;
  host.innerHTML = `<div class="chart"><style>@keyframes barUp{from{transform:scaleY(0)}}</style><svg viewBox="0 0 ${W} ${H}">${s}</svg></div>`;
  const ch = $('.chart', host), tip = tipEl(ch), svg = $('svg', ch);
  $$('[data-h]', svg).forEach(r => {
    r.addEventListener('pointerenter', () => {
      const i = +r.dataset.h, d = data[i], bb = svg.getBoundingClientRect(), k = bb.width / W;
      tip.innerHTML = `${opt.fmt ? opt.fmt(d.value) : d.value}<small>${d.full || d.label}</small>`;
      tip.style.left = (pl + i * bw + bw / 2) * k + 'px'; tip.style.top = y(d.value) * k + 'px'; tip.classList.add('on');
      $$('rect[data-i]', svg).forEach(b => b.style.opacity = +b.dataset.i === i ? 1 : .45);
    });
    r.addEventListener('pointerleave', () => { tip.classList.remove('on'); $$('rect[data-i]', svg).forEach(b => b.style.opacity = 1); });
  });
}

/* ---------- линии (одна шкала!) ---------- */
function lines(host, labels, series, opt = {}) {
  const W = 340, H = 180, pl = 28, pb = 22, pt = 12, pr = 8, n = labels.length;
  const min = opt.min ?? 0, max = opt.max ?? 100;
  const x = i => pl + (n === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (n - 1)), y = v => H - pb - (v - min) / (max - min) * (H - pb - pt);
  let s = `<defs>${series.map((se, k) => `<linearGradient id="lg${k}${host.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${se.color}" stop-opacity=".28"/><stop offset="1" stop-color="${se.color}" stop-opacity="0"/></linearGradient>`).join('')}</defs>`;
  for (let k = 0; k <= 4; k++) { const v = min + (max - min) / 4 * k; s += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pl - 6}" y="${y(v) + 3}" text-anchor="end">${Math.round(v)}</text>`; }
  const ls = Math.ceil(n / 7); // последняя подпись не налезает на предыдущую
  labels.forEach((l, i) => { if ((i % ls === 0 && (n - 1 - i >= ls * .6 || i === n - 1)) || i === n - 1) s += `<text class="axis" x="${x(i)}" y="${H - 6}" text-anchor="middle">${l}</text>`; });
  series.forEach((se, k) => {
    const pts = se.values.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
    if (!pts.length) return;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    if (k === 0 || opt.areaAll) s += `<path d="${d} L${pts.at(-1)[0]} ${H - pb} L${pts[0][0]} ${H - pb} Z" fill="url(#lg${k}${host.id})" style="animation:fade 1s .3s both"/>`;
    s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="animation:draw 1.4s ${k * .2}s var(--ease) forwards"/>`;
    const lp = pts.at(-1); s += `<circle cx="${lp[0]}" cy="${lp[1]}" r="4.5" fill="${se.color}" stroke="var(--card)" stroke-width="2" style="animation:pop2 .5s 1.3s var(--spring) both"/>`;
  });
  s += `<line class="xh" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="var(--muted)" stroke-dasharray="3 3" opacity="0"/>`;
  s += series.map((se, k) => `<circle class="hd${k}" r="5" fill="${se.color}" stroke="var(--card)" stroke-width="2" opacity="0"/>`).join('');
  s += `<rect x="${pl}" y="0" width="${W - pl}" height="${H}" fill="transparent" class="hit"/>`;
  host.innerHTML = `<div class="chart"><style>@keyframes draw{to{stroke-dashoffset:0}}</style><svg viewBox="0 0 ${W} ${H}">${s}</svg></div>`;
  const ch = $('.chart', host), svg = $('svg', ch), tip = tipEl(ch), xh = $('.xh', svg), hit = $('.hit', svg);
  const move = e => {
    const bb = svg.getBoundingClientRect(), k = bb.width / W, px = (e.clientX - bb.left) / k;
    const i = clamp(Math.round((px - pl) / ((W - pl - pr) / Math.max(1, n - 1))), 0, n - 1);
    xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.setAttribute('opacity', 1);
    let html = `<small>${opt.full?.[i] || labels[i]}</small>`, topV = max;
    series.forEach((se, j) => { const v = se.values[i], c = $('.hd' + j, svg); if (v == null) { c.setAttribute('opacity', 0); return; } c.setAttribute('cx', x(i)); c.setAttribute('cy', y(v)); c.setAttribute('opacity', 1); html += `<div>${se.name}: ${Math.round(v)}${opt.unit || ''}</div>`; topV = Math.min(topV, v); });
    tip.innerHTML = html; tip.style.left = x(i) * k + 'px'; tip.style.top = y(Math.max(...series.map(se => se.values[i] ?? min))) * k + 'px'; tip.classList.add('on');
  };
  hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', () => { tip.classList.remove('on'); xh.setAttribute('opacity', 0); $$('[class^=hd]', svg).forEach(c => c.setAttribute('opacity', 0)); });
}

/* ---------- радар навыков ---------- */
function radar(host, axes, prev) {
  const S0 = 260, c = S0 / 2, R = 92, n = axes.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v]; };
  let s = '';
  [.25, .5, .75, 1].forEach(k => s += `<polygon points="${axes.map((_, i) => pt(i, k).join(',')).join(' ')}" fill="none" stroke="var(--line)"/>`);
  axes.forEach((a, i) => { const [x, y] = pt(i, 1), [lx, ly] = pt(i, 1.24); s += `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" stroke="var(--line)"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" style="font-size:11px;font-weight:700;fill:var(--text)">${a.label}</text><text x="${lx}" y="${ly + 13}" text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:var(--muted)">${Math.round(a.value * 100)}%</text>`; });
  if (prev) s += `<polygon points="${prev.map((v, i) => pt(i, v).join(',')).join(' ')}" fill="none" stroke="var(--muted)" stroke-dasharray="4 4" stroke-width="1.5"/>`;
  s += `<polygon points="${axes.map((a, i) => pt(i, a.value).join(',')).join(' ')}" fill="var(--primary)" fill-opacity=".22" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round" style="transform-origin:${c}px ${c}px;animation:pop2 .9s var(--spring) both"/>`;
  axes.forEach((a, i) => { const [x, y] = pt(i, a.value); s += `<circle cx="${x}" cy="${y}" r="4.5" fill="var(--primary)" stroke="var(--card)" stroke-width="2" style="animation:pop2 .5s ${.5 + i * .08}s var(--spring) both"/>`; });
  host.innerHTML = `<div class="chart"><svg viewBox="-20 -6 ${S0 + 40} ${S0 + 12}">${s}</svg></div>`;
}

/* ---------- полукруглый индикатор ---------- */
function gauge(v, color) {
  const r = 46, c = Math.PI * r;
  return `<svg class="gauge" viewBox="0 0 110 64"><path d="M9 58 A46 46 0 0 1 101 58" fill="none" stroke="var(--line)" stroke-width="10" stroke-linecap="round"/>
  <path class="gv" d="M9 58 A46 46 0 0 1 101 58" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - clamp(v))}"/></svg>`;
}
function setGauge(svg, v) { const p = svg.querySelector('.gv'), c = Math.PI * 46; p.style.strokeDashoffset = c * (1 - clamp(v)); }
