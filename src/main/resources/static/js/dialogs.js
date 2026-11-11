// Общие окна: товар, приход / выдача / инвентаризация, добавление в список, категория.
import { api } from './api.js';
import {
    modal, esc, icon, toast, busy, dropdown, parseNum, num, money, miniImg, getCurrency, LIST_TITLES,
} from './ui.js';
import { state, loadCategories, invalidateCategories, UNITS } from './state.js';

function fieldError(form, name, msg) {
    const f = form.querySelector(`[name="${name}"]`);
    if (!f) return;
    const wrap = f.closest('.field');
    f.classList.toggle('invalid', !!msg);
    let e = wrap.querySelector('.error');
    if (!e && msg) { e = document.createElement('div'); e.className = 'error'; wrap.appendChild(e); }
    if (e) e.textContent = msg || '';
}

function clearErrors(form) {
    form.querySelectorAll('.error').forEach(e => e.remove());
    form.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'));
}

function showServerErrors(form, err) {
    const map = { purchasePrice: 'purchasePrice', sellingPrice: 'sellingPrice', name: 'name', unit: 'unit', minQuantity: 'minQuantity', initialQuantity: 'initialQuantity', sku: 'sku', barcode: 'barcode' };
    let shown = false;
    for (const [k, v] of Object.entries(err.fields || {})) if (map[k]) { fieldError(form, map[k], v); shown = true; }
    if (!shown) toast(err.message, 'err');
}

/** Поле для чисел: принимает и «12,5», и «12.5». */
function numberField(name, label, value, { suffix = '', hint = '', placeholder = '0', required = false } = {}) {
    return `<div class="field"><label for="f_${name}">${esc(label)}${required ? '' : ' <span class="muted" style="font-weight:500">(необязательно)</span>'}</label>
        <div class="input-wrap"><input class="input" id="f_${name}" name="${name}" inputmode="decimal" autocomplete="off"
            value="${value === null || value === undefined ? '' : esc(String(value).replace('.', ','))}" placeholder="${esc(placeholder)}">
        ${suffix ? `<span class="suffix">${esc(suffix)}</span>` : ''}</div>
        ${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
}

// ------------------------------------------------------------------ товар

export async function productForm(existing = null, { quick = false } = {}) {
    const cats = await loadCategories();
    const p = existing || {
        name: '', sku: '', categoryId: null, description: '', purchasePrice: '', sellingPrice: '',
        minQuantity: '', unit: state.settings.default_unit || 'шт', barcode: '', location: '',
    };
    const cur = getCurrency();
    let files = [];
    return new Promise(resolve => {
        let saved = null;
        modal({
            title: existing ? 'Изменить товар' : (quick ? 'Быстрое добавление товара' : 'Новый товар'),
            sub: existing ? `Код ${esc(existing.sku)}` : 'Обязательные поля: название, цена и единица измерения',
            wide: true,
            body: `<form class="form-grid" novalidate>
                <div class="field span-2"><label for="f_name">Название товара</label>
                    <input class="input" id="f_name" name="name" value="${esc(p.name)}" placeholder="Например: Кран шаровой ½ дюйма" autocomplete="off" autofocus></div>
                ${numberField('purchasePrice', 'Цена закупки', p.purchasePrice, { suffix: cur, required: true })}
                ${existing ? numberField('minQuantity', 'Минимальный остаток', p.minQuantity, { hint: 'Когда останется столько или меньше — появится предупреждение' })
                    : numberField('initialQuantity', 'Сколько сейчас на складе', '', { hint: 'Можно оставить пустым и оформить приход позже' })}
                <div class="field"><label>Единица измерения</label><div data-dd="unit"></div></div>
                <div class="field"><label>Категория</label><div data-dd="category"></div></div>
                ${!existing ? numberField('minQuantity', 'Минимальный остаток', p.minQuantity, { hint: 'Когда останется столько или меньше — появится предупреждение' }) : ''}
                ${!quick ? `
                ${numberField('sellingPrice', 'Цена продажи', p.sellingPrice, { suffix: cur })}
                <div class="field span-2"><label for="f_description">Описание <span class="muted" style="font-weight:500">(необязательно)</span></label>
                    <textarea class="textarea" id="f_description" name="description" placeholder="Размер, материал, производитель…">${esc(p.description || '')}</textarea></div>
                <div class="field"><label for="f_sku">Код товара <span class="muted" style="font-weight:500">(необязательно)</span></label>
                    <input class="input" id="f_sku" name="sku" value="${esc(p.sku || '')}" placeholder="Присвоится автоматически" autocomplete="off"></div>
                <div class="field"><label for="f_barcode">Штрихкод <span class="muted" style="font-weight:500">(необязательно)</span></label>
                    <div class="input-wrap"><span class="prefix-icon">${icon('barcode', 'sm')}</span>
                    <input class="input" id="f_barcode" name="barcode" value="${esc(p.barcode || '')}" placeholder="Можно отсканировать сканером" autocomplete="off"></div></div>
                <div class="field span-2"><label for="f_location">Место на складе <span class="muted" style="font-weight:500">(необязательно)</span></label>
                    <input class="input" id="f_location" name="location" value="${esc(p.location || '')}" placeholder="Например: стеллаж 3, полка 2" autocomplete="off"></div>` : ''}
                ${!existing ? `<div class="field span-2"><label>Фото товара</label>
                    <label class="dropzone" data-drop>${icon('upload', 'lg')}<div><strong>Нажмите, чтобы выбрать фото</strong> или перетащите сюда</div>
                    <div class="small">JPG, PNG или WEBP, до 12 МБ</div><input type="file" accept="image/*" multiple hidden></label>
                    <div class="thumbs" data-thumbs></div></div>` : ''}
                </form>`,
            foot: `<button class="btn" type="button" data-close>Отмена</button>
                   <button class="btn primary" type="button" data-save>${icon('check')}${existing ? 'Сохранить изменения' : 'Добавить товар'}</button>`,
            onMount(el, close) {
                const form = el.querySelector('form');
                const unitOpts = [...new Set([...UNITS, p.unit])].map(u => ({ value: u, label: u }));
                const unitDd = dropdown(el.querySelector('[data-dd="unit"]'), { options: unitOpts, value: p.unit });
                const catOpts = [{ value: '', label: 'Без категории' }, ...cats.map(c => ({ value: c.id, label: c.name, color: c.color }))];
                const catDd = dropdown(el.querySelector('[data-dd="category"]'), { options: catOpts, value: p.categoryId ?? '' });

                const drop = el.querySelector('[data-drop]');
                if (drop) {
                    const input = drop.querySelector('input');
                    const thumbs = el.querySelector('[data-thumbs]');
                    const renderThumbs = () => {
                        thumbs.innerHTML = files.map((f, i) => `<div class="thumb"><img src="${URL.createObjectURL(f)}" alt="">
                            <button type="button" class="x" data-rm="${i}" aria-label="Убрать фото">${icon('x')}</button></div>`).join('');
                    };
                    const add = list => { files = files.concat([...list].filter(f => f.type.startsWith('image/'))); renderThumbs(); };
                    input.addEventListener('change', () => { add(input.files); input.value = ''; });
                    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
                    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
                    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); add(e.dataTransfer.files); });
                    thumbs.addEventListener('click', e => {
                        const b = e.target.closest('[data-rm]');
                        if (b) { files.splice(+b.dataset.rm, 1); renderThumbs(); }
                    });
                }

                const save = async (btn) => {
                    clearErrors(form);
                    const v = n => form.querySelector(`[name="${n}"]`)?.value ?? '';
                    const data = {
                        name: v('name').trim(),
                        sku: v('sku').trim() || null,
                        categoryId: catDd.value === '' ? null : Number(catDd.value),
                        description: v('description').trim() || null,
                        purchasePrice: parseNum(v('purchasePrice')),
                        sellingPrice: parseNum(v('sellingPrice')),
                        initialQuantity: parseNum(v('initialQuantity')),
                        minQuantity: parseNum(v('minQuantity')) ?? 0,
                        unit: unitDd.value,
                        barcode: v('barcode').trim() || null,
                        location: v('location').trim() || null,
                    };
                    let bad = false;
                    if (!data.name) { fieldError(form, 'name', 'Введите название товара'); bad = true; }
                    if (data.purchasePrice === null) { fieldError(form, 'purchasePrice', 'Укажите цену закупки (можно 0)'); bad = true; }
                    for (const k of ['purchasePrice', 'sellingPrice', 'initialQuantity', 'minQuantity']) {
                        if (Number.isNaN(data[k])) { fieldError(form, k, 'Введите число, например 12 или 12,5'); bad = true; }
                        else if (data[k] !== null && data[k] < 0) { fieldError(form, k, 'Число не может быть отрицательным'); bad = true; }
                    }
                    if (bad) { form.querySelector('.invalid')?.focus(); return; }
                    await busy(btn, async () => {
                        try {
                            const res = existing ? await api.put(`/api/products/${existing.id}`, data) : await api.post('/api/products', data);
                            if (files.length) {
                                try { await api.upload(`/api/products/${res.id}/images`, files); }
                                catch (e) { toast('Товар сохранён, но фото не загрузилось: ' + e.message, 'err'); }
                            }
                            saved = res;
                            toast(existing ? 'Изменения сохранены' : `Товар «${res.name}» добавлен`);
                            invalidateCategories();
                            state.refreshCounts();
                            close();
                        } catch (e) { showServerErrors(form, e); }
                    });
                };
                el.querySelector('[data-save]').addEventListener('click', e => save(e.currentTarget));
                form.addEventListener('keydown', e => {
                    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(el.querySelector('[data-save]')); }
                });
            },
            onClose: () => resolve(saved),
        });
    });
}

// ------------------------------------------------------------------ приход / выдача / инвентаризация

const OPS = {
    receive: { title: 'Приход на склад', btn: 'Оформить приход', icon: 'arrow-in', cls: 'turq', qty: 'Сколько поступило', ok: 'Приход оформлен' },
    issue: { title: 'Выдать со склада', btn: 'Выдать', icon: 'arrow-out', cls: 'primary', qty: 'Сколько выдать', ok: 'Товар выдан' },
    adjust: { title: 'Инвентаризация', btn: 'Сохранить остаток', icon: 'scale', cls: 'primary', qty: 'Фактически на складе', ok: 'Остаток исправлен' },
};

export function stockDialog(type, p) {
    const op = OPS[type];
    return new Promise(resolve => {
        let result = null;
        modal({
            title: op.title,
            body: `
                <div class="op-product">${miniImg(p.imageUrl, p.name, 'lg', p.categoryColor)}
                    <div class="grow" style="min-width:0"><div class="strong ellipsis">${esc(p.name)}</div>
                    <div class="small muted">${esc(p.sku)} · сейчас на складе <b class="num" style="color:var(--ink)">${num(p.quantity)} ${esc(p.unit)}</b></div></div></div>
                <form class="form-grid" novalidate>
                    <div class="field ${type === 'issue' ? '' : 'span-2'}"><label for="op_qty">${op.qty}</label>
                        <div class="input-wrap"><input class="input" id="op_qty" name="qty" inputmode="decimal" autocomplete="off"
                            value="${type === 'adjust' ? esc(String(p.quantity).replace('.', ',')) : ''}" placeholder="0" autofocus>
                        <span class="suffix">${esc(p.unit)}</span></div></div>
                    ${type === 'issue' ? `<div class="field"><label for="op_rec">Кому <span class="muted" style="font-weight:500">(необязательно)</span></label>
                        <input class="input" id="op_rec" name="recipient" autocomplete="off" placeholder="Имя или объект"></div>` : ''}
                    ${type === 'receive' ? `<div class="field span-2"><label for="op_price">Цена закупки за ${esc(p.unit)}</label>
                        <div class="input-wrap"><input class="input" id="op_price" name="price" inputmode="decimal" value="${esc(String(p.purchasePrice).replace('.', ','))}">
                        <span class="suffix">${esc(getCurrency())}</span></div></div>` : ''}
                    <div class="field span-2"><label for="op_note">Примечание <span class="muted" style="font-weight:500">(необязательно)</span></label>
                        <input class="input" id="op_note" name="note" autocomplete="off" placeholder="${type === 'receive' ? 'Поставщик, накладная…' : type === 'issue' ? 'Для чего выдано' : 'Причина расхождения'}"></div>
                </form>
                <div class="op-preview" data-preview><span class="muted">Будет на складе:</span><span class="after num">—</span></div>`,
            foot: `<button class="btn" type="button" data-close>Отмена</button>
                   <button class="btn ${op.cls}" type="button" data-save>${icon(op.icon)}${op.btn}</button>`,
            onMount(el, close) {
                const form = el.querySelector('form');
                const qtyIn = form.querySelector('[name="qty"]');
                const after = el.querySelector('[data-preview] .after');
                const update = () => {
                    const q = parseNum(qtyIn.value);
                    if (q === null || Number.isNaN(q)) { after.textContent = '—'; after.style.color = ''; return; }
                    const cur = Number(p.quantity);
                    const v = type === 'receive' ? cur + q : type === 'issue' ? cur - q : q;
                    after.textContent = `${num(v)} ${p.unit}`;
                    after.style.color = v < 0 ? 'var(--red)' : '';
                };
                qtyIn.addEventListener('input', update);
                update();
                const save = async (btn) => {
                    clearErrors(form);
                    const q = parseNum(qtyIn.value);
                    if (q === null || Number.isNaN(q)) { fieldError(form, 'qty', 'Введите количество цифрами'); qtyIn.focus(); return; }
                    if (type !== 'adjust' && q <= 0) { fieldError(form, 'qty', 'Количество должно быть больше нуля'); qtyIn.focus(); return; }
                    if (type === 'adjust' && q < 0) { fieldError(form, 'qty', 'Остаток не может быть отрицательным'); return; }
                    if (type === 'issue' && q > Number(p.quantity)) {
                        fieldError(form, 'qty', `На складе только ${num(p.quantity)} ${p.unit} — больше выдать нельзя`); qtyIn.focus(); return;
                    }
                    const note = form.querySelector('[name="note"]').value.trim() || null;
                    await busy(btn, async () => {
                        try {
                            let res;
                            if (type === 'adjust') res = await api.post('/api/inventory/adjust', { productId: p.id, newQuantity: q, note });
                            else {
                                const body = { productId: p.id, quantity: q, note };
                                if (type === 'receive') {
                                    const pr = parseNum(form.querySelector('[name="price"]').value);
                                    if (Number.isNaN(pr) || (pr !== null && pr < 0)) { fieldError(form, 'price', 'Введите цену числом'); return; }
                                    body.unitPrice = pr;
                                } else body.recipient = form.querySelector('[name="recipient"]').value.trim() || null;
                                res = await api.post(`/api/inventory/${type}`, body);
                            }
                            result = res;
                            toast(`${op.ok}: ${res.name} — теперь ${num(res.quantity)} ${res.unit}`);
                            state.refreshCounts();
                            close();
                        } catch (e) { toast(e.message, 'err'); }
                    });
                };
                el.querySelector('[data-save]').addEventListener('click', e => save(e.currentTarget));
                form.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(el.querySelector('[data-save]')); } });
            },
            onClose: () => resolve(result),
        });
    });
}

// ------------------------------------------------------------------ добавить товар в список

export async function addToListDialog(p) {
    const open = await api.get('/api/lists?status=DRAFT,PENDING,PARTIAL');
    return new Promise(resolve => {
        let done = false;
        modal({
            title: 'Добавить в список',
            body: `
                <div class="op-product">${miniImg(p.imageUrl, p.name, 'lg', p.categoryColor)}
                  <div class="grow" style="min-width:0"><div class="strong ellipsis">${esc(p.name)}</div>
                  <div class="small muted">${money(p.purchasePrice)} · на складе ${num(p.quantity)} ${esc(p.unit)}</div></div></div>
                <form class="form-grid" novalidate>
                    <div class="field span-2"><label>Список</label><div data-dd="list"></div></div>
                    <div class="field span-2" data-newname ${open.length ? 'hidden' : ''}><label for="al_name">Название нового списка</label>
                        <input class="input" id="al_name" name="listName" autocomplete="off" placeholder="Например: Поставка на объект"></div>
                    <div class="field span-2"><label for="al_qty">Сколько нужно</label>
                        <div class="input-wrap"><input class="input" id="al_qty" name="qty" inputmode="decimal" value="1" autocomplete="off">
                        <span class="suffix">${esc(p.unit)}</span></div></div>
                </form>`,
            foot: `<button class="btn" type="button" data-close>Отмена</button>
                   <button class="btn primary" type="button" data-save>${icon('list-plus')}Добавить</button>`,
            onMount(el, close) {
                const form = el.querySelector('form');
                const opts = [{ value: 'new', label: '+ Новый список' }, ...open.map(l => ({ value: l.id, label: `${l.name} · ${LIST_TITLES[l.status]}` }))];
                const dd = dropdown(el.querySelector('[data-dd="list"]'), {
                    options: opts, value: open.length ? open[0].id : 'new',
                    onChange: v => { el.querySelector('[data-newname]').hidden = v !== 'new'; },
                });
                el.querySelector('[data-save]').addEventListener('click', async e => {
                    clearErrors(form);
                    const q = parseNum(form.querySelector('[name="qty"]').value);
                    if (q === null || Number.isNaN(q) || q <= 0) { fieldError(form, 'qty', 'Укажите количество больше нуля'); return; }
                    await busy(e.currentTarget, async () => {
                        try {
                            let listId;
                            if (dd.value === 'new') {
                                const name = form.querySelector('[name="listName"]').value.trim();
                                if (!name) { fieldError(form, 'listName', 'Введите название списка'); return; }
                                listId = (await api.post('/api/lists', { name, status: 'PENDING', items: [{ productId: p.id, requiredQty: q }] })).id;
                            } else {
                                const d = await api.get(`/api/lists/${dd.value}`);
                                const items = d.items.map(i => ({ productId: i.productId, requiredQty: i.requiredQty, note: i.note }));
                                const ex = items.find(i => i.productId === p.id);
                                if (ex) ex.requiredQty = Number(ex.requiredQty) + q;
                                else items.push({ productId: p.id, requiredQty: q });
                                const s = d.summary;
                                await api.put(`/api/lists/${s.id}`, { name: s.name, recipient: s.recipient, notes: s.notes, items });
                                listId = s.id;
                            }
                            done = true;
                            toast('Товар добавлен в список');
                            state.refreshCounts();
                            close();
                            resolve(listId);
                        } catch (err) { toast(err.message, 'err'); }
                    });
                });
            },
            onClose: () => { if (!done) resolve(null); },
        });
    });
}

// ------------------------------------------------------------------ категория

export const CATEGORY_COLORS = ['#2343B8', '#0F9E99', '#6A4BD1', '#C2410C', '#0E7490', '#B45309', '#15803D', '#BE185D', '#475569', '#A16207'];

export function categoryForm(existing = null) {
    let color = existing?.color || CATEGORY_COLORS[0];
    return new Promise(resolve => {
        let saved = false;
        modal({
            title: existing ? 'Изменить категорию' : 'Новая категория',
            body: `<form class="stack" novalidate>
                <div class="field"><label for="c_name">Название</label>
                    <input class="input" id="c_name" name="name" value="${esc(existing?.name || '')}" placeholder="Например: Сантехника" autocomplete="off" autofocus></div>
                <div class="field"><label for="c_desc">Описание <span class="muted" style="font-weight:500">(необязательно)</span></label>
                    <input class="input" id="c_desc" name="description" value="${esc(existing?.description || '')}" autocomplete="off"></div>
                <div class="field"><label>Цвет</label><div class="color-swatches">${CATEGORY_COLORS.map(c =>
                    `<button type="button" class="swatch ${c === color ? 'on' : ''}" style="--c:${c}" data-color="${c}" aria-label="Цвет ${c}"></button>`).join('')}</div></div>
            </form>`,
            foot: `<button class="btn" type="button" data-close>Отмена</button>
                   <button class="btn primary" type="button" data-save>${icon('check')}${existing ? 'Сохранить' : 'Создать категорию'}</button>`,
            onMount(el, close) {
                const form = el.querySelector('form');
                el.querySelector('.color-swatches').addEventListener('click', e => {
                    const b = e.target.closest('[data-color]');
                    if (!b) return;
                    color = b.dataset.color;
                    el.querySelectorAll('.swatch').forEach(s => s.classList.toggle('on', s === b));
                });
                const save = async btn => {
                    clearErrors(form);
                    const name = form.querySelector('[name="name"]').value.trim();
                    if (!name) { fieldError(form, 'name', 'Введите название'); return; }
                    const body = { name, description: form.querySelector('[name="description"]').value.trim() || null, color };
                    await busy(btn, async () => {
                        try {
                            if (existing) await api.put(`/api/categories/${existing.id}`, body);
                            else await api.post('/api/categories', body);
                            saved = true;
                            invalidateCategories();
                            toast(existing ? 'Категория сохранена' : `Категория «${name}» создана`);
                            close();
                        } catch (e) { fieldError(form, 'name', e.message); }
                    });
                };
                el.querySelector('[data-save]').addEventListener('click', e => save(e.currentTarget));
                form.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(el.querySelector('[data-save]')); } });
            },
            onClose: () => resolve(saved),
        });
    });
}
