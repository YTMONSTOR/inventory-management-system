package org.example.web;

import jakarta.validation.Valid;
import org.example.ai.AiImportService;
import org.example.domain.ApiException;
import org.example.domain.ListStatus;
import org.example.service.ProductListService;
import org.example.web.dto.Dto.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/lists")
public class ListController {

    private final ProductListService lists;
    private final AiImportService ai;

    public ListController(ProductListService lists, AiImportService ai) {
        this.lists = lists;
        this.ai = ai;
    }

    /** Разбор текста сообщения встроенным мини-ИИ. Ничего не сохраняет — только предлагает список для проверки. */
    @PostMapping("/ai-parse")
    public AiImportService.AiParseResponse aiParse(@Valid @RequestBody AiParseRequest r) {
        return ai.parse(r.text());
    }

    /** Запоминает, какой товар пользователь выбрал для слова из сообщения. */
    @PostMapping("/ai-learn")
    public java.util.Map<String, Integer> aiLearn(@RequestBody java.util.List<AiImportService.LearnPair> pairs) {
        return java.util.Map.of("saved", ai.learn(pairs));
    }

        @GetMapping("/ai-status")
    public AiImportService.AiStatus aiStatus() {
        return ai.status();
    }

    @GetMapping
    public List<ListSummaryView> all(@RequestParam(required = false) String status,
                                     @RequestParam(required = false) String q) {
        List<ListStatus> statuses = null;
        if (status != null && !status.isBlank()) {
            try {
                statuses = Arrays.stream(status.split(",")).map(String::trim).map(ListStatus::valueOf).toList();
            } catch (IllegalArgumentException e) {
                throw ApiException.badRequest("Неизвестный статус списка");
            }
        }
        return lists.findAll(statuses, q);
    }

    @GetMapping("/{id}")
    public ListDetailView one(@PathVariable long id) {
        return lists.detail(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Long> create(@Valid @RequestBody ListRequest r) {
        return Map.of("id", lists.create(r));
    }

    @PutMapping("/{id}")
    public ListDetailView update(@PathVariable long id, @Valid @RequestBody ListRequest r) {
        lists.update(id, r);
        return lists.detail(id);
    }

    @PostMapping("/{id}/status")
    public ListDetailView status(@PathVariable long id, @Valid @RequestBody StatusRequest r) {
        lists.changeStatus(id, r.status());
        return lists.detail(id);
    }

    @PostMapping("/{id}/issue")
    public ListDetailView issue(@PathVariable long id, @Valid @RequestBody IssueRequest r) {
        return lists.issue(id, r);
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Long> duplicate(@PathVariable long id) {
        return Map.of("id", lists.duplicate(id));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable long id) {
        lists.delete(id);
    }
}
