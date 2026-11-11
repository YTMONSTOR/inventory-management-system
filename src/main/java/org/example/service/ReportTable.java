package org.example.service;

import java.util.List;

/** Отчёт в виде таблицы — одинаково выводится на экран, в Excel и в PDF. */
public record ReportTable(String key, String title, String subtitle, List<Column> columns, List<List<Object>> rows,
                          List<Object> totals, List<Summary> summary) {

    public enum Type { TEXT, NUMBER, MONEY, DATETIME, PERCENT }

    public record Column(String title, Type type, int width) {
    }

    /** Итоговые показатели над таблицей: «Всего товаров: 120». */
    public record Summary(String label, String value) {
    }
}
