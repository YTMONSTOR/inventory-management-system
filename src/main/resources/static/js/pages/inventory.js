import { api } from '../api.js';
import { icon, esc, num, money, miniImg, stockPill, empty, skeletonTable, dropdown, debounce, isoDate, plural } from '../ui.js';
import { stockDialog } from '../dialogs.js';
import { movementTable } from './product.js';

export async function render({ el, query, isCurrent }) {
    const st = { tab: query.get('tab') || 'stock', q: '', status: 'attention', products: [], moves: [], type: '', from: '', to: '', mq: '' };

    el.innerHTML = `
    <div class="page-head">
        <div><h1 class="page-title">Склад</h1><p class="page-sub" data-sub>Остатки, приход и выдача товаров</p></div>
    </div>
    <div class="kpis" data-kpis></div>
    <div class="tabs"><button class="tab" data-tab="stock">Остатки</button><button class="tab" data-tab="moves">Журнал движений</button></div>
    <div data-body>${skeletonTable()}</div>`;
    const body = el.querySelector('[data-body]');

    st.products = await api.get('/api/products');
    if (!isCurrent()) return;
    const anyAttention = st.products.some(p => p.status !== 'AVAILABLE');
    if (!anyAttention) st.status = 'all';

    function drawKpis() {
        const value = st.products.reduce((s, p) => s + Number(p.stockValue), 0);
        const units = st.products.reduce((s, p) => s + Number(p.quantity), 0);
        const low = st.products.filter(p => p.status === 'LOW').length, out = st.products.filter(p => p.status === 'OUT').length;
        const short = st.products.filter(p => Number(p.reservedQty) > Number(p.quantity)).length;
        el.querySelector('[data-kpis]').innerHTML = `
            <div class="kpi"><div class="kpi-top"><span class="kpi-icon tone-lapis">${icon('wallet')}</span>Стоимость остатков</div><div class="kpi-value num" style="font-size:24px">${money(value)}</div><div class="kpi-foot">${num(units)} ед. товара</div></div>
            <div class="kpi"><div class="kpi-top"><span class="kpi-icon tone-amber">${icon('alert')}</span>Заканчиваются</div><div class="kpi-value num">${low}</div><div class="kpi-foot">остаток не выше минимума</div></div>
            <div class="kpi"><div class="kpi-top"><span class="kpi-icon tone-red">${icon('ban')}</span>Закончились</div><div class="kpi-value num">${out}</div><div class="kpi-foot">остаток 0</div></div>
            <div class="kpi"><div class="kpi-top"><span class="kpi-icon tone-turq">${icon('clipboard')}</span>Не хватает для списков</div><div class="kpi-value num">${short}</div><div class="kpi-foot">${plural(short, 'позиция', 'позиции', 'позиций')}</div></div>`;
    }

    function stockView() {
        const q = st.q.trim().toLowerCase();
        const list = st.products.filter(p => {
            if (st.status === 'attention' && p.status === 'AVAILABLE' && !(Number(p.reservedQty) > Number(p.quantity))) return false;
            if (st.status !== 'all' && st.status !== 'attention' && p.status !== st.status) return false;
            return !q || [p.name, p.sku, p.barcode, p.location].some(v => v && v.toLowerCase().includes(q));
        }).sort((a, b) => {
            const w = s => s === 'OUT' ? 0 : s === 'LOW' ? 1 : 2;
            return w(a.status) - w(b.status) || a.name.localeCompare(b.name, 'ru');
        });
        return `
        <div class="toolbar">
            <div class="search-field">${icon('search')}<input class="input" type="search" data-q placeholder="Найти товар" value="${esc(st.q)}" autocomplete="off"></div>
            <div class="segmented">${[['attention', 'Требуют внимания'], ['all', 'Все'], ['LOW', 'Мало'], ['OUT', 'Нет']].map(([k, l]) =>
                `<button type="button" class="${st.status === k ? 'on' : ''}" data-st="${k}">${l}</button>`).join('')}</div>
        </div>
        ${!st.products.length ? `<div class="card">${empty({ title: 'На складе пока пусто', text: 'Добавьте товары в каталог — и здесь появятся их остатки.', action: '<a class="btn primary" href="#/products">Перейти к товарам</a>' })}</div>`
        : !list.length ? `<div class="card">${empty({ art: st.status === 'attention' ? 'ok' : 'search', title: st.status === 'attention' ? 'Всё в порядке' : 'Ничего не найдено',
            text: st.status === 'attention' ? 'Нет товаров, которые заканчиваются или которых не хватает для списков.' : 'Измените запрос или фильтр.',
            action: st.status === 'attention' ? '<button class="btn" data-st="all">Показать все товары</button>' : '' })}</div>`
        : `<div class="card"><div class="table-wrap"><table class="table"><thead><tr>
            <th>Товар</th><th class="right">На складе</th><th class="right">Минимум</th><th class="right">Ждут в списках</th><th class="right">Стоимость</th><th>Состояние</th><th class="right">Операции</th></tr></thead><tbody>
            ${list.map(p => {
                const short = Number(p.reservedQty) > Number(p.quantity);
                return `<tr>
                <td><a class="prod" href="#/products/${p.id}">${miniImg(p.imageUrl, p.name, '', p.categoryColor)}<div><div class="name">${esc(p.name)}</div><div class="sub">${esc(p.sku)}${p.location ? ' · ' + esc(p.location) : ''}</div></div></a></td>
                <td class="right num strong" style="font-size:16px">${num(p.quantity)} <span class="muted small">${esc(p.unit)}</span></td>
                <td class="right num muted">${num(p.minQuantity)}</td>
                <td class="right num ${short ? 'shortage' : ''}">${Number(p.reservedQty) > 0 ? num(p.reservedQty) : '—'}${short ? `<div class="small">не хватает ${num(p.reservedQty - p.quantity)}</div>` : ''}</td>
                <td class="right num">${money(p.stockValue)}</td>
                <td>${stockPill(p.status)}</td>
                <td><div class="actions">
                    <button class="btn xs" type="button" data-op="receive" data-id="${p.id}" style="color:var(--turq)">${icon('arrow-in')}Приход</button>
                    <button class="btn xs" type="button" data-op="issue" data-id="${p.id}" ${Number(p.quantity) <= 0 ? 'disabled' : ''}>${icon('arrow-out')}Выдать</button>
                    <button class="icon-btn sm" type="button" data-op="adjust" data-id="${p.id}" title="Инвентаризация">${icon('scale', 'sm')}</button>
                </div></td></tr>`;
            }).join('')}</tbody></table></div></div>`}`;
    }

    function movesView() {
        return `
        <div class="toolbar">
            <div class="search-field">${icon('search')}<input class="input" type="search" data-mq placeholder="Товар, список, получатель…" value="${esc(st.mq)}" autocomplete="off"></div>
            <div data-type style="min-width:200px"></div>
            <div class="row"><input class="input sm" type="date" data-from value="${esc(st.from)}" aria-label="С даты" style="width:160px">
                <span class="muted">—</span><input class="input sm" type="date" data-to value="${esc(st.to)}" aria-label="По дату" style="width:160px"></div>
        </div>
        <div class="card" data-moves>${skeletonTable(4)}</div>`;
    }

    async function loadMoves() {
        const p = new URLSearchParams();
        if (st.type) p.set('type', st.type);
        if (st.from) p.set('from', st.from);
        if (st.to) p.set('to', st.to);
        if (st.mq.trim()) p.set('q', st.mq.trim());
        p.set('limit', '500');
        const box = el.querySelector('[data-moves]');
        try {
            const moves = await api.get('/api/inventory/movements?' + p);
            if (!box.isConnected) return;
            box.innerHTML = moves.length
                ? `<div class="card-head"><span class="muted small">Показано ${moves.length} ${plural(moves.length, 'операция', 'операции', 'операций')}</span></div>${movementTable(moves, { showProduct: true })}`
                : empty({ art: 'clock', title: 'Операций не найдено', text: 'Измените период или условия поиска.', compact: true });
        } catch (e) { box.innerHTML = empty({ art: 'search', title: 'Не удалось загрузить', text: esc(e.message), compact: true }); }
    }
    const loadMovesSoon = debounce(loadMoves, 250);

    function draw() {
        el.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('on', t.dataset.tab === st.tab));
        drawKpis();
        if (st.tab === 'stock') {
            body.innerHTML = stockView();
        } else {
            body.innerHTML = movesView();
            dropdown(el.querySelector('[data-type]'), {
                options: [{ value: '', label: 'Все операции' }, { value: 'RECEIPT', label: 'Приход' }, { value: 'ISSUE', label: 'Выдача' },
                    { value: 'ADJUSTMENT', label: 'Корректировка' }, { value: 'INITIAL', label: 'Начальный остаток' }],
                value: st.type, onChange: v => { st.type = v; loadMoves(); },
            });
            loadMoves();
        }
    }

    async function onClick(e) {
        const t = e.target.closest('[data-tab]');
        if (t) { st.tab = t.dataset.tab; history.replaceState(null, '', `#/inventory?tab=${st.tab}`); draw(); return; }
        const s = e.target.closest('[data-st]');
        if (s) { st.status = s.dataset.st; body.innerHTML = stockView(); return; }
        const op = e.target.closest('[data-op]');
        if (op) {
            const p = st.products.find(x => x.id === Number(op.dataset.id));
            const res = await stockDialog(op.dataset.op, p);
            if (res) { Object.assign(p, res); drawKpis(); body.innerHTML = stockView(); }
        }
    }
    function onInput(e) {
        if (e.target.matches('[data-q]')) {
            st.q = e.target.value;
            const pos = e.target.selectionStart;
            body.innerHTML = stockView();
            const inp = body.querySelector('[data-q]'); inp.focus(); inp.setSelectionRange(pos, pos);
        }
        if (e.target.matches('[data-mq]')) { st.mq = e.target.value; loadMovesSoon(); }
    }
    function onChange(e) {
        if (e.target.matches('[data-from]')) { st.from = e.target.value; loadMoves(); }
        if (e.target.matches('[data-to]')) { st.to = e.target.value; loadMoves(); }
    }
    draw();
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
    return () => { el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); el.removeEventListener('change', onChange); };
}

export { isoDate };
