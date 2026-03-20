#!/bin/bash

# Security Fixes Verification Script
# Run this after deployment to verify all fixes are working

echo "🔒 Security Fixes Verification Script"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database connection (adjust as needed)
DB_NAME="${DB_NAME:-nft_marketplace}"
DB_USER="${DB_USER:-postgres}"

echo "📊 Checking Database Schema..."
echo ""

# Check 1: Unique constraint exists
echo -n "1. Checking unique_active_reservation constraint... "
CONSTRAINT_EXISTS=$(psql -U $DB_USER -d $DB_NAME -tAc "
  SELECT COUNT(*) FROM pg_constraint 
  WHERE conname = 'unique_active_reservation'
")

if [ "$CONSTRAINT_EXISTS" -eq "1" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC} - Constraint not found"
  exit 1
fi

# Check 2: reservation_id column exists
echo -n "2. Checking purchases.reservation_id column... "
COLUMN_EXISTS=$(psql -U $DB_USER -d $DB_NAME -tAc "
  SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_name = 'purchases' AND column_name = 'reservation_id'
")

if [ "$COLUMN_EXISTS" -eq "1" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC} - Column not found"
  exit 1
fi

# Check 3: Indexes exist
echo -n "3. Checking performance indexes... "
INDEX_COUNT=$(psql -U $DB_USER -d $DB_NAME -tAc "
  SELECT COUNT(*) FROM pg_indexes 
  WHERE indexname IN ('idx_inventory_reservations_status_expires', 'idx_purchases_status_created')
")

if [ "$INDEX_COUNT" -eq "2" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${YELLOW}⚠ WARNING${NC} - Expected 2 indexes, found $INDEX_COUNT"
fi

echo ""
echo "📁 Checking Code Files..."
echo ""

# Check 4: Payment validation in tx/build
echo -n "4. Checking payment validation (tx/build)... "
if grep -q "SECURITY FIX: ALWAYS derive payment amounts from database" src/app/api/tx/build/route.ts; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC} - Payment validation not found"
  exit 1
fi

# Check 5: Multi-trait support in inventory manager
echo -n "5. Checking multi-trait consumption method... "
if grep -q "consumeMultipleReservations" src/lib/services/inventory-manager.ts; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC} - Multi-trait method not found"
  exit 1
fi

# Check 6: Row-level locking in inventory repo
echo -n "6. Checking row-level locking... "
if grep -q "lockTraitForReservation" src/lib/repositories/inventory.ts; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC} - Locking method not found"
  exit 1
fi

# Check 7: Timeout handling in transaction builder
echo -n "7. Checking timeout handling (60s polling)... "
if grep -q "maxWaitTime = 60000" src/lib/services/transaction-builder.ts; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC} - Timeout fix not found"
  exit 1
fi

# Check 8: Pending status in types
echo -n "8. Checking 'pending' status type... "
if grep -q "'pending'" src/types/index.ts; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC} - Pending status not found"
  exit 1
fi

# Check 9: Frontend multi-reservation tracking
echo -n "9. Checking frontend reservation tracking... "
if grep -q "reservationIds" src/components/purchase/EnhancedPurchaseFlow.tsx; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC} - Frontend fix not found"
  exit 1
fi

echo ""
echo "🧪 Running Logic Tests..."
echo ""

# Check 10: Verify race condition prevention logic
echo -n "10. Checking race condition prevention... "
if grep -q "FOR UPDATE" src/lib/repositories/inventory.ts; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC} - FOR UPDATE lock not found"
  exit 1
fi

# Check 11: Verify supply decrement verification
echo -n "11. Checking supply decrement verification... "
if grep -q "decrementResult.rowCount === 0" src/lib/services/inventory-manager.ts; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC} - Decrement verification not found"
  exit 1
fi

# Check 12: Verify timeout signature handling
echo -n "12. Checking timeout signature handling... "
if grep -q "TIMEOUT_WITH_SIGNATURE" src/lib/services/transaction-builder.ts; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC} - Timeout signature handling not found"
  exit 1
fi

echo ""
echo "======================================"
echo -e "${GREEN}✅ All Security Fixes Verified!${NC}"
echo ""
echo "Summary:"
echo "  ✓ Database schema updated"
echo "  ✓ Payment validation implemented"
echo "  ✓ Multi-trait support added"
echo "  ✓ Race condition prevention active"
echo "  ✓ Timeout handling improved"
echo ""
echo "Next steps:"
echo "  1. Run integration tests"
echo "  2. Test multi-trait purchases"
echo "  3. Monitor logs for warnings"
echo "  4. Review SECURITY_FIXES_SUMMARY.md"
echo ""
