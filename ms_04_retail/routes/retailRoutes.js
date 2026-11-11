const express = require("express");
const router = express.Router();
const { authorize } = require("../middleware/auth");
const c = require("../controllers/retailController");

router.use(authorize("OWNER"));
router.get("/", c.list);
router.get("/:id", c.getById);
router.post("/", c.create);
router.put("/:id", c.update);
router.delete("/:id", c.remove);

module.exports = router;
