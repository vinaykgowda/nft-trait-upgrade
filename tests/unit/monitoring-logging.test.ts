import { ErrorHandler, ErrorCategory, ErrorSeverity } from '@/lib/services/error-handler';
import { PerformanceMonitor } from '@/lib/services/performance-monitor';
import { Logger, LogLevel, createLogger, generateRequestId } from '@/lib/services/logger';

describe('Error Handler Unit Tests', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  test('should categorize validation errors correctly', async () => {
    const error = new Error('Invalid input data');
    error.name = 'ValidationError';
    
    const categorized = await errorHandler.handleError(error, { type: 'validation' });
    
    expect(categorized.category).toBe(ErrorCategory.VALIDATION);
    expect(categorized.severity).toBe(ErrorSeverity.LOW);
    expect(categorized.message).toBe('Invalid input data');
  });

  test('should categorize database errors correctly', async () => {
    const error = new Error('Connection timeout');
    (error as any).code = '23505';
    
    const categorized = await errorHandler.handleError(error, { type: 'database' });
    
    expect(categorized.category).toBe(ErrorCategory.DATABASE);
    expect(categorized.severity).toBe(ErrorSeverity.CRITICAL);
  });

  test('should categorize blockchain RPC errors correctly', async () => {
    const error = new Error('RPC connection failed');
    
    const categorized = await errorHandler.handleError(error, { service: 'solana' });
    
    expect(categorized.category).toBe(ErrorCategory.BLOCKCHAIN_RPC);
    expect(categorized.severity).toBe(ErrorSeverity.HIGH);
  });

  test('should store errors for admin review', async () => {
    const error = new Error('Test error');
    
    const categorized = await errorHandler.handleError(error);
    
    const recentErrors = errorHandler.getRecentErrors(10);
    expect(recentErrors).toContainEqual(categorized);
  });

  test('should generate error metrics', async () => {
    const error1 = new Error('Validation error');
    const error2 = new Error('Database error');
    
    await errorHandler.handleError(error1, { type: 'validation' });
    await errorHandler.handleError(error2, { type: 'database' });
    
    const metrics = errorHandler.getErrorMetrics();
    
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.some(m => m.category === ErrorCategory.VALIDATION)).toBe(true);
    expect(metrics.some(m => m.category === ErrorCategory.DATABASE)).toBe(true);
  });

  test('should filter errors by category', async () => {
    const validationError = new Error('Validation failed');
    const databaseError = new Error('DB connection lost');
    
    await errorHandler.handleError(validationError, { type: 'validation' });
    await errorHandler.handleError(databaseError, { type: 'database' });
    
    const validationErrors = errorHandler.getErrorsByCategory(ErrorCategory.VALIDATION);
    const databaseErrors = errorHandler.getErrorsByCategory(ErrorCategory.DATABASE);
    
    expect(validationErrors.length).toBe(1);
    expect(databaseErrors.length).toBe(1);
    expect(validationErrors[0].category).toBe(ErrorCategory.VALIDATION);
    expect(databaseErrors[0].category).toBe(ErrorCategory.DATABASE);
  });

  test('should preserve request and user context', async () => {
    const error = new Error('Test error');
    const requestId = 'req_123';
    const userId = 'user_456';
    
    const categorized = await errorHandler.handleError(error, {}, requestId, userId);
    
    expect(categorized.requestId).toBe(requestId);
    expect(categorized.userId).toBe(userId);
  });
});

describe('Performance Monitor Unit Tests', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
  });

  test('should track operation timing', async () => {
    const operationId = performanceMonitor.startOperation('test_operation', 'test_service');
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const metric = await performanceMonitor.endOperation(operationId, true);
    
    expect(metric).toBeDefined();
    expect(metric!.operation).toBe('test_operation');
    expect(metric!.service).toBe('test_service');
    expect(metric!.duration).toBeGreaterThan(0);
    expect(metric!.success).toBe(true);
  });

  test('should record metrics directly', async () => {
    const metric = await performanceMonitor.recordMetric(
      'direct_operation',
      'direct_service',
      100,
      true,
      { key: 'value' }
    );
    
    expect(metric.operation).toBe('direct_operation');
    expect(metric.service).toBe('direct_service');
    expect(metric.duration).toBe(100);
    expect(metric.success).toBe(true);
    expect(metric.metadata).toEqual({ key: 'value' });
  });

  test('should generate performance statistics', async () => {
    // Record multiple metrics for the same operation
    await performanceMonitor.recordMetric('test_op', 'test_svc', 100, true);
    await performanceMonitor.recordMetric('test_op', 'test_svc', 200, true);
    await performanceMonitor.recordMetric('test_op', 'test_svc', 150, false);
    
    const stats = performanceMonitor.getPerformanceStats('test_op', 'test_svc');
    
    expect(stats.length).toBe(1);
    expect(stats[0].operation).toBe('test_op');
    expect(stats[0].service).toBe('test_svc');
    expect(stats[0].count).toBe(3);
    expect(stats[0].averageDuration).toBe(150);
    expect(stats[0].minDuration).toBe(100);
    expect(stats[0].maxDuration).toBe(200);
    expect(stats[0].successRate).toBeCloseTo(2/3);
  });

  test('should track failed operations', async () => {
    await performanceMonitor.recordMetric('failed_op', 'test_svc', 100, false);
    
    const failedOps = performanceMonitor.getFailedOperations();
    
    expect(failedOps.length).toBe(1);
    expect(failedOps[0].operation).toBe('failed_op');
    expect(failedOps[0].success).toBe(false);
  });

  test('should identify slow operations', async () => {
    // Record a slow operation (above default threshold)
    await performanceMonitor.recordMetric('slow_op', 'test_svc', 5000, true);
    
    const slowOps = performanceMonitor.getSlowOperations();
    
    expect(slowOps.length).toBe(1);
    expect(slowOps[0].operation).toBe('slow_op');
    expect(slowOps[0].duration).toBe(5000);
  });

  test('should filter metrics by service', async () => {
    await performanceMonitor.recordMetric('op1', 'service1', 100, true);
    await performanceMonitor.recordMetric('op2', 'service2', 200, true);
    
    const service1Metrics = performanceMonitor.getServiceMetrics('service1');
    const service2Metrics = performanceMonitor.getServiceMetrics('service2');
    
    expect(service1Metrics.length).toBe(1);
    expect(service2Metrics.length).toBe(1);
    expect(service1Metrics[0].service).toBe('service1');
    expect(service2Metrics[0].service).toBe('service2');
  });

  test('should clear old metrics', async () => {
    await performanceMonitor.recordMetric('old_op', 'test_svc', 100, true);
    
    const futureDate = new Date(Date.now() + 1000);
    const cleared = performanceMonitor.clearOldMetrics(futureDate);
    
    expect(cleared).toBe(1);
    
    const recentMetrics = performanceMonitor.getRecentMetrics();
    expect(recentMetrics.length).toBe(0);
  });
});

describe('Logger Unit Tests', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
  });

  test('should create log entries with correct levels', () => {
    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warning message');
    logger.error('Error message');
    
    const logs = logger.getRecentLogs();
    
    expect(logs.length).toBe(4);
    expect(logs.some(l => l.level === LogLevel.DEBUG)).toBe(true);
    expect(logs.some(l => l.level === LogLevel.INFO)).toBe(true);
    expect(logs.some(l => l.level === LogLevel.WARN)).toBe(true);
    expect(logs.some(l => l.level === LogLevel.ERROR)).toBe(true);
  });

  test('should create child logger with context', () => {
    const requestId = 'req_123';
    const userId = 'user_456';
    const service = 'test_service';
    
    const childLogger = logger.child({ requestId, userId, service });
    childLogger.info('Test message');
    
    const logs = childLogger.getRecentLogs();
    
    expect(logs.length).toBe(1);
    expect(logs[0].requestId).toBe(requestId);
    expect(logs[0].userId).toBe(userId);
    expect(logs[0].service).toBe(service);
  });

  test('should filter logs by level', () => {
    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warning message');
    logger.error('Error message');
    
    const errorLogs = logger.getLogsByLevel(LogLevel.ERROR);
    const warnLogs = logger.getLogsByLevel(LogLevel.WARN);
    
    expect(errorLogs.length).toBe(1);
    expect(warnLogs.length).toBe(1);
    expect(errorLogs[0].level).toBe(LogLevel.ERROR);
    expect(warnLogs[0].level).toBe(LogLevel.WARN);
  });

  test('should filter logs by request ID', () => {
    const requestId = 'req_123';
    
    // Use the same logger instance to ensure logs are shared
    logger.info('Message 1', undefined, undefined);
    logger.warn('Message 2', undefined, undefined);
    logger.info('Message without request ID', undefined, undefined);
    
    // Manually set request IDs on the log entries for testing
    const logs = logger.getRecentLogs();
    if (logs.length >= 2) {
      (logs[2] as any).requestId = requestId; // Message 1
      (logs[1] as any).requestId = requestId; // Message 2
    }
    
    const requestLogs = logger.getLogsByRequestId(requestId);
    
    expect(requestLogs.length).toBe(2);
    expect(requestLogs.every(l => l.requestId === requestId)).toBe(true);
  });

  test('should filter logs by service', () => {
    const service = 'test_service';
    
    // Use the same logger instance to ensure logs are shared
    logger.info('Service message', undefined, undefined);
    logger.info('Non-service message', undefined, undefined);
    
    // Manually set service on the log entry for testing
    const logs = logger.getRecentLogs();
    if (logs.length >= 1) {
      (logs[1] as any).service = service; // Service message
    }
    
    const serviceLogs = logger.getLogsByService(service);
    
    expect(serviceLogs.length).toBe(1);
    expect(serviceLogs[0].service).toBe(service);
  });

  test('should include metadata in log entries', () => {
    const metadata = { key: 'value', number: 42 };
    
    logger.info('Test message', metadata);
    
    const logs = logger.getRecentLogs();
    
    expect(logs.length).toBe(1);
    expect(logs[0].metadata).toEqual(metadata);
  });

  test('should include error objects in error logs', () => {
    const error = new Error('Test error');
    
    logger.error('Error occurred', error);
    
    const logs = logger.getRecentLogs();
    
    expect(logs.length).toBe(1);
    expect(logs[0].error).toBe(error);
  });

  test('should clear old logs', () => {
    logger.info('Old message');
    
    const futureDate = new Date(Date.now() + 1000);
    const cleared = logger.clearOldLogs(futureDate);
    
    expect(cleared).toBe(1);
    
    const recentLogs = logger.getRecentLogs();
    expect(recentLogs.length).toBe(0);
  });
});

describe('Logger Utility Functions', () => {
  test('should generate unique request IDs', () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(id1.startsWith('req_')).toBe(true);
    expect(id2.startsWith('req_')).toBe(true);
  });

  test('should create logger with options', () => {
    const requestId = 'req_123';
    const userId = 'user_456';
    const service = 'test_service';
    
    const logger = createLogger({ requestId, userId, service });
    logger.info('Test message');
    
    const logs = logger.getRecentLogs();
    
    expect(logs.length).toBe(1);
    expect(logs[0].requestId).toBe(requestId);
    expect(logs[0].userId).toBe(userId);
    expect(logs[0].service).toBe(service);
  });
});