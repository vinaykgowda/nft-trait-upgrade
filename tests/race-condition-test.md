# Race Condition Fix - Test Cases

## Test 1: Multiple Users Buy Same Trait ✅

### Setup
- Trait: "Golden Crown" (100 units available)
- Users: Alice, Bob, Charlie (3 different wallets)
- Each user has their own NFT

### Test Steps
```bash
# Concurrent requests (simulate with parallel curl or test framework)

# Alice reserves Golden Crown for her NFT
POST /api/reserve
{
  "walletAddress": "AliceWallet123",
  "assetId": "AliceNFT001",
  "traitIds": ["golden-crown-uuid"]
}
Expected: ✅ 200 OK - Reservation created

# Bob reserves Golden Crown for his NFT (at same time)
POST /api/reserve
{
  "walletAddress": "BobWallet456",
  "assetId": "BobNFT002",
  "traitIds": ["golden-crown-uuid"]
}
Expected: ✅ 200 OK - Reservation created

# Charlie reserves Golden Crown for his NFT (at same time)
POST /api/reserve
{
  "walletAddress": "CharlieWallet789",
  "assetId": "CharlieNFT003",
  "traitIds": ["golden-crown-uuid"]
}
Expected: ✅ 200 OK - Reservation created
```

### Expected Result
- ✅ All 3 reservations succeed
- ✅ Inventory: 100 → 97 (after all 3 purchase)
- ✅ No constraint violation
- ✅ No overselling

### Why It Works
Different composite keys:
- Alice: (AliceWallet123, AliceNFT001, golden-crown-uuid, reserved)
- Bob: (BobWallet456, BobNFT002, golden-crown-uuid, reserved)
- Charlie: (CharlieWallet789, CharlieNFT003, golden-crown-uuid, reserved)

All different → No conflict!

---

## Test 2: Same User, Same NFT, Same Trait (Duplicate Prevention) ⚠️

### Setup
- Trait: "Golden Crown"
- User: Alice (same wallet)
- NFT: Same NFT

### Test Steps
```bash
# Alice reserves Golden Crown
POST /api/reserve
{
  "walletAddress": "AliceWallet123",
  "assetId": "AliceNFT001",
  "traitIds": ["golden-crown-uuid"]
}
Expected: ✅ 200 OK - Reservation created (expires in 15 min)

# Alice clicks reserve again (double-click or refresh)
POST /api/reserve
{
  "walletAddress": "AliceWallet123",
  "assetId": "AliceNFT001",
  "traitIds": ["golden-crown-uuid"]
}
Expected: ✅ 200 OK - Reservation extended (expires_at updated)
```

### Expected Result
- ✅ Only 1 reservation exists in database
- ✅ Expiry time extended to 15 min from second request
- ✅ No duplicate reservation created
- ✅ Inventory only decremented once

### Why It Works
Same composite key:
- (AliceWallet123, AliceNFT001, golden-crown-uuid, reserved)

ON CONFLICT → DO UPDATE instead of INSERT

---

## Test 3: Same User, Different NFTs, Same Trait ✅

### Setup
- Trait: "Golden Crown"
- User: Alice (same wallet)
- NFTs: 2 different NFTs owned by Alice

### Test Steps
```bash
# Alice reserves Golden Crown for NFT #1
POST /api/reserve
{
  "walletAddress": "AliceWallet123",
  "assetId": "AliceNFT001",
  "traitIds": ["golden-crown-uuid"]
}
Expected: ✅ 200 OK - Reservation created

# Alice reserves Golden Crown for NFT #2
POST /api/reserve
{
  "walletAddress": "AliceWallet123",
  "assetId": "AliceNFT002",
  "traitIds": ["golden-crown-uuid"]
}
Expected: ✅ 200 OK - Reservation created
```

### Expected Result
- ✅ 2 reservations created
- ✅ Inventory: 100 → 98 (after both purchases)
- ✅ No constraint violation
- ✅ Alice can upgrade multiple NFTs with same trait

### Why It Works
Different composite keys:
- (AliceWallet123, AliceNFT001, golden-crown-uuid, reserved)
- (AliceWallet123, AliceNFT002, golden-crown-uuid, reserved)

Different asset_id → No conflict!

---

## Test 4: Race Condition on Last Unit 🔒

### Setup
- Trait: "Golden Crown" (1 unit remaining)
- Users: Alice and Bob (concurrent requests)

### Test Steps
```bash
# Simulate concurrent requests (use Promise.all or parallel curl)

# Alice tries to reserve last unit
POST /api/reserve (T0)
{
  "walletAddress": "AliceWallet123",
  "assetId": "AliceNFT001",
  "traitIds": ["golden-crown-uuid"]
}

# Bob tries to reserve last unit (at exact same time)
POST /api/reserve (T0)
{
  "walletAddress": "BobWallet456",
  "assetId": "BobNFT002",
  "traitIds": ["golden-crown-uuid"]
}
```

### Expected Result
- ✅ ONE succeeds (Alice or Bob, whoever gets lock first)
- ❌ OTHER gets: 400 "Insufficient inventory for trait: Golden Crown"
- ✅ Inventory: 1 → 0 (only one reservation created)
- ✅ NO OVERSELLING

### Why It Works
```
Time | Alice                          | Bob                            | Inventory
-----|--------------------------------|--------------------------------|----------
T0   | Lock trait row (FOR UPDATE)    | Tries to lock... WAITS         | 1
T1   | Check: 1 available             | Still waiting...               | 1
T2   | Reserve succeeds               | Still waiting...               | 0
T3   | Release lock                   | Gets lock                      | 0
T4   |                                | Check: 0 available             | 0
T5   |                                | Error: Out of stock            | 0
```

Row-level lock ensures sequential processing!

---

## Test 5: 100 Concurrent Users, 10 Units Available 🔥

### Setup
- Trait: "Golden Crown" (10 units)
- Users: 100 different users (concurrent requests)

### Test Steps
```bash
# Simulate 100 concurrent reservation requests
for i in {1..100}; do
  curl -X POST /api/reserve \
    -H "Content-Type: application/json" \
    -d "{
      \"walletAddress\": \"Wallet$i\",
      \"assetId\": \"NFT$i\",
      \"traitIds\": [\"golden-crown-uuid\"]
    }" &
done
wait
```

### Expected Result
- ✅ Exactly 10 reservations succeed
- ❌ 90 requests get "Insufficient inventory" error
- ✅ Inventory: 10 → 0
- ✅ NO OVERSELLING (not 11, not 12, exactly 0)

### Why It Works
- Row-level lock serializes inventory checks
- Each successful reservation decrements available supply
- Once supply reaches 0, all subsequent requests fail

---

## Test 6: Multi-Trait Purchase with Race Condition 🎯

### Setup
- Traits: "Golden Crown" (1 unit), "Silver Sword" (1 unit)
- Users: Alice and Bob (concurrent multi-trait purchases)

### Test Steps
```bash
# Alice tries to buy both traits
POST /api/reserve (T0)
{
  "walletAddress": "AliceWallet123",
  "assetId": "AliceNFT001",
  "traitIds": ["golden-crown-uuid", "silver-sword-uuid"]
}

# Bob tries to buy both traits (at same time)
POST /api/reserve (T0)
{
  "walletAddress": "BobWallet456",
  "assetId": "BobNFT002",
  "traitIds": ["golden-crown-uuid", "silver-sword-uuid"]
}
```

### Expected Result
- ✅ ONE succeeds (gets both traits)
- ❌ OTHER fails (gets neither trait - atomic transaction)
- ✅ Crown: 1 → 0
- ✅ Sword: 1 → 0
- ✅ No partial reservations

### Why It Works
- Transaction wraps all trait reservations
- Each trait locked sequentially
- If any trait fails, entire transaction rolls back

---

## Automated Test Script

```typescript
// tests/race-condition.test.ts
import { describe, it, expect } from '@jest/globals';

describe('Race Condition Prevention', () => {
  it('allows multiple users to buy same trait', async () => {
    const results = await Promise.all([
      reserveTrait('Alice', 'NFT1', 'TRAIT_X'),
      reserveTrait('Bob', 'NFT2', 'TRAIT_X'),
      reserveTrait('Charlie', 'NFT3', 'TRAIT_X'),
    ]);
    
    expect(results.every(r => r.success)).toBe(true);
  });

  it('prevents duplicate reservations by same user', async () => {
    const first = await reserveTrait('Alice', 'NFT1', 'TRAIT_X');
    const second = await reserveTrait('Alice', 'NFT1', 'TRAIT_X');
    
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.reservationId).toBe(second.reservationId); // Same reservation
  });

  it('prevents overselling on concurrent requests', async () => {
    // Set trait to 1 unit remaining
    await setTraitInventory('TRAIT_X', 1);
    
    const results = await Promise.all([
      reserveTrait('Alice', 'NFT1', 'TRAIT_X'),
      reserveTrait('Bob', 'NFT2', 'TRAIT_X'),
    ]);
    
    const successes = results.filter(r => r.success);
    expect(successes.length).toBe(1); // Only one succeeds
  });
});
```

---

## Manual Testing Checklist

- [ ] Test 1: Multiple users buy same trait (should succeed)
- [ ] Test 2: Same user double-clicks reserve (should extend, not duplicate)
- [ ] Test 3: Same user buys for multiple NFTs (should succeed)
- [ ] Test 4: Race condition on last unit (only one succeeds)
- [ ] Test 5: 100 concurrent users, 10 units (exactly 10 succeed)
- [ ] Test 6: Multi-trait race condition (atomic behavior)

---

## Success Criteria

✅ Multiple people CAN buy the same trait  
✅ No duplicate reservations per wallet+NFT+trait  
✅ No overselling under concurrent load  
✅ Atomic multi-trait purchases  
✅ Graceful handling of out-of-stock scenarios  
✅ Performance acceptable under load (<100ms per reservation)
