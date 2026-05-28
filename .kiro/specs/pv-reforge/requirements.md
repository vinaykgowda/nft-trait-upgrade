# Requirements Document

## Introduction

PV Reforge is a pack-based NFT reforging system that allows users to purchase tiered packs (silver, gold, diamond) by paying SOL, select an existing NFT from their wallet, and have the system randomly assemble a new set of traits from a dedicated swap pool. The system builds a new NFT image with proper layering, updates on-chain metadata, and ensures each generated combination is unique. This feature builds on top of the existing NFT traitstore application without modifying existing functionality.

## Glossary

- **Reforge_System**: The backend service responsible for orchestrating the pack purchase, trait selection, image composition, and metadata update workflow
- **Pack_Manager**: The admin subsystem for creating, configuring, and managing reforge packs and their inventory
- **Trait_Pool**: The collection of traits marked as available for the swap/reforge pool, each with an associated LDZ earning value
- **Pack**: A purchasable package (silver, gold, or diamond tier) with a defined SOL price, LDZ earning range, and limited inventory count
- **Reforge_Order**: A tracked record representing a single pack purchase through its lifecycle from purchase to reforge completion
- **Trait_Selector**: The algorithm that picks random traits from the Trait_Pool whose combined LDZ earnings fall within the pack's defined earning range
- **Image_Composer**: The service that assembles selected traits into a final NFT image following the collection's layer order
- **Landing_Page**: The public-facing page displaying available packs and remaining counts
- **Reforge_UI**: The interactive interface showing the loot-spinner animation and progressive NFT assembly during reforge
- **Combination_Validator**: The service that checks generated trait combinations against previously built combinations to ensure uniqueness
- **LDZ**: The earning token associated with traits and packs, measured in units per day
- **Mandatory_Slot**: A trait slot (background, skin, eyes, mouth) that must always be filled during reforge
- **Optional_Slot**: A trait slot that may or may not be filled during reforge based on available pool traits

## Requirements

### Requirement 1: Pack Creation by Admin

**User Story:** As an admin, I want to create reforge packs with tier, pricing, earning ranges, and inventory limits, so that I can control the reforge offering for a collection.

#### Acceptance Criteria

1. WHEN an admin submits a new pack configuration, THE Pack_Manager SHALL create a pack record with tier name, SOL price, minimum LDZ earning, maximum LDZ earning, total inventory count, and associated collection ID
2. THE Pack_Manager SHALL enforce that minimum LDZ earning is less than or equal to maximum LDZ earning for each pack
3. THE Pack_Manager SHALL enforce that total inventory count is a positive integer
4. WHEN an admin updates an existing pack, THE Pack_Manager SHALL persist the updated configuration without affecting already-purchased Reforge_Orders
5. THE Pack_Manager SHALL associate each pack with exactly one collection
6. THE Pack_Manager SHALL provide an enable/disable toggle for each pack so that an admin can close down packs at any time
7. WHILE a pack is disabled, THE Reforge_System SHALL reject purchase attempts for that pack and THE Landing_Page SHALL display the pack as unavailable

### Requirement 2: Trait Swap Pool Management

**User Story:** As an admin, I want to mark traits as available only for the reforge swap pool and assign LDZ earning values, so that I can control which traits participate in reforging.

#### Acceptance Criteria

1. WHEN an admin uploads or edits a trait, THE Pack_Manager SHALL provide a checkbox option to mark the trait as swap-pool-only
2. WHILE a trait is marked as swap-pool-only, THE Reforge_System SHALL include the trait in the Trait_Pool and exclude it from the normal individual trait forge
3. WHILE a trait is not marked as swap-pool-only, THE Reforge_System SHALL include the trait in the normal individual trait forge and exclude it from the Trait_Pool
4. WHEN an admin marks a trait as swap-pool-only, THE Pack_Manager SHALL require an LDZ earning value (units per day) to be assigned to the trait
5. THE Pack_Manager SHALL accept LDZ earning values of zero or greater (zero-earning traits are free to include in any reforge combination without affecting the earning range budget)

### Requirement 3: Pack Display on Landing Page

**User Story:** As a visitor, I want to view available packs and their remaining counts on a visually striking landing page without connecting a wallet, so that I can decide whether to participate.

#### Acceptance Criteria

1. THE Landing_Page SHALL display all active packs for the collection with tier name, SOL price, LDZ earning range, and remaining inventory count
2. THE Landing_Page SHALL display pack tiers with color-coded styling: silver metallic for silver tier, gold metallic for gold tier, and diamond-blue for diamond tier
3. THE Landing_Page SHALL render each pack card with a circular glow effect matching the tier color (silver glow, gold glow, diamond-blue glow)
4. THE Landing_Page SHALL include smooth entrance animations for pack cards on page load
5. THE Landing_Page SHALL include hover animations on pack cards that intensify the glow effect
6. WHEN pack inventory reaches zero, THE Landing_Page SHALL display the pack as sold out with a dimmed visual state
7. WHILE a pack is disabled by admin, THE Landing_Page SHALL display the pack as unavailable with a dimmed visual state
8. THE Landing_Page SHALL update remaining counts without requiring a page refresh when a purchase occurs

### Requirement 4: Pack Purchase

**User Story:** As a user, I want to purchase a reforge pack by paying SOL, so that I can reforge one of my NFTs.

#### Acceptance Criteria

1. WHEN a user attempts to purchase a pack, THE Reforge_System SHALL require both a connected Solana wallet and a linked Discord account
2. WHEN a user submits a pack purchase, THE Reforge_System SHALL create a SOL payment transaction for the pack price and send it to the configured treasury wallet
3. WHEN the SOL payment transaction is confirmed on-chain, THE Reforge_System SHALL create a Reforge_Order with status "bought" and decrement the pack inventory by one
4. IF the SOL payment transaction fails, THEN THE Reforge_System SHALL not create a Reforge_Order and not decrement pack inventory
5. IF pack inventory is zero at the time of purchase attempt, THEN THE Reforge_System SHALL reject the purchase with a sold-out message
6. THE Reforge_System SHALL handle concurrent purchase attempts using optimistic locking to prevent overselling beyond pack inventory limits

### Requirement 5: Reforge Order Lifecycle Management

**User Story:** As a system operator, I want each reforge order tracked through defined states, so that I can monitor and troubleshoot the reforge pipeline.

#### Acceptance Criteria

1. THE Reforge_System SHALL track each Reforge_Order through the following states: bought, started_reforge, failed, completed
2. WHEN a user initiates the reforge process, THE Reforge_System SHALL transition the Reforge_Order from "bought" to "started_reforge"
3. WHEN the reforge process completes successfully including metadata update, THE Reforge_System SHALL transition the Reforge_Order from "started_reforge" to "completed"
4. IF any step in the reforge process fails, THEN THE Reforge_System SHALL transition the Reforge_Order to "failed" and log the failure reason
5. THE Reforge_System SHALL store the wallet address, Discord ID, selected NFT asset ID, pack ID, purchase transaction signature, and timestamp on each Reforge_Order
6. WHEN a user has multiple purchased packs, THE Reforge_System SHALL allow each pack to be used independently and mark each as "used" after reforge initiation

### Requirement 6: NFT Selection for Reforge

**User Story:** As a user, I want to select one of my NFTs from the collection to reforge, so that I can apply new traits to it.

#### Acceptance Criteria

1. WHEN a user clicks "Start Reforge", THE Reforge_UI SHALL display all NFTs from the collection currently held in the user's connected wallet
2. THE Reforge_UI SHALL display each NFT with its image and name
3. WHEN a user selects an NFT and clicks "Proceed to Reforge", THE Reforge_System SHALL lock the Reforge_Order to the selected NFT asset ID
4. WHEN a user clicks "Proceed to Reforge", THE Reforge_System SHALL reduce the pack count and mark the pack purchase as used

### Requirement 7: Random Trait Selection from Pool

**User Story:** As a user, I want the system to randomly select traits for my reforged NFT within the pack's earning range, so that I receive a fairly randomized result.

#### Acceptance Criteria

1. WHEN reforge is initiated, THE Trait_Selector SHALL select all traits from the Trait_Pool before the spinner animation begins, so that the spinner displays pre-determined results
2. THE Trait_Selector SHALL select traits such that the sum of individual LDZ earnings (excluding zero-earning traits) falls within the pack's minimum and maximum earning range (inclusive)
3. THE Trait_Selector SHALL always select exactly one trait for each Mandatory_Slot (background, skin, eyes, mouth)
4. THE Trait_Selector SHALL select traits for Optional_Slots based on availability in the Trait_Pool and earning range constraints
5. THE Trait_Selector SHALL freely include zero-earning traits in any combination without counting them toward the earning range budget
6. THE Trait_Selector SHALL use a randomized selection algorithm to vary results across reforges
7. IF the Trait_Selector cannot find a valid combination within the earning range after reasonable attempts, THEN THE Reforge_System SHALL transition the Reforge_Order to "failed" and notify the user

### Requirement 8: Combination Uniqueness Validation

**User Story:** As a system operator, I want each reforged NFT to have a unique trait combination, so that no two NFTs in the collection share identical traits.

#### Acceptance Criteria

1. WHEN the Trait_Selector produces a trait combination, THE Combination_Validator SHALL check the combination against all previously completed reforge combinations stored in the database
2. IF the combination already exists, THEN THE Trait_Selector SHALL attempt to generate a different valid combination
3. WHEN a unique combination is found, THE Combination_Validator SHALL record the combination in the database before proceeding to image composition
4. IF no unique combination can be generated after exhausting reasonable attempts, THEN THE Reforge_System SHALL transition the Reforge_Order to "failed" and notify the user

### Requirement 9: Image Composition

**User Story:** As a user, I want the system to build a properly layered NFT image from the selected traits, so that my reforged NFT looks correct.

#### Acceptance Criteria

1. WHEN a unique trait combination is confirmed, THE Image_Composer SHALL assemble the final NFT image by layering trait images according to the collection's Layer Order Management configuration
2. THE Image_Composer SHALL produce an image matching the collection's standard dimensions
3. THE Image_Composer SHALL upload the composed image to the configured storage service (Pinata/IPFS)
4. IF image composition fails, THEN THE Reforge_System SHALL transition the Reforge_Order to "failed" and log the error

### Requirement 10: On-Chain Metadata Update

**User Story:** As a user, I want my reforged NFT's metadata updated on-chain, so that the new traits are reflected in my wallet and marketplaces.

#### Acceptance Criteria

1. WHEN image composition completes successfully, THE Reforge_System SHALL build updated metadata including the new trait attributes and image URI
2. THE Reforge_System SHALL upload the updated metadata JSON to the configured storage service (Pinata/IPFS)
3. THE Reforge_System SHALL load the collection-specific Update Authority private key from the project's encrypted configuration and use it to submit the on-chain metadata update transaction via the CoreAssetUpdateService
4. WHEN the metadata update transaction is confirmed, THE Reforge_System SHALL transition the Reforge_Order to "completed"
5. IF the metadata update transaction fails, THEN THE Reforge_System SHALL retry the update up to 3 times before transitioning the Reforge_Order to "failed"

### Requirement 11: Reforge UI Animation and Progress

**User Story:** As a user, I want to see an animated loot-spinner experience during reforge, so that the process feels engaging and transparent.

#### Acceptance Criteria

1. WHEN reforge begins, THE Reforge_UI SHALL display two sections at the top: the old NFT image on the left and the progressive reforge result on the right
2. THE Reforge_UI SHALL display a loot-style spinner showing available traits for the current layer being revealed (traits are pre-selected server-side; the spinner is purely visual)
3. THE Reforge_UI SHALL run the spinner animation for 3 seconds per layer before revealing the pre-selected trait
4. WHEN a trait is revealed for a layer, THE Reforge_UI SHALL add the trait layer to the reforge preview image
5. THE Reforge_UI SHALL process layers sequentially following the collection's Layer Order Management configuration
6. THE Reforge_UI SHALL display a progress bar at the bottom showing all reforge stages from first layer through metadata update to completion
7. WHILE the metadata update is in progress, THE Reforge_UI SHALL display the message "metadata update in progress, do not refresh"
8. WHEN reforge completes, THE Reforge_UI SHALL display the final NFT in a popup with a tweet button containing pre-filled bullish text

### Requirement 12: User Profile Integration

**User Story:** As a user, I want to see my pack purchases and reforge status in my profile, so that I can manage my packs.

#### Acceptance Criteria

1. THE Reforge_System SHALL display all pack purchases for the connected wallet in the user profile page
2. WHEN a purchased pack has not yet been applied, THE Reforge_System SHALL display a "Start Reforge" button next to that pack entry
3. WHEN a pack has been used for reforge, THE Reforge_System SHALL display the reforge status (started_reforge, completed, or failed)
4. THE Reforge_System SHALL display the reforge order history including pack tier, purchase date, and completion status

### Requirement 13: Backward Compatibility

**User Story:** As a system operator, I want the reforge feature to coexist with existing trait forge functionality, so that no existing features are broken.

#### Acceptance Criteria

1. THE Reforge_System SHALL not alter the behavior of the existing individual trait forge purchase flow
2. THE Reforge_System SHALL use new database tables for pack definitions, reforge orders, and combination records
3. THE Reforge_System SHALL reuse existing services (Image_Composer, metadata update, payment validation) through their public interfaces without modifying their internal implementations
4. WHILE a trait is not marked as swap-pool-only, THE Reforge_System SHALL ensure the trait remains fully available in the existing trait marketplace
5. THE Reforge_System SHALL add new columns to existing tables (traits, projects) only as nullable additions that do not affect existing queries or functionality

### Requirement 14: Per-Project Update Authority Management

**User Story:** As an admin, I want to configure a unique Update Authority private key per project/collection, so that each collection's NFTs can be updated with the correct authority.

#### Acceptance Criteria

1. THE Pack_Manager SHALL provide a field in project settings for the admin to input the Update Authority private key for that project
2. WHEN an admin submits an Update Authority private key, THE Reforge_System SHALL encrypt the key using a server-side encryption key (from environment variable) before storing it in the database
3. THE Reforge_System SHALL store the encrypted Update Authority private key in the projects table
4. WHEN the Reforge_System needs to perform a metadata update, THE Reforge_System SHALL decrypt the project's Update Authority private key at runtime and instantiate the CoreAssetUpdateService with it
5. THE Reforge_System SHALL never expose or log the decrypted private key in API responses, client-side code, or application logs
6. IF no Update Authority private key is configured for a project, THEN THE Reforge_System SHALL fall back to the global UPDATE_AUTHORITY_PRIVATE_KEY environment variable
