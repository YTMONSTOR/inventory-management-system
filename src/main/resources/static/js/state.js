// Общее состояние приложения (настройки, профиль, кэш категорий).
import { api } from './api.js';

export const state = {
    counts: {},
    activeKey: null,
    profile: null,
    settings: {},
    guard: null,        // функция-проверка несохранённых изменений
    dirty: false,
    categories: null,
    refreshCounts: () => {},
    navigate: () => {},
    rerender: () => {},
    applyTheme: () => {},
    loadProfile: () => {},
};

export async function loadCategories(force = false) {
    if (!state.categories || force) state.categories = await api.get('/api/categories');
    return state.categories;
}

export function invalidateCategories() {
    state.categories = null;
}

export const UNITS = ['шт', 'кг', 'г', 'л', 'м', 'м²', 'м³', 'упак', 'коробка', 'комплект', 'рулон', 'пара', 'лист', 'мешок', 'бутылка'];
