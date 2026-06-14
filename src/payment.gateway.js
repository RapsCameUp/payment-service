'use strict';

const logger = require('./utils/logger');

/**
 * Payment Gateway Client
 * Handles communication with external payment provider with resilient retry logic.
 */
class PaymentGateway {
  constructor(config) {
    this.client = config.client;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.payment-provider.com/v2';
    this.maxRetries = config.maxRetries || 3;
    this.baseDelay = config.baseDelay || 1000; // 1 second base delay
  }

  /**
   * Process a payment with exponential backoff retry logic.
   * Uses jitter to prevent thundering herd problem.
   * 
   * @param {Object} transaction - The transaction to process
   * @returns {Object} Payment result from gateway
   * @throws {Error} After max retries exceeded
   */
  async processPayment(transaction) {
    const MAX_RETRIES = this.maxRetries;
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.client.charge(transaction);
        
        if (attempt > 1) {
          logger.info('Payment succeeded after retry', {
            txnId: transaction.id,
            attempt,
            totalAttempts: attempt,
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;

        // Don't retry on non-retryable errors
        if (this.isNonRetryable(error)) {
          logger.error('Payment failed with non-retryable error', {
            txnId: transaction.id,
            error: error.message,
            code: error.code,
          });
          throw error;
        }

        if (attempt < MAX_RETRIES) {
          // Exponential backoff with ±25% jitter
          const baseDelay = Math.pow(2, attempt - 1) * this.baseDelay;
          const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
          const delay = Math.max(0, baseDelay + jitter);

          logger.warn(`Payment retry attempt ${attempt}/${MAX_RETRIES}`, {
            txnId: transaction.id,
            nextRetryMs: Math.round(delay),
            error: error.message,
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    logger.error('Payment failed after all retries', {
      txnId: transaction.id,
      totalAttempts: MAX_RETRIES,
      lastError: lastError?.message,
    });

    throw new Error(
      `Payment failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
    );
  }

  /**
   * Determine if an error is non-retryable (e.g., invalid card, fraud).
   */
  isNonRetryable(error) {
    const nonRetryableCodes = [
      'CARD_DECLINED',
      'INVALID_CARD',
      'FRAUD_DETECTED',
      'INSUFFICIENT_FUNDS',
      'INVALID_AMOUNT',
    ];
    return nonRetryableCodes.includes(error.code);
  }

  /**
   * Health check for payment gateway connectivity.
   */
  async healthCheck() {
    try {
      await this.client.ping();
      return { status: 'healthy', latencyMs: 0 };
    } catch (error) {
      return { status: 'degraded', error: error.message };
    }
  }
}

module.exports = { PaymentGateway };
