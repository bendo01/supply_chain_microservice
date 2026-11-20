
const db = require("../config/database");

// Mengambil riwayat harga berdasarkan ID barang
async function getPriceHistories(commodityId) {
    const result = await db.query(
        `SELECT
            id,
            commodity_id,
            cost_price,
            selling_price,
            changed_by,
            changed_by_name,
            effective_at
        FROM price_histories
        WHERE commodity_id = $1
        ORDER BY effective_at DESC`,
        [commodityId]
    );

    return result.rows;
}

module.exports = {
    getPriceHistories
};
