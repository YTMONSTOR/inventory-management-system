import { api } from '../api.js';
import { icon, esc, num, money, empty, skeletonTable, plural, debounce, isoDate, dayTitle, toast, busy } from '../ui.js';
import { download } from '../api.js';
import { issueBlock } from './list-detail.js';

const PERIODS = [['7', '7 дней'], ['30', '30 дней'], ['month', 'Этот месяц'], ['all', 'Всё время']];

export async function render({ el, isCurrent }) {
    const st = { period: '30', q: '' };
    el.innerHTML = `
    <div class="page-head">
        <div><h1 class="page-title">Выданные товары</h1><p class="page-sub">Каждая выдача — по списку или отдельно со склада</p></div>
        <div class="page-actions"><button class="btn" type="button" data-dl="xlsx">${icon('sheet')}Excel</button><button class="btn" type="button" data-dl="pdf">${icon('pdf')}PDF</button></div>
    </div>
    <div class="toolbar">
        <div class="segmented" data-periods></div>
        <div class="search-field" style="margin-left:auto">${icon('search')}<input class="input" type="search" data-q placeholder="Товар, список, получатель…" autocomplete="off"></div>
    </div>
    <div class="kpis" data-kpis style="grid-template-columns:repeat(3,minmax(0,1fr))"></div>
    <div data-body>${skeletonTable()}</div>`;
    const body = el.querySelector('[data-body]');

    function range() {
        const to = new Date();
        if (st.period === 'all') return {};
        const from = new Date();
        if (st.period === 'month') from.setDate(1); else from.setDate(from.getDate() - Number(st.period) + 1);
        return { from: isoDate(from), to: isoDate(to) };
    }
    async function load() {
        el.querySelector('[data-periods]').innerHTML = PERIODS.map(([k, l]) => `<button type="button" class="${st.period === k ? 'on' : ''}" data-p="${k}">${l}</button>`).join('');
        const r = range();
        const p = new URLSearchParams(r);
        if (st.q.trim()) p.set('q', st.q.trim());
        const issues = await api.get('/api/issues?' + p);
        if (!isCurrent()) return;
        const sum = issues.reduce((s, x) => s + Number(x.totalAmount), 0);
        const units = issues.reduce((s, x) => s + Number(x.totalQty), 0);
        el.querySelector('[data-kpis]').innerHTML = `
            <div class="kpi"><div class="kpi-top"><span class="kpi-icon tone-lapis">${icon('truck')}</span>Выдач</div><div class="kpi-value num">${issues.length}</div></div>
            <div class="kpi"><div class="kpi-top"><span class="kpi-icon tone-turq">${icon('box')}</span>Единиц товара</div><div class="kpi-value num">${num(units)}</div></div>
            <div class="kpi"><div class="kpi-top"><span class="kpi-icon tone-green">${icon('wallet')}</span>На сумму</div><div class="kpi-value num" style="font-size:24px">${money(sum)}</div></div>`;
        if (!issues.length) {
            body.innerHTML = `<div class="card">${empty({ art: 'clock', title: 'За этот период выдач не было', text: 'Выдачи появятся здесь, когда вы отпустите товар по списку или со склада.' })}</div>`;
            return;
        }
        let last = '';
        body.innerHTML = `<div class="card">${issues.map(r => {
            const day = String(r.createdAt).slice(0, 10);
            const head = day !== last ? `<div class="day-head" style="padding:16px 22px 4px">${esc(dayTitle(r.createdAt))}</div>` : '';
            last = day;
            return head + issueBlock(r, false, true);
        }).join('')}</div>`;
    }
    const loadSoon = debounce(load, 250);
    async function onClick(e) {
        const ib = e.target.closest('[data-issue-toggle]');
        if (ib) { ib.closest('.issue-block').classList.toggle('open'); return; }
        const p = e.target.closest('[data-p]');
        if (p) { st.period = p.dataset.p; load(); return; }
        const dl = e.target.closest('[data-dl]');
        if (dl) {
            const r = range();
            const q = new URLSearchParams({ ...r, format: dl.dataset.dl });
            await busy(dl, async () => { try { await download('/api/reports/issued?' + q); } catch (err) { toast(err.message, 'err'); } });
        }
    }
    function onInput(e) { if (e.target.matches('[data-q]')) { st.q = e.target.value; loadSoon(); } }
    await load();
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    return () => { el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); };
}

export { plural };
