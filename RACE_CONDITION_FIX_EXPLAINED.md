# Race Condition Fix - Detailed Explanation

## The Question: Won't this block multiple people from buying the same trait?

**Short Answer**: NO! Multiple people CAN buy the same trait. The constraint only prevents ONE person from creating duplicate reservations.

---

## Understanding the Unique Constraint

### The Constraint
```sql
CONSTRAINT unique_active_reservation 
UNIQUE (wallet_address, asset_id, trait_id, status)
```

### What This Means

The constraint is a **composite key** of 4 fields:
1. `wallet_address` - The buyer's wallet
2. `asset_id` - The NFT being upgraded
3. `trait_id` - The trait being purchased
4. `status` - The reservation status ('reserved', 'consumed', etc.)

**A reservation is only considered "duplicate" if ALL 4 fields match.**

---

## Scenarios Explained

### ✅ Scenario 1: Multiple People Buy Same Trait (ALLOWED)

```
User A: wallet_address = "ABC123", asset_id = "NFT001", trait_id = "TRAIT_X", status = "reserved"
User B: wallet_address = "XYZ789", asset_id = "NFT002", trait_id = "TRAIT_X", status = "reserved"
User C: wallet_address = "DEF456", asset_id = "NFT003", trait_id = "TRAIT_X", status = "reserved"
```

**Result**: ✅ ALL THREE SUCCEED
- Different `wallet_address` → Different composite key
- Different `asset_id` → Different composite key
- All three can reserve and buy the same trait

**Visual**:
```
Trait X Inventory: 100 units

User A reserves → 99 remaining
User B reserves → 98 remaining  ✅ ALLOWED
User C reserves → 97 remaining  ✅ ALLOWED

All three can complete their purchases!
```

---

### ❌ Scenario 2: Same Person, Same NFT, Same Trait (BLOCKED)

```
User A (1st attempt): wallet_address = "ABC123", asset_id = "NFT001", trait_id = "TRAIT_X", status = "reserved"
User A (2nd attempt): wallet_address = "ABC123", asset_id = "NFT001", trait_id = "TRAIT_X", status = "reserved"
```

**Result**: ❌ SECOND ATTEMPT BLOCKED (but gracefully handled with upsert)
- Same `wallet_address` → Same
- Same `asset_id` → Same
- Same `trait_id` → Same
- Same `status` → Same
- **All 4 match → Duplicate!**

**What Happens**: The `ON CONFLICT` clause updates the expiry time instead of failing:
```sql
ON CONFLICT (wallet_address, asset_id, trait_id, status) 
DO UPDATE SET expires_at = EXCLUDED.expires_at
```

**Visual**:
```
User A clicks "Reserve" → Creates reservation (expires in 15 min)
User A clicks "Reserve" again → Extends expiry to 15 min from now
                                 (No duplicate created)
```

---

### ✅ Scenario 3: Same Person, Different NFTs, Same Trait (ALLOWED)

```
User A (NFT #1): wallet_address = "ABC123", asset_id = "NFT001", trait_id = "TRAIT_X", status = "reserved"
User A (NFT #2): wallet_address = "ABC123", asset_id = "NFT002", trait_id = "TRAIT_X", status = "reserved"
```

**Result**: ✅ BOTH SUCCEED
- Same `wallet_address` → Same
- Different `asset_id` → **DIFFERENT!**
- Composite key is different → Not a duplicate

**Visual**:
```
User A owns 2 NFTs and wants to upgrade both with the same trait

NFT #1 reservation → ✅ Success
NFT #2 reservation → ✅ Success (different asset_id)

User A can buy the same trait for multiple NFTs!
```

---

## How Race Conditions Are Prevented

### The Problem (Before Fix)
```
Time | User A                          | User B                          | Inventory
-----|----------------------------------|----------------------------------|----------
T0   | Check: 1 unit available         | Check: 1 unit available         | 1
T1   | Reserve succeeds                | Reserve succeeds                | -1 (OVERSOLD!)
```

### The Solution (After Fix)
```
Time | User A                          | User B                          | Inventory
-----|----------------------------------|----------------------------------|----------
T0   | Lock trait row (FOR UPDATE)     | Tries to lock... WAITS          | 1
T1   | Check: 1 unit available         | Still waiting...                | 1
T2   | Reserve succeeds                | Still waiting...                | 0
T3   | Release lock                    | Gets lock                       | 0
T4   |                                 | Check: 0 available              | 0
T5   |                                 | Error: "Out of stock"           | 0
```

**Key**: The `FOR UPDATE` lock on the trait row ensures only ONE reservation check happens at a time per trait.

---

## Real-World Example

### Trait: "Golden Crown" (10 units available)

**10 Different Users Try to Buy Simultaneously**:
```
User 1: wallet=W1, nft=N1, trait=CROWN → ✅ Reserve (9 left)
User 2: wallet=W2, nft=N2, trait=CROWN → ✅ Reserve (8 left)
User 3: wallet=W3, nft=N3, trait=CROWN → ✅ Reserve (7 left)
User 4: wallet=W4, nft=N4, trait=CROWN → ✅ Reserve (6 left)
User 5: wallet=W5, nft=N5, trait=CROWN → ✅ Reserve (5 left)
User 6: wallet=W6, nft=N6, trait=CROWN → ✅ Reserve (4 left)
User 7: wallet=W7, nft=N7, trait=CROWN → ✅ Reserve (3 left)
User 8: wallet=W8, nft=N8, trait=CROWN → ✅ Reserve (2 left)
User 9: wallet=W9, nft=N9, trait=CROWN → ✅ Reserve (1 left)
User 10: wallet=W10, nft=N10, trait=CROWN → ✅ Reserve (0 left)
User 11: wallet=W11, nft=N11, trait=CROWN → ❌ Out of stock
```

**Result**: Exactly 10 reservations created, no overselling!

---

## What the Constraint DOES Prevent

### Duplicate Reservations by Same User
```
User A tries to reserve the same trait for the same NFT twice
→ ❌ Blocked (or upserted to extend expiry)
```

### Accidental Double-Clicks
```
User clicks "Add to Cart" twice rapidly
→ Only one reservation created (prevents duplicate charges)
```

### Malicious Attempts
```
Attacker tries to reserve all inventory with same wallet+NFT
→ Can only create one reservation per trait
```

---

## What the Constraint DOES NOT Prevent

### Multiple People Buying Same Trait
```
100 different users can all buy the same trait
→ ✅ Allowed (different wallets/NFTs)
```

### Same Person Buying for Multiple NFTs
```
User owns 5 NFTs, wants same trait for all
→ ✅ Allowed (different asset_ids)
```

### Popular Traits Selling Out
```
Trait has 10 units, 100 people want it
→ First 10 get it, rest get "out of stock" error
→ This is CORRECT behavior!
```

---

## Summary

| Scenario | Wallet | NFT | Trait | Allowed? | Why? |
|----------|--------|-----|-------|----------|------|
| User A buys Trait X for NFT #1 | A | 1 | X | ✅ Yes | First reservation |
| User B buys Trait X for NFT #2 | B | 2 | X | ✅ Yes | Different wallet+NFT |
| User A buys Trait X for NFT #1 again | A | 1 | X | ⚠️ Upsert | Extends expiry |
| User A buys Trait X for NFT #3 | A | 3 | X | ✅ Yes | Different NFT |
| User A buys Trait Y for NFT #1 | A | 1 | Y | ✅ Yes | Different trait |

**Bottom Line**: The constraint is **per wallet+NFT+trait combination**. Multiple people can absolutely buy the same trait - they just need different wallets or different NFTs (which they will have!).

---

## Code Reference

### Constraint Definition
```sql
-- database/schema.sql
CONSTRAINT unique_active_reservation 
UNIQUE (wallet_address, asset_id, trait_id, status)
```

### Upsert Logic
```typescript
// src/lib/repositories/inventory.ts
INSERT INTO inventory_reservations (trait_id, wallet_address, asset_id, expires_at, status)
VALUES ($1, $2, $3, $4, 'reserved')
ON CONFLICT (wallet_address, asset_id, trait_id, status) 
DO UPDATE SET expires_at = EXCLUDED.expires_at
RETURNING *
```

### Row-Level Locking
```typescript
// src/lib/repositories/inventory.ts
async lockTraitForReservation(traitId: string, client: PoolClient): Promise<void> {
  await client.query(
    `SELECT id FROM traits WHERE id = $1 FOR UPDATE`,
    [traitId]
  );
}
```

The lock is on the **trait row**, not the reservation. This prevents concurrent inventory checks, but doesn't block different users from reserving the same trait.
