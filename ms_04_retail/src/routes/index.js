const express = require('express');
const retailService = require('../services/retailService');
const saleService = require('../services/saleService');
const restockService = require('../services/restockService');
const dashboardService = require('../services/dashboardService');
const { listStocks, upsertStock } = require('../services/stockService');
const pool = require('../config/db');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Auth (demo/local) - in full microservice setup auth is handled by Gateway
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const users = {
    kasir: { username: 'kasir', role: 'CASHIER', retail_id: 'retail-01', name: 'Kasir 1' },
    manajer: { username: 'manajer', role: 'RETAIL_MANAGER', retail_id: 'retail-01', name: 'Manajer Retail' },
    owner: { username: 'owner', role: 'OWNER', retail_id: null, name: 'Owner' }
  };
  const user = users[String(username || '').toLowerCase()];
  if (!user || String(password) !== '123') {
    return res.status(401).json({ message: 'Username atau password salah' });
  }
  res.json({ message: 'Login berhasil', user, token: 'demo-token' });
});

router.get('/auth/me', (req, res) => {
  res.json({ message: 'Gunakan token/session dari Gateway pada integrasi penuh', demo_users: ['kasir/123', 'manajer/123', 'owner/123'] });
});

// Retails
router.get('/retails', asyncHandler(async (req, res) => {
  res.json({ data: await retailService.listRetails() });
}));
router.get('/retails/:id', asyncHandler(async (req, res) => {
  const data = await retailService.getRetail(req.params.id);
  if (!data) return res.status(404).json({ message: 'Retail tidak ditemukan' });
  res.json({ data });
}));
router.post('/retails', asyncHandler(async (req, res) => {
  const data = await retailService.createRetail(req.body || {});
  res.status(201).json({ message: 'Retail berhasil dibuat', data });
}));
router.put('/retails/:id', asyncHandler(async (req, res) => {
  const data = await retailService.updateRetail(req.params.id, req.body || {});
  if (!data) return res.status(404).json({ message: 'Retail tidak ditemukan' });
  res.json({ message: 'Retail berhasil diperbarui', data });
}));
router.delete('/retails/:id', asyncHandler(async (req, res) => {
  const ok = await retailService.deleteRetail(req.params.id);
  if (!ok) return res.status(404).json({ message: 'Retail tidak ditemukan' });
  res.json({ message: 'Retail dinonaktifkan' });
}));

// Commodities (master barang lokal retail service untuk demo/POS)
router.get('/commodities', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM commodities ORDER BY name');
  res.json({ data: rows });
}));

// Stocks
router.get('/stocks', asyncHandler(async (req, res) => {
  const data = await listStocks({ retailId: req.query.retail_id || req.query.retailId });
  res.json({ data });
}));
router.post('/stocks', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const data = await upsertStock({
    retailId: body.retail_id || body.retailId,
    commodityId: body.commodity_id || body.commodityId,
    quantity: body.quantity,
    minStock: body.min_stock ?? body.minStock
  });
  res.status(201).json({ message: 'Stok berhasil disimpan', data });
}));

// Sales / POS
router.post('/sales', asyncHandler(async (req, res) => {
  const result = await saleService.createSale(req.body || {});
  res.status(201).json({ message: 'Transaksi berhasil diproses', data: result.sale, warnings: result.warnings });
}));
router.get('/sales', asyncHandler(async (req, res) => {
  const data = await saleService.listSales({
    retailId: req.query.retail_id || req.query.retailId,
    status: req.query.status,
    from: req.query.from,
    to: req.query.to,
    limit: req.query.limit
  });
  res.json({ data });
}));
router.get('/sales/:id', asyncHandler(async (req, res) => {
  const data = await saleService.getSaleById(req.params.id);
  if (!data) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
  res.json({ data });
}));
router.post('/sales/:id/pay', asyncHandler(async (req, res) => {
  const data = await saleService.markSalePaid(req.params.id);
  res.json({ message: 'Pembayaran berhasil, transaksi selesai', data });
}));
router.post('/sales/:id/cancel', asyncHandler(async (req, res) => {
  const data = await saleService.cancelSale(req.params.id);
  res.json({ message: 'Transaksi dibatalkan', data });
}));
// Backward-compatible endpoint for old kasir UI
router.post('/kasir-jual', asyncHandler(async (req, res) => {
  const result = await saleService.createSale({ ...req.body, status: 'COMPLETED' });
  res.status(200).json({ message: 'Transaksi berhasil!', sale_id: result.sale.id, total: result.sale.total, warnings: result.warnings });
}));

// Restock requests
router.post('/restock-requests', asyncHandler(async (req, res) => {
  const data = await restockService.createRestockRequest(req.body || {});
  res.status(201).json({ message: 'Permintaan restock berhasil dibuat', data });
}));
router.get('/restock-requests', asyncHandler(async (req, res) => {
  const data = await restockService.listRestockRequests({
    retailId: req.query.retail_id || req.query.retailId,
    status: req.query.status
  });
  res.json({ data });
}));
router.get('/restock-requests/:id', asyncHandler(async (req, res) => {
  const data = await restockService.getRestockRequest(req.params.id);
  if (!data) return res.status(404).json({ message: 'Permintaan restock tidak ditemukan' });
  res.json({ data });
}));
router.post('/restock-requests/:id/status', asyncHandler(async (req, res) => {
  const data = await restockService.updateRestockStatus(req.params.id, req.body || {});
  res.json({ message: 'Status permintaan restock diperbarui', data });
}));
router.post('/restock-requests/:id/confirm', asyncHandler(async (req, res) => {
  const data = await restockService.updateRestockStatus(req.params.id, { status: 'RECEIVED', note: req.body?.note });
  res.json({ message: 'Penerimaan barang restock dikonfirmasi, stok bertambah', data });
}));

// Dashboard
router.get('/dashboard/overview', asyncHandler(async (req, res) => {
  const data = await dashboardService.getOverview({
    retailId: req.query.retail_id || req.query.retailId,
    from: req.query.from,
    to: req.query.to
  });
  res.json({ data });
}));
router.get('/dashboard/retails/compare', asyncHandler(async (req, res) => {
  const data = await dashboardService.getProfitByRetail({ from: req.query.from, to: req.query.to });
  res.json({ data });
}));
router.get('/dashboard/items/analysis', asyncHandler(async (req, res) => {
  const data = await dashboardService.getItemAnalysis({
    retailId: req.query.retail_id || req.query.retailId,
    from: req.query.from,
    to: req.query.to,
    limit: req.query.limit
  });
  res.json({ data });
}));

module.exports = router;
