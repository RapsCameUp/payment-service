'use strict';

const { PaymentGateway } = require('./payment.gateway');
const { ConnectionPool } = require('./utils/connection-pool');
const logger = require('./utils/logger');

/**
 * Transaction Service
 * Manages payment transactions with connection pool monitoring.
 */
class TransactionService {
  constructor(config) {
    this.gateway = new PaymentGateway(config);
    this.timeout = 10000; // 10 second timeout (restored from 30s)
    this.pool = new ConnectionPool({
      max: 50,
      min: 5,
      acquireTimeoutMs: 5000,
    });

    // Monitor pool health
    this.poolWarningThreshold = 0.8; // Warn at 80% utilization
    this.startPoolMonitoring();
  }

  /**
   * Execute a payment transaction with timeout and pool management.
   */
  async executeTransaction(transactionData) {
    const connection = await this.pool.acquire();
    
    try {
      const result = await Promise.race([
        this.gateway.processPayment(transactionData),
        this.createTimeout(transactionData.id),
      ]);

      return {
        success: true,
        transactionId: transactionData.id,
        result,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Transaction execution failed', {
        txnId: transactionData.id,
        error: error.message,
        poolUsage: this.getPoolUsage(),
      });
      throw error;
    } finally {
      this.pool.release(connection);
    }
  }

  /**
   * Create a timeout promise for transaction deadline enforcement.
   */
  createTimeout(txnId) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Transaction ${txnId} timed out after ${this.timeout}ms`));
      }, this.timeout);
    });
  }

  /**
   * Get current connection pool utilization metrics.
   */
  getPoolUsage() {
    const total = this.pool.max;
    const used = this.pool.numUsed?.() ?? 0;
    const pending = this.pool.numPendingAcquires?.() ?? 0;
    return {
      total,
      used,
      available: total - used,
      pending,
      utilizationPct: Math.round((used / total) * 100),
    };
  }

  /**
   * Monitor pool health and emit warnings before saturation.
   */
  startPoolMonitoring() {
    this._monitorInterval = setInterval(() => {
      const usage = this.getPoolUsage();
      
      if (usage.utilizationPct >= this.poolWarningThreshold * 100) {
        logger.warn('Connection pool utilization high', {
          ...usage,
          threshold: `${this.poolWarningThreshold * 100}%`,
        });
      }

      if (usage.pending > 100) {
        logger.error('Connection pool queue depth critical', {
          pending: usage.pending,
          used: usage.used,
        });
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Graceful shutdown — release pool resources.
   */
  async shutdown() {
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
    }
    await this.pool.drain();
  }
}

module.exports = { TransactionService };
