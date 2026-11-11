// Создание и изменение списка к выдаче.
import { api } from '../api.js';
import {
    icon, esc, num, money, miniImg, stockPill, empty, toast, busy, parseNum, confirmDialog, skeletonTable, plural, LIST_TITLES,
} from '../ui.js';
import { productForm } from '../dialogs.js';
import { state } from '../state.js';
import { mountAiImport } from './ai-import.js';

export async function render({ el, params, query, isCurrent }) {
    const editId = params[0] ? Number(params[0]) : null;
    el.innerHTML = skeletonTable(6);
    const [products, existing] = await Promise.all([
        api.get('/api/products'),
        editId ? api.get(`/api/lists/${editId}`) : Promise.resolve(null),
    ]);
    if (!isCurrent()) return;

    if (existing && !['DRAFT', 'PENDING', 'PARTIAL'].includes(existing.summary.status)) {
        el.innerHTML = `<div class="card">${empty({ art: 'list', title: 'Этот список уже нельзя изменить',
            text: `Статус: ${esc(LIST_TITLES[existing.summary.status])}. Можно создать копию и изменить её.`,
            action: `<a class="btn primary" href="#/lists/${editId}">Открыть список</a>` })}</div>`;
        return;
    }

    const byId = new Map(products.map(p => [p.id, p]));
    const st = {
        name: existing?.summary.name || '',
        recipient: existing?.summary.recipient || '',
        notes: existing?.summary.notes || '',
        status: existing?.summary.status || null,
        items: existing ? existing.items.map(i => ({
            productId: i.productId, qty: Number(i.requiredQty), issued: Number(i.issuedQty), note: i.note,
            // для существующих строк цена зафиксирована при добавлении в список
            price: Number(i.unitPrice), name: i.productName, sku: i.productSku, unit: i.unit, imageUrl: i.imageUrl,
            stock: Number(i.stock), deleted: i.productDeleted,
        })) : [],
        q: '',
        dirty: false,
    };
    // товар, переданный из каталога: #/lists/new?product=12
    const pre = Number(query.get('product'));
    if (!existing && pre && byId.has(pre)) addProduct(byId.get(pre), false);

    function itemFrom(p) {
        return { productId: p.id, qty: 1, issued: 0, note: null, price: Number(p.purchasePrice), name: p.name, sku: p.sku,
            unit: p.unit, imageUrl: p.imageUrl, stock: Number(p.quantity), categoryColor: p.categoryColor, deleted: false };
    }
    function addProduct(p, redraw = true) {
        const ex = st.items.find(i => i.productId === p.id);
        if (ex) ex.qty = +(ex.qty + 1).toFixed(3);
        else st.items.push(itemFrom(p));
        markDirty();
        if (redraw) { drawItems(); drawPicker(); drawSummary(); }
    }
    function markDirty() { st.dirty = true; state.dirty = true; }

    const isPartial = st.status === 'PARTIAL';
    el.innerHTML = `
    <div class="crumbs"><a href="#/lists">Списки к выдаче</a>${icon('chevron-right', 'sm')}<span>${existing ? esc(existing.summary.name) : 'Новый список'}</span></div>
    <div class="page-head"><div><h1 class="page-title">${existing ? 'Изменить список' : 'Новый список'}</h1>
        <p class="page-sub">${existing ? `Статус: ${esc(LIST_TITLES[st.status])}` : 'Найдите товары, нажмите на них и укажите нужное количество'}</p></div></div>
    <div data-ai-import style="margin-bottom:20px"></div>
    <div class="editor">
        <div class="stack">
            <div class="card">
                <div class="card-head"><h2 class="section-title">Добавить товары</h2>
                    <button class="btn xs" type="button" data-act="new-product" style="margin-left:auto">${icon('package-plus')}Новый товар</button></div>
                <div class="card-body" style="padding-bottom:12px">
                    <div class="input-wrap" style="margin-bottom:10px"><span class="prefix-icon">${icon('search', 'sm')}</span>
                        <input class="input" type="search" data-q placeholder="Начните вводить название, код или штрихкод" autocomplete="off" autofocus></div>
                    <div class="picker-results" data-picker></div>
                </div>
            </div>
            <div class="card">
                <div class="card-head"><h2 class="section-title">Товары в списке</h2><span class="muted small" data-count style="margin-left:auto"></span></div>
                <div data-items></div>
            </div>
        </div>
        <div class="editor-side stack">
            <div class="card pad stack" style="gap:16px">
                <div class="field"><label for="l_name">Название списка</label>
                    <input class="input" id="l_name" data-f="name" value="${esc(st.name)}" placeholder="Например: Ноябрьская поставка" autocomplete="off"></div>
                <div class="field"><label for="l_rec">Для кого <span class="muted" style="font-weight:500">(необязательно)</span></label>
                    <input class="input" id="l_rec" data-f="recipient" value="${esc(st.recipient)}" placeholder="Объект, бригада, магазин…" autocomplete="off"></div>
                <div class="field"><label for="l_notes">Заметки <span class="muted" style="font-weight:500">(необязательно)</span></label>
                    <textarea class="textarea" id="l_notes" data-f="notes" placeholder="Любые пометки к списку">${esc(st.notes)}</textarea></div>
                <div class="divider" style="margin:2px 0"></div>
                <div class="sum-lines" data-sum></div>
                <div class="total-box"><span class="muted strong">Сумма списка</span><span class="v num" data-total></span></div>
                <div class="stack" style="gap:10px">
                    ${!existing || st.status === 'DRAFT'
                        ? `<button class="btn primary block" type="button" data-save="PENDING">${icon('check')}Сохранить список</button>
                           <button class="btn block" type="button" data-save="DRAFT">${icon('note')}Сохранить как черновик</button>`
                        : `<button class="btn primary block" type="button" data-save="">${icon('check')}Сохранить изменения</button>`}
                    <button class="btn ghost block" type="button" data-act="cancel">Отмена</button>
                </div>
                ${!existing || st.status === 'DRAFT' ? `<p class="small muted">Сохранённый список ждёт выдачи. Черновик можно дописать позже — он не учитывается в ожидающих выдаче.</p>` : ''}
                ${isPartial ? `<div class="alert info">${icon('info')}<div class="small">По списку уже были выдачи. Количество нельзя уменьшить ниже уже выданного.</div></div>` : ''}
            </div>
        </div>
    </div>`;

    const pickerEl = el.querySelector('[data-picker]');
    const itemsEl = el.querySelector('[data-items]');

    function drawPicker() {
        const q = st.q.trim().toLowerCase();
        const list = products.filter(p => !q || [p.name, p.sku, p.barcode, p.categoryName].some(v => v && v.toLowerCase().includes(q)))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru')).slice(0, 60);
        if (!products.length) {
            pickerEl.innerHTML = empty({ title: 'В каталоге нет товаров', text: 'Сначала добавьте товар — это можно сделать прямо отсюда.', compact: true,
                action: `<button class="btn primary sm" data-act="new-product">${icon('plus')}Добавить товар</button>` });
            return;
        }
        if (!list.length) {
            pickerEl.innerHTML = empty({ art: 'search', title: 'Не найдено', text: `Товара «${esc(st.q)}» нет в каталоге.`, compact: true,
                action: `<button class="btn sm" data-act="new-product">${icon('plus')}Добавить такой товар</button>` });
            return;
        }
        pickerEl.innerHTML = list.map(p => {
            const inList = st.items.find(i => i.productId === p.id);
            return `<button type="button" class="pick ${inList ? 'added' : ''}" data-add="${p.id}">
                ${miniImg(p.imageUrl, p.name, '', p.categoryColor)}
                <div class="grow" style="min-width:0"><div class="name ellipsis">${esc(p.name)}</div>
                <div class="sub">${money(p.purchasePrice)} · на складе <b style="color:${p.status === 'OUT' ? 'var(--red)' : p.status === 'LOW' ? 'var(--amber)' : 'var(--ink)'}">${num(p.quantity)} ${esc(p.unit)}</b>${inList ? ` · в списке ${num(inList.qty)}` : ''}</div></div>
                <span class="add">${icon(inList ? 'check' : 'plus', 'sm')}</span></button>`;
        }).join('');
    }

    function drawItems() {
        el.querySelector('[data-count]').textContent = st.items.length ? `${st.items.length} ${plural(st.items.length, 'позиция', 'позиции', 'позиций')}` : '';
        if (!st.items.length) {
            itemsEl.innerHTML = empty({ art: 'list', title: 'Список пока пуст', text: 'Нажмите на товар выше, чтобы добавить его в список.', compact: true });
            return;
        }
        itemsEl.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Товар</th><th class="right">Цена</th><th>Нужно</th>
            <th class="right">На складе</th><th class="right">Сумма</th><th></th></tr></thead><tbody>
            ${st.items.map((it, i) => {
                const short = it.qty - it.issued > it.stock;
                return `<tr>
                <td><div class="prod">${miniImg(it.imageUrl, it.name, '', it.categoryColor)}<div style="min-width:0"><div class="name">${esc(it.name)}</div>
                    <div class="sub">${esc(it.sku)}${it.issued ? ` · уже выдано ${num(it.issued)} ${esc(it.unit)}` : ''}${it.deleted ? ' · <span class="shortage">товар удалён</span>' : ''}</div></div></div></td>
                <td class="right num">${money(it.price)}</td>
                <td><div class="row" style="gap:8px;flex-wrap:nowrap"><div class="stepper sm" data-i="${i}">
                    <button type="button" data-step="-1" aria-label="Меньше">−</button>
                    <input value="${esc(String(it.qty).replace('.', ','))}" inputmode="decimal" data-qty="${i}" aria-label="Количество">
                    <button type="button" data-step="1" aria-label="Больше">+</button></div><span class="small muted">${esc(it.unit)}</span></div></td>
                <td class="right num ${short ? 'shortage' : ''}">${num(it.stock)}${short ? `<div class="small">не хватает ${num(it.qty - it.issued - it.stock)}</div>` : ''}</td>
                <td class="right num strong" data-line="${i}">${money(it.qty * it.price)}</td>
                <td class="right"><button class="icon-btn sm" type="button" data-rm="${i}" aria-label="Убрать из списка" ${it.issued > 0 ? 'disabled title="Товар уже частично выдан"' : ''} style="color:var(--red)">${icon('trash', 'sm')}</button></td>
                </tr>`;
            }).join('')}</tbody></table></div>`;
    }

    function drawSummary() {
        const total = st.items.reduce((s, i) => s + i.qty * i.price, 0);
        const short = st.items.filter(i => i.qty - i.issued > i.stock).length;
        el.querySelector('[data-total]').textContent = money(total);
        el.querySelector('[data-sum]').innerHTML = `
            <div><span>Позиций</span><b>${st.items.length}</b></div>
            <div><span>Единиц товара</span><b class="num">${num(st.items.reduce((s, i) => s + i.qty, 0))}</b></div>
            ${short ? `<div><span style="color:var(--red)">Не хватает на складе</span><b style="color:var(--red)">${short} ${plural(short, 'позиция', 'позиции', 'позиций')}</b></div>` : ''}`;
    }

    function setQty(i, v, redrawInput = true) {
        const it = st.items[i];
        if (v === null || Number.isNaN(v)) return;
        v = Math.max(it.issued > 0 ? it.issued : 0.001, +v.toFixed(3));
        it.qty = v;
        markDirty();
        if (redrawInput) { drawItems(); }
        else {
            const line = itemsEl.querySelector(`[data-line="${i}"]`);
            if (line) line.textContent = money(it.qty * it.price);
        }
        drawSummary();
    }

    async function save(statusWanted, btn) {
        const name = st.name.trim();
        const nameIn = el.querySelector('[data-f="name"]');
        if (!name) {
            nameIn.classList.add('invalid'); nameIn.focus();
            toast('Введите название списка', 'err'); return;
        }
        if (statusWanted === 'PENDING' && !st.items.length) { toast('Добавьте в список хотя бы один товар', 'err'); return; }
        const short = st.items.filter(i => i.qty - i.issued > i.stock);
        if (statusWanted !== 'DRAFT' && short.length) {
            const ok = await confirmDialog({
                title: 'На складе не всего хватает', ok: 'Всё равно сохранить', iconName: 'alert',
                text: `Для ${short.length} ${plural(short.length, 'позиции', 'позиций', 'позиций')} на складе меньше, чем нужно:<br><br>${short.slice(0, 5).map(i =>
                    `• ${esc(i.name)} — нужно ${num(i.qty - i.issued)}, есть ${num(i.stock)}`).join('<br>')}<br><br>Список можно сохранить и выдать позже, когда товар поступит.`,
            });
            if (!ok) return;
        }
        const body = {
            name, recipient: st.recipient.trim() || null, notes: st.notes.trim() || null,
            status: statusWanted || null,
            items: st.items.map(i => ({ productId: i.productId, requiredQty: i.qty, note: i.note })),
        };
        await busy(btn, async () => {
            try {
                let id = editId;
                if (editId) await api.put(`/api/lists/${editId}`, body);
                else id = (await api.post('/api/lists', body)).id;
                st.dirty = false; state.dirty = false; state.guard = null;
                toast(statusWanted === 'DRAFT' ? 'Черновик сохранён' : 'Список сохранён');
                state.refreshCounts();
                location.hash = `#/lists/${id}`;
            } catch (e) { toast(e.message, 'err'); }
        });
    }

    async function onClick(e) {
        const add = e.target.closest('[data-add]');
        if (add) { addProduct(byId.get(Number(add.dataset.add))); return; }
        const stp = e.target.closest('[data-step]');
        if (stp) {
            const i = Number(stp.closest('[data-i]').dataset.i);
            const it = st.items[i];
            const next = it.qty + Number(stp.dataset.step);
            if (next <= 0) return;
            setQty(i, next);
            return;
        }
        const rm = e.target.closest('[data-rm]');
        if (rm) {
            st.items.splice(Number(rm.dataset.rm), 1);
            markDirty(); drawItems(); drawPicker(); drawSummary(); return;
        }
        const sv = e.target.closest('[data-save]');
        if (sv) { save(sv.dataset.save, sv); return; }
        const a = e.target.closest('[data-act]');
        if (!a) return;
        if (a.dataset.act === 'cancel') { location.hash = editId ? `#/lists/${editId}` : '#/lists'; return; }
        if (a.dataset.act === 'new-product') {
            const p = await productForm(null, { quick: true });
            if (p) { products.push(p); byId.set(p.id, p); addProduct(p); }
        }
    }
    function onInput(e) {
        if (e.target.matches('[data-q]')) { st.q = e.target.value; drawPicker(); return; }
        if (e.target.matches('[data-f]')) {
            st[e.target.dataset.f] = e.target.value; markDirty();
            e.target.classList.remove('invalid'); return;
        }
        if (e.target.matches('[data-qty]')) {
            const v = parseNum(e.target.value);
            const bad = v === null || Number.isNaN(v) || v <= 0;
            e.target.closest('.stepper').classList.toggle('invalid', bad);
            if (!bad) setQty(Number(e.target.dataset.qty), v, false);
        }
    }
    function onChange(e) {
        // перерисовка откладывается: change приходит во время потери фокуса
        if (e.target.matches('[data-qty]')) setTimeout(() => applyQtyChange(e.target), 0);
    }
    function applyQtyChange(target) {
        const e = { target };
        if (e.target.matches('[data-qty]')) {
            const i = Number(e.target.dataset.qty);
            const v = parseNum(e.target.value);
            if (v === null || Number.isNaN(v) || v <= 0) { drawItems(); return; }
            if (st.items[i].issued > 0 && v < st.items[i].issued) toast(`Уже выдано ${num(st.items[i].issued)} — меньше указать нельзя`, 'err');
            setQty(i, v);
        }
    }
    function onKey(e) {
        if (e.target.matches('[data-q]') && e.key === 'Enter') {
            e.preventDefault();
            const first = pickerEl.querySelector('[data-add]');
            if (first) { addProduct(byId.get(Number(first.dataset.add))); e.target.select(); }
        }
    }

    state.guard = async () => {
        if (!st.dirty) return true;
        const ok = await confirmDialog({ title: 'Уйти без сохранения?', text: 'Изменения в списке не сохранены и будут потеряны.', ok: 'Уйти без сохранения', danger: true });
        if (ok) { st.dirty = false; state.dirty = false; }
        return ok;
    };

    drawPicker(); drawItems(); drawSummary();

    // AI-импорт: распознанные товары переносятся в этот же список; сохраняет пользователь
    const aiCleanup = mountAiImport(el.querySelector('[data-ai-import]'), {
        byId, open: !existing,
        onApply: async (rows, meta, saveNow) => {
            for (const { product, qty } of rows) {
                if (!byId.has(product.id)) { byId.set(product.id, product); products.push(product); }
                const ex = st.items.find(i => i.productId === product.id);
                if (ex) ex.qty = +(ex.qty + qty).toFixed(3);
                else st.items.push({ ...itemFrom(product), qty });
            }
            const setField = (f, v) => {
                if (!v || st[f].trim()) return;
                st[f] = v;
                const inp = el.querySelector(`[data-f="${f}"]`); if (inp) inp.value = v;
            };
            setField('recipient', meta.recipient);
            setField('name', meta.listName || (meta.recipient ? `Заказ: ${meta.recipient}` : ''));
            markDirty(); drawItems(); drawPicker(); drawSummary();
            if (saveNow) {
                const btn = el.querySelector('[data-save="PENDING"]') || el.querySelector('[data-save=""]');
                await save(btn.dataset.save, btn);
            } else {
                toast(`Добавлено ${rows.length} ${plural(rows.length, 'товар', 'товара', 'товаров')}. Проверьте и нажмите «Сохранить список»`);
                el.querySelector('[data-items]').scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },
    });
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
    el.addEventListener('keydown', onKey);
    return () => {
        aiCleanup();
        state.dirty = false;
        el.removeEventListener('click', onClick);
        el.removeEventListener('input', onInput);
        el.removeEventListener('change', onChange);
        el.removeEventListener('keydown', onKey);
    };
}
