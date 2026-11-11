const db = require("../config/database");


// Mengambil semua barang yang masih aktif

async function getAllCommodities(filters = {}) {
    const { q, category_id } = filters;

    const result = await db.query(`
        SELECT
            c.id,
            c.sku,
            c.name,
            c.category_id,
            c.unit,
            c.cost_price,
            c.selling_price,
            c.image_url,
            c.is_active,
            cat.name AS category_name

        FROM commodities c

        LEFT JOIN categories cat
            ON c.category_id = cat.id

        WHERE c.is_active = TRUE

        AND (
            $1::text IS NULL
            OR c.name ILIKE '%' || $1 || '%'
            OR c.sku ILIKE '%' || $1 || '%'
            OR cat.name ILIKE '%' || $1 || '%'
        )

        AND (
            $2::uuid IS NULL
            OR c.category_id = $2
        )

        ORDER BY c.created_at DESC
    `, [
        q || null,
        category_id || null
    ]);

    return result.rows;
}


// Mengambil barang berdasarkan ID
async function getCommodityById(id) {
    const result = await db.query(
        "SELECT * FROM commodities WHERE id = $1",
        [id]
    );

    return result.rows[0];
}

// Menambahkan barang
async function createCommodity(data) {
    const result = await db.query(
        `INSERT INTO commodities
        (sku, name, category_id, unit, cost_price, selling_price, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
            data.sku,
            data.name,
            data.category_id,
            data.unit,
            data.cost_price,
            data.selling_price,
            data.image_url || null
        ]
    );

    return result.rows[0];
}

// Mengubah data barang
async function updateCommodity(id, data) {
    const result = await db.query(
        `UPDATE commodities
         SET
            sku = $1,
            name = $2,
            category_id = $3,
            unit = $4,
            cost_price = $5,
            selling_price = $6,
            image_url = $7,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
           AND is_active = TRUE
         RETURNING *`,
        [
            data.sku,
            data.name,
            data.category_id,
            data.unit,
            data.cost_price,
            data.selling_price,
            data.image_url || null,
            id
        ]
    );

    return result.rows[0];
}

// Menonaktifkan barang (soft delete)
async function deactivateCommodity(id) {
    const result = await db.query(
        `UPDATE commodities
         SET
            is_active = FALSE,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND is_active = TRUE
         RETURNING *`,
        [id]
    );

    return result.rows[0];
}

module.exports = {
    getAllCommodities,
    getCommodityById,
    createCommodity,
    updateCommodity,
    deactivateCommodity
};