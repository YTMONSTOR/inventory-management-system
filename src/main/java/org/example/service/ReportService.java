package org.example.service;

import org.example.domain.ApiException;
import org.example.domain.ListStatus;
import org.example.domain.MovementType;
import org.example.domain.Num;
import org.example.repository.ListRepository;
import org.example.repository.MovementRepository;
import org.example.repository.SettingsRepository;
import org.example.repository.StatsRepository;
import org.example.service.ReportTable.Column;
import org.example.service.ReportTable.Summary;
import org.example.service.ReportTable.Type;
import org.example.web.dto.Dto.ProductView;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Service
public class ReportService {

    private static final DateTimeFormatter D = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private final ProductService products;
    private final DashboardService dashboard;
    private final MovementRepository movements;
    private final ListRepository lists;
    private final StatsRepository stats;
    private final SettingsRepository settings;

    public ReportService(ProductService products, DashboardService dashboard, MovementRepository movements,
                         ListRepository lists, StatsRepository stats, SettingsRepository settings) {
        this.products = products;
        this.dashboard = dashboard;
        this.movements = movements;
        this.lists = lists;
        this.stats = stats;
        this.settings = settings;
    }

    public String currency() {
        return settings.findAll().getOrDefault("currency", "UZS");
    }

    public String company() {
        return settings.findAll().getOrDefault("company_name", "Склад");
    }

    @Transactional(readOnly = true)
    public ReportTable build(String type, LocalDate from, LocalDate to) {
        return switch (type) {
            case "inventory" -> inventory();
            case "issued" -> issued(from, to);
            case "received" -> received(from, to);
            case "pending" -> pending();
            case "lowstock" -> lowStock();
            case "value" -> value();
            default -> throw ApiException.notFound("Такого отчёта нет");
        };
    }

    private ReportTable inventory() {
        List<ProductView> all = products.findAll();
        List<List<Object>> rows = new ArrayList<>();
        BigDecimal value = BigDecimal.ZERO;
        int i = 1;
        for (ProductView p : all) {
            rows.add(row(i++, p.sku(), p.name(), nz(p.categoryName()), p.unit(), p.quantity(), p.minQuantity(),
                    p.purchasePrice(), p.stockValue(), Views.stockStatusTitle(p.status())));
            value = value.add(p.stockValue());
        }
        return new ReportTable("inventory", "Текущие остатки на складе", "На " + LocalDate.now().format(D),
                cols("№", Type.NUMBER, 5, "Код", Type.TEXT, 11, "Товар", Type.TEXT, 34, "Категория", Type.TEXT, 18,
                        "Ед.", Type.TEXT, 6, "Остаток", Type.NUMBER, 11, "Мин.", Type.NUMBER, 9,
                        "Цена, " + currency(), Type.MONEY, 14, "Сумма, " + currency(), Type.MONEY, 16,
                        "Состояние", Type.TEXT, 15),
                rows, row("", "", "Итого", "", "", null, null, null, value, ""),
                List.of(new Summary("Товаров", String.valueOf(all.size())),
                        new Summary("Стоимость склада", Num.fmtMoney(value) + " " + currency())));
    }

    private ReportTable issued(LocalDate from, LocalDate to) {
        LocalDate f = from != null ? from : LocalDate.now().withDayOfMonth(1);
        LocalDate t = to != null ? to : LocalDate.now();
        var rowsData = movements.find(new MovementRepository.Filter(null, MovementType.ISSUE, f.atStartOfDay(),
                t.plusDays(1).atStartOfDay(), null, null, 100000));
        List<List<Object>> rows = new ArrayList<>();
        BigDecimal sum = BigDecimal.ZERO;
        for (var m : rowsData) {
            BigDecimal q = m.quantity().abs();
            BigDecimal a = Num.money(q.multiply(m.unitPrice()));
            rows.add(row(m.createdAt(), m.productSku(), m.productName(), q, m.unit(), m.unitPrice(), a,
                    nz(m.listName()), nz(m.recipient())));
            sum = sum.add(a);
        }
        return new ReportTable("issued", "Выданные товары", "С " + f.format(D) + " по " + t.format(D),
                cols("Дата", Type.DATETIME, 17, "Код", Type.TEXT, 11, "Товар", Type.TEXT, 32, "Кол-во", Type.NUMBER, 10,
                        "Ед.", Type.TEXT, 6, "Цена, " + currency(), Type.MONEY, 14, "Сумма, " + currency(), Type.MONEY, 16,
                        "Список", Type.TEXT, 22, "Кому", Type.TEXT, 18),
                rows, row("", "", "Итого", null, "", null, sum, "", ""),
                List.of(new Summary("Выдач", String.valueOf(rows.size())),
                        new Summary("На сумму", Num.fmtMoney(sum) + " " + currency())));
    }

    private ReportTable received(LocalDate from, LocalDate to) {
        LocalDate f = from != null ? from : LocalDate.now().withDayOfMonth(1);
        LocalDate t = to != null ? to : LocalDate.now();
        var data = new ArrayList<MovementRepository.MovementRow>();
        for (MovementType type : List.of(MovementType.RECEIPT, MovementType.INITIAL)) {
            data.addAll(movements.find(new MovementRepository.Filter(null, type, f.atStartOfDay(),
                    t.plusDays(1).atStartOfDay(), null, null, 100000)));
        }
        data.sort((a, b) -> b.createdAt().compareTo(a.createdAt()));
        List<List<Object>> rows = new ArrayList<>();
        BigDecimal sum = BigDecimal.ZERO;
        for (var m : data) {
            BigDecimal a = Num.money(m.quantity().multiply(m.unitPrice()));
            rows.add(row(m.createdAt(), m.productSku(), m.productName(), m.quantity(), m.unit(), m.unitPrice(), a,
                    m.type().title(), nz(m.note())));
            sum = sum.add(a);
        }
        return new ReportTable("received", "Поступления на склад", "С " + f.format(D) + " по " + t.format(D),
                cols("Дата", Type.DATETIME, 17, "Код", Type.TEXT, 11, "Товар", Type.TEXT, 32, "Кол-во", Type.NUMBER, 10,
                        "Ед.", Type.TEXT, 6, "Цена, " + currency(), Type.MONEY, 14, "Сумма, " + currency(), Type.MONEY, 16,
                        "Вид", Type.TEXT, 18, "Примечание", Type.TEXT, 24),
                rows, row("", "", "Итого", null, "", null, sum, "", ""),
                List.of(new Summary("Поступлений", String.valueOf(rows.size())),
                        new Summary("На сумму", Num.fmtMoney(sum) + " " + currency())));
    }

    private ReportTable pending() {
        var summaries = lists.findSummaries(List.of(ListStatus.DRAFT, ListStatus.PENDING, ListStatus.PARTIAL), null, 1000);
        List<List<Object>> rows = new ArrayList<>();
        BigDecimal sum = BigDecimal.ZERO;
        for (var s : summaries) {
            for (var it : lists.findItemRows(s.list().id())) {
                BigDecimal remaining = it.item().remainingQty();
                if (remaining.signum() <= 0) continue;
                BigDecimal a = Num.money(remaining.multiply(it.item().unitPrice()));
                rows.add(row(s.list().name(), s.list().status().title(), it.productName(), it.unit(),
                        it.item().requiredQty(), it.item().issuedQty(), remaining, it.stock(), a,
                        remaining.compareTo(it.stock()) > 0 ? "Не хватает" : "Есть"));
                sum = sum.add(a);
            }
        }
        return new ReportTable("pending", "Списки к выдаче — что осталось выдать", "На " + LocalDate.now().format(D),
                cols("Список", Type.TEXT, 24, "Статус", Type.TEXT, 16, "Товар", Type.TEXT, 30, "Ед.", Type.TEXT, 6,
                        "Нужно", Type.NUMBER, 9, "Выдано", Type.NUMBER, 9, "Осталось", Type.NUMBER, 10,
                        "На складе", Type.NUMBER, 10, "Сумма, " + currency(), Type.MONEY, 15, "Наличие", Type.TEXT, 12),
                rows, row("", "", "Итого", "", null, null, null, null, sum, ""),
                List.of(new Summary("Списков", String.valueOf(summaries.size())),
                        new Summary("Осталось выдать на", Num.fmtMoney(sum) + " " + currency())));
    }

    private ReportTable lowStock() {
        List<ProductView> low = dashboard.lowStock(100000);
        List<List<Object>> rows = new ArrayList<>();
        for (ProductView p : low) {
            BigDecimal need = p.minQuantity().subtract(p.quantity()).max(BigDecimal.ZERO);
            rows.add(row(p.sku(), p.name(), nz(p.categoryName()), p.unit(), p.quantity(), p.minQuantity(), need,
                    p.reservedQty(), Views.stockStatusTitle(p.status())));
        }
        return new ReportTable("lowstock", "Заканчивающиеся товары", "На " + LocalDate.now().format(D),
                cols("Код", Type.TEXT, 11, "Товар", Type.TEXT, 34, "Категория", Type.TEXT, 18, "Ед.", Type.TEXT, 6,
                        "Остаток", Type.NUMBER, 10, "Минимум", Type.NUMBER, 10, "Докупить", Type.NUMBER, 10,
                        "Ждут в списках", Type.NUMBER, 14, "Состояние", Type.TEXT, 15),
                rows, null, List.of(new Summary("Товаров требуют внимания", String.valueOf(rows.size()))));
    }

    private ReportTable value() {
        var data = stats.valueByCategory();
        BigDecimal total = data.stream().map(StatsRepository.CategoryValue::value).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<List<Object>> rows = new ArrayList<>();
        long count = 0;
        for (var c : data) {
            BigDecimal share = total.signum() == 0 ? BigDecimal.ZERO
                    : c.value().multiply(BigDecimal.valueOf(100)).divide(total, 1, java.math.RoundingMode.HALF_UP);
            rows.add(row(c.name(), c.products(), Num.money(c.value()), share));
            count += c.products();
        }
        return new ReportTable("value", "Стоимость склада по категориям", "На " + LocalDate.now().format(D),
                cols("Категория", Type.TEXT, 30, "Товаров", Type.NUMBER, 12, "Стоимость, " + currency(), Type.MONEY, 20,
                        "Доля, %", Type.PERCENT, 12),
                rows, row("Итого", count, Num.money(total), total.signum() == 0 ? null : BigDecimal.valueOf(100)),
                List.of(new Summary("Общая стоимость", Num.fmtMoney(total) + " " + currency())));
    }

    /** Таблица одного списка — для печати и выгрузки. */
    @Transactional(readOnly = true)
    public ReportTable list(long id) {
        var s = lists.findSummary(id).orElseThrow(() -> ApiException.notFound("Список не найден"));
        List<List<Object>> rows = new ArrayList<>();
        int i = 1;
        BigDecimal total = BigDecimal.ZERO;
        for (var it : lists.findItemRows(id)) {
            BigDecimal line = Num.money(it.item().requiredQty().multiply(it.item().unitPrice()));
            rows.add(row(i++, it.productSku(), it.productName(), it.unit(), it.item().unitPrice(),
                    it.item().requiredQty(), it.item().issuedQty(), it.item().remainingQty(), it.stock(), line));
            total = total.add(line);
        }
        List<Summary> summary = new ArrayList<>();
        summary.add(new Summary("Статус", s.list().status().title()));
        if (s.list().recipient() != null) summary.add(new Summary("Кому", s.list().recipient()));
        summary.add(new Summary("Сумма", Num.fmtMoney(total) + " " + currency()));
        if (s.list().notes() != null) summary.add(new Summary("Примечание", s.list().notes()));
        return new ReportTable("list", "Список: " + s.list().name(),
                "Создан " + s.list().createdAt().format(D) + " · напечатан " + LocalDateTime.now().format(
                        DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm")),
                cols("№", Type.NUMBER, 5, "Код", Type.TEXT, 11, "Товар", Type.TEXT, 34, "Ед.", Type.TEXT, 6,
                        "Цена, " + currency(), Type.MONEY, 14, "Нужно", Type.NUMBER, 9, "Выдано", Type.NUMBER, 9,
                        "Осталось", Type.NUMBER, 10, "На складе", Type.NUMBER, 10, "Сумма, " + currency(), Type.MONEY, 15),
                rows, row("", "", "Итого", "", null, null, null, null, null, total), summary);
    }

    // ------------------------------------------------------------------ помощники

    private static List<Object> row(Object... values) {
        return new ArrayList<>(Arrays.asList(values));
    }

    private static List<Column> cols(Object... def) {
        List<Column> list = new ArrayList<>();
        for (int i = 0; i < def.length; i += 3) list.add(new Column((String) def[i], (Type) def[i + 1], (Integer) def[i + 2]));
        return list;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
