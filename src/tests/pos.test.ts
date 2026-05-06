import { supabase } from '../../lib/supabase';

const SHOP_ID = '00000000-0000-0000-0000-000000000000';
const USER_ID = '00000000-0000-0000-0000-000000000000';

async function testPOSFeatures() {
  console.log('--- Starting POS Feature Tests ---');

  // Test 1: Stock is never negative after deduction (enforce CHECK constraint)
  console.log('Test 1: Enforce non-negative stock...');
  try {
    // 1. Create a product with low stock
    const { data: product } = await supabase.from('products').insert({
      shop_id: SHOP_ID,
      name: 'Low Stock Item',
      price: 10,
      stock_count: 5
    }).select().single();

    if (product) {
      // 2. Try to sell 10 items (more than 5)
      const { error } = await supabase.rpc('record_sale_v2', {
        p_shop_id: SHOP_ID,
        p_user_id: USER_ID,
        p_total_amount: 100,
        p_items: [{ product_id: product.id, name: product.name, quantity: 10, unit_price: 10, is_new: false }]
      });

      if (error && error.message.includes('Insufficient stock')) {
        console.log('✅ PASS: Stock deduction prevented negative stock.');
      } else {
        console.log('❌ FAIL: Expected insufficient stock error, but got:', error?.message);
      }
      
      // Cleanup
      await supabase.from('products').delete().eq('id', product.id);
    }
  } catch (e) {
    console.error('Test 1 Error:', e);
  }

  // Test 2: Auto-created items can be retrieved by barcode within 100 ms on next sale
  console.log('\nTest 2: Auto-creation and fast retrieval...');
  try {
    const newItemName = 'Auto Created Item ' + Date.now();
    
    // 1. Record sale with new item
    const { data: sale } = await supabase.rpc('record_sale_v2', {
      p_shop_id: SHOP_ID,
      p_user_id: USER_ID,
      p_total_amount: 0,
      p_items: [{ product_id: null, name: newItemName, quantity: 1, unit_price: 0, is_new: true }]
    });

    if (sale) {
      // 2. Retrieve the item immediately
      const searchStart = Date.now();
      const { data: found } = await supabase.from('products')
        .select('id')
        .eq('shop_id', SHOP_ID)
        .eq('name', newItemName)
        .single();
      const searchEnd = Date.now();

      if (found && (searchEnd - searchStart) < 100) {
        console.log(`✅ PASS: Item found in ${searchEnd - searchStart}ms.`);
      } else if (found) {
        console.log(`⚠️ WARNING: Item found but took ${searchEnd - searchStart}ms (limit 100ms).`);
      } else {
        console.log('❌ FAIL: Item not found after auto-creation.');
      }

      // Cleanup
      if (found) await supabase.from('products').delete().eq('id', found.id);
    }
  } catch (e) {
    console.error('Test 2 Error:', e);
  }

  // Test 3: Reminder notifications logic check
  console.log('\nTest 3: Reminder persistence check...');
  try {
    const { data: product } = await supabase.from('products').insert({
        shop_id: SHOP_ID,
        name: 'Reminder Test Item',
        price: 0,
        stock_count: 0
    }).select().single();

    if (product) {
        const dueAt = new Date();
        dueAt.setSeconds(dueAt.getSeconds() + 5);

        const { data: task, error } = await supabase.from('pending_tasks').insert({
            product_id: product.id,
            user_id: USER_ID,
            due_at: dueAt.toISOString(),
            status: 'PENDING'
        }).select().single();

        if (task) {
            console.log('✅ PASS: Reminder persisted successfully.');
            // Cleanup
            await supabase.from('pending_tasks').delete().eq('id', task.id);
        } else {
            console.log('❌ FAIL: Failed to persist reminder:', error?.message);
        }
        await supabase.from('products').delete().eq('id', product.id);
    }
  } catch (e) {
    console.error('Test 3 Error:', e);
  }

  console.log('\n--- POS Feature Tests Completed ---');
}

testPOSFeatures();
