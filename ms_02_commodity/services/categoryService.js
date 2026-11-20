const db = require("../config/database");

// Mengambil semua kategori
async function getAllCategories() {
    const result = await db.query(`
        SELECT id, name
        FROM categories
        ORDER BY name ASC
    `);

    return result.rows;
}

// Menambahkan kategori
async function createCategory(name) {
    const result = await db.query(`
        INSERT INTO categories (name)
        VALUES ($1)
        RETURNING id, name
    `, [name]);

    return result.rows[0];
}

// Mengubah kategori
async function updateCategory(id, name) {
    const result = await db.query(`
        UPDATE categories
        SET name = $1
        WHERE id = $2
        RETURNING id, name
    `, [name, id]);

    return result.rows[0];
}

// Menghapus kategori
async function deleteCategory(id) {
    // Periksa apakah kategori masih digunakan oleh barang
    const used = await db.query(`
        SELECT id
        FROM commodities
        WHERE category_id = $1
        LIMIT 1
    `, [id]);

    if (used.rows.length > 0) {
        return { used: true };
    }

    const result = await db.query(`
        DELETE FROM categories
        WHERE id = $1
        RETURNING id, name
    `, [id]);

    return result.rows[0] || null;
}

module.exports = {
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory
};