const express = require("express");
const router = express.Router();

const categoryController = require("../controllers/categoryController");

// Menampilkan kategori
router.get("/", categoryController.getAll);

// Menambahkan kategori
router.post("/", categoryController.create);

// Mengubah kategori
router.put("/:id", categoryController.update);

// Menghapus kategori
router.delete("/:id", categoryController.remove);

module.exports = router;