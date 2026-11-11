-- Skema db_retail (PostgreSQL 13+). Jalankan: psql -d db_retail -f database/schema.sql
CREATE TABLE IF NOT EXISTS retails (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code       varchar(50)  NOT NULL UNIQUE,
    name       varchar(150) NOT NULL,
    address    text,
    is_active  boolean      NOT NULL DEFAULT true,
    created_at timestamp    NOT NULL DEFAULT now(),
    updated_at timestamp    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retail_stocks (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    retail_id    uuid    NOT NULL REFERENCES retails(id),
    commodity_id uuid    NOT NULL,
    quantity     integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved     integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    min_stock    integer NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    updated_at   timestamp NOT NULL DEFAULT now(),
    UNIQUE (retail_id, commodity_id),
    CHECK (reserved <= quantity)
);

CREATE TABLE IF NOT EXISTS sales (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    retail_id      uuid NOT NULL REFERENCES retails(id),
    cashier_id     uuid,
    payment_id     uuid,
    payment_method varchar(20),
    total          numeric(14,2) NOT NULL,
    status         varchar(20) NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','COMPLETED','CANCELLED')),
    created_at     timestamp NOT NULL DEFAULT now(),
    completed_at   timestamp
);
CREATE INDEX IF NOT EXISTS idx_sales_retail_created ON sales (retail_id, created_at);

CREATE TABLE IF NOT EXISTS sale_items (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id      uuid NOT NULL REFERENCES sales(id),
    commodity_id uuid NOT NULL,
    sku          varchar(100),
    name         varchar(200),
    unit         varchar(30),
    quantity     integer NOT NULL CHECK (quantity > 0),
    unit_price   numeric(14,2) NOT NULL,
    unit_cost    numeric(14,2) NOT NULL,
    created_at   timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items (sale_id);

CREATE TABLE IF NOT EXISTS restock_requests (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    retail_id  uuid NOT NULL REFERENCES retails(id),
    manager_id uuid,
    status     varchar(20) NOT NULL DEFAULT 'REQUESTED',
    note       text,
    created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restock_request_items (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restock_request_id uuid NOT NULL REFERENCES restock_requests(id),
    commodity_id       uuid NOT NULL,
    quantity           integer NOT NULL CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS sales_daily_summaries (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    retail_id    uuid NOT NULL,
    summary_date date NOT NULL,
    revenue      numeric(14,2) NOT NULL DEFAULT 0,
    cogs         numeric(14,2) NOT NULL DEFAULT 0,
    profit       numeric(14,2) NOT NULL DEFAULT 0,
    tx_count     integer NOT NULL DEFAULT 0,
    UNIQUE (retail_id, summary_date)
);

CREATE TABLE IF NOT EXISTS item_sales_summaries (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    retail_id    uuid NOT NULL,
    commodity_id uuid NOT NULL,
    summary_date date NOT NULL,
    qty_sold     integer NOT NULL DEFAULT 0,
    revenue      numeric(14,2) NOT NULL DEFAULT 0,
    profit       numeric(14,2) NOT NULL DEFAULT 0,
    UNIQUE (retail_id, commodity_id, summary_date)
);

CREATE TABLE IF NOT EXISTS processed_events (
    event_id     uuid PRIMARY KEY,
    topic        varchar(100) NOT NULL,
    processed_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic        varchar(100) NOT NULL,
    payload      jsonb NOT NULL,
    created_at   timestamp NOT NULL DEFAULT now(),
    published_at timestamp
);
