
const messages = {
    SERVER_ERROR: "Terjadi kesalahan pada server. Silakan coba lagi.",
    INVALID_INPUT: "Data yang dimasukkan tidak valid.",

    COMMODITY: {
        NOT_FOUND: "Data barang tidak ditemukan.",
        CREATED: "Barang berhasil ditambahkan.",
        UPDATED: "Barang berhasil diperbarui.",
        SKU_REQUIRED: "Kode barang wajib diisi.",
        SKU_EXISTS: "Kode barang sudah digunakan.",
        NAME_REQUIRED: "Nama barang wajib diisi.",
        CATEGORY_REQUIRED: "Kategori barang wajib dipilih.",
        CATEGORY_NOT_FOUND: "Kategori yang dipilih tidak ditemukan.",
        UNIT_REQUIRED: "Satuan barang wajib diisi.",
        INVALID_PRICE: "Harga harus berupa angka yang valid.",
        NEGATIVE_PRICE: "Harga tidak boleh kurang dari nol."
    },

    CATEGORY: {
        NOT_FOUND: "Kategori tidak ditemukan.",
        CREATED: "Kategori berhasil ditambahkan.",
        UPDATED: "Kategori berhasil diperbarui.",
        DELETED: "Kategori berhasil dihapus.",
        NAME_REQUIRED: "Nama kategori wajib diisi.",
        NAME_EXISTS: "Nama kategori sudah digunakan.",
        IN_USE: "Kategori tidak dapat dihapus karena masih digunakan oleh barang."
    },

    AUTH: {
        UNAUTHORIZED: "Silakan login terlebih dahulu.",
        FORBIDDEN: "Anda tidak memiliki izin untuk melakukan tindakan ini.",
        INVALID_TOKEN: "Sesi login tidak valid atau telah berakhir."
    }
};

module.exports = messages;
