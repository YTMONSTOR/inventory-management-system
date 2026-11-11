package org.example.repository;

import org.example.domain.Entities.Product;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class ProductRepository {

    /** Строка каталога: товар + категория + главное фото + сколько ждёт выдачи по спискам. */
    public record ProductRow(Product product, String categoryName, String categoryColor, String imageFile,
                             long imageCount, BigDecimal reservedQty) {
    }

    static final RowMapper<Product> MAPPER = (rs, n) -> new Product(
            rs.getLong("id"), rs.getString("sku"), rs.getString("name"), Rows.lng(rs, "category_id"),
            rs.getString("description"), Rows.decNz(rs, "purchase_price"), Rows.dec(rs, "selling_price"),
            Rows.decNz(rs, "quantity"), Rows.decNz(rs, "min_quantity"), rs.getString("unit"),
            rs.getString("barcode"), rs.getString("location"), rs.getBoolean("deleted"),
            Rows.ts(rs, "created_at"), Rows.ts(rs, "updated_at"));

    private static final String ROW_SELECT = """
            SELECT p.*,
                   c.name  AS category_name,
                   c.color AS category_color,
                   (SELECT i.file_name FROM product_images i WHERE i.product_id = p.id
                     ORDER BY i.is_primary DESC, i.sort_order, i.id LIMIT 1)            AS image_file,
                   (SELECT count(*) FROM product_images i WHERE i.product_id = p.id)    AS image_count,
                   coalesce((SELECT sum(li.required_qty - li.issued_qty)
                               FROM product_list_items li
                               JOIN product_lists l ON l.id = li.list_id
                              WHERE li.product_id = p.id AND l.status IN ('PENDING', 'PARTIAL')), 0) AS reserved_qty
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            """;

    private static final RowMapper<ProductRow> ROW_MAPPER = (rs, n) -> new ProductRow(
            MAPPER.mapRow(rs, n), rs.getString("category_name"), rs.getString("category_color"),
            rs.getString("image_file"), rs.getLong("image_count"), Rows.decNz(rs, "reserved_qty"));

    private final JdbcClient jdbc;

    public ProductRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<ProductRow> findAllRows() {
        return jdbc.sql(ROW_SELECT + " WHERE p.deleted = FALSE ORDER BY lower(p.name)").query(ROW_MAPPER).list();
    }

    public Optional<ProductRow> findRow(long id) {
        return jdbc.sql(ROW_SELECT + " WHERE p.id = :id").param("id", id).query(ROW_MAPPER).optional();
    }

    public List<ProductRow> findRowsByIds(List<Long> ids) {
        if (ids.isEmpty()) return List.of();
        return jdbc.sql(ROW_SELECT + " WHERE p.id IN (:ids)").param("ids", ids).query(ROW_MAPPER).list();
    }

    /** Простой поиск для глобального поиска в шапке. */
    public List<ProductRow> search(String q, int limit) {
        return jdbc.sql(ROW_SELECT + """
                 WHERE p.deleted = FALSE
                   AND (p.name ILIKE :q OR p.sku ILIKE :q OR coalesce(p.barcode, '') ILIKE :q
                        OR coalesce(p.description, '') ILIKE :q OR coalesce(c.name, '') ILIKE :q)
                 ORDER BY (p.name ILIKE :prefix) DESC, lower(p.name)
                 LIMIT :limit
                """).param("q", "%" + q + "%").param("prefix", q + "%").param("limit", limit)
                .query(ROW_MAPPER).list();
    }

    public Optional<Product> findById(long id) {
        return jdbc.sql("SELECT * FROM products WHERE id = :id AND deleted = FALSE")
                .param("id", id).query(MAPPER).optional();
    }

    /** Блокирует строку товара до конца транзакции — защита от одновременных изменений остатка. */
    public Optional<Product> lockById(long id) {
        return jdbc.sql("SELECT * FROM products WHERE id = :id FOR UPDATE")
                .param("id", id).query(MAPPER).optional();
    }

    public boolean skuExists(String sku, Long exceptId) {
        return jdbc.sql("SELECT count(*) FROM products WHERE lower(sku) = lower(:sku) AND id <> :id")
                .param("sku", sku).param("id", exceptId == null ? -1L : exceptId).query(Long.class).single() > 0;
    }

    public boolean barcodeExists(String barcode, Long exceptId) {
        return jdbc.sql("SELECT count(*) FROM products WHERE barcode = :b AND deleted = FALSE AND id <> :id")
                .param("b", barcode).param("id", exceptId == null ? -1L : exceptId).query(Long.class).single() > 0;
    }

    public String nextSku() {
        long n = jdbc.sql("SELECT nextval('product_sku_seq')").query(Long.class).single();
        String sku = String.format("TV-%05d", n);
        while (skuExists(sku, null)) {
            n = jdbc.sql("SELECT nextval('product_sku_seq')").query(Long.class).single();
            sku = String.format("TV-%05d", n);
        }
        return sku;
    }

    public long insert(Product p) {
        return jdbc.sql("""
                INSERT INTO products (sku, name, category_id, description, purchase_price, selling_price,
                                      quantity, min_quantity, unit, barcode, location)
                VALUES (:sku, :name, :categoryId, :description, :purchasePrice, :sellingPrice,
                        :quantity, :minQuantity, :unit, :barcode, :location)
                RETURNING id
                """)
                .param("sku", p.sku()).param("name", p.name()).param("categoryId", p.categoryId(), java.sql.Types.BIGINT)
                .param("description", p.description()).param("purchasePrice", p.purchasePrice())
                .param("sellingPrice", p.sellingPrice(), java.sql.Types.NUMERIC)
                .param("quantity", p.quantity()).param("minQuantity", p.minQuantity()).param("unit", p.unit())
                .param("barcode", p.barcode()).param("location", p.location())
                .query(Long.class).single();
    }

    /** Обновляет карточку товара. Количество здесь не меняется — только через движения склада. */
    public void updateDetails(Product p) {
        jdbc.sql("""
                UPDATE products SET sku = :sku, name = :name, category_id = :categoryId, description = :description,
                       purchase_price = :purchasePrice, selling_price = :sellingPrice, min_quantity = :minQuantity,
                       unit = :unit, barcode = :barcode, location = :location, updated_at = now()
                WHERE id = :id
                """)
                .param("sku", p.sku()).param("name", p.name()).param("categoryId", p.categoryId(), java.sql.Types.BIGINT)
                .param("description", p.description()).param("purchasePrice", p.purchasePrice())
                .param("sellingPrice", p.sellingPrice(), java.sql.Types.NUMERIC)
                .param("minQuantity", p.minQuantity()).param("unit", p.unit()).param("barcode", p.barcode())
                .param("location", p.location()).param("id", p.id())
                .update();
    }

    public void updateQuantity(long id, BigDecimal quantity) {
        jdbc.sql("UPDATE products SET quantity = :q, updated_at = now() WHERE id = :id")
                .param("q", quantity).param("id", id).update();
    }

    public void touch(long id) {
        jdbc.sql("UPDATE products SET updated_at = now() WHERE id = :id").param("id", id).update();
    }

    /** Мягкое удаление: история движений и списков сохраняется. */
    public void softDelete(long id) {
        jdbc.sql("UPDATE products SET deleted = TRUE, deleted_at = :now, barcode = NULL, updated_at = :now WHERE id = :id")
                .param("now", LocalDateTime.now()).param("id", id).update();
    }

    public long countOpenListUsage(long productId) {
        return jdbc.sql("""
                SELECT count(*) FROM product_list_items li JOIN product_lists l ON l.id = li.list_id
                WHERE li.product_id = :id AND l.status IN ('DRAFT', 'PENDING', 'PARTIAL') AND li.issued_qty < li.required_qty
                """).param("id", productId).query(Long.class).single();
    }
}
