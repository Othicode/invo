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
    // Also include shops where this user is the owner (parent/main manager)
    // AND any child shops (branches) of those owned shops
    const { data: ownedShops, error: ownedError } = await supabase
      .from('shops')
      .select('id, name')
      .eq('owner_id', user_id);

    if (ownedError) throw ownedError;

    const ownedShopIds = ownedShops.map(s => s.id);
    
    // Fetch child shops (branches)
    let branchShopIds: string[] = [];
    if (ownedShopIds.length > 0) {
      const { data: branches, error: branchError } = await supabase
        .from('shops')
        .select('id, name')
        .in('parent_shop_id', ownedShopIds);
      
      if (!branchError && branches) {
        branchShopIds = branches.map(b => b.id);
      }
    }

    // Also get shops where user has an explicit role (e.g. branch_manager)
    const { data: roleShops, error: roleError } = await supabase
      .from('user_shop_roles')
      .select('shop_id, shops(name)')
      .eq('user_id', user_id);

    if (roleError) throw roleError;

    // Combine all relevant shop IDs (Owned + Branches + Assigned Roles)
    const allShopIds = Array.from(new Set([
      ...ownedShopIds,
      ...branchShopIds,
      ...roleShops.map(s => s.shop_id)
    ]));

    if (allShopIds.length === 0) {
      return res.status(200).json({ total_today: 0, shops: [] });
    }

    // 2. Aggregate sales for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('shop_id, total_amount, shops(name)')
      .in('shop_id', allShopIds)
      .gte('created_at', today.toISOString());

    if (salesError) throw salesError;

    // 3. Process aggregation
    const shopAggregation: Record<string, { name: string, total: number }> = {};
    let grandTotal = 0;

    // Initialize with names (this is a bit tricky with multiple sources)
    // We'll use a map for ID -> Name
    const idToName: Record<string, string> = {};
    ownedShops.forEach(s => idToName[s.id] = s.name);
    roleShops.forEach(s => idToName[s.shop_id] = s.shops?.name || 'Assigned Store');
    
    // Fetch names for branches if not already in owned/role
    const missingNames = branchShopIds.filter(id => !idToName[id]);
    if (missingNames.length > 0) {
      const { data: bNames } = await supabase.from('shops').select('id, name').in('id', missingNames);
      bNames?.forEach(s => idToName[s.id] = s.name);
    }

    allShopIds.forEach(id => {
      shopAggregation[id] = { name: idToName[id] || 'Unknown Store', total: 0 };
    });

    salesData?.forEach((sale: any) => {
      const amount = parseFloat(sale.total_amount);
      if (shopAggregation[sale.shop_id]) {
        shopAggregation[sale.shop_id].total += amount;
        grandTotal += amount;
      }
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
