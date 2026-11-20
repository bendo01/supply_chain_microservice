
const db = require("../config/database");

// ==========================================
// MENGAMBIL SEMUA BARANG AKTIF
// ==========================================
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

// ==========================================
// MENGAMBIL BARANG BERDASARKAN ID
// ==========================================
async function getCommodityById(id) {
    const result = await db.query(
        "SELECT * FROM commodities WHERE id = $1",
        [id]
    );

    return result.rows[0];
}

// ==========================================
// MENAMBAHKAN BARANG
// ==========================================
async function createCommodity(data) {
    const result = await db.query(
        `INSERT INTO commodities
        (sku, name, category_id, unit, cost_price,
         selling_price, image_url)
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

// ==========================================
// MENGUBAH BARANG + PRICE HISTORY
// ==========================================
async function updateCommodity(id, data, user) {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        // Ambil data lama
        const oldResult = await client.query(
            `SELECT id, cost_price, selling_price
             FROM commodities
             WHERE id = $1
             AND is_active = TRUE
             FOR UPDATE`,
            [id]
        );

        if (oldResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
        }

        const oldData = oldResult.rows[0];

        // Bandingkan harga lama dan baru
        const priceChanged =
            Number(oldData.cost_price) !== Number(data.cost_price) ||
            Number(oldData.selling_price) !== Number(data.selling_price);

        // Update barang
        const updateResult = await client.query(
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

        const updatedCommodity = updateResult.rows[0];

        // Simpan riwayat jika harga berubah
        if (priceChanged) {
            await client.query(
                `INSERT INTO price_histories (
                    commodity_id,
                    cost_price,
                    selling_price,
                    changed_by,
                    changed_by_name,
                    effective_at
                )
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
                [
                    id,
                    data.cost_price,
                    data.selling_price,
                    user.id,
                    user.name
                ]
            );
        }

        await client.query("COMMIT");

        return updatedCommodity;

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;

    } finally {
        client.release();
    }
}

// ==========================================
// MENONAKTIFKAN BARANG
// ==========================================
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

// ==========================================
// EXPORT SEMUA FUNGSI
// ==========================================
module.exports = {
    getAllCommodities,
    getCommodityById,
    createCommodity,
    updateCommodity,
    deactivateCommodity
};
