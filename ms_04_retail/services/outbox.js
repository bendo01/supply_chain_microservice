// Tulis event ke outbox dalam transaksi yang sama; publisher (RabbitMQ) membaca tabel ini.
async function publish(client, topic, payload) {
    await client.query(
        "INSERT INTO outbox_events (topic, payload) VALUES ($1, $2)",
        [topic, JSON.stringify(payload)]
    );
}

module.exports = { publish };
