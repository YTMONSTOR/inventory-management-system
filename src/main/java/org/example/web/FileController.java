package org.example.web;

import org.example.domain.ApiException;
import org.example.repository.ImageRepository;
import org.example.service.StorageService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.util.concurrent.TimeUnit;

/** Отдаёт фотографии товаров. */
@RestController
public class FileController {

    private final StorageService storage;
    private final ImageRepository images;

    public FileController(StorageService storage, ImageRepository images) {
        this.storage = storage;
        this.images = images;
    }

    @GetMapping("/files/{fileName}")
    public ResponseEntity<FileSystemResource> file(@PathVariable String fileName) {
        if (!fileName.matches("[a-f0-9]{32}\\.[a-z]{3,4}")) throw ApiException.notFound("Фото не найдено");
        var img = images.findByFileName(fileName).orElseThrow(() -> ApiException.notFound("Фото не найдено"));
        var path = storage.resolve(fileName);
        if (!Files.exists(path)) throw ApiException.notFound("Фото не найдено");
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic())
                .contentType(MediaType.parseMediaType(img.contentType()))
                .body(new FileSystemResource(path));
    }
}
