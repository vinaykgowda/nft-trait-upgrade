import { NextRequest } from 'next/server';
import { createApiResponse, getRequestId } from '@/lib/api/response';
import { validateSearchParams, healthCheckSchema } from '@/lib/api/validation';
import { systemHealthWorkflow } from '@/lib/api/integration';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const apiResponse = createApiResponse(requestId);

  try {
    const { searchParams } = new URL(request.url);
    const { includeDetails, services } = validateSearchParams(searchParams, healthCheckSchema);

    // Get comprehensive system health
    const healthStatus = await systemHealthWorkflow.getSystemHealth();

    // Filter services if specific ones were requested
    if (services && services.length > 0) {
      const filteredServices: any = {};
      for (const service of services) {
        if (healthStatus.services[service]) {
          filteredServices[service] = healthStatus.services[service];
        }
      }
      healthStatus.services = filteredServices;
    }

    // Remove detailed error information if not requested
    if (!includeDetails) {
      for (const service of Object.values(healthStatus.services)) {
        delete (service as any).error;
        delete (service as any).responseTime;
      }
    }

    // Set appropriate HTTP status based on system health
    const httpStatus = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    return apiResponse.success(healthStatus, httpStatus);

  } catch (error) {
    return apiResponse.handleError(error, {
      operation: 'system_health_check',
      type: 'system',
    });
  }
}