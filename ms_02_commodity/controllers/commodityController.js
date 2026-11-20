
const commodityService = require("../services/commodityService");
const messages = require("../utils/messages");
const validators = require("../utils/validators");

// Menampilkan semua barang
async function getAll(req, res) {
    try {
        const data = await commodityService.getAllCommodities({
            q: req.query.q,
            category_id: req.query.category_id
        });

        return res.status(200).json({
            message: "Data barang berhasil diambil.",
            data
        });

    } catch (error) {
        console.error("Gagal mengambil data barang:", error);

        return res.status(500).json({
            message: messages.SERVER_ERROR
        });
    }
}

// Menampilkan barang berdasarkan ID
async function getById(req, res) {
    try {
        const idError = validators.validateId(req.params.id);

        if (idError) {
            return res.status(400).json({
                message: idError
            });
        }

        const data = await commodityService.getCommodityById(
            req.params.id
        );

        if (!data) {
            return res.status(404).json({
                message: messages.COMMODITY.NOT_FOUND
            });
        }

        return res.status(200).json({
            message: "Data barang berhasil ditemukan.",
            data
        });

    } catch (error) {
        console.error("Gagal mengambil detail barang:", error);

        return res.status(500).json({
            message: messages.SERVER_ERROR
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

        // Validasi seluruh data barang
        const validationError =
            validators.validateCommodity(req.body);

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const data = await commodityService.createCommodity({
            sku: sku.trim(),
            name: name.trim(),
            category_id,
            unit: unit.trim(),
            cost_price: Number(cost_price),
            selling_price: Number(selling_price),
            image_url: image_url?.trim() || null
        });

        return res.status(201).json({
            message: messages.COMMODITY.CREATED,
            data
        });

    } catch (error) {
        console.error("Gagal menambahkan barang:", error);

        if (error.code === "P2002" || error.code === "23505") {
            return res.status(409).json({
                message: "SKU barang sudah digunakan."
            });
        }

        if (error.code === "P2003" || error.code === "23503") {
            return res.status(400).json({
                message: "Kategori tidak ditemukan atau relasi data tidak valid."
            });
        }

        return res.status(500).json({
            message: messages.SERVER_ERROR
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

        // Validasi ID
        const idError = validators.validateId(req.params.id);

        if (idError) {
            return res.status(400).json({
                message: idError
            });
        }

        // Validasi seluruh data barang
        const validationError =
            validators.validateCommodity(req.body);

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        // Pastikan data pengguna tersedia
        if (!req.user || !req.user.id || !req.user.name) {
            return res.status(401).json({
                message: "Pengguna belum terautentikasi."
            });
        }

        const data = await commodityService.updateCommodity(
            req.params.id,
            {
                sku: sku.trim(),
                name: name.trim(),
                category_id,
                unit: unit.trim(),
                cost_price: Number(cost_price),
                selling_price: Number(selling_price),
                image_url: image_url?.trim() || null
            },
            {
                id: req.user.id,
                name: req.user.name
            }
        );

        if (!data) {
            return res.status(404).json({
                message: messages.COMMODITY.NOT_FOUND
            });
        }

        return res.status(200).json({
            message: messages.COMMODITY.UPDATED,
            data
        });

    } catch (error) {
        console.error("Gagal mengubah barang:", error);

        if (error.code === "P2002" || error.code === "23505") {
            return res.status(409).json({
                message: "SKU barang sudah digunakan."
            });
        }

        if (error.code === "P2003" || error.code === "23503") {
            return res.status(400).json({
                message: "Kategori tidak ditemukan atau relasi data tidak valid."
            });
        }

        return res.status(500).json({
            message: messages.SERVER_ERROR
        });
    }
}

// Menonaktifkan barang
async function deactivate(req, res) {
    try {
        const idError = validators.validateId(req.params.id);

        if (idError) {
            return res.status(400).json({
                message: idError
            });
        }

        const data = await commodityService.deactivateCommodity(
            req.params.id
        );

        if (!data) {
            return res.status(404).json({
                message: messages.COMMODITY.NOT_FOUND
            });
        }

        return res.status(200).json({
            message: "Barang berhasil dinonaktifkan.",
            data
        });

    } catch (error) {
        console.error("Gagal menonaktifkan barang:", error);

        return res.status(500).json({
            message: messages.SERVER_ERROR
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
