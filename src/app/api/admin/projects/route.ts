import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getProjectRepository, getAuditLogRepository } from '@/lib/repositories';
import { query } from '@/lib/database';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  description: z.string().max(1000).optional(),
  logoUrl: z.union([z.string().url(), z.literal(''), z.undefined()]).optional(),
  backgroundUrl: z.union([z.string().url(), z.literal(''), z.undefined()]).optional(),
  discordUrl: z.union([z.string().url(), z.literal(''), z.undefined()]).optional(),
  xUrl: z.union([z.string().url(), z.literal(''), z.undefined()]).optional(),
  magicedenUrl: z.union([z.string().url(), z.literal(''), z.undefined()]).optional(),
  websiteUrl: z.union([z.string().url(), z.literal(''), z.undefined()]).optional(),
  collectionIds: z.array(z.string().min(32).max(44)).min(1, 'At least one collection ID is required'),
  treasuryWallet: z.string().min(32).max(44, 'Invalid treasury wallet address'),
});

const updateProjectSchema = projectSchema.partial();

export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const projectRepo = getProjectRepository();
    const projects = await projectRepo.findAll();
    
    // Fetch tokens for each project
    const projectsWithTokens = await Promise.all(
      projects.map(async (project: any) => {
        const tokensResult = await query(`
          SELECT 
            id,
            project_id,
            token_address,
            token_name,
            token_symbol,
            decimals,
            enabled,
            created_at,
            updated_at
          FROM project_tokens 
          WHERE project_id = $1 AND enabled = true
          ORDER BY created_at ASC
        `, [project.id]);

        // Transform snake_case to camelCase for frontend
        const transformedTokens = tokensResult.rows.map((token: any) => ({
          id: token.id,
          projectId: token.project_id,
          tokenAddress: token.token_address,
          tokenName: token.token_name,
          tokenSymbol: token.token_symbol,
          decimals: token.decimals,
          enabled: token.enabled,
          createdAt: token.created_at,
          updatedAt: token.updated_at
        }));

        const domainProject = projectRepo.toDomain(project);
        return {
          ...domainProject,
          tokens: transformedTokens
        };
      })
    );
    
    return NextResponse.json({
      projects: projectsWithTokens
    });

  } catch (error) {
    console.error('Get projects API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const projectData = projectSchema.parse(body);

    const projectRepo = getProjectRepository();
    const auditRepo = getAuditLogRepository();

    // Add UUID to the project data
    const projectDataWithId = {
      id: randomUUID(),
      ...projectData
    };

    const dbData = projectRepo.fromDomain(projectDataWithId);
    const newProject = await projectRepo.create(dbData);

    // Add SOL as default token for the new project
    await query(`
      INSERT INTO project_tokens (
        project_id, token_address, token_name, token_symbol, decimals, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      newProject.id,
      'So11111111111111111111111111111111111111112',
      'Solana',
      'SOL',
      9,
      true
    ]);

    // Audit log
    await auditRepo.logAction('admin', 'project_created', {
      actorId: sessionData.userId,
      payload: { projectId: newProject.id, projectName: newProject.name },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    // Fetch the project with tokens
    const tokensResult = await query(`
      SELECT 
        id,
        project_id,
        token_address,
        token_name,
        token_symbol,
        decimals,
        enabled,
        created_at,
        updated_at
      FROM project_tokens 
      WHERE project_id = $1
      ORDER BY created_at ASC
    `, [newProject.id]);

    // Transform snake_case to camelCase for frontend
    const transformedTokens = tokensResult.rows.map((token: any) => ({
      id: token.id,
      projectId: token.project_id,
      tokenAddress: token.token_address,
      tokenName: token.token_name,
      tokenSymbol: token.token_symbol,
      decimals: token.decimals,
      enabled: token.enabled,
      createdAt: token.created_at,
      updatedAt: token.updated_at
    }));

    const projectWithTokens = {
      ...projectRepo.toDomain(newProject),
      tokens: transformedTokens
    };

    return NextResponse.json({
      project: projectWithTokens
    }, { status: 201 });

  } catch (error) {
    console.error('Create project API error:', error);
    
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