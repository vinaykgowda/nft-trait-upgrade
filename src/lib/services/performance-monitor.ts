import { AuditLogRepository } from '@/lib/repositories/audit-logs';
import { ACTOR_TYPE } from '@/lib/constants';

export interface PerformanceMetric {
  id: string;
  operation: string;
  service: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  metadata?: Record<string, any>;
  requestId?: string;
}

export interface PerformanceStats {
  operation: string;
  service: string;
  count: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  p50: number;
  p95: number;
  p99: number;
}

export class PerformanceMonitor {
  private auditRepo: AuditLogRepository;
  private metrics: Map<string, PerformanceMetric> = new Map();
  private activeOperations: Map<string, { startTime: number; operation: string; service: string; requestId?: string }> = new Map();

  constructor() {
    this.auditRepo = new AuditLogRepository();
  }

  /**
   * Start timing an operation
   */
  startOperation(operation: string, service: string, requestId?: string): string {
    const operationId = this.generateOperationId();
    this.activeOperations.set(operationId, {
      startTime: Date.now(),
      operation,
      service,
      requestId,
    });
    return operationId;
  }

  /**
   * End timing an operation and record the metric
   */
  async endOperation(
    operationId: string,
    success: boolean = true,
    metadata?: Record<string, any>
  ): Promise<PerformanceMetric | null> {
    const activeOp = this.activeOperations.get(operationId);
    if (!activeOp) {
      console.warn(`No active operation found for ID: ${operationId}`);
      return null;
    }

    const duration = Date.now() - activeOp.startTime;
    const metric: PerformanceMetric = {
      id: this.generateMetricId(),
      operation: activeOp.operation,
      service: activeOp.service,
      duration,
      timestamp: new Date(),
      success,
      metadata,
      requestId: activeOp.requestId,
    };

    // Store metric
    this.metrics.set(metric.id, metric);

    // Clean up active operation
    this.activeOperations.delete(operationId);

    // Log to audit system for critical operations
    if ((this.isCriticalOperation(activeOp.operation) || !success) && process.env.NODE_ENV !== 'test') {
      await this.logPerformanceMetric(metric);
    }

    // Log slow operations
    if (duration > this.getSlowOperationThreshold(activeOp.operation)) {
      console.warn(`Slow operation detected: ${activeOp.operation} (${activeOp.service}) took ${duration}ms`);
    }

    return metric;
  }

  /**
   * Record a performance metric directly (for operations that don't use start/end pattern)
   */
  async recordMetric(
    operation: string,
    service: string,
    duration: number,
    success: boolean = true,
    metadata?: Record<string, any>,
    requestId?: string
  ): Promise<PerformanceMetric> {
    const metric: PerformanceMetric = {
      id: this.generateMetricId(),
      operation,
      service,
      duration,
      timestamp: new Date(),
      success,
      metadata,
      requestId,
    };

    this.metrics.set(metric.id, metric);

    if ((this.isCriticalOperation(operation) || !success) && process.env.NODE_ENV !== 'test') {
      await this.logPerformanceMetric(metric);
    }

    return metric;
  }

  /**
   * Get performance statistics for a specific operation and service
   */
  getPerformanceStats(
    operation?: string,
    service?: string,
    timeRange?: { start: Date; end: Date }
  ): PerformanceStats[] {
    const filteredMetrics = Array.from(this.metrics.values()).filter(metric => {
      if (operation && metric.operation !== operation) return false;
      if (service && metric.service !== service) return false;
      if (timeRange && (metric.timestamp < timeRange.start || metric.timestamp > timeRange.end)) return false;
      return true;
    });

    // Group by operation and service
    const groups = new Map<string, PerformanceMetric[]>();
    for (const metric of filteredMetrics) {
      const key = `${metric.operation}:${metric.service}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(metric);
    }

    // Calculate stats for each group
    const stats: PerformanceStats[] = [];
    for (const [key, metrics] of groups) {
      const [op, svc] = key.split(':');
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
      const successCount = metrics.filter(m => m.success).length;

      stats.push({
        operation: op,
        service: svc,
        count: metrics.length,
        averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minDuration: durations[0] || 0,
        maxDuration: durations[durations.length - 1] || 0,
        successRate: successCount / metrics.length,
        p50: this.calculatePercentile(durations, 50),
        p95: this.calculatePercentile(durations, 95),
        p99: this.calculatePercentile(durations, 99),
      });
    }

    return stats.sort((a, b) => b.count - a.count);
  }

  /**
   * Get recent performance metrics
   */
  getRecentMetrics(limit = 100): PerformanceMetric[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get metrics for a specific service
   */
  getServiceMetrics(service: string, limit = 50): PerformanceMetric[] {
    return Array.from(this.metrics.values())
      .filter(metric => metric.service === service)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get slow operations (above threshold)
   */
  getSlowOperations(limit = 50): PerformanceMetric[] {
    return Array.from(this.metrics.values())
      .filter(metric => metric.duration > this.getSlowOperationThreshold(metric.operation))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get failed operations
   */
  getFailedOperations(limit = 50): PerformanceMetric[] {
    return Array.from(this.metrics.values())
      .filter(metric => !metric.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Clear old metrics (for memory management)
   */
  clearOldMetrics(olderThan: Date): number {
    let cleared = 0;
    for (const [id, metric] of this.metrics) {
      if (metric.timestamp < olderThan) {
        this.metrics.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  private async logPerformanceMetric(metric: PerformanceMetric): Promise<void> {
    try {
      await this.auditRepo.create({
        actor_type: ACTOR_TYPE.SYSTEM,
        actor_id: 'performance-monitor',
        action: 'performance_metric_recorded',
        payload_json: {
          metricId: metric.id,
          operation: metric.operation,
          service: metric.service,
          duration: metric.duration,
          success: metric.success,
          metadata: metric.metadata,
          requestId: metric.requestId,
          timestamp: metric.timestamp.toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to log performance metric:', error);
    }
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isCriticalOperation(operation: string): boolean {
    const criticalOps = [
      'transaction_build',
      'transaction_confirm',
      'core_asset_update',
      'irys_upload',
      'payment_processing',
    ];
    return criticalOps.includes(operation);
  }

  private getSlowOperationThreshold(operation: string): number {
    const thresholds: Record<string, number> = {
      'solana_rpc_call': 5000, // 5 seconds
      'transaction_build': 3000, // 3 seconds
      'transaction_confirm': 30000, // 30 seconds
      'irys_upload': 10000, // 10 seconds
      'image_composition': 5000, // 5 seconds
      'database_query': 1000, // 1 second
      'helius_api_call': 3000, // 3 seconds
    };
    return thresholds[operation] || 2000; // Default 2 seconds
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();