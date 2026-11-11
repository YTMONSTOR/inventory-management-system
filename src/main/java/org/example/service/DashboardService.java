package org.example.service;

import org.example.domain.ListStatus;
import org.example.domain.Num;
import org.example.repository.ActivityRepository;
import org.example.repository.ListRepository;
import org.example.repository.MovementRepository;
import org.example.repository.ProductRepository;
import org.example.repository.StatsRepository;
import org.example.web.dto.Dto.NotificationView;
import org.example.web.dto.Dto.ProductView;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DashboardService {

    private final StatsRepository stats;
    private final MovementRepository movements;
    private final ProductRepository products;
    private final ListRepository lists;
    private final ActivityRepository activity;

    public DashboardService(StatsRepository stats, MovementRepository movements, ProductRepository products,
                            ListRepository lists, ActivityRepository activity) {
        this.stats = stats;
        this.movements = movements;
        this.products = products;
        this.lists = lists;
        this.activity = activity;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> dashboard() {
        Map<String, Object> m = new LinkedHashMap<>();
        var k = stats.kpi();
        m.put("kpi", k);
        m.put("lowStock", lowStock(8));
        m.put("flow", movements.dailyFlow(30));
        m.put("valueByCategory", stats.valueByCategory());
        m.put("statusDistribution", stats.statusDistribution());
        m.put("topIssued", stats.topIssued(30, 5).stream().map(t -> Map.of(
                "id", t.id(), "name", t.name(), "unit", t.unit(), "quantity", t.quantity(),
                "imageUrl", t.imageFile() == null ? "" : Views.imageUrl(t.imageFile()))).toList());
        m.put("latestLists", lists.findSummaries(null, null, 6).stream().map(Views::listSummary).toList());
        m.put("recentActivity", activity.find(new ActivityRepository.Filter(null, null, null, null, 10, 0))
                .stream().map(Views::activity).toList());
        return m;
    }

    /** Товары, которые закончились или заканчиваются; сначала самые срочные. */
    public List<ProductView> lowStock(int limit) {
        return products.findAllRows().stream().map(Views::product)
                .filter(p -> !"AVAILABLE".equals(p.status()))
                .sorted(Comparator.comparing((ProductView p) -> "OUT".equals(p.status()) ? 0 : 1)
                        .thenComparing(p -> p.minQuantity().signum() == 0 ? 1.0
                                : p.quantity().doubleValue() / p.minQuantity().doubleValue()))
                .limit(limit).toList();
    }

    @Transactional(readOnly = true)
    public List<NotificationView> notifications() {
        List<NotificationView> list = new ArrayList<>();
        for (ProductView p : lowStock(30)) {
            boolean out = "OUT".equals(p.status());
            list.add(new NotificationView("stock", out ? "danger" : "warning",
                    out ? "Закончился: " + p.name() : "Заканчивается: " + p.name(),
                    out ? "На складе 0 " + p.unit()
                            : "Осталось " + Num.fmtQty(p.quantity()) + " " + p.unit() + " (минимум "
                            + Num.fmtQty(p.minQuantity()) + ")",
                    "#/products/" + p.id(), p.updatedAt()));
        }
        for (var s : lists.findSummaries(List.of(ListStatus.PENDING, ListStatus.PARTIAL), null, 20)) {
            if (s.shortageCount() == 0) continue;
            list.add(new NotificationView("list", "warning", "Не хватает товара для списка «" + s.list().name() + "»",
                    "Позиций без нужного остатка: " + s.shortageCount(), "#/lists/" + s.list().id(),
                    s.list().updatedAt()));
        }
        return list;
    }
}
