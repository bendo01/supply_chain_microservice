
const categoryService = require("../services/categoryService");
const messages = require("../utils/messages");
const validators = require("../utils/validators");

// Menampilkan semua kategori
async function getAll(req, res) {
    try {
        const categories = await categoryService.getAllCategories();

        return res.status(200).json({
            message: "Data kategori berhasil diambil.",
            data: categories
        });

    } catch (error) {
        console.error("Gagal mengambil data kategori:", error);

        return res.status(500).json({
            message: messages.SERVER_ERROR
        });
    }
}

// Menambahkan kategori
async function create(req, res) {
    try {
        const { name } = req.body;

        const validationError =
            validators.validateCategoryName(name);

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const data = await categoryService.createCategory(
            name.trim()
        );

        return res.status(201).json({
            message: messages.CATEGORY.CREATED,
            data
        });

    } catch (error) {
        console.error("Gagal menambahkan kategori:", error);

        if (error.code === "23505" || error.code === "P2002") {
            return res.status(409).json({
                message: messages.CATEGORY.NAME_EXISTS
            });
        }

        return res.status(500).json({
            message: messages.SERVER_ERROR
        });
    }
}

// Mengubah kategori
async function update(req, res) {
    try {
        const { name } = req.body;

        // Validasi ID
        const idError = validators.validateId(req.params.id);

        if (idError) {
            return res.status(400).json({
                message: idError
            });
        }

        // Validasi nama
        const validationError =
            validators.validateCategoryName(name);

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const data = await categoryService.updateCategory(
            req.params.id,
            name.trim()
        );

        if (!data) {
            return res.status(404).json({
                message: messages.CATEGORY.NOT_FOUND
            });
        }

        return res.status(200).json({
            message: messages.CATEGORY.UPDATED,
            data
        });

    } catch (error) {
        console.error("Gagal mengubah kategori:", error);

        if (error.code === "23505" || error.code === "P2002") {
            return res.status(409).json({
                message: messages.CATEGORY.NAME_EXISTS
            });
        }

        return res.status(500).json({
            message: messages.SERVER_ERROR
        });
    }
}

// Menghapus kategori
async function remove(req, res) {
    try {
        // Validasi ID
        const idError = validators.validateId(req.params.id);

        if (idError) {
            return res.status(400).json({
                message: idError
            });
        }

        const data = await categoryService.deleteCategory(
            req.params.id
        );

        if (!data) {
            return res.status(404).json({
                message: messages.CATEGORY.NOT_FOUND
            });
        }

        if (data.used) {
            return res.status(409).json({
                message: messages.CATEGORY.IN_USE
            });
        }

        return res.status(200).json({
            message: messages.CATEGORY.DELETED,
            data
        });

    } catch (error) {
        console.error("Gagal menghapus kategori:", error);

        return res.status(500).json({
            message: messages.SERVER_ERROR
        });
    }
}

module.exports = {
    getAll,
    create,
    update,
    remove
};
