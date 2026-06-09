const express = require('express');
const paymentRoutes = require('./routes/payments');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());
app.use('/payments', paymentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment-service', uptime: process.uptime() });
});

app.listen(PORT, () => {
  logger.info(`payment-service running on port ${PORT}`);
});

module.exports = app;
