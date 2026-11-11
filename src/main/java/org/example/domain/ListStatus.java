package org.example.domain;

public enum ListStatus {
    DRAFT("Черновик"),
    PENDING("Ожидает выдачи"),
    PARTIAL("Выдан частично"),
    COMPLETED("Выдан полностью"),
    CANCELLED("Отменён");

    private final String title;

    ListStatus(String title) {
        this.title = title;
    }

    public String title() {
        return title;
    }

    public boolean isOpen() {
        return this == DRAFT || this == PENDING || this == PARTIAL;
    }
}
