const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authenticateToken = require("./middleware/auth");
const saleRoutes = require("./routes/saleRoutes");
const retailRoutes = require("./routes/retailRoutes");
const stockRoutes = require("./routes/stockRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({ message: "Retail Microservice berjalan", service: "ms_04_retail" });
});

app.use("/sales", authenticateToken, saleRoutes);
app.use("/retails", authenticateToken, retailRoutes);
app.use("/stocks", authenticateToken, stockRoutes);

// Penanganan error terpusat (Express 5 meneruskan error async ke sini).
app.use((err, req, res, next) => {
    const status = err.status || (err.code === "22P02" ? 400 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({
        message: status === 500 ? "Terjadi kesalahan server" : err.message
    });
});

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
    console.log(`Retail Server berjalan di http://localhost:${PORT}`);
});
