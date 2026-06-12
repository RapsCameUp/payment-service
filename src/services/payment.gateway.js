const axios = require('axios');
const { logger } = require('../utils/logger');

/**
 * Payment gateway client.
 * BUG: Timeout set to 30s (too long) - blocks the event loop and exhausts connection pool.
 * BUG: Retry logic retries on timeout, compounding the issue.
 */
class PaymentGateway {
  constructor() {
    this.client = axios.create({
      baseURL: process.env.STRIPE_API_URL || 'https://api.stripe.com/v1',
      timeout: 30000, // BUG: 30s timeout - way too long, should be 5s max
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  /**
   * Process payment with retry logic.
   * BUG: Retries on timeout without exponential backoff - compounds load on gateway.
   */
  async chargeCustomer(customerId, amount, currency = 'usd') {
    const maxRetries = 5; // BUG: Too many retries for a timeout scenario
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.post('/charges', {
          customer: customerId,
          amount: Math.round(amount * 100),
          currency,
        });
        logger.info(`Payment successful for customer ${customerId}: ${response.data.id}`);
        return { id: response.data.id, status: response.data.status };
      } catch (error) {
        lastError = error;
        logger.warn(`Retry attempt ${attempt}/${maxRetries} for transaction txn_${customerId.slice(0, 8)}`);
        // BUG: Retries immediately on timeout without backoff
        // This creates a thundering herd when gateway is slow
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 100)); // Only 100ms delay between retries!
        }
      }
    }

    logger.error(`Payment gateway timeout after ${maxRetries * 30000}ms - circuit breaker OPEN`);
    throw new Error(`Payment failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Webhook signature verification.
   * BUG: Uses simplified verification without timestamp tolerance check.
   */
  verifyWebhookSignature(payload, signature) {
    const crypto = require('crypto');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return false;

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // BUG: Doesn't check timestamp tolerance - vulnerable to replay attacks
    const valid = signature.includes(expectedSig);
    if (!valid) {
      logger.error('Stripe webhook signature verification failed');
    }
    return valid;
  }
}

module.exports = { paymentGateway: new PaymentGateway() };
