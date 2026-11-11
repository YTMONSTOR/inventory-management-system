// =====================================================================
//  Каркас приложения: меню, маршруты, поиск, уведомления, профиль, тема
// =====================================================================
import { api } from './api.js';
import {
    icon, hydrateIcons, esc, todayLong, money, num, miniImg, stockPill, listPill, debounce, store,
    setCurrency, toast, empty,
} from './ui.js';
import { state } from './state.js';

import * as dashboard from './pages/dashboard.js';
import * as products from './pages/products.js';
import * as product from './pages/product.js';
import * as categories from './pages/categories.js';
import * as inventory from './pages/inventory.js';
import * as lists from './pages/lists.js';
import * as listEditor from './pages/list-editor.js';
import * as listDetail from './pages/list-detail.js';
import * as issued from './pages/issued.js';
import * as historyPage from './pages/history.js';
import * as reports from './pages/reports.js';
import * as settings from './pages/settings.js';

const NAV = [
    { href: '#/', key: 'dashboard', label: 'Главная', icon: 'home' },
    { group: 'Каталог' },
    { href: '#/products', key: 'products', label: 'Товары', icon: 'box', count: 'products' },
    { href: '#/categories', key: 'categories', label: 'Категории', icon: 'tag' },
    { href: '#/inventory', key: 'inventory', label: 'Склад', icon: 'warehouse', count: 'low', warn: true },
    { group: 'Выдача' },
    { href: '#/lists', key: 'lists', label: 'Списки к выдаче', icon: 'clipboard', count: 'lists' },
    { href: '#/issued', key: 'issued', label: 'Выданные товары', icon: 'truck' },
    { group: 'Учёт' },
    { href: '#/history', key: 'history', label: 'История', icon: 'clock' },
    { href: '#/reports', key: 'reports', label: 'Отчёты', icon: 'chart' },
    { href: '#/settings', key: 'settings', label: 'Настройки', icon: 'settings' },
];

const ROUTES = [
    [/^\/?$/, dashboard, 'dashboard'],
    [/^\/products\/?$/, products, 'products'],
    [/^\/products\/(\d+)$/, product, 'products'],
    [/^\/categories\/?$/, categories, 'categories'],
    [/^\/inventory\/?$/, inventory, 'inventory'],
    [/^\/lists\/?$/, lists, 'lists'],
    [/^\/lists\/new$/, listEditor, 'lists'],
    [/^\/lists\/(\d+)\/edit$/, listEditor, 'lists'],
    [/^\/lists\/(\d+)\/(issue|print)$/, listDetail, 'lists'],
    [/^\/lists\/(\d+)$/, listDetail, 'lists'],
    [/^\/issued\/?$/, issued, 'issued'],
    [/^\/history\/?$/, historyPage, 'history'],
    [/^\/reports\/?$/, reports, 'reports'],
    [/^\/settings\/?$/, settings, 'settings'],
];

const appEl = document.getElementById('app');
const pageEl = document.getElementById('page');
let cleanup = null;
let currentHash = location.hash;
let renderSeq = 0;

// ------------------------------------------------------------------ меню

function renderNav(activeKey) {
    const c = state.counts;
    document.getElementById('nav').innerHTML = NAV.map(n => {
        if (n.group) return `<div class="nav-group">${esc(n.group)}</div>`;
        const v = n.count ? c[n.count] : 0;
        return `<a class="nav-item ${n.key === activeKey ? 'active' : ''}" href="${n.href}">
            ${icon(n.icon)}<span class="nav-label">${esc(n.label)}</span>
            ${v ? `<span class="nav-count ${n.warn ? 'warn' : ''}">${v}</span>` : ''}</a>`;
    }).join('');
}

export async function refreshCounts() {
    try {
        const d = await api.get('/api/dashboard');
        state.counts = {
            products: d.kpi.totalProducts,
            low: d.kpi.lowCount + d.kpi.outCount,
            lists: d.kpi.openLists,
        };
        renderNav(state.activeKey);
    } catch { /* меню без счётчиков */ }
    loadNotifications();
}
state.refreshCounts = refreshCounts;

// ------------------------------------------------------------------ маршрутизация

function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    return { path, query: new URLSearchParams(qs || '') };
}

async function route() {
    if (state.guard && location.hash !== currentHash) {
        const ok = await state.guard();
        if (!ok) { history.replaceState(null, '', currentHash || '#/'); return; }
    }
    state.guard = null;
    currentHash = location.hash;
    const { path, query } = parseHash();
    let match = null;
    for (const [re, mod, key] of ROUTES) {
        const m = path.match(re);
        if (m) { match = { mod, key, params: m.slice(1) }; break; }
    }
    appEl.classList.remove('menu-open');
    closePopovers();
    if (cleanup) { try { cleanup(); } catch { /* ничего */ } cleanup = null; }
    const seq = ++renderSeq;
    if (!match) {
        pageEl.innerHTML = empty({ art: 'search', title: 'Страница не найдена', text: 'Возможно, ссылка устарела.', action: '<a class="btn primary" href="#/">На главную</a>' });
        return;
    }
    state.activeKey = match.key;
    renderNav(match.key);
    pageEl.classList.remove('page-enter');
    void pageEl.offsetWidth;
    pageEl.classList.add('page-enter');
    window.scrollTo(0, 0);
    try {
        const res = await match.mod.render({ el: pageEl, params: match.params, query, isCurrent: () => seq === renderSeq });
        if (seq === renderSeq) cleanup = typeof res === 'function' ? res : null;
        else if (typeof res === 'function') res();
        hydrateIcons(pageEl);
    } catch (e) {
        console.error(e);
        if (seq !== renderSeq) return;
        pageEl.innerHTML = empty({ art: 'search', title: e.status === 404 ? 'Запись не найдена' : 'Не удалось загрузить страницу',
            text: esc(e.message || ''), action: '<button class="btn primary" onclick="location.reload()">Обновить</button>' });
    }
}

export function navigate(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
}
state.navigate = navigate;
state.rerender = () => route();

window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', e => {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
});

// ------------------------------------------------------------------ тема

function applyTheme(t) {
    store.set('theme', t);
    try { localStorage.setItem('sklad.theme', t); } catch { /* недоступно */ }
    const real = t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
    document.documentElement.dataset.theme = real;
    const lbl = document.getElementById('themeLabel');
    if (lbl) {
        lbl.textContent = real === 'dark' ? 'Светлая тема' : 'Тёмная тема';
        lbl.previousElementSibling.innerHTML = `<svg viewBox="0 0 24 24">${real === 'dark'
            ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
            : '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'}</svg>`;
    }
}
state.applyTheme = applyTheme;
function currentTheme() {
    try { return localStorage.getItem('sklad.theme') || 'light'; } catch { return 'light'; }
}

// ------------------------------------------------------------------ всплывающие панели

function closePopovers(except) {
    ['notifPanel', 'profilePanel', 'globalSearchResults'].forEach(id => {
        if (id !== except) document.getElementById(id).hidden = true;
    });
}

document.addEventListener('mousedown', e => {
    if (!e.target.closest('.pop-anchor') && !e.target.closest('#globalSearch')) closePopovers();
});

document.addEventListener('click', e => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    switch (a.dataset.action) {
        case 'open-menu': appEl.classList.add('menu-open'); break;
        case 'close-menu': appEl.classList.remove('menu-open'); break;
        case 'toggle-theme': applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); break;
        case 'toggle-notifications': {
            const p = document.getElementById('notifPanel');
            closePopovers('notifPanel');
            p.hidden = !p.hidden;
            if (!p.hidden) loadNotifications();
            break;
        }
        case 'toggle-profile': {
            const p = document.getElementById('profilePanel');
            closePopovers('profilePanel');
            p.hidden = !p.hidden;
            break;
        }
        default: return;
    }
});

// ------------------------------------------------------------------ уведомления

async function loadNotifications() {
    try {
        const list = await api.get('/api/notifications');
        const badge = document.getElementById('notifCount');
        badge.hidden = list.length === 0;
        badge.textContent = list.length > 99 ? '99+' : list.length;
        document.getElementById('notifPanel').innerHTML = `
            <div class="head"><b class="grow">Уведомления</b><span class="muted small">${list.length ? list.length : ''}</span></div>
            ${list.length ? list.map(n => `
                <a class="notif-item" href="${esc(n.link)}">
                    <span class="feed-icon tone-${n.level === 'danger' ? 'red' : 'amber'}">${icon(n.kind === 'list' ? 'clipboard' : 'alert')}</span>
                    <div class="grow"><div class="feed-title">${esc(n.title)}</div><div class="feed-details">${esc(n.text)}</div></div>
                </a>`).join('')
                : empty({ art: 'ok', title: 'Всё в порядке', text: 'Товары в достатке, списки можно выдавать.', compact: true })}`;
    } catch { /* без уведомлений */ }
}

// ------------------------------------------------------------------ глобальный поиск

const searchInput = document.getElementById('globalSearchInput');
const searchBox = document.getElementById('globalSearchResults');
let searchKb = -1;

const doSearch = debounce(async () => {
    const q = searchInput.value.trim();
    if (q.length < 1) { searchBox.hidden = true; return; }
    try {
        const r = await api.get('/api/search?q=' + encodeURIComponent(q));
        if (searchInput.value.trim() !== q) return;
        searchKb = -1;
        searchBox.hidden = false;
        if (!r.products.length && !r.lists.length) {
            searchBox.innerHTML = empty({ art: 'search', title: 'Ничего не найдено', text: `По запросу «${esc(q)}» нет товаров и списков.`, compact: true });
            return;
        }
        searchBox.innerHTML = `
            ${r.products.length ? `<div class="grp">Товары</div>${r.products.map(p => `
                <a class="pick" href="#/products/${p.id}">${miniImg(p.imageUrl, p.name, '', p.categoryColor)}
                  <div class="grow"><div class="name ellipsis">${esc(p.name)}</div>
                  <div class="sub">${esc(p.sku)} · ${num(p.quantity)} ${esc(p.unit)} · ${money(p.purchasePrice)}</div></div>
                  ${stockPill(p.status)}</a>`).join('')}` : ''}
            ${r.lists.length ? `<div class="grp">Списки</div>${r.lists.map(l => `
                <a class="pick" href="#/lists/${l.id}"><span class="mini-img" style="display:grid;place-items:center;color:var(--turq)">${icon('clipboard')}</span>
                  <div class="grow"><div class="name ellipsis">${esc(l.name)}</div><div class="sub">${l.itemCount} поз. · ${money(l.amountTotal)}</div></div>
                  ${listPill(l.status)}</a>`).join('')}` : ''}`;
    } catch (e) { /* поиск не критичен */ }
}, 160);

searchInput.addEventListener('input', doSearch);
searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) doSearch(); });
searchInput.addEventListener('keydown', e => {
    const items = [...searchBox.querySelectorAll('a.pick')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        searchKb = e.key === 'ArrowDown' ? (searchKb + 1) % items.length : (searchKb - 1 + items.length) % items.length;
        items.forEach((x, i) => x.classList.toggle('kb', i === searchKb));
        items[searchKb].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        const target = items[searchKb] || items[0];
        if (target) { location.hash = target.getAttribute('href'); searchBox.hidden = true; searchInput.blur(); }
    } else if (e.key === 'Escape') {
        searchBox.hidden = true; searchInput.blur();
    }
});
searchBox.addEventListener('click', e => {
    if (e.target.closest('a')) { searchBox.hidden = true; searchInput.value = ''; }
});
document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.target.closest('input, textarea, [contenteditable]')) {
        e.preventDefault();
        searchInput.focus();
    }
});

// ------------------------------------------------------------------ профиль

export async function loadProfile() {
    try {
        const [p, s] = await Promise.all([api.get('/api/profile'), api.get('/api/settings')]);
        state.profile = p;
        state.settings = s;
        setCurrency(s.currency);
        document.getElementById('brandName').textContent = s.company_name || 'Мой склад';
        document.title = (s.company_name || 'Склад') + ' — учёт товаров';
        const initials = (p.fullName || 'А').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
        document.getElementById('avatar').textContent = initials;
        document.getElementById('profileName').textContent = p.fullName;
        document.getElementById('profilePanel').innerHTML = `
            <div class="who"><span class="avatar">${esc(initials)}</span>
              <div class="grow" style="min-width:0"><div class="strong ellipsis">${esc(p.fullName)}</div>
              <div class="small muted ellipsis">${esc(p.position || '')}</div></div></div>
            <a class="menu-item" href="#/settings">${icon('user')}Профиль и настройки</a>
            <button class="menu-item" type="button" data-action="toggle-theme">${icon('moon')}Сменить тему</button>
            <a class="menu-item" href="#/reports">${icon('chart')}Отчёты</a>`;
    } catch (e) {
        toast(e.message, 'err');
    }
}
state.loadProfile = loadProfile;

// ------------------------------------------------------------------ запуск

document.getElementById('today').textContent = todayLong();
hydrateIcons(document);
applyTheme(currentTheme());
loadProfile().then(() => { route(); refreshCounts(); });
setInterval(() => { document.getElementById('today').textContent = todayLong(); }, 60000);
setInterval(loadNotifications, 120000);
