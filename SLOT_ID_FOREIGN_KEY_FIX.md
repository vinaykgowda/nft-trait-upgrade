# Slot ID Foreign Key Constraint Fix

## Problem
The trait update API was failing with a foreign key constraint violation:
```
insert or update on table "traits" violates foreign key constraint "traits_slot_id_fkey"
Key (slot_id)=(e8b87a54-a282-4caa-a26b-c706813e357b) is not present in table "trait_slots".
```

## Root Cause
Multiple files contained hardcoded slot ID mappings that referenced non-existent slot IDs in the database. The mappings were using outdated or incorrect UUIDs that didn't match the actual `trait_slots` table.

### Incorrect Mappings (Before Fix):
```typescript
const categoryToSlotId: Record<string, string> = {
  'Background': 'f66d1416-627a-4bfe-8a5d-3955c54cd7bb', // ✅ This one was correct
  'Body': 'e8b87a54-a282-4caa-a26b-c706813e357b',        // ❌ Doesn't exist
  'Eyes': 'fcaad105-aafb-4cb2-bb2d-3bf1c8579ad2',        // ❌ Doesn't exist
  'Mouth': 'f60bdd19-e3c1-4698-a77b-22a14e2234c7',       // ❌ Doesn't exist
  'Hat': '402c12c6-be5a-4f97-bcf5-089fbd4ca1d5',         // ❌ Doesn't exist
  'Clothes': 'e8b87a54-a282-4caa-a26b-c706813e357b',     // ❌ Doesn't exist
};
```

### Actual Database Slot IDs:
```
f66d1416-627a-4bfe-8a5d-3955c54cd7bb | Background
fec12edb-9d95-4bf2-a1af-ee71107ffbd6 | Speciality
d70ef5d2-32ed-45b5-b3d6-f7332b3bc9e2 | Fur
5f718366-c5e1-4b6a-97ba-a1bb2d159c20 | Clothes
beb44534-2c53-4472-bf15-0ac266f1082a | Hand
5157637f-3808-4159-8cfc-4cb3dc6cc243 | Mouth
fcd3a481-ce27-4dfb-a1f3-1598fc3f8d40 | Mask
ad761fe9-e5fd-49c9-a627-5171898d1323 | Headwear
39438a80-00e1-4328-887d-409e99684502 | Eyes
cf7b87d3-4be8-4ef0-b1e1-bd6f05e20d01 | Eyewear
```

## Solution

### Files Fixed:

1. **`src/app/api/admin/traits/[id]/route.ts`** - Trait update API
2. **`src/app/api/admin/traits/route.ts`** - Trait creation API  
3. **`src/app/admin/traits-manager/page.tsx`** - Admin traits manager frontend

### Updated Mappings:
```typescript
const categoryToSlotId: Record<string, string> = {
  'Background': 'f66d1416-627a-4bfe-8a5d-3955c54cd7bb', // Background
  'Speciality': 'fec12edb-9d95-4bf2-a1af-ee71107ffbd6', // Speciality
  'Fur': 'd70ef5d2-32ed-45b5-b3d6-f7332b3bc9e2',        // Fur
  'Clothes': '5f718366-c5e1-4b6a-97ba-a1bb2d159c20',     // Clothes
  'Hand': 'beb44534-2c53-4472-bf15-0ac266f1082a',        // Hand
  'Mouth': '5157637f-3808-4159-8cfc-4cb3dc6cc243',       // Mouth
  'Mask': 'fcd3a481-ce27-4dfb-a1f3-1598fc3f8d40',        // Mask
  'Headwear': 'ad761fe9-e5fd-49c9-a627-5171898d1323',    // Headwear
  'Eyes': '39438a80-00e1-4328-887d-409e99684502',        // Eyes
  'Eyewear': 'cf7b87d3-4be8-4ef0-b1e1-bd6f05e20d01',     // Eyewear
  // Legacy mappings for backward compatibility
  'Body': 'd70ef5d2-32ed-45b5-b3d6-f7332b3bc9e2',        // Map to Fur
  'Hat': 'ad761fe9-e5fd-49c9-a627-5171898d1323',         // Map to Headwear
};
```

### Key Improvements:
- ✅ All slot IDs now reference actual database records
- ✅ Added legacy mappings for backward compatibility
- ✅ Updated fallback categories in admin interface
- ✅ Changed default fallback from non-existent 'Body' to 'Fur'

## Verification
- ✅ All referenced slot IDs exist in database
- ✅ TypeScript compilation successful
- ✅ Server running without errors
- ✅ Foreign key constraints will now be satisfied

## Impact
This fix resolves the foreign key constraint violations that were preventing trait updates and creations. The trait management system should now work correctly with proper slot ID references.