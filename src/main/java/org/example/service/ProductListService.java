package org.example.service;

import org.example.domain.ActivityAction;
import org.example.domain.ApiException;
import org.example.domain.Entities.Product;
import org.example.domain.Entities.ProductList;
import org.example.domain.Entities.ProductListItem;
import org.example.domain.ListStatus;
import org.example.domain.MovementType;
import org.example.domain.Num;
import org.example.repository.IssueRepository;
import org.example.repository.ListRepository;
import org.example.repository.MovementRepository;
import org.example.repository.ProductRepository;
import org.example.web.dto.Dto.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Списки к выдаче — цифровая замена бумажных списков.
 * Статус списка всегда вычисляется из фактически выданных количеств:
 * «Выдан полностью» ставится только когда по каждой строке выдано ровно столько, сколько нужно.
 */
@Service
public class ProductListService {

    private final ListRepository lists;
    private final ProductRepository products;
    private final IssueRepository issues;
    private final MovementRepository movements;
    private final InventoryService inventory;
    private final ActivityService activity;

    public ProductListService(ListRepository lists, ProductRepository products, IssueRepository issues,
                              MovementRepository movements, InventoryService inventory, ActivityService activity) {
        this.lists = lists;
        this.products = products;
        this.issues = issues;
        this.movements = movements;
        this.inventory = inventory;
        this.activity = activity;
    }

    // ------------------------------------------------------------------ чтение

    @Transactional(readOnly = true)
    public List<ListSummaryView> findAll(List<ListStatus> statuses, String q) {
        return lists.findSummaries(statuses, Num.trim(q), 500).stream().map(Views::listSummary).toList();
    }

    @Transactional(readOnly = true)
    public ListDetailView detail(long id) {
        var summary = lists.findSummary(id).orElseThrow(() -> ApiException.notFound("Список не найден"));
        var items = lists.findItemRows(id).stream().map(Views::listItem).toList();
        var issueViews = issues.find(null, null, null, id, 200).stream().map(r -> Views.issue(r,
                movements.find(new MovementRepository.Filter(null, null, null, null, null, r.id(), 500))
                        .stream().map(Views::movement).toList())).toList();
        return new ListDetailView(Views.listSummary(summary), items, issueViews);
    }

    // ------------------------------------------------------------------ создание и изменение

    @Transactional
    public long create(ListRequest r) {
        ListStatus status = requestedStatus(r.status(), ListStatus.PENDING);
        Map<Long, ListItemRequest> items = mergeItems(r.items());
        if (status != ListStatus.DRAFT && items.isEmpty())
            throw ApiException.badRequest("Добавьте в список хотя бы один товар или сохраните его как черновик");
        long id = lists.insert(r.name().trim(), Num.trim(r.recipient()), Num.trim(r.notes()), status,
                activity.currentUserId());
        int order = 0;
        for (ListItemRequest it : items.values()) {
            Product p = products.findById(it.productId())
                    .orElseThrow(() -> ApiException.badRequest("Один из товаров не найден — обновите страницу"));
            lists.insertItem(id, p.id(), Num.qty(it.requiredQty()), p.purchasePrice(), Num.trim(it.note()), order++);
        }
        activity.log(ActivityAction.LIST_CREATED, "LIST", id, "Создан список «" + r.name().trim() + "»",
                items.size() + " поз. · " + status.title());
        return id;
    }

    @Transactional
    public void update(long id, ListRequest r) {
        ProductList list = lists.lockById(id).orElseThrow(() -> ApiException.notFound("Список не найден"));
        if (!list.status().isOpen())
            throw ApiException.badRequest("Список «" + list.name() + "» уже " + list.status().title().toLowerCase()
                    + " — изменять его нельзя");
        Map<Long, ListItemRequest> wanted = mergeItems(r.items());
        lists.updateHeader(id, r.name().trim(), Num.trim(r.recipient()), Num.trim(r.notes()));

        Map<Long, ProductListItem> existing = new HashMap<>();
        for (ProductListItem it : lists.lockItems(id)) existing.put(it.productId(), it);

        // строки, которые убрали из списка
        for (ProductListItem it : existing.values()) {
            if (wanted.containsKey(it.productId())) continue;
            if (it.issuedQty().signum() > 0) {
                String name = products.findRowsByIds(List.of(it.productId())).stream().findFirst()
                        .map(x -> x.product().name()).orElse("товар");
                throw ApiException.badRequest("«" + name + "» уже частично выдан — убрать его из списка нельзя. "
                        + "Можно уменьшить количество до уже выданного.");
            }
            lists.deleteItem(it.id());
        }
        int order = 0;
        for (ListItemRequest w : wanted.values()) {
            ProductListItem it = existing.get(w.productId());
            BigDecimal qty = Num.qty(w.requiredQty());
            if (it == null) {
                Product p = products.findById(w.productId())
                        .orElseThrow(() -> ApiException.badRequest("Один из товаров не найден — обновите страницу"));
                lists.insertItem(id, p.id(), qty, p.purchasePrice(), Num.trim(w.note()), order++);
            } else {
                if (qty.compareTo(it.issuedQty()) < 0) {
                    String name = products.findRowsByIds(List.of(it.productId())).stream().findFirst()
                            .map(x -> x.product().name()).orElse("товар");
                    throw ApiException.badRequest("По товару «" + name + "» уже выдано " + Num.fmtQty(it.issuedQty())
                            + " — нужное количество не может быть меньше");
                }
                lists.updateItem(it.id(), qty, it.unitPrice(), Num.trim(w.note()), order++);
            }
        }

        ListStatus target = list.status();
        if (r.status() != null && (list.status() == ListStatus.DRAFT || list.status() == ListStatus.PENDING)) {
            target = requestedStatus(r.status(), list.status());
        }
        if (target != ListStatus.DRAFT && wanted.isEmpty())
            throw ApiException.badRequest("В списке нет товаров. Добавьте товары или сохраните как черновик");
        if (target != list.status()) lists.updateStatus(id, target);
        ListStatus result = recompute(id);
        activity.log(ActivityAction.LIST_UPDATED, "LIST", id, "Изменён список «" + r.name().trim() + "»",
                wanted.size() + " поз. · " + result.title());
        if (result == ListStatus.COMPLETED && list.status() != ListStatus.COMPLETED) logCompleted(id, r.name().trim());
    }

    @Transactional
    public long duplicate(long id) {
        ProductList src = lists.findById(id).orElseThrow(() -> ApiException.notFound("Список не найден"));
        String name = src.name() + " (копия)";
        long newId = lists.insert(name.length() > 200 ? name.substring(0, 200) : name, src.recipient(), src.notes(),
                ListStatus.DRAFT, activity.currentUserId());
        int order = 0;
        for (var row : lists.findItemRows(id)) {
            if (row.productDeleted()) continue;
            lists.insertItem(newId, row.item().productId(), row.item().requiredQty(), row.currentPrice(),
                    row.item().note(), order++);
        }
        activity.log(ActivityAction.LIST_CREATED, "LIST", newId, "Создан список «" + name + "»",
                "Копия списка «" + src.name() + "»");
        return newId;
    }

    @Transactional
    public void changeStatus(long id, String statusName) {
        ProductList list = lists.lockById(id).orElseThrow(() -> ApiException.notFound("Список не найден"));
        ListStatus target = parse(statusName);
        switch (target) {
            case CANCELLED -> {
                if (list.status() == ListStatus.COMPLETED)
                    throw ApiException.badRequest("Список уже выдан полностью — отменить его нельзя");
                if (list.status() == ListStatus.CANCELLED) return;
                lists.updateStatus(id, ListStatus.CANCELLED);
                boolean partly = list.status() == ListStatus.PARTIAL;
                activity.log(ActivityAction.LIST_CANCELLED, "LIST", id, "Отменён список «" + list.name() + "»",
                        partly ? "Уже выданные товары остаются выданными, остальное больше не ожидает выдачи" : null);
            }
            case PENDING, DRAFT -> {
                if (list.status() == ListStatus.COMPLETED)
                    throw ApiException.badRequest("Список уже выдан полностью");
                if (target == ListStatus.DRAFT && lists.countIssues(id) > 0)
                    throw ApiException.badRequest("По списку уже были выдачи — вернуть его в черновики нельзя");
                if (target == ListStatus.PENDING && lists.findItemRows(id).isEmpty())
                    throw ApiException.badRequest("В списке нет товаров");
                boolean reopened = list.status() == ListStatus.CANCELLED;
                lists.updateStatus(id, target);
                ListStatus result = recompute(id);
                activity.log(ActivityAction.LIST_UPDATED, "LIST", id,
                        (reopened ? "Восстановлен список «" : "Список «") + list.name() + "»"
                                + (reopened ? "" : " — " + result.title().toLowerCase()), null);
            }
            default -> throw ApiException.badRequest("Этот статус ставится автоматически при выдаче товаров");
        }
    }

    @Transactional
    public void delete(long id) {
        ProductList list = lists.lockById(id).orElseThrow(() -> ApiException.notFound("Список не найден"));
        if (lists.countIssues(id) > 0)
            throw ApiException.badRequest("По списку уже выдавались товары — его нельзя удалить, но можно отменить");
        lists.delete(id);
        activity.log(ActivityAction.LIST_DELETED, "LIST", id, "Удалён список «" + list.name() + "»", null);
    }

    // ------------------------------------------------------------------ выдача

    @Transactional
    public ListDetailView issue(long id, IssueRequest r) {
        ProductList list = lists.lockById(id).orElseThrow(() -> ApiException.notFound("Список не найден"));
        if (!list.status().isOpen())
            throw ApiException.badRequest("Список «" + list.name() + "» " + list.status().title().toLowerCase()
                    + " — выдача по нему невозможна");

        Map<Long, ProductListItem> items = new HashMap<>();
        for (ProductListItem it : lists.lockItems(id)) items.put(it.id(), it);

        // складываем количества, если одна строка пришла дважды
        Map<Long, BigDecimal> requested = new LinkedHashMap<>();
        for (IssueLine line : r.items()) {
            if (line.quantity() == null || line.quantity().signum() == 0) continue;
            if (line.quantity().signum() < 0) throw ApiException.badRequest("Количество не может быть отрицательным");
            requested.merge(line.itemId(), Num.qty(line.quantity()), BigDecimal::add);
        }
        if (requested.isEmpty()) throw ApiException.badRequest("Укажите количество хотя бы для одного товара");

        List<ProductListItem> toIssue = new ArrayList<>();
        for (var e : requested.entrySet()) {
            ProductListItem it = items.get(e.getKey());
            if (it == null) throw ApiException.badRequest("Строка списка не найдена — обновите страницу");
            if (e.getValue().compareTo(it.remainingQty()) > 0) {
                String name = products.findRowsByIds(List.of(it.productId())).stream().findFirst()
                        .map(x -> x.product().name()).orElse("товар");
                throw ApiException.badRequest("По товару «" + name + "» осталось выдать только "
                        + Num.fmtQty(it.remainingQty()) + ", а указано " + Num.fmtQty(e.getValue()));
            }
            toIssue.add(it);
        }
        // единый порядок блокировок товаров исключает взаимные блокировки
        toIssue.sort(Comparator.comparing(ProductListItem::productId));

        String recipient = Num.trim(r.recipient()) != null ? Num.trim(r.recipient()) : list.recipient();
        long issueId = issues.insert(id, recipient, Num.trim(r.note()), activity.currentUserId());
        BigDecimal totalQty = BigDecimal.ZERO;
        BigDecimal totalAmount = BigDecimal.ZERO;
        List<String> lines = new ArrayList<>();
        for (ProductListItem it : toIssue) {
            BigDecimal q = requested.get(it.id());
            var change = inventory.apply(it.productId(), MovementType.ISSUE, q.negate(), it.unitPrice(),
                    "Выдача по списку «" + list.name() + "»", id, it.id(), issueId);
            lists.addIssued(it.id(), q);
            totalQty = totalQty.add(q);
            totalAmount = totalAmount.add(q.multiply(it.unitPrice()));
            lines.add(change.product().name() + " — " + Num.fmtQty(q) + " " + change.product().unit());
        }
        issues.setTotals(issueId, Num.qty(totalQty), Num.money(totalAmount));
        lists.touch(id);
        ListStatus status = recompute(id);
        activity.log(ActivityAction.LIST_ISSUED, "LIST", id, "Выдача по списку «" + list.name() + "»",
                String.join("; ", lines) + ". Статус: " + status.title().toLowerCase());
        if (status == ListStatus.COMPLETED) logCompleted(id, list.name());
        return detail(id);
    }

    /** Пересчитывает статус по фактическим количествам. Отменённые списки не трогает. */
    private ListStatus recompute(long id) {
        ProductList list = lists.findById(id).orElseThrow();
        if (list.status() == ListStatus.CANCELLED) return list.status();
        List<ProductListItem> items = lists.lockItems(id);
        boolean all = !items.isEmpty() && items.stream().allMatch(i -> i.issuedQty().compareTo(i.requiredQty()) >= 0);
        boolean any = items.stream().anyMatch(i -> i.issuedQty().signum() > 0);
        ListStatus status;
        if (all) status = ListStatus.COMPLETED;
        else if (any) status = ListStatus.PARTIAL;
        else status = list.status() == ListStatus.DRAFT ? ListStatus.DRAFT : ListStatus.PENDING;
        if (status != list.status()) lists.updateStatus(id, status);
        return status;
    }

    private void logCompleted(long id, String name) {
        activity.log(ActivityAction.LIST_COMPLETED, "LIST", id, "Список «" + name + "» выдан полностью", null);
    }

    // ------------------------------------------------------------------ помощники

    private static Map<Long, ListItemRequest> mergeItems(List<ListItemRequest> items) {
        Map<Long, ListItemRequest> map = new LinkedHashMap<>();
        if (items == null) return map;
        for (ListItemRequest it : items) {
            if (!Num.positive(it.requiredQty()))
                throw ApiException.badRequest("Количество каждого товара в списке должно быть больше нуля");
            map.merge(it.productId(), it, (a, b) -> new ListItemRequest(a.productId(),
                    a.requiredQty().add(b.requiredQty()), a.note() != null ? a.note() : b.note()));
        }
        return map;
    }

    private static ListStatus requestedStatus(String s, ListStatus fallback) {
        if (s == null || s.isBlank()) return fallback;
        ListStatus st = parse(s);
        if (st != ListStatus.DRAFT && st != ListStatus.PENDING)
            throw ApiException.badRequest("При сохранении можно выбрать только «Черновик» или «Ожидает выдачи»");
        return st;
    }

    static ListStatus parse(String s) {
        try {
            return ListStatus.valueOf(s.trim().toUpperCase());
        } catch (Exception e) {
            throw ApiException.badRequest("Неизвестный статус списка: " + s);
        }
    }
}
