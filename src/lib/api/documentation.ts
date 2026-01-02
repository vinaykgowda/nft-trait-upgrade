/**
 * API Documentation Generator
 * 
 * This module provides comprehensive API documentation for the NFT Trait Marketplace.
 * It includes endpoint specifications, request/response schemas, and usage examples.
 */

export interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  parameters?: Parameter[];
  requestBody?: Schema;
  responses: Response[];
  examples?: Example[];
  authentication?: string;
  rateLimit?: string;
}

export interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header';
  required: boolean;
  type: string;
  description: string;
  example?: any;
}

export interface Schema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
  example?: any;
}

export interface Response {
  status: number;
  description: string;
  schema?: Schema;
  example?: any;
}

export interface Example {
  title: string;
  description: string;
  request?: any;
  response?: any;
}

/**
 * Public API Endpoints
 */
export const publicApiEndpoints: ApiEndpoint[] = [
  {
    method: 'GET',
    path: '/api/project',
    description: 'Get project configuration and branding information',
    responses: [
      {
        status: 200,
        description: 'Project configuration retrieved successfully',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                description: { type: 'string' },
                logoUrl: { type: 'string', format: 'uri' },
                backgroundUrl: { type: 'string', format: 'uri' },
                discordUrl: { type: 'string', format: 'uri' },
                xUrl: { type: 'string', format: 'uri' },
                magicedenUrl: { type: 'string', format: 'uri' },
                websiteUrl: { type: 'string', format: 'uri' },
                collectionIds: { type: 'array', items: { type: 'string' } },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        example: {
          success: true,
          data: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'My NFT Project',
            description: 'A revolutionary NFT trait marketplace',
            logoUrl: 'https://example.com/logo.png',
            collectionIds: ['ABC123...', 'DEF456...'],
          },
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
      {
        status: 404,
        description: 'No project configuration found',
        example: {
          success: false,
          error: 'No project configuration found',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
    ],
    rateLimit: '1000 requests per hour',
  },
  {
    method: 'GET',
    path: '/api/traits',
    description: 'Get available traits with filtering and pagination',
    parameters: [
      {
        name: 'slotId',
        in: 'query',
        required: false,
        type: 'string',
        description: 'Filter by trait slot ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
      },
      {
        name: 'rarityTierId',
        in: 'query',
        required: false,
        type: 'string',
        description: 'Filter by rarity tier ID',
        example: '123e4567-e89b-12d3-a456-426614174001',
      },
      {
        name: 'tokenId',
        in: 'query',
        required: false,
        type: 'string',
        description: 'Filter by payment token ID',
        example: '123e4567-e89b-12d3-a456-426614174002',
      },
      {
        name: 'active',
        in: 'query',
        required: false,
        type: 'boolean',
        description: 'Filter by active status',
        example: true,
      },
      {
        name: 'page',
        in: 'query',
        required: false,
        type: 'integer',
        description: 'Page number for pagination',
        example: 1,
      },
      {
        name: 'limit',
        in: 'query',
        required: false,
        type: 'integer',
        description: 'Number of items per page (max 100)',
        example: 20,
      },
    ],
    responses: [
      {
        status: 200,
        description: 'Traits retrieved successfully',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  imageLayerUrl: { type: 'string', format: 'uri' },
                  priceAmount: { type: 'string' },
                  remainingSupply: { type: 'integer' },
                  active: { type: 'boolean' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    ],
    rateLimit: '1000 requests per hour',
  },
  {
    method: 'GET',
    path: '/api/trait-slots',
    description: 'Get all trait slots ordered by layer order',
    responses: [
      {
        status: 200,
        description: 'Trait slots retrieved successfully',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  layerOrder: { type: 'integer' },
                  rules: { type: 'object' },
                },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    ],
    rateLimit: '1000 requests per hour',
  },
  {
    method: 'GET',
    path: '/api/user/nfts',
    description: 'Get NFTs owned by a wallet address from allowlisted collections',
    parameters: [
      {
        name: 'wallet',
        in: 'query',
        required: true,
        type: 'string',
        description: 'Wallet address to query NFTs for',
        example: '11111111111111111111111111111114',
      },
    ],
    responses: [
      {
        status: 200,
        description: 'NFTs retrieved successfully',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  address: { type: 'string' },
                  name: { type: 'string' },
                  image: { type: 'string', format: 'uri' },
                  collection: { type: 'string' },
                  attributes: { type: 'array' },
                },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    ],
    rateLimit: '1000 requests per hour',
  },
  {
    method: 'POST',
    path: '/api/reserve',
    description: 'Create a trait reservation for purchase',
    requestBody: {
      type: 'object',
      properties: {
        walletAddress: { type: 'string', minLength: 32, maxLength: 44 },
        assetId: { type: 'string', minLength: 32, maxLength: 44 },
        traitId: { type: 'string', format: 'uuid' },
      },
      required: ['walletAddress', 'assetId', 'traitId'],
      example: {
        walletAddress: '11111111111111111111111111111114',
        assetId: '22222222222222222222222222222225',
        traitId: '123e4567-e89b-12d3-a456-426614174000',
      },
    },
    responses: [
      {
        status: 200,
        description: 'Reservation created or existing reservation returned',
        example: {
          success: true,
          data: {
            reservation: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              traitId: '123e4567-e89b-12d3-a456-426614174001',
              walletAddress: '11111111111111111111111111111114',
              assetId: '22222222222222222222222222222225',
              expiresAt: '2024-01-01T01:00:00.000Z',
              status: 'reserved',
            },
            message: 'Reservation created successfully',
          },
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
      {
        status: 400,
        description: 'Invalid request or insufficient inventory',
        example: {
          success: false,
          error: 'Insufficient inventory available',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
    ],
    rateLimit: '100 requests per hour',
  },
  {
    method: 'POST',
    path: '/api/tx/build',
    description: 'Build an atomic transaction for trait purchase',
    requestBody: {
      type: 'object',
      properties: {
        walletAddress: { type: 'string', minLength: 32, maxLength: 44 },
        assetId: { type: 'string', minLength: 32, maxLength: 44 },
        traitId: { type: 'string', format: 'uuid' },
        reservationId: { type: 'string', format: 'uuid' },
      },
      required: ['walletAddress', 'assetId', 'traitId', 'reservationId'],
      example: {
        walletAddress: '11111111111111111111111111111114',
        assetId: '22222222222222222222222222222225',
        traitId: '123e4567-e89b-12d3-a456-426614174000',
        reservationId: '123e4567-e89b-12d3-a456-426614174001',
      },
    },
    responses: [
      {
        status: 200,
        description: 'Transaction built successfully',
        example: {
          success: true,
          data: {
            transaction: {
              serialized: 'base64-encoded-transaction',
              requiredSignatures: ['user'],
              delegateSignatures: ['delegate'],
            },
            reservationId: '123e4567-e89b-12d3-a456-426614174001',
            paymentAmount: '1000000000',
            treasuryWallet: '11111111111111111111111111111114',
            timeRemaining: 1800,
          },
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
      {
        status: 403,
        description: 'Asset not owned by wallet',
        example: {
          success: false,
          error: 'Asset not owned by wallet',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
    ],
    rateLimit: '100 requests per hour',
  },
];

/**
 * Admin API Endpoints (require authentication)
 */
export const adminApiEndpoints: ApiEndpoint[] = [
  {
    method: 'POST',
    path: '/api/admin/login',
    description: 'Authenticate admin user',
    requestBody: {
      type: 'object',
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 100 },
        password: { type: 'string', minLength: 8, maxLength: 255 },
      },
      required: ['username', 'password'],
      example: {
        username: 'admin',
        password: 'securepassword123',
      },
    },
    responses: [
      {
        status: 200,
        description: 'Login successful',
        example: {
          success: true,
          data: {
            requiresMfa: true,
            sessionId: 'session_123',
          },
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
      {
        status: 401,
        description: 'Invalid credentials',
        example: {
          success: false,
          error: 'Invalid username or password',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
    ],
    rateLimit: '10 requests per hour',
  },
  {
    method: 'GET',
    path: '/api/admin/analytics',
    description: 'Get marketplace analytics data',
    authentication: 'Admin session required',
    parameters: [
      {
        name: 'startDate',
        in: 'query',
        required: false,
        type: 'string',
        description: 'Start date for analytics (ISO 8601)',
        example: '2024-01-01T00:00:00.000Z',
      },
      {
        name: 'endDate',
        in: 'query',
        required: false,
        type: 'string',
        description: 'End date for analytics (ISO 8601)',
        example: '2024-01-31T23:59:59.999Z',
      },
      {
        name: 'groupBy',
        in: 'query',
        required: false,
        type: 'string',
        description: 'Group results by time period',
        example: 'day',
      },
    ],
    responses: [
      {
        status: 200,
        description: 'Analytics data retrieved successfully',
        example: {
          success: true,
          data: {
            revenue: {
              total: '5000000000',
              byToken: {
                SOL: '5000000000',
              },
            },
            transactions: {
              total: 150,
              successful: 145,
              failed: 5,
            },
            traits: {
              totalSold: 145,
              byRarity: {
                common: 100,
                rare: 35,
                legendary: 10,
              },
            },
          },
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
    ],
    rateLimit: '100 requests per hour',
  },
];

/**
 * Generate OpenAPI specification
 */
export function generateOpenApiSpec(): any {
  return {
    openapi: '3.0.0',
    info: {
      title: 'NFT Trait Marketplace API',
      version: '1.0.0',
      description: 'API for the NFT Trait Marketplace - secure trait commerce for Metaplex Core NFTs',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
        description: 'Main API server',
      },
    ],
    paths: generatePaths([...publicApiEndpoints, ...adminApiEndpoints]),
    components: {
      securitySchemes: {
        AdminSession: {
          type: 'apiKey',
          in: 'cookie',
          name: 'admin-session',
          description: 'Admin session cookie',
        },
      },
      schemas: generateSchemas(),
    },
  };
}

function generatePaths(endpoints: ApiEndpoint[]): any {
  const paths: any = {};
  
  for (const endpoint of endpoints) {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {};
    }
    
    paths[endpoint.path][endpoint.method.toLowerCase()] = {
      summary: endpoint.description,
      parameters: endpoint.parameters?.map(param => ({
        name: param.name,
        in: param.in,
        required: param.required,
        schema: { type: param.type },
        description: param.description,
        example: param.example,
      })),
      requestBody: endpoint.requestBody ? {
        required: true,
        content: {
          'application/json': {
            schema: endpoint.requestBody,
            example: endpoint.requestBody.example,
          },
        },
      } : undefined,
      responses: endpoint.responses.reduce((acc, response) => {
        acc[response.status] = {
          description: response.description,
          content: response.schema ? {
            'application/json': {
              schema: response.schema,
              example: response.example,
            },
          } : undefined,
        };
        return acc;
      }, {} as any),
      security: endpoint.authentication ? [{ AdminSession: [] }] : undefined,
    };
  }
  
  return paths;
}

function generateSchemas(): any {
  return {
    ApiResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' },
        error: { type: 'string' },
        details: { type: 'object' },
        timestamp: { type: 'string', format: 'date-time' },
        requestId: { type: 'string' },
      },
      required: ['success', 'timestamp'],
    },
    PaginatedResponse: {
      allOf: [
        { $ref: '#/components/schemas/ApiResponse' },
        {
          type: 'object',
          properties: {
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
      ],
    },
    Trait: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        imageLayerUrl: { type: 'string', format: 'uri' },
        priceAmount: { type: 'string' },
        remainingSupply: { type: 'integer' },
        active: { type: 'boolean' },
      },
    },
    Reservation: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        traitId: { type: 'string', format: 'uuid' },
        walletAddress: { type: 'string' },
        assetId: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
        status: { type: 'string', enum: ['reserved', 'confirmed', 'expired', 'cancelled'] },
      },
    },
  };
}

/**
 * Generate API documentation as HTML
 */
export function generateApiDocumentationHtml(): string {
  const publicEndpointsHtml = publicApiEndpoints.map(endpoint => `
    <div class="endpoint">
      <h3><span class="method ${endpoint.method.toLowerCase()}">${endpoint.method}</span> ${endpoint.path}</h3>
      <p>${endpoint.description}</p>
      ${endpoint.parameters ? `
        <h4>Parameters</h4>
        <ul>
          ${endpoint.parameters.map(param => `
            <li><strong>${param.name}</strong> (${param.type}${param.required ? ', required' : ', optional'}): ${param.description}</li>
          `).join('')}
        </ul>
      ` : ''}
      ${endpoint.requestBody ? `
        <h4>Request Body</h4>
        <pre><code>${JSON.stringify(endpoint.requestBody.example, null, 2)}</code></pre>
      ` : ''}
      <h4>Responses</h4>
      ${endpoint.responses.map(response => `
        <div class="response">
          <h5>Status ${response.status}: ${response.description}</h5>
          ${response.example ? `<pre><code>${JSON.stringify(response.example, null, 2)}</code></pre>` : ''}
        </div>
      `).join('')}
      ${endpoint.rateLimit ? `<p><strong>Rate Limit:</strong> ${endpoint.rateLimit}</p>` : ''}
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>NFT Trait Marketplace API Documentation</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .endpoint { border: 1px solid #ddd; margin: 20px 0; padding: 20px; border-radius: 5px; }
        .method { padding: 4px 8px; border-radius: 3px; color: white; font-weight: bold; }
        .method.get { background-color: #61affe; }
        .method.post { background-color: #49cc90; }
        .method.put { background-color: #fca130; }
        .method.delete { background-color: #f93e3e; }
        pre { background-color: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
        .response { margin: 10px 0; padding: 10px; background-color: #f9f9f9; border-radius: 3px; }
      </style>
    </head>
    <body>
      <h1>NFT Trait Marketplace API Documentation</h1>
      <p>This API enables secure trait commerce for Metaplex Core NFTs through atomic transactions.</p>
      
      <h2>Base URL</h2>
      <p><code>${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}</code></p>
      
      <h2>Authentication</h2>
      <p>Admin endpoints require session-based authentication. Public endpoints do not require authentication.</p>
      
      <h2>Rate Limiting</h2>
      <p>API endpoints are rate limited to prevent abuse. Limits vary by endpoint type.</p>
      
      <h2>Public Endpoints</h2>
      ${publicEndpointsHtml}
      
      <h2>Admin Endpoints</h2>
      <p>Admin endpoints require authentication and have stricter rate limits.</p>
      
      <h2>Error Handling</h2>
      <p>All endpoints return consistent error responses with categorized error information.</p>
      
      <h2>Response Format</h2>
      <p>All responses follow a consistent format with success/error indicators, data payload, and metadata.</p>
    </body>
    </html>
  `;
}