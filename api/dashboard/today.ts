import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' });
  }

  try {
    // 1. Get all shops owned by or linked to this user
    const { data: userShops, error: shopError } = await supabase
      .from('user_shop_roles')
      .select('shop_id, shops(name)')
      .eq('user_id', user_id);

    if (shopError) throw shopError;

    const shopIds = userShops.map(s => s.shop_id);
    if (shopIds.length === 0) {
      return res.status(200).json({ total_today: 0, shops: [] });
    }

    // 2. Aggregate sales for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('shop_id, total_amount, shops(name)')
      .in('shop_id', shopIds)
      .gte('created_at', today.toISOString());

    if (salesError) throw salesError;

    // 3. Process aggregation
    const shopAggregation: Record<string, { name: string, total: number }> = {};
    let grandTotal = 0;

    // Initialize with all user shops (even if 0 sales)
    userShops.forEach((us: any) => {
      shopAggregation[us.shop_id] = {
        name: us.shops?.name || 'Unknown Shop',
        total: 0
      };
    });

    salesData?.forEach((sale: any) => {
      const amount = parseFloat(sale.total_amount);
      shopAggregation[sale.shop_id].total += amount;
      grandTotal += amount;
    });

    const response = {
      total_today: grandTotal,
      shops: Object.entries(shopAggregation).map(([id, data]) => ({
        id,
        name: data.name,
        total: data.total
      }))
    };

    return res.status(200).json(response);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
