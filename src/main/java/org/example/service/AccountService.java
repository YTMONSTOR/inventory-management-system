package org.example.service;

import org.example.domain.ActivityAction;
import org.example.domain.ApiException;
import org.example.repository.SettingsRepository;
import org.example.repository.UserRepository;
import org.example.web.dto.Dto.ProfileRequest;
import org.example.web.dto.Dto.ProfileView;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;

/** Профиль пользователя и общие настройки. */
@Service
public class AccountService {

    private static final Set<String> KEYS = Set.of("company_name", "currency", "default_unit", "theme");

    private final UserRepository users;
    private final SettingsRepository settings;
    private final ActivityService activity;

    public AccountService(UserRepository users, SettingsRepository settings, ActivityService activity) {
        this.users = users;
        this.settings = settings;
        this.activity = activity;
    }

    @Transactional(readOnly = true)
    public ProfileView profile() {
        var u = users.findFirst().orElseThrow(() -> ApiException.notFound("Пользователь не найден"));
        return new ProfileView(u.id(), u.username(), u.fullName(), u.position(), u.phone());
    }

    @Transactional
    public ProfileView updateProfile(ProfileRequest r) {
        var u = users.findFirst().orElseThrow(() -> ApiException.notFound("Пользователь не найден"));
        users.update(u.id(), r.fullName().trim(), r.position(), r.phone());
        activity.log(ActivityAction.SETTINGS_UPDATED, "USER", u.id(), "Изменён профиль", r.fullName().trim());
        return profile();
    }

    @Transactional(readOnly = true)
    public Map<String, String> settings() {
        return settings.findAll();
    }

    @Transactional
    public Map<String, String> updateSettings(Map<String, String> values) {
        boolean changed = false;
        for (var e : values.entrySet()) {
            if (!KEYS.contains(e.getKey())) continue;
            String v = e.getValue() == null ? "" : e.getValue().trim();
            if (v.length() > 200) throw ApiException.badRequest("Слишком длинное значение");
            settings.put(e.getKey(), v);
            if (!"theme".equals(e.getKey())) changed = true;
        }
        if (changed) activity.log(ActivityAction.SETTINGS_UPDATED, "SETTINGS", null, "Изменены настройки", null);
        return settings.findAll();
    }
}
