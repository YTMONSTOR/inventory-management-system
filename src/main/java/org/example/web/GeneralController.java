package org.example.web;

import jakarta.validation.Valid;
import org.example.domain.ActivityAction;
import org.example.domain.ApiException;
import org.example.domain.ListStatus;
import org.example.domain.Num;
import org.example.repository.ActivityRepository;
import org.example.repository.ListRepository;
import org.example.repository.ProductRepository;
import org.example.service.AccountService;
import org.example.service.DashboardService;
import org.example.service.ExcelExporter;
import org.example.service.PdfExporter;
import org.example.service.ReportService;
import org.example.service.ReportTable;
import org.example.service.Views;
import org.example.web.dto.Dto.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class GeneralController {

    private final DashboardService dashboard;
    private final AccountService account;
    private final ReportService reports;
    private final ExcelExporter excel;
    private final PdfExporter pdf;
    private final ActivityRepository activity;
    private final ProductRepository products;
    private final ListRepository lists;

    public GeneralController(DashboardService dashboard, AccountService account, ReportService reports,
                             ExcelExporter excel, PdfExporter pdf, ActivityRepository activity,
                             ProductRepository products, ListRepository lists) {
        this.dashboard = dashboard;
        this.account = account;
        this.reports = reports;
        this.excel = excel;
        this.pdf = pdf;
        this.activity = activity;
        this.products = products;
        this.lists = lists;
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard() {
        return dashboard.dashboard();
    }

    @GetMapping("/notifications")
    public List<NotificationView> notifications() {
        return dashboard.notifications();
    }

    @GetMapping("/search")
    @Transactional(readOnly = true)
    public SearchResult search(@RequestParam String q) {
        String query = Num.trim(q);
        if (query == null) return new SearchResult(List.of(), List.of());
        return new SearchResult(products.search(query, 8).stream().map(Views::product).toList(),
                lists.findSummaries(null, query, 5).stream().map(Views::listSummary).toList());
    }

    @GetMapping("/history")
    @Transactional(readOnly = true)
    public List<ActivityView> history(@RequestParam(required = false) String group,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                      @RequestParam(required = false) String q,
                                      @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "50") int size) {
        int s = Math.max(1, Math.min(size, 200));
        return activity.find(new ActivityRepository.Filter(actions(group), from == null ? null : from.atStartOfDay(),
                        to == null ? null : to.plusDays(1).atStartOfDay(), Num.trim(q), s, Math.max(0, page) * s))
                .stream().map(Views::activity).toList();
    }

    private static List<ActivityAction> actions(String group) {
        if (group == null || group.isBlank()) return null;
        List<ActivityAction> list = new ArrayList<>();
        for (ActivityAction a : ActivityAction.values()) {
            String n = a.name();
            boolean match = switch (group) {
                case "products" -> n.startsWith("PRODUCT_") || n.startsWith("CATEGORY_");
                case "stock" -> n.startsWith("STOCK_");
                case "lists" -> n.startsWith("LIST_");
                case "settings" -> n.startsWith("SETTINGS_");
                default -> throw ApiException.badRequest("Неизвестный раздел истории");
            };
            if (match) list.add(a);
        }
        return list;
    }

    // ---------------------------------------------------------------- профиль и настройки

    @GetMapping("/profile")
    public ProfileView profile() {
        return account.profile();
    }

    @PutMapping("/profile")
    public ProfileView updateProfile(@Valid @RequestBody ProfileRequest r) {
        return account.updateProfile(r);
    }

    @GetMapping("/settings")
    public Map<String, String> settings() {
        return account.settings();
    }

    @PutMapping("/settings")
    public Map<String, String> updateSettings(@RequestBody Map<String, String> values) {
        return account.updateSettings(values);
    }

    // ---------------------------------------------------------------- отчёты

    @GetMapping("/reports/{type}")
    public ResponseEntity<?> report(@PathVariable String type,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                    @RequestParam(required = false) String format) {
        ReportTable t = reports.build(type, from, to);
        return render(t, format);
    }

    @GetMapping("/lists/{id}/export")
    public ResponseEntity<?> listExport(@PathVariable long id, @RequestParam(defaultValue = "pdf") String format) {
        return render(reports.list(id), format);
    }

    private ResponseEntity<?> render(ReportTable t, String format) {
        if (format == null || format.isBlank() || format.equals("json")) return ResponseEntity.ok(t);
        String base = t.title().replaceAll("[\\\\/:*?\"<>|]", " ").trim() + " "
                + LocalDate.now().format(DateTimeFormatter.ofPattern("dd.MM.yyyy"));
        return switch (format) {
            case "xlsx" -> file(excel.export(t, reports.company()), base + ".xlsx",
                    MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            case "pdf" -> file(pdf.export(t, reports.company()), base + ".pdf", MediaType.APPLICATION_PDF);
            default -> throw ApiException.badRequest("Поддерживаются форматы Excel (xlsx) и PDF");
        };
    }

    private static ResponseEntity<byte[]> file(byte[] data, String name, MediaType type) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(name, StandardCharsets.UTF_8).build().toString())
                .contentType(type)
                .body(data);
    }

    /** Статусы списков с русскими названиями — для фильтров в интерфейсе. */
    @GetMapping("/meta")
    public Map<String, Object> meta() {
        Map<String, String> statuses = new java.util.LinkedHashMap<>();
        for (ListStatus s : ListStatus.values()) statuses.put(s.name(), s.title());
        return Map.of("listStatuses", statuses);
    }
}
