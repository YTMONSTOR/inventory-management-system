package org.example.web;

import org.example.domain.ApiException;
import org.example.web.dto.Dto.ErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.LinkedHashMap;
import java.util.Map;

/** Превращает любые ошибки в понятные сообщения на русском. */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> api(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(new ErrorResponse(e.getMessage(), Map.of()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(f -> fields.putIfAbsent(f.getField(), f.getDefaultMessage()));
        String first = fields.isEmpty() ? "Проверьте заполнение формы" : fields.values().iterator().next();
        return ResponseEntity.badRequest().body(new ErrorResponse(first, fields));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ErrorResponse> unreadable(Exception e) {
        return ResponseEntity.badRequest().body(new ErrorResponse(
                "Некоторые поля заполнены неверно. Числа вводите цифрами, например 12 или 12,5", Map.of()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> tooLarge(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(new ErrorResponse("Фото слишком большое. Максимум — 12 МБ на один файл", Map.of()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> integrity(DataIntegrityViolationException e) {
        String msg = String.valueOf(e.getMostSpecificCause().getMessage());
        log.warn("Нарушение ограничения базы данных: {}", msg);
        String text;
        if (msg.contains("quantity_check") || msg.contains("balance_after"))
            text = "Остаток товара не может стать отрицательным";
        else if (msg.contains("ux_products_sku")) text = "Такой код товара уже есть";
        else if (msg.contains("ux_products_barcode")) text = "Такой штрихкод уже есть у другого товара";
        else if (msg.contains("ux_categories_name")) text = "Такая категория уже есть";
        else if (msg.contains("issued_le_required")) text = "Нельзя выдать больше, чем указано в списке";
        else text = "Данные не сохранены: они противоречат уже записанным. Обновите страницу и попробуйте снова";
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(text, Map.of()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> other(Exception e) throws Exception {
        if (e instanceof org.springframework.web.servlet.resource.NoResourceFoundException) throw e;
        log.error("Непредвиденная ошибка", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ErrorResponse(
                "Что-то пошло не так на сервере. Попробуйте ещё раз; если повторится — перезапустите программу",
                Map.of()));
    }
}
