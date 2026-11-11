// Logika login
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// POST /auth/login
// Body: { username, password }
// Jika sukses: { token, user: { id, username, name, role } }
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body || {};

        // Pastikan username dan password diisi
        if (!username || !password) {
            return res.status(400).json({ message: "Username dan password wajib diisi." });
        }

        // Cari pengguna di tabel users
        const result = await pool.query(
            `SELECT id, username, password_hash, name, role, is_active
               FROM users
              WHERE username = $1`,
            [username]
        );
        const user = result.rows[0];

        // Cocokkan password dengan hash yang tersimpan.
        // Pesan galat sengaja disamakan agar orang jahat tidak tahu
        // apakah username-nya ada atau tidak.
        const valid = user && user.is_active &&
            await bcrypt.compare(password, user.password_hash);

        if (!valid) {
            return res.status(401).json({ message: "Username atau password salah." });
        }

        // Buat token (tiket masuk) berisi identitas dan peran pengguna
        const token = jwt.sign(
            { sub: user.id, username: user.username, name: user.name, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES || "8h" }
        );

        res.json({
            token,
            user: { id: user.id, username: user.username, name: user.name, role: user.role }
        });

    } catch (error) {
        console.error("Kesalahan login:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
};