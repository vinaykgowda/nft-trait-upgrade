import { NextRequest } from 'next/server';
import { getProjectRepository } from '@/lib/repositories';
import { createApiResponse, getRequestId } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const apiResponse = createApiResponse(requestId);

  try {
    const projectRepo = getProjectRepository();
    const projects = await projectRepo.findAll();
    
    if (projects.length === 0) {
      return apiResponse.error('No project configuration found', 404);
    }

    // Return the first project (assuming single project setup for now)
    const project = projects[0];
    const domainProject = projectRepo.toDomain(project);
    
    // Return public project data (excluding sensitive information)
    const publicProjectData = {
      id: domainProject.id,
      name: domainProject.name,
      description: domainProject.description,
      logoUrl: domainProject.logoUrl,
      backgroundUrl: domainProject.backgroundUrl,
      discordUrl: domainProject.discordUrl,
      xUrl: domainProject.xUrl,
      magicedenUrl: domainProject.magicedenUrl,
      websiteUrl: domainProject.websiteUrl,
      collectionIds: domainProject.collectionIds,
      // Don't expose treasury wallet in public API
    };
    
    return apiResponse.success(publicProjectData);
  } catch (error) {
    return apiResponse.handleError(error, {
      operation: 'get_project_config',
      type: 'database',
    });
  }
}