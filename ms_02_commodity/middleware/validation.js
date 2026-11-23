
const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ==========================================
// VALIDASI UUID
// ==========================================
function validateUUIDParam(req, res, next) {
    const { id } = req.params;

    if (!id || !UUID_REGEX.test(id)) {
        return res.status(400).json({
            message: "ID harus berupa UUID yang valid"
        });
    }

    next();
}

// ==========================================
// VALIDASI QUERY BARANG
// ==========================================
function validateCommodityQuery(req, res, next) {
    const { q, category_id } = req.query;

    if (q !== undefined) {
        if (
            typeof q !== "string" ||
            q.trim().length === 0 ||
            q.length > 100
        ) {
            return res.status(400).json({
                message: "Parameter pencarian tidak valid (maksimal 100 karakter)"
            });
        }

        req.query.q = q.trim();
    }

    if (
        category_id !== undefined &&
        !UUID_REGEX.test(category_id)
    ) {
        return res.status(400).json({
            message: "Category ID harus berupa UUID yang valid"
        });
    }

    next();
}

// ==========================================
// VALIDASI INPUT BARANG
// ==========================================
function validateCommodityBody(req, res, next) {
    const {
        sku,
        name,
        category_id,
        unit,
        cost_price,
        selling_price,
        image_url
    } = req.body || {};

    // Periksa data wajib
    if (
        typeof sku !== "string" ||
        typeof name !== "string" ||
        typeof unit !== "string" ||
        !sku.trim() ||
        !name.trim() ||
        !unit.trim() ||
        !category_id ||
        cost_price === undefined ||
        selling_price === undefined
    ) {
        return res.status(400).json({
            message: "Semua data barang wajib diisi"
        });
    }

    // Periksa panjang input
    if (
        sku.length > 100 ||
        name.length > 255 ||
        unit.length > 50
    ) {
        return res.status(400).json({
            message: "Panjang SKU, nama, atau satuan melebihi batas"
        });
    }

    // Periksa UUID kategori
    if (
        typeof category_id !== "string" ||
        !UUID_REGEX.test(category_id)
    ) {
        return res.status(400).json({
            message: "Category ID tidak valid"
        });
    }

    // Periksa harga
    const cost = Number(cost_price);
    const selling = Number(selling_price);

    if (
        typeof cost_price === "boolean" ||
        typeof selling_price === "boolean" ||
        (typeof cost_price === "string" && !cost_price.trim()) ||
        (typeof selling_price === "string" && !selling_price.trim()) ||
        !Number.isFinite(cost) ||
        !Number.isFinite(selling) ||
        cost < 0 ||
        selling < 0
    ) {
        return res.status(400).json({
            message: "Harga harus berupa angka yang valid dan tidak boleh negatif"
        });
    }

    // Periksa URL gambar jika diisi
    if (image_url !== undefined && image_url !== null && image_url !== "") {
        if (typeof image_url !== "string" || image_url.length > 2048) {
            return res.status(400).json({
                message: "URL gambar tidak valid"
            });
        }

        try {
            const url = new URL(image_url);

            if (!["http:", "https:"].includes(url.protocol)) {
                throw new Error("Protokol URL tidak diizinkan");
            }
        } catch {
            return res.status(400).json({
                message: "Format URL gambar tidak valid"
            });
        }
    }

    next();
}

// ==========================================
// VALIDASI INPUT KATEGORI
// ==========================================
function validateCategoryBody(req, res, next) {
    const { name } = req.body || {};

    if (
        typeof name !== "string" ||
        !name.trim()
    ) {
        return res.status(400).json({
            message: "Nama kategori wajib diisi"
        });
    }

    if (name.trim().length > 100) {
        return res.status(400).json({
            message: "Nama kategori maksimal 100 karakter"
        });
    }

    req.body.name = name.trim();

    next();
}

module.exports = {
    validateUUIDParam,
    validateCommodityQuery,
    validateCommodityBody,
    validateCategoryBody
};
