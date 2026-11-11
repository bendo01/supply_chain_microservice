const db = require("../config/database");
const stockService = require("../services/stockService");
const { HttpError } = require("../services/errors");

function retailOf(req) {
    if (!req.user.retail_id) throw new HttpError(403, "Akun tidak terikat ke retail");
    return req.user.retail_id;
}

async function list(req, res) {
    res.json({ data: await stockService.list(db, retailOf(req)) });
}

async function upsert(req, res) {
    const { quantity, min_stock } = req.body;
    for (const v of [quantity, min_stock]) {
        if (v !== undefined && (!Number.isInteger(v) || v < 0)) {
            throw new HttpError(400, "quantity/min_stock harus bilangan bulat >= 0");
        }
    }
    const stock = await stockService.upsert(db, retailOf(req), req.params.commodityId, req.body);
    res.json({ data: stock });
}

module.exports = { list, upsert };
