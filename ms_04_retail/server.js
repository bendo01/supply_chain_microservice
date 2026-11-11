
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const saleRoutes = require("./routes/saleRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Sales Microservice berjalan",
        service: "ms_04_sales"
    });
});

app.use("/sales", saleRoutes);

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
    console.log(`Sales Server berjalan di http://localhost:${PORT}`);
});
