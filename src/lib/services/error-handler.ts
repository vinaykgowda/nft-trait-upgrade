import { AuditLogRepository } from '@/lib/repositories/audit-logs';
import { ACTOR_TYPE } from '@/lib/constants';

export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  BLOCKCHAIN_RPC = 'blockchain_rpc',
  TRANSACTION_BUILD = 'transaction_build',
  TRANSACTION_CONFIRM = 'transaction_confirm',
  IRYS_UPLOAD = 'irys_upload',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  SYSTEM = 'system',
  UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface CategorizedError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError: Error | unknown;
  context: Record<string, any>;
  timestamp: Date;
  requestId?: string;
  userId?: string;
  stackTrace?: string;
}

export interface ErrorMetrics {
  category: ErrorCategory;
  count: number;
  lastOccurrence: Date;
  averageFrequency: number;
}

export class ErrorHandler {
  private auditRepo: AuditLogRepository;
  private errorStorage: Map<string, CategorizedError> = new Map();

  constructor() {
    this.auditRepo = new AuditLogRepository();
  }

  /**
   * Categorize and handle an error
   */
  async handleError(
    error: Error | unknown,
    context: Record<string, any> = {},
    requestId?: string,
    userId?: string
  ): Promise<CategorizedError> {
    const categorizedError = this.categorizeError(error, context, requestId, userId);
    
    // Store error for metrics and admin review
    this.errorStorage.set(categorizedError.id, categorizedError);

    // Log to audit system only in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      await this.logError(categorizedError);
    }

    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.error('Categorized Error:', {
        id: categorizedError.id,
        category: categorizedError.category,
        severity: categorizedError.severity,
        message: categorizedError.message,
        context: categorizedError.context,
      });
    }

    return categorizedError;
  }

  /**
   * Categorize an error based on its type and context
   */
  categorizeError(
    error: Error | unknown,
    context: Record<string, any> = {},
    requestId?: string,
    userId?: string
  ): CategorizedError {
    const id = this.generateErrorId();
    const timestamp = new Date();
    const originalMessage = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack : undefined;

    let category = ErrorCategory.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    let message = originalMessage; // Start with original message

    // Categorize based on error message and context
    if (this.isValidationError(error, context)) {
      category = ErrorCategory.VALIDATION;
      severity = ErrorSeverity.LOW;
    } else if (this.isAuthenticationError(error, context)) {
      category = ErrorCategory.AUTHENTICATION;
      severity = ErrorSeverity.MEDIUM;
    } else if (this.isAuthorizationError(error, context)) {
      category = ErrorCategory.AUTHORIZATION;
      severity = ErrorSeverity.HIGH;
    } else if (this.isDatabaseError(error, context)) {
      category = ErrorCategory.DATABASE;
      severity = ErrorSeverity.CRITICAL;
    } else if (this.isTransactionBuildError(error, context)) {
      category = ErrorCategory.TRANSACTION_BUILD;
      severity = ErrorSeverity.HIGH;
    } else if (this.isTransactionConfirmError(error, context)) {
      category = ErrorCategory.TRANSACTION_CONFIRM;
      severity = ErrorSeverity.CRITICAL;
    } else if (this.isIrysUploadError(error, context)) {
      category = ErrorCategory.IRYS_UPLOAD;
      severity = ErrorSeverity.HIGH;
    } else if (this.isExternalApiError(error, context)) {
      category = ErrorCategory.EXTERNAL_API;
      severity = ErrorSeverity.MEDIUM;
    } else if (this.isSystemError(error, context)) {
      category = ErrorCategory.SYSTEM;
      severity = ErrorSeverity.HIGH;
    } else if (this.isBlockchainRpcError(error, context)) {
      category = ErrorCategory.BLOCKCHAIN_RPC;
      severity = ErrorSeverity.HIGH;
    }

    return {
      id,
      category,
      severity,
      message,
      originalError: error,
      context,
      timestamp,
      requestId,
      userId,
      stackTrace,
    };
  }

  /**
   * Get error metrics for admin dashboard
   */
  getErrorMetrics(timeRange?: { start: Date; end: Date }): ErrorMetrics[] {
    const metrics = new Map<ErrorCategory, ErrorMetrics>();
    
    for (const error of this.errorStorage.values()) {
      // Filter by time range if provided
      if (timeRange && (error.timestamp < timeRange.start || error.timestamp > timeRange.end)) {
        continue;
      }

      const existing = metrics.get(error.category);
      if (existing) {
        existing.count++;
        if (error.timestamp > existing.lastOccurrence) {
          existing.lastOccurrence = error.timestamp;
        }
      } else {
        metrics.set(error.category, {
          category: error.category,
          count: 1,
          lastOccurrence: error.timestamp,
          averageFrequency: 0, // Will be calculated later
        });
      }
    }

    return Array.from(metrics.values());
  }

  /**
   * Get errors by category for admin review
   */
  getErrorsByCategory(category: ErrorCategory, limit = 50): CategorizedError[] {
    return Array.from(this.errorStorage.values())
      .filter(error => error.category === category)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get recent errors for admin dashboard
   */
  getRecentErrors(limit = 100): CategorizedError[] {
    return Array.from(this.errorStorage.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private async logError(error: CategorizedError): Promise<void> {
    try {
      await this.auditRepo.create({
        actor_type: ACTOR_TYPE.SYSTEM,
        actor_id: 'error-handler',
        action: 'error_categorized',
        payload_json: {
          errorId: error.id,
          category: error.category,
          severity: error.severity,
          message: error.message,
          context: error.context,
          requestId: error.requestId,
          userId: error.userId,
          timestamp: error.timestamp.toISOString(),
        },
      });
    } catch (auditError) {
      console.error('Failed to log error to audit system:', auditError);
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Error categorization helpers
  private isValidationError(error: Error | unknown, context: Record<string, any>): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('missing') ||
      context.type === 'validation' ||
      (error as any)?.name === 'ZodError'
    );
  }

  private isAuthenticationError(error: Error | unknown, context: Record<string, any>): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes('authentication') ||
      message.includes('unauthorized') ||
      message.includes('login') ||
      message.includes('password') ||
      context.type === 'authentication'
    );
  }

  private isAuthorizationError(error: Error | unknown, context: Record<string, any>): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes('authorization') ||
      message.includes('forbidden') ||
      message.includes('permission') ||
      message.includes('access denied') ||
      context.type === 'authorization'
    );
  }

  private isBlockchainRpcError(error: Error | unknown, context: Record<string, any>): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes('rpc') ||
      message.includes('solana') ||
      message.includes('connection') ||
      message.includes('network') ||
      context.type === 'blockchain_rpc' ||
      context.service === 'solana'
    );
  }

  private isTransactionBuildError(error: Error | unknown, context: Record<string, any>): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes('transaction build') ||
      message.includes('instruction') ||
      message.includes('account') ||
      context.type === 'transaction_build' ||
      context.operation === 'build_transaction'
    );
  }

  private isTransactionConfirmError(error: Error | unknown, context: Record<string, any>): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes('transaction confirm') ||
      message.includes('confirmation') ||
      message.includes('timeout') ||
      context.type === 'transaction_confirm' ||
      context.operation === 'confirm_transaction'
    );
  }

  private isIrysUploadError(error: Error | unknown, context: Record<string, any>): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes('irys') ||
      message.includes('upload') ||
      message.includes('storage') ||
      context.type === 'irys_upload' ||
      context.service === 'irys'
    );
  }

  private isDatabaseError(error: Error | unknown, context: Record<string, any>): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes('database') ||
      message.includes('sql') ||
      (message.includes('connection') && context.type === 'database') ||
      message.includes('query') ||
      context.type === 'database' ||
      (error as any)?.code?.startsWith?.('23') // PostgreSQL constraint violations
    );
  }

  private isExternalApiError(error: Error | unknown, context: Record<string, any>): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes('api error') ||
      message.includes('helius') ||
      message.includes('external') ||
      context.type === 'external_api' ||
      context.service === 'helius'
    );
  }

  private isSystemError(error: Error | unknown, context: Record<string, any>): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes('system') ||
      message.includes('internal') ||
      message.includes('server') ||
      context.type === 'system'
    );
  }
}

// Singleton instance
export const errorHandler = new ErrorHandler();