import { NextRequest } from 'next/server';
import { getTraitSlotRepository } from '@/lib/repositories';
import { createApiResponse, getRequestId } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const apiResponse = createApiResponse(requestId);

  try {
    const traitSlotRepo = getTraitSlotRepository();
    const traitSlots = await traitSlotRepo.findAll();
    
    // Convert to domain objects and sort by layer order
    const domainTraitSlots = traitSlots
      .map((slot: any) => traitSlotRepo.toDomain(slot))
      .sort((a: any, b: any) => a.layerOrder - b.layerOrder);
    
    return apiResponse.success(domainTraitSlots);

  } catch (error) {
    return apiResponse.handleError(error, {
      operation: 'get_trait_slots',
      type: 'database',
    });
  }
}