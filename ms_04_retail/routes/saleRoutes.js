const express = require("express");
const router = express.Router();
const { authorize } = require("../middleware/auth");
const saleController = require("../controllers/saleController");

router.post("/", authorize("CASHIER"), saleController.create);
router.get("/", authorize("CASHIER", "RETAIL_MANAGER", "OWNER"), saleController.list);
router.get("/:id", authorize("CASHIER", "RETAIL_MANAGER", "OWNER"), saleController.getById);
router.post("/:id/cancel", authorize("CASHIER"), saleController.cancel);
// Dipakai sampai consumer event payment.paid tersedia.
router.patch("/:id/paid", authorize("CASHIER"), saleController.markPaid);

module.exports = router;
