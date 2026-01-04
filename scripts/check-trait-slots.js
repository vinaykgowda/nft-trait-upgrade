const { Pool } = require('pg');

async function checkTraitSlots() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Checking trait slots in database...\n');

    // Check trait_slots table
    const slotsResult = await pool.query(`
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
    const usedSlotsResult = await pool.query(`
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

    // Check the specific slot ID from the error
    const errorSlotId = 'f66d1416-627a-4bfe-8a5d-3955c54cd7bb';
    const errorSlotResult = await pool.query(`
      SELECT * FROM trait_slots WHERE id = $1
    `, [errorSlotId]);

    console.log(`🔍 CHECKING ERROR SLOT ID: ${errorSlotId}`);
    if (errorSlotResult.rows.length > 0) {
      console.log('✅ Slot exists:', errorSlotResult.rows[0]);
    } else {
      console.log('❌ Slot does NOT exist in trait_slots table');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkTraitSlots();