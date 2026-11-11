const saleService = require("../services/saleService");

async function create(req, res) {
    const sale = await saleService.createSale(req.body.items, req.user, req.token);
    res.status(201).json({ message: "Transaksi penjualan berhasil dibuat", data: sale });
}

async function list(req, res) {
    res.json({ data: await saleService.listSales(req.user, req.query) });
}

async function getById(req, res) {
    const sale = await saleService.getSaleById(req.params.id, req.user);
    if (!sale) return res.status(404).json({ message: "Transaksi tidak ditemukan" });
    res.json({ data: sale });
}

async function markPaid(req, res) {
    const sale = await saleService.markSalePaid(req.params.id, req.user);
    if (!sale) return res.status(404).json({ message: "Transaksi tidak ditemukan" });
    res.json({ message: "Transaksi berhasil diselesaikan", data: sale });
}

async function cancel(req, res) {
    const sale = await saleService.cancelSale(req.params.id, req.user);
    if (!sale) return res.status(404).json({ message: "Transaksi tidak ditemukan" });
    res.json({ message: "Transaksi dibatalkan", data: sale });
}

module.exports = { create, list, getById, markPaid, cancel };
