import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getTraitRepository, getAuditLogRepository } from '@/lib/repositories';
import { ImageStorageService } from '@/lib/services/image-storage';

export async function DELETE(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const traitRepo = getTraitRepository();
    const auditRepo = getAuditLogRepository();

    // First, get all traits to collect image URLs for deletion
    const allTraits = await traitRepo.findWithRelations();
    
    console.log(`Starting bulk deletion of ${allTraits.length} traits...`);

    let deletedImages = 0;
    const imageUrls: string[] = [];

    // Collect all image URLs
    for (const trait of allTraits) {
      if (trait.image_layer_url) {
        imageUrls.push(trait.image_layer_url);
      }
    }

    // Delete all images from storage
    console.log(`Deleting ${imageUrls.length} images from storage...`);
    for (const imageUrl of imageUrls) {
      try {
        await ImageStorageService.deleteImage(imageUrl);
        deletedImages++;
        console.log(`Deleted image: ${imageUrl}`);
      } catch (error) {
        console.error(`Failed to delete image ${imageUrl}:`, error);
        // Continue with other images even if one fails
      }
    }

    // Delete all traits from database
    console.log('Deleting all traits from database...');
    const deletedCount = await traitRepo.deleteAll();

    console.log(`Bulk deletion completed: ${deletedCount} traits, ${deletedImages} images`);

    // Audit log for bulk deletion
    await auditRepo.logAction('admin', 'traits_bulk_deleted', {
      actorId: sessionData.userId,
      payload: {
        deletedTraits: deletedCount,
        deletedImages: deletedImages,
        imageUrls: imageUrls.slice(0, 10), // Log first 10 URLs for reference
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      deletedCount,
      deletedImages,
      message: `Successfully deleted ${deletedCount} traits and ${deletedImages} images`
    });

  } catch (error) {
    console.error('Bulk delete traits API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}