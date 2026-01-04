const { query } = require('../src/lib/database.ts');

async function debugTraitSlots() {
  try {
    console.log('🔍 Checking trait slots in database...\n');

    // Check trait_slots table
    const slotsResult = await query(`
      SELECT id, name, layer_order, created_at
      FROM trait_slots 
      ORDER BY layer_order, name
    `);

    console.log('📊 TRAIT SLOTS TABLE:');
    console.log(`Found ${slotsResult.rows.length} slots`);
    slotsResult.rows.forEach((slot, index) => {
      console.log(`${index + 1}. ${slot.name} (${slot.id})`);
      console.log(`   - Layer Order: ${slot.layer_order}`);
      console.log(`   - Created: ${slot.created_at}`);
      console.log('');
    });

    // Check what slots are actually being used by existing traits
    const usedSlotsResult = await query(`
      SELECT DISTINCT t.slot_id, ts.name as slot_name, COUNT(*) as trait_count
      FROM traits t
      LEFT JOIN trait_slots ts ON t.slot_id = ts.id
      GROUP BY t.slot_id, ts.name
      ORDER BY ts.name
    `);

    console.log('📊 SLOTS USED BY EXISTING TRAITS:');
    console.log(`Found ${usedSlotsResult.rows.length} different slots in use`);
    usedSlotsResult.rows.forEach((slot, index) => {
      console.log(`${index + 1}. ${slot.slot_name || 'UNKNOWN'} (${slot.slot_id})`);
      console.log(`   - Traits using this slot: ${slot.trait_count}`);
      console.log('');
    });

    // Show the hardcoded mapping from the API
    console.log('🔧 HARDCODED MAPPING IN API:');
    const hardcodedMapping = {
      'Background': 'f66d1416-627a-4bfe-8a5d-3955c54cd7bb',
      'Speciality': 'fec12edb-9d95-4bf2-a1af-ee71107ffbd6',
      'Fur': 'd70ef5d2-32ed-45b5-b3d6-f7332b3bc9e2',
      'Clothes': '5f718366-c5e1-4b6a-97ba-a1bb2d159c20',
      'Hand': 'beb44534-2c53-4472-bf15-0ac266f1082a',
      'Mouth': '5157637f-3808-4159-8cfc-4cb3dc6cc243',
      'Mask': 'fcd3a481-ce27-4dfb-a1f3-1598fc3f8d40',
      'Headwear': 'ad761fe9-e5fd-49c9-a627-5171898d1323',
      'Eyes': '39438a80-00e1-4328-887d-409e99684502',
      'Eyewear': 'cf7b87d3-4be8-4ef0-b1e1-bd6f05e20d01',
    };

    Object.entries(hardcodedMapping).forEach(([name, id]) => {
      const exists = slotsResult.rows.find(slot => slot.id === id);
      console.log(`${name}: ${id} ${exists ? '✅' : '❌ NOT FOUND'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugTraitSlots();