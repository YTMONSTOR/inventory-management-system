package org.example.service;

import org.example.domain.ActivityAction;
import org.example.domain.ApiException;
import org.example.domain.Entities.Product;
import org.example.domain.Entities.ProductImage;
import org.example.domain.MovementType;
import org.example.domain.Num;
import org.example.repository.CategoryRepository;
import org.example.repository.ImageRepository;
import org.example.repository.ListRepository;
import org.example.repository.MovementRepository;
import org.example.repository.ProductRepository;
import org.example.web.dto.Dto.ImageView;
import org.example.web.dto.Dto.ProductDetailView;
import org.example.web.dto.Dto.ProductRequest;
import org.example.web.dto.Dto.ProductView;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class ProductService {

    private final ProductRepository products;
    private final CategoryRepository categories;
    private final ImageRepository images;
    private final MovementRepository movements;
    private final ListRepository lists;
    private final InventoryService inventory;
    private final StorageService storage;
    private final ActivityService activity;

    public ProductService(ProductRepository products, CategoryRepository categories, ImageRepository images,
                          MovementRepository movements, ListRepository lists, InventoryService inventory,
                          StorageService storage, ActivityService activity) {
        this.products = products;
        this.categories = categories;
        this.images = images;
        this.movements = movements;
        this.lists = lists;
        this.inventory = inventory;
        this.storage = storage;
        this.activity = activity;
    }

    @Transactional(readOnly = true)
    public List<ProductView> findAll() {
        return products.findAllRows().stream().map(Views::product).toList();
    }

    @Transactional(readOnly = true)
    public List<ProductView> findByIds(List<Long> ids) {
        return products.findRowsByIds(ids).stream().filter(r -> !r.product().deleted()).map(Views::product).toList();
    }

    @Transactional(readOnly = true)
    public ProductView get(long id) {
        return products.findRow(id).map(Views::product).orElseThrow(() -> ApiException.notFound("Товар не найден"));
    }

    @Transactional(readOnly = true)
    public ProductDetailView detail(long id) {
        var row = products.findRow(id).orElseThrow(() -> ApiException.notFound("Товар не найден"));
        List<ImageView> imgs = images.findByProduct(id).stream().map(ProductService::image).toList();
        Map<String, BigDecimal> totals = movements.totalsForProduct(id);
        var moves = movements.find(new MovementRepository.Filter(id, null, null, null, null, null, 200))
                .stream().map(Views::movement).toList();
        var productLists = lists.findForProduct(id).stream().map(Views::listSummary).toList();
        return new ProductDetailView(Views.product(row), imgs, totals.get("received"), totals.get("issued"),
                totals.get("adjusted"), totals.get("count").longValue(), moves, productLists);
    }

    @Transactional
    public ProductView create(ProductRequest r) {
        Product p = validated(null, r);
        long id = products.insert(new Product(null, p.sku(), p.name(), p.categoryId(), p.description(),
                p.purchasePrice(), p.sellingPrice(), BigDecimal.ZERO, p.minQuantity(), p.unit(), p.barcode(),
                p.location(), false, null, null));
        activity.log(ActivityAction.PRODUCT_CREATED, "PRODUCT", id, "Добавлен товар «" + p.name() + "»",
                "Код " + p.sku() + ", цена " + Num.fmtMoney(p.purchasePrice()));
        if (Num.positive(r.initialQuantity())) {
            inventory.apply(id, MovementType.INITIAL, Num.qty(r.initialQuantity()), p.purchasePrice(),
                    "Начальный остаток при добавлении товара", null, null, null);
        }
        return get(id);
    }

    @Transactional
    public ProductView update(long id, ProductRequest r) {
        Product old = products.findById(id).orElseThrow(() -> ApiException.notFound("Товар не найден"));
        Product p = validated(id, r);
        products.updateDetails(p);
        List<String> changes = new ArrayList<>();
        if (!old.name().equals(p.name())) changes.add("название: «" + old.name() + "» → «" + p.name() + "»");
        if (old.purchasePrice().compareTo(p.purchasePrice()) != 0)
            changes.add("цена: " + Num.fmtMoney(old.purchasePrice()) + " → " + Num.fmtMoney(p.purchasePrice()));
        if (old.minQuantity().compareTo(p.minQuantity()) != 0)
            changes.add("мин. остаток: " + Num.fmtQty(old.minQuantity()) + " → " + Num.fmtQty(p.minQuantity()));
        if (!Objects.equals(old.categoryId(), p.categoryId())) changes.add("категория");
        if (!Objects.equals(old.description(), p.description())) changes.add("описание");
        if (!old.unit().equals(p.unit())) changes.add("ед. изм.: " + old.unit() + " → " + p.unit());
        if (!Objects.equals(old.barcode(), p.barcode())) changes.add("штрихкод");
        if (!old.sku().equals(p.sku())) changes.add("код: " + old.sku() + " → " + p.sku());
        activity.log(ActivityAction.PRODUCT_UPDATED, "PRODUCT", id, "Изменён товар «" + p.name() + "»",
                changes.isEmpty() ? "Сохранено без изменений" : "Изменено: " + String.join("; ", changes));
        return get(id);
    }

    @Transactional
    public void delete(long id) {
        Product p = products.findById(id).orElseThrow(() -> ApiException.notFound("Товар не найден"));
        long used = products.countOpenListUsage(id);
        if (used > 0) {
            throw ApiException.conflict("Товар «" + p.name() + "» есть в " + used
                    + " незавершённых списках. Сначала уберите его из этих списков или завершите их.");
        }
        products.softDelete(id);
        activity.log(ActivityAction.PRODUCT_DELETED, "PRODUCT", id, "Удалён товар «" + p.name() + "»",
                "Код " + p.sku() + ", остаток на момент удаления " + Num.fmtQty(p.quantity()) + " " + p.unit());
    }

    // ------------------------------------------------------------------ фото

    @Transactional
    public List<ImageView> addImages(long productId, List<MultipartFile> files) {
        Product p = products.findById(productId).orElseThrow(() -> ApiException.notFound("Товар не найден"));
        if (files == null || files.isEmpty()) throw ApiException.badRequest("Выберите фото");
        boolean hasPrimary = images.findByProduct(productId).stream().anyMatch(ProductImage::primary);
        List<String> saved = new ArrayList<>();
        try {
            for (MultipartFile f : files) {
                var s = storage.save(f);
                saved.add(s.fileName());
                images.insert(productId, s.fileName(), Num.trim(f.getOriginalFilename()), s.contentType(), s.size(),
                        !hasPrimary, images.nextSortOrder(productId));
                hasPrimary = true;
            }
        } catch (RuntimeException e) {
            saved.forEach(storage::delete);
            throw e;
        }
        products.touch(productId);
        activity.log(ActivityAction.PRODUCT_PHOTO, "PRODUCT", productId,
                "Добавлено фото товара «" + p.name() + "»", saved.size() + " шт.");
        return images.findByProduct(productId).stream().map(ProductService::image).toList();
    }

    @Transactional
    public List<ImageView> setPrimaryImage(long productId, long imageId) {
        var img = images.findById(imageId).filter(i -> i.productId() == productId)
                .orElseThrow(() -> ApiException.notFound("Фото не найдено"));
        images.setPrimary(productId, img.id());
        products.touch(productId);
        return images.findByProduct(productId).stream().map(ProductService::image).toList();
    }

    @Transactional
    public List<ImageView> deleteImage(long productId, long imageId) {
        var img = images.findById(imageId).filter(i -> i.productId() == productId)
                .orElseThrow(() -> ApiException.notFound("Фото не найдено"));
        images.delete(img.id());
        if (img.primary()) {
            images.findByProduct(productId).stream().findFirst().ifPresent(n -> images.setPrimary(productId, n.id()));
        }
        storage.delete(img.fileName());
        products.touch(productId);
        return images.findByProduct(productId).stream().map(ProductService::image).toList();
    }

    // ------------------------------------------------------------------ проверка

    private Product validated(Long id, ProductRequest r) {
        String name = r.name().trim();
        String sku = Num.trim(r.sku());
        if (sku == null) {
            sku = id == null ? products.nextSku()
                    : products.findById(id).map(Product::sku).orElseGet(products::nextSku);
        }
        if (products.skuExists(sku, id)) throw ApiException.conflict("Код товара «" + sku + "» уже занят другим товаром");
        String barcode = Num.trim(r.barcode());
        if (barcode != null && products.barcodeExists(barcode, id))
            throw ApiException.conflict("Штрихкод " + barcode + " уже указан у другого товара");
        if (r.categoryId() != null && categories.findById(r.categoryId()).isEmpty())
            throw ApiException.badRequest("Выбранная категория не найдена — обновите страницу");
        BigDecimal purchase = Num.money(r.purchasePrice());
        BigDecimal selling = r.sellingPrice() == null ? null : Num.money(r.sellingPrice());
        BigDecimal min = Num.qty(r.minQuantity());
        return new Product(id, sku, name, r.categoryId(), Num.trim(r.description()), purchase, selling, null, min,
                r.unit().trim(), barcode, Num.trim(r.location()), false, null, null);
    }

    static ImageView image(ProductImage i) {
        return new ImageView(i.id(), Views.imageUrl(i.fileName()), i.originalName(), i.primary(), i.sizeBytes());
    }
}
