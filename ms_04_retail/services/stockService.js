const { HttpError } = require("./errors");

// Semua fungsi menerima `client` (transaksi aktif) agar atomik.
// Baris stok dikunci dengan SELECT ... FOR UPDATE untuk mencegah oversell.
async function lockStock(client, retailId, commodityId) {
    const { rows } = await client.query(
        `SELECT * FROM retail_stocks
         WHERE retail_id = $1 AND commodity_id = $2
         FOR UPDATE`,
        [retailId, commodityId]
    );
    return rows[0];
}

async function reserve(client, retailId, commodityId, qty, label) {
    const stock = await lockStock(client, retailId, commodityId);
    if (!stock || stock.quantity - stock.reserved < qty) {
        throw new HttpError(409, `Stok ${label || commodityId} tidak mencukupi`);
    }
    await client.query(
        `UPDATE retail_stocks SET reserved = reserved + $3, updated_at = now()
         WHERE id = $1 AND retail_id = $2`,
        [stock.id, retailId, qty]
    );
}

async function release(client, retailId, commodityId, qty) {
    await lockStock(client, retailId, commodityId);
    await client.query(
        `UPDATE retail_stocks SET reserved = GREATEST(reserved - $3, 0), updated_at = now()
         WHERE retail_id = $1 AND commodity_id = $2`,
        [retailId, commodityId, qty]
    );
}

// Pindahkan reservasi menjadi pengurangan stok nyata. Mengembalikan baris stok terbaru.
async function deduct(client, retailId, commodityId, qty) {
    await lockStock(client, retailId, commodityId);
    const { rows } = await client.query(
        `UPDATE retail_stocks
         SET quantity = quantity - $3, reserved = GREATEST(reserved - $3, 0), updated_at = now()
         WHERE retail_id = $1 AND commodity_id = $2
         RETURNING *`,
        [retailId, commodityId, qty]
    );
    return rows[0];
}

async function add(client, retailId, commodityId, qty) {
    await client.query(
        `INSERT INTO retail_stocks (retail_id, commodity_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (retail_id, commodity_id)
         DO UPDATE SET quantity = retail_stocks.quantity + EXCLUDED.quantity, updated_at = now()`,
        [retailId, commodityId, qty]
    );
}

async function list(db, retailId) {
    const { rows } = await db.query(
        `SELECT *, quantity - reserved AS available
         FROM retail_stocks WHERE retail_id = $1 ORDER BY commodity_id`,
        [retailId]
    );
    return rows;
}

// Atur stok awal / min_stock (set nilai absolut).
async function upsert(db, retailId, commodityId, { quantity, min_stock }) {
    const { rows } = await db.query(
        `INSERT INTO retail_stocks (retail_id, commodity_id, quantity, min_stock)
         VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 0))
         ON CONFLICT (retail_id, commodity_id) DO UPDATE SET
            quantity = COALESCE($3, retail_stocks.quantity),
            min_stock = COALESCE($4, retail_stocks.min_stock),
            updated_at = now()
         RETURNING *`,
        [retailId, commodityId, quantity ?? null, min_stock ?? null]
    );
    return rows[0];
}

module.exports = { reserve, release, deduct, add, list, upsert };
