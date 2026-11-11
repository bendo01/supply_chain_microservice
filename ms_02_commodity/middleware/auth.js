// Pemeriksaan token dan peran pengguna.
// Token dibuat oleh ms_01_auth; di sini hanya diperiksa memakai
// JWT_SECRET yang sama.
const jwt = require("jsonwebtoken");

// Memastikan permintaan membawa token yang valid.
// Jika valid, data pengguna disimpan di req.user (id, username, name, role).
function authenticate(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: "Token tidak ditemukan. Silakan login." });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
            id: payload.sub,
            username: payload.username,
            name: payload.name,
            role: payload.role
        };
        next();
    } catch {
        return res.status(401).json({ message: "Token tidak valid atau sudah kedaluwarsa." });
    }
}

// Membatasi akses hanya untuk peran OWNER (sesuai SRS)
function requireOwner(req, res, next) {
    if (String(req.user?.role || "").toUpperCase() !== "OWNER") {
        return res.status(403).json({ message: "Hanya OWNER yang boleh melakukan ini." });
    }
    next();
}

module.exports = { authenticate, requireOwner };