package org.example.repository;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.Map;

/** Запомненные соответствия «как пишут клиенты» → товар. */
@Repository
public class AliasRepository {

    private final JdbcClient jdbc;

    public AliasRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Long> findAll() {
        Map<String, Long> map = new HashMap<>();
        jdbc.sql("""
                SELECT a.phrase, a.product_id FROM product_aliases a
                JOIN products p ON p.id = a.product_id AND p.deleted = FALSE
                """).query(rs -> {
            map.put(rs.getString(1), rs.getLong(2));
        });
        return map;
    }

    public void save(String phrase, long productId) {
        jdbc.sql("""
                INSERT INTO product_aliases (phrase, product_id) VALUES (:phrase, :pid)
                ON CONFLICT (phrase) DO UPDATE
                   SET product_id = EXCLUDED.product_id,
                       uses = CASE WHEN product_aliases.product_id = EXCLUDED.product_id THEN product_aliases.uses + 1 ELSE 1 END,
                       updated_at = now()
                """).param("phrase", phrase).param("pid", productId).update();
    }
}
