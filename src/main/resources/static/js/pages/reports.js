import { api, download } from '../api.js';
import { icon, esc, num, money, dateTime, empty, skeletonTable, toast, busy, isoDate } from '../ui.js';

const REPORTS = [
    { key: 'inventory', title: 'Текущие остатки', text: 'Все товары с количеством и стоимостью', icon: 'warehouse', tone: 'lapis' },
    { key: 'value', title: 'Стоимость склада', text: 'Сколько стоит товар по категориям', icon: 'wallet', tone: 'green' },
    { key: 'issued', title: 'Выданные товары', text: 'Что, когда и кому выдано за период', icon: 'truck', tone: 'lapis', period: true },
    { key: 'received', title: 'Поступления', text: 'Приход на склад за период', icon: 'arrow-in', tone: 'turq', period: true },
    { key: 'pending', title: 'Ожидают выдачи', text: 'Что осталось выдать по спискам', icon: 'clipboard', tone: 'turq' },
    { key: 'lowstock', title: 'Заканчиваются', text: 'Что нужно докупить', icon: 'alert', tone: 'amber' },
];

function cell(col, v) {
    if (v === null || v === undefined || v === '') return '';
    switch (col.type) {
        case 'MONEY': return money(v, false);
        case 'NUMBER': return num(v);
        case 'PERCENT': return num(v, 1) + '%';
        case 'DATETIME': return esc(dateTime(v));
        default: return esc(v);
    }
}

export async function render({ el, query, isCurrent }) {
    const first = new Date(); first.setDate(1);
    const st = { key: query.get('type') || 'inventory', from: isoDate(first), to: isoDate(new Date()) };
    el.innerHTML = `
    <div class="page-head"><div><h1 class="page-title">Отчёты</h1><p class="page-sub">Выберите отчёт, посмотрите его здесь или скачайте в Excel и PDF</p></div></div>
    <div class="report-cards" data-cards></div>
    <div class="card">
        <div class="card-head" style="flex-wrap:wrap">
            <div style="min-width:0"><h2 class="section-title" data-title></h2><div class="small muted" data-subtitle></div></div>
            <div class="right" style="flex-wrap:wrap">
                <div class="row" data-period hidden><input class="input sm" type="date" data-from value="${st.from}" aria-label="С даты" style="width:160px">
                    <span class="muted">—</span><input class="input sm" type="date" data-to value="${st.to}" aria-label="По дату" style="width:160px"></div>
                <button class="btn sm" type="button" data-dl="xlsx">${icon('sheet')}Excel</button>
                <button class="btn sm" type="button" data-dl="pdf">${icon('pdf')}PDF</button>
                <button class="btn sm" type="button" onclick="window.print()">${icon('printer')}Печать</button>
            </div>
        </div>
        <div data-summary style="padding:16px 22px 0" class="row wrap"></div>
        <div data-table style="padding-top:12px">${skeletonTable(5)}</div>
    </div>`;

    function params(format) {
        const r = REPORTS.find(x => x.key === st.key);
        const p = new URLSearchParams();
        if (r.period) { if (st.from) p.set('from', st.from); if (st.to) p.set('to', st.to); }
        if (format) p.set('format', format);
        return p;
    }
    async function load() {
        const r = REPORTS.find(x => x.key === st.key) || REPORTS[0];
        el.querySelector('[data-cards]').innerHTML = REPORTS.map(x => `<button type="button" class="rcard ${x.key === st.key ? 'on' : ''}" data-r="${x.key}">
            <span class="kpi-icon tone-${x.tone}">${icon(x.icon)}</span><div class="t">${x.title}</div><div class="d">${x.text}</div></button>`).join('');
        el.querySelector('[data-period]').hidden = !r.period;
        el.querySelector('[data-table]').innerHTML = skeletonTable(5);
        const t = await api.get(`/api/reports/${st.key}?` + params());
        if (!isCurrent()) return;
        el.querySelector('[data-title]').textContent = t.title;
        el.querySelector('[data-subtitle]').textContent = t.subtitle;
        el.querySelector('[data-summary]').innerHTML = t.summary.map(s => `<div class="stock-tile" style="padding:12px 16px"><div class="k">${esc(s.label)}</div><div class="strong num" style="font-size:17px">${esc(s.value)}</div></div>`).join('');
        const numeric = c => ['MONEY', 'NUMBER', 'PERCENT'].includes(c.type);
        el.querySelector('[data-table]').innerHTML = t.rows.length ? `<div class="table-wrap" style="max-height:640px"><table class="table"><thead><tr>
            ${t.columns.map(c => `<th class="${numeric(c) ? 'right' : ''}">${esc(c.title)}</th>`).join('')}</tr></thead><tbody>
            ${t.rows.map(row => `<tr>${t.columns.map((c, i) => `<td class="${numeric(c) ? 'right num' : ''}">${cell(c, row[i])}</td>`).join('')}</tr>`).join('')}</tbody>
            ${t.totals ? `<tfoot><tr>${t.columns.map((c, i) => `<td class="${numeric(c) ? 'right num' : ''}">${cell(c, t.totals[i])}</td>`).join('')}</tr></tfoot>` : ''}
            </table></div>`
            : empty({ art: 'ok', title: 'Нет данных', text: r.period ? 'За выбранный период записей нет. Попробуйте изменить даты.' : 'Пока нечего показать.', compact: true });
    }
    async function onClick(e) {
        const r = e.target.closest('[data-r]');
        if (r) { st.key = r.dataset.r; history.replaceState(null, '', `#/reports?type=${st.key}`); load(); return; }
        const dl = e.target.closest('[data-dl]');
        if (dl) await busy(dl, async () => {
            try { await download(`/api/reports/${st.key}?` + params(dl.dataset.dl)); toast('Файл скачан'); } catch (err) { toast(err.message, 'err'); }
        });
    }
    function onChange(e) {
        if (e.target.matches('[data-from]')) { st.from = e.target.value; load(); }
        if (e.target.matches('[data-to]')) { st.to = e.target.value; load(); }
    }
    await load();
    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    return () => { el.removeEventListener('click', onClick); el.removeEventListener('change', onChange); };
}
