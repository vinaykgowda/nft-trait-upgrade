# Implementation Plan

- [x] 1. Set up project structure and core dependencies
  - Initialize Next.js 14 project with TypeScript and Tailwind CSS
  - Install Solana wallet adapter, Metaplex Core SDK, and database dependencies
  - Configure Vercel deployment settings with Node.js runtime for signing functions
  - Set up PostgreSQL database schema and connection pooling
  - _Requirements: 1.1, 4.1, 8.1_

- [x] 1.1 Set up testing framework and initial test structure
  - Configure Jest with fast-check for property-based testing
  - Create test directory structure for unit, property, and integration tests
  - Set up test database with automated cleanup
  - _Requirements: All (testing foundation)_

- [x] 2. Implement database models and core data layer
  - Create PostgreSQL schema with all required tables (projects, traits, users, purchases, etc.)
  - Implement database connection utilities with connection pooling
  - Create TypeScript interfaces for all data models
  - Build repository pattern for data access with CRUD operations
  - _Requirements: 4.2, 5.1, 6.2, 9.1_

- [x] 2.1 Write property test for inventory management
  - **Property 7: Inventory Protection**
  - **Validates: Requirements 5.4, 9.1, 9.4**

- [x] 2.2 Write property test for reservation expiration
  - **Property 6: Reservation Expiration Management**
  - **Validates: Requirements 9.2**

- [x] 2.3 Write unit tests for database models and repositories
  - Create unit tests for all repository CRUD operations
  - Test database constraint enforcement and error handling
  - _Requirements: 4.2, 5.1, 6.2, 9.1_

- [x] 3. Build admin authentication and authorization system
  - Implement Argon2id password hashing and session management
  - Create TOTP-based MFA system for sensitive operations
  - Build rate limiting and account lockout protection
  - Implement CSRF protection for admin operations
  - _Requirements: 4.1, 10.1, 10.2, 10.3, 10.4_

- [x] 3.1 Write property test for MFA requirements
  - **Property 10: MFA Requirement for Sensitive Operations**
  - **Validates: Requirements 4.1, 4.4, 6.1, 10.2**

- [x] 3.2 Write property test for audit trail completeness
  - **Property 11: Audit Trail Completeness**
  - **Validates: Requirements 4.4, 5.5, 6.1, 6.5**

- [x] 3.3 Write unit tests for authentication flows
  - Test login, logout, and session management
  - Test MFA verification and rate limiting
  - _Requirements: 4.1, 10.1, 10.2, 10.3_

- [x] 4. Create admin dashboard and project management
  - Build admin login interface with MFA support
  - Implement project settings management (branding, collections, treasury)
  - Create trait management interface (upload, pricing, inventory)
  - Build analytics dashboard with revenue and performance metrics
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 7.1, 7.2_

- [x] 4.1 Write unit tests for admin dashboard functionality
  - Test project settings CRUD operations
  - Test trait management workflows
  - _Requirements: 4.2, 4.3, 4.5, 5.1, 5.2, 5.3_

- [-] 5. Implement trait catalog and gift management
  - Create trait browsing API with filtering by slot, rarity, and price
  - Build gift balance management system
  - Implement trait activation/deactivation controls
  - Create bulk upload tools for trait management
  - _Requirements: 2.1, 5.4, 5.5, 6.1, 6.2, 6.4_

- [x] 5.1 Write property test for trait organization
  - **Property 2: Trait Organization Consistency**
  - **Validates: Requirements 2.1**

- [ ] 5.2 Write property test for gift balance redemption
  - **Property 8: Gift Balance Redemption**
  - **Validates: Requirements 6.3**

- [x] 6. Build wallet connection and NFT gallery
  - Integrate Solana wallet adapter with multi-wallet support
  - Create NFT fetching service that filters by collection IDs
  - Build NFT gallery component with collection filtering
  - Implement wallet connection state management
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 6.1 Write property test for collection-filtered NFT ownership
  - **Property 1: Collection-Filtered NFT Ownership**
  - **Validates: Requirements 1.2, 1.3**

- [x] 6.2 Write property test for ownership verification
  - **Property 9: Ownership Verification**
  - **Validates: Requirements 1.4, 8.5**

- [x] 6.3 Write unit tests for wallet integration
  - Test wallet connection and disconnection flows
  - Test NFT fetching and filtering logic
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 7. Create trait preview and rule validation system
  - Build client-side image composition using HTML5 Canvas
  - Implement trait layer ordering based on slot configuration
  - Create rule validation engine for trait combinations
  - Build real-time preview updates with conflict highlighting
  - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [x] 7.1 Write property test for layer order preservation
  - **Property 3: Layer Order Preservation**
  - **Validates: Requirements 2.2**

- [x] 7.2 Write property test for rule validation enforcement
  - **Property 4: Rule Validation Enforcement**
  - **Validates: Requirements 2.3**

- [x] 7.3 Write unit tests for preview rendering
  - Test image composition and layer ordering
  - Test rule validation and conflict detection
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 8. Implement inventory reservation system
  - Create time-limited reservation system with TTL
  - Build reservation cleanup for expired entries
  - Implement concurrent request handling with database constraints
  - Create reservation status tracking and management
  - _Requirements: 3.1, 9.1, 9.2, 9.3, 9.5_

- [x] 8.1 Write property test for duplicate purchase prevention
  - **Property 14: Duplicate Purchase Prevention**
  - **Validates: Requirements 9.3**

- [x] 8.2 Write unit tests for reservation system
  - Test reservation creation and expiration
  - Test concurrent reservation handling
  - _Requirements: 3.1, 9.1, 9.2, 9.5_

- [x] 9. Build atomic transaction system
  - Create transaction builder service for payment + Core update
  - Implement server-side delegate signing
  - Build transaction verification and confirmation polling
  - Create transaction status tracking and error handling
  - _Requirements: 3.2, 3.3, 8.1, 8.2, 8.3, 8.4_

- [x] 9.1 Write property test for atomic transaction composition
  - **Property 5: Atomic Transaction Composition**
  - **Validates: Requirements 3.2, 8.2, 8.4**

- [x] 9.2 Write unit tests for transaction building
  - Test transaction composition and signing
  - Test error handling for transaction failures
  - _Requirements: 3.2, 3.3, 8.1, 8.2, 8.3_

- [-] 10. Create image composition and metadata service
  - Build server-side image composition with trait layering
  - Implement Irys upload service for images and metadata
  - Create metadata JSON builder with proper URI references
  - Build Core asset update service with new metadata URIs
  - _Requirements: 3.4, 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 10.1 Write property test for image layer composition
  - **Property 12: Image Layer Composition**
  - **Validates: Requirements 11.1**

- [ ] 10.2 Write property test for metadata URI updates
  - **Property 13: Metadata URI Updates**
  - **Validates: Requirements 11.4**

- [ ] 10.3 Write unit tests for image and metadata services
  - Test image composition and Irys uploads
  - Test metadata building and Core asset updates
  - _Requirements: 3.4, 11.1, 11.2, 11.3, 11.4_

- [x] 11. Implement purchase flow API endpoints
  - Create trait reservation API endpoint
  - Build transaction building API with partial signing
  - Implement transaction confirmation and processing API
  - Create purchase status tracking and success handling
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 11.1 Write integration tests for purchase flow
  - Test complete purchase workflow from reservation to confirmation
  - Test error handling and recovery scenarios
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 12. Build error handling and monitoring system
  - Implement structured logging with request IDs
  - Create error categorization and storage system
  - Build performance monitoring for RPC and Irys operations
  - Create admin dashboard for system health and failure review
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 12.1 Write property test for error categorization
  - **Property 15: Error Categorization**
  - **Validates: Requirements 12.1, 12.4**

- [x] 12.2 Write unit tests for monitoring and logging
  - Test error categorization and storage
  - Test performance metric tracking
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 13. Create public frontend interface
  - Build trait browsing interface (visible before wallet connection)
  - Create NFT selection and preview interface
  - Implement purchase flow UI with success confirmation
  - Build responsive design with loading states and error handling
  - _Requirements: 2.1, 2.4, 2.5, 3.5_

- [x] 13.1 Write unit tests for frontend components
  - Test trait browsing and filtering
  - Test purchase flow UI interactions
  - _Requirements: 2.1, 2.4, 2.5, 3.5_

- [x] 14. Integrate all systems and create API routes
  - Wire together all backend services through API routes
  - Implement proper error handling and response formatting
  - Create API documentation and validation
  - Set up CORS and security headers
  - _Requirements: All backend integration_

- [x] 15. Final testing and deployment preparation
  - Run comprehensive test suite (unit, property, integration)
  - Configure Vercel deployment with sensitive environment variables
  - Set up database migrations and production configuration
  - Create deployment verification and rollback procedures
  - _Requirements: All (deployment readiness)_

- [ ] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.