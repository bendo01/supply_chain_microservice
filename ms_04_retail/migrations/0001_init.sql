-- Retail Service schema (MySQL)
-- Jalankan: mysql -u root -p < migrations/0001_init.sql

CREATE DATABASE IF NOT EXISTS db_retail;
USE db_retail;

DROP TABLE IF EXISTS restock_request_items;
DROP TABLE IF EXISTS restock_requests;
DROP TABLE IF EXISTS sale_items;
DROP TABLE IF EXISTS sales;
DROP TABLE IF EXISTS retail_stocks;
DROP TABLE IF EXISTS commodities;
DROP TABLE IF EXISTS retails;

CREATE TABLE retails (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE commodities (
  id VARCHAR(36) PRIMARY KEY,
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
  selling_price DECIMAL(14,2) NOT NULL,
  cost_price DECIMAL(14,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE retail_stocks (
  id VARCHAR(36) PRIMARY KEY,
  retail_id VARCHAR(36) NOT NULL,
  commodity_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  reserved INT NOT NULL DEFAULT 0,
  min_stock INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_stocks_retail FOREIGN KEY (retail_id) REFERENCES retails(id),
  CONSTRAINT fk_stocks_commodity FOREIGN KEY (commodity_id) REFERENCES commodities(id),
  CONSTRAINT uq_retail_commodity UNIQUE (retail_id, commodity_id),
  CONSTRAINT chk_stock_nonneg CHECK (quantity >= 0 AND reserved >= 0 AND reserved <= quantity)
);

CREATE TABLE sales (
  id VARCHAR(36) PRIMARY KEY,
  retail_id VARCHAR(36) NOT NULL,
  cashier_name VARCHAR(100),
  payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH',
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  CONSTRAINT fk_sales_retail FOREIGN KEY (retail_id) REFERENCES retails(id)
);
CREATE INDEX idx_sales_retail_created ON sales (retail_id, created_at);
CREATE INDEX idx_sales_status ON sales (status);

CREATE TABLE sale_items (
  id VARCHAR(36) PRIMARY KEY,
  sale_id VARCHAR(36) NOT NULL,
  commodity_id VARCHAR(36) NOT NULL,
  sku VARCHAR(50),
  name VARCHAR(150),
  quantity INT NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  unit_cost DECIMAL(14,2) NOT NULL,
  line_total DECIMAL(14,2) NOT NULL,
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_commodity FOREIGN KEY (commodity_id) REFERENCES commodities(id),
  CONSTRAINT chk_sale_qty CHECK (quantity > 0)
);
CREATE INDEX idx_sale_items_sale ON sale_items (sale_id);

CREATE TABLE restock_requests (
  id VARCHAR(36) PRIMARY KEY,
  retail_id VARCHAR(36) NOT NULL,
  requested_by VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  received_at TIMESTAMP NULL,
  CONSTRAINT fk_restock_retail FOREIGN KEY (retail_id) REFERENCES retails(id)
);
CREATE INDEX idx_restock_retail_status ON restock_requests (retail_id, status);

CREATE TABLE restock_request_items (
  id VARCHAR(36) PRIMARY KEY,
  restock_request_id VARCHAR(36) NOT NULL,
  commodity_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL,
  received_quantity INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_restock_items_req FOREIGN KEY (restock_request_id) REFERENCES restock_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_restock_items_commodity FOREIGN KEY (commodity_id) REFERENCES commodities(id),
  CONSTRAINT chk_restock_qty CHECK (quantity > 0 AND received_quantity >= 0)
);

INSERT INTO retails (id, code, name, address, is_active) VALUES
  ('retail-01', 'RTL-CEND', 'Mawar Beracun Cabang Cendrawasih', 'Jl. Cendrawasih No. 1', TRUE),
  ('retail-02', 'RTL-TIDUNG', 'Mawar Beracun Cabang Tidung', 'Jl. Tidung No. 2', TRUE);

INSERT INTO commodities (id, sku, name, unit, selling_price, cost_price, is_active) VALUES
  ('cmd-kopi', 'KOPI-001', 'Kopi Hitam', 'cup', 15000, 8000, TRUE),
  ('cmd-roti', 'ROTI-001', 'Roti Bakar', 'pcs', 20000, 11000, TRUE),
  ('cmd-teh',  'TEH-001',  'Teh Manis',  'cup', 10000, 5000, TRUE),
  ('cmd-air',  'AIR-001',  'Air Mineral', 'btl', 6000, 3000, TRUE);

INSERT INTO retail_stocks (id, retail_id, commodity_id, quantity, reserved, min_stock) VALUES
  ('stk-01-kopi', 'retail-01', 'cmd-kopi', 50, 0, 10),
  ('stk-01-roti', 'retail-01', 'cmd-roti', 40, 0, 10),
  ('stk-01-teh',  'retail-01', 'cmd-teh',  60, 0, 10),
  ('stk-01-air',  'retail-01', 'cmd-air',  30, 0, 12),
  ('stk-02-kopi', 'retail-02', 'cmd-kopi', 35, 0, 10),
  ('stk-02-roti', 'retail-02', 'cmd-roti', 25, 0, 10),
  ('stk-02-teh',  'retail-02', 'cmd-teh',  45, 0, 10),
  ('stk-02-air',  'retail-02', 'cmd-air',  20, 0, 12);
