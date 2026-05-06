import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { method } = req;

  // --- POST: Create a new shop ---
  if (method === 'POST') {
    const { name, location, owner_id } = req.body;

    if (!name || !owner_id) {
      return res.status(400).json({ error: 'Missing shop name or owner_id' });
    }

    try {
      // 1. Create the shop
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .insert([{ name, location, owner_id }])
        .select()
        .single();

      if (shopError) throw shopError;

      // 2. Assign the creator as 'owner' in user_shop_roles
      const { error: roleError } = await supabase
        .from('user_shop_roles')
        .insert([{ user_id: owner_id, shop_id: shop.id, role: 'owner' }]);

      if (roleError) throw roleError;

      return res.status(201).json(shop);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- GET: List shops for a user ---
  if (method === 'GET') {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    try {
      const { data: shops, error } = await supabase
        .from('user_shop_roles')
        .select(`
          role,
          shops (
            id,
            name,
            location
          )
        `)
        .eq('user_id', user_id);

      if (error) throw error;

      const formattedShops = (shops || []).map((s: any) => ({
        id: s.shops.id,
        name: s.shops.name,
        location: s.shops.location,
        role: s.role
      }));

      return res.status(200).json(formattedShops);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
