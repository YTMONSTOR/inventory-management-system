package org.example.repository;

import org.example.domain.ActivityAction;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
public class ActivityRepository {

    public record ActivityRow(long id, ActivityAction action, String entityType, Long entityId, String title,
                              String details, String userName, LocalDateTime createdAt) {
    }

    public record Filter(List<ActivityAction> actions, LocalDateTime from, LocalDateTime to, String q,
                         int limit, int offset) {
    }

    private final JdbcClient jdbc;

    public ActivityRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(ActivityAction action, String entityType, Long entityId, String title, String details,
                       Long userId) {
        jdbc.sql("""
                INSERT INTO activity_logs (action, entity_type, entity_id, title, details, user_id)
                VALUES (:a, :et, :eid, :t, :d, :u)
                """).param("a", action.name()).param("et", entityType).param("eid", entityId, java.sql.Types.BIGINT)
                .param("t", title).param("d", details).param("u", userId, java.sql.Types.BIGINT).update();
    }

    public List<ActivityRow> find(Filter f) {
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        Map<String, Object> params = new LinkedHashMap<>();
        if (f.actions() != null && !f.actions().isEmpty()) {
            where.append(" AND a.action IN (:actions)");
            params.put("actions", f.actions().stream().map(Enum::name).toList());
        }
        if (f.from() != null) {
            where.append(" AND a.created_at >= :from");
            params.put("from", f.from());
        }
        if (f.to() != null) {
            where.append(" AND a.created_at < :to");
            params.put("to", f.to());
        }
        if (f.q() != null) {
            where.append(" AND (a.title ILIKE :q OR coalesce(a.details, '') ILIKE :q)");
            params.put("q", "%" + f.q() + "%");
        }
        params.put("limit", f.limit());
        params.put("offset", f.offset());
        return jdbc.sql("""
                SELECT a.*, u.full_name AS user_name FROM activity_logs a
                LEFT JOIN users u ON u.id = a.user_id
                """ + where + " ORDER BY a.created_at DESC, a.id DESC LIMIT :limit OFFSET :offset")
                .params(params)
                .query((rs, n) -> new ActivityRow(rs.getLong("id"), ActivityAction.valueOf(rs.getString("action")),
                        rs.getString("entity_type"), Rows.lng(rs, "entity_id"), rs.getString("title"),
                        rs.getString("details"), rs.getString("user_name"), Rows.ts(rs, "created_at")))
                .list();
    }
}
