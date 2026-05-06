import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shop_id, query } = req.query;

  if (!shop_id || !query) {
    return res.status(400).json({ error: 'Missing shop_id or query' });
  }

  try {
    // 1. Fuzzy search using pg_trgm and similarity
    // We select products where the name is similar to the query
    // and they are master products (parent_id is null)
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, price, currency, variation_name, parent_id')
      .eq('shop_id', shop_id)
      .is('parent_id', null)
      .is('deleted_at', null)
      .ilike('name', `%${query}%`)
      .limit(10);

    if (error) throw error;

    // 2. Exact match check
    const exactMatch = products?.find(p => p.name.toLowerCase() === (query as string).toLowerCase());

    return res.status(200).json({
      results: products || [],
      exact_match: !!exactMatch,
      exact_match_id: exactMatch?.id || null
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
