import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, user_id, full_name, email } = req.body;

  if (!token || !user_id) {
    return res.status(400).json({ error: 'Missing required registration data' });
  }

  try {
    // 1. Link Validation (Token, Expiration, Usage)
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      return res.status(400).json({ error: 'Invalid, expired, or already used invitation link' });
    }

    // 2. Create Profile (Registration)
    // In production, Supabase Auth handles the user creation; we handle the profile/role.
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: user_id, full_name, created_at: new Date().toISOString() });

    if (profileError) throw profileError;

    // 3. Store Assignment & Role Creation
    // If shop_specific, assign the store. If general, just create account (no store assigned yet).
    if (invite.type === 'shop_specific' && invite.shop_id) {
      const { error: roleError } = await supabase
        .from('user_shop_roles')
        .insert([{ 
          user_id, 
          shop_id: invite.shop_id, 
          role: invite.role // e.g., 'branch_manager'
        }]);

      if (roleError) {
        // Handle constraint violations (one-store-per-branch-manager)
        if (roleError.code === '23505') {
          return res.status(400).json({ error: 'User is already assigned as a branch manager elsewhere' });
        }
        throw roleError;
      }
    }

    // 4. Mark link as used
    await supabase
      .from('invites')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invite.id);

    // 5. Audit Log
    await supabase.from('audit_logs').insert([{
      action: 'ACCEPT_INVITE',
      actor_id: user_id,
      resource_id: invite.id,
      resource_type: 'invite',
      details: { shop_id: invite.shop_id, role: invite.role }
    }]);

    return res.status(200).json({ 
      success: true, 
      shop_id: invite.shop_id,
      role: invite.role
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
