
const priceHistoryService = require("../services/priceHistoryService");
const commodityService = require("../services/commodityService");

// Menampilkan riwayat harga barang
async function getByCommodityId(req, res) {
    try {
        const { id } = req.params;

        // Pastikan barang tersedia
        const commodity = await commodityService.getCommodityById(id);

        if (!commodity) {
            return res.status(404).json({
                message: "Barang tidak ditemukan"
            });
        }

        // Ambil riwayat harga
        const histories =
            await priceHistoryService.getPriceHistories(id);

        res.json({
            message: "Riwayat harga berhasil diambil",
            commodity: {
                id: commodity.id,
                sku: commodity.sku,
                name: commodity.name
            },
            total_history: histories.length,
            data: histories
        });

    } catch (error) {
        console.error("Gagal mengambil riwayat harga:", error);

        res.status(500).json({
            message: "Gagal mengambil riwayat harga",
            error: error.message
        });
    }
}

module.exports = {
    getByCommodityId
};
