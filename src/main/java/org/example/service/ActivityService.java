package org.example.service;

import org.example.domain.ActivityAction;
import org.example.repository.ActivityRepository;
import org.example.repository.UserRepository;
import org.springframework.stereotype.Service;

/** Записывает события в журнал истории от имени текущего пользователя. */
@Service
public class ActivityService {

    private final ActivityRepository repository;
    private final UserRepository users;

    public ActivityService(ActivityRepository repository, UserRepository users) {
        this.repository = repository;
        this.users = users;
    }

    public Long currentUserId() {
        return users.findFirst().map(u -> u.id()).orElse(null);
    }

    public void log(ActivityAction action, String entityType, Long entityId, String title, String details) {
        String t = title.length() > 300 ? title.substring(0, 297) + "…" : title;
        String d = details != null && details.length() > 1000 ? details.substring(0, 997) + "…" : details;
        repository.insert(action, entityType, entityId, t, d, currentUserId());
    }
}
