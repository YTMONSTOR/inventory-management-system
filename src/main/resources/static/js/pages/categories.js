import { api } from '../api.js';
import { icon, esc, num, money, empty, toast, confirmDialog, plural } from '../ui.js';
import { categoryForm } from '../dialogs.js';
import { invalidateCategories } from '../state.js';

export async function render({ el, isCurrent }) {
    let cats = await api.get('/api/categories');
    if (!isCurrent()) return;

    function draw() {
        const total = cats.reduce((s, c) => s + Number(c.totalValue), 0);
        el.innerHTML = `
        <div class="page-head">
            <div><h1 class="page-title">Категории</h1>
            <p class="page-sub">${cats.length ? `${cats.length} ${plural(cats.length, 'категория', 'категории', 'категорий')} · товары на ${money(total)}` : 'Группы товаров помогают быстрее находить нужное'}</p></div>
            <div class="page-actions"><button class="btn primary" type="button" data-act="add">${icon('plus')}Новая категория</button></div>
        </div>
        ${cats.length ? `<div class="cat-grid">${cats.map(c => `
            <div class="ccard" style="--c:${esc(c.color)}"><span class="stripe"></span>
                <div class="row"><span class="badge">${icon('tag')}</span>
                    <div class="grow" style="min-width:0"><div class="strong ellipsis" style="font-size:17px">${esc(c.name)}</div>
                    ${c.description ? `<div class="small muted ellipsis">${esc(c.description)}</div>` : ''}</div>
                    <button class="icon-btn sm" type="button" data-edit="${c.id}" aria-label="Изменить">${icon('edit', 'sm')}</button>
                    <button class="icon-btn sm" type="button" data-del="${c.id}" aria-label="Удалить" style="color:var(--red)">${icon('trash', 'sm')}</button>
                </div>
                <div class="stats">
                    <div><div class="v num">${c.productCount}</div><div class="k">${plural(c.productCount, 'товар', 'товара', 'товаров')}</div></div>
                    <div><div class="v num">${money(c.totalValue)}</div><div class="k">стоимость</div></div>
                    <div><div class="v num" style="color:${c.lowStockCount ? 'var(--amber)' : 'inherit'}">${c.lowStockCount}</div><div class="k">мало / нет</div></div>
                </div>
                <a class="btn sm" href="#/products?category=${c.id}">Открыть товары</a>
            </div>`).join('')}</div>`
            : `<div class="card">${empty({ art: 'box', title: 'Категорий пока нет', text: 'Например: «Сантехника», «Электрика», «Крепёж». Категории можно добавить и позже.',
                action: `<button class="btn primary" data-act="add">${icon('plus')}Создать категорию</button>` })}</div>`}`;
    }

    async function reload() { cats = await api.get('/api/categories'); invalidateCategories(); draw(); }

    async function onClick(e) {
        if (e.target.closest('[data-act="add"]')) { if (await categoryForm()) await reload(); return; }
        const ed = e.target.closest('[data-edit]');
        if (ed) { if (await categoryForm(cats.find(c => c.id === Number(ed.dataset.edit)))) await reload(); return; }
        const del = e.target.closest('[data-del]');
        if (del) {
            const c = cats.find(x => x.id === Number(del.dataset.del));
            const ok = await confirmDialog({
                title: `Удалить категорию «${esc(c.name)}»?`, danger: true, ok: 'Удалить',
                text: c.productCount ? `${c.productCount} ${plural(c.productCount, 'товар останется', 'товара останутся', 'товаров останутся')} в каталоге без категории.` : 'В этой категории нет товаров.',
            });
            if (!ok) return;
            try { await api.del(`/api/categories/${c.id}`); toast('Категория удалена'); await reload(); }
            catch (err) { toast(err.message, 'err'); }
        }
    }
    draw();
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
}
