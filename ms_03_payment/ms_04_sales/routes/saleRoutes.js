
const express = require("express");
const router = express.Router();

const saleController = require("../controllers/saleController");

// Membuat transaksi penjualan
router.post("/", saleController.create);

// Melihat transaksi berdasarkan ID
router.get("/:id", saleController.getById);

// Mengubah status transaksi menjadi PAID
router.patch("/:id/paid", saleController.markPaid);

module.exports = router;
