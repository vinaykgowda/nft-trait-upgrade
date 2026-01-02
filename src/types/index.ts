// Core type definitions for the NFT trait marketplace

export interface CoreAsset {
  address: string;
  name: string;
  image: string;
  collection?: string;
  attributes?: Attribute[];
}

export interface Attribute {
  trait_type: string;
  value: string;
}

export interface Trait {
  id: string;
  slotId: string;
  name: string;
  imageLayerUrl: string;
  rarityTier: RarityTier;
  totalSupply?: number;
  remainingSupply?: number;
  priceAmount: string; // Changed from bigint to string
  priceToken: Token;
  active: boolean;
}

export interface RarityTier {
  id: string;
  name: string;
  weight: number;
  displayOrder: number;
}

export interface Token {
  id: string;
  symbol: string;
  mintAddress?: string; // NULL for SOL
  decimals: number;
  enabled: boolean;
}

export interface TraitSlot {
  id: string;
  name: string;
  layerOrder: number;
  rulesJson?: any; // mutual exclusions, dependencies
}

export interface Purchase {
  id: string;
  walletAddress: string;
  assetId: string;
  traitId: string;
  priceAmount: string; // Changed from bigint to string
  tokenId: string;
  status: PurchaseStatus;
  txSignature?: string;
}

export type PurchaseStatus = 'created' | 'tx_built' | 'confirmed' | 'failed' | 'fulfilled';

export interface ReservationRequest {
  walletAddress: string;
  assetId: string;
  traitId: string;
}

export interface AtomicTransaction {
  paymentInstruction: any; // TransactionInstruction
  updateInstruction: any; // TransactionInstruction
  partialSignatures: any[]; // Signature[]
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  backgroundUrl?: string;
  discordUrl?: string;
  xUrl?: string;
  magicedenUrl?: string;
  websiteUrl?: string;
  collectionIds: string[];
  treasuryWallet: string;
  supportsSol?: boolean;
  tokens?: ProjectToken[];
}

export interface ProjectToken {
  id: string;
  projectId: string;
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  decimals: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  roles: string[];
  mfaEnabled: boolean;
  lastLoginAt?: Date;
}

export interface GiftBalance {
  id: string;
  walletAddress: string;
  traitId: string;
  qtyAvailable: number;
}

export interface InventoryReservation {
  id: string;
  traitId: string;
  walletAddress: string;
  assetId: string;
  expiresAt: Date;
  status: 'reserved' | 'consumed' | 'expired' | 'cancelled';
}

export interface AuditLog {
  id: string;
  actorType: 'admin' | 'user' | 'system';
  actorId?: string;
  action: string;
  payloadJson?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}