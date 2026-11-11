-- =====================================================================
--  Склад — схема базы данных PostgreSQL.
--  Выполняется при каждом запуске; все команды идемпотентны,
--  существующие данные не удаляются.
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(60)  NOT NULL UNIQUE,
    full_name   VARCHAR(120) NOT NULL,
    position    VARCHAR(120),
    phone       VARCHAR(40),
    created_at  TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key   VARCHAR(60) PRIMARY KEY,
    setting_value VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS categories (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    color       VARCHAR(20)  NOT NULL DEFAULT '#2343B8',
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_name ON categories (lower(name));

CREATE SEQUENCE IF NOT EXISTS product_sku_seq START 1;

CREATE TABLE IF NOT EXISTS products (
    id              BIGSERIAL PRIMARY KEY,
    sku             VARCHAR(40)    NOT NULL,
    name            VARCHAR(200)   NOT NULL,
    category_id     BIGINT         REFERENCES categories (id) ON DELETE SET NULL,
    description     TEXT,
    purchase_price  NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
    selling_price   NUMERIC(16, 2)          CHECK (selling_price IS NULL OR selling_price >= 0),
    quantity        NUMERIC(16, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_quantity    NUMERIC(16, 3) NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
    unit            VARCHAR(20)    NOT NULL DEFAULT 'шт',
    barcode         VARCHAR(64),
    location        VARCHAR(100),
    deleted         BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP      NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP      NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_sku     ON products (lower(sku));
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_barcode ON products (barcode) WHERE barcode IS NOT NULL AND deleted = FALSE;
CREATE INDEX        IF NOT EXISTS ix_products_category ON products (category_id);
CREATE INDEX        IF NOT EXISTS ix_products_name     ON products (lower(name));

CREATE TABLE IF NOT EXISTS product_images (
    id            BIGSERIAL PRIMARY KEY,
    product_id    BIGINT       NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    file_name     VARCHAR(120) NOT NULL UNIQUE,
    original_name VARCHAR(255),
    content_type  VARCHAR(80)  NOT NULL,
    size_bytes    BIGINT       NOT NULL CHECK (size_bytes > 0),
    is_primary    BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order    INT          NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_product_images_product ON product_images (product_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_images_primary ON product_images (product_id) WHERE is_primary;

CREATE TABLE IF NOT EXISTS product_lists (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(200) NOT NULL,
    recipient     VARCHAR(200),
    notes         TEXT,
    status        VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT', 'PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED')),
    user_id       BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT now(),
    completed_at  TIMESTAMP,
    cancelled_at  TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_product_lists_status ON product_lists (status);

CREATE TABLE IF NOT EXISTS product_list_items (
    id            BIGSERIAL PRIMARY KEY,
    list_id       BIGINT         NOT NULL REFERENCES product_lists (id) ON DELETE CASCADE,
    product_id    BIGINT         NOT NULL REFERENCES products (id),
    required_qty  NUMERIC(16, 3) NOT NULL CHECK (required_qty > 0),
    issued_qty    NUMERIC(16, 3) NOT NULL DEFAULT 0 CHECK (issued_qty >= 0),
    unit_price    NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    note          VARCHAR(300),
    sort_order    INT            NOT NULL DEFAULT 0,
    CONSTRAINT ck_list_item_issued_le_required CHECK (issued_qty <= required_qty),
    CONSTRAINT ux_list_item_product UNIQUE (list_id, product_id)
);
CREATE INDEX IF NOT EXISTS ix_list_items_product ON product_list_items (product_id);

CREATE TABLE IF NOT EXISTS issue_records (
    id            BIGSERIAL PRIMARY KEY,
    list_id       BIGINT         REFERENCES product_lists (id) ON DELETE SET NULL,
    recipient     VARCHAR(200),
    note          VARCHAR(500),
    total_qty     NUMERIC(16, 3) NOT NULL DEFAULT 0 CHECK (total_qty >= 0),
    total_amount  NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    user_id       BIGINT         REFERENCES users (id) ON DELETE SET NULL,
    created_at    TIMESTAMP      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_issue_records_created ON issue_records (created_at);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id               BIGSERIAL PRIMARY KEY,
    product_id       BIGINT         NOT NULL REFERENCES products (id),
    movement_type    VARCHAR(20)    NOT NULL
                     CHECK (movement_type IN ('INITIAL', 'RECEIPT', 'ISSUE', 'ADJUSTMENT')),
    quantity         NUMERIC(16, 3) NOT NULL CHECK (quantity <> 0),
    balance_after    NUMERIC(16, 3) NOT NULL CHECK (balance_after >= 0),
    unit_price       NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    note             VARCHAR(500),
    list_id          BIGINT         REFERENCES product_lists (id) ON DELETE SET NULL,
    list_item_id     BIGINT         REFERENCES product_list_items (id) ON DELETE SET NULL,
    issue_record_id  BIGINT         REFERENCES issue_records (id) ON DELETE SET NULL,
    user_id          BIGINT         REFERENCES users (id) ON DELETE SET NULL,
    created_at       TIMESTAMP      NOT NULL DEFAULT now(),
    -- приход и начальный остаток всегда положительны, выдача — отрицательна
    CONSTRAINT ck_movement_sign CHECK (
        (movement_type IN ('INITIAL', 'RECEIPT') AND quantity > 0) OR
        (movement_type = 'ISSUE' AND quantity < 0) OR
        (movement_type = 'ADJUSTMENT')
    )
);
CREATE INDEX IF NOT EXISTS ix_movements_product ON inventory_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_movements_created ON inventory_movements (created_at);
CREATE INDEX IF NOT EXISTS ix_movements_issue   ON inventory_movements (issue_record_id);

CREATE TABLE IF NOT EXISTS activity_logs (
    id           BIGSERIAL PRIMARY KEY,
    action       VARCHAR(40)  NOT NULL,
    entity_type  VARCHAR(30)  NOT NULL,
    entity_id    BIGINT,
    title        VARCHAR(300) NOT NULL,
    details      VARCHAR(1000),
    user_id      BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_activity_created ON activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_activity_action  ON activity_logs (action);

-- Пользователь по умолчанию и базовые настройки (только если их ещё нет)
INSERT INTO users (username, full_name, position)
VALUES ('admin', 'Администратор', 'Заведующий складом')
ON CONFLICT (username) DO NOTHING;

INSERT INTO app_settings (setting_key, setting_value) VALUES
    ('company_name', 'Мой склад'),
    ('currency', 'UZS'),
    ('default_unit', 'шт'),
    ('theme', 'light')
ON CONFLICT (setting_key) DO NOTHING;

-- Запомненные исправления встроенного разбора сообщений:
-- «сут» → Молоко 1 л. Следующий раз такое слово сразу находит нужный товар.
CREATE TABLE IF NOT EXISTS product_aliases (
    id          BIGSERIAL PRIMARY KEY,
    phrase      VARCHAR(200) NOT NULL UNIQUE,
    product_id  BIGINT       NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    uses        INT          NOT NULL DEFAULT 1,
    updated_at  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_product_aliases_product ON product_aliases (product_id);
