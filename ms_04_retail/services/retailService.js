const db = require("../config/database");
const { HttpError } = require("./errors");

async function list() {
    const { rows } = await db.query("SELECT * FROM retails ORDER BY code");
    return rows;
}

async function getById(id) {
    const { rows } = await db.query("SELECT * FROM retails WHERE id = $1", [id]);
    return rows[0] || null;
}

async function create({ code, name, address }) {
    if (!code || !name) throw new HttpError(400, "code dan name wajib diisi");
    try {
        const { rows } = await db.query(
            "INSERT INTO retails (code, name, address) VALUES ($1,$2,$3) RETURNING *",
            [code, name, address || null]
        );
        return rows[0];
    } catch (e) {
        if (e.code === "23505") throw new HttpError(409, "Kode retail sudah dipakai");
        throw e;
    }
}

async function update(id, { code, name, address, is_active }) {
    try {
        const { rows } = await db.query(
            `UPDATE retails SET
                code = COALESCE($2, code), name = COALESCE($3, name),
                address = COALESCE($4, address), is_active = COALESCE($5, is_active),
                updated_at = now()
             WHERE id = $1 RETURNING *`,
            [id, code ?? null, name ?? null, address ?? null, is_active ?? null]
        );
        return rows[0] || null;
    } catch (e) {
        if (e.code === "23505") throw new HttpError(409, "Kode retail sudah dipakai");
        throw e;
    }
}

// Nonaktifkan (soft delete) karena retail direferensikan oleh penjualan/stok.
async function deactivate(id) {
    return update(id, { is_active: false });
}

module.exports = { list, getById, create, update, deactivate };
