const express = require('express');
const path = require('path');
const apiRoutes = require('./routes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'ms-04-retail', time: new Date().toISOString() });
});

app.use('/api', apiRoutes);

// Friendly root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Central error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({
    message: status >= 500 ? 'Terjadi kesalahan pada server retail' : err.message,
    ...(err.details ? { details: err.details } : {})
  });
});

const PORT = Number(process.env.PORT || 3004);
app.listen(PORT, () => {
  console.log(`✅ ms-04-retail berjalan di http://localhost:${PORT}`);
});
