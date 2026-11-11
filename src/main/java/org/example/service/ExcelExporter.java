package org.example.service;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Выгрузка отчёта в Excel (.xlsx). Числа остаются числами — их можно складывать в Excel. */
@Component
public class ExcelExporter {

    public byte[] export(ReportTable t, String company) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Отчёт");
            var fmt = wb.createDataFormat();

            Font titleFont = wb.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 15);
            CellStyle title = wb.createCellStyle();
            title.setFont(titleFont);

            Font muted = wb.createFont();
            muted.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            CellStyle sub = wb.createCellStyle();
            sub.setFont(muted);

            Font bold = wb.createFont();
            bold.setBold(true);
            CellStyle header = wb.createCellStyle();
            header.setFont(bold);
            header.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            header.setBorderBottom(BorderStyle.THIN);
            header.setWrapText(true);

            CellStyle text = wb.createCellStyle();
            CellStyle number = wb.createCellStyle();
            number.setDataFormat(fmt.getFormat("#,##0.###"));
            CellStyle money = wb.createCellStyle();
            money.setDataFormat(fmt.getFormat("#,##0.00"));
            CellStyle percent = wb.createCellStyle();
            percent.setDataFormat(fmt.getFormat("0.0"));
            CellStyle date = wb.createCellStyle();
            date.setDataFormat(fmt.getFormat("dd.mm.yyyy hh:mm"));
            date.setAlignment(HorizontalAlignment.LEFT);

            CellStyle totalText = wb.createCellStyle();
            totalText.setFont(bold);
            totalText.setBorderTop(BorderStyle.THIN);
            CellStyle totalNumber = wb.createCellStyle();
            totalNumber.cloneStyleFrom(number);
            totalNumber.setFont(bold);
            totalNumber.setBorderTop(BorderStyle.THIN);
            CellStyle totalMoney = wb.createCellStyle();
            totalMoney.cloneStyleFrom(money);
            totalMoney.setFont(bold);
            totalMoney.setBorderTop(BorderStyle.THIN);

            int r = 0;
            cell(sheet.createRow(r++), 0, t.title(), title);
            cell(sheet.createRow(r++), 0, company + " · " + t.subtitle(), sub);
            for (ReportTable.Summary s : t.summary()) {
                Row row = sheet.createRow(r++);
                cell(row, 0, s.label() + ": " + s.value(), text);
            }
            r++;

            int headerRow = r;
            Row h = sheet.createRow(r++);
            h.setHeightInPoints(30);
            List<ReportTable.Column> cols = t.columns();
            for (int c = 0; c < cols.size(); c++) {
                cell(h, c, cols.get(c).title(), header);
                sheet.setColumnWidth(c, Math.min(255, cols.get(c).width() + 2) * 256);
            }

            for (List<Object> values : t.rows()) {
                Row row = sheet.createRow(r++);
                for (int c = 0; c < cols.size(); c++) {
                    Object v = c < values.size() ? values.get(c) : null;
                    CellStyle st = switch (cols.get(c).type()) {
                        case MONEY -> money;
                        case NUMBER -> number;
                        case PERCENT -> percent;
                        case DATETIME -> date;
                        default -> text;
                    };
                    cell(row, c, v, st);
                }
            }
            if (t.totals() != null) {
                Row row = sheet.createRow(r++);
                for (int c = 0; c < cols.size(); c++) {
                    Object v = c < t.totals().size() ? t.totals().get(c) : null;
                    CellStyle st = switch (cols.get(c).type()) {
                        case MONEY -> totalMoney;
                        case NUMBER, PERCENT -> totalNumber;
                        default -> totalText;
                    };
                    cell(row, c, v, st);
                }
            }
            if (!t.rows().isEmpty()) {
                sheet.setAutoFilter(new CellRangeAddress(headerRow, headerRow + t.rows().size(), 0, cols.size() - 1));
            }
            sheet.createFreezePane(0, headerRow + 1);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось сформировать Excel", e);
        }
    }

    private static void cell(Row row, int col, Object v, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellStyle(style);
        if (v == null) return;
        if (v instanceof BigDecimal b) c.setCellValue(b.doubleValue());
        else if (v instanceof Number n) c.setCellValue(n.doubleValue());
        else if (v instanceof LocalDateTime d) c.setCellValue(d);
        else c.setCellValue(String.valueOf(v));
    }
}
