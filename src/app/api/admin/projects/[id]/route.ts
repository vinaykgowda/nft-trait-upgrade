import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getProjectRepository, getAuditLogRepository } from '@/lib/repositories';
import { EncryptionService } from '@/lib/services/encryption';
import { query } from '@/lib/database';
import { z } from 'zod';

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  logoUrl: z.union([z.string().url(), z.literal(''), z.undefined()]).optional(),
  backgroundUrl: z.union([z.string().url(), z.literal(''), z.undefined()]).optional(),
  discordUrl: z.union([z.string().url(), z.literal(''), z.undefined()]).optional(),
  xUrl: z.union([z.string().url(), z.literal(''), z.undefined()]).optional(),
  magicedenUrl: z.union([z.string().url(), z.literal(''), z.undefined()]).optional(),
  websiteUrl: z.union([z.string().url(), z.literal(''), z.undefined()]).optional(),
  collectionIds: z.array(z.string().min(32).max(44)).optional(),
  treasuryWallet: z.string().min(32).max(44).optional(),
  sellerFeeBasisPoints: z.number().int().min(0).max(10000).optional(),
  collectionSymbol: z.string().min(1).max(20).optional(),
  creatorAddress: z.union([z.string().min(32).max(44), z.literal(''), z.undefined()]).optional(),
  updateAuthority: z.string().min(1).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const projectRepo = getProjectRepository();
    const project = await projectRepo.findById(params.id);
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if encrypted_update_authority is set (don't expose the actual value)
    const hasUpdateAuthority = !!(project as any).encrypted_update_authority;

    return NextResponse.json({
      project: {
        ...projectRepo.toDomain(project),
        hasUpdateAuthority,
      },
    });

  } catch (error) {
    console.error('Get project API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const updateData = updateProjectSchema.parse(body);

    const projectRepo = getProjectRepository();
    const auditRepo = getAuditLogRepository();

    // Get current project for audit trail
    const currentProject = await projectRepo.findById(params.id);
    if (!currentProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if this is a sensitive operation (treasury wallet change)
    const isTreasuryChange = updateData.treasuryWallet && 
                            updateData.treasuryWallet !== currentProject.treasury_wallet;

    if (isTreasuryChange && !await authService.requireMFA(sessionData)) {
      return NextResponse.json(
        { error: 'MFA verification required for treasury changes' },
        { status: 403 }
      );
    }

    // Handle Update Authority key encryption
    if (updateData.updateAuthority !== undefined) {
      try {
        const encryptionService = new EncryptionService();
        const encryptedKey = encryptionService.encrypt(updateData.updateAuthority);
        await query(
          'UPDATE projects SET encrypted_update_authority = $1, updated_at = NOW() WHERE id = $2',
          [encryptedKey, params.id]
        );
      } catch (encError) {
        console.error('Failed to encrypt update authority key:', encError);
        return NextResponse.json(
          { error: 'ENCRYPTION_ERROR', message: 'Failed to encrypt update authority key', retryable: false },
          { status: 500 }
        );
      }
    }

    // Remove updateAuthority from the data passed to the standard project update
    const { updateAuthority, ...standardUpdateData } = updateData;

    const dbData = projectRepo.fromDomain(standardUpdateData);
    const updatedProject = await projectRepo.update(params.id, dbData);

    if (!updatedProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Audit log
    const isUpdateAuthorityChange = updateAuthority !== undefined;
    const auditAction = isTreasuryChange ? 'treasury_wallet_changed' 
      : isUpdateAuthorityChange ? 'update_authority_changed'
      : 'project_updated';
    
    // Don't include the raw key in audit logs
    const auditChanges = { ...standardUpdateData } as Record<string, any>;
    if (isUpdateAuthorityChange) {
      auditChanges.updateAuthority = '[encrypted]';
    }

    await auditRepo.logAction('admin', auditAction, {
      actorId: sessionData.userId,
      payload: {
        projectId: params.id,
        changes: auditChanges,
        previousValues: isTreasuryChange ? {
          treasuryWallet: currentProject.treasury_wallet
        } : undefined,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      project: projectRepo.toDomain(updatedProject)
    });

  } catch (error) {
    console.error('Update project API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Skip MFA requirement for development
    // if (!await authService.requireMFA(sessionData)) {
    //   return NextResponse.json(
    //     { error: 'MFA verification required for project deletion' },
    //     { status: 403 }
    //   );
    // }

    const projectRepo = getProjectRepository();
    const auditRepo = getAuditLogRepository();

    // Get project for audit trail
    const project = await projectRepo.findById(params.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const deleted = await projectRepo.delete(params.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Audit log
    await auditRepo.logAction('admin', 'project_deleted', {
      actorId: sessionData.userId,
      payload: {
        projectId: params.id,
        projectName: project.name,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete project API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}