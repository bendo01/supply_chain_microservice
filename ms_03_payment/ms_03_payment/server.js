
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Payment Microservice berjalan",
        service: "ms_03_payment"
    });
});

app.use("/payments", paymentRoutes);

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
    console.log(`Payment Server berjalan di http://localhost:${PORT}`);
});
