package org.example.repository;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Сводные показатели для главной страницы. Все цифры считаются по реальным данным. */
@Repository
public class StatsRepository {

    public record Kpi(long totalProducts, long inStockProducts, BigDecimal totalUnits, BigDecimal inventoryValue,
                      long lowCount, long outCount, BigDecimal issuedTotal, BigDecimal issuedMonth,
                      BigDecimal receivedMonth, long openLists, long draftLists, BigDecimal pendingUnits,
                      BigDecimal pendingAmount, long pendingShortage) {
    }

    public record CategoryValue(String name, String color, long products, BigDecimal value) {
    }

    public record TopProduct(long id, String name, String unit, String imageFile, BigDecimal quantity) {
    }

    private final JdbcClient jdbc;

    public StatsRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Kpi kpi() {
        return jdbc.sql("""
                WITH p AS (SELECT * FROM products WHERE deleted = FALSE),
                     open_items AS (
                        SELECT li.*, pr.quantity AS stock FROM product_list_items li
                        JOIN product_lists l ON l.id = li.list_id
                        JOIN products pr     ON pr.id = li.product_id
                        WHERE l.status IN ('PENDING', 'PARTIAL') AND li.issued_qty < li.required_qty)
                SELECT
                  (SELECT count(*) FROM p)                                                   AS total_products,
                  (SELECT count(*) FROM p WHERE quantity > 0)                                AS in_stock_products,
                  (SELECT coalesce(sum(quantity), 0) FROM p)                                 AS total_units,
                  (SELECT coalesce(sum(quantity * purchase_price), 0) FROM p)                AS inventory_value,
                  (SELECT count(*) FROM p WHERE quantity > 0 AND min_quantity > 0 AND quantity <= min_quantity) AS low_count,
                  (SELECT count(*) FROM p WHERE quantity <= 0)                               AS out_count,
                  (SELECT coalesce(-sum(quantity), 0) FROM inventory_movements WHERE movement_type = 'ISSUE') AS issued_total,
                  (SELECT coalesce(-sum(quantity), 0) FROM inventory_movements
                     WHERE movement_type = 'ISSUE' AND created_at >= date_trunc('month', now()))             AS issued_month,
                  (SELECT coalesce(sum(quantity), 0) FROM inventory_movements
                     WHERE movement_type IN ('INITIAL', 'RECEIPT') AND created_at >= date_trunc('month', now())) AS received_month,
                  (SELECT count(*) FROM product_lists WHERE status IN ('PENDING', 'PARTIAL'))                AS open_lists,
                  (SELECT count(*) FROM product_lists WHERE status = 'DRAFT')                                AS draft_lists,
                  (SELECT coalesce(sum(required_qty - issued_qty), 0) FROM open_items)                       AS pending_units,
                  (SELECT coalesce(sum((required_qty - issued_qty) * unit_price), 0) FROM open_items)        AS pending_amount,
                  (SELECT count(*) FROM open_items WHERE required_qty - issued_qty > stock)                  AS pending_shortage
                """).query((rs, n) -> new Kpi(rs.getLong("total_products"), rs.getLong("in_stock_products"),
                Rows.decNz(rs, "total_units"), Rows.decNz(rs, "inventory_value"), rs.getLong("low_count"),
                rs.getLong("out_count"), Rows.decNz(rs, "issued_total"), Rows.decNz(rs, "issued_month"),
                Rows.decNz(rs, "received_month"), rs.getLong("open_lists"), rs.getLong("draft_lists"),
                Rows.decNz(rs, "pending_units"), Rows.decNz(rs, "pending_amount"), rs.getLong("pending_shortage")))
                .single();
    }

    public List<CategoryValue> valueByCategory() {
        return jdbc.sql("""
                SELECT coalesce(c.name, 'Без категории') AS name, coalesce(c.color, '#8A94A6') AS color,
                       count(p.id) AS products, coalesce(sum(p.quantity * p.purchase_price), 0) AS value
                FROM products p LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.deleted = FALSE
                GROUP BY c.name, c.color
                ORDER BY value DESC, name
                """).query((rs, n) -> new CategoryValue(rs.getString("name"), rs.getString("color"),
                rs.getLong("products"), Rows.decNz(rs, "value"))).list();
    }

    public List<TopProduct> topIssued(int days, int limit) {
        return jdbc.sql("""
                SELECT p.id, p.name, p.unit,
                       (SELECT i.file_name FROM product_images i WHERE i.product_id = p.id
                         ORDER BY i.is_primary DESC, i.sort_order, i.id LIMIT 1) AS image_file,
                       -sum(m.quantity) AS qty
                FROM inventory_movements m JOIN products p ON p.id = m.product_id
                WHERE m.movement_type = 'ISSUE' AND m.created_at >= now() - make_interval(days => :days)
                GROUP BY p.id
                ORDER BY qty DESC
                LIMIT :limit
                """).param("days", days).param("limit", limit)
                .query((rs, n) -> new TopProduct(rs.getLong("id"), rs.getString("name"), rs.getString("unit"),
                        rs.getString("image_file"), Rows.decNz(rs, "qty"))).list();
    }

    public Map<String, Long> statusDistribution() {
        Map<String, Long> m = new LinkedHashMap<>();
        jdbc.sql("""
                SELECT count(*) FILTER (WHERE quantity > 0 AND NOT (min_quantity > 0 AND quantity <= min_quantity)) AS available,
                       count(*) FILTER (WHERE quantity > 0 AND min_quantity > 0 AND quantity <= min_quantity)       AS low,
                       count(*) FILTER (WHERE quantity <= 0)                                                        AS out
                FROM products WHERE deleted = FALSE
                """).query(rs -> {
            m.put("AVAILABLE", rs.getLong("available"));
            m.put("LOW", rs.getLong("low"));
            m.put("OUT", rs.getLong("out"));
        });
        return m;
    }
}
