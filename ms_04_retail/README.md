# ms-04-retail (Retail Service)

Service **Retail** untuk tugas microservices rantai pasok. Bagian ini mencakup tanggung jawab:
- **Kasir (POS)**: transaksi penjualan multi-item, metode bayar tunai/QRIS (simulasi), riwayat & pembatalan.
- **Stok retail**: lihat stok per retail, stok tersedia vs reserved, minimum stok, set/atur stok.
- **Permintaan restock**: buat permintaan restock ke gudang, alur status (REQUESTED → APPROVED → SHIPPED → RECEIVED/CANCELLED), konfirmasi penerimaan menambah stok.
- **Dashboard**: ringkasan omzet/transaksi/laba-rugi (HPP/COGS), penjualan harian, analisis barang terjual, perbandingan antar retail, peringatan stok menipis.

> Dibuat mandiri (standalone) dengan Node.js + Express + MySQL agar mudah didemokan, dan disiapkan agar bisa diintegrasikan dengan Gateway/service lain (Commodity, Payment, Warehouse/Distribution) sesuai arsitektur microservice.

## Stack
- Node.js, Express
- MySQL/MariaDB (`mysql2/promise`)
- Frontend statis sederhana (HTML/CSS/JS) di folder `public/`

## Struktur
- `migrations/0001_init.sql` — skema database + data contoh (2 retail, 4 komoditas, stok awal)
- `src/config/db.js` — koneksi pool MySQL (env)
- `src/services/` — logika bisnis (retail, stock, sales/POS, restock, dashboard)
- `src/routes/index.js` — definisi REST API `/api/*`
- `src/server.js` — bootstrap Express
- `public/` — UI: `login.html`, `index.html` (dashboard), `kasir.html` (POS), `stok.html`, `restock.html`

## Prasyarat
- Node.js 18+ (disarankan)
- MySQL/MariaDB berjalan lokal

## Setup & Menjalankan
1. Install dependency:
   ```bash
   npm install
   ```
2. Buat database dan tabel + seed data:
   ```bash
   mysql -u root -p < migrations/0001_init.sql
   ```
   (File ini membuat database `db_retail`, tabel, dan data contoh.)
3. (Opsional) set environment variable jika koneksi DB berbeda:
   - `DB_HOST` (default `localhost`)
   - `DB_PORT` (default `3306`)
   - `DB_USER` (default `root`)
   - `DB_PASSWORD` (default kosong)
   - `DB_NAME` (default `db_retail`)
   - `PORT` (default `3004`)
4. Jalankan service:
   ```bash
   npm start
   ```
5. Buka browser: `http://localhost:3004`

## Akun Demo (UI)
Login sederhana untuk simulasi peran (pada integrasi penuh, autentikasi/otorisasi dilakukan Gateway JWT):
- `kasir` / `123` — role CASHIER (retail-01)
- `manajer` / `123` — role RETAIL_MANAGER (retail-01)
- `owner` / `123` — role OWNER (semua retail)

## API Utama
Base URL: `/api`

- **Health/Auth**
  - `GET /health`
  - `POST /auth/login`
- **Retail**
  - `GET /retails`, `GET /retails/:id`, `POST /retails`, `PUT /retails/:id`, `DELETE /retails/:id` (soft deactivate)
- **Commodity & Stok**
  - `GET /commodities`
  - `GET /stocks?retail_id=`
  - `POST /stocks` `{ retail_id, commodity_id, quantity?, min_stock? }`
- **POS / Sales**
  - `POST /sales` `{ retail_id, cashier_name?, payment_method?, status?, items:[{commodity_id, quantity}] }` — membuat transaksi (default COMPLETED), validasi & potong stok atomik, hitung total dari harga/HPP komoditas, beri warning jika stok menipis.
  - `GET /sales?retail_id=&status=&from=&to=&limit=`
  - `GET /sales/:id`
  - `POST /sales/:id/pay` — selesaikan transaksi PENDING (release reservasi → deduct)
  - `POST /sales/:id/cancel` — batalkan (kembalikan stok jika COMPLETED, lepas reservasi jika PENDING)
  - `POST /kasir-jual` — endpoint kompatibilitas UI lama
- **Restock Request**
  - `POST /restock-requests` `{ retail_id, requested_by?, note?, items:[{commodity_id, quantity}] }`
  - `GET /restock-requests?retail_id=&status=`
  - `GET /restock-requests/:id`
  - `POST /restock-requests/:id/status` `{ status }` (REQUESTED→APPROVED→SHIPPED→RECEIVED/CANCELLED; RECEIVED menambah stok)
  - `POST /restock-requests/:id/confirm` — konfirmasi penerimaan (set RECEIVED)
- **Dashboard**
  - `GET /dashboard/overview?retail_id=&from=&to=` — transaksi, omzet, COGS, laba, rata-rata, item terjual, tren harian, stok menipis
  - `GET /dashboard/retails/compare?from=&to=` — perbandingan laba-rugi per retail
  - `GET /dashboard/items/analysis?retail_id=&from=&to=&limit=` — analisis barang terjual (qty, omzet, laba)

## Catatan Integrasi Microservice
- Dalam arsitektur penuh, request dari klien masuk lewat **Gateway** (JWT, otorisasi per peran, `X-Retail-Id`) dan komunikasi antar service via REST/event (RabbitMQ) sesuai SRS.
- Service ini sudah memisahkan concern (POS/sales, stock, restock, dashboard) dan memakai transaksi DB + `SELECT ... FOR UPDATE` untuk mencegah oversell pada stok.
- Untuk integrasi lanjutan: harga/HPP dapat diambil dari service **Commodity**, pembuatan/konsolidasi pembayaran dari **Payment** (`payment.paid/failed`), dan permintaan/pengiriman barang disinkronkan dengan **Warehouse/Distribution** melalui event/status (mis. `retail.stock.low`, `restock.requested`, `shipment.delivered`).
