// =====================================================================
//  Общие элементы интерфейса: иконки, форматирование, окна, уведомления
// =====================================================================

const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    warehouse: '<path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-8h10v8"/><path d="M7 17h10"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h3"/>',
    truck: '<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-right': '<path d="m9 6 6 6-6 6"/>',
    'chevron-left': '<path d="m15 6-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    'arrow-in': '<path d="M12 4v12"/><path d="m6 10 6 6 6-6"/><path d="M4 20h16"/>',
    'arrow-out': '<path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/>',
    scale: '<path d="M12 3v18M5 7h14"/><path d="m5 7-3 7a4 4 0 0 0 6 0z"/><path d="m19 7-3 7a4 4 0 0 0 6 0z"/><path d="M8 21h8"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
    sheet: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h8M12 13v4"/>',
    pdf: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 15h6M9 18h4"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    rows: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    sort: '<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v14H5a2 2 0 0 1-2-2V5"/><path d="M16 14h.01"/>',
    layers: '<path d="m12 2 10 6-10 6L2 8z"/><path d="m2 16 10 6 10-6"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    barcode: '<path d="M3 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14"/>',
    'package-plus': '<path d="M16 16h6M19 13v6"/><path d="M21 10V8l-9-5-9 5v8l9 5 2-1.1"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
    'list-plus': '<path d="M11 12H3M16 6H3M16 18H3M18 9v6M21 12h-6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    note: '<path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4"/><path d="M8 9h8M8 13h5"/>',
    sparkle: '<path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.5l-1.8-5L5 9.7l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/><path d="M5 16l.6 1.4L7 18l-1.4.6L5 20l-.6-1.4L3 18l1.4-.6z"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
};

export function icon(name, cls = '') {
    return `<span class="icon ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24">${P[name] || P.box}</svg></span>`;
}

/** Заменяет <span data-icon="..."> внутри узла настоящими SVG. */
export function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => {
        const n = el.dataset.icon;
        el.innerHTML = `<svg viewBox="0 0 24 24">${P[n] || ''}</svg>`;
        el.removeAttribute('data-icon');
    });
}

// ------------------------------------------------------------------ форматирование

const ru = 'ru-RU';
let currency = 'UZS';
export function setCurrency(c) { currency = c || 'UZS'; }
export function getCurrency() { return currency; }

export function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function num(v, max = 3) {
    const n = Number(v ?? 0);
    return n.toLocaleString(ru, { maximumFractionDigits: max }).replace(/ /g, ' ');
}

export function money(v, withCur = true) {
    const n = Number(v ?? 0);
    const s = n.toLocaleString(ru, { maximumFractionDigits: n % 1 === 0 ? 0 : 2, minimumFractionDigits: 0 }).replace(/ /g, ' ');
    return withCur ? `${s} ${currency}` : s;
}

/** Краткая запись больших сумм: 12,4 млн */
export function moneyShort(v) {
    const n = Number(v ?? 0);
    const a = Math.abs(n);
    if (a >= 1e9) return `${num(n / 1e9, 1)} млрд`;
    if (a >= 1e6) return `${num(n / 1e6, 1)} млн`;
    if (a >= 1e4) return `${num(n / 1e3, 0)} тыс`;
    return num(n, 2);
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function parseDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    // сервер отдаёт местное время без часового пояса: 2026-11-08T14:05:00
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return new Date(v);
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}

export function date(v) {
    const d = parseDate(v);
    if (!d) return '—';
    const now = new Date();
    return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}

export function dateShort(v) {
    const d = parseDate(v);
    return d ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` : '';
}

export function time(v) {
    const d = parseDate(v);
    return d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
}

export function dateTime(v) {
    const d = parseDate(v);
    if (!d) return '—';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    const diff = Math.round((today - day) / 86400000);
    if (diff === 0) return `сегодня, ${time(d)}`;
    if (diff === 1) return `вчера, ${time(d)}`;
    return `${date(d)}, ${time(d)}`;
}

export function dayTitle(v) {
    const d = parseDate(v);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    const diff = Math.round((today - day) / 86400000);
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    return date(d);
}

export function todayLong() {
    const d = new Date();
    const wd = d.toLocaleDateString(ru, { weekday: 'long' });
    return `${wd[0].toUpperCase()}${wd.slice(1)}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
}

/** «12,5» → 12.5; пустая строка → null; ошибка → NaN */
export function parseNum(s) {
    if (s === null || s === undefined) return null;
    const t = String(s).replace(/\s/g, '').replace(',', '.');
    if (t === '') return null;
    if (!/^-?\d*\.?\d*$/.test(t)) return NaN;
    return Number(t);
}

export const STOCK_TITLES = { AVAILABLE: 'В наличии', LOW: 'Заканчивается', OUT: 'Нет в наличии' };
export const LIST_TITLES = { DRAFT: 'Черновик', PENDING: 'Ожидает выдачи', PARTIAL: 'Выдан частично', COMPLETED: 'Выдан полностью', CANCELLED: 'Отменён' };

export function stockPill(status) {
    return `<span class="pill ${status}">${STOCK_TITLES[status] || ''}</span>`;
}
export function listPill(status) {
    return `<span class="pill ${status}">${LIST_TITLES[status] || status}</span>`;
}

// ------------------------------------------------------------------ фото и заглушки

function hashColor(s) {
    const colors = ['#2343B8', '#0F9E99', '#6A4BD1', '#C2410C', '#0E7490', '#B45309', '#15803D', '#BE185D'];
    let h = 0;
    for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return colors[h % colors.length];
}

/** Восьмиконечная звезда (гирих) — узор для заглушек фото. */
export const GIRIH = `<svg class="pattern" viewBox="0 0 80 80" preserveAspectRatio="xMidYMid slice"><defs><pattern id="gp" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M20 4l4.6 11 11.4-4.6L31.4 22 36 33.4 24.6 28.8 20 40l-4.6-11.2L4 33.4 8.6 22 4 10.4l11.4 4.6z" fill="none" stroke="currentColor" stroke-width="1.2"/></pattern></defs><rect width="80" height="80" fill="url(#gp)"/></svg>`;

export function noImage(name, color) {
    const c = color || hashColor(name);
    const letter = (String(name || '?').trim()[0] || '?').toUpperCase();
    return `<div class="noimg" style="--c:${esc(c)}">${GIRIH}<span class="letter">${esc(letter)}</span></div>`;
}

export function productImage(p, alt) {
    if (p.imageUrl) return `<img src="${esc(p.imageUrl)}" alt="${esc(alt || p.name || p.productName || '')}" loading="lazy">`;
    return noImage(p.name || p.productName, p.categoryColor);
}

export function miniImg(url, name, size = '', color) {
    return `<span class="mini-img ${size}">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : noImage(name, color)}</span>`;
}

// ------------------------------------------------------------------ уведомления (тосты)

export function toast(message, type = 'ok') {
    const root = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icon(type === 'err' ? 'alert' : 'check-circle')}<div>${esc(message)}</div>`;
    root.appendChild(el);
    const ttl = type === 'err' ? 6500 : 3200;
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, ttl);
    el.addEventListener('click', () => el.remove());
}

// ------------------------------------------------------------------ модальные окна

const stack = [];

/**
 * Открывает окно. body — строка HTML; onMount(el, close) — подключение обработчиков.
 * Возвращает функцию закрытия.
 */
export function modal({ title, sub = '', body, foot = '', wide = false, onMount, onClose }) {
    const root = document.getElementById('modalRoot');
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `
        <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
            <div class="modal-head">
                <div class="grow"><h2>${esc(title)}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
                <button class="icon-btn sm" type="button" data-close aria-label="Закрыть">${icon('x')}</button>
            </div>
            <div class="modal-body">${body}</div>
            ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
        </div>`;
    root.appendChild(back);
    const prevFocus = document.activeElement;
    let closed = false;
    const close = (result) => {
        if (closed) return;
        closed = true;
        stack.splice(stack.indexOf(close), 1);
        back.classList.add('closing');
        setTimeout(() => back.remove(), 180);
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        onClose && onClose(result);
    };
    stack.push(close);
    back.addEventListener('mousedown', e => { if (e.target === back) close(); });
    back.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => close()));
    onMount && onMount(back.querySelector('.modal'), close);
    const first = back.querySelector('[autofocus], .modal-body input:not([type=hidden]):not([type=file]), .modal-body textarea, .modal-foot .btn.primary');
    setTimeout(() => first && first.focus(), 60);
    return close;
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && stack.length) { e.preventDefault(); stack[stack.length - 1](); }
});

/** Подтверждение действия. Возвращает Promise<boolean>. */
export function confirmDialog({ title, text, ok = 'Подтвердить', danger = false, iconName }) {
    return new Promise(resolve => {
        let result = false;
        modal({
            title,
            body: `<div class="row" style="align-items:flex-start;gap:16px">
                     <span class="confirm-icon ${danger ? 'tone-red' : 'tone-lapis'}">${icon(iconName || (danger ? 'alert' : 'info'), 'lg')}</span>
                     <div style="padding-top:4px;color:var(--ink-2)">${text}</div></div>`,
            foot: `<button class="btn" type="button" data-close>Отмена</button>
                   <button class="btn ${danger ? 'danger' : 'primary'}" type="button" data-ok>${esc(ok)}</button>`,
            onMount: (el, close) => el.querySelector('[data-ok]').addEventListener('click', () => { result = true; close(); }),
            onClose: () => resolve(result),
        });
    });
}

/** Ставит кнопку в состояние загрузки на время выполнения промиса. */
export async function busy(btn, fn) {
    if (!btn) return fn();
    btn.classList.add('loading');
    btn.disabled = true;
    try { return await fn(); } finally { btn.classList.remove('loading'); btn.disabled = false; }
}

// ------------------------------------------------------------------ собственный выпадающий список

/**
 * Создаёт выпадающий список в контейнере.
 * options: [{value, label, color?}]; onChange(value)
 */
export function dropdown(container, { options, value, placeholder = 'Выберите', onChange, small = false, name }) {
    let current = value;
    container.classList.add('dd');
    const render = () => {
        const sel = options.find(o => String(o.value) === String(current));
        container.innerHTML = `
            <button type="button" class="dd-btn ${small ? 'sm' : ''}" aria-haspopup="listbox" ${name ? `data-name="${esc(name)}"` : ''}>
                ${sel?.color ? `<span class="dot" style="background:${esc(sel.color)}"></span>` : ''}
                <span class="ellipsis ${sel ? '' : 'placeholder'}">${esc(sel ? sel.label : placeholder)}</span>
                ${icon('chevron-down', 'sm chev')}
            </button>`;
        container.querySelector('.dd-btn').addEventListener('click', toggle);
        container.querySelector('.dd-btn').addEventListener('keydown', e => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    };
    let menu = null;
    const outside = e => { if (!container.contains(e.target)) closeMenu(); };
    function open() {
        if (menu) return;
        container.classList.add('open');
        menu = document.createElement('div');
        menu.className = 'dd-menu popover';
        menu.setAttribute('role', 'listbox');
        menu.innerHTML = options.map((o, i) => `
            <button type="button" class="dd-opt ${String(o.value) === String(current) ? 'sel' : ''}" data-i="${i}" role="option">
                ${o.color ? `<span class="dot" style="background:${esc(o.color)}"></span>` : ''}${esc(o.label)}
            </button>`).join('');
        container.appendChild(menu);
        const r = menu.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 10 && r.top > r.height + 80) menu.classList.add('up');
        menu.addEventListener('click', e => {
            const b = e.target.closest('.dd-opt');
            if (!b) return;
            select(options[+b.dataset.i].value);
        });
        let kb = Math.max(0, options.findIndex(o => String(o.value) === String(current)));
        const btns = [...menu.querySelectorAll('.dd-opt')];
        const mark = () => { btns.forEach((b, i) => b.classList.toggle('kb', i === kb)); btns[kb]?.scrollIntoView({ block: 'nearest' }); };
        mark();
        menu.addEventListener('keydown', e => e.stopPropagation());
        container._kb = e => {
            if (e.key === 'ArrowDown') { kb = Math.min(btns.length - 1, kb + 1); mark(); e.preventDefault(); }
            else if (e.key === 'ArrowUp') { kb = Math.max(0, kb - 1); mark(); e.preventDefault(); }
            else if (e.key === 'Enter') { e.preventDefault(); select(options[kb].value); }
            else if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeMenu(); }
        };
        container.addEventListener('keydown', container._kb, true);
        setTimeout(() => document.addEventListener('mousedown', outside), 0);
    }
    function closeMenu() {
        if (!menu) return;
        menu.remove(); menu = null;
        container.classList.remove('open');
        container.removeEventListener('keydown', container._kb, true);
        document.removeEventListener('mousedown', outside);
    }
    function toggle() { menu ? closeMenu() : open(); }
    function select(v) {
        current = v;
        closeMenu();
        render();
        container.querySelector('.dd-btn').focus();
        onChange && onChange(v);
    }
    render();
    return {
        get value() { return current; },
        set(v) { current = v; render(); },
        setOptions(o) { options = o; render(); },
    };
}

// ------------------------------------------------------------------ пустые состояния и скелетоны

const ART = {
    box: `<svg class="empty-art" viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="56" fill="var(--lapis-soft)"/><path d="M60 30 88 45v30L60 90 32 75V45z" fill="var(--surface)" stroke="var(--lapis)" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 45l28 15 28-15M60 60v30" stroke="var(--lapis)" stroke-width="2.5" stroke-linejoin="round"/><path d="M46 37.5 74 52.5" stroke="var(--turq)" stroke-width="2.5"/></svg>`,
    list: `<svg class="empty-art" viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="56" fill="var(--turq-soft)"/><rect x="36" y="28" width="48" height="64" rx="7" fill="var(--surface)" stroke="var(--turq)" stroke-width="2.5"/><path d="M48 46h24M48 58h24M48 70h14" stroke="var(--turq)" stroke-width="2.5" stroke-linecap="round"/><rect x="50" y="23" width="20" height="10" rx="4" fill="var(--surface)" stroke="var(--turq)" stroke-width="2.5"/></svg>`,
    search: `<svg class="empty-art" viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="56" fill="var(--surface-3)"/><circle cx="55" cy="55" r="20" fill="var(--surface)" stroke="var(--muted)" stroke-width="2.5"/><path d="m70 70 14 14" stroke="var(--muted)" stroke-width="3" stroke-linecap="round"/></svg>`,
    clock: `<svg class="empty-art" viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="56" fill="var(--lapis-soft)"/><circle cx="60" cy="60" r="26" fill="var(--surface)" stroke="var(--lapis)" stroke-width="2.5"/><path d="M60 46v14l9 6" stroke="var(--lapis)" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    ok: `<svg class="empty-art" viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="56" fill="var(--green-soft)"/><circle cx="60" cy="60" r="26" fill="var(--surface)" stroke="var(--green)" stroke-width="2.5"/><path d="m49 60 8 8 15-16" stroke="var(--green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

export function empty({ art = 'box', title, text = '', action = '', compact = false }) {
    return `<div class="empty ${compact ? 'compact' : ''}">${ART[art] || ART.box}<h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${action}</div>`;
}

export function skeletonCards(n = 8) {
    return `<div class="product-grid">${Array.from({ length: n }, () => `
        <div class="pcard"><div class="pcard-media sk" style="border-radius:0"></div>
        <div class="pcard-body"><div class="sk sk-line" style="width:80%"></div><div class="sk sk-line" style="width:45%"></div>
        <div class="sk sk-line" style="width:60%;height:20px;margin-top:14px"></div></div></div>`).join('')}</div>`;
}

export function skeletonPage() {
    return `<div class="page-head"><div><div class="sk" style="width:260px;height:32px"></div><div class="sk sk-line" style="width:340px;margin-top:12px"></div></div></div>
        <div class="kpis">${'<div class="kpi"><div class="sk sk-line" style="width:50%"></div><div class="sk" style="width:70%;height:30px;margin-top:8px"></div><div class="sk sk-line" style="width:40%;margin-top:auto"></div></div>'.repeat(4)}</div>
        <div class="grid dash"><div class="card pad"><div class="sk" style="height:260px"></div></div><div class="card pad"><div class="sk" style="height:260px"></div></div></div>`;
}

export function skeletonTable(rows = 6) {
    return `<div class="card"><div style="padding:18px 22px">${Array.from({ length: rows }, () => `
        <div class="row" style="padding:10px 0"><div class="sk" style="width:44px;height:44px"></div>
        <div class="grow"><div class="sk sk-line" style="width:40%"></div><div class="sk sk-line" style="width:22%"></div></div>
        <div class="sk sk-line" style="width:90px"></div></div>`).join('')}</div></div>`;
}

export function debounce(fn, ms = 200) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Безопасная работа с localStorage. */
export const store = {
    get(k, def) { try { const v = localStorage.getItem('sklad.' + k); return v === null ? def : JSON.parse(v); } catch { return def; } },
    set(k, v) { try { localStorage.setItem('sklad.' + k, JSON.stringify(v)); } catch { /* недоступно */ } },
};

export function rememberViewed(id) {
    const list = store.get('recent', []).filter(x => x !== id);
    list.unshift(id);
    store.set('recent', list.slice(0, 10));
}
