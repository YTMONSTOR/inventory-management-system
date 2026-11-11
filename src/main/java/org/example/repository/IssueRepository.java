package org.example.repository;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
public class IssueRepository {

    public record IssueRow(long id, Long listId, String listName, String recipient, String note,
                           BigDecimal totalQty, BigDecimal totalAmount, long lineCount, String userName,
                           LocalDateTime createdAt) {
    }

    private final JdbcClient jdbc;

    public IssueRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long insert(Long listId, String recipient, String note, Long userId) {
        return jdbc.sql("""
                INSERT INTO issue_records (list_id, recipient, note, user_id) VALUES (:l, :r, :n, :u) RETURNING id
                """).param("l", listId, java.sql.Types.BIGINT).param("r", recipient).param("n", note)
                .param("u", userId, java.sql.Types.BIGINT).query(Long.class).single();
    }

    public void setTotals(long id, BigDecimal totalQty, BigDecimal totalAmount) {
        jdbc.sql("UPDATE issue_records SET total_qty = :q, total_amount = :a WHERE id = :id")
                .param("q", totalQty).param("a", totalAmount).param("id", id).update();
    }

    public List<IssueRow> find(LocalDateTime from, LocalDateTime to, String q, Long listId, int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT r.*, l.name AS list_name, u.full_name AS user_name,
                       (SELECT count(*) FROM inventory_movements m WHERE m.issue_record_id = r.id) AS line_count
                FROM issue_records r
                LEFT JOIN product_lists l ON l.id = r.list_id
                LEFT JOIN users u         ON u.id = r.user_id
                WHERE 1 = 1
                """);
        Map<String, Object> params = new LinkedHashMap<>();
        if (from != null) {
            sql.append(" AND r.created_at >= :from");
            params.put("from", from);
        }
        if (to != null) {
            sql.append(" AND r.created_at < :to");
            params.put("to", to);
        }
        if (listId != null) {
            sql.append(" AND r.list_id = :listId");
            params.put("listId", listId);
        }
        if (q != null) {
            sql.append("""
                     AND (coalesce(l.name, '') ILIKE :q OR coalesce(r.recipient, '') ILIKE :q
                          OR coalesce(r.note, '') ILIKE :q
                          OR EXISTS (SELECT 1 FROM inventory_movements m JOIN products p ON p.id = m.product_id
                                     WHERE m.issue_record_id = r.id AND (p.name ILIKE :q OR p.sku ILIKE :q)))
                    """);
            params.put("q", "%" + q + "%");
        }
        sql.append(" ORDER BY r.created_at DESC, r.id DESC LIMIT :limit");
        params.put("limit", limit);
        return jdbc.sql(sql.toString()).params(params).query((rs, n) -> new IssueRow(
                rs.getLong("id"), Rows.lng(rs, "list_id"), rs.getString("list_name"), rs.getString("recipient"),
                rs.getString("note"), Rows.decNz(rs, "total_qty"), Rows.decNz(rs, "total_amount"),
                rs.getLong("line_count"), rs.getString("user_name"), Rows.ts(rs, "created_at"))).list();
    }
}
