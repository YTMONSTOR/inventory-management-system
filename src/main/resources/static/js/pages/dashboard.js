import { api } from '../api.js';
import {
    icon, esc, num, money, moneyShort, dateTime, miniImg, stockPill, listPill, skeletonPage, empty, store,
    GIRIH, plural, getCurrency,
} from '../ui.js';
import { flowChart, donut, bars } from '../charts.js';
import { productForm } from '../dialogs.js';
import { state } from '../state.js';
import { activityIcon } from './history.js';

export async function render({ el, isCurrent }) {
    el.innerHTML = skeletonPage();
    const recentIds = store.get('recent', []);
    const [d, recent] = await Promise.all([
        api.get('/api/dashboard'),
        recentIds.length ? api.get('/api/products?ids=' + recentIds.join(',')) : Promise.resolve([]),
    ]);
    if (!isCurrent()) return;
    const k = d.kpi;
    const hello = state.profile?.fullName ? state.profile.fullName.split(' ')[0] : '';
    const h = new Date().getHours();
    const greet = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    const isEmpty = k.totalProducts === 0;
    const recentSorted = recentIds.map(id => recent.find(p => p.id === id)).filter(Boolean).slice(0, 6);

    el.innerHTML = `
    <div class="page-head">
        <div><h1 class="page-title">${esc(greet)}${hello ? ', ' + esc(hello) : ''}</h1>
        <p class="page-sub">${isEmpty ? 'Начните с добавления товаров — остальное система посчитает сама.'
            : k.openLists ? `Ждут выдачи ${k.openLists} ${plural(k.openLists, 'список', 'списка', 'списков')}${k.pendingShortage ? `, по ${k.pendingShortage} ${plural(k.pendingShortage, 'позиции', 'позициям', 'позициям')} не хватает товара` : ''}.`
            : 'Все списки выданы. Склад в порядке.'}</p></div>
        <div class="page-actions">
            <button class="btn" type="button" data-act="quick-product">${icon('package-plus')}Быстро добавить товар</button>
            <a class="btn primary" href="#/lists/new">${icon('list-plus')}Новый список</a>
        </div>
    </div>

    <div class="kpis">
        <a class="kpi hero" href="#/reports">
            ${GIRIH.replace('class="pattern"', 'class="girih"')}
            <div class="kpi-top"><span class="kpi-icon">${icon('wallet')}</span>Стоимость склада</div>
            <div class="kpi-value num">${esc(money(k.inventoryValue, false))}<span class="unit">${esc(getCurrency())}</span></div>
            <div class="kpi-foot">${num(k.totalUnits)} ед. товара · ${k.inStockProducts} из ${k.totalProducts} позиций в наличии</div>
        </a>
        <a class="kpi" href="#/products">
            <div class="kpi-top"><span class="kpi-icon tone-lapis">${icon('box')}</span>Товаров в каталоге</div>
            <div class="kpi-value num">${num(k.totalProducts)}</div>
            <div class="kpi-foot">${k.inStockProducts} в наличии</div>
        </a>
        <a class="kpi" href="#/inventory">
            <div class="kpi-top"><span class="kpi-icon ${k.lowCount + k.outCount ? 'tone-amber' : 'tone-green'}">${icon('alert')}</span>Требуют внимания</div>
            <div class="kpi-value num">${num(k.lowCount + k.outCount)}</div>
            <div class="kpi-foot">${k.outCount} закончились · ${k.lowCount} заканчиваются</div>
        </a>
        <a class="kpi wide" href="#/lists">
            <div class="kpi-top"><span class="kpi-icon tone-turq">${icon('clipboard')}</span>Ожидают выдачи</div>
            <div class="kpi-value num">${num(k.pendingUnits)}<span class="unit">ед.</span></div>
            <div class="kpi-foot">${k.openLists} ${plural(k.openLists, 'список', 'списка', 'списков')} · на ${esc(moneyShort(k.pendingAmount))} ${esc(getCurrency())}</div>
        </a>
        <a class="kpi" href="#/issued">
            <div class="kpi-top"><span class="kpi-icon tone-lapis">${icon('truck')}</span>Выдано всего</div>
            <div class="kpi-value num">${num(k.issuedTotal)}<span class="unit">ед.</span></div>
            <div class="kpi-foot">${num(k.issuedMonth)} в этом месяце</div>
        </a>
        <a class="kpi" href="#/inventory">
            <div class="kpi-top"><span class="kpi-icon tone-green">${icon('arrow-in')}</span>Поступило за месяц</div>
            <div class="kpi-value num">${num(k.receivedMonth)}<span class="unit">ед.</span></div>
            <div class="kpi-foot">приход и начальные остатки</div>
        </a>
    </div>

    ${recentSorted.length ? `<div class="section-head"><h2 class="section-title">Недавно просмотренные</h2></div>
        <div class="recent-strip">${recentSorted.map(p => `<a class="recent-item" href="#/products/${p.id}">${miniImg(p.imageUrl, p.name, '', p.categoryColor)}
            <div style="min-width:0"><div class="strong ellipsis small">${esc(p.name)}</div><div class="small muted">${num(p.quantity)} ${esc(p.unit)}</div></div></a>`).join('')}</div>` : ''}

    <div class="grid dash">
        <div class="stack">
            <div class="card">
                <div class="card-head"><h2 class="section-title">Движение товаров за 30 дней</h2>
                    <div class="right legend"><span><i style="background:var(--turq)"></i>Приход</span><span><i style="background:var(--lapis)"></i>Выдача</span></div></div>
                <div class="card-body"><div class="chart" id="flowChart"></div></div>
            </div>
            <div class="card">
                <div class="card-head"><h2 class="section-title">Последние списки</h2><a class="link right" href="#/lists" style="margin-left:auto;font-weight:600;font-size:14px">Все списки</a></div>
                ${d.latestLists.length ? `<div class="table-wrap"><table class="table"><thead><tr>
                    <th>Список</th><th>Статус</th><th class="right">Позиций</th><th class="right">Сумма</th><th>Выдано</th></tr></thead><tbody>
                    ${d.latestLists.map(l => `<tr class="clickable" data-href="#/lists/${l.id}">
                        <td><div class="strong">${esc(l.name)}</div>${l.recipient ? `<div class="small muted">${esc(l.recipient)}</div>` : ''}</td>
                        <td>${listPill(l.status)}</td><td class="right num">${l.itemCount}</td><td class="right num">${money(l.amountTotal)}</td>
                        <td><div class="row-progress"><div class="bar"><i class="${l.progress >= 100 ? 'full' : ''}" style="width:${l.progress}%"></i></div><div class="t">${l.progress}%</div></div></td>
                        </tr>`).join('')}
                    </tbody></table></div>`
                    : empty({ art: 'list', title: 'Списков пока нет', text: 'Создайте первый список товаров к выдаче — как на бумаге, только удобнее.', compact: true,
                        action: '<a class="btn primary sm" href="#/lists/new">Создать список</a>' })}
            </div>
        </div>
        <div class="stack">
            <div class="card">
                <div class="card-head"><h2 class="section-title">Нужно пополнить</h2><a class="right" href="#/inventory" style="margin-left:auto;font-weight:600;font-size:14px">Склад</a></div>
                <div class="card-body" style="padding-top:8px;padding-bottom:8px">
                ${d.lowStock.length ? d.lowStock.map(p => `<a class="pick" href="#/products/${p.id}" style="color:var(--ink)">
                    ${miniImg(p.imageUrl, p.name, '', p.categoryColor)}
                    <div class="grow" style="min-width:0"><div class="name ellipsis">${esc(p.name)}</div>
                    <div class="sub">${num(p.quantity)} ${esc(p.unit)} из минимума ${num(p.minQuantity)}</div></div>${stockPill(p.status)}</a>`).join('')
                    : empty({ art: 'ok', title: 'Всего достаточно', text: 'Ни один товар не опустился ниже минимального остатка.', compact: true })}
                </div>
            </div>
            <div class="card">
                <div class="card-head"><h2 class="section-title">Стоимость по категориям</h2></div>
                <div class="card-body"><div class="donut-wrap"><div class="donut" id="catDonut"></div>
                    ${bars(d.valueByCategory.slice(0, 5).map(c => ({ label: c.name, value: c.value, color: c.color, title: moneyShort(c.value) })))}</div>
                    <div class="divider"></div>
                    <div class="progress-label"><span>Состояние остатков</span><b>${k.totalProducts} поз.</b></div>
                    <div class="status-split">${[['AVAILABLE', 'var(--green)'], ['LOW', 'var(--amber)'], ['OUT', 'var(--red)']].map(([s, c]) =>
                        d.statusDistribution[s] ? `<i style="flex:${d.statusDistribution[s]};background:${c}" title="${d.statusDistribution[s]}"></i>` : '').join('') || '<i style="flex:1;background:var(--surface-3)"></i>'}</div>
                    <div class="legend" style="margin-top:10px"><span><i style="background:var(--green)"></i>В наличии ${d.statusDistribution.AVAILABLE}</span>
                        <span><i style="background:var(--amber)"></i>Мало ${d.statusDistribution.LOW}</span><span><i style="background:var(--red)"></i>Нет ${d.statusDistribution.OUT}</span></div>
                </div>
            </div>
            ${d.topIssued.length ? `<div class="card"><div class="card-head"><h2 class="section-title">Чаще всего выдают</h2><span class="muted small right" style="margin-left:auto">30 дней</span></div>
                <div class="card-body" style="padding-top:8px;padding-bottom:8px">${d.topIssued.map(t => `<a class="pick" href="#/products/${t.id}" style="color:var(--ink)">
                    ${miniImg(t.imageUrl, t.name)}<div class="grow" style="min-width:0"><div class="name ellipsis">${esc(t.name)}</div></div>
                    <b class="num">${num(t.quantity)} ${esc(t.unit)}</b></a>`).join('')}</div></div>` : ''}
            <div class="card">
                <div class="card-head"><h2 class="section-title">Последние действия</h2><a class="right" href="#/history" style="margin-left:auto;font-weight:600;font-size:14px">История</a></div>
                <div class="card-body" style="padding-top:6px;padding-bottom:6px">
                ${d.recentActivity.length ? `<div class="feed">${d.recentActivity.map(a => `<div class="feed-item">${activityIcon(a.action)}
                    <div class="grow" style="min-width:0"><div class="feed-title">${esc(a.title)}</div>
                    <div class="feed-time">${esc(dateTime(a.createdAt))}</div></div></div>`).join('')}</div>`
                    : empty({ art: 'clock', title: 'Пока тихо', text: 'Здесь появятся все действия на складе.', compact: true })}
                </div>
            </div>
        </div>
    </div>`;

    const total = d.valueByCategory.reduce((s, c) => s + Number(c.value), 0);
    donut(el.querySelector('#catDonut'), d.valueByCategory.map(c => ({ label: c.name, value: c.value, color: c.color, title: money(c.value) })),
        esc(moneyShort(total)), getCurrency());
    const chartEl = el.querySelector('#flowChart');
    const draw = () => flowChart(chartEl, d.flow);
    requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => draw());
    ro.observe(chartEl);

    el.addEventListener('click', onClick);
    async function onClick(e) {
        const row = e.target.closest('[data-href]');
        if (row) { location.hash = row.dataset.href; return; }
        if (e.target.closest('[data-act="quick-product"]')) {
            const p = await productForm(null, { quick: true });
            if (p) location.hash = `#/products/${p.id}`;
        }
    }
    return () => { ro.disconnect(); el.removeEventListener('click', onClick); };
}
