package org.example.domain;

public enum MovementType {
    INITIAL("Начальный остаток"),
    RECEIPT("Приход"),
    ISSUE("Выдача"),
    ADJUSTMENT("Корректировка");

    private final String title;

    MovementType(String title) {
        this.title = title;
    }

    public String title() {
        return title;
    }
}
