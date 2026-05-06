import React, { useState, useEffect } from 'react';
import { supabase, isMock } from '../../lib/supabase';

type Shop = {
  id: string;
  name: string;
  address: string;
  business_type: string;
  contact_details: string;
};

export const BranchManagerDashboard: React.FC = () => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock user_id (Branch Manager)
  const USER_ID = '11111111-1111-1111-1111-111111111111';

  useEffect(() => {
    fetchAssignedShop();
  }, []);

  const fetchAssignedShop = async () => {
    setLoading(true);
    if (isMock) {
      const localShops = JSON.parse(localStorage.getItem('invo_shops') || '[]');
      if (localShops.length > 0) {
        setShop(localShops[0]);
      }
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_shop_roles')
        .select(`
          shops (
            id, name, address, business_type, contact_details
          )
        `)
        .eq('user_id', USER_ID)
        .eq('role', 'branch_manager')
        .single();

      if (error) throw error;
      setShop(data?.shops as any || null);
    } catch (err) {
      console.error(err);
      setShop(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Loading your store...</div>;
  
  if (!shop) return (
    <div className="card" style={{ maxWidth: '500px', margin: '4rem auto', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
      <h3>Access Restricted</h3>
      <p style={{ color: 'var(--text-secondary)' }}>No store has been assigned to your account yet. Please contact your administrator.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ margin: 0 }}>Branch Manager Console</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Welcome back! Here is the overview for your assigned location.</p>
      </div>

      <div className="card glass-panel animate-fade-in" style={{ padding: '3rem', borderTop: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ color: 'var(--primary)', margin: 0, fontSize: '2rem' }}>{shop.name}</h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 700, marginTop: '0.75rem' }}>
              <span>●</span> Authorized Access
            </div>
          </div>
          <div style={{ width: '4rem', height: '4rem', borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🏬</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Location Address</span>
            <span style={{ fontWeight: 500 }}>{shop.address || 'Not specified'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Business Category</span>
            <span style={{ fontWeight: 500 }}>{shop.business_type || 'Retail'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Contact Point</span>
            <span style={{ fontWeight: 500 }}>{shop.contact_details || 'No contact info'}</span>
          </div>
        </div>
        
        <div style={{ backgroundColor: 'var(--bg-main)', padding: '2rem', borderRadius: 'var(--radius-xl)', textAlign: 'center', border: '1px solid var(--border-color)' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>You have full management access to this location's inventory and sales operations.</p>
          <button className="btn-primary" style={{ width: '100%', maxWidth: '300px', padding: '1rem' }}>
            Launch Sales Engine
          </button>
        </div>
      </div>
    </div>
  );
};
