package org.example.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/** Помощники для количеств и денег. */
public final class Num {

    private Num() {
    }

    public static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    public static boolean positive(BigDecimal v) {
        return v != null && v.signum() > 0;
    }

    public static BigDecimal qty(BigDecimal v) {
        return nz(v).setScale(3, RoundingMode.HALF_UP);
    }

    public static BigDecimal money(BigDecimal v) {
        return nz(v).setScale(2, RoundingMode.HALF_UP);
    }

    /** 1234.500 -> "1 234,5" */
    public static String fmtQty(BigDecimal v) {
        return format(nz(v), "#,##0.###");
    }

    /** 45000 -> "45 000" */
    public static String fmtMoney(BigDecimal v) {
        return format(nz(v), "#,##0.##");
    }

    private static String format(BigDecimal v, String pattern) {
        DecimalFormatSymbols s = new DecimalFormatSymbols(Locale.forLanguageTag("ru"));
        s.setGroupingSeparator(' ');
        s.setDecimalSeparator(',');
        return new DecimalFormat(pattern, s).format(v);
    }

    public static String trim(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
