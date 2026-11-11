import { api } from '../api.js';
import {
    icon, esc, num, money, stockPill, productImage, miniImg, skeletonCards, empty, store, dropdown, dateTime,
    STOCK_TITLES, plural,
} from '../ui.js';
import { productForm, stockDialog, addToListDialog } from '../dialogs.js';
import { loadCategories } from '../state.js';

const SORTS = [
    { value: 'name', label: 'По названию (А–Я)' },
    { value: 'name-desc', label: 'По названию (Я–А)' },
    { value: 'qty', label: 'Сначала меньше остаток' },
    { value: 'qty-desc', label: 'Сначала больше остаток' },
    { value: 'price', label: 'Сначала дешевле' },
    { value: 'price-desc', label: 'Сначала дороже' },
    { value: 'new', label: 'Сначала новые' },
    { value: 'updated', label: 'Недавно изменённые' },
];

export async function render({ el, query, isCurrent }) {
    const prefs = store.get('productsView', { view: 'cards', sort: 'name' });
    const st = {
        q: query.get('q') || '',
        cat: query.get('category') || 'all',
        status: query.get('status') || 'all',
        sort: prefs.sort,
        view: prefs.view,
        all: [],
        cats: [],
    };

    el.innerHTML = `
    <div class="page-head">
        <div><h1 class="page-title">Товары</h1><p class="page-sub" data-sub>Загружаем каталог…</p></div>
        <div class="page-actions">
            <button class="btn" type="button" data-act="quick">${icon('package-plus')}Быстро</button>
            <button class="btn primary" type="button" data-act="add">${icon('plus')}Добавить товар</button>
        </div>
    </div>
    <div class="toolbar">
        <div class="search-field">${icon('search')}<input class="input" type="search" data-q placeholder="Название, код, штрихкод…" value="${esc(st.q)}" autocomplete="off"></div>
        <div class="segmented" data-status></div>
        <div data-sort style="min-width:230px"></div>
        <div class="segmented" style="margin-left:auto" role="group" aria-label="Вид">
            <button type="button" data-view="cards" title="Карточки">${icon('grid', 'sm')}Карточки</button>
            <button type="button" data-view="table" title="Таблица">${icon('rows', 'sm')}Таблица</button>
        </div>
    </div>
    <div class="chips" data-cats></div>
    <div data-list>${skeletonCards(8)}</div>`;

    const listEl = el.querySelector('[data-list]');
    const [products, cats] = await Promise.all([api.get('/api/products'), loadCategories(true)]);
    if (!isCurrent()) return;
    st.all = products;
    st.cats = cats;

    const sortDd = dropdown(el.querySelector('[data-sort]'), {
        options: SORTS, value: st.sort, small: false,
        onChange: v => { st.sort = v; savePrefs(); draw(); },
    });

    function savePrefs() { store.set('productsView', { view: st.view, sort: st.sort }); }

    function filtered() {
        const q = st.q.trim().toLowerCase();
        let list = st.all.filter(p => {
            if (st.cat !== 'all' && String(p.categoryId ?? 'none') !== st.cat) return false;
            if (st.status !== 'all' && p.status !== st.status) return false;
            if (!q) return true;
            return [p.name, p.sku, p.barcode, p.description, p.categoryName, p.location]
                .some(v => v && String(v).toLowerCase().includes(q));
        });
        const by = {
            name: (a, b) => a.name.localeCompare(b.name, 'ru'),
            'name-desc': (a, b) => b.name.localeCompare(a.name, 'ru'),
            qty: (a, b) => a.quantity - b.quantity,
            'qty-desc': (a, b) => b.quantity - a.quantity,
            price: (a, b) => a.purchasePrice - b.purchasePrice,
            'price-desc': (a, b) => b.purchasePrice - a.purchasePrice,
            new: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
            updated: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
        }[st.sort] || ((a, b) => a.name.localeCompare(b.name, 'ru'));
        return list.sort(by);
    }

    function drawChrome() {
        const counts = { all: st.all.length, AVAILABLE: 0, LOW: 0, OUT: 0 };
        st.all.forEach(p => counts[p.status]++);
        el.querySelector('[data-status]').innerHTML = [['all', 'Все'], ['AVAILABLE', 'В наличии'], ['LOW', 'Мало'], ['OUT', 'Нет']].map(([k, l]) =>
            `<button type="button" class="${st.status === k ? 'on' : ''}" data-st="${k}">${l} <span class="count">${counts[k]}</span></button>`).join('');
        const catCount = id => st.all.filter(p => String(p.categoryId ?? 'none') === String(id)).length;
        const noCat = catCount('none');
        el.querySelector('[data-cats]').innerHTML = `<button type="button" class="chip ${st.cat === 'all' ? 'on' : ''}" data-cat="all">Все категории</button>`
            + st.cats.map(c => `<button type="button" class="chip ${st.cat === String(c.id) ? 'on' : ''}" data-cat="${c.id}">
                <span class="dot" style="background:${esc(c.color)}"></span>${esc(c.name)} <span class="n">${catCount(c.id)}</span></button>`).join('')
            + (noCat ? `<button type="button" class="chip ${st.cat === 'none' ? 'on' : ''}" data-cat="none">Без категории <span class="n">${noCat}</span></button>` : '')
            + `<a class="chip" href="#/categories">${icon('plus', 'sm')}Категории</a>`;
        el.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === st.view));
    }

    function draw() {
        drawChrome();
        if (sortDd.value !== st.sort) sortDd.set(st.sort);
        const list = filtered();
        const value = st.all.reduce((s, p) => s + Number(p.stockValue), 0);
        el.querySelector('[data-sub]').textContent = st.all.length
            ? `${st.all.length} ${plural(st.all.length, 'товар', 'товара', 'товаров')} на сумму ${money(value)}${list.length !== st.all.length ? ` · показано ${list.length}` : ''}`
            : 'Каталог пуст';
        if (!st.all.length) {
            listEl.innerHTML = `<div class="card">${empty({ title: 'Добавьте первый товар',
                text: 'Сфотографируйте товар, укажите название, цену и сколько его на складе. Это займёт меньше минуты.',
                action: `<button class="btn primary" data-act="add">${icon('plus')}Добавить товар</button>` })}</div>`;
            return;
        }
        if (!list.length) {
            listEl.innerHTML = `<div class="card">${empty({ art: 'search', title: 'Ничего не найдено',
                text: 'Попробуйте изменить запрос или сбросить фильтры.', action: '<button class="btn" data-act="reset">Сбросить фильтры</button>' })}</div>`;
            return;
        }
        listEl.innerHTML = st.view === 'table' ? table(list) : cards(list);
    }

    const cards = list => `<div class="product-grid">${list.map(p => {
        const ratio = p.minQuantity > 0 ? Math.min(100, (p.quantity / (p.minQuantity * 3)) * 100) : (p.quantity > 0 ? 100 : 0);
        return `<a class="pcard" href="#/products/${p.id}" data-tilt>
            <div class="pcard-media">${productImage(p)}${p.status !== 'AVAILABLE' ? stockPill(p.status) : ''}
                <div class="pcard-actions">
                    <button type="button" data-op="receive" data-id="${p.id}" title="Приход" aria-label="Приход">${icon('arrow-in', 'sm')}</button>
                    <button type="button" data-op="issue" data-id="${p.id}" title="Выдать" aria-label="Выдать">${icon('arrow-out', 'sm')}</button>
                    <button type="button" data-op="list" data-id="${p.id}" title="В список" aria-label="Добавить в список">${icon('list-plus', 'sm')}</button>
                </div></div>
            <div class="pcard-body">
                <div class="pcard-meta">${p.categoryName ? `<span class="dot" style="background:${esc(p.categoryColor)}"></span>${esc(p.categoryName)} · ` : ''}${esc(p.sku)}</div>
                <div class="pcard-name">${esc(p.name)}</div>
                <div class="pcard-foot">
                    <div class="pcard-price num">${esc(money(p.purchasePrice, false))} <small>за ${esc(p.unit)}</small></div>
                    <div class="pcard-stock"><div class="q num">${num(p.quantity)}</div><div class="l">${esc(p.unit)} на складе</div></div>
                </div>
                <div class="stockbar ${p.status}"><i style="width:${Math.max(p.quantity > 0 ? 4 : 0, ratio)}%"></i></div>
            </div></a>`;
    }).join('')}</div>`;

    const table = list => `<div class="card"><div class="table-wrap"><table class="table"><thead><tr>
        ${th('name', 'Товар')}<th>Категория</th>${th('price', 'Цена', true)}${th('qty', 'Остаток', true)}<th class="right">Мин.</th>
        <th class="right">В списках</th><th class="right">Сумма</th><th>Состояние</th><th>Изменён</th><th class="right">Действия</th></tr></thead><tbody>
        ${list.map(p => `<tr class="clickable" data-href="#/products/${p.id}">
            <td><div class="prod">${miniImg(p.imageUrl, p.name, '', p.categoryColor)}<div><div class="name">${esc(p.name)}</div><div class="sub">${esc(p.sku)}${p.barcode ? ' · ' + esc(p.barcode) : ''}</div></div></div></td>
            <td>${p.categoryName ? `<span class="pill cat" style="--c:${esc(p.categoryColor)}">${esc(p.categoryName)}</span>` : '<span class="muted">—</span>'}</td>
            <td class="right num">${money(p.purchasePrice)}</td>
            <td class="right num strong">${num(p.quantity)} ${esc(p.unit)}</td>
            <td class="right num muted">${num(p.minQuantity)}</td>
            <td class="right num ${p.reservedQty > p.quantity ? 'shortage' : ''}">${p.reservedQty > 0 ? num(p.reservedQty) : '—'}</td>
            <td class="right num">${money(p.stockValue)}</td>
            <td>${stockPill(p.status)}</td>
            <td class="small muted">${esc(dateTime(p.updatedAt))}</td>
            <td><div class="actions">
                <button class="btn xs" type="button" data-op="receive" data-id="${p.id}">${icon('arrow-in')}Приход</button>
                <button class="btn xs" type="button" data-op="issue" data-id="${p.id}">${icon('arrow-out')}Выдать</button>
                <button class="icon-btn sm" type="button" data-op="list" data-id="${p.id}" title="В список">${icon('list-plus', 'sm')}</button>
            </div></td></tr>`).join('')}
        </tbody></table></div></div>`;

    function th(key, label, right = false) {
        const sorted = st.sort === key || st.sort === key + '-desc';
        const desc = st.sort === key + '-desc';
        return `<th class="sortable ${right ? 'right' : ''} ${sorted ? 'sorted' : ''}" data-sortby="${key}">${label}<span class="arrow">${sorted ? (desc ? '↓' : '↑') : '↕'}</span></th>`;
    }

    // 3D-наклон карточки за курсором — лёгкий, только на устройствах с мышью
    const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    function onMove(e) {
        if (!canHover) return;
        const c = e.target.closest('[data-tilt]');
        if (!c) return;
        const r = c.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        c.style.transform = `perspective(900px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-3px)`;
    }
    function onLeave(e) {
        const c = e.target.closest && e.target.closest('[data-tilt]');
        if (c && !c.contains(e.relatedTarget)) c.style.transform = '';
    }

    async function onClick(e) {
        const op = e.target.closest('[data-op]');
        if (op) {
            e.preventDefault(); e.stopPropagation();
            const p = st.all.find(x => x.id === Number(op.dataset.id));
            if (!p) return;
            if (op.dataset.op === 'list') { const id = await addToListDialog(p); if (id) location.hash = `#/lists/${id}`; return; }
            const res = await stockDialog(op.dataset.op, p);
            if (res) { Object.assign(p, res); draw(); }
            return;
        }
        const t = e.target;
        if (t.closest('[data-act="add"]')) { const p = await productForm(); if (p) location.hash = `#/products/${p.id}`; return; }
        if (t.closest('[data-act="quick"]')) { const p = await productForm(null, { quick: true }); if (p) { st.all.push(p); draw(); } return; }
        if (t.closest('[data-act="reset"]')) { st.q = ''; st.cat = 'all'; st.status = 'all'; el.querySelector('[data-q]').value = ''; draw(); return; }
        const s = t.closest('[data-st]'); if (s) { st.status = s.dataset.st; draw(); return; }
        const c = t.closest('[data-cat]'); if (c) { st.cat = c.dataset.cat; draw(); return; }
        const v = t.closest('[data-view]'); if (v) { st.view = v.dataset.view; savePrefs(); draw(); return; }
        const so = t.closest('[data-sortby]');
        if (so) {
            const k = so.dataset.sortby;
            st.sort = st.sort === k ? k + '-desc' : k;
            savePrefs(); draw(); return;
        }
        const row = t.closest('[data-href]'); if (row) location.hash = row.dataset.href;
    }

    el.querySelector('[data-q]').addEventListener('input', e => { st.q = e.target.value; draw(); });
    el.addEventListener('click', onClick);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerout', onLeave);
    draw();
    return () => {
        el.removeEventListener('click', onClick);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerout', onLeave);
    };
}

export { STOCK_TITLES };
