import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { sale_id } = req.query;

  if (!sale_id) {
    return res.status(400).json({ error: 'Missing sale_id' });
  }

  try {
    // 1. Fetch sale items to restore stock
    const { data: items, error: itemsError } = await supabase
      .from('sale_items')
      .select('product_id, quantity')
      .eq('sale_id', sale_id);

    if (itemsError) throw itemsError;

    // 2. Restore stock for each item (Transactional ideally, but here using a loop for simplicity in Vercel)
    for (const item of items) {
      if (item.product_id) {
        await supabase.rpc('increment_stock', {
          p_product_id: item.product_id,
          p_quantity: item.quantity
        });
      }
    }

    // 3. Delete the sale (will cascade to sale_items)
    const { error: deleteError } = await supabase
      .from('sales')
      .delete()
      .eq('id', sale_id);

    if (deleteError) throw deleteError;

    // 4. Audit Log
    await supabase.from('audit_logs').insert([{
      action: 'ROLLBACK_SALE',
      resource_id: sale_id as string,
      resource_type: 'sale',
      details: { items }
    }]);

    return res.status(200).json({ success: true, message: 'Sale rolled back and stock restored.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
