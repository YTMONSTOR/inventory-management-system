package org.example.repository;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashMap;
import java.util.Map;

@Repository
public class SettingsRepository {

    private final JdbcClient jdbc;

    public SettingsRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, String> findAll() {
        Map<String, String> map = new LinkedHashMap<>();
        jdbc.sql("SELECT setting_key, setting_value FROM app_settings ORDER BY setting_key")
                .query(rs -> {
                    map.put(rs.getString(1), rs.getString(2));
                });
        return map;
    }

    public void put(String key, String value) {
        jdbc.sql("""
                INSERT INTO app_settings (setting_key, setting_value) VALUES (:k, :v)
                ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
                """).param("k", key).param("v", value).update();
    }
}
