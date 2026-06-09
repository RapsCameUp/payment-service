const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { validateCard } = require('../utils/validators');

router.post('/charge', (req, res) => {
  const { amount, currency, orderId, card } = req.body;
  if (!amount || !orderId) {
    return res.status(400).json({ error: 'amount and orderId required' });
  }
  if (card && !validateCard(card)) {
    return res.status(400).json({ error: 'Invalid card details' });
  }
  logger.info(`Payment charged: $${amount} for order ${orderId}`);
  res.json({
    paymentId: `PAY-${Date.now()}`,
    status: 'success',
    amount,
    currency: currency || 'USD',
    orderId,
  });
});

router.post('/refund', (req, res) => {
  const { paymentId, amount, reason } = req.body;
  if (!paymentId) {
    return res.status(400).json({ error: 'paymentId required' });
  }
  logger.info(`Refund processed: ${paymentId}`);
  res.json({
    refundId: `REF-${Date.now()}`,
    status: 'processed',
    paymentId,
    amount: amount || 0,
    reason: reason || 'customer_request',
  });
});

router.get('/:paymentId', (req, res) => {
  res.json({
    paymentId: req.params.paymentId,
    status: 'completed',
    amount: 49.99,
    currency: 'USD',
    createdAt: new Date().toISOString(),
  });
});

module.exports = router;
