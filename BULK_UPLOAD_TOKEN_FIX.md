# Bulk Upload Token UUID Fix

## Problem
The bulk upload API was failing with the error:
```
invalid input syntax for type uuid: "sol-default"
```

This occurred because the API was trying to use `"sol-default"` as a UUID in database queries, but the database expects actual UUID values.

## Root Cause
1. The bulk upload API was using a hardcoded UUID `550e8400-e29b-41d4-a716-446655440000` for SOL token
2. The actual SOL token in the database has ID `f3020eb2-582e-45f0-a5d0-7df47c87b79b`
3. The `"sol-default"` string was being passed directly to database queries expecting UUIDs

## Solution

### 1. Fixed ProjectTokensService
Updated `getDefaultSOLToken()` method to use the actual SOL token ID from database:
```typescript
// Before: hardcoded UUID
id: '550e8400-e29b-41d4-a716-446655440000'

// After: actual database UUID  
id: 'f3020eb2-582e-45f0-a5d0-7df47c87b79b'
```

### 2. Fixed Bulk Upload API Token Resolution
Updated the token resolution logic in `src/app/api/admin/traits/bulk/route.ts`:

- **sol-default handling**: Now queries database for actual SOL token ID instead of creating new token
- **Error handling**: Throws clear error if SOL token not found instead of trying to create duplicate
- **Price handling**: Converts string prices to numbers for the DECIMAL(20,9) database column

### 3. Database Verification
Confirmed the database state:
- ✅ SOL token exists: `f3020eb2-582e-45f0-a5d0-7df47c87b79b`
- ✅ LDZ token exists: `12ad488f-83e6-48e8-8181-66dcfc27b5c5`
- ✅ Rarity tiers available with expected UUIDs
- ✅ Trait slots configured properly
- ✅ Price amounts stored as DECIMAL(20,9) not BIGINT

## Testing
The fix has been validated by:
1. Database queries confirming token IDs and structure
2. TypeScript compilation without errors
3. Server running without runtime errors
4. Token resolution logic tested with actual database values

## Next Steps
The bulk upload API should now correctly:
1. Resolve `"sol-default"` to the actual SOL token UUID
2. Handle decimal price amounts properly
3. Create traits without UUID syntax errors

Test the bulk upload functionality with a sample payload to confirm the fix works end-to-end.