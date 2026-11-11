const categoryService = require("../services/categoryService");

// Menampilkan semua kategori
async function getAll(req, res) {
    try {
        const categories = await categoryService.getAllCategories();

        res.json({
            message: "Data kategori berhasil diambil",
            data: categories
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Gagal mengambil data kategori"
        });
    }
}

// Menambahkan kategori
async function create(req, res) {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                message: "Nama kategori wajib diisi"
            });
        }

        const data = await categoryService.createCategory(name.trim());

        res.status(201).json({
            message: "Kategori berhasil ditambahkan",
            data
        });

    } catch (error) {
        console.error(error);

        if (error.code === "23505") {
            return res.status(409).json({
                message: "Nama kategori sudah digunakan"
            });
        }

        res.status(500).json({
            message: "Gagal menambahkan kategori",
            error: error.message
        });
    }
}

// Mengubah kategori
async function update(req, res) {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                message: "Nama kategori wajib diisi"
            });
        }

        const data = await categoryService.updateCategory(
            req.params.id,
            name.trim()
        );

        if (!data) {
            return res.status(404).json({
                message: "Kategori tidak ditemukan"
            });
        }

        res.json({
            message: "Kategori berhasil diperbarui",
            data
        });

    } catch (error) {
        console.error(error);

        if (error.code === "23505") {
            return res.status(409).json({
                message: "Nama kategori sudah digunakan"
            });
        }

        res.status(500).json({
            message: "Gagal mengubah kategori",
            error: error.message
        });
    }
}

// Menghapus kategori
async function remove(req, res) {
    try {
        const data = await categoryService.deleteCategory(req.params.id);

        if (!data) {
            return res.status(404).json({
                message: "Kategori tidak ditemukan"
            });
        }

        if (data.used) {
            return res.status(409).json({
                message: "Kategori tidak dapat dihapus karena masih digunakan oleh barang"
            });
        }

        res.json({
            message: "Kategori berhasil dihapus",
            data
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Gagal menghapus kategori",
            error: error.message
        });
    }
}

module.exports = {
    getAll,
    create,
    update,
    remove
};