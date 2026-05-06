import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shop_id, role, type, created_by } = req.body;

  if (!created_by || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Rate Limiting (Max 5 links per day per store if shop_specific)
    if (type === 'shop_specific' && shop_id) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count, error: countError } = await supabase
        .from('invites')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shop_id)
        .gte('created_at', today.toISOString());

      if (countError) throw countError;
      if (count && count >= 5) {
        return res.status(429).json({ error: 'Rate limit exceeded: Max 5 links per day per store' });
      }
    }

    // 2. Validate Access (Only owners can generate links)
    if (shop_id) {
      const { data: userRole, error: roleError } = await supabase
        .from('user_shop_roles')
        .select('role')
        .eq('shop_id', shop_id)
        .eq('user_id', created_by)
        .single();

      if (roleError || userRole?.role !== 'owner') {
        return res.status(403).json({ error: 'Unauthorized: Only owners can create shop-specific invites' });
      }
    }

    // 3. Secure Token Generation (Cryptographic)
    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 7); // Expires in 7 days

    // 4. Store Invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .insert([{ 
        shop_id: type === 'shop_specific' ? shop_id : null, 
        target_shop_id: type === 'shop_specific' ? shop_id : null,
        role: role || 'branch_manager', 
        token, 
        type,
        created_by,
        expires_at: expires_at.toISOString()
      }])
      .select()
      .single();

    if (inviteError) throw inviteError;

    // 5. Audit Log
    await supabase.from('audit_logs').insert([{
      action: 'GENERATE_INVITE',
      actor_id: created_by,
      resource_id: invite.id,
      resource_type: 'invite',
      details: { shop_id, type, role }
    }]);

    const baseUrl = process.env.VITE_APP_URL || 'https://localhost:5173';
    return res.status(201).json({ 
      token: invite.token,
      link: `${baseUrl}/register?token=${invite.token}` 
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
