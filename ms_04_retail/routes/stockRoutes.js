const express = require("express");
const router = express.Router();
const { authorize } = require("../middleware/auth");
const c = require("../controllers/stockController");

router.get("/", authorize("CASHIER", "RETAIL_MANAGER"), c.list);
// Atur stok awal / min_stock (tambahan di luar SRS, dibutuhkan sebelum ada event distribusi).
router.put("/:commodityId", authorize("RETAIL_MANAGER"), c.upsert);

module.exports = router;
