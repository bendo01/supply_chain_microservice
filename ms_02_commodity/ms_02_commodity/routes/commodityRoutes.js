const express = require("express");
const router = express.Router();

const controller = require("../controllers/commodityController");

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", controller.create);

// Mengubah barang
router.put("/:id", controller.update);

// Menonaktifkan barang
router.delete("/:id", controller.deactivate);

module.exports = router;