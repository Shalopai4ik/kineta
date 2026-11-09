/* =====================================================================
   Бионическая рука (SVG). Псевдо-3D: каждая фаланга проецируется на экран
   с учётом сгиба (cos — длина на экране, sin — глубина). Сгиб > 90°
   «заворачивает» палец на ладонь.
   Слои: разогнутые фаланги → ладонь → согнутые фаланги и большой палец.
   Так основания пальцев уходят под ладонь и рука выглядит цельной.
   Поза: [большой, указ., средний, безым., мизинец, оппозиция большого], 0..100.
   ===================================================================== */
const HAND = {
  fingers: [ // x, y основания (внутри ладони), угол (° от вертикали), длины фаланг, толщина
    { x: 66, y: 126, a: -9, L: [44, 25, 20], w: 19 },
    { x: 89, y: 120, a: -2, L: [47, 27, 21], w: 20 },
    { x: 112, y: 122, a: 5, L: [44, 25, 20], w: 19 },
    { x: 133, y: 131, a: 13, L: [35, 20, 17], w: 17 }
  ],
  thumb: { x: 64, y: 186, L: [32, 24, 19], w: 21 },
  joints: [80, 100, 70]
};
const D2R = Math.PI / 180;

function handGeom(pose) {
  const out = [];
  HAND.fingers.forEach((F, k) => {
    const f = clamp((pose[k + 1] || 0) / 100), dx = Math.sin(F.a * D2R), dy = -Math.cos(F.a * D2R);
    let x = F.x, y = F.y, phi = 0; const segs = [];
    for (let j = 0; j < 3; j++) {
      phi += f * HAND.joints[j] * D2R;
      const l = F.L[j] * Math.cos(phi), nx = x + dx * l, ny = y + dy * l;
      segs.push({ x1: x, y1: y, x2: nx, y2: ny, w: F.w * [1, .92, .85][j] * (1 + .1 * Math.sin(phi)), back: Math.cos(phi) < .05 && j > 0 });
      x = nx; y = ny;
    }
    out.push({ idx: k + 1, segs, tip: { x, y } });
  });
  const T = HAND.thumb, f = clamp((pose[0] || 0) / 100), opp = clamp((pose[5] || 0) / 100);
  let ang = (-60 + opp * 40) * D2R, x = T.x, y = T.y, z = 0; const segs = [];
  for (let j = 0; j < 3; j++) {
    ang += (j ? f * [0, 48, 38][j] : f * 22) * D2R;
    z += f * 30 * D2R;
    const l = T.L[j] * (1 - .25 * Math.sin(z)), nx = x + Math.sin(ang) * l, ny = y - Math.cos(ang) * l;
    segs.push({ x1: x, y1: y, x2: nx, y2: ny, w: T.w * [1, .9, .82][j], back: true });
    x = nx; y = ny;
  }
  out.push({ idx: 0, segs, tip: { x, y } });
  return out;
}

const ln = (g, stroke, w, extra = '') => `<line x1="${g.x1.toFixed(1)}" y1="${g.y1.toFixed(1)}" x2="${g.x2.toFixed(1)}" y2="${g.y2.toFixed(1)}" stroke="${stroke}" stroke-width="${w.toFixed(1)}" stroke-linecap="round"${extra}/>`;
/* layer: 'under' — разогнутые фаланги (под ладонью), 'over' — согнутые и большой палец */
function fingerSVG(fg, sel, mini, layer) {
  const segs = fg.segs.filter(g => layer === 'under' ? !g.back : g.back);
  let s = `<g class="fg" data-f="${fg.idx}">`;
  if (sel && layer === 'over') fg.segs.forEach(g => s += ln(g, 'var(--primary)', g.w + 10, ' stroke-opacity=".3"'));
  segs.forEach(g => s += ln(g, 'var(--hand-edge)', g.w + 2.5));
  segs.forEach(g => s += ln(g, g.back && fg.idx ? 'url(#hgB)' : 'url(#hgA)', g.w));
  if (!mini) segs.forEach((g, j) => { if (g !== fg.segs[0]) s += `<circle cx="${g.x1.toFixed(1)}" cy="${g.y1.toFixed(1)}" r="${(g.w * .5 - 1).toFixed(1)}" fill="none" stroke="var(--hand-edge)" stroke-opacity=".55" stroke-width="1.2"/>`; });
  if (layer === 'over') fg.segs.forEach(g => s += ln(g, 'transparent', g.w + 14)); // увеличенная зона нажатия
  return s + '</g>';
}

const HAND_DEFS = id => `<defs>
  <linearGradient id="hgA${id}" x1="0" x2="1"><stop offset="0" stop-color="var(--hand-skin)"/><stop offset="1" stop-color="var(--hand-shade)"/></linearGradient>
  <linearGradient id="hgB${id}" x1="0" x2="1"><stop offset="0" stop-color="var(--hand-shade)"/><stop offset="1" stop-color="var(--hand-edge)"/></linearGradient>
  <linearGradient id="palm${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--hand-skin)"/><stop offset="1" stop-color="var(--hand-shade)"/></linearGradient>
</defs>`;
const CUFF = () => `<rect x="66" y="208" width="68" height="56" rx="16" fill="var(--hand-cuff)" stroke="var(--hand-edge)" stroke-width="2"/>`;
const PALM = id => `<path d="M56 124 Q100 106 148 124 Q154 160 150 190 Q144 218 100 220 Q56 218 50 190 Q46 158 56 124 Z" fill="url(#palm${id})" stroke="var(--hand-edge)" stroke-width="2"/>`;
const ORDER = [3, 2, 1, 0, 4];
const fixIds = (s, id) => s.replace(/url\(#hg([AB])\)/g, `url(#hg$1${id})`);

let handSeq = 0;
/* Статичная миниатюра для карточек */
function handSVG(pose, cls = '') {
  const id = 'm' + (handSeq++), geo = handGeom(pose);
  const under = fixIds(ORDER.map(i => fingerSVG(geo[i], false, true, 'under')).join(''), id);
  const over = fixIds(ORDER.map(i => fingerSVG(geo[i], false, true, 'over')).join(''), id);
  return `<svg class="${cls}" viewBox="-14 -6 184 272" xmlns="http://www.w3.org/2000/svg">${HAND_DEFS(id)}${CUFF()}${under}${PALM(id)}${over}</svg>`;
}

/* Живая рука: обновляется каждый кадр, поддерживает выбор пальца */
class HandView {
  constructor(el, opt = {}) {
    this.id = 'h' + (handSeq++); this.opt = opt; this.sel = opt.sel ?? -1; this.last = '';
    el.innerHTML = `<svg class="hand ${opt.cls || ''}" viewBox="${opt.vb || '-14 -6 184 272'}" xmlns="http://www.w3.org/2000/svg">${HAND_DEFS(this.id)}${CUFF()}<g class="fu"></g>${PALM(this.id)}<g class="fo"></g></svg>`;
    this.svg = el.querySelector('svg'); this.gu = this.svg.querySelector('.fu'); this.go = this.svg.querySelector('.fo');
    if (opt.onSelect) this.svg.addEventListener('pointerdown', e => {
      const f = e.target.closest('.fg'); if (f) { this.sel = +f.dataset.f; opt.onSelect(this.sel, e); this.last = ''; }
    });
  }
  set(pose) {
    const key = pose.map(v => v.toFixed(1)).join(',') + this.sel;
    if (key === this.last) return; this.last = key;
    const geo = handGeom(pose);
    this.gu.innerHTML = fixIds(ORDER.map(i => fingerSVG(geo[i], geo[i].idx === this.sel, false, 'under')).join(''), this.id);
    this.go.innerHTML = fixIds(ORDER.map(i => fingerSVG(geo[i], geo[i].idx === this.sel, false, 'over')).join(''), this.id);
  }
}
