// Membuat tabel users dan satu akun awal
//
// Cara pakai:
//   node scripts/seed.js <username> <password> "<nama>" [ROLE]
// Contoh:
//   node scripts/seed.js owner PasswordKuat123 "Pemilik Toko" OWNER
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

async function main() {
    const [username, password, name, role = "OWNER"] = process.argv.slice(2);

    if (!username || !password || !name) {
        console.error('Pemakaian: node scripts/seed.js <username> <password> "<nama>" [ROLE]');
        process.exit(1);
    }

    // Buat tabel users bila belum ada
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            username      varchar(50)  NOT NULL UNIQUE,
            password_hash varchar(100) NOT NULL,
            name          varchar(100) NOT NULL,
            role          varchar(20)  NOT NULL DEFAULT 'OWNER',
            is_active     boolean      NOT NULL DEFAULT true,
            created_at    timestamp    NOT NULL DEFAULT now()
        )
    `);

    // Password disimpan dalam bentuk hash, bukan teks asli
    const hash = await bcrypt.hash(password, 10);

    // Tambah akun; jika username sudah ada, perbarui datanya
    await pool.query(
        `INSERT INTO users (username, password_hash, name, role)
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (username) DO UPDATE
            SET password_hash = EXCLUDED.password_hash,
                name = EXCLUDED.name,
                role = EXCLUDED.role,
                is_active = true`,
        [username, hash, name, role.toUpperCase()]
    );

    console.log(`Akun "${username}" (${role.toUpperCase()}) siap dipakai.`);
    await pool.end();
}

main().catch(err => {
    console.error("Gagal membuat akun:", err.message);
    process.exit(1);
});