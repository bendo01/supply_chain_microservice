const { randomUUID } = require('crypto');
const pool = require('../config/db');
const { httpError } = require('./stockService');

function normalizeItems(body) {
  if (Array.isArray(body.items) && body.items.length) return body.items;
  if (body.commodity_id && body.quantity != null) {
    return [{ commodity_id: body.commodity_id, quantity: body.quantity }];
  }
  return [];
}

async function createSale(payload) {
  const retailId = payload.retail_id || payload.retailId;
  const cashierName = payload.cashier_name || payload.cashierName || 'Kasir';
  const paymentMethod = String(payload.payment_method || payload.paymentMethod || 'CASH').toUpper();
  const requestedStatus = String(payload.status || 'COMPLETED').toUpperCase();
  const status = requestedStatus === 'PENDING' ? 'PENDING' : 'COMPLETED';
  const itemsIn = normalizeItems(payload);

  if (!retailId) throw httpError(400, 'retail_id wajib diisi');
  if (!itemsIn.length) throw httpError(400, 'Item penjualan tidak boleh kosong');

  const qtyMap = new Map();
  for (const item of itemsIn) {
    const cid = item.commodity_id || item.commodityId;
    const qty = Number(item.quantity ?? item.qty);
    if (!cid || !Number.isInteger(qty) || qty <= 0) {
      throw httpError(400, 'Setiap item harus memiliki commodity_id dan quantity bulat > 0');
    }
    qtyMap.set(cid, (qtyMap.get(cid) || 0) + qty);
  }
  const commodityIds = [...qtyMap.keys()];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [retails] = await conn.query('SELECT id, is_active FROM retails WHERE id = ? FOR UPDATE', [retailId]);
    if (!retails.length || !retails[0].is_active) throw httpError(404, 'Retail tidak ditemukan atau tidak aktif');

    const placeholders = commodityIds.map(() => '?').join(',');
    const [commodities] = await conn.query(
      `SELECT id, sku, name, unit, selling_price, cost_price, is_active
       FROM commodities WHERE id IN (${placeholders}) FOR UPDATE`,
      commodityIds
    );
    if (commodities.length !== commodityIds.length) throw httpError(404, 'Ada barang yang tidak ditemukan');
    const commMap = new Map(commodities.map(c => [c.id, c]));

    const [stocks] = await conn.query(
      `SELECT id, commodity_id, quantity, reserved, min_stock
       FROM retail_stocks WHERE retail_id = ? AND commodity_id IN (${placeholders}) FOR UPDATE`,
      [retailId, ...commodityIds]
    );
    const stockMap = new Map(stocks.map(s => [s.commodity_id, s]));

    const prepared = [];
    let total = 0;
    for (const [cid, qty] of qtyMap.entries()) {
      const comm = commMap.get(cid);
      if (!comm || !comm.is_active) throw httpError(400, `Barang ${cid} tidak aktif`);
      const stock = stockMap.get(cid);
      if (!stock) throw httpError(404, `Stok barang ${comm.name} belum terdaftar di retail ini`);
      const available = stock.quantity - stock.reserved;
      if (available < qty) throw httpError(409, `Stok ${comm.name} tidak mencukupi (tersedia ${available})`);
      const unitPrice = Number(comm.selling_price);
      const unitCost = Number(comm.cost_price);
      const lineTotal = unitPrice * qty;
      total += lineTotal;
      prepared.push({ cid, qty, comm, stock, unitPrice, unitCost, lineTotal });
    }

    const saleId = randomUUID();
    const completedAt = status === 'COMPLETED' ? new Date() : null;
    await conn.query(
      `INSERT INTO sales (id, retail_id, cashier_name, payment_method, status, total, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [saleId, retailId, cashierName, paymentMethod, status, total, completedAt]
    );

    for (const item of prepared) {
      const saleItemId = randomUUID();
      // Deduct immediately for COMPLETED cash sales (POS). For PENDING, reserve stock.
      if (status === 'COMPLETED') {
        await conn.query(
          'UPDATE retail_stocks SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [item.qty, item.stock.id]
        );
      } else {
        await conn.query(
          'UPDATE retail_stocks SET reserved = reserved + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [item.qty, item.stock.id]
        );
      }
      await conn.query(
        `INSERT INTO sale_items (id, sale_id, commodity_id, sku, name, quantity, unit_price, unit_cost, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [saleItemId, saleId, item.cid, item.comm.sku, item.comm.name, item.qty, item.unitPrice, item.unitCost, item.lineTotal]
      );
    }

    const warnings = [];
    if (status === 'COMPLETED') {
      for (const item of prepared) {
        const remaining = item.stock.quantity - item.qty;
        if (remaining <= item.stock.min_stock) {
          warnings.push({ commodity_id: item.cid, name: item.comm.name, quantity: remaining, min_stock: item.stock.min_stock, message: 'Stok menipis/habis, pertimbangkan restock' });
        }
      }
    }

    await conn.commit();
    const sale = await getSaleById(saleId);
    return { sale, warnings };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function listSales({ retailId, status, from, to, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (retailId) { where.push('s.retail_id = ?'); params.push(retailId); }
  if (status) { where.push('s.status = ?'); params.push(String(status).toUpperCase()); }
  if (from) { where.push('s.created_at >= ?'); params.push(from); }
  if (to) { where.push('s.created_at <= ?'); params.push(to); }
  const sql = `
    SELECT s.*, r.name AS retail_name,
      (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
    FROM sales s
    JOIN retails r ON r.id = s.retail_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY s.created_at DESC
    LIMIT ?
  `;
  params.push(Math.min(Number(limit) || 100, 500));
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function getSaleById(id) {
  const [sales] = await pool.query(
    `SELECT s.*, r.name AS retail_name, r.code AS retail_code
     FROM sales s JOIN retails r ON r.id = s.retail_id WHERE s.id = ?`,
    [id]
  );
  if (!sales.length) return null;
  const [items] = await pool.query(
    `SELECT id, commodity_id, sku, name, quantity, unit_price, unit_cost, line_total
     FROM sale_items WHERE sale_id = ? ORDER BY name`,
    [id]
  );
  return { ...sales[0], items };
}

async function markSalePaid(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [sales] = await conn.query('SELECT * FROM sales WHERE id = ? FOR UPDATE', [id]);
    if (!sales.length) throw httpError(404, 'Transaksi tidak ditemukan');
    const sale = sales[0];
    if (sale.status !== 'PENDING') throw httpError(409, `Transaksi sudah ${sale.status}`);

    const [items] = await conn.query('SELECT commodity_id, quantity FROM sale_items WHERE sale_id = ? ORDER BY commodity_id', [id]);
    for (const item of items) {
      const [stocks] = await conn.query(
        'SELECT id, quantity, reserved FROM retail_stocks WHERE retail_id = ? AND commodity_id = ? FOR UPDATE',
        [sale.retail_id, item.commodity_id]
      );
      if (!stocks.length) throw httpError(409, `Stok barang ${item.commodity_id} tidak ditemukan`);
      const st = stocks[0];
      if (st.reserved < item.quantity || st.quantity < item.quantity) throw httpError(409, 'Stok/reservasi tidak mencukupi');
      await conn.query(
        'UPDATE retail_stocks SET quantity = quantity - ?, reserved = reserved - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [item.quantity, item.quantity, st.id]
      );
    }
    await conn.query(
      "UPDATE sales SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );
    await conn.commit();
    return getSaleById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function cancelSale(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [sales] = await conn.query('SELECT * FROM sales WHERE id = ? FOR UPDATE', [id]);
    if (!sales.length) throw httpError(404, 'Transaksi tidak ditemukan');
    const sale = sales[0];
    if (sale.status === 'CANCELLED') throw httpError(409, 'Transaksi sudah dibatalkan');
    if (!['PENDING', 'COMPLETED'].includes(sale.status)) throw httpError(409, `Transaksi tidak dapat dibatalkan dari status ${sale.status}`);

    const [items] = await conn.query('SELECT commodity_id, quantity FROM sale_items WHERE sale_id = ? ORDER BY commodity_id', [id]);
    for (const item of items) {
      const [stocks] = await conn.query(
        'SELECT id FROM retail_stocks WHERE retail_id = ? AND commodity_id = ? FOR UPDATE',
        [sale.retail_id, item.commodity_id]
      );
      if (!stocks.length) throw httpError(409, `Stok barang ${item.commodity_id} tidak ditemukan`);
      if (sale.status === 'PENDING') {
        await conn.query(
          'UPDATE retail_stocks SET reserved = GREATEST(reserved - ?, 0), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [item.quantity, stocks[0].id]
        );
      } else {
        await conn.query(
          'UPDATE retail_stocks SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [item.quantity, stocks[0].id]
        );
      }
    }
    await conn.query("UPDATE sales SET status = 'CANCELLED' WHERE id = ?", [id]);
    await conn.commit();
    return getSaleById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { createSale, listSales, getSaleById, markSalePaid, cancelSale };
