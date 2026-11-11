package org.example.domain;

/** Виды событий в журнале истории. */
public enum ActivityAction {
    PRODUCT_CREATED("Товар добавлен"),
    PRODUCT_UPDATED("Товар изменён"),
    PRODUCT_DELETED("Товар удалён"),
    PRODUCT_PHOTO("Фото товара"),
    STOCK_RECEIVED("Приход на склад"),
    STOCK_ISSUED("Выдача со склада"),
    STOCK_ADJUSTED("Корректировка остатка"),
    LIST_CREATED("Список создан"),
    LIST_UPDATED("Список изменён"),
    LIST_ISSUED("Выдача по списку"),
    LIST_COMPLETED("Список выдан полностью"),
    LIST_CANCELLED("Список отменён"),
    LIST_DELETED("Список удалён"),
    CATEGORY_CREATED("Категория создана"),
    CATEGORY_UPDATED("Категория изменена"),
    CATEGORY_DELETED("Категория удалена"),
    SETTINGS_UPDATED("Настройки изменены");

    private final String title;

    ActivityAction(String title) {
        this.title = title;
    }

    public String title() {
        return title;
    }
}
