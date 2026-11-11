const express = require("express");
const router = express.Router();

const controller = require("../controllers/paymentController");

router.post("/", controller.create);
router.get("/", controller.getAll);

router.post("/:id/qris", controller.createQris);
router.post("/:id/qris/simulate", controller.simulateQris);
router.post("/:id/qris/expire", controller.expireQris);

router.post("/:id/fail", controller.fail);

router.get("/:id", controller.getById);
router.post("/:id/cash", controller.payCash);

module.exports = router;