package org.example.repository;

import org.example.domain.Entities.ProductImage;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class ImageRepository {

    private static final RowMapper<ProductImage> MAPPER = (rs, n) -> new ProductImage(
            rs.getLong("id"), rs.getLong("product_id"), rs.getString("file_name"), rs.getString("original_name"),
            rs.getString("content_type"), rs.getLong("size_bytes"), rs.getBoolean("is_primary"),
            rs.getInt("sort_order"), Rows.ts(rs, "created_at"));

    private final JdbcClient jdbc;

    public ImageRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<ProductImage> findByProduct(long productId) {
        return jdbc.sql("SELECT * FROM product_images WHERE product_id = :id ORDER BY is_primary DESC, sort_order, id")
                .param("id", productId).query(MAPPER).list();
    }

    public Optional<ProductImage> findById(long id) {
        return jdbc.sql("SELECT * FROM product_images WHERE id = :id").param("id", id).query(MAPPER).optional();
    }

    public Optional<ProductImage> findByFileName(String fileName) {
        return jdbc.sql("SELECT * FROM product_images WHERE file_name = :f").param("f", fileName).query(MAPPER).optional();
    }

    public long insert(long productId, String fileName, String originalName, String contentType, long size,
                       boolean primary, int sortOrder) {
        return jdbc.sql("""
                INSERT INTO product_images (product_id, file_name, original_name, content_type, size_bytes, is_primary, sort_order)
                VALUES (:p, :f, :o, :ct, :s, :pr, :so) RETURNING id
                """).param("p", productId).param("f", fileName).param("o", originalName).param("ct", contentType)
                .param("s", size).param("pr", primary).param("so", sortOrder).query(Long.class).single();
    }

    public int nextSortOrder(long productId) {
        return jdbc.sql("SELECT coalesce(max(sort_order), -1) + 1 FROM product_images WHERE product_id = :p")
                .param("p", productId).query(Integer.class).single();
    }

    public void setPrimary(long productId, long imageId) {
        jdbc.sql("UPDATE product_images SET is_primary = FALSE WHERE product_id = :p AND is_primary")
                .param("p", productId).update();
        jdbc.sql("UPDATE product_images SET is_primary = TRUE WHERE id = :id AND product_id = :p")
                .param("id", imageId).param("p", productId).update();
    }

    public void delete(long id) {
        jdbc.sql("DELETE FROM product_images WHERE id = :id").param("id", id).update();
    }
}
