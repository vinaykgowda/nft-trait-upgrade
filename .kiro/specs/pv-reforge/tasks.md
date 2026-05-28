# Tasks: PV Reforge

## Task 1: Database Schema and Migrations

- [x] 1.1 Create migration file `database/migrations/002_reforge_schema.sql` with `reforge_packs`, `reforge_orders`, and `reforge_combinations` tables
- [x] 1.2 Add `swap_pool_only BOOLEAN DEFAULT false` and `ldz_earning NUMERIC(10,2) DEFAULT 0` nullable columns to `traits` table
- [x] 1.3 Add `encrypted_update_authority TEXT` nullable column to `projects` table
- [x] 1.4 Add indexes for `reforge_orders(wallet_address)`, `reforge_orders(pack_id)`, `reforge_packs(collection_id)`, and `reforge_combinations(collection_id, combination_hash)`

## Task 2: TypeScript Types

- [x] 2.1 Create `src/types/reforge.ts` with `PackTier`, `ReforgeOrderStatus`, `ReforgePack`, `ReforgeOrder`, `ReforgeCombination`, `PoolTrait`, `SelectedTrait`, `ReforgeResult`, and `ReforgeError` interfaces

## Task 3: Encryption Service

- [x] 3.1 Create `src/lib/services/encryption.ts` implementing AES-256-GCM encrypt/decrypt using `ENCRYPTION_KEY` env variable
- [x] 3.2 Write property test `tests/reforge/encryption.property.test.ts` for Property 11 (encryption round-trip)

## Task 4: Repositories

- [x] 4.1 Create `src/lib/repositories/reforge-packs.ts` extending `BaseRepository` with `findByCollection`, `decrementInventory` (optimistic lock), and `setEnabled` methods
- [x] 4.2 Create `src/lib/repositories/reforge-orders.ts` extending `BaseRepository` with `findByWallet`, `updateStatus`, and `markUsed` methods
- [x] 4.3 Create `src/lib/repositories/reforge-combinations.ts` with `isUnique` (hash lookup) and `recordCombination` methods
- [x] 4.4 Create `src/lib/repositories/trait-pool.ts` with `findByCollection` and `findBySlot` methods querying traits where `swap_pool_only = true`

## Task 5: Pack Validation and Management

- [x] 5.1 Create `src/lib/services/pack-manager.ts` with pack CRUD, validation (min <= max LDZ, positive inventory), and enable/disable logic
- [x] 5.2 Write property test `tests/reforge/pack-validation.property.test.ts` for Properties 1, 2, 3 (pack round-trip, validation, disabled rejection)

## Task 6: Trait Pool Partitioning

- [x] 6.1 Update `src/lib/repositories/traits.ts` `findAvailable` to exclude `swap_pool_only = true` traits from marketplace queries
- [x] 6.2 Write property test `tests/reforge/trait-pool-partitioning.property.test.ts` for Property 4 (partitioning correctness)

## Task 7: Trait Selector Service

- [x] 7.1 Create `src/lib/services/trait-selector.ts` implementing randomized trait selection with mandatory slot filling, earning range constraints, and zero-earning trait handling
- [x] 7.2 Write property test `tests/reforge/trait-selector.property.test.ts` for Property 8 (trait selection validity)

## Task 8: Combination Validator

- [x] 8.1 Implement combination hash generation (SHA-256 of sorted trait IDs) in `src/lib/repositories/reforge-combinations.ts`
- [x] 8.2 Write property test `tests/reforge/combination-validator.property.test.ts` for Property 9 (uniqueness invariant)

## Task 9: Order State Machine

- [x] 9.1 Create `src/lib/services/reforge-order-manager.ts` with state transition validation (bought → started_reforge, started_reforge → completed/failed, bought → failed)
- [x] 9.2 Write property test `tests/reforge/order-state-machine.property.test.ts` for Property 7 (state machine validity)

## Task 10: Reforge Service (Orchestrator)

- [x] 10.1 Create `src/lib/services/reforge-service.ts` orchestrating the full reforge workflow: trait selection → uniqueness check → image composition → Pinata upload → metadata update → order completion
- [x] 10.2 Implement retry logic (up to 3 retries) for metadata update failures
- [x] 10.3 Implement retry logic for trait selection (up to 100 attempts) and combination uniqueness (up to 50 attempts)

## Task 11: Metadata Builder

- [x] 11.1 Create `src/lib/services/reforge-metadata-builder.ts` that constructs NFTMetadata from selected traits with correct attributes array
- [x] 11.2 Write property test `tests/reforge/metadata-builder.property.test.ts` for Property 10 (metadata contains all traits)

## Task 12: Purchase Flow

- [x] 12.1 Implement `initiatePurchase` in ReforgeService: validate auth, check inventory, build SOL payment transaction
- [x] 12.2 Implement `confirmPurchase` in ReforgeService: verify tx on-chain, create order, decrement inventory atomically
- [x] 12.3 Write property test `tests/reforge/purchase-atomicity.property.test.ts` for Property 5 (purchase atomicity)
- [x] 12.4 Write property test `tests/reforge/inventory-concurrency.property.test.ts` for Property 6 (concurrency safety)

## Task 13: Order Query

- [x] 13.1 Implement `getOrdersByWallet` with pack tier join for profile display
- [x] 13.2 Write property test `tests/reforge/order-query.property.test.ts` for Property 12 (query completeness)

## Task 14: Admin API Routes

- [x] 14.1 Create `src/app/api/admin/reforge/packs/route.ts` (GET list, POST create)
- [x] 14.2 Create `src/app/api/admin/reforge/packs/[id]/route.ts` (PUT update, DELETE)
- [x] 14.3 Create `src/app/api/admin/reforge/traits/route.ts` (GET pool traits, PUT toggle swap-pool-only)
- [x] 14.4 Create `src/app/api/admin/reforge/orders/route.ts` (GET all orders with filters)
- [x] 14.5 Add Update Authority key field to project settings API (`src/app/api/admin/projects/` — extend existing route)

## Task 15: Public API Routes

- [x] 15.1 Create `src/app/api/reforge/packs/route.ts` (GET active packs for collection)
- [x] 15.2 Create `src/app/api/reforge/purchase/route.ts` (POST initiate purchase)
- [x] 15.3 Create `src/app/api/reforge/purchase/confirm/route.ts` (POST confirm purchase)
- [x] 15.4 Create `src/app/api/reforge/execute/route.ts` (POST execute reforge)
- [x] 15.5 Create `src/app/api/reforge/orders/route.ts` (GET user's orders)

## Task 16: Landing Page UI

- [x] 16.1 Create `src/app/reforge/page.tsx` landing page with pack cards grid
- [x] 16.2 Create `src/components/reforge/PackCard.tsx` with tier-colored styling (silver metallic, gold metallic, diamond-blue), circular glow, and hover animations
- [x] 16.3 Implement sold-out and disabled dimmed states on pack cards
- [x] 16.4 Add entrance animations (CSS/Tailwind) for pack cards on page load
- [x] 16.5 Implement real-time remaining count updates (polling or optimistic update after purchase)

## Task 17: Purchase Flow UI

- [x] 17.1 Create `src/components/reforge/PurchaseModal.tsx` for wallet connection check and purchase confirmation
- [x] 17.2 Integrate Solana wallet adapter for transaction signing in purchase flow
- [x] 17.3 Add Discord account link verification before purchase

## Task 18: NFT Selection UI

- [x] 18.1 Create `src/components/reforge/NFTSelector.tsx` displaying user's collection NFTs with image and name
- [x] 18.2 Implement NFT selection and "Proceed to Reforge" confirmation flow

## Task 19: Reforge Animation UI

- [x] 19.1 Create `src/components/reforge/ReforgeSpinner.tsx` loot-style spinner component with 3-second animation per layer
- [x] 19.2 Create `src/components/reforge/ReforgeProgress.tsx` progress bar showing all stages
- [x] 19.3 Create `src/components/reforge/ReforgeView.tsx` main reforge page with old NFT (left), progressive result (right), and sequential layer reveal
- [x] 19.4 Implement completion popup with final NFT display and tweet button with pre-filled text
- [x] 19.5 Add "metadata update in progress, do not refresh" message during metadata update stage

## Task 20: Profile Integration

- [x] 20.1 Add reforge orders section to `src/app/profile/page.tsx` showing pack purchases, status, and "Start Reforge" button for unused packs
- [x] 20.2 Create `src/components/reforge/OrderHistory.tsx` displaying order history with tier, date, and status

## Task 21: Admin UI for Reforge Management

- [x] 21.1 Create `src/app/admin/reforge/page.tsx` admin dashboard for pack management
- [x] 21.2 Create `src/components/admin/reforge/PackForm.tsx` for creating/editing packs
- [x] 21.3 Create `src/components/admin/reforge/TraitPoolManager.tsx` for toggling swap-pool-only and setting LDZ values
- [x] 21.4 Add Update Authority key input to project settings admin page (with encryption on save)
