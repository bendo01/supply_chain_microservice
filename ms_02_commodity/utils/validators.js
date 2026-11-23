
const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Memeriksa UUID
function isValidUUID(value) {
    return typeof value === "string" && UUID_REGEX.test(value);
}

// Validasi ID
function validateId(id) {
    if (!isValidUUID(id)) {
        return "ID tidak valid. Format ID harus berupa UUID.";
    }

    return null;
}

// Validasi nama kategori
function validateCategoryName(name) {
    if (typeof name !== "string" || !name.trim()) {
        return "Nama kategori wajib diisi.";
    }

    if (name.trim().length > 100) {
        return "Nama kategori maksimal 100 karakter.";
    }

    return null;
}

// Validasi data barang
function validateCommodity(data) {
    const {
        sku,
        name,
        category_id,
        unit,
        cost_price,
        selling_price,
        image_url
    } = data;

    // SKU
    if (typeof sku !== "string" || !sku.trim()) {
        return "SKU barang wajib diisi.";
    }

    if (sku.trim().length > 50) {
        return "SKU maksimal 50 karakter.";
    }

    // Nama barang
    if (typeof name !== "string" || !name.trim()) {
        return "Nama barang wajib diisi.";
    }

    if (name.trim().length > 150) {
        return "Nama barang maksimal 150 karakter.";
    }

    // Kategori
    if (!isValidUUID(category_id)) {
        return "Kategori barang tidak valid.";
    }

    // Satuan
    if (typeof unit !== "string" || !unit.trim()) {
        return "Satuan barang wajib diisi.";
    }

    if (unit.trim().length > 50) {
        return "Satuan barang maksimal 50 karakter.";
    }

    // Harga wajib diisi
    if (
        cost_price === undefined ||
        cost_price === null ||
        String(cost_price).trim() === "" ||
        selling_price === undefined ||
        selling_price === null ||
        String(selling_price).trim() === ""
    ) {
        return "Harga pokok dan harga jual wajib diisi.";
    }

    // Harga harus berupa angka
    const costPrice = Number(cost_price);
    const sellingPrice = Number(selling_price);

    if (
        !Number.isFinite(costPrice) ||
        !Number.isFinite(sellingPrice)
    ) {
        return "Harga harus berupa angka yang valid.";
    }

    // Harga tidak boleh negatif
    if (costPrice < 0 || sellingPrice < 0) {
        return "Harga tidak boleh bernilai negatif.";
    }

    // URL gambar opsional
    if (
        image_url !== undefined &&
        image_url !== null &&
        image_url !== ""
    ) {
        if (typeof image_url !== "string") {
            return "URL gambar harus berupa teks.";
        }

        if (image_url.trim()) {
            try {
                const url = new URL(image_url);

                if (!["http:", "https:"].includes(url.protocol)) {
                    return "URL gambar harus menggunakan HTTP atau HTTPS.";
                }
            } catch {
                return "Format URL gambar tidak valid.";
            }
        }
    }

    return null;
}

module.exports = {
    isValidUUID,
    validateId,
    validateCategoryName,
    validateCommodity
};
