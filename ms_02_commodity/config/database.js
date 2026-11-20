
const { Pool } = require("pg");
require("dotenv").config();

const db = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

db.connect()
    .then(client => {
        console.log("PostgreSQL Commodity berhasil terhubung!");
        client.release();
    })
    .catch(error => {
        console.error("Koneksi database gagal:", error.message);
    });

module.exports = db;
