package org.example.service;

import org.example.domain.Entities.Product;
import org.example.domain.Num;
import org.example.repository.ActivityRepository.ActivityRow;
import org.example.repository.IssueRepository.IssueRow;
import org.example.repository.ListRepository.ItemRow;
import org.example.repository.ListRepository.ListSummary;
import org.example.repository.MovementRepository.MovementRow;
import org.example.repository.ProductRepository.ProductRow;
import org.example.web.dto.Dto.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/** Преобразование строк из базы в объекты для браузера. */
public final class Views {

    private Views() {
    }

    public static String imageUrl(String fileName) {
        return fileName == null ? null : "/files/" + fileName;
    }

    public static String stockStatus(BigDecimal qty, BigDecimal min) {
        if (qty == null || qty.signum() <= 0) return "OUT";
        if (min != null && min.signum() > 0 && qty.compareTo(min) <= 0) return "LOW";
        return "AVAILABLE";
    }

    public static String stockStatusTitle(String status) {
        return switch (status) {
            case "OUT" -> "Нет в наличии";
            case "LOW" -> "Заканчивается";
            default -> "В наличии";
        };
    }

    public static ProductView product(ProductRow r) {
        Product p = r.product();
        return new ProductView(p.id(), p.sku(), p.name(), p.categoryId(), r.categoryName(), r.categoryColor(),
                p.description(), p.purchasePrice(), p.sellingPrice(), p.quantity(), p.minQuantity(), p.unit(),
                p.barcode(), p.location(), stockStatus(p.quantity(), p.minQuantity()), r.reservedQty(),
                Num.money(p.quantity().multiply(p.purchasePrice())), imageUrl(r.imageFile()), r.imageCount(),
                p.deleted(), p.createdAt(), p.updatedAt());
    }

    public static MovementView movement(MovementRow m) {
        return new MovementView(m.id(), m.productId(), m.productName(), m.productSku(), m.unit(),
                imageUrl(m.imageFile()), m.type().name(), m.type().title(), m.quantity(), m.balanceAfter(),
                m.unitPrice(), Num.money(m.quantity().abs().multiply(m.unitPrice())), m.note(), m.listId(),
                m.listName(), m.issueRecordId(), m.recipient(), m.userName(), m.createdAt());
    }

    public static ListSummaryView listSummary(ListSummary s) {
        var l = s.list();
        int progress = s.progress().multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.DOWN).intValue();
        // 100% показываем только для действительно полностью выданного списка
        if (progress >= 100 && s.issuedTotal().compareTo(s.requiredTotal()) < 0) progress = 99;
        return new ListSummaryView(l.id(), l.name(), l.recipient(), l.notes(), l.status().name(),
                l.status().title(), s.itemCount(), s.requiredTotal(), s.issuedTotal(), Num.money(s.amountTotal()),
                Num.money(s.issuedAmount()), s.shortageCount(), progress,
                s.previewImages().stream().map(Views::imageUrl).toList(), l.createdAt(), l.updatedAt(),
                l.completedAt(), l.cancelledAt(), s.lastIssueAt());
    }

    public static ListItemView listItem(ItemRow r) {
        var i = r.item();
        BigDecimal remaining = i.remainingQty();
        BigDecimal canIssue = remaining.min(r.stock()).max(BigDecimal.ZERO);
        return new ListItemView(i.id(), i.productId(), r.productName(), r.productSku(), r.unit(),
                imageUrl(r.imageFile()), r.categoryName(), i.requiredQty(), i.issuedQty(), remaining, r.stock(),
                canIssue, i.unitPrice(), Num.money(i.requiredQty().multiply(i.unitPrice())),
                remaining.compareTo(r.stock()) > 0, r.productDeleted(), i.note(), r.lastIssuedAt());
    }

    public static IssueView issue(IssueRow r, List<MovementView> lines) {
        return new IssueView(r.id(), r.listId(), r.listName(), r.recipient(), r.note(), r.totalQty(),
                Num.money(r.totalAmount()), r.lineCount(), r.userName(), r.createdAt(), lines);
    }

    public static ActivityView activity(ActivityRow a) {
        return new ActivityView(a.id(), a.action().name(), a.action().title(), a.entityType(), a.entityId(),
                a.title(), a.details(), a.userName(), a.createdAt());
    }
}
