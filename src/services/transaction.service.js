const { paymentGateway } = require('./payment.gateway');
const { logger } = require('../utils/logger');

/**
 * Transaction service - handles payment processing.
 * BUG: No circuit breaker pattern - keeps hitting failing gateway.
 * BUG: Database queries have no timeout limit.
 */
class TransactionService {
  constructor() {
    this.connectionPool = {
      max: 50,
      active: 0,
    };
  }

  async processTransaction(customerId, amount) {
    this.connectionPool.active++;

    // BUG: No check if pool is exhausted before proceeding
    if (this.connectionPool.active > this.connectionPool.max) {
      // Still proceeds even when pool is exhausted!
      logger.error(`Connection pool exhausted: max ${this.connectionPool.max} connections reached`);
    }

    try {
      // This blocks for up to 30s per attempt × 5 retries = 150s worst case
      const charge = await paymentGateway.chargeCustomer(customerId, amount);

      return {
        id: `txn_${charge.id}`,
        customerId,
        amount,
        status: 'completed',
        createdAt: new Date(),
      };
    } catch (error) {
      return {
        id: `txn_${Date.now().toString(36)}`,
        customerId,
        amount,
        status: 'failed',
        createdAt: new Date(),
      };
    } finally {
      this.connectionPool.active--;
    }
  }

  /**
   * BUG: SELECT query with no timeout - can hang indefinitely at 30s
   */
  async getTransactionHistory(customerId) {
    // Database query timeout: SELECT on transactions exceeded 30s
    logger.info(`Fetching transaction history for ${customerId}`);
    return [];
  }
}

module.exports = { transactionService: new TransactionService() };
