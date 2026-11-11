import { api } from '../api.js';
import { icon, esc, toast, busy, dropdown, store } from '../ui.js';
import { state, UNITS } from '../state.js';

export async function render({ el, isCurrent }) {
    const [profile, settings] = await Promise.all([api.get('/api/profile'), api.get('/api/settings')]);
    if (!isCurrent()) return;
    const theme = store.get('theme', 'light');
    el.innerHTML = `
    <div class="page-head"><div><h1 class="page-title">Настройки</h1><p class="page-sub">Профиль, название склада и внешний вид</p></div></div>
    <div class="grid cols-2">
        <div class="card">
            <div class="card-head"><h2 class="section-title">Профиль</h2></div>
            <form class="card-body stack" data-profile novalidate>
                <div class="field"><label for="s_name">Имя</label><input class="input" id="s_name" name="fullName" value="${esc(profile.fullName)}" autocomplete="name"></div>
                <div class="field"><label for="s_pos">Должность</label><input class="input" id="s_pos" name="position" value="${esc(profile.position || '')}"></div>
                <div class="field"><label for="s_phone">Телефон</label><input class="input" id="s_phone" name="phone" value="${esc(profile.phone || '')}" inputmode="tel" autocomplete="tel"></div>
                <div><button class="btn primary" type="submit">${icon('check')}Сохранить профиль</button></div>
            </form>
        </div>
        <div class="card">
            <div class="card-head"><h2 class="section-title">Склад</h2></div>
            <form class="card-body stack" data-settings novalidate>
                <div class="field"><label for="s_company">Название склада или компании</label><input class="input" id="s_company" name="company_name" value="${esc(settings.company_name || '')}">
                    <div class="hint">Показывается в меню и в отчётах</div></div>
                <div class="field"><label for="s_cur">Валюта</label><input class="input" id="s_cur" name="currency" value="${esc(settings.currency || 'UZS')}" maxlength="10">
                    <div class="hint">Например: UZS, сум, USD</div></div>
                <div class="field"><label>Единица измерения по умолчанию</label><div data-unit></div></div>
                <div><button class="btn primary" type="submit">${icon('check')}Сохранить</button></div>
            </form>
        </div>
        <div class="card">
            <div class="card-head"><h2 class="section-title">Внешний вид</h2></div>
            <div class="card-body stack">
                <div class="segmented" data-theme-pick>${[['light', 'Светлая', 'sun'], ['dark', 'Тёмная', 'moon'], ['system', 'Как в системе', 'settings']].map(([k, l, ic]) =>
                    `<button type="button" class="${theme === k ? 'on' : ''}" data-t="${k}">${icon(ic, 'sm')}${l}</button>`).join('')}</div>
                <p class="small muted">Тему можно переключать в любой момент кнопкой внизу меню.</p>
            </div>
        </div>
        <div class="card">
            <div class="card-head"><h2 class="section-title">Данные</h2></div>
            <div class="card-body stack">
                <p style="color:var(--ink-2)">Все данные хранятся в базе PostgreSQL на этом компьютере, фото товаров — в папке <b>sklad-data</b> в домашней папке пользователя.
                Чтобы ничего не потерять, регулярно делайте резервную копию базы (инструкция — в файле README).</p>
                <div class="row wrap"><a class="btn sm" href="#/reports?type=inventory">${icon('sheet')}Выгрузить остатки</a><a class="btn sm" href="#/history">${icon('clock')}История действий</a></div>
            </div>
        </div>
    </div>`;

    const unitDd = dropdown(el.querySelector('[data-unit]'), { options: [...new Set([...UNITS, settings.default_unit || 'шт'])].map(u => ({ value: u, label: u })), value: settings.default_unit || 'шт' });

    async function onSubmit(e) {
        e.preventDefault();
        const f = e.target;
        const btn = f.querySelector('button[type="submit"]');
        if (f.matches('[data-profile]')) {
            const fullName = f.fullName.value.trim();
            if (!fullName) { toast('Введите имя', 'err'); f.fullName.focus(); return; }
            await busy(btn, async () => {
                try { await api.put('/api/profile', { fullName, position: f.position.value.trim() || null, phone: f.phone.value.trim() || null }); await state.loadProfile(); toast('Профиль сохранён'); }
                catch (err) { toast(err.message, 'err'); }
            });
        } else if (f.matches('[data-settings]')) {
            await busy(btn, async () => {
                try {
                    await api.put('/api/settings', { company_name: f.company_name.value.trim() || 'Мой склад', currency: f.currency.value.trim() || 'UZS', default_unit: unitDd.value });
                    await state.loadProfile();
                    toast('Настройки сохранены');
                } catch (err) { toast(err.message, 'err'); }
            });
        }
    }
    function onClick(e) {
        const t = e.target.closest('[data-t]');
        if (!t) return;
        state.applyTheme(t.dataset.t);
        el.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b === t));
    }
    el.addEventListener('submit', onSubmit);
    el.addEventListener('click', onClick);
    return () => { el.removeEventListener('submit', onSubmit); el.removeEventListener('click', onClick); };
}
