import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { method } = req;

  if (method === 'POST') {
    const { product_id, user_id, due_at, status } = req.body;

    if (!product_id || !user_id || !due_at) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const { data, error } = await supabase
        .from('pending_tasks')
        .insert([{ product_id, user_id, due_at, status: status || 'PENDING' }])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (method === 'GET') {
    const { user_id } = req.query;

    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    try {
      const { data, error } = await supabase
        .from('pending_tasks')
        .select('*, products(name)')
        .eq('user_id', user_id)
        .eq('status', 'PENDING')
        .lte('due_at', new Date().toISOString());

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (method === 'PUT') {
    const { task_id, status } = req.body;

    if (!task_id || !status) return res.status(400).json({ error: 'Missing task_id or status' });

    try {
      const { data, error } = await supabase
        .from('pending_tasks')
        .update({ status })
        .eq('id', task_id)
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
