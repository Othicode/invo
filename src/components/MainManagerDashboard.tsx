import React, { useState, useEffect } from 'react';
import { supabase, isMock } from '../../lib/supabase';

type Manager = {
  full_name: string;
};

type Shop = {
  id: string;
  name: string;
  address: string;
  business_type: string;
  user_shop_roles: {
    role: string;
    profiles: Manager;
  }[];
};

export const MainManagerDashboard: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  // Mock user_id (Main Manager)
  const USER_ID = '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    setLoading(true);
    if (isMock) {
      const localShops = JSON.parse(localStorage.getItem('invo_shops') || '[]');
      setShops(localShops.map((s: any) => ({
        ...s,
        user_shop_roles: []
      })));
      setLoading(false);
      return;
    }
    try {
      // Fetch shops with their assigned branch managers
      const { data, error } = await supabase
        .from('shops')
        .select(`
          id, name, address, business_type,
          user_shop_roles (
            role,
            profiles (full_name)
          )
        `)
        .eq('owner_id', USER_ID);

      if (error) throw error;
      
      const formattedShops = (data || []).map((shop: any) => ({
        ...shop,
        user_shop_roles: (shop.user_shop_roles || []).map((role: any) => ({
          ...role,
          profiles: Array.isArray(role.profiles) ? role.profiles[0] : role.profiles
        }))
      }));

      setShops(formattedShops as Shop[]);
    } catch (err) {
      console.error(err);
      setShops([]);
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async (type: 'shop_specific' | 'general') => {
    try {
      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: type === 'shop_specific' ? selectedShopId : null,
          role: 'branch_manager',
          type,
          created_by: USER_ID
        }),
      });
      const result = await response.json();
      if (response.ok) {
        alert(`Token Generated: ${result.token}\nLink: ${result.link}`);
      } else {
        alert(result.error);
      }
    } catch (err) {
      alert('Failed to generate invite');
    }
    setIsModalOpen(false);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Loading stores...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ margin: 0 }}>Owner Overview</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Central management for all your registered shop locations.</p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
        {shops.map(shop => (
          <div key={shop.id} className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{shop.name}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{shop.business_type || 'Retail Store'}</p>
              </div>
              <button 
                onClick={() => { setSelectedShopId(shop.id); setIsModalOpen(true); }}
                className="btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}
              >
                Generate Invite
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <span>📍</span>
              <span>{shop.address || 'Address not set'}</span>
            </div>
            
            <div style={{ marginTop: 'auto', backgroundColor: 'var(--bg-main)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Assigned Managers</div>
              {shop.user_shop_roles.filter(r => r.role === 'branch_manager').map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>
                    {r.profiles.full_name.charAt(0)}
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{r.profiles.full_name}</span>
                </div>
              ))}
              {shop.user_shop_roles.filter(r => r.role === 'branch_manager').length === 0 && (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No managers assigned yet.</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Invite Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--bg-glass)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', backgroundColor: 'var(--bg-surface-elevated)' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Generate Invite Link</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Choose the type of invitation for your branch manager.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button 
                onClick={() => generateInvite('shop_specific')}
                className="btn-primary"
                style={{ padding: '1rem' }}
              >
                Specific Shop Invite
              </button>
              <button 
                onClick={() => generateInvite('general')}
                className="btn-secondary"
                style={{ padding: '1rem' }}
              >
                General Organization Invite
              </button>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: '1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
