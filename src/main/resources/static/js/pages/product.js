import { api } from '../api.js';
import {
    icon, esc, num, money, date, dateTime, stockPill, listPill, noImage, empty, toast, confirmDialog, busy,
    rememberViewed, skeletonTable,
} from '../ui.js';
import { productForm, stockDialog, addToListDialog } from '../dialogs.js';
import { state } from '../state.js';

export function movementRows(moves, { showProduct = false } = {}) {
    return moves.map(m => {
        const sign = Number(m.quantity) > 0 ? '+' : '−';
        const cls = Number(m.quantity) > 0 ? 'qty-pos' : 'qty-neg';
        const what = m.listId
            ? `<a href="#/lists/${m.listId}">${esc(m.listName || 'Список')}</a>${m.recipient ? ` · ${esc(m.recipient)}` : ''}`
            : esc(m.recipient ? `Кому: ${m.recipient}` : '');
        return `<tr>
            <td class="small" style="white-space:nowrap">${esc(dateTime(m.createdAt))}</td>
            ${showProduct ? `<td><a class="prod" href="#/products/${m.productId}" style="min-width:200px"><span class="mini-img sm">${m.imageUrl ? `<img src="${esc(m.imageUrl)}" alt="">` : noImage(m.productName)}</span>
                <div><div class="name">${esc(m.productName)}</div><div class="sub">${esc(m.productSku)}</div></div></a></td>` : ''}
            <td><span class="pill plain ${m.type === 'ISSUE' ? 'PENDING' : m.type === 'ADJUSTMENT' ? 'DRAFT' : 'AVAILABLE'}">${esc(m.typeTitle)}</span></td>
            <td class="right num ${cls}">${sign}${num(Math.abs(m.quantity))} ${esc(m.unit)}</td>
            <td class="right num">${num(m.balanceAfter)}</td>
            <td class="right num">${money(m.amount)}</td>
            <td class="small" style="max-width:320px">${what}${m.note && !m.listId ? `${what ? '<br>' : ''}<span class="muted">${esc(m.note)}</span>` : ''}</td>
        </tr>`;
    }).join('');
}

export function movementTable(moves, opts = {}) {
    return `<div class="table-wrap"><table class="table"><thead><tr><th>Когда</th>${opts.showProduct ? '<th>Товар</th>' : ''}<th>Операция</th>
        <th class="right">Количество</th><th class="right">Остаток после</th><th class="right">Сумма</th><th>Подробности</th></tr></thead>
        <tbody>${movementRows(moves, opts)}</tbody></table></div>`;
}

export async function render({ el, params, isCurrent }) {
    const id = Number(params[0]);
    el.innerHTML = `<div class="crumbs"><a href="#/products">Товары</a>${icon('chevron-right', 'sm')}<span>…</span></div>${skeletonTable(5)}`;
    let d = await api.get(`/api/products/${id}`);
    if (!isCurrent()) return;
    rememberViewed(id);
    let current = 0;

    function draw() {
        const p = d.product;
        const imgs = d.images;
        if (current >= imgs.length) current = 0;
        if (p.deleted) {
            el.innerHTML = `<div class="crumbs"><a href="#/products">Товары</a>${icon('chevron-right', 'sm')}<span>${esc(p.name)}</span></div>
              <div class="card">${empty({ art: 'search', title: 'Этот товар удалён', text: 'Он больше не показывается в каталоге, но история его движений сохранена.',
                action: '<a class="btn primary" href="#/products">К каталогу</a>' })}</div>
              ${d.movements.length ? `<div class="card" style="margin-top:18px"><div class="card-head"><h2 class="section-title">История движений</h2></div>${movementTable(d.movements)}</div>` : ''}`;
            return;
        }
        el.innerHTML = `
        <div class="crumbs"><a href="#/products">Товары</a>${icon('chevron-right', 'sm')}<span class="ellipsis">${esc(p.name)}</span></div>
        <div class="page-head">
            <div style="min-width:0"><h1 class="page-title">${esc(p.name)}</h1>
              <p class="page-sub row wrap" style="gap:10px">${stockPill(p.status)}
                ${p.categoryName ? `<span class="pill cat" style="--c:${esc(p.categoryColor)}">${esc(p.categoryName)}</span>` : ''}
                <span>Код ${esc(p.sku)}</span></p></div>
            <div class="page-actions">
                <button class="btn" type="button" data-act="edit">${icon('edit')}Изменить</button>
                <button class="btn" type="button" data-act="list">${icon('list-plus')}В список</button>
                <button class="btn turq" type="button" data-act="receive">${icon('arrow-in')}Приход</button>
                <button class="btn primary" type="button" data-act="issue">${icon('arrow-out')}Выдать</button>
            </div>
        </div>

        <div class="product-layout">
            <div>
                <div class="gallery-main" data-gallery>${imgs.length ? `<img src="${esc(imgs[current].url)}" alt="${esc(p.name)}">` : noImage(p.name, p.categoryColor)}</div>
                <div class="gallery-thumbs">
                    ${imgs.map((im, i) => `<button type="button" class="${i === current ? 'on' : ''}" data-thumb="${i}" title="${im.primary ? 'Главное фото' : 'Показать'}"><img src="${esc(im.url)}" alt=""></button>`).join('')}
                    <label class="add-photo gallery-thumbs-add" title="Добавить фото" style="width:68px;height:68px;border-radius:12px;display:grid;place-items:center;cursor:pointer;color:var(--muted);border:1.5px dashed var(--line-strong)">
                        ${icon('plus')}<input type="file" accept="image/*" multiple hidden data-upload></label>
                </div>
                ${imgs.length ? `<div class="photo-tools">
                    ${imgs[current].primary ? `<span class="pill plain AVAILABLE">${icon('star', 'sm')}Главное фото</span>`
                        : `<button class="btn xs" type="button" data-act="primary">${icon('star')}Сделать главным</button>`}
                    <button class="btn xs ghost" type="button" data-act="del-photo" style="color:var(--red)">${icon('trash')}Удалить фото</button></div>` : ''}
            </div>

            <div class="stack">
                <div class="stock-tiles">
                    <div class="stock-tile lead"><div class="k">Сейчас на складе</div><div class="v num">${num(p.quantity)} <small>${esc(p.unit)}</small></div>
                        <div class="small muted" style="margin-top:4px">на ${money(p.stockValue)}</div></div>
                    <div class="stock-tile"><div class="k">Всего поступило</div><div class="v num">${num(d.totalReceived)} <small>${esc(p.unit)}</small></div></div>
                    <div class="stock-tile"><div class="k">Всего выдано</div><div class="v num">${num(d.totalIssued)} <small>${esc(p.unit)}</small></div></div>
                </div>
                ${Number(p.reservedQty) > 0 ? `<div class="alert ${Number(p.reservedQty) > Number(p.quantity) ? 'warn' : 'info'}">${icon('clipboard')}
                    <div>Ждут выдачи по спискам: <b>${num(p.reservedQty)} ${esc(p.unit)}</b>.
                    ${Number(p.reservedQty) > Number(p.quantity) ? `Не хватает ${num(p.reservedQty - p.quantity)} ${esc(p.unit)} — оформите приход.` : 'На складе достаточно.'}</div></div>` : ''}
                <div class="card pad">
                    <h2 class="section-title" style="margin-bottom:6px">Сведения</h2>
                    <div class="facts">
                        <div class="fact"><span class="k">Цена закупки</span><span class="v num">${money(p.purchasePrice)} / ${esc(p.unit)}</span></div>
                        <div class="fact"><span class="k">Цена продажи</span><span class="v num">${p.sellingPrice !== null ? money(p.sellingPrice) : '—'}</span></div>
                        <div class="fact"><span class="k">Минимальный остаток</span><span class="v num">${num(p.minQuantity)} ${esc(p.unit)}</span></div>
                        <div class="fact"><span class="k">Единица измерения</span><span class="v">${esc(p.unit)}</span></div>
                        <div class="fact"><span class="k">Код товара</span><span class="v">${esc(p.sku)}</span></div>
                        <div class="fact"><span class="k">Штрихкод</span><span class="v">${esc(p.barcode || '—')}</span></div>
                        <div class="fact"><span class="k">Место на складе</span><span class="v">${esc(p.location || '—')}</span></div>
                        <div class="fact"><span class="k">Категория</span><span class="v">${esc(p.categoryName || 'Без категории')}</span></div>
                        <div class="fact"><span class="k">Добавлен</span><span class="v">${esc(date(p.createdAt))}</span></div>
                        <div class="fact"><span class="k">Изменён</span><span class="v">${esc(dateTime(p.updatedAt))}</span></div>
                    </div>
                    ${p.description ? `<div style="margin-top:16px"><div class="label" style="margin-bottom:6px">Описание</div><p style="white-space:pre-line;color:var(--ink-2)">${esc(p.description)}</p></div>` : ''}
                    <div class="row wrap" style="margin-top:18px">
                        <button class="btn sm" type="button" data-act="adjust">${icon('scale')}Инвентаризация</button>
                        <button class="btn sm ghost" type="button" data-act="delete" style="color:var(--red);margin-left:auto">${icon('trash')}Удалить товар</button>
                    </div>
                </div>
            </div>
        </div>

        ${d.lists.length ? `<div class="card" style="margin-top:22px"><div class="card-head"><h2 class="section-title">Списки с этим товаром</h2></div>
            <div class="table-wrap"><table class="table"><thead><tr><th>Список</th><th>Статус</th><th>Выдано</th><th>Изменён</th></tr></thead><tbody>
            ${d.lists.map(l => `<tr class="clickable" data-href="#/lists/${l.id}"><td class="strong">${esc(l.name)}</td><td>${listPill(l.status)}</td>
                <td><div class="row-progress"><div class="bar"><i class="${l.progress >= 100 ? 'full' : ''}" style="width:${l.progress}%"></i></div><div class="t">${l.progress}%</div></div></td>
                <td class="small muted">${esc(dateTime(l.updatedAt))}</td></tr>`).join('')}</tbody></table></div></div>` : ''}

        <div class="card" style="margin-top:22px">
            <div class="card-head"><h2 class="section-title">История движений</h2><span class="muted small" style="margin-left:auto">${d.movementCount} ${d.movementCount === 1 ? 'операция' : 'операций'}</span></div>
            ${d.movements.length ? movementTable(d.movements)
                : empty({ art: 'clock', title: 'Движений ещё не было', text: 'Оформите приход, чтобы товар появился на складе.', compact: true,
                    action: `<button class="btn turq sm" data-act="receive">${icon('arrow-in')}Оформить приход</button>` })}
        </div>`;
    }

    async function reload() {
        d = await api.get(`/api/products/${id}`);
        if (isCurrent()) draw();
    }

    async function onClick(e) {
        const row = e.target.closest('[data-href]');
        if (row && !e.target.closest('a,button')) { location.hash = row.dataset.href; return; }
        const th = e.target.closest('[data-thumb]');
        if (th) { current = Number(th.dataset.thumb); draw(); return; }
        const a = e.target.closest('[data-act]');
        if (!a) return;
        const p = d.product;
        switch (a.dataset.act) {
            case 'edit': if (await productForm(p)) await reload(); break;
            case 'receive': case 'issue': case 'adjust': if (await stockDialog(a.dataset.act, p)) await reload(); break;
            case 'list': { const lid = await addToListDialog(p); if (lid) await reload(); break; }
            case 'primary':
                await busy(a, async () => {
                    try { d.images = await api.post(`/api/products/${id}/images/${d.images[current].id}/primary`); current = 0; draw(); toast('Главное фото выбрано'); }
                    catch (err) { toast(err.message, 'err'); }
                });
                break;
            case 'del-photo':
                if (await confirmDialog({ title: 'Удалить фото?', text: 'Фотография будет удалена без возможности восстановления.', ok: 'Удалить', danger: true })) {
                    try { d.images = await api.del(`/api/products/${id}/images/${d.images[current].id}`); current = 0; await reload(); toast('Фото удалено'); }
                    catch (err) { toast(err.message, 'err'); }
                }
                break;
            case 'delete': {
                const ok = await confirmDialog({
                    title: `Удалить «${esc(p.name)}»?`, danger: true, ok: 'Удалить товар',
                    text: `Товар исчезнет из каталога. История его прихода и выдачи сохранится в отчётах.${Number(p.quantity) > 0 ? `<br><br><b>Внимание:</b> на складе ещё ${num(p.quantity)} ${esc(p.unit)}.` : ''}`,
                });
                if (!ok) return;
                try { await api.del(`/api/products/${id}`); toast('Товар удалён'); state.refreshCounts(); location.hash = '#/products'; }
                catch (err) { toast(err.message, 'err'); }
                break;
            }
        }
    }
    async function onChange(e) {
        if (!e.target.matches('[data-upload]')) return;
        const files = e.target.files;
        if (!files.length) return;
        try {
            toast('Загружаем фото…');
            d.images = await api.upload(`/api/products/${id}/images`, files);
            current = d.images.length - 1;
            await reload();
            toast('Фото добавлено');
        } catch (err) { toast(err.message, 'err'); }
    }
    // лёгкий 3D-наклон большого фото
    function onMove(e) {
        const g = e.target.closest('[data-gallery]');
        if (!g || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const img = g.querySelector('img');
        if (!img) return;
        const r = g.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        img.style.transform = `scale(1.06) rotateX(${(-y * 3).toFixed(2)}deg) rotateY(${(x * 3).toFixed(2)}deg) translate(${(-x * 8).toFixed(1)}px, ${(-y * 8).toFixed(1)}px)`;
    }
    function onOut(e) {
        const g = e.target.closest && e.target.closest('[data-gallery]');
        if (g && !g.contains(e.relatedTarget)) { const img = g.querySelector('img'); if (img) img.style.transform = ''; }
    }

    draw();
    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerout', onOut);
    return () => {
        el.removeEventListener('click', onClick);
        el.removeEventListener('change', onChange);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerout', onOut);
    };
}
