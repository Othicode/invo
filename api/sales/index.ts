import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { method } = req;

  // --- POST: Record a Sale ---
  if (method === 'POST') {
    const { shop_id, user_id, items, total_amount, payment_method } = req.body;

    if (!shop_id || !items || !total_amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      // 1. Validate Access
      const { data: role, error: roleError } = await supabase
        .from('user_shop_roles')
        .select('role')
        .eq('shop_id', shop_id)
        .eq('user_id', user_id)
        .single();

      if (roleError || !role) {
        return res.status(403).json({ error: 'Unauthorized: User does not belong to this shop' });
      }

      // 2. Execute transactional sale recording via RPC
      const { data: sale_id, error: rpcError } = await supabase.rpc('record_sale_v4', {
        p_shop_id: shop_id,
        p_user_id: user_id,
        p_total_amount: total_amount,
        p_payment_method: payment_method || 'cash',
        p_items: items
      });

      if (rpcError) {
        return res.status(500).json({ error: rpcError.message });
      }

      // 3. Fetch full sale details for receipt (including receipt_number)
      const { data: saleData } = await supabase
        .from('sales')
        .select('*, profiles(full_name), shops(name, address, contact_details)')
        .eq('id', sale_id)
        .single();

      // 4. Fetch newly created product IDs if any
      const newItemIds: Record<string, string> = {};
      const newItems = items.filter((item: any) => item.is_new);
      if (newItems.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, name')
          .eq('shop_id', shop_id)
          .in('name', newItems.map((item: any) => item.name))
          .order('created_at', { ascending: false });

        if (products) {
          products.forEach(p => {
            if (!newItemIds[p.name]) newItemIds[p.name] = p.id;
          });
        }
      }

      return res.status(201).json({ 
        success: true, 
        sale: saleData, 
        new_item_ids: newItemIds 
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- GET: Fetch Sales History ---
  if (method === 'GET') {
    const { shop_id, date, user_id } = req.query;

    if (!shop_id) {
      return res.status(400).json({ error: 'Missing shop_id' });
    }

    try {
      // 1. Enforce Access
      if (user_id) {
        const { data: role, error: roleError } = await supabase
          .from('user_shop_roles')
          .select('role')
          .eq('shop_id', shop_id)
          .eq('user_id', user_id as string)
          .single();

        if (roleError || !role) {
          return res.status(403).json({ error: 'Unauthorized' });
        }
      }

      // 2. Build Query
      let query = supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          created_at,
          payment_method,
          receipt_number,
          profiles (full_name),
          sale_items (
            quantity,
            unit_price,
            total_price,
            products (name)
          )
        `)
        .eq('shop_id', shop_id)
        .order('created_at', { ascending: false });

      // Handle "today" filter
      if (date === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte('created_at', today.toISOString());
      }

      const { data: sales, error: salesError } = await query;

      if (salesError) {
        return res.status(500).json({ error: salesError.message });
      }

      // 3. Format response for cleaner frontend consumption
      const formattedSales = (sales || []).map((sale: any) => ({
        id: sale.id,
        total_amount: sale.total_amount,
        created_at: sale.created_at,
        payment_method: sale.payment_method,
        receipt_number: sale.receipt_number,
        recorded_by: sale.profiles?.full_name || 'Unknown',
        items: sale.sale_items.map((item: any) => ({
          product_name: item.products?.name || 'Deleted Product',
          quantity: item.quantity,
          price: item.unit_price,
          total: item.total_price
        }))
      }));

      return res.status(200).json(formattedSales);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- PUT: Update Sale (Rename) ---
  if (method === 'PUT') {
    const { sale_id, custom_name } = req.body;

    if (!sale_id || !custom_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const { data, error } = await supabase
        .from('sales')
        .update({ custom_name })
        .eq('id', sale_id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
