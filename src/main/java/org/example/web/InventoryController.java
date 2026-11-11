package org.example.web;

import jakarta.validation.Valid;
import org.example.domain.ApiException;
import org.example.domain.MovementType;
import org.example.domain.Num;
import org.example.repository.IssueRepository;
import org.example.repository.MovementRepository;
import org.example.service.InventoryService;
import org.example.service.ProductService;
import org.example.service.Views;
import org.example.web.dto.Dto.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
public class InventoryController {

    private final InventoryService inventory;
    private final ProductService products;
    private final MovementRepository movements;
    private final IssueRepository issues;

    public InventoryController(InventoryService inventory, ProductService products, MovementRepository movements,
                               IssueRepository issues) {
        this.inventory = inventory;
        this.products = products;
        this.movements = movements;
        this.issues = issues;
    }

    @PostMapping("/inventory/receive")
    public ProductView receive(@Valid @RequestBody StockRequest r) {
        inventory.receive(r);
        return products.get(r.productId());
    }

    @PostMapping("/inventory/issue")
    public ProductView issue(@Valid @RequestBody StockRequest r) {
        inventory.issue(r);
        return products.get(r.productId());
    }

    @PostMapping("/inventory/adjust")
    public ProductView adjust(@Valid @RequestBody AdjustRequest r) {
        inventory.adjust(r);
        return products.get(r.productId());
    }

    @GetMapping("/inventory/movements")
    @Transactional(readOnly = true)
    public List<MovementView> movements(@RequestParam(required = false) Long productId,
                                        @RequestParam(required = false) String type,
                                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                        @RequestParam(required = false) String q,
                                        @RequestParam(defaultValue = "300") int limit) {
        MovementType t = null;
        if (type != null && !type.isBlank()) {
            try {
                t = MovementType.valueOf(type);
            } catch (IllegalArgumentException e) {
                throw ApiException.badRequest("Неизвестный вид операции");
            }
        }
        return movements.find(new MovementRepository.Filter(productId, t, from == null ? null : from.atStartOfDay(),
                        to == null ? null : to.plusDays(1).atStartOfDay(), Num.trim(q), null,
                        Math.max(1, Math.min(limit, 2000))))
                .stream().map(Views::movement).toList();
    }

    /** Выданные товары: каждая выдача — отдельная запись со строками. */
    @GetMapping("/issues")
    @Transactional(readOnly = true)
    public List<IssueView> issues(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                  @RequestParam(required = false) String q,
                                  @RequestParam(defaultValue = "200") int limit) {
        return issues.find(from == null ? null : from.atStartOfDay(), to == null ? null : to.plusDays(1).atStartOfDay(),
                        Num.trim(q), null, Math.max(1, Math.min(limit, 1000)))
                .stream().map(r -> Views.issue(r, movements.find(new MovementRepository.Filter(null, null, null, null,
                        null, r.id(), 500)).stream().map(Views::movement).toList()))
                .toList();
    }
}
