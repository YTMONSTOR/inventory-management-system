package org.example.repository;

import org.example.domain.Entities.ProductList;
import org.example.domain.Entities.ProductListItem;
import org.example.domain.ListStatus;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class ListRepository {

    /** Список со сводными цифрами — для карточек в разделе «Списки к выдаче». */
    public record ListSummary(ProductList list, long itemCount, BigDecimal requiredTotal, BigDecimal issuedTotal,
                              BigDecimal amountTotal, BigDecimal issuedAmount, long shortageCount,
                              BigDecimal progress, List<String> previewImages, LocalDateTime lastIssueAt) {
    }

    /** Строка списка вместе с актуальными данными товара. */
    public record ItemRow(ProductListItem item, String productName, String productSku, String unit,
                          BigDecimal stock, BigDecimal currentPrice, String imageFile, String categoryName,
                          boolean productDeleted, LocalDateTime lastIssuedAt) {
    }

    static final RowMapper<ProductList> MAPPER = (rs, n) -> new ProductList(
            rs.getLong("id"), rs.getString("name"), rs.getString("recipient"), rs.getString("notes"),
            ListStatus.valueOf(rs.getString("status")), Rows.lng(rs, "user_id"), Rows.ts(rs, "created_at"),
            Rows.ts(rs, "updated_at"), Rows.ts(rs, "completed_at"), Rows.ts(rs, "cancelled_at"));

    private static final RowMapper<ProductListItem> ITEM_MAPPER = (rs, n) -> new ProductListItem(
            rs.getLong("id"), rs.getLong("list_id"), rs.getLong("product_id"), Rows.decNz(rs, "required_qty"),
            Rows.decNz(rs, "issued_qty"), Rows.decNz(rs, "unit_price"), rs.getString("note"), rs.getInt("sort_order"));

    private final JdbcClient jdbc;

    public ListRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<ListSummary> findSummaries(List<ListStatus> statuses, String q, int limit) {
        return findSummaries(statuses, q, null, limit);
    }

    public Optional<ListSummary> findSummary(long id) {
        return findSummaries(null, null, List.of(id), 1).stream().findFirst();
    }

    public List<ListSummary> findSummaries(List<ListStatus> statuses, String q, List<Long> ids, int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT l.*,
                       count(li.id)                                         AS item_count,
                       coalesce(sum(li.required_qty), 0)                    AS required_total,
                       coalesce(sum(li.issued_qty), 0)                      AS issued_total,
                       coalesce(sum(li.required_qty * li.unit_price), 0)    AS amount_total,
                       coalesce(sum(li.issued_qty * li.unit_price), 0)      AS issued_amount,
                       count(li.id) FILTER (WHERE li.required_qty - li.issued_qty > p.quantity) AS shortage_count,
                       coalesce(avg(li.issued_qty / li.required_qty), 0)    AS progress,
                       (SELECT array_to_string(array_agg(f), '|') FROM (
                            SELECT (SELECT i.file_name FROM product_images i WHERE i.product_id = x.product_id
                                     ORDER BY i.is_primary DESC, i.sort_order, i.id LIMIT 1) AS f
                            FROM product_list_items x WHERE x.list_id = l.id ORDER BY x.sort_order, x.id LIMIT 4) t
                         WHERE f IS NOT NULL)                               AS preview_images,
                       (SELECT max(r.created_at) FROM issue_records r WHERE r.list_id = l.id) AS last_issue_at
                FROM product_lists l
                LEFT JOIN product_list_items li ON li.list_id = l.id
                LEFT JOIN products p            ON p.id = li.product_id
                WHERE 1 = 1
                """);
        var spec = new java.util.LinkedHashMap<String, Object>();
        if (statuses != null && !statuses.isEmpty()) {
            sql.append(" AND l.status IN (:statuses)");
            spec.put("statuses", statuses.stream().map(Enum::name).toList());
        }
        if (ids != null) {
            if (ids.isEmpty()) return List.of();
            sql.append(" AND l.id IN (:ids)");
            spec.put("ids", ids);
        }
        if (q != null) {
            sql.append(" AND (l.name ILIKE :q OR coalesce(l.recipient, '') ILIKE :q OR coalesce(l.notes, '') ILIKE :q)");
            spec.put("q", "%" + q + "%");
        }
        sql.append(" GROUP BY l.id ORDER BY l.updated_at DESC, l.id DESC LIMIT :limit");
        spec.put("limit", limit);
        return jdbc.sql(sql.toString()).params(spec).query((rs, n) -> {
            String previews = rs.getString("preview_images");
            return new ListSummary(MAPPER.mapRow(rs, n), rs.getLong("item_count"), Rows.decNz(rs, "required_total"),
                    Rows.decNz(rs, "issued_total"), Rows.decNz(rs, "amount_total"), Rows.decNz(rs, "issued_amount"),
                    rs.getLong("shortage_count"), Rows.decNz(rs, "progress"),
                    previews == null || previews.isBlank() ? List.of() : List.of(previews.split("\\|")),
                    Rows.ts(rs, "last_issue_at"));
        }).list();
    }

    public Optional<ProductList> findById(long id) {
        return jdbc.sql("SELECT * FROM product_lists WHERE id = :id").param("id", id).query(MAPPER).optional();
    }

    public Optional<ProductList> lockById(long id) {
        return jdbc.sql("SELECT * FROM product_lists WHERE id = :id FOR UPDATE").param("id", id).query(MAPPER).optional();
    }

    public List<ItemRow> findItemRows(long listId) {
        return jdbc.sql("""
                SELECT li.*, p.name AS product_name, p.sku AS product_sku, p.unit, p.quantity AS stock,
                       p.purchase_price AS current_price, p.deleted AS product_deleted, c.name AS category_name,
                       (SELECT i.file_name FROM product_images i WHERE i.product_id = p.id
                         ORDER BY i.is_primary DESC, i.sort_order, i.id LIMIT 1) AS image_file,
                       (SELECT max(m.created_at) FROM inventory_movements m
                         WHERE m.list_item_id = li.id AND m.movement_type = 'ISSUE') AS last_issued_at
                FROM product_list_items li
                JOIN products p        ON p.id = li.product_id
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE li.list_id = :id
                ORDER BY li.sort_order, li.id
                """).param("id", listId).query((rs, n) -> new ItemRow(ITEM_MAPPER.mapRow(rs, n),
                rs.getString("product_name"), rs.getString("product_sku"), rs.getString("unit"),
                Rows.decNz(rs, "stock"), Rows.decNz(rs, "current_price"), rs.getString("image_file"),
                rs.getString("category_name"), rs.getBoolean("product_deleted"), Rows.ts(rs, "last_issued_at"))).list();
    }

    public List<ProductListItem> lockItems(long listId) {
        return jdbc.sql("SELECT * FROM product_list_items WHERE list_id = :id ORDER BY product_id FOR UPDATE")
                .param("id", listId).query(ITEM_MAPPER).list();
    }

    public long insert(String name, String recipient, String notes, ListStatus status, Long userId) {
        return jdbc.sql("""
                INSERT INTO product_lists (name, recipient, notes, status, user_id)
                VALUES (:name, :recipient, :notes, :status, :user) RETURNING id
                """).param("name", name).param("recipient", recipient).param("notes", notes)
                .param("status", status.name()).param("user", userId, java.sql.Types.BIGINT)
                .query(Long.class).single();
    }

    public void updateHeader(long id, String name, String recipient, String notes) {
        jdbc.sql("""
                UPDATE product_lists SET name = :name, recipient = :recipient, notes = :notes, updated_at = now()
                WHERE id = :id
                """).param("name", name).param("recipient", recipient).param("notes", notes).param("id", id).update();
    }

    public void updateStatus(long id, ListStatus status) {
        jdbc.sql("""
                UPDATE product_lists SET status = :s, updated_at = now(),
                       completed_at = CASE WHEN :s = 'COMPLETED' THEN now() ELSE NULL END,
                       cancelled_at = CASE WHEN :s = 'CANCELLED' THEN now() ELSE NULL END
                WHERE id = :id
                """).param("s", status.name()).param("id", id).update();
    }

    public void touch(long id) {
        jdbc.sql("UPDATE product_lists SET updated_at = now() WHERE id = :id").param("id", id).update();
    }

    public long insertItem(long listId, long productId, BigDecimal requiredQty, BigDecimal unitPrice, String note,
                           int sortOrder) {
        return jdbc.sql("""
                INSERT INTO product_list_items (list_id, product_id, required_qty, unit_price, note, sort_order)
                VALUES (:l, :p, :q, :price, :note, :so) RETURNING id
                """).param("l", listId).param("p", productId).param("q", requiredQty).param("price", unitPrice)
                .param("note", note).param("so", sortOrder).query(Long.class).single();
    }

    public void updateItem(long itemId, BigDecimal requiredQty, BigDecimal unitPrice, String note, int sortOrder) {
        jdbc.sql("""
                UPDATE product_list_items SET required_qty = :q, unit_price = :price, note = :note, sort_order = :so
                WHERE id = :id
                """).param("q", requiredQty).param("price", unitPrice).param("note", note).param("so", sortOrder)
                .param("id", itemId).update();
    }

    public void addIssued(long itemId, BigDecimal qty) {
        jdbc.sql("UPDATE product_list_items SET issued_qty = issued_qty + :q WHERE id = :id")
                .param("q", qty).param("id", itemId).update();
    }

    public void deleteItem(long itemId) {
        jdbc.sql("DELETE FROM product_list_items WHERE id = :id").param("id", itemId).update();
    }

    public void delete(long id) {
        jdbc.sql("DELETE FROM product_lists WHERE id = :id").param("id", id).update();
    }

    public long countIssues(long listId) {
        return jdbc.sql("SELECT count(*) FROM issue_records WHERE list_id = :id").param("id", listId)
                .query(Long.class).single();
    }

    public List<ListSummary> findForProduct(long productId) {
        List<Long> ids = jdbc.sql("""
                SELECT DISTINCT l.id FROM product_lists l JOIN product_list_items li ON li.list_id = l.id
                WHERE li.product_id = :p
                """).param("p", productId).query(Long.class).list();
        return findSummaries(null, null, ids, 20);
    }
}
