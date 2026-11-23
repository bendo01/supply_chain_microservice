const { randomUUID } = require('crypto');
const pool = require('../config/db');
const { httpError } = require('./stockService');

function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length) throw httpError(400, 'items restock wajib diisi');
  const map = new Map();
  for (const it of items) {
    const cid = it.commodity_id || it.commodityId;
    const qty = Number(it.quantity ?? it.qty);
    if (!cid || !Number.isInteger(qty) || qty <= 0) throw httpError(400, 'Item restock tidak valid');
    map.set(cid, (map.get(cid) || 0) + qty);
  }
  return [...map.entries()].map(([commodity_id, quantity]) => ({ commodity_id, quantity }));
}

async function createRestockRequest(payload) {
  const retailId = payload.retail_id || payload.retailId;
  const requestedBy = payload.requested_by || payload.requestedBy || 'Manager';
  const note = payload.note || null;
  if (!retailId) throw httpError(400, 'retail_id wajib diisi');
  const items = normalizeItems(payload.items);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [retails] = await conn.query('SELECT id FROM retails WHERE id = ? AND is_active = TRUE', [retailId]);
    if (!retails.length) throw httpError(404, 'Retail tidak ditemukan atau tidak aktif');

    const ids = items.map(i => i.commodity_id);
    const placeholders = ids.map(() => '?').join(',');
    const [comms] = await conn.query(`SELECT id, name FROM commodities WHERE id IN (${placeholders})`, ids);
    if (comms.length !== ids.length) throw httpError(404, 'Ada barang yang tidak ditemukan');

    const reqId = randomUUID();
    await conn.query(
      'INSERT INTO restock_requests (id, retail_id, requested_by, status, note) VALUES (?, ?, ?, ?, ?)',
      [reqId, retailId, requestedBy, 'REQUESTED', note]
    );
    for (const item of items) {
      await conn.query(
        'INSERT INTO restock_request_items (id, restock_request_id, commodity_id, quantity, received_quantity) VALUES (?, ?, ?, ?, 0)',
        [randomUUID(), reqId, item.commodity_id, item.quantity]
      );
    }
    await conn.commit();
    return getRestockRequest(reqId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function listRestockRequests({ retailId, status } = {}) {
  const where = [];
  const params = [];
  if (retailId) { where.push('rr.retail_id = ?'); params.push(retailId); }
  if (status) { where.push('rr.status = ?'); params.push(String(status).toUpperCase()); }
  const sql = `
    SELECT rr.*, r.name AS retail_name,
      (SELECT COUNT(*) FROM restock_request_items ri WHERE ri.restock_request_id = rr.id) AS item_count,
      (SELECT COALESCE(SUM(ri.quantity),0) FROM restock_request_items ri WHERE ri.restock_request_id = rr.id) AS total_quantity
    FROM restock_requests rr
    JOIN retails r ON r.id = rr.retail_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY rr.created_at DESC
  `;
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function getRestockRequest(id) {
  const [rows] = await pool.query(
    `SELECT rr.*, r.name AS retail_name, r.code AS retail_code
     FROM restock_requests rr JOIN retails r ON r.id = rr.retail_id WHERE rr.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const [items] = await pool.query(
    `SELECT ri.id, ri.commodity_id, c.sku, c.name, c.unit, ri.quantity, ri.received_quantity
     FROM restock_request_items ri JOIN commodities c ON c.id = ri.commodity_id
     WHERE ri.restock_request_id = ? ORDER BY c.name`,
    [id]
  );
  return { ...rows[0], items };
}

const allowedTransitions = {
  REQUESTED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: []
};

async function updateRestockStatus(id, { status, note }) {
  const next = String(status || '').toUpperCase();
  if (!['REQUESTED','APPROVED','SHIPPED','RECEIVED','CANCELLED'].includes(next)) {
    throw httpError(400, 'Status restock tidak valid');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM restock_requests WHERE id = ? FOR UPDATE', [id]);
    if (!rows.length) throw httpError(404, 'Permintaan restock tidak ditemukan');
    const req = rows[0];
    if (req.status === next) {
      await conn.commit();
      return getRestockRequest(id);
    }
    if (!(allowedTransitions[req.status] || []).includes(next)) {
      throw httpError(409, `Transisi status dari ${req.status} ke ${next} tidak diizinkan`);
    }

    if (next === 'RECEIVED') {
      const [items] = await conn.query(
        'SELECT commodity_id, quantity FROM restock_request_items WHERE restock_request_id = ? FOR UPDATE',
        [id]
      );
      for (const item of items) {
        const [stocks] = await conn.query(
          'SELECT id FROM retail_stocks WHERE retail_id = ? AND commodity_id = ? FOR UPDATE',
          [req.retail_id, item.commodity_id]
        );
        if (stocks.length) {
          await conn.query(
            'UPDATE retail_stocks SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [item.quantity, stocks[0].id]
          );
        } else {
          await conn.query(
            'INSERT INTO retail_stocks (id, retail_id, commodity_id, quantity, reserved, min_stock) VALUES (?, ?, ?, ?, 0, 5)',
            [randomUUID(), req.retail_id, item.commodity_id, item.quantity]
          );
        }
        await conn.query(
          'UPDATE restock_request_items SET received_quantity = quantity WHERE restock_request_id = ? AND commodity_id = ?',
          [id, item.commodity_id]
        );
      }
      await conn.query(
        'UPDATE restock_requests SET status = ?, note = COALESCE(?, note), received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [next, note || null, id]
      );
    } else {
      await conn.query(
        'UPDATE restock_requests SET status = ?, note = COALESCE(?, note), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [next, note || null, id]
      );
    }

    await conn.commit();
    return getRestockRequest(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { createRestockRequest, listRestockRequests, getRestockRequest, updateRestockStatus };
