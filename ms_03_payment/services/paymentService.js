
const db = require("../config/database");

// Membuat transaksi pembayaran
async function createPayment(data) {
    const result = await db.query(
        `INSERT INTO payments
        (sale_id, retail_id, method, amount, idempotency_key)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
            data.sale_id,
            data.retail_id,
            data.method,
            data.amount,
            data.idempotency_key
        ]
    );

    return result.rows[0];
}

// Mengambil semua transaksi
async function getAllPayments() {
    const result = await db.query(
        `SELECT *
         FROM payments
         ORDER BY created_at DESC`
    );

    return result.rows;
}

// Mengambil transaksi berdasarkan ID
async function getPaymentById(id) {
    const result = await db.query(
        "SELECT * FROM payments WHERE id = $1",
        [id]
    );

    return result.rows[0];
}

// Memproses pembayaran Cash
async function payCash(paymentId, data) {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const paymentResult = await client.query(
            `SELECT *
             FROM payments
             WHERE id = $1
             FOR UPDATE`,
            [paymentId]
        );

        const payment = paymentResult.rows[0];

        if (!payment) {
            throw new Error("Transaksi pembayaran tidak ditemukan");
        }

        if (payment.method !== "CASH") {
            throw new Error("Metode pembayaran bukan CASH");
        }

        if (payment.status !== "PENDING") {
            throw new Error("Transaksi bukan berstatus PENDING");
        }

        const received = Number(data.received_amount);
        const amount = Number(payment.amount);

        if (!Number.isFinite(received) || received < amount) {
            throw new Error("Uang yang diterima tidak mencukupi");
        }

        const change = received - amount;

        await client.query(
            `INSERT INTO cash_payments
            (payment_id, received_amount, change_amount, cashier_id)
            VALUES ($1, $2, $3, $4)`,
            [
                paymentId,
                received,
                change,
                data.cashier_id || null
            ]
        );

        const updated = await client.query(
            `UPDATE payments
             SET status = 'PAID',
                 paid_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [paymentId]
        );

        await client.query("COMMIT");

        return {
            payment: updated.rows[0],
            received_amount: received,
            change_amount: change
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function createQris(paymentId) {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `SELECT * FROM payments
             WHERE id = $1
             FOR UPDATE`,
            [paymentId]
        );

        const payment = result.rows[0];

        if (!payment) {
            throw new Error("Pembayaran tidak ditemukan");
        }

        if (payment.method !== "QRIS") {
            throw new Error("Metode pembayaran bukan QRIS");
        }

        if (payment.status !== "PENDING") {
            throw new Error("Pembayaran bukan berstatus PENDING");
        }

        const existing = await client.query(
            `SELECT * FROM qris_transactions
             WHERE payment_id = $1`,
            [paymentId]
        );

        if (existing.rows.length > 0) {
            await client.query("COMMIT");
            return existing.rows[0];
        }

        const qrPayload =
            `SIMULATED-QRIS-${payment.id}-${payment.amount}`;

        const providerRef =
            `QRIS-SIM-${Date.now()}`;

        const qrisResult = await client.query(
            `INSERT INTO qris_transactions
             (payment_id, qr_payload, provider_ref, expired_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '5 minutes')
             RETURNING *`,
            [paymentId, qrPayload, providerRef]
        );

        await client.query("COMMIT");

        return qrisResult.rows[0];

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}



// ------PAYMENTQRIS------



async function simulateQris(paymentId) {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `SELECT * FROM payments
             WHERE id = $1
             FOR UPDATE`,
            [paymentId]
        );

        const payment = result.rows[0];

        if (!payment) {
            throw new Error("Pembayaran tidak ditemukan");
        }

        if (payment.method !== "QRIS") {
            throw new Error("Metode pembayaran bukan QRIS");
        }

        if (payment.status !== "PENDING") {
            throw new Error("Pembayaran bukan berstatus PENDING");
        }

        const qrisResult = await client.query(
            `SELECT * FROM qris_transactions
             WHERE payment_id = $1
             FOR UPDATE`,
            [paymentId]
        );

        const qris = qrisResult.rows[0];

        if (!qris) {
            throw new Error("QRIS belum dibuat");
        }

        if (qris.expired_at && new Date(qris.expired_at) < new Date()) {
            await client.query(
                `UPDATE payments SET status = 'EXPIRED'
                 WHERE id = $1`,
                [paymentId]
            );

            await client.query(
                `UPDATE qris_transactions SET status = 'EXPIRED'
                 WHERE payment_id = $1`,
                [paymentId]
            );

            await client.query("COMMIT");

            return {
                message: "QRIS sudah kedaluwarsa",
                status: "EXPIRED"
            };
        }

        await client.query(
            `UPDATE qris_transactions
             SET status = 'PAID', callback_at = CURRENT_TIMESTAMP
             WHERE payment_id = $1`,
            [paymentId]
        );

        const updated = await client.query(
            `UPDATE payments
             SET status = 'PAID', paid_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [paymentId]
        );

        await client.query("COMMIT");

        return {
            message: "Simulasi pembayaran QRIS berhasil",
            payment: updated.rows[0]
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

// Membatalkan pembayaran CASH atau QRIS
async function failPayment(paymentId) {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `SELECT *
             FROM payments
             WHERE id = $1
             FOR UPDATE`,
            [paymentId]
        );

        const payment = result.rows[0];

        if (!payment) {
            throw new Error("Pembayaran tidak ditemukan.");
        }

        if (payment.status !== "PENDING") {
            throw new Error(
                `Pembayaran tidak dapat dibatalkan karena statusnya ${payment.status}.`
            );
        }

        const updated = await client.query(
            `UPDATE payments
             SET status = 'FAILED'
             WHERE id = $1
             RETURNING *`,
            [paymentId]
        );

        // Jika QRIS, tandai transaksi QRIS juga sebagai gagal.
        if (payment.method === "QRIS") {
            await client.query(
                `UPDATE qris_transactions
                 SET status = 'FAILED'
                 WHERE payment_id = $1`,
                [paymentId]
            );
        }

        await client.query("COMMIT");

        return updated.rows[0];

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}


// Memeriksa dan memperbarui status QRIS yang sudah kedaluwarsa
async function expireQris(paymentId) {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `SELECT *
             FROM payments
             WHERE id = $1
             FOR UPDATE`,
            [paymentId]
        );

        const payment = result.rows[0];

        if (!payment) {
            throw new Error("Pembayaran tidak ditemukan.");
        }

        if (payment.method !== "QRIS") {
            throw new Error("Pembayaran ini bukan QRIS.");
        }

        if (payment.status !== "PENDING") {
            await client.query("COMMIT");

            return {
                expired: payment.status === "EXPIRED",
                status: payment.status
            };
        }

        const qrisResult = await client.query(
            `SELECT *
             FROM qris_transactions
             WHERE payment_id = $1
             FOR UPDATE`,
            [paymentId]
        );

        const qris = qrisResult.rows[0];

        if (!qris) {
            throw new Error("Data QRIS tidak ditemukan.");
        }

        // Waktu diperiksa oleh PostgreSQL, bukan jam browser.
        const expiryResult = await client.query(
            `SELECT expired_at <= CURRENT_TIMESTAMP AS is_expired
             FROM qris_transactions
             WHERE payment_id = $1`,
            [paymentId]
        );

        if (!expiryResult.rows[0].is_expired) {
            await client.query("COMMIT");

            return {
                expired: false,
                status: "PENDING",
                expired_at: qris.expired_at
            };
        }

        await client.query(
            `UPDATE payments
             SET status = 'EXPIRED'
             WHERE id = $1`,
            [paymentId]
        );

        await client.query(
            `UPDATE qris_transactions
             SET status = 'EXPIRED'
             WHERE payment_id = $1`,
            [paymentId]
        );

        await client.query("COMMIT");

        return {
            expired: true,
            status: "EXPIRED",
            message: "Kode QRIS sudah kedaluwarsa."
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}


// ======================================================
// MEMBATALKAN PEMBAYARAN CASH / QRIS
// ======================================================

async function failPayment(paymentId) {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `SELECT *
             FROM payments
             WHERE id = $1
             FOR UPDATE`,
            [paymentId]
        );

        const payment = result.rows[0];

        if (!payment) {
            throw new Error("Pembayaran tidak ditemukan.");
        }

        if (payment.status !== "PENDING") {
            throw new Error(
                `Pembayaran tidak dapat dibatalkan. Status: ${payment.status}`
            );
        }

        const updated = await client.query(
            `UPDATE payments
             SET status = 'FAILED'
             WHERE id = $1
             RETURNING *`,
            [paymentId]
        );

        if (payment.method === "QRIS") {
            await client.query(
                `UPDATE qris_transactions
                 SET status = 'FAILED'
                 WHERE payment_id = $1`,
                [paymentId]
            );
        }

        await client.query("COMMIT");

        return updated.rows[0];

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}


// ======================================================
// MEMERIKSA KEDALUWARSA QRIS
// ======================================================

async function expireQris(paymentId) {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `SELECT *
             FROM payments
             WHERE id = $1
             FOR UPDATE`,
            [paymentId]
        );

        const payment = result.rows[0];

        if (!payment) {
            throw new Error("Pembayaran tidak ditemukan.");
        }

        if (payment.method !== "QRIS") {
            throw new Error("Pembayaran bukan QRIS.");
        }

        if (payment.status !== "PENDING") {
            await client.query("COMMIT");

            return {
                status: payment.status,
                expired: payment.status === "EXPIRED"
            };
        }

        const qris = await client.query(
            `SELECT *
             FROM qris_transactions
             WHERE payment_id = $1
             FOR UPDATE`,
            [paymentId]
        );

        if (!qris.rows[0]) {
            throw new Error("Data QRIS tidak ditemukan.");
        }

        const expiry = await client.query(
            `SELECT expired_at <= CURRENT_TIMESTAMP AS expired
             FROM qris_transactions
             WHERE payment_id = $1`,
            [paymentId]
        );

        if (!expiry.rows[0].expired) {
            await client.query("COMMIT");

            return {
                status: "PENDING",
                expired: false,
                expired_at: qris.rows[0].expired_at
            };
        }

        await client.query(
            `UPDATE payments
             SET status = 'EXPIRED'
             WHERE id = $1`,
            [paymentId]
        );

        await client.query(
            `UPDATE qris_transactions
             SET status = 'EXPIRED'
             WHERE payment_id = $1`,
            [paymentId]
        );

        await client.query("COMMIT");

        return {
            status: "EXPIRED",
            expired: true,
            message: "QRIS sudah kedaluwarsa."
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}


module.exports = {
    createPayment,
    getAllPayments,
    getPaymentById,
    payCash,
    createQris,
    simulateQris,
    failPayment,
    expireQris
};