package org.example.repository;

import org.example.domain.MovementType;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
public class MovementRepository {

    /** Движение со сведениями о товаре и списке — для журналов. */
    public record MovementRow(long id, long productId, String productName, String productSku, String unit,
                              String imageFile, MovementType type, BigDecimal quantity, BigDecimal balanceAfter,
                              BigDecimal unitPrice, String note, Long listId, String listName,
                              Long issueRecordId, String recipient, String userName, LocalDateTime createdAt) {
    }

    /** Фильтр журнала движений. Пустые поля не учитываются. */
    public record Filter(Long productId, MovementType type, LocalDateTime from, LocalDateTime to, String q,
                         Long issueRecordId, int limit) {
    }

    private static final RowMapper<MovementRow> MAPPER = (rs, n) -> new MovementRow(
            rs.getLong("id"), rs.getLong("product_id"), rs.getString("product_name"), rs.getString("product_sku"),
            rs.getString("unit"), rs.getString("image_file"), MovementType.valueOf(rs.getString("movement_type")),
            Rows.decNz(rs, "quantity"), Rows.decNz(rs, "balance_after"), Rows.decNz(rs, "unit_price"),
            rs.getString("note"), Rows.lng(rs, "list_id"), rs.getString("list_name"),
            Rows.lng(rs, "issue_record_id"), rs.getString("recipient"), rs.getString("user_name"),
            Rows.ts(rs, "created_at"));

    private final JdbcClient jdbc;

    public MovementRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long insert(long productId, MovementType type, BigDecimal quantity, BigDecimal balanceAfter,
                       BigDecimal unitPrice, String note, Long listId, Long listItemId, Long issueRecordId,
                       Long userId) {
        return jdbc.sql("""
                INSERT INTO inventory_movements (product_id, movement_type, quantity, balance_after, unit_price, note,
                                                 list_id, list_item_id, issue_record_id, user_id)
                VALUES (:p, :t, :q, :b, :price, :note, :list, :item, :issue, :user)
                RETURNING id
                """)
                .param("p", productId).param("t", type.name()).param("q", quantity).param("b", balanceAfter)
                .param("price", unitPrice).param("note", note)
                .param("list", listId, java.sql.Types.BIGINT).param("item", listItemId, java.sql.Types.BIGINT)
                .param("issue", issueRecordId, java.sql.Types.BIGINT).param("user", userId, java.sql.Types.BIGINT)
                .query(Long.class).single();
    }

    public List<MovementRow> find(Filter f) {
        StringBuilder sql = new StringBuilder("""
                SELECT m.*, p.name AS product_name, p.sku AS product_sku, p.unit,
                       (SELECT i.file_name FROM product_images i WHERE i.product_id = p.id
                         ORDER BY i.is_primary DESC, i.sort_order, i.id LIMIT 1) AS image_file,
                       l.name AS list_name, r.recipient, u.full_name AS user_name
                FROM inventory_movements m
                JOIN products p           ON p.id = m.product_id
                LEFT JOIN product_lists l ON l.id = m.list_id
                LEFT JOIN issue_records r ON r.id = m.issue_record_id
                LEFT JOIN users u         ON u.id = m.user_id
                WHERE 1 = 1
                """);
        Map<String, Object> params = new LinkedHashMap<>();
        if (f.productId() != null) {
            sql.append(" AND m.product_id = :productId");
            params.put("productId", f.productId());
        }
        if (f.type() != null) {
            sql.append(" AND m.movement_type = :type");
            params.put("type", f.type().name());
        }
        if (f.issueRecordId() != null) {
            sql.append(" AND m.issue_record_id = :issueId");
            params.put("issueId", f.issueRecordId());
        }
        if (f.from() != null) {
            sql.append(" AND m.created_at >= :from");
            params.put("from", f.from());
        }
        if (f.to() != null) {
            sql.append(" AND m.created_at < :to");
            params.put("to", f.to());
        }
        if (f.q() != null) {
            sql.append(" AND (p.name ILIKE :q OR p.sku ILIKE :q OR coalesce(m.note, '') ILIKE :q"
                    + " OR coalesce(l.name, '') ILIKE :q OR coalesce(r.recipient, '') ILIKE :q)");
            params.put("q", "%" + f.q() + "%");
        }
        sql.append(" ORDER BY m.created_at DESC, m.id DESC LIMIT :limit");
        params.put("limit", f.limit());
        return jdbc.sql(sql.toString()).params(params).query(MAPPER).list();
    }

    /** Итоги по товару: сколько всего пришло и сколько выдано. */
    public Map<String, BigDecimal> totalsForProduct(long productId) {
        Map<String, BigDecimal> m = new LinkedHashMap<>();
        jdbc.sql("""
                SELECT coalesce(sum(quantity) FILTER (WHERE movement_type IN ('INITIAL', 'RECEIPT')), 0)  AS received,
                       coalesce(-sum(quantity) FILTER (WHERE movement_type = 'ISSUE'), 0)                AS issued,
                       coalesce(sum(quantity) FILTER (WHERE movement_type = 'ADJUSTMENT'), 0)            AS adjusted,
                       count(*)                                                                          AS cnt
                FROM inventory_movements WHERE product_id = :p
                """).param("p", productId).query(rs -> {
            m.put("received", Rows.decNz(rs, "received"));
            m.put("issued", Rows.decNz(rs, "issued"));
            m.put("adjusted", Rows.decNz(rs, "adjusted"));
            m.put("count", BigDecimal.valueOf(rs.getLong("cnt")));
        });
        return m;
    }

    /** Приход и выдача по дням за последние N дней (для графика). */
    public List<DailyFlow> dailyFlow(int days) {
        return jdbc.sql("""
                SELECT d::date AS day,
                       coalesce(sum(m.quantity) FILTER (WHERE m.movement_type IN ('INITIAL', 'RECEIPT')), 0) AS received,
                       coalesce(-sum(m.quantity) FILTER (WHERE m.movement_type = 'ISSUE'), 0)               AS issued,
                       coalesce(sum(m.quantity * m.unit_price) FILTER (WHERE m.movement_type IN ('INITIAL', 'RECEIPT')), 0) AS received_value,
                       coalesce(-sum(m.quantity * m.unit_price) FILTER (WHERE m.movement_type = 'ISSUE'), 0)               AS issued_value
                FROM generate_series(current_date - (:days - 1), current_date, interval '1 day') AS d
                LEFT JOIN inventory_movements m ON m.created_at::date = d::date
                GROUP BY d
                ORDER BY d
                """).param("days", days).query((rs, n) -> new DailyFlow(
                rs.getDate("day").toLocalDate(), Rows.decNz(rs, "received"), Rows.decNz(rs, "issued"),
                Rows.decNz(rs, "received_value"), Rows.decNz(rs, "issued_value"))).list();
    }

    public record DailyFlow(java.time.LocalDate day, BigDecimal received, BigDecimal issued,
                            BigDecimal receivedValue, BigDecimal issuedValue) {
    }

    public BigDecimal totalIssued() {
        return jdbc.sql("SELECT coalesce(-sum(quantity), 0) FROM inventory_movements WHERE movement_type = 'ISSUE'")
                .query(BigDecimal.class).single();
    }

    public List<Long> idsForIssue(long issueRecordId) {
        return new ArrayList<>(jdbc.sql("SELECT id FROM inventory_movements WHERE issue_record_id = :i")
                .param("i", issueRecordId).query(Long.class).list());
    }
}
