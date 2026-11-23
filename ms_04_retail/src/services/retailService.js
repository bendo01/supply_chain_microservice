const { randomUUID } = require('crypto');
const pool = require('../config/db');
const { httpError } = require('./stockService');

async function listRetails() {
  const [rows] = await pool.query('SELECT * FROM retails ORDER BY name');
  return rows;
}

async function getRetail(id) {
  const [rows] = await pool.query('SELECT * FROM retails WHERE id = ?', [id]);
  return rows[0] || null;
}

async function createRetail({ code, name, address, isActive = true }) {
  if (!code || !name) throw httpError(400, 'code dan name wajib diisi');
  const id = randomUUID();
  await pool.query(
    'INSERT INTO retails (id, code, name, address, is_active) VALUES (?, ?, ?, ?, ?)',
    [id, String(code).trim(), String(name).trim(), address || null, !!isActive]
  );
  return getRetail(id);
}

async function updateRetail(id, payload) {
  const existing = await getRetail(id);
  if (!existing) return null;
  const code = payload.code != null ? String(payload.code).trim() : existing.code;
  const name = payload.name != null ? String(payload.name).trim() : existing.name;
  const address = payload.address !== undefined ? payload.address : existing.address;
  const isActive = payload.isActive !== undefined ? !!payload.isActive : !!existing.is_active;
  if (!code || !name) throw httpError(400, 'code dan name wajib diisi');
  await pool.query(
    'UPDATE retails SET code = ?, name = ?, address = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [code, name, address, isActive, id]
  );
  return getRetail(id);
}

async function deleteRetail(id) {
  const existing = await getRetail(id);
  if (!existing) return false;
  await pool.query('UPDATE retails SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  return true;
}

module.exports = { listRetails, getRetail, createRetail, updateRetail, deleteRetail };
