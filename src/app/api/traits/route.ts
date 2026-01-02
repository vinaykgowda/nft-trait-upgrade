import { NextRequest } from 'next/server';
import { getTraitRepository } from '@/lib/repositories';
import { createApiResponse, getRequestId, validatePagination, createPaginationMeta } from '@/lib/api/response';
import { validateSearchParams, traitFiltersSchema, paginationSchema } from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const apiResponse = createApiResponse(requestId);

  try {
    const { searchParams } = new URL(request.url);
    
    // Validate filters and pagination
    const filters = validateSearchParams(searchParams, traitFiltersSchema);
    const { page, limit, offset } = validatePagination(searchParams);

    const traitRepo = getTraitRepository();
    
    // Get total count for pagination
    const totalCount = await traitRepo.countWithFilters({
      ...filters,
      active: true, // Only count active traits for public API
      hasAvailableSupply: true, // Only count traits with available supply
    });

    // Get paginated traits
    const traits = await traitRepo.findWithRelations({
      ...filters,
      active: true,
      hasAvailableSupply: true,
      limit,
      offset,
    });
    
    const availableTraits = traits.map((trait: any) => traitRepo.toDomain(trait));
    const paginationMeta = createPaginationMeta(page, limit, totalCount);
    
    return apiResponse.successPaginated(availableTraits, paginationMeta);

  } catch (error) {
    return apiResponse.handleError(error, {
      operation: 'get_public_traits',
      type: 'external_api',
    });
  }
}