// Auth Microservice (ms_01_auth)
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");

// JWT_SECRET wajib ada
if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET belum diisi di file .env");
    process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json());

// Halaman utama (untuk mengecek layanan berjalan)
app.get("/", (req, res) => {
    res.json({ message: "Auth Microservice berjalan", service: "ms_01_auth" });
});

// Endpoint login: POST /auth/login
app.use("/auth", authRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Auth Server berjalan di http://localhost:${PORT}`);
});