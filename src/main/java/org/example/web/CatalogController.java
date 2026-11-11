package org.example.web;

import jakarta.validation.Valid;
import org.example.service.CategoryService;
import org.example.service.ProductService;
import org.example.web.dto.Dto.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class CatalogController {

    private final CategoryService categories;
    private final ProductService products;

    public CatalogController(CategoryService categories, ProductService products) {
        this.categories = categories;
        this.products = products;
    }

    // ---------------------------------------------------------------- категории

    @GetMapping("/categories")
    public List<CategoryView> categories() {
        return categories.findAll();
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Long> createCategory(@Valid @RequestBody CategoryRequest r) {
        return Map.of("id", categories.create(r));
    }

    @PutMapping("/categories/{id}")
    public void updateCategory(@PathVariable long id, @Valid @RequestBody CategoryRequest r) {
        categories.update(id, r);
    }

    @DeleteMapping("/categories/{id}")
    public void deleteCategory(@PathVariable long id) {
        categories.delete(id);
    }

    // ---------------------------------------------------------------- товары

    /** Весь каталог: поиск, фильтры и сортировка выполняются мгновенно в браузере. */
    @GetMapping("/products")
    public List<ProductView> products(@RequestParam(required = false) String ids) {
        if (ids != null && !ids.isBlank()) {
            List<Long> list = Arrays.stream(ids.split(",")).map(String::trim).filter(s -> s.matches("\\d+"))
                    .map(Long::valueOf).limit(100).toList();
            return products.findByIds(list);
        }
        return products.findAll();
    }

    @GetMapping("/products/{id}")
    public ProductDetailView product(@PathVariable long id) {
        return products.detail(id);
    }

    @PostMapping("/products")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductView createProduct(@Valid @RequestBody ProductRequest r) {
        return products.create(r);
    }

    @PutMapping("/products/{id}")
    public ProductView updateProduct(@PathVariable long id, @Valid @RequestBody ProductRequest r) {
        return products.update(id, r);
    }

    @DeleteMapping("/products/{id}")
    public void deleteProduct(@PathVariable long id) {
        products.delete(id);
    }

    @PostMapping(value = "/products/{id}/images", consumes = "multipart/form-data")
    public List<ImageView> uploadImages(@PathVariable long id, @RequestParam("files") List<MultipartFile> files) {
        return products.addImages(id, files);
    }

    @PostMapping("/products/{id}/images/{imageId}/primary")
    public List<ImageView> primaryImage(@PathVariable long id, @PathVariable long imageId) {
        return products.setPrimaryImage(id, imageId);
    }

    @DeleteMapping("/products/{id}/images/{imageId}")
    public List<ImageView> deleteImage(@PathVariable long id, @PathVariable long imageId) {
        return products.deleteImage(id, imageId);
    }
}
