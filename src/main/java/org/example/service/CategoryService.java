package org.example.service;

import org.example.domain.ActivityAction;
import org.example.domain.ApiException;
import org.example.domain.Num;
import org.example.repository.CategoryRepository;
import org.example.web.dto.Dto.CategoryRequest;
import org.example.web.dto.Dto.CategoryView;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

@Service
public class CategoryService {

    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");

    private final CategoryRepository repository;
    private final ActivityService activity;

    public CategoryService(CategoryRepository repository, ActivityService activity) {
        this.repository = repository;
        this.activity = activity;
    }

    @Transactional(readOnly = true)
    public List<CategoryView> findAll() {
        return repository.findAllWithStats().stream().map(s -> new CategoryView(s.category().id(),
                s.category().name(), s.category().description(), s.category().color(), s.productCount(),
                s.totalQuantity(), Num.money(s.totalValue()), s.lowStockCount(), s.category().createdAt())).toList();
    }

    @Transactional
    public long create(CategoryRequest r) {
        String name = r.name().trim();
        if (repository.existsByName(name, null)) throw ApiException.conflict("Категория «" + name + "» уже есть");
        long id = repository.insert(name, Num.trim(r.description()), color(r.color()));
        activity.log(ActivityAction.CATEGORY_CREATED, "CATEGORY", id, "Создана категория «" + name + "»", null);
        return id;
    }

    @Transactional
    public void update(long id, CategoryRequest r) {
        var old = repository.findById(id).orElseThrow(() -> ApiException.notFound("Категория не найдена"));
        String name = r.name().trim();
        if (repository.existsByName(name, id)) throw ApiException.conflict("Категория «" + name + "» уже есть");
        repository.update(id, name, Num.trim(r.description()), color(r.color()));
        activity.log(ActivityAction.CATEGORY_UPDATED, "CATEGORY", id,
                old.name().equals(name) ? "Изменена категория «" + name + "»"
                        : "Категория «" + old.name() + "» переименована в «" + name + "»", null);
    }

    @Transactional
    public void delete(long id) {
        var c = repository.findById(id).orElseThrow(() -> ApiException.notFound("Категория не найдена"));
        repository.delete(id);
        activity.log(ActivityAction.CATEGORY_DELETED, "CATEGORY", id, "Удалена категория «" + c.name() + "»",
                "Товары этой категории остались в каталоге без категории");
    }

    private static String color(String c) {
        return c != null && COLOR.matcher(c).matches() ? c : "#2343B8";
    }
}
