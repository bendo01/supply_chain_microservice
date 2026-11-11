const jwt = require("jsonwebtoken");

// Verifikasi JWT dari Gateway; klaim: sub, role, retail_id.
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Token tidak ditemukan" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
        if (err) {
            return res.status(401).json({
                message: "Token tidak valid atau sudah kedaluwarsa",
                error: err.message
            });
        }

        req.token = token;
        req.user = {
            id: payload.sub,
            role: payload.role,
            retail_id: payload.retail_id || null
        };
        next();
    });
}

// Batasi akses berdasarkan peran.
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Peran tidak diizinkan" });
        }
        next();
    };
}

module.exports = authenticateToken;
module.exports.authorize = authorize;
