// Умный разбор: вставить текст сообщения клиента → встроенный мини-ИИ находит товары → проверка → в список.
// Работает на сервере без интернета. Выбор пользователя запоминается для следующих разборов.
// Ничего не сохраняет сам: результат переносится в редактор списка, сохраняет пользователь.
import { api } from '../api.js';
import { icon, esc, num, money, miniImg, toast, busy, parseNum, dropdown, modal, plural, confirmDialog, store } from '../ui.js';

const EXAMPLE = 'Ассалому алейкум, это Ойбек\nБуква 3\nМолоко 5\nХлеб 2\nСахар 10\nМасло 4';

const CONF = {
    high: { cls: 'ok', label: 'Найдено точно' },
    medium: { cls: 'warn', label: 'Проверьте' },
    low: { cls: 'warn', label: 'Не уверен' },
    none: { cls: 'bad', label: 'Не найдено' },
};

/**
 * Встраивает блок AI-импорта в контейнер редактора списка.
 * onApply(rows, meta, saveNow) — rows: [{product, qty}], meta: {listName, recipient}
 */
export function mountAiImport(root, { byId, open = true, onApply }) {
    const S = { mode: 'input', text: store.get('aiDraft', ''), rows: [], meta: {}, status: null, open };

    root.className = 'card ai-card';
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('keydown', onKey);

    api.get('/api/lists/ai-status').then(s => { S.status = s; draw(); }).catch(() => { S.status = { enabled: false }; draw(); });
    draw();

    function head() {
        return `<div class="card-head ai-head" ${S.mode === 'input' ? 'data-ai="toggle"' : ''}>
            <span class="ai-badge">${icon('sparkle')}</span>
            <div class="grow" style="min-width:0"><h2 class="section-title">Вставить список из сообщения</h2>
                <div class="small muted">Скопируйте сообщение из Telegram или WhatsApp — встроенный ИИ найдёт товары в каталоге</div></div>
            ${S.mode === 'input' ? `<span class="ai-chev ${S.open ? 'on' : ''}">${icon('chevron-down', 'sm')}</span>` : ''}
        </div>`;
    }

    function draw() {
        if (S.mode === 'loading') { root.innerHTML = head() + loadingView(); return; }
        if (S.mode === 'review') { root.innerHTML = head() + reviewView(); mountChoosers(); return; }
        root.innerHTML = head() + (S.open ? inputView() : '');
        const ta = root.querySelector('[data-ai-text]');
        if (ta && S.open) autoGrow(ta);
    }

    // ---------------------------------------------------------------- ввод текста

    function inputView() {
        const disabled = S.status && !S.status.enabled;
        return `<div class="card-body ai-body">
            ${disabled ? `<div class="alert warn" style="margin-bottom:14px">${icon('info')}<div class="small">
                Разбор сообщений сейчас недоступен — обновите страницу. Товары можно добавить вручную ниже.</div></div>` : ''}
            <textarea class="textarea ai-text" data-ai-text rows="6" placeholder="Например:
Буква 3
Молоко 5
Хлеб 2" ${disabled ? 'disabled' : ''}>${esc(S.text)}</textarea>
            <div class="row wrap ai-actions">
                <button class="btn primary" type="button" data-ai="analyze" ${disabled ? 'disabled' : ''}>${icon('sparkle')}Анализировать</button>
                ${S.text ? `<button class="btn ghost" type="button" data-ai="clear">Очистить</button>`
                    : `<button class="btn ghost" type="button" data-ai="example">Показать пример</button>`}
                <span class="small muted grow" style="text-align:right">Ничего не сохраняется, пока вы не проверите и не нажмёте «Сохранить»</span>
            </div>
        </div>`;
    }

    function loadingView() {
        const lines = S.text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 6);
        return `<div class="card-body ai-body">
            <div class="ai-reading">${icon('sparkle')}<span>Читаю сообщение и ищу товары в каталоге…</span></div>
            <div class="ai-rows">${lines.map((l, i) => `<div class="ai-row loading" style="animation-delay:${i * 90}ms">
                <span class="mini-img lg sk"></span><div class="grow"><div class="sk sk-line" style="width:${40 + (i * 17) % 35}%"></div>
                <div class="small muted ai-src">«${esc(l)}»</div></div><div class="sk" style="width:110px;height:38px"></div></div>`).join('')}</div>
        </div>`;
    }

    // ---------------------------------------------------------------- проверка результата

    function reviewView() {
        const active = S.rows.filter(r => !r.skip);
        const ready = active.filter(r => r.productId);
        const check = active.filter(r => r.productId && r.confidence !== 'high' && !r.confirmed).length;
        const missing = active.filter(r => !r.productId).length;
        const total = ready.reduce((s, r) => s + r.qty * Number(byId.get(r.productId).purchasePrice), 0);
        return `<div class="card-body ai-body">
            <div class="ai-summary">
                <div class="ai-stat"><b class="num">${ready.length}</b><span>${plural(ready.length, 'товар найден', 'товара найдено', 'товаров найдено')}</span></div>
                ${check ? `<div class="ai-stat warn"><b class="num">${check}</b><span>проверьте</span></div>` : ''}
                ${missing ? `<div class="ai-stat bad"><b class="num">${missing}</b><span>не ${plural(missing, 'найден', 'найдено', 'найдено')}</span></div>` : ''}
                <div class="ai-stat grow" style="text-align:right"><b class="num">${money(total)}</b><span>сумма</span></div>
            </div>
            ${S.meta.recipient ? `<div class="small muted" style="margin:-4px 0 12px">Клиент из сообщения: <b style="color:var(--ink)">${esc(S.meta.recipient)}</b></div>` : ''}
            <div class="ai-rows">${S.rows.map(rowView).join('')}</div>
            <div class="ai-foot">
                <button class="btn ghost" type="button" data-ai="back">${icon('edit')}Изменить текст</button>
                <span class="grow"></span>
                <button class="btn" type="button" data-ai="apply" ${ready.length ? '' : 'disabled'}>${icon('list-plus')}Перенести и дописать</button>
                <button class="btn primary" type="button" data-ai="save" ${ready.length ? '' : 'disabled'}>${icon('check')}Сохранить список</button>
            </div>
        </div>`;
    }

    function rowView(r, i) {
        const p = r.productId ? byId.get(r.productId) : null;
        const conf = r.skip ? { cls: 'skip', label: 'Не добавлять' } : r.confirmed ? CONF.high : CONF[r.confidence] || CONF.low;
        const short = p && r.qty > Number(p.quantity);
        return `<div class="ai-row ${r.skip ? 'skip' : conf.cls}" data-ai-i="${i}">
            ${p ? miniImg(p.imageUrl, p.name, 'lg', p.categoryColor) : `<span class="mini-img lg ai-missing">${icon('search')}</span>`}
            <div class="ai-main">
                <div class="ai-choose" data-choose="${i}"></div>
                <div class="ai-meta"><span class="ai-src">из сообщения: «${esc(r.sourceText || r.itemName || '')}»</span>
                    <span class="ai-conf ${conf.cls}">${esc(conf.label)}</span></div>
                ${r.warning && !r.skip && !r.confirmed ? `<div class="ai-warn">${icon('alert', 'sm')}${esc(r.warning)}</div>` : ''}
            </div>
            <div class="ai-qty">
                <div class="stepper sm ${r.qtyBad ? 'invalid' : ''}"><button type="button" data-ai-step="-1" data-ai-row="${i}" aria-label="Меньше">−</button>
                    <input value="${esc(String(r.qty).replace('.', ','))}" inputmode="decimal" data-ai-qty="${i}" aria-label="Количество" ${r.skip || !p ? 'disabled' : ''}>
                    <button type="button" data-ai-step="1" data-ai-row="${i}" aria-label="Больше">+</button></div>
                <span class="small muted">${esc(p ? p.unit : (r.unit || ''))}</span>
            </div>
            <div class="ai-price">${p ? `<div class="num strong">${money(r.qty * Number(p.purchasePrice))}</div>
                <div class="small ${short ? 'shortage' : 'muted'}">на складе ${num(p.quantity)} ${esc(p.unit)}</div>` : ''}</div>
            <button class="icon-btn sm" type="button" data-ai-skip="${i}" title="${r.skip ? 'Вернуть' : 'Не добавлять'}" aria-label="${r.skip ? 'Вернуть' : 'Не добавлять'}">${icon(r.skip ? 'undo' : 'x', 'sm')}</button>
        </div>`;
    }

    function mountChoosers() {
        S.rows.forEach((r, i) => {
            const box = root.querySelector(`[data-choose="${i}"]`);
            if (!box) return;
            const ids = [r.productId, ...r.alternativeIds].filter((x, k, a) => x && a.indexOf(x) === k && byId.has(x));
            const options = ids.map(id => ({ value: id, label: byId.get(id).name, color: byId.get(id).categoryColor }));
            options.push({ value: '__other', label: 'Найти другой товар…' });
            dropdown(box, {
                options, value: r.productId || '', small: true,
                placeholder: r.alternativeIds.length ? 'Выберите товар из похожих' : 'Выберите товар',
                onChange: async v => {
                    if (v === '__other') {
                        const p = await pickProduct(r.itemName || r.sourceText || '');
                        if (p) { r.productId = p.id; if (!r.alternativeIds.includes(p.id)) r.alternativeIds.unshift(p.id); r.confirmed = true; r.skip = false; }
                    } else { r.productId = Number(v); r.confirmed = true; r.skip = false; }
                    draw();
                },
            });
        });
    }

    /** Окно поиска по всему каталогу — если нужного товара нет среди вариантов AI. */
    function pickProduct(query) {
        return new Promise(resolve => {
            let chosen = null;
            const all = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
            modal({
                title: 'Выберите товар',
                body: `<div class="input-wrap" style="margin-bottom:10px"><span class="prefix-icon">${icon('search', 'sm')}</span>
                    <input class="input" type="search" data-pq value="${esc(query)}" autocomplete="off" autofocus></div>
                    <div class="picker-results" data-pl style="max-height:52vh"></div>`,
                onMount(el, close) {
                    const list = el.querySelector('[data-pl]'), inp = el.querySelector('[data-pq]');
                    const drawList = () => {
                        const q = inp.value.trim().toLowerCase();
                        const words = q.split(/\s+/).filter(Boolean);
                        let res = all.filter(p => !words.length || words.some(w => [p.name, p.sku, p.barcode].some(v => v && v.toLowerCase().includes(w))));
                        if (!res.length) res = all;
                        list.innerHTML = res.slice(0, 80).map(p => `<button type="button" class="pick" data-pid="${p.id}">${miniImg(p.imageUrl, p.name, '', p.categoryColor)}
                            <div class="grow" style="min-width:0"><div class="name ellipsis">${esc(p.name)}</div><div class="sub">${money(p.purchasePrice)} · на складе ${num(p.quantity)} ${esc(p.unit)}</div></div>
                            <span class="add">${icon('check', 'sm')}</span></button>`).join('');
                    };
                    inp.addEventListener('input', drawList);
                    list.addEventListener('click', e => { const b = e.target.closest('[data-pid]'); if (b) { chosen = byId.get(Number(b.dataset.pid)); close(); } });
                    drawList();
                },
                onClose: () => resolve(chosen),
            });
        });
    }

    // ---------------------------------------------------------------- действия

    async function analyze(btn) {
        const text = S.text.trim();
        if (!text) { toast('Вставьте текст сообщения', 'err'); root.querySelector('[data-ai-text]')?.focus(); return; }
        S.mode = 'loading'; draw();
        try {
            const res = await api.post('/api/lists/ai-parse', { text });
            res.products.forEach(p => { if (!byId.has(p.id)) byId.set(p.id, p); });
            S.meta = { listName: res.listName, recipient: res.recipient };
            S.rows = res.items.map(it => ({
                sourceText: it.sourceText, itemName: it.itemName, qty: Number(it.quantity), unit: it.unit,
                productId: it.productId && byId.has(it.productId) ? it.productId : null,
                alternativeIds: it.alternativeIds.filter(id => byId.has(id)),
                confidence: it.confidence, warning: it.warning, confirmed: false, skip: false,
            }));
            if (!S.rows.length) {
                S.mode = 'input'; draw();
                toast('В сообщении не найдено ни одного товара', 'err');
                return;
            }
            S.mode = 'review'; draw();
            root.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {
            S.mode = 'input'; S.open = true; draw();
            toast(e.message, 'err');
        }
    }

    async function apply(saveNow) {
        const bad = S.rows.find(r => !r.skip && r.productId && !(r.qty > 0));
        if (bad) { toast('Исправьте количество, отмеченное красным', 'err'); return; }
        const rows = S.rows.filter(r => !r.skip && r.productId).map(r => ({ product: byId.get(r.productId), qty: r.qty }));
        const missing = S.rows.filter(r => !r.skip && !r.productId);
        const unchecked = S.rows.filter(r => !r.skip && r.productId && (r.confidence === 'low') && !r.confirmed);
        if (missing.length || unchecked.length) {
            const parts = [];
            if (missing.length) parts.push(`Не найдены в каталоге и <b>не попадут</b> в список:<br>${missing.map(r => `• ${esc(r.sourceText || r.itemName)}`).join('<br>')}`);
            if (unchecked.length) parts.push(`Не уверен в ${unchecked.length} ${plural(unchecked.length, 'товаре', 'товарах', 'товарах')}:<br>${unchecked.map(r => `• «${esc(r.sourceText)}» → ${esc(byId.get(r.productId).name)}`).join('<br>')}`);
            const ok = await confirmDialog({ title: 'Проверьте перед сохранением', iconName: 'alert', ok: saveNow ? 'Всё равно сохранить' : 'Всё равно перенести', text: parts.join('<br><br>') });
            if (!ok) return;
        }
        const learn = S.rows.filter(r => !r.skip && r.productId && r.confirmed && (r.itemName || r.sourceText))
            .map(r => ({ phrase: r.itemName || r.sourceText, productId: r.productId }));
        if (learn.length) api.post('/api/lists/ai-learn', learn).catch(() => { /* не критично */ });
        store.set('aiDraft', '');
        S.text = ''; S.rows = []; S.mode = 'input'; S.open = false;
        draw();
        await onApply(rows, S.meta, saveNow);
    }

    async function onClick(e) {
        const a = e.target.closest('[data-ai]');
        const stp = e.target.closest('[data-ai-step]');
        const sk = e.target.closest('[data-ai-skip]');
        if (stp) {
            const r = S.rows[Number(stp.dataset.aiRow)];
            if (!r.productId || r.skip) return;
            const v = +(r.qty + Number(stp.dataset.aiStep)).toFixed(3);
            if (v > 0) { r.qty = v; r.qtyBad = false; draw(); }
            return;
        }
        if (sk) { const r = S.rows[Number(sk.dataset.aiSkip)]; r.skip = !r.skip; draw(); return; }
        if (!a) return;
        switch (a.dataset.ai) {
            case 'toggle': if (e.target.closest('textarea,button:not([data-ai="toggle"])')) return; S.open = !S.open; draw(); if (S.open) root.querySelector('[data-ai-text]')?.focus(); break;
            case 'analyze': await analyze(a); break;
            case 'example': S.text = EXAMPLE; store.set('aiDraft', S.text); draw(); break;
            case 'clear': S.text = ''; store.set('aiDraft', ''); draw(); root.querySelector('[data-ai-text]')?.focus(); break;
            case 'back': S.mode = 'input'; S.open = true; draw(); root.querySelector('[data-ai-text]')?.focus(); break;
            case 'apply': await apply(false); break;
            case 'save': await busy(a, () => apply(true)); break;
        }
    }

    function onInput(e) {
        if (e.target.matches('[data-ai-text]')) {
            const had = !!S.text;
            S.text = e.target.value; store.set('aiDraft', S.text); autoGrow(e.target);
            if (had !== !!S.text) { // переключить «Пример» / «Очистить», не теряя курсор
                const pos = e.target.selectionStart; draw();
                const ta = root.querySelector('[data-ai-text]'); ta.focus(); ta.setSelectionRange(pos, pos);
            }
            return;
        }
        if (e.target.matches('[data-ai-qty]')) {
            const r = S.rows[Number(e.target.dataset.aiQty)];
            const v = parseNum(e.target.value);
            r.qtyBad = v === null || Number.isNaN(v) || v <= 0;
            e.target.closest('.stepper').classList.toggle('invalid', r.qtyBad);
            if (!r.qtyBad) {
                r.qty = v;
                const p = byId.get(r.productId);
                const price = root.querySelector(`.ai-row[data-ai-i="${e.target.dataset.aiQty}"] .ai-price .num`);
                if (p && price) price.textContent = money(v * Number(p.purchasePrice));
            }
        }
    }

    function onKey(e) {
        if (e.target.matches('[data-ai-text]') && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault(); analyze();
        }
    }

    return () => {
        root.removeEventListener('click', onClick);
        root.removeEventListener('input', onInput);
        root.removeEventListener('keydown', onKey);
    };
}

function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(420, Math.max(150, ta.scrollHeight + 2)) + 'px';
}
