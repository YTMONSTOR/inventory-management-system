package org.example.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Объекты, которыми обмениваются браузер и сервер (JSON). */
public final class Dto {

    private Dto() {
    }

    // ------------------------------------------------------------------ запросы

    public record CategoryRequest(
            @NotBlank(message = "Введите название категории") @Size(max = 100, message = "Название слишком длинное") String name,
            @Size(max = 500, message = "Описание слишком длинное") String description,
            String color) {
    }

    public record ProductRequest(
            @Size(max = 40, message = "Код товара слишком длинный") String sku,
            @NotBlank(message = "Введите название товара") @Size(max = 200, message = "Название слишком длинное") String name,
            Long categoryId,
            String description,
            @NotNull(message = "Укажите цену закупки") @DecimalMin(value = "0", message = "Цена не может быть отрицательной") BigDecimal purchasePrice,
            @DecimalMin(value = "0", message = "Цена продажи не может быть отрицательной") BigDecimal sellingPrice,
            @DecimalMin(value = "0", message = "Количество не может быть отрицательным") BigDecimal initialQuantity,
            @DecimalMin(value = "0", message = "Минимальный остаток не может быть отрицательным") BigDecimal minQuantity,
            @NotBlank(message = "Укажите единицу измерения") @Size(max = 20) String unit,
            @Size(max = 64, message = "Штрихкод слишком длинный") String barcode,
            @Size(max = 100) String location) {
    }

    public record StockRequest(
            @NotNull(message = "Выберите товар") Long productId,
            @NotNull(message = "Укажите количество") BigDecimal quantity,
            BigDecimal unitPrice,
            @Size(max = 500) String note,
            @Size(max = 200) String recipient) {
    }

    public record AdjustRequest(
            @NotNull(message = "Выберите товар") Long productId,
            @NotNull(message = "Укажите фактический остаток") @DecimalMin(value = "0", message = "Остаток не может быть отрицательным") BigDecimal newQuantity,
            @Size(max = 500) String note) {
    }

    public record ListItemRequest(
            @NotNull(message = "Выберите товар") Long productId,
            @NotNull(message = "Укажите количество") BigDecimal requiredQty,
            @Size(max = 300) String note) {
    }

    public record ListRequest(
            @NotBlank(message = "Введите название списка") @Size(max = 200, message = "Название слишком длинное") String name,
            @Size(max = 200) String recipient,
            String notes,
            String status,
            @Valid List<ListItemRequest> items) {
    }

    public record IssueLine(@NotNull Long itemId, @NotNull BigDecimal quantity) {
    }

    public record IssueRequest(
            @NotEmpty(message = "Укажите, что выдать") @Valid List<IssueLine> items,
            @Size(max = 500) String note,
            @Size(max = 200) String recipient) {
    }

    public record AiParseRequest(
            @NotBlank(message = "Вставьте текст сообщения") @Size(max = 8000, message = "Сообщение слишком длинное — разделите его на части") String text) {
    }

    public record StatusRequest(@NotBlank String status) {
    }

    public record ProfileRequest(
            @NotBlank(message = "Введите имя") @Size(max = 120) String fullName,
            @Size(max = 120) String position,
            @Size(max = 40) String phone) {
    }

    // ------------------------------------------------------------------ ответы

    public record CategoryView(long id, String name, String description, String color, long productCount,
                               BigDecimal totalQuantity, BigDecimal totalValue, long lowStockCount,
                               LocalDateTime createdAt) {
    }

    public record ProductView(long id, String sku, String name, Long categoryId, String categoryName,
                              String categoryColor, String description, BigDecimal purchasePrice,
                              BigDecimal sellingPrice, BigDecimal quantity, BigDecimal minQuantity, String unit,
                              String barcode, String location, String status, BigDecimal reservedQty,
                              BigDecimal stockValue, String imageUrl, long imageCount, boolean deleted,
                              LocalDateTime createdAt, LocalDateTime updatedAt) {
    }

    public record ImageView(long id, String url, String originalName, boolean primary, long sizeBytes) {
    }

    public record MovementView(long id, long productId, String productName, String productSku, String unit,
                               String imageUrl, String type, String typeTitle, BigDecimal quantity,
                               BigDecimal balanceAfter, BigDecimal unitPrice, BigDecimal amount, String note,
                               Long listId, String listName, Long issueRecordId, String recipient,
                               String userName, LocalDateTime createdAt) {
    }

    public record ListSummaryView(long id, String name, String recipient, String notes, String status,
                                  String statusTitle, long itemCount, BigDecimal requiredTotal,
                                  BigDecimal issuedTotal, BigDecimal amountTotal, BigDecimal issuedAmount,
                                  long shortageCount, int progress, List<String> previewImages,
                                  LocalDateTime createdAt, LocalDateTime updatedAt, LocalDateTime completedAt,
                                  LocalDateTime cancelledAt, LocalDateTime lastIssueAt) {
    }

    public record ListItemView(long id, long productId, String productName, String productSku, String unit,
                               String imageUrl, String categoryName, BigDecimal requiredQty, BigDecimal issuedQty,
                               BigDecimal remainingQty, BigDecimal stock, BigDecimal canIssueQty,
                               BigDecimal unitPrice, BigDecimal lineTotal, boolean shortage, boolean productDeleted,
                               String note, LocalDateTime lastIssuedAt) {
    }

    public record IssueView(long id, Long listId, String listName, String recipient, String note,
                            BigDecimal totalQty, BigDecimal totalAmount, long lineCount, String userName,
                            LocalDateTime createdAt, List<MovementView> lines) {
    }

    public record ListDetailView(ListSummaryView summary, List<ListItemView> items, List<IssueView> issues) {
    }

    public record ProductDetailView(ProductView product, List<ImageView> images, BigDecimal totalReceived,
                                    BigDecimal totalIssued, BigDecimal totalAdjusted, long movementCount,
                                    List<MovementView> movements, List<ListSummaryView> lists) {
    }

    public record ActivityView(long id, String action, String actionTitle, String entityType, Long entityId,
                               String title, String details, String userName, LocalDateTime createdAt) {
    }

    public record ProfileView(long id, String username, String fullName, String position, String phone) {
    }

    public record NotificationView(String kind, String level, String title, String text, String link,
                                   LocalDateTime at) {
    }

    public record SearchResult(List<ProductView> products, List<ListSummaryView> lists) {
    }

    public record ErrorResponse(String message, Map<String, String> fields) {
    }
}
