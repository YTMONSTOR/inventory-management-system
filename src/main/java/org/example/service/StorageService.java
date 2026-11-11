package org.example.service;

import org.example.domain.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** Хранит фотографии товаров в папке на диске. */
@Service
public class StorageService {

    private static final Map<String, String> ALLOWED = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp",
            "image/gif", ".gif");

    private final Path root;

    public StorageService(@Value("${app.data-dir}") String dataDir) throws IOException {
        this.root = Path.of(dataDir, "uploads").toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    public record Stored(String fileName, String contentType, long size) {
    }

    public Stored save(MultipartFile file) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("Файл пустой");
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (type.equals("image/jpg")) type = "image/jpeg";
        String ext = ALLOWED.get(type);
        if (ext == null) throw ApiException.badRequest("Можно загружать только фото в формате JPG, PNG, WEBP или GIF");
        String name = UUID.randomUUID().toString().replace("-", "") + ext;
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, root.resolve(name), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                    "Не удалось сохранить фото на диск: " + e.getMessage());
        }
        return new Stored(name, type, file.getSize());
    }

    public Path resolve(String fileName) {
        Path p = root.resolve(fileName).normalize();
        if (!p.startsWith(root)) throw ApiException.notFound("Файл не найден");
        return p;
    }

    public void delete(String fileName) {
        try {
            Files.deleteIfExists(resolve(fileName));
        } catch (IOException ignored) {
            // файл мог быть удалён вручную — это не ошибка
        }
    }
}
