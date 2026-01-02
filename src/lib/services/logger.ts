import { AuditLogRepository } from '@/lib/repositories/audit-logs';
import { ACTOR_TYPE } from '@/lib/constants';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
  requestId?: string;
  userId?: string;
  service?: string;
  operation?: string;
  metadata?: Record<string, any>;
  error?: Error;
}

export class Logger {
  private auditRepo: AuditLogRepository;
  private logs: Map<string, LogEntry> = new Map();
  private requestId?: string;
  private userId?: string;
  private service?: string;

  constructor(options?: { requestId?: string; userId?: string; service?: string }) {
    this.auditRepo = new AuditLogRepository();
    this.requestId = options?.requestId;
    this.userId = options?.userId;
    this.service = options?.service;
  }

  /**
   * Create a child logger with additional context
   */
  child(options: { requestId?: string; userId?: string; service?: string; operation?: string }): Logger {
    const childLogger = new Logger({
      requestId: options.requestId || this.requestId,
      userId: options.userId || this.userId,
      service: options.service || this.service,
    });
    return childLogger;
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, any>, operation?: string): void {
    this.log(LogLevel.DEBUG, message, metadata, operation);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, any>, operation?: string): void {
    this.log(LogLevel.INFO, message, metadata, operation);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, any>, operation?: string): void {
    this.log(LogLevel.WARN, message, metadata, operation);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: Record<string, any>, operation?: string): void {
    this.log(LogLevel.ERROR, message, metadata, operation, error);
  }

  /**
   * Log a structured entry
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    operation?: string,
    error?: Error
  ): void {
    const entry: LogEntry = {
      id: this.generateLogId(),
      level,
      message,
      timestamp: new Date(),
      requestId: this.requestId,
      userId: this.userId,
      service: this.service,
      operation,
      metadata,
      error,
    };

    // Store log entry
    this.logs.set(entry.id, entry);

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      this.consoleLog(entry);
    }

    // Log to audit system for important entries
    if (this.shouldAuditLog(level)) {
      this.auditLog(entry).catch(auditError => {
        console.error('Failed to audit log entry:', auditError);
      });
    }
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(limit = 100): LogEntry[] {
    return Array.from(this.logs.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel, limit = 50): LogEntry[] {
    return Array.from(this.logs.values())
      .filter(log => log.level === level)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get logs for a specific request
   */
  getLogsByRequestId(requestId: string): LogEntry[] {
    return Array.from(this.logs.values())
      .filter(log => log.requestId === requestId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get logs for a specific service
   */
  getLogsByService(service: string, limit = 50): LogEntry[] {
    return Array.from(this.logs.values())
      .filter(log => log.service === service)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Clear old logs (for memory management)
   */
  clearOldLogs(olderThan: Date): number {
    let cleared = 0;
    for (const [id, log] of this.logs) {
      if (log.timestamp < olderThan) {
        this.logs.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  private consoleLog(entry: LogEntry): void {
    const logData = {
      level: entry.level,
      message: entry.message,
      timestamp: entry.timestamp.toISOString(),
      requestId: entry.requestId,
      userId: entry.userId,
      service: entry.service,
      operation: entry.operation,
      metadata: entry.metadata,
    };

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug('[DEBUG]', logData);
        break;
      case LogLevel.INFO:
        console.info('[INFO]', logData);
        break;
      case LogLevel.WARN:
        console.warn('[WARN]', logData);
        break;
      case LogLevel.ERROR:
        console.error('[ERROR]', logData, entry.error);
        break;
    }
  }

  private async auditLog(entry: LogEntry): Promise<void> {
    try {
      await this.auditRepo.create({
        actor_type: ACTOR_TYPE.SYSTEM,
        actor_id: 'logger',
        action: 'log_entry_created',
        payload_json: {
          logId: entry.id,
          level: entry.level,
          message: entry.message,
          requestId: entry.requestId,
          userId: entry.userId,
          service: entry.service,
          operation: entry.operation,
          metadata: entry.metadata,
          error: entry.error ? {
            name: entry.error.name,
            message: entry.error.message,
            stack: entry.error.stack,
          } : undefined,
          timestamp: entry.timestamp.toISOString(),
        },
      });
    } catch (error) {
      // Don't throw here to avoid infinite loops
      console.error('Failed to audit log entry:', error);
    }
  }

  /**
   * Log to audit system for important entries
   */
  private shouldAuditLog(level: LogLevel): boolean {
    return (level === LogLevel.ERROR || level === LogLevel.WARN) && process.env.NODE_ENV !== 'test';
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a logger instance
 */
export function createLogger(options?: { requestId?: string; userId?: string; service?: string }): Logger {
  return new Logger(options);
}

// Default logger instance
export const logger = new Logger();