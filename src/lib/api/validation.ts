import { z } from 'zod';

// Common validation schemas
export const walletAddressSchema = z.string()
  .min(32, 'Wallet address too short')
  .max(44, 'Wallet address too long')
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid wallet address format');

export const assetIdSchema = z.string()
  .min(32, 'Asset ID too short')
  .max(44, 'Asset ID too long')
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid asset ID format');

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Trait-related schemas
export const traitFiltersSchema = z.object({
  slotId: uuidSchema.optional(),
  rarityTierId: uuidSchema.optional(),
  tokenId: uuidSchema.optional(),
  active: z.coerce.boolean().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
});

export const reservationRequestSchema = z.object({
  walletAddress: walletAddressSchema,
  assetId: assetIdSchema,
  traitId: uuidSchema,
});

export const transactionBuildSchema = z.object({
  walletAddress: walletAddressSchema,
  assetId: assetIdSchema,
  traitId: uuidSchema,
  reservationId: uuidSchema,
});

export const transactionConfirmSchema = z.object({
  signature: z.string().min(64).max(128),
  reservationId: uuidSchema,
});

// Admin schemas
export const adminLoginSchema = z.object({
  username: z.string().min(3).max(100),
  password: z.string().min(8).max(255),
});

export const mfaVerifySchema = z.object({
  token: z.string().length(6).regex(/^\d{6}$/, 'MFA token must be 6 digits'),
});

export const projectUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  logoUrl: z.string().url().max(500).optional(),
  backgroundUrl: z.string().url().max(500).optional(),
  discordUrl: z.string().url().max(500).optional(),
  xUrl: z.string().url().max(500).optional(),
  magicedenUrl: z.string().url().max(500).optional(),
  websiteUrl: z.string().url().max(500).optional(),
  collectionIds: z.array(z.string().min(32).max(44)).optional(),
  treasuryWallet: walletAddressSchema.optional(),
});

export const traitCreateSchema = z.object({
  slotId: uuidSchema,
  name: z.string().min(1).max(255),
  imageLayerUrl: z.string().url().max(500),
  rarityTierId: uuidSchema,
  totalSupply: z.number().int().min(1).optional(),
  priceAmount: z.string().regex(/^\d+$/, 'Price must be a positive integer string'),
  priceTokenId: uuidSchema,
  active: z.boolean().default(true),
});

export const traitUpdateSchema = traitCreateSchema.partial();

export const giftCreateSchema = z.object({
  walletAddress: walletAddressSchema,
  traitId: uuidSchema,
  quantity: z.number().int().min(1).max(1000).default(1),
});

// Utility functions for validation
export function validateSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): T {
  const params: Record<string, any> = {};
  
  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }
  
  return schema.parse(params);
}

export function validateRequestBody<T>(
  body: any,
  schema: z.ZodSchema<T>
): T {
  return schema.parse(body);
}

// Custom validation helpers
export function isValidSolanaAddress(address: string): boolean {
  try {
    walletAddressSchema.parse(address);
    return true;
  } catch {
    return false;
  }
}

export function isValidUUID(id: string): boolean {
  try {
    uuidSchema.parse(id);
    return true;
  } catch {
    return false;
  }
}

// Rate limiting validation
export const rateLimitSchema = z.object({
  windowMs: z.number().int().min(1000).max(24 * 60 * 60 * 1000), // 1 second to 24 hours
  maxRequests: z.number().int().min(1).max(10000),
});

// File upload validation
export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^image\/(png|jpeg|jpg|gif|webp)$/i, 'Invalid image type'),
  size: z.number().int().min(1).max(10 * 1024 * 1024), // Max 10MB
});

// Analytics query validation
export const analyticsQuerySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
  metrics: z.array(z.enum(['revenue', 'transactions', 'users', 'traits'])).default(['revenue']),
});

// Audit log query validation
export const auditLogQuerySchema = z.object({
  actorType: z.enum(['admin', 'user', 'system']).optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).merge(paginationSchema);

// System health validation
export const healthCheckSchema = z.object({
  includeDetails: z.coerce.boolean().default(false),
  services: z.array(z.enum(['database', 'blockchain', 'irys', 'external'])).optional(),
});

export type TraitFilters = z.infer<typeof traitFiltersSchema>;
export type ReservationRequest = z.infer<typeof reservationRequestSchema>;
export type TransactionBuildRequest = z.infer<typeof transactionBuildSchema>;
export type TransactionConfirmRequest = z.infer<typeof transactionConfirmSchema>;
export type AdminLoginRequest = z.infer<typeof adminLoginSchema>;
export type MfaVerifyRequest = z.infer<typeof mfaVerifySchema>;
export type ProjectUpdateRequest = z.infer<typeof projectUpdateSchema>;
export type TraitCreateRequest = z.infer<typeof traitCreateSchema>;
export type TraitUpdateRequest = z.infer<typeof traitUpdateSchema>;
export type GiftCreateRequest = z.infer<typeof giftCreateSchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
export type HealthCheckQuery = z.infer<typeof healthCheckSchema>;