import { TransactionBuilder } from './transaction-builder';
import { PurchaseRepository } from '@/lib/repositories/purchases';
import { AuditLogRepository } from '@/lib/repositories/audit-logs';
import { ACTOR_TYPE } from '@/lib/constants';
import { errorHandler } from './error-handler';
import { performanceMonitor } from './performance-monitor';
import { createLogger } from './logger';

export interface TransactionMonitorConfig {
  maxRetries: number;
  retryIntervalMs: number;
  confirmationTimeoutMs: number;
}

export class TransactionMonitor {
  private transactionBuilder: TransactionBuilder;
  private purchaseRepo: PurchaseRepository;
  private auditRepo: AuditLogRepository;
  private config: TransactionMonitorConfig;
  private activeMonitors: Map<string, NodeJS.Timeout> = new Map();
  private logger = createLogger({ service: 'transaction-monitor' });

  constructor(config?: Partial<TransactionMonitorConfig>) {
    this.transactionBuilder = new TransactionBuilder();
    this.purchaseRepo = new PurchaseRepository();
    this.auditRepo = new AuditLogRepository();
    
    this.config = {
      maxRetries: 30, // 30 retries
      retryIntervalMs: 2000, // 2 seconds between retries
      confirmationTimeoutMs: 60000, // 1 minute total timeout
      ...config,
    };
  }

  /**
   * Start monitoring a transaction for confirmation
   */
  async startMonitoring(signature: string, purchaseId: string): Promise<void> {
    // Don't start monitoring if already monitoring this signature
    if (this.activeMonitors.has(signature)) {
      return;
    }

    const operationId = performanceMonitor.startOperation('transaction_monitoring', 'transaction-monitor');
    this.logger.info('Starting transaction monitoring', { signature, purchaseId });

    let retryCount = 0;
    const startTime = Date.now();

    const monitor = async (): Promise<void> => {
      try {
        // Check if we've exceeded timeout
        if (Date.now() - startTime > this.config.confirmationTimeoutMs) {
          await performanceMonitor.endOperation(operationId, false, { reason: 'timeout' });
          await this.handleTimeout(signature, purchaseId);
          return;
        }

        // Check if we've exceeded max retries
        if (retryCount >= this.config.maxRetries) {
          await performanceMonitor.endOperation(operationId, false, { reason: 'max_retries' });
          await this.handleMaxRetriesExceeded(signature, purchaseId);
          return;
        }

        // Get transaction status
        const status = await this.transactionBuilder.getTransactionStatus(signature);

        if (status.error) {
          // Transaction failed
          await performanceMonitor.endOperation(operationId, false, { reason: 'transaction_failed' });
          await this.handleTransactionFailure(signature, purchaseId, status.error);
          return;
        }

        if (status.finalized) {
          // Transaction finalized - success!
          await performanceMonitor.endOperation(operationId, true);
          await this.handleTransactionSuccess(signature, purchaseId);
          return;
        }

        if (status.confirmed) {
          // Transaction confirmed but not finalized yet
          await this.handleTransactionConfirmed(signature, purchaseId);
          // Continue monitoring for finalization
        }

        // Schedule next check
        retryCount++;
        const timeoutId = setTimeout(() => {
          monitor();
        }, this.config.retryIntervalMs);

        this.activeMonitors.set(signature, timeoutId);
      } catch (error) {
        await errorHandler.handleError(error, {
          operation: 'transaction_monitoring',
          signature,
          purchaseId,
          retryCount,
        });
        
        // Retry on error unless we've exceeded limits
        if (retryCount < this.config.maxRetries && Date.now() - startTime < this.config.confirmationTimeoutMs) {
          retryCount++;
          const timeoutId = setTimeout(() => {
            monitor();
          }, this.config.retryIntervalMs);

          this.activeMonitors.set(signature, timeoutId);
        } else {
          await performanceMonitor.endOperation(operationId, false, { reason: 'monitoring_error' });
          await this.handleMonitoringError(signature, purchaseId, error);
        }
      }
    };

    // Start monitoring
    monitor();
  }

  /**
   * Stop monitoring a transaction
   */
  stopMonitoring(signature: string): void {
    const timeoutId = this.activeMonitors.get(signature);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.activeMonitors.delete(signature);
      console.log(`Stopped monitoring transaction: ${signature}`);
    }
  }

  /**
   * Get list of currently monitored transactions
   */
  getActiveMonitors(): string[] {
    return Array.from(this.activeMonitors.keys());
  }

  /**
   * Stop all active monitors
   */
  stopAllMonitoring(): void {
    for (const signature of this.activeMonitors.keys()) {
      this.stopMonitoring(signature);
    }
  }

  private async handleTransactionSuccess(signature: string, purchaseId: string): Promise<void> {
    try {
      // Update purchase status to fulfilled
      await this.purchaseRepo.updateStatus(purchaseId, 'fulfilled');

      // Log success
      await this.auditRepo.create({
        actor_type: ACTOR_TYPE.SYSTEM,
        actor_id: 'transaction-monitor',
        action: 'transaction_finalized',
        payload_json: {
          signature,
          purchaseId,
          status: 'fulfilled',
          timestamp: new Date().toISOString(),
        },
      });

      console.log(`Transaction finalized successfully: ${signature}`);
    } catch (error) {
      console.error(`Error handling transaction success for ${signature}:`, error);
    } finally {
      this.stopMonitoring(signature);
    }
  }

  private async handleTransactionConfirmed(signature: string, purchaseId: string): Promise<void> {
    try {
      // Update purchase status to confirmed if not already
      const purchase = await this.purchaseRepo.findById(purchaseId);
      if (purchase && purchase.status === 'tx_built') {
        await this.purchaseRepo.updateStatus(purchaseId, 'confirmed');
      }

      console.log(`Transaction confirmed: ${signature}`);
    } catch (error) {
      console.error(`Error handling transaction confirmation for ${signature}:`, error);
    }
  }

  private async handleTransactionFailure(signature: string, purchaseId: string, error: string): Promise<void> {
    try {
      // Update purchase status to failed
      await this.purchaseRepo.updateStatus(purchaseId, 'failed');

      // Log failure
      await this.auditRepo.create({
        actor_type: ACTOR_TYPE.SYSTEM,
        actor_id: 'transaction-monitor',
        action: 'transaction_failed',
        payload_json: {
          signature,
          purchaseId,
          error,
          timestamp: new Date().toISOString(),
        },
      });

      console.log(`Transaction failed: ${signature}, Error: ${error}`);
    } catch (auditError) {
      console.error(`Error handling transaction failure for ${signature}:`, auditError);
    } finally {
      this.stopMonitoring(signature);
    }
  }

  private async handleTimeout(signature: string, purchaseId: string): Promise<void> {
    try {
      // Update purchase status to failed due to timeout
      await this.purchaseRepo.updateStatus(purchaseId, 'failed');

      // Log timeout
      await this.auditRepo.create({
        actor_type: ACTOR_TYPE.SYSTEM,
        actor_id: 'transaction-monitor',
        action: 'transaction_timeout',
        payload_json: {
          signature,
          purchaseId,
          timeoutMs: this.config.confirmationTimeoutMs,
          timestamp: new Date().toISOString(),
        },
      });

      console.log(`Transaction monitoring timeout: ${signature}`);
    } catch (error) {
      console.error(`Error handling transaction timeout for ${signature}:`, error);
    } finally {
      this.stopMonitoring(signature);
    }
  }

  private async handleMaxRetriesExceeded(signature: string, purchaseId: string): Promise<void> {
    try {
      // Update purchase status to failed due to max retries
      await this.purchaseRepo.updateStatus(purchaseId, 'failed');

      // Log max retries exceeded
      await this.auditRepo.create({
        actor_type: ACTOR_TYPE.SYSTEM,
        actor_id: 'transaction-monitor',
        action: 'transaction_max_retries_exceeded',
        payload_json: {
          signature,
          purchaseId,
          maxRetries: this.config.maxRetries,
          timestamp: new Date().toISOString(),
        },
      });

      console.log(`Transaction monitoring max retries exceeded: ${signature}`);
    } catch (error) {
      console.error(`Error handling max retries exceeded for ${signature}:`, error);
    } finally {
      this.stopMonitoring(signature);
    }
  }

  private async handleMonitoringError(signature: string, purchaseId: string, error: any): Promise<void> {
    try {
      // Log monitoring error
      await this.auditRepo.create({
        actor_type: ACTOR_TYPE.SYSTEM,
        actor_id: 'transaction-monitor',
        action: 'transaction_monitoring_error',
        payload_json: {
          signature,
          purchaseId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      });

      console.error(`Transaction monitoring error for ${signature}:`, error);
    } catch (auditError) {
      console.error(`Error logging monitoring error for ${signature}:`, auditError);
    } finally {
      this.stopMonitoring(signature);
    }
  }

  /**
   * Monitor multiple transactions
   */
  async startBatchMonitoring(transactions: Array<{ signature: string; purchaseId: string }>): Promise<void> {
    const promises = transactions.map(({ signature, purchaseId }) => 
      this.startMonitoring(signature, purchaseId)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    activeCount: number;
    activeSignatures: string[];
    config: TransactionMonitorConfig;
  } {
    return {
      activeCount: this.activeMonitors.size,
      activeSignatures: Array.from(this.activeMonitors.keys()),
      config: this.config,
    };
  }
}