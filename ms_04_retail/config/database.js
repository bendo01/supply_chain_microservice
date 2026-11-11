const { Pool } = require("pg");
require("dotenv").config();

const db = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

db.query("SELECT NOW()")
    .then(() => console.log("PostgreSQL Sales berhasil terhubung!"))
    .catch(error => console.error("Database Sales gagal:", error.message));

module.exports = db;