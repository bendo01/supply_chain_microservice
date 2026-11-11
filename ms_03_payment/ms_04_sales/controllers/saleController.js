const saleService = require("../services/saleService");

async function create(req, res) {
    try {
        const sale = await saleService.createSale(
            req.body.items,
            req.headers.authorization.slice(7)
        );

        res.status(201).json({
            message: "Transaksi penjualan berhasil dibuat",
            data: sale
        });

    } catch (error) {
        res.status(400).json({
            message: "Gagal membuat transaksi",
            error: error.message
        });
    }
}

async function getById(req, res) {
    try {
        const sale = await saleService.getSaleById(req.params.id);

        if (!sale) {
            return res.status(404).json({
                message: "Transaksi tidak ditemukan"
            });
        }

        res.json({ data: sale });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}

async function markPaid(req, res) {
    try {
        const sale = await saleService.markSalePaid(req.params.id);

        if (!sale) {
            return res.status(400).json({
                message: "Transaksi tidak ditemukan atau bukan PENDING"
            });
        }

        res.json({
            message: "Transaksi berhasil diselesaikan",
            data: sale
        });

    } catch (error) {
        console.error("ERROR CREATE SALE:", error);

        res.status(400).json({
            message: "Gagal membuat transaksi",
            error: error.message
        });
    }
}

module.exports = {
    create,
    getById,
    markPaid
};