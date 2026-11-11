import { api } from '../api.js';
import { icon, esc, time, dayTitle, empty, skeletonTable, debounce } from '../ui.js';

const KIND = {
    PRODUCT_CREATED: ['package-plus', 'green'], PRODUCT_UPDATED: ['edit', 'lapis'], PRODUCT_DELETED: ['trash', 'red'],
    PRODUCT_PHOTO: ['image', 'lapis'], STOCK_RECEIVED: ['arrow-in', 'turq'], STOCK_ISSUED: ['arrow-out', 'lapis'],
    STOCK_ADJUSTED: ['scale', 'amber'], LIST_CREATED: ['list-plus', 'turq'], LIST_UPDATED: ['clipboard', 'lapis'],
    LIST_ISSUED: ['truck', 'lapis'], LIST_COMPLETED: ['check-circle', 'green'], LIST_CANCELLED: ['ban', 'red'],
    LIST_DELETED: ['trash', 'red'], CATEGORY_CREATED: ['tag', 'green'], CATEGORY_UPDATED: ['tag', 'lapis'],
    CATEGORY_DELETED: ['tag', 'red'], SETTINGS_UPDATED: ['settings', 'lapis'],
};

export function activityIcon(action) {
    const [ic, tone] = KIND[action] || ['info', 'lapis'];
    return `<span class="feed-icon tone-${tone}">${icon(ic)}</span>`;
}

function link(a) {
    if (!a.entityId) return '';
    if (a.entityType === 'PRODUCT' && a.action !== 'PRODUCT_DELETED') return `#/products/${a.entityId}`;
    if (a.entityType === 'LIST' && a.action !== 'LIST_DELETED') return `#/lists/${a.entityId}`;
    return '';
}

const GROUPS = [['', 'Все события'], ['products', 'Товары'], ['stock', 'Склад'], ['lists', 'Списки'], ['settings', 'Настройки']];

export async function render({ el, isCurrent }) {
    const st = { group: '', q: '', from: '', to: '', page: 0, items: [], more: false };
    el.innerHTML = `
    <div class="page-head"><div><h1 class="page-title">История</h1><p class="page-sub">Все действия: что, когда и кем сделано</p></div></div>
    <div class="toolbar">
        <div class="segmented" data-groups></div>
        <div class="row"><input class="input sm" type="date" data-from aria-label="С даты" style="width:160px"><span class="muted">—</span>
            <input class="input sm" type="date" data-to aria-label="По дату" style="width:160px"></div>
        <div class="search-field" style="margin-left:auto">${icon('search')}<input class="input" type="search" data-q placeholder="Поиск по истории" autocomplete="off"></div>
    </div>
    <div data-body>${skeletonTable()}</div>`;
    const body = el.querySelector('[data-body]');
    const SIZE = 60;

    async function load(append = false) {
        el.querySelector('[data-groups]').innerHTML = GROUPS.map(([k, l]) => `<button type="button" class="${st.group === k ? 'on' : ''}" data-g="${k}">${l}</button>`).join('');
        if (!append) st.page = 0;
        const p = new URLSearchParams({ page: st.page, size: SIZE });
        if (st.group) p.set('group', st.group);
        if (st.from) p.set('from', st.from);
        if (st.to) p.set('to', st.to);
        if (st.q.trim()) p.set('q', st.q.trim());
        const rows = await api.get('/api/history?' + p);
        if (!isCurrent()) return;
        st.items = append ? st.items.concat(rows) : rows;
        st.more = rows.length === SIZE;
        draw();
    }
    function draw() {
        if (!st.items.length) {
            body.innerHTML = `<div class="card">${empty({ art: 'clock', title: 'Событий не найдено', text: 'Измените фильтры или период.' })}</div>`;
            return;
        }
        let last = '';
        body.innerHTML = `<div class="card pad" style="padding-top:6px"><div class="feed">${st.items.map(a => {
            const day = String(a.createdAt).slice(0, 10);
            const head = day !== last ? `<div class="day-head">${esc(dayTitle(a.createdAt))}</div>` : '';
            last = day;
            const href = link(a);
            return `${head}<div class="feed-item">${activityIcon(a.action)}<div class="grow" style="min-width:0">
                <div class="feed-title">${href ? `<a href="${href}" style="color:var(--ink)">${esc(a.title)}</a>` : esc(a.title)}</div>
                ${a.details ? `<div class="feed-details">${esc(a.details)}</div>` : ''}
                <div class="feed-time">${esc(time(a.createdAt))} · ${esc(a.actionTitle)}${a.userName ? ' · ' + esc(a.userName) : ''}</div></div></div>`;
        }).join('')}</div>
        ${st.more ? `<div class="load-more"><button class="btn" type="button" data-more>Показать ещё</button></div>` : ''}</div>`;
    }
    const loadSoon = debounce(() => load(), 250);
    function onClick(e) {
        const g = e.target.closest('[data-g]');
        if (g) { st.group = g.dataset.g; load(); return; }
        if (e.target.closest('[data-more]')) { st.page++; load(true); }
    }
    function onInput(e) { if (e.target.matches('[data-q]')) { st.q = e.target.value; loadSoon(); } }
    function onChange(e) {
        if (e.target.matches('[data-from]')) { st.from = e.target.value; load(); }
        if (e.target.matches('[data-to]')) { st.to = e.target.value; load(); }
    }
    await load();
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
    return () => { el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); el.removeEventListener('change', onChange); };
}
