const retailService = require("../services/retailService");

async function list(req, res) {
    res.json({ data: await retailService.list() });
}

async function getById(req, res) {
    const retail = await retailService.getById(req.params.id);
    if (!retail) return res.status(404).json({ message: "Retail tidak ditemukan" });
    res.json({ data: retail });
}

async function create(req, res) {
    res.status(201).json({ data: await retailService.create(req.body) });
}

async function update(req, res) {
    const retail = await retailService.update(req.params.id, req.body);
    if (!retail) return res.status(404).json({ message: "Retail tidak ditemukan" });
    res.json({ data: retail });
}

async function remove(req, res) {
    const retail = await retailService.deactivate(req.params.id);
    if (!retail) return res.status(404).json({ message: "Retail tidak ditemukan" });
    res.json({ message: "Retail dinonaktifkan", data: retail });
}

module.exports = { list, getById, create, update, remove };
