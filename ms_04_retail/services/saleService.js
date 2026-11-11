const db = require("../config/database");
const stockService = require("./stockService");
const outbox = require("./outbox");
const { HttpError } = require("./errors");

async function fetchCommodity(id, token) {
    let response;
    try {
        response = await fetch(`${process.env.COMMODITY_API_URL}/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(5000)
        });
    } catch (e) {
        throw new HttpError(502, "Service Commodity tidak dapat dihubungi");
    }
    if (!response.ok) {
        throw new HttpError(400, `Barang dengan ID ${id} tidak ditemukan`);
    }
    const body = await response.json();
    return body.data || body;
}

// Hak akses baca: OWNER semua retail, peran lain hanya retail miliknya.
function scopeRetail(user, requested) {
    if (user.role === "OWNER") return requested || null;
    if (!user.retail_id) throw new HttpError(403, "Akun tidak terikat ke retail");
    return user.retail_id;
}

async function createSale(items, user, token) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new HttpError(400, "Keranjang belanja masih kosong");
    }
    const retailId = user.retail_id || process.env.RETAIL_ID;
    if (!retailId) throw new HttpError(403, "Akun tidak terikat ke retail");

    // Gabungkan item dengan barang yang sama.
    const qtyById = new Map();
    for (const item of items) {
        const quantity = Number(item.quantity);
        if (!item.commodity_id || !Number.isInteger(quantity) || quantity <= 0) {
            throw new HttpError(400, "Item atau jumlah barang tidak valid");
        }
        qtyById.set(item.commodity_id, (qtyById.get(item.commodity_id) || 0) + quantity);
    }

    // Snapshot harga & HPP dari Commodity.
    const prepared = [];
    for (const [commodityId, quantity] of qtyById) {
        const c = await fetchCommodity(commodityId, token);
        if (!c.is_active) throw new HttpError(400, `Barang ${c.name} sudah tidak aktif`);
        prepared.push({
            commodity_id: commodityId,
            sku: c.sku,
            name: c.name,
            unit: c.unit,
            quantity,
            unit_price: Number(c.selling_price),
            unit_cost: Number(c.cost_price)
        });
    }
    // Urutan kunci konsisten agar tidak deadlock.
    prepared.sort((a, b) => a.commodity_id.localeCompare(b.commodity_id));

    const total = prepared.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        for (const item of prepared) {
            await stockService.reserve(client, retailId, item.commodity_id, item.quantity, item.name);
        }

        const { rows } = await client.query(
            `INSERT INTO sales (retail_id, cashier_id, total, status)
             VALUES ($1, $2, $3, 'PENDING') RETURNING *`,
            [retailId, user.id, total]
        );
        const sale = rows[0];

        for (const i of prepared) {
            await client.query(
                `INSERT INTO sale_items
                    (sale_id, commodity_id, sku, name, unit, quantity, unit_price, unit_cost)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [sale.id, i.commodity_id, i.sku, i.name, i.unit, i.quantity, i.unit_price, i.unit_cost]
            );
        }

        await client.query("COMMIT");
        return { ...sale, items: prepared };
    } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23503") throw new HttpError(400, "Retail tidak ditemukan");
        throw error;
    } finally {
        client.release();
    }
}

async function getSaleById(id, user) {
    const retailId = scopeRetail(user);
    const { rows } = await db.query(
        "SELECT * FROM sales WHERE id = $1 AND ($2::uuid IS NULL OR retail_id = $2)",
        [id, retailId]
    );
    if (!rows.length) return null;

    const items = await db.query(
        "SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY created_at",
        [id]
    );
    return { ...rows[0], items: items.rows };
}

async function listSales(user, { status, retail_id, limit, offset }) {
    const retailId = scopeRetail(user, retail_id);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const off = Math.max(parseInt(offset, 10) || 0, 0);
    const { rows } = await db.query(
        `SELECT * FROM sales
         WHERE ($1::uuid IS NULL OR retail_id = $1)
           AND ($2::text IS NULL OR status = $2)
         ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
        [retailId, status || null, lim, off]
    );
    return rows;
}

// Ubah status sale PENDING -> newStatus dengan pengaman terhadap transisi ganda.
async function transition(id, user, newStatus, onItems) {
    const retailId = scopeRetail(user);
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const { rows } = await client.query(
            `SELECT * FROM sales WHERE id = $1 AND retail_id = $2 FOR UPDATE`,
            [id, retailId]
        );
        const sale = rows[0];
        if (!sale) {
            await client.query("ROLLBACK");
            return null;
        }
        if (sale.status !== "PENDING") {
            throw new HttpError(409, `Transaksi sudah ${sale.status}`);
        }

        const { rows: items } = await client.query(
            "SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY commodity_id",
            [id]
        );
        await onItems(client, sale, items);

        const { rows: updated } = await client.query(
            `UPDATE sales SET status = $2::varchar,
                completed_at = CASE WHEN $2::varchar = 'COMPLETED' THEN now() ELSE completed_at END
             WHERE id = $1 RETURNING *`,
            [id, newStatus]
        );
        await client.query("COMMIT");
        return { ...updated[0], items };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

// Pembayaran berhasil: kurangi stok, terbitkan sale.completed & retail.stock.low.
function markSalePaid(id, user) {
    return transition(id, user, "COMPLETED", async (client, sale, items) => {
        for (const i of items) {
            const stock = await stockService.deduct(client, sale.retail_id, i.commodity_id, i.quantity);
            if (stock && stock.quantity <= stock.min_stock) {
                await outbox.publish(client, "retail.stock.low", {
                    retail_id: sale.retail_id,
                    commodity_id: i.commodity_id,
                    quantity: stock.quantity,
                    min_stock: stock.min_stock
                });
            }
        }
        const revenue = items.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);
        const cogs = items.reduce((s, i) => s + Number(i.unit_cost) * i.quantity, 0);
        await outbox.publish(client, "sale.completed", {
            sale_id: sale.id,
            retail_id: sale.retail_id,
            revenue,
            cogs,
            profit: revenue - cogs,
            items: items.map(i => ({
                commodity_id: i.commodity_id,
                quantity: i.quantity,
                unit_price: Number(i.unit_price),
                unit_cost: Number(i.unit_cost)
            }))
        });
    });
}

// Pembatalan: lepas reservasi stok.
function cancelSale(id, user) {
    return transition(id, user, "CANCELLED", async (client, sale, items) => {
        for (const i of items) {
            await stockService.release(client, sale.retail_id, i.commodity_id, i.quantity);
        }
    });
}

module.exports = { createSale, getSaleById, listSales, markSalePaid, cancelSale };
