package org.example.domain;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Сущности базы данных. Каждая запись соответствует одной таблице.
 * Доступ к данным выполняется через репозитории на Spring JDBC,
 * поэтому весь SQL явный и проверяемый.
 */
public final class Entities {

    private Entities() {
    }

    public record User(Long id, String username, String fullName, String position, String phone,
                       LocalDateTime createdAt) {
    }

    public record Category(Long id, String name, String description, String color,
                           LocalDateTime createdAt, LocalDateTime updatedAt) {
    }

    public record Product(Long id, String sku, String name, Long categoryId, String description,
                          BigDecimal purchasePrice, BigDecimal sellingPrice, BigDecimal quantity,
                          BigDecimal minQuantity, String unit, String barcode, String location,
                          boolean deleted, LocalDateTime createdAt, LocalDateTime updatedAt) {
    }

    public record ProductImage(Long id, Long productId, String fileName, String originalName,
                               String contentType, long sizeBytes, boolean primary, int sortOrder,
                               LocalDateTime createdAt) {
    }

    public record InventoryMovement(Long id, Long productId, MovementType type, BigDecimal quantity,
                                    BigDecimal balanceAfter, BigDecimal unitPrice, String note,
                                    Long listId, Long listItemId, Long issueRecordId, Long userId,
                                    LocalDateTime createdAt) {
    }

    public record ProductList(Long id, String name, String recipient, String notes, ListStatus status,
                              Long userId, LocalDateTime createdAt, LocalDateTime updatedAt,
                              LocalDateTime completedAt, LocalDateTime cancelledAt) {
    }

    public record ProductListItem(Long id, Long listId, Long productId, BigDecimal requiredQty,
                                  BigDecimal issuedQty, BigDecimal unitPrice, String note, int sortOrder) {
        public BigDecimal remainingQty() {
            return requiredQty.subtract(issuedQty);
        }
    }

    public record IssueRecord(Long id, Long listId, String recipient, String note, BigDecimal totalQty,
                              BigDecimal totalAmount, Long userId, LocalDateTime createdAt) {
    }

    public record ActivityLog(Long id, ActivityAction action, String entityType, Long entityId,
                              String title, String details, Long userId, LocalDateTime createdAt) {
    }
}
