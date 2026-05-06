import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { method } = req;
  const { user_id, shop_id } = req.query;

  if (method === 'GET') {
    if (!user_id || !shop_id) return res.status(400).json({ error: 'Missing user_id or shop_id' });

    try {
      const { data, error } = await supabase
        .from('checkout_notifications')
        .select('*')
        .eq('user_id', user_id)
        .eq('shop_id', shop_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (method === 'PUT') {
    const { notification_id, is_read } = req.body;
    if (!notification_id) return res.status(400).json({ error: 'Missing notification_id' });

    try {
      const { data, error } = await supabase
        .from('checkout_notifications')
        .update({ is_read })
        .eq('id', notification_id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (method === 'DELETE') {
    const { notification_id } = req.query;
    if (!notification_id) return res.status(400).json({ error: 'Missing notification_id' });

    try {
      const { error } = await supabase
        .from('checkout_notifications')
        .delete()
        .eq('id', notification_id as string);

      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
