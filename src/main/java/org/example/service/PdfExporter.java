package org.example.service;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.example.domain.Num;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** Выгрузка отчёта в PDF с поддержкой кириллицы (встроенный шрифт DejaVu Sans). */
@Component
public class PdfExporter {

    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");
    private static final Color INK = new Color(0x17, 0x20, 0x33);
    private static final Color MUTED = new Color(0x6B, 0x75, 0x89);
    private static final Color LINE = new Color(0xE3, 0xE7, 0xEE);
    private static final Color HEAD = new Color(0xF1, 0xF4, 0xF9);
    private static final Color ACCENT = new Color(0x23, 0x43, 0xB8);

    private final BaseFont regular;
    private final BaseFont bold;

    public PdfExporter() throws IOException, DocumentException {
        this.regular = load("fonts/DejaVuSans.ttf");
        this.bold = load("fonts/DejaVuSans-Bold.ttf");
    }

    private static BaseFont load(String path) throws IOException, DocumentException {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            byte[] bytes = in.readAllBytes();
            String name = path.substring(path.lastIndexOf('/') + 1);
            return BaseFont.createFont(name, BaseFont.IDENTITY_H, BaseFont.EMBEDDED, true, bytes, null);
        }
    }

    public byte[] export(ReportTable t, String company) {
        boolean landscape = t.columns().size() > 6;
        Document doc = new Document(landscape ? PageSize.A4.rotate() : PageSize.A4, 32, 32, 32, 36);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(doc, out);
            doc.addTitle(t.title());
            doc.open();

            Paragraph brand = new Paragraph(company, new Font(bold, 9, Font.NORMAL, ACCENT));
            doc.add(brand);
            Paragraph title = new Paragraph(t.title(), new Font(bold, 17, Font.NORMAL, INK));
            title.setSpacingBefore(4);
            doc.add(title);
            Paragraph sub = new Paragraph(t.subtitle(), new Font(regular, 9, Font.NORMAL, MUTED));
            sub.setSpacingAfter(8);
            doc.add(sub);

            if (!t.summary().isEmpty()) {
                PdfPTable sum = new PdfPTable(Math.min(4, t.summary().size()));
                sum.setWidthPercentage(100);
                sum.setSpacingAfter(12);
                for (ReportTable.Summary s : t.summary()) {
                    Phrase p = new Phrase();
                    p.add(new Phrase(s.label() + "\n", new Font(regular, 8, Font.NORMAL, MUTED)));
                    p.add(new Phrase(s.value(), new Font(bold, 11, Font.NORMAL, INK)));
                    PdfPCell c = new PdfPCell(p);
                    c.setBorderColor(LINE);
                    c.setPadding(7);
                    sum.addCell(c);
                }
                int rest = t.summary().size() % sum.getNumberOfColumns();
                if (rest != 0) {
                    for (int i = rest; i < sum.getNumberOfColumns(); i++) {
                        PdfPCell c = new PdfPCell(new Phrase(""));
                        c.setBorder(Rectangle.NO_BORDER);
                        sum.addCell(c);
                    }
                }
                doc.add(sum);
            }

            List<ReportTable.Column> cols = t.columns();
            PdfPTable table = new PdfPTable(cols.size());
            table.setWidthPercentage(100);
            float[] widths = new float[cols.size()];
            for (int i = 0; i < cols.size(); i++) widths[i] = cols.get(i).width();
            table.setWidths(widths);
            table.setHeaderRows(1);

            Font hf = new Font(bold, 8, Font.NORMAL, INK);
            for (ReportTable.Column c : cols) {
                PdfPCell cell = new PdfPCell(new Phrase(c.title(), hf));
                cell.setBackgroundColor(HEAD);
                cell.setBorderColor(LINE);
                cell.setPadding(5);
                cell.setHorizontalAlignment(numeric(c) ? Element.ALIGN_RIGHT : Element.ALIGN_LEFT);
                table.addCell(cell);
            }
            Font cf = new Font(regular, 8, Font.NORMAL, INK);
            if (t.rows().isEmpty()) {
                PdfPCell empty = new PdfPCell(new Phrase("Нет данных за выбранный период", new Font(regular, 9, Font.NORMAL, MUTED)));
                empty.setColspan(cols.size());
                empty.setPadding(14);
                empty.setHorizontalAlignment(Element.ALIGN_CENTER);
                empty.setBorderColor(LINE);
                table.addCell(empty);
            }
            for (List<Object> row : t.rows()) addRow(table, cols, row, cf, null);
            if (t.totals() != null && !t.rows().isEmpty()) addRow(table, cols, t.totals(), new Font(bold, 8, Font.NORMAL, INK), HEAD);
            doc.add(table);

            Paragraph foot = new Paragraph("Сформировано " + LocalDateTime.now().format(DT),
                    new Font(regular, 7, Font.NORMAL, MUTED));
            foot.setSpacingBefore(10);
            doc.add(foot);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException e) {
            throw new IllegalStateException("Не удалось сформировать PDF", e);
        }
    }

    private static void addRow(PdfPTable table, List<ReportTable.Column> cols, List<Object> row, Font f, Color bg) {
        for (int i = 0; i < cols.size(); i++) {
            Object v = i < row.size() ? row.get(i) : null;
            PdfPCell cell = new PdfPCell(new Phrase(format(cols.get(i), v), f));
            cell.setBorderColor(LINE);
            cell.setPadding(4.5f);
            if (bg != null) cell.setBackgroundColor(bg);
            cell.setHorizontalAlignment(numeric(cols.get(i)) ? Element.ALIGN_RIGHT : Element.ALIGN_LEFT);
            table.addCell(cell);
        }
    }

    private static boolean numeric(ReportTable.Column c) {
        return c.type() == ReportTable.Type.MONEY || c.type() == ReportTable.Type.NUMBER
                || c.type() == ReportTable.Type.PERCENT;
    }

    private static String format(ReportTable.Column c, Object v) {
        if (v == null) return "";
        if (v instanceof LocalDateTime d) return d.format(DT);
        if (v instanceof BigDecimal b) return c.type() == ReportTable.Type.NUMBER ? Num.fmtQty(b) : Num.fmtMoney(b);
        if (v instanceof Number n) return String.valueOf(n);
        return String.valueOf(v);
    }
}
