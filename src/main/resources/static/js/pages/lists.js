import { api } from '../api.js';
import { icon, esc, num, money, dateTime, listPill, miniImg, empty, skeletonTable, plural, debounce } from '../ui.js';

const TABS = [
    ['open', 'К выдаче', 'PENDING,PARTIAL'],
    ['DRAFT', 'Черновики', 'DRAFT'],
    ['COMPLETED', 'Выданные', 'COMPLETED'],
    ['CANCELLED', 'Отменённые', 'CANCELLED'],
    ['all', 'Все', ''],
];

/** Сегментированная полоса: заполнение по общей доле выдачи. */
function segments(count, progress) {
    const n = Math.max(1, Math.min(count, 14));
    const filled = (progress / 100) * n;
    return `<div class="ribbon">${Array.from({ length: n }, (_, i) => {
        const p = Math.max(0, Math.min(1, filled - i)) * 100;
        return `<i class="${progress >= 100 ? 'full' : ''}" style="--p:${p}%"></i>`;
    }).join('')}</div>`;
}

export function listCard(l) {
    return `<a class="lcard ${l.status}" href="#/lists/${l.id}">
        <div class="lcard-head"><div class="grow" style="min-width:0">
            <div class="lcard-name">${esc(l.name)}</div>
            <div class="lcard-sub">${l.recipient ? esc(l.recipient) + ' · ' : ''}создан ${esc(dateTime(l.createdAt))}</div></div>${listPill(l.status)}</div>
        <div>
            <div class="progress-label"><span>Выдано</span><b>${l.progress}%</b></div>
            ${segments(l.itemCount, l.progress)}
        </div>
        <div class="lcard-stats">
            <div><div class="v num">${l.itemCount}</div><div class="k">${plural(l.itemCount, 'позиция', 'позиции', 'позиций')}</div></div>
            <div><div class="v num">${num(l.requiredTotal - l.issuedTotal)}</div><div class="k">осталось ед.</div></div>
            <div><div class="v num">${esc(money(l.amountTotal, false))}</div><div class="k">сумма</div></div>
        </div>
        <div class="lcard-foot">
            <div class="faces">${l.previewImages.map(u => miniImg(u, '')).join('')}</div>
            ${l.shortageCount && (l.status === 'PENDING' || l.status === 'PARTIAL') ? `<span class="small shortage row" style="gap:5px">${icon('alert', 'sm')}не хватает: ${l.shortageCount}</span>` : ''}
            <span class="small muted" style="margin-left:auto">${l.lastIssueAt ? 'выдача ' + esc(dateTime(l.lastIssueAt)) : ''}</span>
        </div></a>`;
}

export async function render({ el, query, isCurrent }) {
    const st = { tab: query.get('tab') || 'open', q: '', counts: {} };
    el.innerHTML = `
    <div class="page-head">
        <div><h1 class="page-title">Списки к выдаче</h1><p class="page-sub">Списки товаров, которые нужно выдать — вместо записей на бумаге</p></div>
        <div class="page-actions"><a class="btn primary" href="#/lists/new">${icon('plus')}Новый список</a></div>
    </div>
    <div class="toolbar">
        <div class="segmented" data-tabs></div>
        <div class="search-field" style="margin-left:auto">${icon('search')}<input class="input" type="search" data-q placeholder="Название, получатель…" autocomplete="off"></div>
    </div>
    <div data-body>${skeletonTable(4)}</div>`;
    const body = el.querySelector('[data-body]');

    async function loadCounts() {
        const all = await api.get('/api/lists');
        st.counts = { all: all.length, open: 0, DRAFT: 0, COMPLETED: 0, CANCELLED: 0 };
        all.forEach(l => { if (l.status === 'PENDING' || l.status === 'PARTIAL') st.counts.open++; else st.counts[l.status]++; });
        if (!query.get('tab') && st.counts.open === 0 && st.counts.DRAFT > 0) st.tab = 'DRAFT';
        drawTabs();
    }
    function drawTabs() {
        el.querySelector('[data-tabs]').innerHTML = TABS.map(([k, l]) =>
            `<button type="button" class="${st.tab === k ? 'on' : ''}" data-tab="${k}">${l}${st.counts[k] ? ` <span class="count">${st.counts[k]}</span>` : ''}</button>`).join('');
    }
    async function load() {
        const statuses = TABS.find(t => t[0] === st.tab)[2];
        const p = new URLSearchParams();
        if (statuses) p.set('status', statuses);
        if (st.q.trim()) p.set('q', st.q.trim());
        const lists = await api.get('/api/lists?' + p);
        if (!isCurrent()) return;
        if (lists.length) { body.innerHTML = `<div class="list-grid">${lists.map(listCard).join('')}</div>`; return; }
        if (st.q.trim()) { body.innerHTML = `<div class="card">${empty({ art: 'search', title: 'Ничего не найдено', text: 'Попробуйте другое название.' })}</div>`; return; }
        const texts = {
            open: ['Нет списков к выдаче', 'Создайте список — добавьте товары из каталога и укажите, сколько нужно. Выдавать можно частями.'],
            DRAFT: ['Черновиков нет', 'Черновик — список, который вы ещё составляете.'],
            COMPLETED: ['Пока ничего не выдано полностью', 'Когда все товары списка будут выданы, он появится здесь.'],
            CANCELLED: ['Отменённых списков нет', ''],
            all: ['Списков пока нет', 'Создайте первый список товаров к выдаче.'],
        }[st.tab];
        body.innerHTML = `<div class="card">${empty({ art: 'list', title: texts[0], text: texts[1],
            action: st.tab === 'open' || st.tab === 'all' ? `<a class="btn primary" href="#/lists/new">${icon('plus')}Создать список</a>` : '' })}</div>`;
    }

    const loadSoon = debounce(load, 220);
    function onClick(e) {
        const t = e.target.closest('[data-tab]');
        if (t) { st.tab = t.dataset.tab; drawTabs(); history.replaceState(null, '', `#/lists?tab=${st.tab}`); load(); }
    }
    function onInput(e) { if (e.target.matches('[data-q]')) { st.q = e.target.value; loadSoon(); } }
    await loadCounts();
    await load();
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    return () => { el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); };
}
