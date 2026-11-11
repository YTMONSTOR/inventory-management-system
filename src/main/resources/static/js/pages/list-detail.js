// Просмотр списка, выдача товаров по списку и печать.
import { api, download } from '../api.js';
import {
    icon, esc, num, money, date, dateTime, listPill, miniImg, empty, toast, busy, parseNum, confirmDialog, modal,
    skeletonTable, plural, LIST_TITLES, getCurrency,
} from '../ui.js';
import { ring, ribbon } from '../charts.js';
import { state } from '../state.js';

export async function render(ctx) {
    const { el, params, isCurrent } = ctx;
    const id = Number(params[0]);
    const mode = params[1] || 'view';
    el.innerHTML = skeletonTable(6);
    let d = await api.get(`/api/lists/${id}`);
    if (!isCurrent()) return;
    if (mode === 'print') return renderPrint(el, d);
    if (mode === 'issue') return renderIssue(el, d, isCurrent);
    return renderView(el, d, isCurrent);
}

// ------------------------------------------------------------------ просмотр

function renderView(el, d, isCurrent) {
    const id = d.summary.id;

    function draw() {
        const s = d.summary;
        const open = ['DRAFT', 'PENDING', 'PARTIAL'].includes(s.status);
        const remainingAmount = d.items.reduce((a, i) => a + Number(i.remainingQty) * Number(i.unitPrice), 0);
        const canIssueAny = d.items.some(i => Number(i.canIssueQty) > 0);
        const shortage = d.items.filter(i => i.shortage && Number(i.remainingQty) > 0);
        el.innerHTML = `
        <div class="crumbs"><a href="#/lists">Списки к выдаче</a>${icon('chevron-right', 'sm')}<span class="ellipsis">${esc(s.name)}</span></div>
        <div class="page-head">
            <div style="min-width:0"><h1 class="page-title">${esc(s.name)}</h1>
                <p class="page-sub row wrap" style="gap:10px">${listPill(s.status)}<span>Создан ${esc(dateTime(s.createdAt))}</span>${s.recipient ? `<span>· для: <b style="color:var(--ink)">${esc(s.recipient)}</b></span>` : ''}</p></div>
            <div class="page-actions">
                ${open ? `<a class="btn" href="#/lists/${id}/edit">${icon('edit')}Изменить</a>` : ''}
                <a class="btn" href="#/lists/${id}/print">${icon('printer')}Печать</a>
                ${open && s.status !== 'DRAFT' ? `<a class="btn primary" href="#/lists/${id}/issue" ${canIssueAny ? '' : 'aria-disabled="true"'}>${icon('arrow-out')}Выдать несколько</a>` : ''}
                ${s.status === 'DRAFT' ? `<button class="btn primary" type="button" data-act="publish">${icon('check')}Готов к выдаче</button>` : ''}
            </div>
        </div>

        ${s.status === 'DRAFT' ? `<div class="alert info" style="margin-bottom:18px">${icon('note')}<div>Это черновик. Когда список будет готов, нажмите «Готов к выдаче» — и можно будет выдавать товары.</div></div>` : ''}
        ${open && s.status !== 'DRAFT' && shortage.length ? `<div class="alert warn" style="margin-bottom:18px">${icon('alert')}<div>Для ${shortage.length} ${plural(shortage.length, 'позиции', 'позиций', 'позиций')} на складе меньше, чем осталось выдать. Их можно выдать частично сейчас, а остальное — после прихода.</div></div>` : ''}

        <div class="card list-hero">
            ${ring(s.progress)}
            <div class="grow" style="min-width:0;width:100%">
                <div class="progress-label"><span>${s.status === 'COMPLETED' ? 'Список выдан полностью' : s.status === 'CANCELLED' ? 'Список отменён' : 'Выдача по позициям'}</span>
                    <b>${d.items.filter(i => Number(i.remainingQty) <= 0).length} из ${d.items.length} ${plural(d.items.length, 'позиции', 'позиций', 'позиций')}</b></div>
                ${ribbon(d.items, true)}
                <div class="meta">
                    <div><div class="k">Сумма списка</div><div class="v num">${money(s.amountTotal)}</div></div>
                    <div><div class="k">Выдано на сумму</div><div class="v num">${money(s.issuedAmount)}</div></div>
                    <div><div class="k">Осталось выдать</div><div class="v num">${money(remainingAmount)}</div></div>
                    <div><div class="k">Выдач</div><div class="v num">${d.issues.length}</div></div>
                </div>
            </div>
        </div>

        ${itemsSection(d, open && s.status !== 'DRAFT', open)}

        ${s.notes ? `<div class="card pad" style="margin-top:20px"><div class="label" style="margin-bottom:6px">Заметки</div><p style="white-space:pre-line;color:var(--ink-2)">${esc(s.notes)}</p></div>` : ''}

        <div class="card" style="margin-top:20px">
            <div class="card-head"><h2 class="section-title">История выдачи</h2></div>
            ${d.issues.length ? d.issues.map((r, n) => issueBlock(r, n === 0)).join('')
                : empty({ art: 'clock', title: 'Выдач ещё не было', text: s.status === 'DRAFT' ? 'Сначала отметьте список как готовый к выдаче.' : 'Нажмите «Выдать» у товара, когда будете его отпускать.', compact: true })}
        </div>

        <div class="row wrap" style="margin-top:20px;gap:10px">
            <button class="btn sm" type="button" data-act="duplicate">${icon('copy')}Создать копию</button>
            ${s.status === 'PENDING' ? `<button class="btn sm" type="button" data-act="to-draft">${icon('undo')}Вернуть в черновики</button>` : ''}
            ${s.status === 'CANCELLED' ? `<button class="btn sm" type="button" data-act="restore">${icon('refresh')}Восстановить</button>` : ''}
            <span class="grow"></span>
            ${open ? `<button class="btn sm ghost" type="button" data-act="cancel" style="color:var(--red)">${icon('ban')}Отменить список</button>` : ''}
            ${d.issues.length === 0 && s.status !== 'COMPLETED' ? `<button class="btn sm ghost" type="button" data-act="delete" style="color:var(--red)">${icon('trash')}Удалить</button>` : ''}
        </div>`;
    }

    async function setStatus(status, okText) {
        try { d = await api.post(`/api/lists/${id}/status`, { status }); toast(okText); state.refreshCounts(); draw(); }
        catch (e) { toast(e.message, 'err'); }
    }

    async function onClick(e) {
        const ib = e.target.closest('[data-issue-toggle]');
        if (ib) { ib.closest('.issue-block').classList.toggle('open'); return; }
        const dl = e.target.closest('[data-dl]');
        if (dl) {
            await busy(dl, async () => {
                try { await download(`/api/lists/${id}/export?format=${dl.dataset.dl}`); } catch (err) { toast(err.message, 'err'); }
            });
            return;
        }
        const one = e.target.closest('[data-issue-one]');
        if (one) {
            const item = d.items.find(i => i.id === Number(one.dataset.issueOne));
            const res = await issueOneDialog(id, item);
            if (res) { d = res; draw(); state.refreshCounts(); }
            return;
        }
        const dis = e.target.closest('[aria-disabled="true"]');
        if (dis) { e.preventDefault(); toast('Сейчас нечего выдавать: нужных товаров нет на складе', 'err'); return; }
        const a = e.target.closest('[data-act]');
        if (!a) return;
        const s = d.summary;
        switch (a.dataset.act) {
            case 'publish': await setStatus('PENDING', 'Список готов к выдаче'); break;
            case 'to-draft': await setStatus('DRAFT', 'Список перенесён в черновики'); break;
            case 'restore': await setStatus('PENDING', 'Список восстановлен'); break;
            case 'cancel':
                if (await confirmDialog({ title: `Отменить список «${esc(s.name)}»?`, danger: true, ok: 'Отменить список', iconName: 'ban',
                    text: s.status === 'PARTIAL' ? 'Уже выданные товары останутся выданными, остальное больше не будет ожидать выдачи. Отменённый список можно восстановить.'
                        : 'Товары не будут ожидать выдачи. Отменённый список можно восстановить.' })) await setStatus('CANCELLED', 'Список отменён');
                break;
            case 'delete':
                if (await confirmDialog({ title: `Удалить список «${esc(s.name)}»?`, danger: true, ok: 'Удалить навсегда', text: 'Список будет удалён без возможности восстановления.' })) {
                    try { await api.del(`/api/lists/${id}`); toast('Список удалён'); state.refreshCounts(); location.hash = '#/lists'; }
                    catch (err) { toast(err.message, 'err'); }
                }
                break;
            case 'duplicate':
                try { const r = await api.post(`/api/lists/${id}/duplicate`); toast('Копия создана как черновик'); location.hash = `#/lists/${r.id}/edit`; }
                catch (err) { toast(err.message, 'err'); }
                break;
        }
    }
    draw();
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
}

// ------------------------------------------------------------------ товары списка: ждут выдачи / уже выдано

function itemsSection(d, canIssue, open) {
    const id = d.summary.id;
    const waiting = d.items.filter(i => Number(i.remainingQty) > 0);
    const done = d.items.filter(i => Number(i.remainingQty) <= 0);
    if (!d.items.length) {
        return `<div class="card" style="margin-top:20px">${empty({ art: 'list', title: 'В списке нет товаров', text: 'Откройте редактирование, чтобы добавить товары.', compact: true,
            action: open ? `<a class="btn primary sm" href="#/lists/${id}/edit">Добавить товары</a>` : '' })}</div>`;
    }
    const head = `<div class="right"><button class="btn xs" type="button" data-dl="xlsx">${icon('sheet')}Excel</button><button class="btn xs" type="button" data-dl="pdf">${icon('pdf')}PDF</button></div>`;

    const waitRow = i => {
        const part = Number(i.issuedQty) > 0;
        const can = Number(i.canIssueQty);
        let action;
        if (!canIssue) action = '';
        else if (can <= 0) action = `<span class="pill plain OUT">Нет на складе</span>`;
        else action = `<button class="btn sm primary" type="button" data-issue-one="${i.id}">${icon('arrow-out')}Выдать</button>`;
        return `<div class="li-row">
            <a class="prod" href="#/products/${i.productId}">${miniImg(i.imageUrl, i.productName, 'lg')}<div style="min-width:0">
                <div class="name">${esc(i.productName)}</div>
                <div class="sub">${money(i.unitPrice)} за ${esc(i.unit)}${i.note ? ' · ' + esc(i.note) : ''}</div></div></a>
            <div class="li-qty"><div class="v num">${num(i.remainingQty)} <span class="muted small">${esc(i.unit)}</span></div>
                <div class="k">${part ? `выдано ${num(i.issuedQty)} из ${num(i.requiredQty)}` : 'нужно выдать'}</div></div>
            <div class="li-qty"><div class="v num ${i.shortage && canIssue ? 'shortage' : ''}">${num(i.stock)}</div><div class="k">на складе</div></div>
            <div class="li-qty hide-sm"><div class="v num">${money(Number(i.remainingQty) * Number(i.unitPrice))}</div><div class="k">сумма</div></div>
            <div class="li-act">${action}</div>
        </div>`;
    };
    const doneRow = i => `<div class="li-row done">
            <span class="li-check">${icon('check')}</span>
            <a class="prod" href="#/products/${i.productId}">${miniImg(i.imageUrl, i.productName, 'lg')}<div style="min-width:0">
                <div class="name">${esc(i.productName)}</div>
                <div class="sub">${money(i.unitPrice)} за ${esc(i.unit)}</div></div></a>
            <div class="li-qty"><div class="v num">${num(i.issuedQty)} <span class="muted small">${esc(i.unit)}</span></div><div class="k">выдано</div></div>
            <div class="li-qty hide-sm"><div class="v num">${money(i.lineTotal)}</div><div class="k">сумма</div></div>
            <div class="li-act"><span class="pill COMPLETED">Выдано${i.lastIssuedAt ? ' ' + esc(dateTime(i.lastIssuedAt)) : ''}</span></div>
        </div>`;

    return `
    <div class="card" style="margin-top:20px">
        <div class="card-head"><h2 class="section-title">Ждут выдачи</h2><span class="muted small">${waiting.length} ${plural(waiting.length, 'позиция', 'позиции', 'позиций')}</span>${head}</div>
        ${waiting.length ? `<div class="li-list">${waiting.map(waitRow).join('')}</div>`
            : empty({ art: 'ok', title: 'Всё выдано', text: 'По этому списку больше нечего выдавать.', compact: true })}
    </div>
    ${done.length ? `<div class="card li-done-card" style="margin-top:20px">
        <div class="card-head"><span class="li-check sm">${icon('check', 'sm')}</span><h2 class="section-title">Уже выдано</h2>
            <span class="muted small">${done.length} ${plural(done.length, 'позиция', 'позиции', 'позиций')}</span></div>
        <div class="li-list">${done.map(doneRow).join('')}</div>
    </div>` : ''}`;
}

/** Выдача одного товара из списка — прямо со страницы списка. */
function issueOneDialog(listId, item) {
    const max = Number(item.canIssueQty);
    const remaining = Number(item.remainingQty);
    return new Promise(resolve => {
        let result = null;
        modal({
            title: 'Выдать товар',
            body: `
                <div class="op-product">${miniImg(item.imageUrl, item.productName, 'lg')}
                    <div class="grow" style="min-width:0"><div class="strong ellipsis">${esc(item.productName)}</div>
                    <div class="small muted">осталось выдать <b style="color:var(--ink)">${num(remaining)} ${esc(item.unit)}</b> · на складе ${num(item.stock)}</div></div></div>
                <div class="field"><label for="one_qty">Сколько выдаёте сейчас</label>
                    <div class="row" style="gap:12px;flex-wrap:wrap">
                        <div class="stepper" data-st><button type="button" data-d="-1" aria-label="Меньше">−</button>
                            <input id="one_qty" inputmode="decimal" value="${esc(String(max).replace('.', ','))}" autocomplete="off">
                            <button type="button" data-d="1" aria-label="Больше">+</button></div>
                        <span class="muted">${esc(item.unit)}</span>
                    </div>
                    <div class="error" data-err></div>
                </div>
                ${max < remaining ? `<div class="alert warn" style="margin-top:14px">${icon('alert')}<div class="small">На складе только ${num(item.stock)} ${esc(item.unit)}. Остальное можно выдать после прихода.</div></div>` : ''}
                <div class="op-preview" data-after></div>`,
            foot: `<button class="btn" type="button" data-close>Отмена</button>
                   <button class="btn primary" type="button" data-ok>${icon('check')}Выдать</button>`,
            onMount(el, close) {
                const inp = el.querySelector('#one_qty');
                const err = el.querySelector('[data-err]');
                const after = el.querySelector('[data-after]');
                const read = () => parseNum(inp.value);
                const check = () => {
                    const v = read();
                    let msg = '';
                    if (v === null || Number.isNaN(v) || v <= 0) msg = 'Введите количество больше нуля';
                    else if (v > remaining) msg = `По списку осталось выдать только ${num(remaining)}`;
                    else if (v > Number(item.stock)) msg = `На складе только ${num(item.stock)}`;
                    err.textContent = msg;
                    el.querySelector('[data-st]').classList.toggle('invalid', !!msg);
                    after.innerHTML = msg ? '' : (v >= remaining
                        ? `<span style="color:var(--green)">${icon('check-circle')}</span><span>Товар будет отмечен как выданный</span>`
                        : `<span class="muted">После выдачи останется:</span><span class="num">${num(remaining - v)} ${esc(item.unit)}</span>`);
                    return !msg;
                };
                el.querySelector('[data-st]').addEventListener('click', e => {
                    const b = e.target.closest('[data-d]'); if (!b) return;
                    let v = (read() || 0) + Number(b.dataset.d);
                    v = Math.max(0, Math.min(max, +v.toFixed(3)));
                    inp.value = String(v).replace('.', ','); check();
                });
                inp.addEventListener('input', check);
                const go = async btn => {
                    if (!check()) { inp.focus(); return; }
                    await busy(btn, async () => {
                        try {
                            result = await api.post(`/api/lists/${listId}/issue`, { items: [{ itemId: item.id, quantity: read() }] });
                            toast(result.summary.status === 'COMPLETED' ? 'Готово! Весь список выдан'
                                : read() >= remaining ? `«${item.productName}» выдан` : `Выдано ${num(read())} ${item.unit}`);
                            close();
                        } catch (e) { err.textContent = e.message; }
                    });
                };
                el.querySelector('[data-ok]').addEventListener('click', e => go(e.currentTarget));
                inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(el.querySelector('[data-ok]')); } });
                check();
                setTimeout(() => inp.select(), 80);
            },
            onClose: () => resolve(result),
        });
    });
}

export function issueBlock(r, openFirst = false, withList = false) {
    return `<div class="issue-block ${openFirst ? 'open' : ''}">
        <button type="button" class="issue-summary" data-issue-toggle>
            <span class="caret">${icon('chevron-right', 'sm')}</span>
            <span class="feed-icon tone-lapis">${icon('arrow-out')}</span>
            <div class="grow" style="min-width:0"><div class="strong">${esc(dateTime(r.createdAt))}${withList && r.listName ? ` · ${esc(r.listName)}` : ''}</div>
            <div class="small muted">${r.lineCount} ${plural(r.lineCount, 'позиция', 'позиции', 'позиций')}${r.recipient ? ` · кому: ${esc(r.recipient)}` : ''}${r.note ? ` · ${esc(r.note)}` : ''}${r.userName ? ` · ${esc(r.userName)}` : ''}</div></div>
            <b class="num">${money(r.totalAmount)}</b>
        </button>
        <div class="issue-lines">${r.lines.map(m => `<div class="issue-line">${miniImg(m.imageUrl, m.productName, 'sm')}
            <a class="grow ellipsis" href="#/products/${m.productId}" style="color:var(--ink);font-weight:600">${esc(m.productName)}</a>
            <span class="num qty-neg">−${num(Math.abs(m.quantity))} ${esc(m.unit)}</span><span class="num muted" style="min-width:110px;text-align:right">${money(m.amount)}</span></div>`).join('')}</div>
    </div>`;
}

// ------------------------------------------------------------------ выдача

function renderIssue(el, d, isCurrent) {
    const id = d.summary.id;
    const s = d.summary;
    if (!['PENDING', 'PARTIAL', 'DRAFT'].includes(s.status)) {
        el.innerHTML = `<div class="card">${empty({ art: 'ok', title: s.status === 'COMPLETED' ? 'Список уже выдан полностью' : 'Список отменён',
            text: 'Выдача по нему больше не нужна.', action: `<a class="btn primary" href="#/lists/${id}">Открыть список</a>` })}</div>`;
        return;
    }
    const rows = d.items.filter(i => Number(i.remainingQty) > 0);
    const qty = new Map(rows.map(i => [i.id, Number(i.canIssueQty)]));

    el.innerHTML = `
    <div class="crumbs"><a href="#/lists">Списки к выдаче</a>${icon('chevron-right', 'sm')}<a href="#/lists/${id}">${esc(s.name)}</a>${icon('chevron-right', 'sm')}<span>Выдача</span></div>
    <div class="page-head"><div><h1 class="page-title">Выдача товаров</h1>
        <p class="page-sub">Список «${esc(s.name)}». Проверьте количество и нажмите «Выдать». Можно выдать всё или только часть.</p></div>
        <div class="page-actions"><button class="btn" type="button" data-fill="all">${icon('check')}Всё доступное</button>
            <button class="btn" type="button" data-fill="none">${icon('x')}Очистить</button></div></div>
    <div class="editor">
        <div class="card">
            ${rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Товар</th><th class="right">Осталось выдать</th><th class="right">На складе</th><th>Выдать сейчас</th><th class="right">Сумма</th></tr></thead><tbody>
            ${rows.map(i => `<tr data-row="${i.id}">
                <td><div class="prod">${miniImg(i.imageUrl, i.productName, 'lg')}<div><div class="name">${esc(i.productName)}</div>
                    <div class="sub">${money(i.unitPrice)} за ${esc(i.unit)} · выдано ${num(i.issuedQty)} из ${num(i.requiredQty)}</div></div></div></td>
                <td class="right num strong">${num(i.remainingQty)} ${esc(i.unit)}</td>
                <td class="right num ${i.shortage ? 'shortage' : ''}">${num(i.stock)}${Number(i.stock) <= 0 ? '<div class="small">нет на складе</div>' : i.shortage ? '<div class="small">хватает частично</div>' : ''}</td>
                <td><div class="stepper sm" data-id="${i.id}">
                    <button type="button" data-step="-1" aria-label="Меньше">−</button>
                    <input data-q="${i.id}" inputmode="decimal" value="${esc(String(qty.get(i.id)).replace('.', ','))}" aria-label="Выдать">
                    <button type="button" data-step="1" aria-label="Больше">+</button></div>
                    <div class="small" data-err="${i.id}" style="color:var(--red);margin-top:4px"></div></td>
                <td class="right num strong" data-sum="${i.id}"></td></tr>`).join('')}
            </tbody></table></div>`
            : empty({ art: 'ok', title: 'Всё уже выдано', text: 'По этому списку не осталось невыданных товаров.', compact: true })}
        </div>
        <div class="editor-side stack">
            <div class="card pad stack" style="gap:16px">
                <div class="field"><label for="i_rec">Кому выдаётся</label><input class="input" id="i_rec" data-recipient value="${esc(s.recipient || '')}" placeholder="Необязательно" autocomplete="off"></div>
                <div class="field"><label for="i_note">Примечание</label><input class="input" id="i_note" data-note placeholder="Необязательно" autocomplete="off"></div>
                <div class="divider" style="margin:2px 0"></div>
                <div class="sum-lines" data-summary></div>
                <div class="total-box"><span class="muted strong">К выдаче на сумму</span><span class="v num" data-total></span></div>
                <button class="btn primary block" type="button" data-go style="height:54px;font-size:16px">${icon('arrow-out')}Выдать</button>
                <a class="btn ghost block" href="#/lists/${id}">Отмена</a>
                <p class="small muted">Остаток на складе уменьшится автоматически. Если выдано не всё, список останется в статусе «Выдан частично».</p>
            </div>
        </div>
    </div>`;

    const maxFor = i => Math.min(Number(i.remainingQty), Number(i.stock));
    function validate(i) {
        const v = qty.get(i.id);
        const err = el.querySelector(`[data-err="${i.id}"]`);
        const stp = el.querySelector(`.stepper[data-id="${i.id}"]`);
        let msg = '';
        if (v === null || Number.isNaN(v) || v < 0) msg = 'Введите число';
        else if (v > Number(i.remainingQty)) msg = `Осталось выдать только ${num(i.remainingQty)}`;
        else if (v > Number(i.stock)) msg = `На складе только ${num(i.stock)}`;
        if (err) err.textContent = msg;
        if (stp) stp.classList.toggle('invalid', !!msg);
        return !msg;
    }
    function update() {
        let total = 0, lines = 0, units = 0, ok = true, full = 0;
        rows.forEach(i => {
            const v = qty.get(i.id);
            const good = validate(i);
            ok = ok && good;
            const amount = good && v > 0 ? v * Number(i.unitPrice) : 0;
            const cell = el.querySelector(`[data-sum="${i.id}"]`);
            if (cell) cell.textContent = amount ? money(amount) : '—';
            if (good && v > 0) { total += amount; lines++; units += v; if (v >= Number(i.remainingQty)) full++; }
        });
        const willComplete = lines > 0 && full === rows.length;
        el.querySelector('[data-total]').textContent = money(total);
        el.querySelector('[data-summary]').innerHTML = `
            <div><span>Позиций к выдаче</span><b>${lines} из ${rows.length}</b></div>
            <div><span>Единиц товара</span><b class="num">${num(units)}</b></div>
            <div><span>Статус после выдачи</span><b>${lines === 0 ? '—' : willComplete ? LIST_TITLES.COMPLETED : LIST_TITLES.PARTIAL}</b></div>`;
        const go = el.querySelector('[data-go]');
        go.disabled = !ok || lines === 0;
        return { ok, lines, total, units, willComplete };
    }

    async function submit(btn) {
        const r = update();
        if (!r.ok) { toast('Исправьте количество, отмеченное красным', 'err'); return; }
        if (!r.lines) { toast('Укажите, сколько выдать', 'err'); return; }
        const items = rows.filter(i => qty.get(i.id) > 0).map(i => ({ itemId: i.id, quantity: qty.get(i.id) }));
        const ok = await confirmDialog({
            title: 'Подтвердите выдачу', ok: 'Выдать', iconName: 'arrow-out',
            text: `${items.length} ${plural(items.length, 'позиция', 'позиции', 'позиций')} на сумму <b>${esc(money(r.total))}</b>.<br><br>
                ${items.slice(0, 8).map(x => { const i = rows.find(y => y.id === x.itemId); return `• ${esc(i.productName)} — ${num(x.quantity)} ${esc(i.unit)}`; }).join('<br>')}
                ${items.length > 8 ? `<br>и ещё ${items.length - 8}` : ''}<br><br>
                ${r.willComplete ? 'После этого список будет <b>выдан полностью</b>.' : 'Список останется <b>выданным частично</b> — остальное можно выдать позже.'}`,
        });
        if (!ok) return;
        await busy(btn, async () => {
            try {
                const res = await api.post(`/api/lists/${id}/issue`, {
                    items,
                    recipient: el.querySelector('[data-recipient]').value.trim() || null,
                    note: el.querySelector('[data-note]').value.trim() || null,
                });
                toast(res.summary.status === 'COMPLETED' ? 'Готово! Список выдан полностью' : 'Товары выданы. Список выдан частично');
                state.refreshCounts();
                location.hash = `#/lists/${id}`;
            } catch (e) {
                toast(e.message, 'err');
                // остатки могли измениться — показываем свежие данные
                if (isCurrent()) state.rerender();
            }
        });
    }

    function onClick(e) {
        const f = e.target.closest('[data-fill]');
        if (f) {
            rows.forEach(i => qty.set(i.id, f.dataset.fill === 'all' ? maxFor(i) : 0));
            rows.forEach(i => { const inp = el.querySelector(`[data-q="${i.id}"]`); if (inp) inp.value = String(qty.get(i.id)).replace('.', ','); });
            update(); return;
        }
        const m = e.target.closest('[data-max]');
        if (m) {
            const i = rows.find(x => x.id === Number(m.dataset.max));
            qty.set(i.id, maxFor(i));
            el.querySelector(`[data-q="${i.id}"]`).value = String(maxFor(i)).replace('.', ',');
            update(); return;
        }
        const stp = e.target.closest('[data-step]');
        if (stp) {
            const iid = Number(stp.closest('.stepper').dataset.id);
            const i = rows.find(x => x.id === iid);
            let v = (qty.get(iid) || 0) + Number(stp.dataset.step);
            v = Math.max(0, Math.min(maxFor(i), +v.toFixed(3)));
            qty.set(iid, v);
            el.querySelector(`[data-q="${iid}"]`).value = String(v).replace('.', ',');
            update(); return;
        }
        const go = e.target.closest('[data-go]');
        if (go) submit(go);
    }
    function onInput(e) {
        if (e.target.matches('[data-q]')) {
            const v = parseNum(e.target.value);
            qty.set(Number(e.target.dataset.q), v === null ? 0 : v);
            update();
        }
    }
    if (rows.length) update(); else el.querySelector('[data-go]').disabled = true;
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    return () => { el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); };
}

// ------------------------------------------------------------------ печать

function renderPrint(el, d) {
    const s = d.summary;
    const company = state.settings.company_name || 'Склад';
    el.innerHTML = `
    <div class="row no-print" style="margin-bottom:16px">
        <a class="btn" href="#/lists/${s.id}">${icon('chevron-left')}Назад к списку</a>
        <button class="btn primary" type="button" onclick="window.print()">${icon('printer')}Печать</button>
        <button class="btn" type="button" data-dl="pdf">${icon('pdf')}Скачать PDF</button>
    </div>
    <div class="print-sheet">
        <div style="font-size:12px;color:#556">${esc(company)}</div>
        <h1>${esc(s.name)}</h1>
        <div style="font-size:13px;color:#445">Статус: ${esc(LIST_TITLES[s.status])} · создан ${esc(date(s.createdAt))}${s.recipient ? ` · для: ${esc(s.recipient)}` : ''}</div>
        <table><thead><tr><th class="check">✓</th><th>№</th><th></th><th>Товар</th><th class="r">Цена, ${esc(getCurrency())}</th><th class="r">Нужно</th><th class="r">Выдано</th><th class="r">Осталось</th><th class="r">Сумма</th></tr></thead>
        <tbody>${d.items.map((i, n) => `<tr><td class="check">${Number(i.remainingQty) <= 0 ? '✓' : ''}</td><td>${n + 1}</td>
            <td>${i.imageUrl ? `<img class="img" src="${esc(i.imageUrl)}" alt="">` : ''}</td>
            <td><b>${esc(i.productName)}</b><br><span style="color:#667;font-size:11px">${esc(i.productSku)}</span></td>
            <td class="r">${esc(money(i.unitPrice, false))}</td><td class="r">${num(i.requiredQty)} ${esc(i.unit)}</td>
            <td class="r">${num(i.issuedQty)}</td><td class="r">${num(i.remainingQty)}</td><td class="r">${esc(money(i.lineTotal, false))}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="8" class="r"><b>Итого</b></td><td class="r"><b>${esc(money(s.amountTotal))}</b></td></tr></tfoot></table>
        ${s.notes ? `<p style="margin-top:14px;font-size:13px"><b>Заметки:</b> ${esc(s.notes)}</p>` : ''}
        <div class="sign"><div>Выдал</div><div>Получил</div><div>Дата</div></div>
    </div>`;
    async function onClick(e) {
        const dl = e.target.closest('[data-dl]');
        if (dl) await busy(dl, async () => { try { await download(`/api/lists/${s.id}/export?format=pdf`); } catch (err) { toast(err.message, 'err'); } });
    }
    el.addEventListener('click', onClick);
    setTimeout(() => window.print(), 400);
    return () => el.removeEventListener('click', onClick);
}
