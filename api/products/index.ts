import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { method } = req;

  // --- POST: Create a new product ---
  if (method === 'POST') {
    const { shop_id, user_id, name, price, variation_name, parent_id, stock_count } = req.body;

    if (!shop_id || !name || price === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      // 1. Check for existing product (Deterministic uniqueness: name + price + variation)
      const { data: existing, error: checkError } = await supabase
        .from('products')
        .select('id')
        .eq('shop_id', shop_id)
        .eq('name', name)
        .eq('price', price)
        .eq('variation_name', variation_name || null)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ 
          error: 'Conflict: A product with this name and price already exists in this shop.',
          code: 'DUPLICATE_PRODUCT'
        });
      }

      // 2. Insert product
      const { data: product, error: insertError } = await supabase
        .from('products')
        .insert([{ 
          shop_id, 
          name, 
          price, 
          variation_name: variation_name || null, 
          parent_id: parent_id || null,
          stock_count: stock_count || 0
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // 3. Audit Log
      await supabase.from('inventory_audit').insert([{
        product_id: product.id,
        user_id: user_id || null,
        action: 'ADD',
        new_value: product
      }]);

      return res.status(201).json(product);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- PUT: Update product (Price or Stock) ---
  if (method === 'PUT') {
    const { product_id, user_id, price, stock_count, action } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: 'Missing product_id' });
    }

    if (price === undefined && stock_count === undefined) {
      return res.status(400).json({ error: 'Missing fields to update (price or stock_count)' });
    }

    try {
      // 1. Get current values for audit
      const { data: current, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', product_id)
        .single();

      if (fetchError || !current) {
        return res.status(404).json({ error: `Product not found: ${product_id}` });
      }

      const updates: any = {
        updated_at: new Date().toISOString()
      };
      const auditAction = action || (price !== undefined ? 'UPDATE_PRICE' : 'UPDATE_STOCK');
      
      if (price !== undefined) updates.price = price;
      if (stock_count !== undefined) updates.stock_count = stock_count;

      // 2. Perform update
      const { data: updated, error: updateError } = await supabase
        .from('products')
        .update(updates)
        .eq('id', product_id)
        .select()
        .single();

      if (updateError) {
        // Handle uniqueness constraint violations
        if (updateError.code === '23505') {
          return res.status(409).json({ 
            error: 'Conflict: An identical product (same name, price, and variation) already exists in this shop.',
            code: 'DUPLICATE_PRODUCT'
          });
        }
        throw updateError;
      }

      // 3. Audit Log (Don't fail the whole request if audit fails, but try-catch it)
      try {
        await supabase.from('inventory_audit').insert([{
          product_id: product_id as string,
          user_id: user_id || null,
          action: auditAction,
          old_value: current,
          new_value: updated
        }]);
      } catch (auditErr) {
        console.error('Audit log failed:', auditErr);
      }

      return res.status(200).json(updated);
    } catch (err: any) {
      console.error('Product update failed:', err);
      return res.status(500).json({ error: err.message || 'Internal server error during update' });
    }
  }

  // --- DELETE: Soft delete product ---
  if (method === 'DELETE') {
    const { product_id, user_id } = req.query;

    if (!product_id) return res.status(400).json({ error: 'Missing product_id' });

    try {
      // 1. Get current state for audit
      const { data: current, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', product_id)
        .single();

      if (fetchError || !current) return res.status(404).json({ error: 'Product not found' });

      // 2. Perform Soft Delete (set deleted_at)
      const { error: deleteError } = await supabase
        .from('products')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', product_id);

      if (deleteError) throw deleteError;

      // 3. Audit Log
      await supabase.from('inventory_audit').insert([{
        product_id: product_id as string,
        user_id: (user_id as string) || null,
        action: 'DELETE',
        old_value: current,
        new_value: { deleted_at: new Date().toISOString() }
      }]);

      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- GET: List products with pagination and search ---
  if (method === 'GET') {
    const { shop_id, search, page = 0, limit = 10 } = req.query;

    if (!shop_id) {
      return res.status(400).json({ error: 'Missing shop_id' });
    }

    try {
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('shop_id', shop_id)
        .is('deleted_at', null)
        .order('name', { ascending: true })
        .range(Number(page) * Number(limit), (Number(page) + 1) * Number(limit) - 1);

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      return res.status(200).json({
        data,
        total: count,
        page: Number(page),
        limit: Number(limit)
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
