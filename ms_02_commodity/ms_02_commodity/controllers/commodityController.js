const commodityService = require("../services/commodityService");

// Menampilkan semua barang
async function getAll(req, res) {
    try {
        const data = await commodityService.getAllCommodities({
            q: req.query.q,
            category_id: req.query.category_id
        });

        res.json({
            message: "Data barang berhasil diambil",
            data
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal mengambil data barang",
            error: error.message
        });
    }
}

// Menampilkan barang berdasarkan ID
async function getById(req, res) {
    try {
        const data = await commodityService.getCommodityById(req.params.id);

        if (!data) {
            return res.status(404).json({
                message: "Barang tidak ditemukan"
            });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({
            message: "Gagal mengambil barang",
            error: error.message
        });
    }
}

// Menambahkan barang
async function create(req, res) {
    try {
        const {
            sku,
            name,
            category_id,
            unit,
            cost_price,
            selling_price,
            image_url
        } = req.body;

        if (
            !sku || !name || !category_id || !unit ||
            cost_price === undefined || selling_price === undefined
        ) {
            return res.status(400).json({
                message: "Semua data barang wajib diisi"
            });
        }

        if (
            Number(cost_price) < 0 ||
            Number(selling_price) < 0 ||
            !Number.isFinite(Number(cost_price)) ||
            !Number.isFinite(Number(selling_price))
        ) {
            return res.status(400).json({
                message: "Harga harus berupa angka dan tidak boleh negatif"
            });
        }

        const data = await commodityService.createCommodity({
            sku,
            name,
            category_id,
            unit,
            cost_price,
            selling_price,
            image_url
        });

        res.status(201).json({
            message: "Barang berhasil ditambahkan",
            data
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal menambahkan barang",
            error: error.message
        });
    }
}

// Mengubah data barang
async function update(req, res) {
    try {
        const {
            sku,
            name,
            category_id,
            unit,
            cost_price,
            selling_price,
            image_url
        } = req.body;

        if (
            !sku || !name || !category_id || !unit ||
            cost_price === undefined || selling_price === undefined
        ) {
            return res.status(400).json({
                message: "Semua data barang wajib diisi"
            });
        }

        if (
            !Number.isFinite(Number(cost_price)) ||
            !Number.isFinite(Number(selling_price)) ||
            Number(cost_price) < 0 ||
            Number(selling_price) < 0
        ) {
            return res.status(400).json({
                message: "Harga harus berupa angka dan tidak boleh negatif"
            });
        }

        const data = await commodityService.updateCommodity(
            req.params.id,
            {
                sku,
                name,
                category_id,
                unit,
                cost_price,
                selling_price,
                image_url
            }
        );

        if (!data) {
            return res.status(404).json({
                message: "Barang tidak ditemukan atau sudah nonaktif"
            });
        }

        res.json({
            message: "Barang berhasil diperbarui",
            data
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal memperbarui barang",
            error: error.message
        });
    }
}

// Menonaktifkan barang
async function deactivate(req, res) {
    try {
        const data = await commodityService.deactivateCommodity(
            req.params.id
        );

        if (!data) {
            return res.status(404).json({
                message: "Barang tidak ditemukan atau sudah nonaktif"
            });
        }

        res.json({
            message: "Barang berhasil dinonaktifkan",
            data
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal menonaktifkan barang",
            error: error.message
        });
    }
}

module.exports = {
    getAll,
    getById,
    create,
    update,
    deactivate
};