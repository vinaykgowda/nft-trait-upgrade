// Repository exports and factory

export { BaseRepository } from './base';
export { ProjectRepository } from './projects';
export { TraitRepository } from './traits';
export { TraitSlotRepository } from './trait-slots';
export { PurchaseRepository } from './purchases';
export { InventoryReservationRepository } from './inventory';
export { AdminUserRepository } from './admin-users';
export { AuditLogRepository } from './audit-logs';
export { GiftBalanceRepository } from './gift-balances';

import { ProjectRepository } from './projects';
import { TraitRepository } from './traits';
import { TraitSlotRepository } from './trait-slots';
import { PurchaseRepository } from './purchases';
import { InventoryReservationRepository } from './inventory';
import { AdminUserRepository } from './admin-users';
import { AuditLogRepository } from './audit-logs';
import { GiftBalanceRepository } from './gift-balances';

// Repository instances (singletons)
let projectRepo: ProjectRepository;
let traitRepo: TraitRepository;
let traitSlotRepo: TraitSlotRepository;
let purchaseRepo: PurchaseRepository;
let inventoryRepo: InventoryReservationRepository;
let adminUserRepo: AdminUserRepository;
let auditLogRepo: AuditLogRepository;
let giftBalanceRepo: GiftBalanceRepository;

export function getProjectRepository(): ProjectRepository {
  if (!projectRepo) {
    projectRepo = new ProjectRepository();
  }
  return projectRepo;
}

export function getTraitRepository(): TraitRepository {
  if (!traitRepo) {
    traitRepo = new TraitRepository();
  }
  return traitRepo;
}

export function getTraitSlotRepository(): TraitSlotRepository {
  if (!traitSlotRepo) {
    traitSlotRepo = new TraitSlotRepository();
  }
  return traitSlotRepo;
}

export function getPurchaseRepository(): PurchaseRepository {
  if (!purchaseRepo) {
    purchaseRepo = new PurchaseRepository();
  }
  return purchaseRepo;
}

export function getInventoryRepository(): InventoryReservationRepository {
  if (!inventoryRepo) {
    inventoryRepo = new InventoryReservationRepository();
  }
  return inventoryRepo;
}

export function getAdminUserRepository(): AdminUserRepository {
  if (!adminUserRepo) {
    adminUserRepo = new AdminUserRepository();
  }
  return adminUserRepo;
}

export function getAuditLogRepository(): AuditLogRepository {
  if (!auditLogRepo) {
    auditLogRepo = new AuditLogRepository();
  }
  return auditLogRepo;
}

export function getGiftBalanceRepository(): GiftBalanceRepository {
  if (!giftBalanceRepo) {
    giftBalanceRepo = new GiftBalanceRepository();
  }
  return giftBalanceRepo;
}