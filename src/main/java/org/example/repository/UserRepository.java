package org.example.repository;

import org.example.domain.Entities.User;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class UserRepository {

    private static final RowMapper<User> MAPPER = (rs, n) -> new User(
            rs.getLong("id"), rs.getString("username"), rs.getString("full_name"),
            rs.getString("position"), rs.getString("phone"), Rows.ts(rs, "created_at"));

    private final JdbcClient jdbc;

    public UserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<User> findFirst() {
        return jdbc.sql("SELECT * FROM users ORDER BY id LIMIT 1").query(MAPPER).optional();
    }

    public void update(long id, String fullName, String position, String phone) {
        jdbc.sql("UPDATE users SET full_name = :fullName, position = :position, phone = :phone WHERE id = :id")
                .param("fullName", fullName).param("position", position).param("phone", phone).param("id", id)
                .update();
    }
}
