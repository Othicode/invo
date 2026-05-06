import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // ONLY FOR TESTING - SEED DATA
  const SHOP_ID = '00000000-0000-0000-0000-000000000000';
  const USER_ID = '00000000-0000-0000-0000-000000000000';

  try {
    // 1. Create a dummy profile if it doesn't exist
    await supabase.from('profiles').upsert({ id: USER_ID, full_name: 'Test Admin' });

    // 2. Create a dummy shop
    await supabase.from('shops').upsert({ id: SHOP_ID, owner_id: USER_ID, name: 'Main Shop' });

    // 3. Create role
    await supabase.from('user_shop_roles').upsert({ user_id: USER_ID, shop_id: SHOP_ID, role: 'owner' });

    // 4. Create 3 products
    const products = [
      { shop_id: SHOP_ID, name: 'Sachet Water', price: 0.50 },
      { shop_id: SHOP_ID, name: 'Gari (1kg)', price: 15.00 },
      { shop_id: SHOP_ID, name: 'Sugar (500g)', price: 10.00 },
    ];

    const { data, error } = await supabase.from('products').upsert(products, { onConflict: 'name,shop_id' });

    if (error) throw error;

    return res.status(200).json({ message: 'Seed successful', products: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
