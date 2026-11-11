const express = require("express");
const cors = require("cors");
require("dotenv").config();

const commodityRoutes = require("./routes/commodityRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const { authenticate, requireOwner } = require("./middleware/auth");

// JWT_SECRET wajib ada (harus sama dengan yang dipakai ms_01_auth)
if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET belum diisi di file .env");
    process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json());

// Halaman utama
app.get("/", (req, res) => {
    res.json({
        message: "Commodity Microservice berjalan",
        service: "ms_02_commodity"
    });
});

// API barang (sesuai SRS):
// - GET daftar & detail     : semua pengguna yang login
// - POST/PUT/DELETE         : OWNER
// - GET /:id/pricehistories : OWNER
app.use(
    "/commodities",
    authenticate,
    (req, res, next) => {
        const butuhOwner = req.method !== "GET" || /\/pricehistories\/?$/.test(req.path);
        return butuhOwner ? requireOwner(req, res, next) : next();
    },
    commodityRoutes
);

// API kategori: seluruh operasi (CRUD) khusus OWNER/dan pealnggan
app.use(
    "/categories",
    authenticate,
    (req, res, next) => {
        // Semua pengguna login boleh melihat kategori
        if (req.method === "GET") {
            return next();
        }

        // Tambah, ubah, dan hapus hanya untuk OWNER
        return requireOwner(req, res, next);
    },
    categoryRoutes
);

// Menjalankan server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Commodity Server berjalan di http://localhost:${PORT}`);
});