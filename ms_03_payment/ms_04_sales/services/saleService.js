
const db = require("../config/database");

async function createSale(items, token) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Keranjang belanja masih kosong");
    }

    // Validasi dan ambil harga terbaru dari Commodity
    const preparedItems = [];

    for (const item of items) {
        const quantity = Number(item.quantity);

        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new Error("Jumlah barang tidak valid");
        }

        const response = await fetch(
            `${process.env.COMMODITY_API_URL}/${item.commodity_id}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                `Barang dengan ID ${item.commodity_id} tidak ditemukan`
            );
        }

        const commodityResult = await response.json();

        const commodity = commodityResult.data || commodityResult;

        if (!commodity.is_active) {
            throw new Error(
                `Barang ${commodity.name} sudah tidak aktif`
            );
        }

        preparedItems.push({
            commodity_id: commodity.id,
            sku: commodity.sku,
            name: commodity.name,
            unit: commodity.unit,
            quantity,
            cost_price: Number(commodity.cost_price),
            selling_price: Number(commodity.selling_price),
            subtotal: Number(commodity.selling_price) * quantity
        });
    }

    const total = preparedItems.reduce(
        (sum, item) => sum + item.subtotal,
        0
    );

    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const retailId = process.env.RETAIL_ID;

        console.log("RETAIL_ID dari .env:", retailId);

        const saleResult = await client.query(
            `INSERT INTO sales
                (retail_id, total_amount, status)
             VALUES ($1, $2, 'PENDING')
             RETURNING *`,
            [process.env.RETAIL_ID, total]
        );

        const sale = saleResult.rows[0];

        for (const item of preparedItems) {
            await client.query(
                `INSERT INTO sale_items
                (sale_id, commodity_id, sku, name, unit,
                 quantity, cost_price, selling_price, subtotal)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [
                    sale.id,
                    item.commodity_id,
                    item.sku,
                    item.name,
                    item.unit,
                    item.quantity,
                    item.cost_price,
                    item.selling_price,
                    item.subtotal
                ]
            );
        }

        await client.query("COMMIT");

        return {
            ...sale,
            items: preparedItems
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function getSaleById(id) {
    const saleResult = await db.query(
        "SELECT * FROM sales WHERE id = $1",
        [id]
    );

    if (!saleResult.rows.length) return null;

    const sale = saleResult.rows[0];

    const itemsResult = await db.query(
        `SELECT * FROM sale_items
         WHERE sale_id = $1
         ORDER BY created_at`,
        [id]
    );

    return {
        ...sale,
        items: itemsResult.rows
    };
}

async function markSalePaid(id) {
    const result = await db.query(
        `UPDATE sales
         SET status = 'PAID',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND status = 'PENDING'
         RETURNING *`,
        [id]
    );

    return result.rows[0];
}

module.exports = {
    createSale,
    getSaleById,
    markSalePaid
};
