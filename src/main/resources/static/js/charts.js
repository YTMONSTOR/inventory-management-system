// Лёгкие SVG-графики без сторонних библиотек — работают и без интернета.
import { esc, num, dateShort, date, money } from './ui.js';

/** Плавная кривая через точки (монотонная кубическая). */
function smoothPath(pts) {
    if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const cx = (x0 + x1) / 2;
        d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    return d;
}

function niceMax(v) {
    if (v <= 0) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * p;
}

/**
 * График прихода и выдачи по дням.
 * data: [{day, received, issued}]
 */
export function flowChart(el, data) {
    const W = Math.max(320, el.clientWidth || 640), H = el.clientHeight || 260;
    const pad = { l: 44, r: 12, t: 12, b: 28 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const rec = data.map(d => Number(d.received)), iss = data.map(d => Number(d.issued));
    const max = niceMax(Math.max(1, ...rec, ...iss));
    const x = i => pad.l + (data.length === 1 ? iw / 2 : (i * iw) / (data.length - 1));
    const y = v => pad.t + ih - (v / max) * ih;
    const pr = rec.map((v, i) => [x(i), y(v)]), pi = iss.map((v, i) => [x(i), y(v)]);
    const base = pad.t + ih;
    const ticks = [0, .25, .5, .75, 1].map(t => t * max);
    const every = Math.ceil(data.length / 7);

    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Приход и выдача по дням">
        <defs>
          <linearGradient id="gradR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--turq)" stop-opacity=".28"/><stop offset="1" stop-color="var(--turq)" stop-opacity="0"/></linearGradient>
          <linearGradient id="gradI" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--lapis)" stop-opacity=".2"/><stop offset="1" stop-color="var(--lapis)" stop-opacity="0"/></linearGradient>
        </defs>
        ${ticks.map(t => `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/>
            <text class="axis" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${num(t, 1)}</text>`).join('')}
        ${data.map((d, i) => i % every === 0 || i === data.length - 1
            ? `<text class="axis" x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(dateShort(d.day))}</text>` : '').join('')}
        <path class="area-r" d="${smoothPath(pr)} L${x(data.length - 1)},${base} L${x(0)},${base} Z"/>
        <path class="area-i" d="${smoothPath(pi)} L${x(data.length - 1)},${base} L${x(0)},${base} Z"/>
        <path class="line-r" d="${smoothPath(pr)}" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.2s var(--ease) forwards"/>
        <path class="line-i" d="${smoothPath(pi)}" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.2s .15s var(--ease) forwards"/>
        <line class="hover-line" x1="0" x2="0" y1="${pad.t}" y2="${base}" visibility="hidden"/>
        <circle class="hp-r" r="4.5" fill="var(--surface)" stroke="var(--turq)" stroke-width="2.5" visibility="hidden"/>
        <circle class="hp-i" r="4.5" fill="var(--surface)" stroke="var(--lapis)" stroke-width="2.5" visibility="hidden"/>
        <rect x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}" fill="transparent" class="hit"/>
      </svg>
      <div class="chart-tip popover" hidden></div>`;

    if (!document.getElementById('chartKeyframes')) {
        const s = document.createElement('style');
        s.id = 'chartKeyframes';
        s.textContent = '@keyframes draw{to{stroke-dashoffset:0}}';
        document.head.appendChild(s);
    }

    const svg = el.querySelector('svg'), tip = el.querySelector('.chart-tip');
    const hl = svg.querySelector('.hover-line'), cr = svg.querySelector('.hp-r'), ci = svg.querySelector('.hp-i');
    const show = (evt) => {
        const rect = svg.getBoundingClientRect();
        const sx = (evt.clientX - rect.left) * (W / rect.width);
        let i = Math.round(((sx - pad.l) / iw) * (data.length - 1));
        i = Math.max(0, Math.min(data.length - 1, i));
        const d = data[i];
        hl.setAttribute('x1', x(i)); hl.setAttribute('x2', x(i));
        cr.setAttribute('cx', x(i)); cr.setAttribute('cy', y(rec[i]));
        ci.setAttribute('cx', x(i)); ci.setAttribute('cy', y(iss[i]));
        [hl, cr, ci].forEach(n => n.setAttribute('visibility', 'visible'));
        tip.hidden = false;
        tip.innerHTML = `<div class="d">${esc(date(d.day))}</div>
            <div class="legend" style="flex-direction:column;gap:4px">
              <span><i style="background:var(--turq)"></i>Приход: <b>${num(d.received)}</b></span>
              <span><i style="background:var(--lapis)"></i>Выдача: <b>${num(d.issued)}</b></span>
              ${Number(d.issuedValue) ? `<span class="muted">на сумму ${esc(money(d.issuedValue))}</span>` : ''}
            </div>`;
        tip.style.left = `${(x(i) / W) * 100}%`;
        tip.style.top = `${(Math.min(y(rec[i]), y(iss[i])) / H) * 100}%`;
    };
    const hide = () => { [hl, cr, ci].forEach(n => n.setAttribute('visibility', 'hidden')); tip.hidden = true; };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerleave', hide);
}

/** Кольцевая диаграмма. segments: [{label, value, color}] */
export function donut(el, segments, centerValue, centerLabel) {
    const total = segments.reduce((s, x) => s + Number(x.value), 0);
    const R = 64, C = 2 * Math.PI * R;
    let offset = 0;
    const arcs = total > 0 ? segments.filter(s => Number(s.value) > 0).map(s => {
        const len = (Number(s.value) / total) * C;
        const gap = segments.length > 1 ? Math.min(3, len / 3) : 0;
        const a = `<circle cx="84" cy="84" r="${R}" stroke="${esc(s.color)}" stroke-width="18" fill="none"
                   stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-offset}"><title>${esc(s.label)}: ${esc(s.title || num(s.value))}</title></circle>`;
        offset += len;
        return a;
    }).join('') : '';
    el.innerHTML = `<svg viewBox="0 0 168 168"><circle cx="84" cy="84" r="${R}" stroke="var(--surface-3)" stroke-width="18" fill="none"/>${arcs}</svg>
        <div class="center"><div class="v">${centerValue}</div><div class="k">${esc(centerLabel)}</div></div>`;
}

/** Горизонтальные полосы. rows: [{label, value, color, title}] */
export function bars(rows) {
    const max = Math.max(1, ...rows.map(r => Number(r.value)));
    return `<div class="bars">${rows.map((r, i) => `
        <div class="bar-row">
          <div class="top"><span class="n"><i class="dot" style="background:${esc(r.color)}"></i><span>${esc(r.label)}</span></span>
            <b class="num">${esc(r.title)}</b></div>
          <div class="track"><i style="width:${(Number(r.value) / max) * 100}%;background:${esc(r.color)};animation-delay:${i * 60}ms"></i></div>
        </div>`).join('')}</div>`;
}

/** Кольцо прогресса выдачи списка. */
export function ring(percent, size = 86) {
    const R = 36, C = 2 * Math.PI * R;
    const p = Math.max(0, Math.min(100, percent));
    return `<div class="ring ${p >= 100 ? 'done' : ''}" style="width:${size}px;height:${size}px">
        <svg viewBox="0 0 86 86"><circle class="track" cx="43" cy="43" r="${R}"/>
        <circle class="val" cx="43" cy="43" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C - (p / 100) * C}"/></svg>
        <div class="lbl">${p}%</div></div>`;
}

/** Лента выдачи: по сегменту на каждую строку списка. */
export function ribbon(items, large = false) {
    if (!items || !items.length) return `<div class="ribbon ${large ? 'lg' : ''}"><i></i></div>`;
    return `<div class="ribbon ${large ? 'lg' : ''}">${items.map(it => {
        const p = Math.min(100, (Number(it.issuedQty) / Number(it.requiredQty)) * 100);
        return `<i class="${p >= 100 ? 'full' : ''}" style="--p:${p}%" title="${esc(it.productName || '')}: ${num(it.issuedQty)} из ${num(it.requiredQty)}"></i>`;
    }).join('')}</div>`;
}
