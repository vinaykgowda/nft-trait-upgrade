// Type definitions for the PV Reforge system

export type PackTier = 'silver' | 'gold' | 'diamond';

export type ReforgeOrderStatus = 'bought' | 'started_reforge' | 'failed' | 'completed';

export interface ReforgePack {
  id: string;
  collectionId: string;
  tierName: PackTier;
  solPrice: number;
  minLdzEarning: number;
  maxLdzEarning: number;
  totalInventory: number;
  remainingCount: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReforgeOrder {
  id: string;
  packId: string;
  walletAddress: string;
  discordId: string;
  assetId: string | null;
  status: ReforgeOrderStatus;
  used: boolean;
  purchaseTxSignature: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReforgeOrderWithPack extends ReforgeOrder {
  tierName: string | null;
}

export interface ReforgeCombination {
  id: string;
  orderId: string;
  collectionId: string;
  combinationHash: string;
  traitIds: string[];
  createdAt: string;
}

export interface PoolTrait {
  id: string;
  slotId: string;
  slotName: string;
  name: string;
  imageLayerUrl: string;
  ldzEarning: number;
  layerOrder: number;
}

export interface SelectedTrait {
  slotId: string;
  slotName: string;
  traitId: string;
  traitName: string;
  imageUrl: string;
  ldzEarning: number;
}

export interface ReforgeResult {
  orderId: string;
  selectedTraits: SelectedTrait[];
  imageUrl: string;
  metadataUrl: string;
  txSignature: string;
}

export interface ReforgeError {
  error: string;        // Machine-readable error code
  message: string;      // Human-readable message
  orderId?: string;     // If applicable
  retryable: boolean;   // Whether the client should retry
}
