/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// Mock the auth service and repositories
jest.mock('../../src/lib/auth', () => ({
  authService: {
    requireAuth: jest.fn(),
    hasPermission: jest.fn(),
    requireMFA: jest.fn(),
  },
}));

jest.mock('../../src/lib/repositories', () => ({
  getProjectRepository: jest.fn(),
  getTraitRepository: jest.fn(),
  getPurchaseRepository: jest.fn(),
  getAuditLogRepository: jest.fn(),
}));

describe('Admin API Unit Tests', () => {
  const mockAuthService = require('../../src/lib/auth').authService;
  const mockRepositories = require('../../src/lib/repositories');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Project Management', () => {
    it('should require authentication for project operations', async () => {
      // Mock unauthenticated request
      mockAuthService.requireAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/admin/projects', {
        method: 'GET',
      });

      // Import and test the route handler
      const { GET } = await import('../../src/app/api/admin/projects/route');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should require admin permissions for project operations', async () => {
      // Mock authenticated but non-admin user
      mockAuthService.requireAuth.mockResolvedValue({
        userId: 'user-123',
        username: 'testuser',
        roles: ['viewer'],
      });
      mockAuthService.hasPermission.mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/admin/projects', {
        method: 'GET',
      });

      const { GET } = await import('../../src/app/api/admin/projects/route');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should return projects for authorized admin users', async () => {
      // Mock authenticated admin user
      mockAuthService.requireAuth.mockResolvedValue({
        userId: 'admin-123',
        username: 'admin',
        roles: ['admin'],
      });
      mockAuthService.hasPermission.mockResolvedValue(true);

      // Mock project repository
      const mockProjectRepo = {
        findAll: jest.fn().mockResolvedValue([
          {
            id: 'project-1',
            name: 'Test Project',
            collection_ids: ['collection-1'],
            treasury_wallet: '11111111111111111111111111111112',
          },
        ]),
        toDomain: jest.fn().mockImplementation((project) => ({
          id: project.id,
          name: project.name,
          collectionIds: project.collection_ids,
          treasuryWallet: project.treasury_wallet,
        })),
      };

      mockRepositories.getProjectRepository.mockReturnValue(mockProjectRepo);

      const request = new NextRequest('http://localhost/api/admin/projects', {
        method: 'GET',
      });

      const { GET } = await import('../../src/app/api/admin/projects/route');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].name).toBe('Test Project');
    });

    it('should validate project creation data', async () => {
      // Mock authenticated admin user
      mockAuthService.requireAuth.mockResolvedValue({
        userId: 'admin-123',
        username: 'admin',
        roles: ['admin'],
      });
      mockAuthService.hasPermission.mockResolvedValue(true);

      const invalidProjectData = {
        name: '', // Invalid: empty name
        collectionIds: [], // Invalid: empty array
        treasuryWallet: 'invalid', // Invalid: too short
      };

      const request = new NextRequest('http://localhost/api/admin/projects', {
        method: 'POST',
        body: JSON.stringify(invalidProjectData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const { POST } = await import('../../src/app/api/admin/projects/route');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid input');
      expect(data.details).toBeDefined();
    });

    it('should create project with valid data and audit log', async () => {
      // Mock authenticated admin user
      mockAuthService.requireAuth.mockResolvedValue({
        userId: 'admin-123',
        username: 'admin',
        roles: ['admin'],
      });
      mockAuthService.hasPermission.mockResolvedValue(true);

      const validProjectData = {
        name: 'New Project',
        description: 'Test project description',
        collectionIds: ['11111111111111111111111111111112'],
        treasuryWallet: '11111111111111111111111111111113',
      };

      // Mock repositories
      const mockProjectRepo = {
        fromDomain: jest.fn().mockReturnValue({
          name: validProjectData.name,
          description: validProjectData.description,
          collection_ids: validProjectData.collectionIds,
          treasury_wallet: validProjectData.treasuryWallet,
        }),
        create: jest.fn().mockResolvedValue({
          id: 'new-project-id',
          name: validProjectData.name,
          description: validProjectData.description,
          collection_ids: validProjectData.collectionIds,
          treasury_wallet: validProjectData.treasuryWallet,
        }),
        toDomain: jest.fn().mockImplementation((project) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          collectionIds: project.collection_ids,
          treasuryWallet: project.treasury_wallet,
        })),
      };

      const mockAuditRepo = {
        logAction: jest.fn().mockResolvedValue({}),
      };

      mockRepositories.getProjectRepository.mockReturnValue(mockProjectRepo);
      mockRepositories.getAuditLogRepository.mockReturnValue(mockAuditRepo);

      const request = new NextRequest('http://localhost/api/admin/projects', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const { POST } = await import('../../src/app/api/admin/projects/route');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.project.name).toBe(validProjectData.name);
      expect(mockProjectRepo.create).toHaveBeenCalled();
      expect(mockAuditRepo.logAction).toHaveBeenCalledWith(
        'admin',
        'project_created',
        expect.objectContaining({
          actorId: 'admin-123',
          payload: expect.objectContaining({
            projectName: validProjectData.name,
          }),
        })
      );
    });
  });

  describe('Trait Management', () => {
    it('should return filtered traits based on query parameters', async () => {
      // Mock authenticated admin user
      mockAuthService.requireAuth.mockResolvedValue({
        userId: 'admin-123',
        username: 'admin',
        roles: ['admin'],
      });
      mockAuthService.hasPermission.mockResolvedValue(true);

      // Mock trait repository
      const mockTraitRepo = {
        findWithRelations: jest.fn().mockResolvedValue([
          {
            id: 'trait-1',
            name: 'Cool Hat',
            slot_name: 'Hat',
            active: true,
          },
        ]),
        toDomain: jest.fn().mockImplementation((trait) => ({
          id: trait.id,
          name: trait.name,
          slotName: trait.slot_name,
          active: trait.active,
        })),
      };

      mockRepositories.getTraitRepository.mockReturnValue(mockTraitRepo);

      const request = new NextRequest('http://localhost/api/admin/traits?active=true&slotId=slot-123', {
        method: 'GET',
      });

      const { GET } = await import('../../src/app/api/admin/traits/route');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.traits).toHaveLength(1);
      expect(mockTraitRepo.findWithRelations).toHaveBeenCalledWith({
        active: true,
        slotId: 'slot-123',
      });
    });

    it('should validate trait creation data', async () => {
      // Mock authenticated admin user
      mockAuthService.requireAuth.mockResolvedValue({
        userId: 'admin-123',
        username: 'admin',
        roles: ['admin'],
      });
      mockAuthService.hasPermission.mockResolvedValue(true);

      const invalidTraitData = {
        name: '', // Invalid: empty name
        slotId: 'invalid-uuid', // Invalid: not a UUID
        priceAmount: 'not-a-number', // Invalid: not numeric
      };

      const request = new NextRequest('http://localhost/api/admin/traits', {
        method: 'POST',
        body: JSON.stringify(invalidTraitData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const { POST } = await import('../../src/app/api/admin/traits/route');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid input');
      expect(data.details).toBeDefined();
    });
  });

  describe('Analytics', () => {
    it('should require analyst permissions for analytics access', async () => {
      // Mock authenticated user without analyst permissions
      mockAuthService.requireAuth.mockResolvedValue({
        userId: 'user-123',
        username: 'user',
        roles: ['viewer'],
      });
      mockAuthService.hasPermission.mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/admin/analytics', {
        method: 'GET',
      });

      const { GET } = await import('../../src/app/api/admin/analytics/route');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should return analytics data for authorized users', async () => {
      // Mock authenticated analyst user
      mockAuthService.requireAuth.mockResolvedValue({
        userId: 'analyst-123',
        username: 'analyst',
        roles: ['analyst'],
      });
      mockAuthService.hasPermission.mockResolvedValue(true);

      // Mock repositories
      const mockPurchaseRepo = {
        getRevenueStats: jest.fn().mockResolvedValue({
          totalRevenue: '1000000000',
          totalPurchases: 50,
          revenueByToken: [
            { tokenId: 'sol', revenue: '800000000', count: 40 },
            { tokenId: 'usdc', revenue: '200000000', count: 10 },
          ],
        }),
        findByStatus: jest.fn().mockResolvedValue([
          {
            id: 'purchase-1',
            trait_id: 'trait-1',
            created_at: new Date('2024-01-15'),
          },
          {
            id: 'purchase-2',
            trait_id: 'trait-1',
            created_at: new Date('2024-01-16'),
          },
        ]),
      };

      const mockTraitRepo = {
        findAll: jest.fn().mockResolvedValue([
          { id: 'trait-1', active: true, total_supply: 100, remaining_supply: 50 },
          { id: 'trait-2', active: false, total_supply: null, remaining_supply: null },
        ]),
      };

      const mockAuditRepo = {
        getActionStats: jest.fn().mockResolvedValue([
          { action: 'login', count: 25 },
          { action: 'trait_created', count: 5 },
        ]),
      };

      mockRepositories.getPurchaseRepository.mockReturnValue(mockPurchaseRepo);
      mockRepositories.getTraitRepository.mockReturnValue(mockTraitRepo);
      mockRepositories.getAuditLogRepository.mockReturnValue(mockAuditRepo);

      const request = new NextRequest('http://localhost/api/admin/analytics', {
        method: 'GET',
      });

      const { GET } = await import('../../src/app/api/admin/analytics/route');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.revenue.total).toBe('1000000000');
      expect(data.revenue.totalPurchases).toBe(50);
      expect(data.traits.totalTraits).toBe(2);
      expect(data.traits.activeTraits).toBe(1);
      expect(data.auditActivity).toHaveLength(2);
    });

    it('should handle date range parameters', async () => {
      // Mock authenticated analyst user
      mockAuthService.requireAuth.mockResolvedValue({
        userId: 'analyst-123',
        username: 'analyst',
        roles: ['analyst'],
      });
      mockAuthService.hasPermission.mockResolvedValue(true);

      // Mock repositories
      const mockPurchaseRepo = {
        getRevenueStats: jest.fn().mockResolvedValue({
          totalRevenue: '500000000',
          totalPurchases: 25,
          revenueByToken: [],
        }),
        findByStatus: jest.fn().mockResolvedValue([]),
      };

      const mockTraitRepo = {
        findAll: jest.fn().mockResolvedValue([]),
      };

      const mockAuditRepo = {
        getActionStats: jest.fn().mockResolvedValue([]),
      };

      mockRepositories.getPurchaseRepository.mockReturnValue(mockPurchaseRepo);
      mockRepositories.getTraitRepository.mockReturnValue(mockTraitRepo);
      mockRepositories.getAuditLogRepository.mockReturnValue(mockAuditRepo);

      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const request = new NextRequest(`http://localhost/api/admin/analytics?startDate=${startDate}&endDate=${endDate}`, {
        method: 'GET',
      });

      const { GET } = await import('../../src/app/api/admin/analytics/route');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockPurchaseRepo.getRevenueStats).toHaveBeenCalledWith(
        new Date(startDate),
        new Date(endDate)
      );
      expect(mockAuditRepo.getActionStats).toHaveBeenCalledWith(
        new Date(startDate),
        new Date(endDate)
      );
    });
  });
});