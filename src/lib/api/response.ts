import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { errorHandler, ErrorCategory } from '@/lib/services/error-handler';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ApiResponseBuilder {
  private requestId?: string;

  constructor(requestId?: string) {
    this.requestId = requestId;
  }

  /**
   * Create a successful response
   */
  success<T>(data: T, status = 200): NextResponse {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
    };

    return NextResponse.json(response, { status });
  }

  /**
   * Create a paginated success response
   */
  successPaginated<T>(
    data: T[],
    pagination: PaginatedResponse<T>['pagination'],
    status = 200
  ): NextResponse {
    const response: PaginatedResponse<T> = {
      success: true,
      data,
      pagination,
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
    };

    return NextResponse.json(response, { status });
  }

  /**
   * Create an error response
   */
  error(message: string, status = 500, details?: any): NextResponse {
    const response: ApiResponse = {
      success: false,
      error: message,
      details,
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
    };

    return NextResponse.json(response, { status });
  }

  /**
   * Handle and categorize an error, then return appropriate response
   */
  async handleError(
    error: Error | unknown,
    context: Record<string, any> = {},
    userId?: string
  ): Promise<NextResponse> {
    // Handle Zod validation errors specially
    if (error instanceof ZodError) {
      return this.error(
        'Validation failed',
        400,
        error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        }))
      );
    }

    // Categorize the error
    const categorizedError = await errorHandler.handleError(
      error,
      context,
      this.requestId,
      userId
    );

    // Map error categories to HTTP status codes
    const statusCode = this.getStatusCodeForError(categorizedError.category, error);
    
    // Don't expose internal error details in production
    const shouldExposeDetails = process.env.NODE_ENV === 'development';
    const errorMessage = this.getSafeErrorMessage(categorizedError, error);

    return this.error(
      errorMessage,
      statusCode,
      shouldExposeDetails ? {
        category: categorizedError.category,
        severity: categorizedError.severity,
        errorId: categorizedError.id,
        context: categorizedError.context,
      } : undefined
    );
  }

  private getStatusCodeForError(category: ErrorCategory, error: Error | unknown): number {
    switch (category) {
      case ErrorCategory.VALIDATION:
        return 400;
      case ErrorCategory.AUTHENTICATION:
        return 401;
      case ErrorCategory.AUTHORIZATION:
        return 403;
      case ErrorCategory.BLOCKCHAIN_RPC:
      case ErrorCategory.EXTERNAL_API:
        return 502;
      case ErrorCategory.TRANSACTION_BUILD:
      case ErrorCategory.TRANSACTION_CONFIRM:
        return 400;
      case ErrorCategory.IRYS_UPLOAD:
        return 502;
      case ErrorCategory.DATABASE:
        return 500;
      case ErrorCategory.SYSTEM:
        return 500;
      default:
        // Check for specific error messages
        const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        if (message.includes('not found')) return 404;
        if (message.includes('conflict') || message.includes('already exists')) return 409;
        if (message.includes('insufficient') || message.includes('unavailable')) return 400;
        return 500;
    }
  }

  private getSafeErrorMessage(categorizedError: any, originalError: Error | unknown): string {
    // In production, provide user-friendly messages
    if (process.env.NODE_ENV === 'production') {
      switch (categorizedError.category) {
        case ErrorCategory.VALIDATION:
          return 'Invalid request data provided';
        case ErrorCategory.AUTHENTICATION:
          return 'Authentication required';
        case ErrorCategory.AUTHORIZATION:
          return 'Access denied';
        case ErrorCategory.BLOCKCHAIN_RPC:
          return 'Blockchain network temporarily unavailable';
        case ErrorCategory.TRANSACTION_BUILD:
          return 'Unable to build transaction';
        case ErrorCategory.TRANSACTION_CONFIRM:
          return 'Transaction confirmation failed';
        case ErrorCategory.IRYS_UPLOAD:
          return 'File upload service temporarily unavailable';
        case ErrorCategory.DATABASE:
          return 'Database service temporarily unavailable';
        case ErrorCategory.EXTERNAL_API:
          return 'External service temporarily unavailable';
        default:
          return 'An unexpected error occurred';
      }
    }

    // In development, return the actual error message
    return categorizedError.message;
  }
}

/**
 * Create an API response builder with optional request ID
 */
export function createApiResponse(requestId?: string): ApiResponseBuilder {
  return new ApiResponseBuilder(requestId);
}

/**
 * Extract request ID from headers or generate one
 */
export function getRequestId(request: Request): string {
  const existingId = request.headers.get('x-request-id');
  if (existingId) return existingId;
  
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Create pagination metadata
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}