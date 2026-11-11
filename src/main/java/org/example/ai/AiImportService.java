package org.example.ai;

import org.example.domain.ApiException;
import org.example.domain.Num;
import org.example.repository.AliasRepository;
import org.example.repository.ProductRepository;
import org.example.repository.ProductRepository.ProductRow;
import org.example.service.Views;
import org.example.web.dto.Dto.ProductView;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Разбор списка из текста сообщения встроенным «мини-ИИ» ({@link SmartTextParser}).
 * Работает без интернета и бесплатно. Ничего не сохраняет: возвращает черновик для проверки.
 * Новые товары не создаются. Исправления пользователя запоминаются (product_aliases).
 */
@Service
public class AiImportService {

    private static final Logger log = LoggerFactory.getLogger(AiImportService.class);
    private static final int MAX_TEXT = 8000;

    /** Одна строка разбора для экрана проверки. */
    public record AiLine(String sourceText, String itemName, BigDecimal quantity, boolean quantityGuessed,
                         String unit, Long productId, String confidence, List<Long> alternativeIds,
                         String warning) {
    }

    public record AiParseResponse(String listName, String recipient, List<AiLine> items,
                                  List<ProductView> products, String model) {
    }

    public record AiStatus(boolean enabled, String model) {
    }

    /** Что пользователь подтвердил: фраза из сообщения → выбранный товар. */
    public record LearnPair(String phrase, Long productId) {
    }

    private final ProductRepository products;
    private final AliasRepository aliases;

    public AiImportService(ProductRepository products, AliasRepository aliases) {
        this.products = products;
        this.aliases = aliases;
    }

    public AiStatus status() {
        return new AiStatus(true, "встроенный");
    }

    @Transactional(readOnly = true)
    public AiParseResponse parse(String text) {
        String message = text == null ? "" : text.strip();
        if (message.isEmpty()) throw ApiException.badRequest("Вставьте текст сообщения");
        if (message.length() > MAX_TEXT) throw ApiException.badRequest("Сообщение слишком длинное — разделите его на части");

        List<ProductRow> rows = products.findAllRows();
        if (rows.isEmpty()) throw ApiException.badRequest("В каталоге пока нет товаров — сначала добавьте товары");
        Map<Long, ProductRow> byId = new LinkedHashMap<>();
        rows.forEach(r -> byId.put(r.product().id(), r));

        long t = System.currentTimeMillis();
        SmartTextParser parser = new SmartTextParser(rows.stream().map(r -> new SmartTextParser.CatalogItem(
                r.product().id(), r.product().name(), r.product().sku(), r.product().unit(), r.categoryName(),
                r.product().barcode())).toList(), aliases.findAll());
        SmartTextParser.Result result = parser.parse(message);
        log.info("Разбор сообщения: {} строк, {} мс", result.items().size(), System.currentTimeMillis() - t);

        List<AiLine> lines = new ArrayList<>();
        Set<Long> referenced = new LinkedHashSet<>();
        for (SmartTextParser.Line l : result.items()) {
            List<String> warnings = new ArrayList<>();
            Long pid = l.productId();
            BigDecimal qty = l.quantity();
            boolean guessed = false;
            if (qty == null || qty.signum() <= 0) {
                qty = BigDecimal.ONE;
                guessed = true;
                warnings.add("Количество не указано — поставлено 1");
            }
            qty = Num.qty(qty).stripTrailingZeros();
            if (qty.scale() < 0) qty = qty.setScale(0);

            if (pid != null) {
                var p = byId.get(pid).product();
                if (l.unit() != null && !l.unit().equals("шт") && !sameUnit(l.unit(), p.unit())) {
                    warnings.add("В сообщении «" + l.unit() + "», а товар учитывается в «" + p.unit() + "»");
                }
                referenced.add(pid);
            }
            if (l.comment() != null) warnings.add(0, l.comment());
            if (pid == null) {
                warnings.add(0, l.alternativeIds().isEmpty() ? "Такого товара нет в каталоге"
                        : "Точно не найдено — выберите из похожих");
            }
            referenced.addAll(l.alternativeIds());
            lines.add(new AiLine(l.sourceText(), l.itemName(), qty, guessed, l.unit(), pid, l.confidence(),
                    l.alternativeIds(), warnings.isEmpty() ? null : String.join(". ", warnings)));
        }
        List<ProductView> views = referenced.stream().map(byId::get).map(Views::product).toList();
        return new AiParseResponse(Num.trim(result.listName()), Num.trim(result.recipient()), lines, views, "встроенный");
    }

    /** Запоминает подтверждённые соответствия, чтобы в следующий раз находить сразу. */
    @Transactional
    public int learn(List<LearnPair> pairs) {
        int n = 0;
        if (pairs == null) return 0;
        for (LearnPair p : pairs) {
            if (p == null || p.productId() == null || p.phrase() == null) continue;
            String key = SmartTextParser.aliasKey(p.phrase());
            // запоминаем только слова, без чисел, и не слишком длинные фразы
            if (key.isBlank() || key.length() > 200 || key.split(" ").length > 6) continue;
            if (key.chars().noneMatch(Character::isLetter)) continue;
            if (products.findById(p.productId()).isEmpty()) continue;
            aliases.save(key, p.productId());
            n++;
        }
        return n;
    }

    private static boolean sameUnit(String a, String b) {
        return norm(a).equals(norm(b));
    }

    private static String norm(String u) {
        String s = u.toLowerCase(Locale.ROOT).replace(".", "").strip();
        String m = SmartTextParser.UNITS.get(s);
        return m != null ? m : s;
    }
}
