const { randomUUID } = require('crypto');
const pool = require('../config/db');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function listStocks({ retailId } = {}) {
  const params = [];
  let sql = `
    SELECT s.id, s.retail_id, r.name AS retail_name, s.commodity_id, c.sku, c.name AS commodity_name,
           c.unit, c.selling_price, c.cost_price, s.quantity, s.reserved,
           (s.quantity - s.reserved) AS available, s.min_stock, s.updated_at
    FROM retail_stocks s
    JOIN retails r ON r.id = s.retail_id
    JOIN commodities c ON c.id = s.commodity_id
  `;
  if (retailId) {
    sql += ' WHERE s.retail_id = ?';
    params.push(retailId);
  }
  sql += ' ORDER BY r.name, c.name';
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function upsertStock({ retailId, commodityId, quantity, minStock }) {
  if (!retailId || !commodityId) throw httpError(400, 'retailId dan commodityId wajib diisi');

  const [retails] = await pool.query('SELECT id FROM retails WHERE id = ?', [retailId]);
  if (!retails.length) throw httpError(404, 'Retail tidak ditemukan');
  const [commodities] = await pool.query('SELECT id FROM commodities WHERE id = ?', [commodityId]);
  if (!commodities.length) throw httpError(404, 'Barang/komoditas tidak ditemukan');

  const [existing] = await pool.query(
    'SELECT id, quantity, reserved FROM retail_stocks WHERE retail_id = ? AND commodity_id = ?',
    [retailId, commodityId]
  );

  if (existing.length) {
    const row = existing[0];
    const newQty = quantity == null ? row.quantity : Number(quantity);
    const newMin = minStock == null ? null : Number(minStock);
    if (!Number.isInteger(newQty) || newQty < 0) throw httpError(400, 'quantity harus bilangan bulat >= 0');
    if (newQty < row.reserved) throw httpError(409, 'quantity tidak boleh lebih kecil dari reserved');
    if (newMin != null && (!Number.isInteger(newMin) || newMin < 0)) throw httpError(400, 'minStock harus bilangan bulat >= 0');
    await pool.query(
      'UPDATE retail_stocks SET quantity = ?, min_stock = COALESCE(?, min_stock), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newQty, newMin, row.id]
    );
    return { id: row.id, retail_id: retailId, commodity_id: commodityId, quantity: newQty };
  }

  const qty = quantity == null ? 0 : Number(quantity);
  const min = minStock == null ? 5 : Number(minStock);
  if (!Number.isInteger(qty) || qty < 0) throw httpError(400, 'quantity harus bilangan bulat >= 0');
  if (!Number.isInteger(min) || min < 0) throw httpError(400, 'minStock harus bilangan bulat >= 0');
  const id = randomUUID();
  await pool.query(
    'INSERT INTO retail_stocks (id, retail_id, commodity_id, quantity, reserved, min_stock) VALUES (?, ?, ?, ?, 0, ?)',
    [id, retailId, commodityId, qty, min]
  );
  return { id, retail_id: retailId, commodity_id: commodityId, quantity: qty, min_stock: min };
}

async function adjustStock(conn, retailId, commodityId, deltaQty) {
  const [rows] = await conn.query(
    'SELECT id, quantity, reserved, min_stock FROM retail_stocks WHERE retail_id = ? AND commodity_id = ? FOR UPDATE',
    [retailId, commodityId]
  );
  if (!rows.length) throw httpError(404, `Stok barang ${commodityId} tidak ditemukan di retail ${retailId}`);
  const stock = rows[0];
  const available = stock.quantity - stock.reserved;
  if (deltaQty < 0 && available < Math.abs(deltaQty)) {
    throw httpError(409, `Stok tidak mencukupi untuk barang ${commodityId}`);
  }
  const newQty = stock.quantity + deltaQty;
  if (newQty < 0 || newQty < stock.reserved) throw httpError(409, 'Perubahan stok tidak valid');
  await conn.query('UPDATE retail_stocks SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newQty, stock.id]);
  return { ...stock, quantity: newQty, isLow: newQty <= stock.min_stock };
}

module.exports = { listStocks, upsertStock, adjustStock, httpError };
