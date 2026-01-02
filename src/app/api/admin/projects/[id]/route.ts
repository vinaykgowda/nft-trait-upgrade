import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getProjectRepository, getAuditLogRepository } from '@/lib/repositories';
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

    return NextResponse.json({
      project: projectRepo.toDomain(project)
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

    const dbData = projectRepo.fromDomain(updateData);
    const updatedProject = await projectRepo.update(params.id, dbData);

    if (!updatedProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Audit log
    const auditAction = isTreasuryChange ? 'treasury_wallet_changed' : 'project_updated';
    await auditRepo.logAction('admin', auditAction, {
      actorId: sessionData.userId,
      payload: {
        projectId: params.id,
        changes: updateData,
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