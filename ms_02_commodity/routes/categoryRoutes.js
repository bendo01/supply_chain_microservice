
const express = require("express");
const router = express.Router();

const categoryController = require("../controllers/categoryController");

const {
    validateUUIDParam,
    validateCategoryBody
} = require("../middleware/validation");

// Menampilkan semua kategori
router.get("/", categoryController.getAll);

// Menambahkan kategori
router.post(
    "/",
    validateCategoryBody,
    categoryController.create
);

// Mengubah kategori
router.put(
    "/:id",
    validateUUIDParam,
    validateCategoryBody,
    categoryController.update
);

// Menghapus kategori
router.delete(
    "/:id",
    validateUUIDParam,
    categoryController.remove
);

module.exports = router;
