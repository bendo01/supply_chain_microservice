// Koneksi PostgreSQL untuk database db_auth
const { Pool } = require("pg");
require("dotenv").config();

// Pool = kumpulan koneksi yang dipakai ulang agar query lebih efisien
const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || "db_auth",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD
});

module.exports = pool;