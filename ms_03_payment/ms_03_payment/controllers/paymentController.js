
const paymentService = require("../services/paymentService");

// Membuat transaksi pembayaran
async function create(req, res) {
    try {
        const { sale_id, retail_id, method, amount } = req.body;

        if (!sale_id || !retail_id || !method || amount === undefined) {
            return res.status(400).json({
                message: "sale_id, retail_id, method, dan amount wajib diisi"
            });
        }

        if (!["CASH", "QRIS"].includes(method)) {
            return res.status(400).json({
                message: "Metode pembayaran harus CASH atau QRIS"
            });
        }

        if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({
                message: "Jumlah pembayaran harus lebih besar dari 0"
            });
        }

        const data = await paymentService.createPayment({
            sale_id,
            retail_id,
            method,
            amount,
            idempotency_key: req.get("Idempotency-Key") || null
        });

        res.status(201).json({
            message: "Transaksi pembayaran berhasil dibuat",
            data
        });

    } catch (error) {
        res.status(500).json({
            message: "Gagal membuat pembayaran",
            error: error.message
        });
    }
}

// Menampilkan semua pembayaran
async function getAll(req, res) {
    try {
        const data = await paymentService.getAllPayments();

        res.json({
            message: "Data pembayaran berhasil diambil",
            data
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal mengambil pembayaran",
            error: error.message
        });
    }
}

// Menampilkan detail pembayaran
async function getById(req, res) {
    try {
        const data = await paymentService.getPaymentById(req.params.id);

        if (!data) {
            return res.status(404).json({
                message: "Pembayaran tidak ditemukan"
            });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({
            message: "Gagal mengambil detail pembayaran",
            error: error.message
        });
    }
}

// Memproses pembayaran Cash
async function payCash(req, res) {
    try {
        const { received_amount, cashier_id } = req.body;

        if (
            received_amount === undefined ||
            !Number.isFinite(Number(received_amount)) ||
            Number(received_amount) < 0
        ) {
            return res.status(400).json({
                message: "received_amount harus berupa angka yang valid"
            });
        }

        const data = await paymentService.payCash(
            req.params.id,
            { received_amount, cashier_id }
        );

        res.json({
            message: "Pembayaran Cash berhasil",
            data
        });

    } catch (error) {
        res.status(400).json({
            message: "Pembayaran Cash gagal",
            error: error.message
        });
    }
}

// -------- PAYMENT QRIS -----


const QRCode = require("qrcode");

async function createQris(req, res) {
    try {
        const qris = await paymentService.createQris(req.params.id);

        const qrImage = await QRCode.toDataURL(qris.qr_payload);

        res.json({
            message: "QRIS simulasi berhasil dibuat",
            data: qris,
            qr_image: qrImage
        });

    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
}

async function simulateQris(req, res) {
    try {
        const result = await paymentService.simulateQris(req.params.id);

        res.json(result);

    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
}

// Membatalkan pembayaran
async function fail(req, res) {
    try {
        const payment = await paymentService.failPayment(req.params.id);

        res.json({
            message: "Pembayaran berhasil ditandai gagal.",
            data: payment
        });

    } catch (error) {
        res.status(400).json({
            message: "Gagal membatalkan pembayaran.",
            error: error.message
        });
    }
}


// Memeriksa masa berlaku QRIS
async function checkQrisExpiry(req, res) {
    try {
        const result = await paymentService.expireQris(req.params.id);

        res.json(result);

    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
}
// Membatalkan pembayaran
async function fail(req, res) {
    try {
        const data = await paymentService.failPayment(req.params.id);

        res.json({
            message: "Pembayaran ditandai gagal.",
            data
        });

    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
}


// Memeriksa kedaluwarsa QRIS
async function expireQris(req, res) {
    try {
        const data = await paymentService.expireQris(req.params.id);

        res.json(data);

    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
}

module.exports = {
    create,
    getAll,
    getById,
    payCash,
    createQris,
    simulateQris,
    fail,
    expireQris
};