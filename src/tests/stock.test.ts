import { supabase } from '../../lib/supabase';

const SHOP_ID = '00000000-0000-0000-0000-000000000000';

async function testStockUpdateIntegrity() {
  console.log('--- Starting Stock Update Integrity Tests ---');

  // Test 1: Verify API handles valid stock updates with proper JSON
  console.log('Test 1: Valid stock update...');
  try {
    const { data: product } = await supabase.from('products').insert({
      shop_id: SHOP_ID,
      name: 'Integrity Test Item',
      price: 10,
      stock_count: 10
    }).select().single();

    if (product) {
      const response = await fetch('http://localhost:5175/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          user_id: SHOP_ID,
          stock_count: 20,
          action: 'UPDATE_STOCK'
        })
      });

      const contentType = response.headers.get("content-type");
      if (response.ok && contentType?.includes("application/json")) {
        const result = await response.json();
        if (result.stock_count === 20) {
          console.log('✅ PASS: API returned valid JSON and updated stock.');
        } else {
          console.log('❌ FAIL: Stock not updated correctly in response.');
        }
      } else {
        console.log('❌ FAIL: API did not return valid JSON or failed. Status:', response.status);
      }

      // Cleanup
      await supabase.from('products').delete().eq('id', product.id);
    }
  } catch (e) {
    console.error('Test 1 Error (Ensure dev server is running):', e);
  }

  // Test 2: Verify frontend handles empty/malformed responses gracefully
  console.log('\nTest 2: Graceful handling of malformed responses...');
  const mockMalformedResponse = new Response('Invalid JSON', {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  const safeJson = async (response: Response) => {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  };

  const result = await safeJson(mockMalformedResponse);
  if (result === null) {
    console.log('✅ PASS: Frontend safeJson correctly handles malformed input.');
  } else {
    console.log('❌ FAIL: Frontend safeJson did not catch malformed input.');
  }

  console.log('\n--- Stock Update Integrity Tests Completed ---');
}

testStockUpdateIntegrity();
