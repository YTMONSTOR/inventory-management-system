package org.example.repository;

import org.example.domain.Entities.Category;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public class CategoryRepository {

    /** Категория вместе со сводкой по товарам. */
    public record CategoryStats(Category category, long productCount, BigDecimal totalQuantity,
                                BigDecimal totalValue, long lowStockCount) {
    }

    private static final RowMapper<Category> MAPPER = (rs, n) -> new Category(
            rs.getLong("id"), rs.getString("name"), rs.getString("description"), rs.getString("color"),
            Rows.ts(rs, "created_at"), Rows.ts(rs, "updated_at"));

    private final JdbcClient jdbc;

    public CategoryRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<CategoryStats> findAllWithStats() {
        return jdbc.sql("""
                SELECT c.*,
                       count(p.id)                                         AS product_count,
                       coalesce(sum(p.quantity), 0)                        AS total_quantity,
                       coalesce(sum(p.quantity * p.purchase_price), 0)     AS total_value,
                       count(p.id) FILTER (WHERE p.quantity <= p.min_quantity) AS low_count
                FROM categories c
                LEFT JOIN products p ON p.category_id = c.id AND p.deleted = FALSE
                GROUP BY c.id
                ORDER BY lower(c.name)
                """).query((rs, n) -> new CategoryStats(MAPPER.mapRow(rs, n), rs.getLong("product_count"),
                Rows.decNz(rs, "total_quantity"), Rows.decNz(rs, "total_value"), rs.getLong("low_count")))
                .list();
    }

    public Optional<Category> findById(long id) {
        return jdbc.sql("SELECT * FROM categories WHERE id = :id").param("id", id).query(MAPPER).optional();
    }

    public boolean existsByName(String name, Long exceptId) {
        return jdbc.sql("SELECT count(*) FROM categories WHERE lower(name) = lower(:name) AND id <> :id")
                .param("name", name).param("id", exceptId == null ? -1L : exceptId)
                .query(Long.class).single() > 0;
    }

    public long insert(String name, String description, String color) {
        return jdbc.sql("""
                INSERT INTO categories (name, description, color) VALUES (:name, :description, :color)
                RETURNING id
                """).param("name", name).param("description", description).param("color", color)
                .query(Long.class).single();
    }

    public void update(long id, String name, String description, String color) {
        jdbc.sql("""
                UPDATE categories SET name = :name, description = :description, color = :color, updated_at = now()
                WHERE id = :id
                """).param("name", name).param("description", description).param("color", color).param("id", id)
                .update();
    }

    public void delete(long id) {
        jdbc.sql("DELETE FROM categories WHERE id = :id").param("id", id).update();
    }
}
