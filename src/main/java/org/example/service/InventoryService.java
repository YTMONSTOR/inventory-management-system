package org.example.service;

import org.example.domain.ActivityAction;
import org.example.domain.ApiException;
import org.example.domain.Entities.Product;
import org.example.domain.MovementType;
import org.example.domain.Num;
import org.example.repository.IssueRepository;
import org.example.repository.MovementRepository;
import org.example.repository.ProductRepository;
import org.example.web.dto.Dto.AdjustRequest;
import org.example.web.dto.Dto.StockRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * Единственное место, где меняется остаток товара.
 * Каждое изменение: блокировка строки товара → проверка → новое количество → запись движения.
 * Всё в одной транзакции, а база дополнительно запрещает отрицательный остаток.
 */
@Service
public class InventoryService {

    private final ProductRepository products;
    private final MovementRepository movements;
    private final IssueRepository issues;
    private final ActivityService activity;

    public InventoryService(ProductRepository products, MovementRepository movements, IssueRepository issues,
                            ActivityService activity) {
        this.products = products;
        this.movements = movements;
        this.issues = issues;
        this.activity = activity;
    }

    /** Результат изменения остатка. */
    public record Change(Product product, BigDecimal before, BigDecimal after, long movementId) {
    }

    @Transactional
    public Change apply(long productId, MovementType type, BigDecimal delta, BigDecimal unitPrice, String note,
                       Long listId, Long listItemId, Long issueRecordId) {
        Product p = products.lockById(productId)
                .orElseThrow(() -> ApiException.notFound("Товар не найден"));
        if (p.deleted()) throw ApiException.badRequest("Товар «" + p.name() + "» удалён из каталога");
        if (delta == null || delta.signum() == 0) throw ApiException.badRequest("Количество должно быть больше нуля");
        BigDecimal before = p.quantity();
        BigDecimal after = Num.qty(before.add(delta));
        if (after.signum() < 0) {
            throw ApiException.badRequest("Недостаточно товара «" + p.name() + "» на складе: есть "
                    + Num.fmtQty(before) + " " + p.unit() + ", а нужно выдать " + Num.fmtQty(delta.negate())
                    + " " + p.unit());
        }
        products.updateQuantity(productId, after);
        BigDecimal price = unitPrice != null && unitPrice.signum() >= 0 ? unitPrice : p.purchasePrice();
        long id = movements.insert(productId, type, Num.qty(delta), after, Num.money(price), Num.trim(note),
                listId, listItemId, issueRecordId, activity.currentUserId());
        return new Change(p, before, after, id);
    }

    @Transactional
    public Change receive(StockRequest r) {
        requirePositive(r.quantity());
        Change c = apply(r.productId(), MovementType.RECEIPT, r.quantity(), r.unitPrice(), r.note(), null, null, null);
        activity.log(ActivityAction.STOCK_RECEIVED, "PRODUCT", c.product().id(),
                "Приход: " + c.product().name() + " +" + Num.fmtQty(r.quantity()) + " " + c.product().unit(),
                "Было " + Num.fmtQty(c.before()) + ", стало " + Num.fmtQty(c.after())
                        + (Num.trim(r.note()) != null ? ". " + r.note().trim() : ""));
        return c;
    }

    /** Выдача одного товара без списка. Создаёт отдельную запись о выдаче. */
    @Transactional
    public Change issue(StockRequest r) {
        requirePositive(r.quantity());
        long issueId = issues.insert(null, Num.trim(r.recipient()), Num.trim(r.note()), activity.currentUserId());
        Change c = apply(r.productId(), MovementType.ISSUE, r.quantity().negate(), r.unitPrice(), r.note(), null,
                null, issueId);
        BigDecimal price = r.unitPrice() != null ? r.unitPrice() : c.product().purchasePrice();
        issues.setTotals(issueId, Num.qty(r.quantity()), Num.money(price.multiply(r.quantity())));
        activity.log(ActivityAction.STOCK_ISSUED, "PRODUCT", c.product().id(),
                "Выдача: " + c.product().name() + " −" + Num.fmtQty(r.quantity()) + " " + c.product().unit(),
                (Num.trim(r.recipient()) != null ? "Кому: " + r.recipient().trim() + ". " : "")
                        + "Было " + Num.fmtQty(c.before()) + ", стало " + Num.fmtQty(c.after()));
        return c;
    }

    /** Инвентаризация: указываем фактический остаток, система записывает разницу. */
    @Transactional
    public Change adjust(AdjustRequest r) {
        Product p = products.lockById(r.productId()).orElseThrow(() -> ApiException.notFound("Товар не найден"));
        BigDecimal target = Num.qty(r.newQuantity());
        BigDecimal delta = target.subtract(p.quantity());
        if (delta.signum() == 0) throw ApiException.badRequest("Остаток уже равен " + Num.fmtQty(target) + " — менять нечего");
        Change c = apply(r.productId(), MovementType.ADJUSTMENT, delta, null,
                Num.trim(r.note()) != null ? r.note() : "Инвентаризация", null, null, null);
        activity.log(ActivityAction.STOCK_ADJUSTED, "PRODUCT", p.id(),
                "Корректировка: " + p.name() + " " + (delta.signum() > 0 ? "+" : "−")
                        + Num.fmtQty(delta.abs()) + " " + p.unit(),
                "Было " + Num.fmtQty(c.before()) + ", стало " + Num.fmtQty(c.after())
                        + (Num.trim(r.note()) != null ? ". " + r.note().trim() : ""));
        return c;
    }

    private static void requirePositive(BigDecimal q) {
        if (!Num.positive(q)) throw ApiException.badRequest("Количество должно быть больше нуля");
        if (q.scale() > 3 && q.stripTrailingZeros().scale() > 3)
            throw ApiException.badRequest("Слишком много знаков после запятой — допускается не больше трёх");
    }
}
