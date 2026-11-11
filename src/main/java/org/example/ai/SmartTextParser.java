package org.example.ai;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Встроенный «мини-ИИ» для разбора заказов из Telegram / WhatsApp.
 * Работает полностью внутри программы: без интернета, без ключей и бесплатно.
 *
 * Что умеет:
 *  - отделять количество от названия («Буква 3» → «Буква», 3 шт), понимать «3шт», «х3», «10 кг», «5 та», «2 dona»;
 *  - отличать размер в названии от количества («Труба 25 мм 6» → труба 25 мм, 6 шт) — перебирает варианты
 *    и выбирает тот, где название лучше совпадает с каталогом;
 *  - прощать опечатки (расстояние Дамерау — Левенштейна), сокращения («мол» → молоко), окончания
 *    («хлеба», «яйца»), латиницу и узбекский («sut», «non», «shakar», «tuxum»);
 *  - разбивать строку с несколькими товарами («молоко 5, хлеб 2»);
 *  - пропускать приветствия и находить имя клиента («это Ойбек»);
 *  - запоминать исправления: если пользователь выбрал для «сут» товар «Молоко 1 л», в следующий раз
 *    это будет найдено сразу (таблица product_aliases).
 *
 * Класс не зависит от Spring — его можно проверять отдельно.
 */
public class SmartTextParser {

    public record CatalogItem(long id, String name, String sku, String unit, String category, String barcode) {
    }

    /** Одна распознанная позиция. productId == null — товар не найден. */
    public record Line(String sourceText, String itemName, BigDecimal quantity, String unit, Long productId,
                       String confidence, List<Long> alternativeIds, String comment) {
    }

    public record Result(String listName, String recipient, List<Line> items) {
    }

    // ------------------------------------------------------------------ настройки

    static final double HIGH = 0.84;      // уверенно
    static final double GAP = 0.10;       // насколько лучший должен опережать второго
    static final double MEDIUM = 0.62;
    static final double LOW = 0.45;
    static final double SUGGEST = 0.33;   // минимальная похожесть для подсказок

    /** Латиница (в т. ч. узбекская) → кириллица. Объявлено до словарей: они используют транслитерацию. */
    private static final String[][] LAT = {
            {"o'", "у"}, {"oʻ", "у"}, {"o’", "у"}, {"o`", "у"}, {"g'", "г"}, {"gʻ", "г"}, {"g’", "г"}, {"g`", "г"},
            {"sh", "ш"}, {"ch", "ч"}, {"zh", "ж"}, {"kh", "х"}, {"ts", "ц"}, {"yo", "е"}, {"yu", "ю"}, {"ya", "я"},
            {"ye", "е"}, {"a", "а"}, {"b", "б"}, {"c", "к"}, {"d", "д"}, {"e", "е"}, {"f", "ф"}, {"g", "г"},
            {"h", "х"}, {"i", "и"}, {"j", "ж"}, {"k", "к"}, {"l", "л"}, {"m", "м"}, {"n", "н"}, {"o", "о"},
            {"p", "п"}, {"q", "к"}, {"r", "р"}, {"s", "с"}, {"t", "т"}, {"u", "у"}, {"v", "в"}, {"w", "в"},
            {"x", "х"}, {"y", "й"}, {"z", "з"},
    };

    /** Узбекские и разговорные слова → русское название товара. */
    static final Map<String, String> SYNONYMS = new HashMap<>();

    static {
        String[][] pairs = {
                {"нон", "хлеб"}, {"non", "хлеб"}, {"лепешка", "хлеб"}, {"батон", "хлеб"},
                {"сут", "молоко"}, {"sut", "молоко"}, {"мол", "молоко"},
                {"шакар", "сахар"}, {"shakar", "сахар"}, {"канд", "сахар"}, {"qand", "сахар"},
                {"ег", "масло"}, {"ёг", "масло"}, {"yog", "масло"}, {"мой", "масло"},
                {"тухум", "яйцо"}, {"tuxum", "яйцо"}, {"яйца", "яйцо"},
                {"гуруч", "рис"}, {"guruch", "рис"}, {"ун", "мука"}, {"un", "мука"},
                {"туз", "соль"}, {"tuz", "соль"}, {"чой", "чай"}, {"choy", "чай"},
                {"гушт", "мясо"}, {"gosht", "мясо"}, {"товук", "курица"}, {"tovuq", "курица"},
                {"картошка", "картофель"}, {"kartoshka", "картофель"}, {"пиёз", "лук"}, {"piyoz", "лук"},
                {"сабзи", "морковь"}, {"sabzi", "морковь"}, {"сув", "вода"}, {"suv", "вода"},
                {"совун", "мыло"}, {"sovun", "мыло"}, {"ширинлик", "конфеты"}, {"конфета", "конфеты"},
                {"печенье", "печенье"}, {"pechenye", "печенье"}, {"макарон", "макароны"},
                {"ловия", "фасоль"}, {"мош", "маш"}, {"асал", "мед"}, {"asal", "мед"},
                {"пишлок", "сыр"}, {"pishloq", "сыр"}, {"колбаса", "колбаса"}, {"газ", "газировка"},
                {"сок", "сок"}, {"шарбат", "сок"}, {"ёгурт", "йогурт"}, {"катык", "кефир"}, {"қатиқ", "кефир"},
                {"каймок", "сметана"}, {"qaymoq", "сметана"}, {"творог", "творог"}, {"сузма", "творог"},
        };
        for (String[] p : pairs) SYNONYMS.put(normWord(p[0]), normWord(p[1]));
    }

    /** Единицы: всё, что встречается в сообщениях → как показываем. */
    public static final Map<String, String> UNITS = new LinkedHashMap<>();

    static {
        for (String u : List.of("шт", "штук", "штука", "штуки", "шту", "ш", "ta", "та", "dona", "дона", "pcs", "pc")) UNITS.put(u, "шт");
        for (String u : List.of("кг", "kg", "кило", "kilo", "килограмм", "килограмма")) UNITS.put(u, "кг");
        for (String u : List.of("г", "гр", "грамм", "gr", "g")) UNITS.put(u, "г");
        for (String u : List.of("л", "литр", "литра", "литров", "l", "litr")) UNITS.put(u, "л");
        for (String u : List.of("м", "метр", "метра", "метров", "metr", "m")) UNITS.put(u, "м");
        for (String u : List.of("упак", "уп", "упаковка", "упаковки", "упаковок", "pachka", "пачка", "пачки", "пачек", "пач")) UNITS.put(u, "упак");
        for (String u : List.of("коробка", "коробки", "коробок", "кор", "korobka", "блок", "блока", "блоков", "blok", "ящик", "ящика")) UNITS.put(u, "коробка");
        for (String u : List.of("мешок", "мешка", "мешков", "qop", "коп")) UNITS.put(u, "мешок");
        for (String u : List.of("бутылка", "бутылки", "бутылок", "бут")) UNITS.put(u, "бутылка");
    }

    /** Единицы-размеры: если число стоит перед ними, это скорее часть названия («25 мм», «0,5 л»). */
    static final Set<String> SIZE_UNITS = Set.of("мм", "см", "mm", "sm", "мл", "ml", "вт", "w", "в", "v", "а", "дюйм", "мм2");

    static final Set<String> NOISE = Set.of(
            "ассалому", "алейкум", "алайкум", "салом", "салам", "assalomu", "alaykum", "salom", "здравствуйте",
            "здраствуйте", "привет", "добрый", "день", "вечер", "утро", "рахмат", "rahmat", "спасибо", "пожалуйста",
            "буду", "благодарен", "заказ", "заказы", "нужно", "надо", "керак", "kerak", "мне", "менга", "menga",
            "пришлите", "отправьте", "юборинг", "yuboring", "акя", "ака", "aka", "опа", "брат", "хорошо", "ок", "ok",
            "яхши", "yaxshi", "вот", "список", "сегодня", "завтра", "бугун", "эртага", "пж", "плиз");

    static final Pattern RECIPIENT = Pattern.compile(
            "(?iu)(?:^|[\\s,.!])(?:это|я|мен|men|bu|от|для|клиент|магазин|dokon|дўкон|дукон)\\s+([\\p{Lu}][\\p{L}'ʻ’-]{1,30}(?:\\s+[\\p{Lu}][\\p{L}'ʻ’-]{1,30})?)");
    static final Pattern NUMBERING = Pattern.compile("^\\s*(?:\\d{1,2}[.)]|[-–—•*·▪●✅☑️➖➡️]+)\\s+");
    static final Pattern PHONE = Pattern.compile("\\+?\\d[\\d\\s()-]{8,}\\d");

    private final List<Product> products = new ArrayList<>();
    private final Map<String, Long> aliases = new HashMap<>();
    private final Map<Long, Product> byId = new HashMap<>();

    /** aliases: нормализованная фраза → id товара (то, что запомнили из исправлений). */
    public SmartTextParser(Collection<CatalogItem> catalog, Map<String, Long> aliases) {
        for (CatalogItem c : catalog) {
            Product p = new Product(c);
            products.add(p);
            byId.put(c.id(), p);
        }
        if (aliases != null) {
            aliases.forEach((phrase, id) -> {
                if (byId.containsKey(id)) {
                    this.aliases.put(phrase, id);
                    byId.get(id).variants.add(tokens(phrase));
                }
            });
        }
    }

    // ------------------------------------------------------------------ разбор сообщения

    public Result parse(String text) {
        String recipient = null;
        List<Line> lines = new ArrayList<>();
        if (text == null) return new Result(null, null, lines);

        for (String raw : text.replace('\r', '\n').split("\n")) {
            String line = raw.strip();
            if (line.isEmpty()) continue;
            if (recipient == null) {
                Matcher m = RECIPIENT.matcher(line);
                if (m.find() && !looksLikeProduct(m.group(1))) {
                    recipient = m.group(1).strip();
                    // «Это Ойбек: молоко 5» — после имени может идти заказ
                    String rest = line.substring(m.end()).replaceFirst("^[\\s:,.!-]+", "");
                    if (rest.isEmpty() || isNoise(rest)) continue;
                    line = rest;
                }
            }
            line = PHONE.matcher(line).replaceAll(" ");
            line = NUMBERING.matcher(line).replaceFirst("");
            if (isNoise(line)) continue;
            for (String fragment : fragments(line)) {
                Line l = parseFragment(fragment);
                if (l != null) lines.add(l);
            }
        }
        String listName = recipient != null ? "Заказ: " + recipient : null;
        return new Result(listName, recipient, lines);
    }

    private boolean looksLikeProduct(String word) {
        Match m = bestMatches(tokens(word), 1).stream().findFirst().orElse(null);
        return m != null && m.score >= HIGH;
    }

    /** Строка без товара: приветствие, вопрос, «спасибо» и т. п. */
    static boolean isNoise(String line) {
        String t = line.strip();
        if (t.endsWith("?")) return true;
        List<String> words = new ArrayList<>();
        for (String w : t.toLowerCase(Locale.ROOT).split("[^\\p{L}\\d]+")) if (!w.isBlank()) words.add(w);
        if (words.isEmpty()) return true;
        boolean hasLetters = false;
        for (String w : words) if (w.chars().anyMatch(Character::isLetter)) hasLetters = true;
        if (!hasLetters) return true;
        for (String w : words) {
            if (w.chars().allMatch(Character::isDigit)) return false;
            if (!NOISE.contains(w) && !NOISE.contains(normWord(w))) return false;
        }
        return true;
    }

    /** Делит строку на части: по запятым/точкам с запятой, а «молоко 5 хлеб 2» — после чисел. */
    List<String> fragments(String line) {
        List<String> parts = new ArrayList<>();
        for (String p : line.split("(?<!\\d)[,;]|[,;](?!\\d)|\\s+(?:и|va|ва)\\s+(?=\\p{L})")) {
            if (!p.isBlank()) parts.add(p.strip());
        }
        List<String> out = new ArrayList<>();
        for (String p : parts) {
            List<String> split = splitAfterNumbers(p);
            if (split.size() > 1) {
                double whole = parseFragmentScore(p);
                double sum = 0;
                for (String s : split) sum += parseFragmentScore(s);
                if (sum / split.size() > whole + 0.05) {
                    out.addAll(split);
                    continue;
                }
            }
            out.add(p);
        }
        return out;
    }

    private static final Pattern NUM_THEN_WORD = Pattern.compile(
            "(\\d+(?:[.,]\\d+)?\\s*(?:шт|кг|kg|ta|та|dona|л|упак|пачк\\p{L}*)?\\.?)\\s+(?=\\p{L}{3,})", Pattern.UNICODE_CASE | Pattern.CASE_INSENSITIVE);

    static List<String> splitAfterNumbers(String s) {
        List<String> res = new ArrayList<>();
        Matcher m = NUM_THEN_WORD.matcher(s);
        int start = 0;
        while (m.find()) {
            String before = s.substring(start, m.end(1)).strip();
            if (before.chars().anyMatch(Character::isLetter)) {
                res.add(before);
                start = m.end();
            }
        }
        String tail = s.substring(start).strip();
        if (!tail.isEmpty()) res.add(tail);
        return res;
    }

    private double parseFragmentScore(String s) {
        Line l = parseFragment(s);
        if (l == null || l.productId() == null) return 0;
        return switch (l.confidence()) {
            case "high" -> 1;
            case "medium" -> .75;
            case "low" -> .5;
            default -> 0;
        };
    }

    // ------------------------------------------------------------------ одна позиция

    /** Кусок строки: слово или число (возможно, с единицей «10кг», «x3»). */
    record Tok(String text, BigDecimal number, String unit, boolean xMarker, boolean sizeAfter) {
        boolean isNum() {
            return number != null;
        }
    }

    private static final Pattern TOKEN = Pattern.compile(
            "(?iu)([xх×*])?(\\d+(?:[.,]\\d+)?)([xх×*]\\d+(?:[.,]\\d+)?)*\\s*(\\p{L}{1,10}\\.?)?|[\\p{L}'ʻ’`]+");

    Line parseFragment(String fragment) {
        String src = fragment.strip();
        List<Tok> toks = new ArrayList<>();
        Matcher m = TOKEN.matcher(src);
        while (m.find()) {
            String whole = m.group();
            if (m.group(2) == null) {
                String w = whole.toLowerCase(Locale.ROOT);
                if (UNITS.containsKey(w) && !toks.isEmpty() && toks.get(toks.size() - 1).isNum()
                        && toks.get(toks.size() - 1).unit() == null) {
                    Tok prev = toks.remove(toks.size() - 1);
                    toks.add(new Tok(prev.text() + " " + whole, prev.number(), UNITS.get(w), prev.xMarker(), false));
                    continue;
                }
                if (SIZE_UNITS.contains(w) && !toks.isEmpty() && toks.get(toks.size() - 1).isNum()) {
                    Tok prev = toks.remove(toks.size() - 1);
                    toks.add(new Tok(prev.text() + " " + whole, prev.number(), null, prev.xMarker(), true));
                    continue;
                }
                toks.add(new Tok(whole, null, null, false, false));
                continue;
            }
            if (m.group(3) != null) { // «3x2,5» — это размер, часть названия
                toks.add(new Tok(whole.replaceAll("\\s*\\p{L}+\\.?$", ""), null, null, false, false));
                String tail = m.group(4);
                if (tail != null) toks.add(new Tok(tail, null, null, false, false));
                continue;
            }
            BigDecimal n = new BigDecimal(m.group(2).replace(',', '.'));
            String unitWord = m.group(4) == null ? null : m.group(4).toLowerCase(Locale.ROOT).replace(".", "");
            String unit = unitWord != null ? UNITS.get(unitWord) : null;
            boolean size = unitWord != null && SIZE_UNITS.contains(unitWord);
            if (unitWord != null && unit == null && !size) {
                // «5банок» / «2пачки» — число и слово слиплись: делим
                toks.add(new Tok(m.group(2), n, null, m.group(1) != null, false));
                toks.add(new Tok(m.group(4), null, null, false, false));
            } else {
                toks.add(new Tok(whole, n, unit, m.group(1) != null, size));
            }
        }
        if (toks.stream().noneMatch(t -> !t.isNum() && t.text().chars().anyMatch(Character::isLetter))) return null;

        // перебираем варианты: какое из чисел — количество (или ни одного)
        List<Integer> numIdx = new ArrayList<>();
        for (int i = 0; i < toks.size(); i++) if (toks.get(i).isNum()) numIdx.add(i);
        Candidate best = null;
        List<Integer> options = new ArrayList<>(numIdx);
        options.add(-1);
        for (int qi : options) {
            List<String> nameParts = new ArrayList<>();
            for (int i = 0; i < toks.size(); i++) if (i != qi) nameParts.add(toks.get(i).text());
            String name = String.join(" ", nameParts).replaceAll("^[\\s:—–-]+|[\\s:—–-]+$", "");
            if (name.chars().noneMatch(Character::isLetter)) continue;
            List<Match> matches = bestMatches(tokens(name), 6);
            double top = matches.isEmpty() ? 0 : matches.get(0).score;
            double bonus = 0;
            if (qi >= 0) {
                Tok q = toks.get(qi);
                bonus += 0.02;                                   // количество обычно указано
                if (q.unit() != null || q.xMarker()) bonus += 0.06; // «3шт», «х3»
                if (q.sizeAfter()) bonus -= 0.12;                // «25 мм» — это размер
                if (qi == numIdx.get(numIdx.size() - 1)) bonus += 0.03; // последнее число
                if (q.number().signum() <= 0) bonus -= 0.5;
            }
            Candidate c = new Candidate(qi, name, matches, top + bonus);
            if (best == null || c.total > best.total + 1e-9) best = c;
        }
        if (best == null) return null;

        BigDecimal qty = null;
        String unit = null;
        if (best.qtyIndex >= 0) {
            Tok q = toks.get(best.qtyIndex);
            qty = q.number();
            unit = q.unit();
        }
        return toLine(src, best.name, qty, unit, best.matches);
    }

    record Candidate(int qtyIndex, String name, List<Match> matches, double total) {
    }

    private Line toLine(String src, String name, BigDecimal qty, String unit, List<Match> matches) {
        String cleanName = name.replaceAll("\\s+", " ").strip();
        if (matches.isEmpty() || matches.get(0).score < SUGGEST) {
            return new Line(src, cleanName, qty, unit, null, "none", List.of(), null);
        }
        Match top = matches.get(0);
        double second = matches.size() > 1 ? matches.get(1).score : 0;
        String confidence;
        if (top.alias || (top.score >= HIGH && top.score - second >= GAP)
                || (top.score >= 0.66 && top.score - second >= 0.28)) confidence = "high"; // единственный явный кандидат
        else if (top.score >= MEDIUM) confidence = "medium";
        else if (top.score >= LOW) confidence = "low";
        else confidence = "none";

        List<Long> alts = new ArrayList<>();
        if (!"high".equals(confidence)) {
            double floor = Math.max(SUGGEST, top.score - 0.25);
            for (int i = 1; i < matches.size() && alts.size() < 4; i++) {
                if (matches.get(i).score >= floor) alts.add(matches.get(i).product.item.id());
            }
        }
        String comment = null;
        if ("medium".equals(confidence) && !alts.isEmpty()) {
            comment = "Похожих товаров несколько — проверьте, тот ли выбран";
        } else if ("low".equals(confidence)) {
            comment = "Не уверен, что это тот товар — проверьте";
        }
        Long pid = "none".equals(confidence) ? null : top.product.item.id();
        if (pid == null) {
            List<Long> sugg = new ArrayList<>();
            for (Match mm : matches) if (sugg.size() < 3 && mm.score >= SUGGEST) sugg.add(mm.product.item.id());
            alts = sugg;
        }
        return new Line(src, cleanName, qty, unit, pid, confidence, alts, comment);
    }

    // ------------------------------------------------------------------ сопоставление с каталогом

    static final class Product {
        final CatalogItem item;
        final List<List<String>> variants = new ArrayList<>();
        final String sku;
        final String barcode;

        Product(CatalogItem c) {
            this.item = c;
            variants.add(tokens(c.name()));
            this.sku = c.sku() == null ? "" : c.sku().toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\d]", "");
            this.barcode = c.barcode() == null ? "" : c.barcode().strip();
        }
    }

    record Match(Product product, double score, boolean alias) {
    }

    List<Match> bestMatches(List<String> query, int limit) {
        if (query.isEmpty()) return List.of();
        String phrase = String.join(" ", query);
        Long aliasId = aliases.get(phrase);
        List<Match> all = new ArrayList<>();
        for (Product p : products) {
            if (aliasId != null && aliasId == p.item.id()) {
                all.add(new Match(p, 1.0, true));
                continue;
            }
            double s = 0;
            String joined = String.join("", query);
            if (!p.barcode.isEmpty() && joined.equals(p.barcode)) s = 1.0;
            else if (!p.sku.isEmpty() && joined.equals(p.sku)) s = 1.0;
            else for (List<String> v : p.variants) s = Math.max(s, score(query, v));
            if (s > 0.2) all.add(new Match(p, s, false));
        }
        all.sort(Comparator.comparingDouble(Match::score).reversed());
        return all.size() > limit ? all.subList(0, limit) : all;
    }

    /** Похожесть запроса и названия товара (0..1). */
    static double score(List<String> q, List<String> p) {
        if (p.isEmpty()) return 0;
        double wq = 0, sq = 0;
        boolean anyWordHit = false;
        for (String t : q) {
            double w = weight(t);
            double b = 0;
            for (String u : p) b = Math.max(b, tokenSim(t, u));
            String syn = SYNONYMS.get(t);
            if (syn != null) for (String u : p) b = Math.max(b, tokenSim(syn, u));
            if (!isNumber(t) && b >= 0.7) anyWordHit = true;
            wq += w;
            sq += w * b;
        }
        if (!anyWordHit) return 0; // хотя бы одно слово должно совпасть
        double wp = 0, sp = 0;
        for (String u : p) {
            double w = weight(u) * (isNumber(u) ? 0.5 : 1);
            double b = 0;
            for (String t : q) {
                b = Math.max(b, tokenSim(t, u));
                String syn = SYNONYMS.get(t);
                if (syn != null) b = Math.max(b, tokenSim(syn, u));
            }
            wp += w;
            sp += w * b;
        }
        double covQ = wq == 0 ? 0 : sq / wq;
        double covP = wp == 0 ? 0 : sp / wp;
        // первое слово названия товара обычно главное («Масло сливочное» — масло)
        double head = 0;
        String first = p.get(0);
        for (String t : q) {
            head = Math.max(head, tokenSim(t, first));
            String syn = SYNONYMS.get(t);
            if (syn != null) head = Math.max(head, tokenSim(syn, first));
        }
        double sc = 0.62 * covQ + 0.26 * covP + 0.12 * head;
        // в сообщении есть размер/объём, а у товара другой («1 л» против «0,5 л») — сильный штраф
        boolean pHasNum = p.stream().anyMatch(SmartTextParser::isNumber);
        for (String t : q) {
            if (isNumber(t) && pHasNum && p.stream().noneMatch(u -> isNumber(u) && tokenSim(t, u) == 1)) sc *= 0.82;
        }
        return sc;
    }

    private static double weight(String t) {
        if (isNumber(t)) return 0.7;
        return Math.min(1.6, 0.5 + t.length() * 0.18);
    }

    static boolean isNumber(String t) {
        return !t.isEmpty() && Character.isDigit(t.charAt(0)) && t.chars().allMatch(c -> Character.isDigit(c) || c == '.' || c == 'x');
    }

    /** Похожесть двух слов с учётом опечаток, сокращений и окончаний. */
    static double tokenSim(String a, String b) {
        if (a.equals(b)) return 1;
        if (isNumber(a) || isNumber(b)) return isNumber(a) && isNumber(b) && numEq(a, b) ? 1 : 0;
        String sa = stem(a), sb = stem(b);
        if (sa.equals(sb)) return 0.97;
        int la = sa.length(), lb = sb.length();
        // сокращение: «мол» → «молоко», «сах» → «сахар»
        if (Math.min(la, lb) >= 3 && (sb.startsWith(sa) || sa.startsWith(sb))) {
            return 0.78 + 0.17 * Math.min(la, lb) / Math.max(la, lb);
        }
        int d = damerau(sa, sb);
        int max = Math.max(la, lb);
        if (max <= 3) return d == 0 ? 1 : 0;
        double sim = 1.0 - (double) d / max;
        if (d == 1 && max >= 4) sim = Math.max(sim, 0.86);
        if (d == 2 && max >= 7) sim = Math.max(sim, 0.76);
        return sim < 0.5 ? sim * 0.5 : sim;
    }

    private static boolean numEq(String a, String b) {
        try {
            if (a.contains("x") || b.contains("x")) return a.equals(b);
            return new BigDecimal(a).compareTo(new BigDecimal(b)) == 0;
        } catch (NumberFormatException e) {
            return a.equals(b);
        }
    }

    static int damerau(String a, String b) {
        int n = a.length(), m = b.length();
        int[][] d = new int[n + 1][m + 1];
        for (int i = 0; i <= n; i++) d[i][0] = i;
        for (int j = 0; j <= m; j++) d[0][j] = j;
        for (int i = 1; i <= n; i++) {
            for (int j = 1; j <= m; j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                d[i][j] = Math.min(Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1), d[i - 1][j - 1] + cost);
                if (i > 1 && j > 1 && a.charAt(i - 1) == b.charAt(j - 2) && a.charAt(i - 2) == b.charAt(j - 1)) {
                    d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
                }
            }
        }
        return d[n][m];
    }

    private static final String[] ENDINGS = {"ями", "ами", "ого", "его", "ому", "ему", "ыми", "ими", "ых", "их",
            "лар", "лер", "ов", "ев", "ей", "ой", "ий", "ый", "ая", "яя", "ое", "ее", "ам", "ям", "ах", "ях",
            "ы", "и", "а", "я", "о", "е", "у", "ю"};

    static String stem(String w) {
        if (w.length() <= 4) return w;
        for (String e : ENDINGS) {
            if (w.endsWith(e) && w.length() - e.length() >= 3) return w.substring(0, w.length() - e.length());
        }
        return w;
    }

    // ------------------------------------------------------------------ нормализация текста

    /** Слова фразы: нижний регистр, латиница → кириллица, без знаков. «3×2,5» → «3x2.5». */
    public static List<String> tokens(String s) {
        List<String> out = new ArrayList<>();
        if (s == null) return out;
        String t = Normalizer.normalize(s, Normalizer.Form.NFC).toLowerCase(Locale.ROOT)
                .replaceAll("(\\d)\\s*[xх×*]\\s*(\\d)", "$1x$2")
                .replaceAll("(\\d),(\\d)", "$1.$2")
                .replaceAll("(\\d)(\\p{L})", "$1 $2")
                .replaceAll("(\\p{L})(\\d)", "$1 $2");
        for (String w : t.split("[^\\p{L}\\d.x'ʻ’`]+")) {
            w = w.replaceAll("^[.'ʻ’`]+|[.'ʻ’`]+$", "");
            if (w.isEmpty()) continue;
            if (w.matches("\\d[\\d.x]*")) {
                out.add(w.replaceAll("\\.0+$", ""));
                continue;
            }
            String n = normWord(w);
            // единицы в названиях пишут по-разному: «1 литр» = «1 л», «200 гр» = «200 г»
            String u = UNITS.get(w);
            if (u != null && !u.equals("шт") && !u.equals("коробка") && !u.equals("упак")) n = normWord(u);
            if (!n.isEmpty()) out.add(n);
        }
        return out;
    }

    /** Одно слово: латиница → кириллица, узбекские буквы → русские, без ь/ъ. */
    public static String normWord(String w) {
        String s = w.toLowerCase(Locale.ROOT).replace('ё', 'е');
        if (s.chars().anyMatch(c -> c >= 'a' && c <= 'z')) s = translit(s);
        s = s.replace('ў', 'у').replace('ғ', 'г').replace('қ', 'к').replace('ҳ', 'х')
                .replace("ь", "").replace("ъ", "").replace("'", "").replace("ʻ", "").replace("’", "").replace("`", "");
        return s.replaceAll("[^\\p{L}\\d]", "");
    }


    static String translit(String s) {
        StringBuilder sb = new StringBuilder();
        int i = 0;
        outer:
        while (i < s.length()) {
            for (String[] p : LAT) {
                if (s.startsWith(p[0], i)) {
                    sb.append(p[1]);
                    i += p[0].length();
                    continue outer;
                }
            }
            sb.append(s.charAt(i));
            i++;
        }
        return sb.toString();
    }

    /** Ключ для запоминания исправлений. */
    public static String aliasKey(String phrase) {
        return String.join(" ", tokens(phrase));
    }

    public Set<Long> ids() {
        return new HashSet<>(byId.keySet());
    }
}
