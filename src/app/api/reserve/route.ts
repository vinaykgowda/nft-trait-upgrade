import { NextRequest } from 'next/server';
import { InventoryReservationRepository } from '@/lib/repositories/inventory';
import { TraitRepository } from '@/lib/repositories/traits';
import { transaction } from '@/lib/database';
import { createApiResponse, getRequestId } from '@/lib/api/response';
import { validateRequestBody, isValidUUID } from '@/lib/api/validation';
import { z } from 'zod';

const reservationRequestSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  assetId: z.string().min(32).max(44),
  traitIds: z.array(z.string().uuid()).min(1).max(10) // Support multiple traits
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const apiResponse = createApiResponse(requestId);
  let body: any = null;

  try {
    body = await request.json();
    console.log('📥 Reservation request:', body);
    
    const { walletAddress, assetId, traitIds } = validateRequestBody(body, reservationRequestSchema);

    const inventoryRepo = new InventoryReservationRepository();
    const traitRepo = new TraitRepository();

    const result = await transaction(async (client) => {
      // Check if all traits exist and are active
      const traits = await Promise.all(
        traitIds.map(traitId => traitRepo.findById(traitId, client))
      );

      const validTraits = traits.filter(trait => trait !== null);
      if (validTraits.length !== traitIds.length) {
        throw new Error('One or more traits not found');
      }

      const inactiveTraits = validTraits.filter(trait => !trait.active);
      if (inactiveTraits.length > 0) {
        throw new Error(`Inactive traits: ${inactiveTraits.map(t => t.name).join(', ')}`);
      }

      // Check for existing reservations for any of these traits
      const existingReservations = await Promise.all(
        traitIds.map(traitId => 
          inventoryRepo.findActiveReservation(traitId, walletAddress, assetId, client)
        )
      );

      const activeReservations = existingReservations.filter(res => res !== null);
      if (activeReservations.length > 0) {
        return {
          reservations: activeReservations.map(res => inventoryRepo.toDomain(res!)),
          message: 'Active reservations already exist for some traits',
        };
      }

      // Check inventory availability for all traits
      for (const trait of validTraits) {
        if (trait.total_supply !== null) {
          const activeReservationCount = await inventoryRepo.getActiveReservationCount(trait.id, client);
          const availableSupply = Math.max(0, (trait.remaining_supply || 0) - activeReservationCount);
          
          if (availableSupply < 1) {
            throw new Error(`Insufficient inventory for trait: ${trait.name}`);
          }
        }
      }

      // Create reservations for all traits
      const reservations = await Promise.all(
        traitIds.map(traitId =>
          inventoryRepo.createReservation(traitId, walletAddress, assetId, client)
        )
      );

      return {
        reservations: reservations.map(res => inventoryRepo.toDomain(res)),
        message: 'Reservations created successfully',
      };
    });

    return apiResponse.success(result);
  } catch (error) {
    return apiResponse.handleError(error, {
      operation: 'create_reservation',
      type: 'database',
      walletAddress: body?.walletAddress,
      traitIds: body?.traitIds,
    });
  }
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const apiResponse = createApiResponse(requestId);

  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    const assetId = searchParams.get('asset');
    const traitId = searchParams.get('trait');

    if (!walletAddress || !assetId || !traitId) {
      return apiResponse.error('Missing required parameters: wallet, asset, trait', 400);
    }

    if (!isValidUUID(traitId)) {
      return apiResponse.error('Invalid trait ID format', 400);
    }

    const inventoryRepo = new InventoryReservationRepository();
    const reservation = await inventoryRepo.findActiveReservation(traitId, walletAddress, assetId);

    if (!reservation) {
      return apiResponse.error('No active reservation found', 404);
    }

    return apiResponse.success({
      reservation: inventoryRepo.toDomain(reservation),
    });
  } catch (error) {
    return apiResponse.handleError(error, {
      operation: 'get_reservation',
      type: 'database',
    });
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);
  const apiResponse = createApiResponse(requestId);

  try {
    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get('id');

    if (!reservationId) {
      return apiResponse.error('Reservation ID required', 400);
    }

    if (!isValidUUID(reservationId)) {
      return apiResponse.error('Invalid reservation ID format', 400);
    }

    const inventoryRepo = new InventoryReservationRepository();
    const cancelledReservation = await inventoryRepo.cancelReservation(reservationId);

    if (!cancelledReservation) {
      return apiResponse.error('Reservation not found or already processed', 404);
    }

    return apiResponse.success({
      reservation: inventoryRepo.toDomain(cancelledReservation),
      message: 'Reservation cancelled successfully',
    });
  } catch (error) {
    return apiResponse.handleError(error, {
      operation: 'cancel_reservation',
      type: 'database',
    });
  }
}