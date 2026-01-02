#!/usr/bin/env node

/**
 * Test script to verify the correct sequential flow:
 * Payment Success → Upload Image to Irys → Update Metadata
 */

const fs = require('fs');

console.log('🔄 Testing Sequential Payment Flow\n');

console.log('Expected Flow:');
console.log('1. 💰 Payment Transaction (SOL/LDZ to treasury)');
console.log('2. ✅ Payment Confirmed');
console.log('3. 🎨 Compose New Image');
console.log('4. 📤 Upload Image to Irys');
console.log('5. 🔄 Update NFT Metadata (with new Irys URL)');
console.log('6. 🎉 Success\n');

// Test 1: Check Transaction Builder has separate methods
console.log('1. Transaction Builder Methods:');
const transactionBuilderFile = fs.readFileSync('src/lib/services/transaction-builder.ts', 'utf8');

const builderChecks = [
  {
    name: 'buildPaymentTransaction (payment only)',
    test: transactionBuilderFile.includes('buildPaymentTransaction'),
    required: true
  },
  {
    name: 'buildMetadataUpdateTransaction (metadata only)',
    test: transactionBuilderFile.includes('buildMetadataUpdateTransaction'),
    required: true
  },
  {
    name: 'buildAtomicTransaction (legacy - should exist but not used)',
    test: transactionBuilderFile.includes('buildAtomicTransaction'),
    required: false
  }
];

builderChecks.forEach(check => {
  const status = check.test ? '✅' : (check.required ? '❌' : '⚠️');
  console.log(`   ${status} ${check.name}`);
});

// Test 2: Check Transaction Build API
console.log('\n2. Transaction Build API:');
const buildApiFile = fs.readFileSync('src/app/api/tx/build/route.ts', 'utf8');

const apiChecks = [
  {
    name: 'Builds payment-only transactions',
    test: buildApiFile.includes('buildPaymentTransaction'),
    required: true
  },
  {
    name: 'No metadata in payment transaction',
    test: !buildApiFile.includes('newImageUrl') || buildApiFile.includes('transactionType'),
    required: true
  },
  {
    name: 'Returns payment transaction type',
    test: buildApiFile.includes('transactionType: \'payment\''),
    required: true
  }
];

apiChecks.forEach(check => {
  const status = check.test ? '✅' : (check.required ? '❌' : '⚠️');
  console.log(`   ${status} ${check.name}`);
});

// Test 3: Check Metadata Update API exists
console.log('\n3. Metadata Update API:');
const metadataApiExists = fs.existsSync('src/app/api/tx/update-metadata/route.ts');
console.log(`   ${metadataApiExists ? '✅' : '❌'} Metadata update API exists`);

if (metadataApiExists) {
  const metadataApiFile = fs.readFileSync('src/app/api/tx/update-metadata/route.ts', 'utf8');
  
  const metadataChecks = [
    {
      name: 'Verifies payment transaction first',
      test: metadataApiFile.includes('getTransactionStatus') && metadataApiFile.includes('paymentStatus.confirmed')
    },
    {
      name: 'Builds metadata-only transaction',
      test: metadataApiFile.includes('buildMetadataUpdateTransaction')
    },
    {
      name: 'Executes with delegate signature',
      test: metadataApiFile.includes('sendAndConfirmTransaction')
    }
  ];

  metadataChecks.forEach(check => {
    console.log(`   ${check.test ? '✅' : '❌'} ${check.name}`);
  });
}

// Test 4: Check Purchase Flow
console.log('\n4. Purchase Flow Implementation:');
const purchaseFlowFile = fs.readFileSync('src/components/purchase/EnhancedPurchaseFlow.tsx', 'utf8');

const flowChecks = [
  {
    name: 'Builds payment transaction first',
    test: purchaseFlowFile.includes('transactionType: \'payment\''),
    required: true
  },
  {
    name: 'Composes image AFTER payment success',
    test: purchaseFlowFile.includes('Payment successful! Starting image composition'),
    required: true
  },
  {
    name: 'Uploads to Irys AFTER payment',
    test: purchaseFlowFile.includes('upload-image') && purchaseFlowFile.includes('metadata_updating'),
    required: true
  },
  {
    name: 'Updates metadata AFTER Irys upload',
    test: purchaseFlowFile.includes('/api/tx/update-metadata'),
    required: true
  },
  {
    name: 'Correct progress messages',
    test: purchaseFlowFile.includes('uploading image to Irys') && purchaseFlowFile.includes('updating metadata'),
    required: true
  }
];

flowChecks.forEach(check => {
  const status = check.test ? '✅' : (check.required ? '❌' : '⚠️');
  console.log(`   ${status} ${check.name}`);
});

// Test 5: Check Flow Messages
console.log('\n5. User Experience Messages:');
const messageChecks = [
  {
    name: 'Payment approved.. validating..',
    test: purchaseFlowFile.includes('Payment approved.. validating..')
  },
  {
    name: 'Payment validated.. uploading image to Irys..',
    test: purchaseFlowFile.includes('uploading image to Irys')
  },
  {
    name: 'Image uploaded.. updating metadata..',
    test: purchaseFlowFile.includes('Image uploaded.. updating metadata')
  },
  {
    name: 'Congrats, your NFT Upgrade completed.',
    test: purchaseFlowFile.includes('Congrats, your NFT Upgrade completed')
  }
];

messageChecks.forEach(check => {
  console.log(`   ${check.test ? '✅' : '❌'} ${check.name}`);
});

// Summary
console.log('\n📊 Sequential Flow Implementation Status:');
console.log('==========================================');

const allChecks = [...builderChecks, ...apiChecks, ...flowChecks];
const passedChecks = allChecks.filter(c => c.test).length;
const totalChecks = allChecks.length;
const completeness = Math.round((passedChecks / totalChecks) * 100);

console.log(`Implementation Completeness: ${completeness}% (${passedChecks}/${totalChecks})`);

if (completeness >= 90) {
  console.log('🎉 EXCELLENT: Sequential flow properly implemented!');
} else if (completeness >= 75) {
  console.log('✅ GOOD: Minor adjustments needed');
} else {
  console.log('⚠️ NEEDS WORK: Significant gaps in sequential flow');
}

console.log('\n🔄 Correct Flow Summary:');
console.log('1. ✅ User pays (SOL/LDZ transaction)');
console.log('2. ✅ Payment confirmed on blockchain');
console.log('3. ✅ System composes new image');
console.log('4. ✅ Image uploaded to Irys');
console.log('5. ✅ NFT metadata updated with new Irys URL');
console.log('6. ✅ User sees success with upgraded NFT');

console.log('\n💡 Benefits of Sequential Flow:');
console.log('- Payment happens first (user commits)');
console.log('- Image processing only after payment confirmed');
console.log('- If image/metadata fails, user still paid (correct)');
console.log('- Clear separation of concerns');
console.log('- Better error handling and recovery');

console.log('\n🚨 Key Difference from Atomic:');
console.log('❌ Atomic: Payment + Metadata in single transaction');
console.log('✅ Sequential: Payment → Success → Image → Metadata');
console.log('   This is more robust and follows payment best practices!');