import React, { useState, useEffect } from 'react';
import { isMock } from '../../lib/supabase';

type Shop = {
  id: string;
  name: string;
  address: string;
  contact_details: string;
};

export const ShopManagement: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newShop, setNewShop] = useState({ name: '', address: '', contact: '' });

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    setLoading(true);
    try {
      if (isMock) {
        const localShops = JSON.parse(localStorage.getItem('invo_shops') || '[]');
        setShops(localShops);
        setLoading(false);
        return;
      }

      const response = await fetch('/api/shops');
      const data = await response.json();
      if (response.ok) {
        setShops(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMock) {
      const shop: Shop = {
        id: crypto.randomUUID(),
        name: newShop.name,
        address: newShop.address,
        contact_details: newShop.contact
      };
      const localShops = JSON.parse(localStorage.getItem('invo_shops') || '[]');
      localStorage.setItem('invo_shops', JSON.stringify([...localShops, shop]));
      setShops([...localShops, shop]);
      setIsAdding(false);
      setNewShop({ name: '', address: '', contact: '' });
      return;
    }

    try {
      const response = await fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newShop.name,
          address: newShop.address,
          contact_details: newShop.contact
        })
      });
      if (response.ok) {
        fetchShops();
        setIsAdding(false);
        setNewShop({ name: '', address: '', contact: '' });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Shop Management</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Configure and monitor your retail locations.</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="btn-primary">
          + Register New Shop
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {loading ? (
          <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading locations...</div>
        ) : shops.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem' }}>
             <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏗️</div>
             <h3>No shops registered</h3>
             <p style={{ color: 'var(--text-muted)' }}>Get started by registering your first physical location.</p>
          </div>
        ) : (
          shops.map(shop => (
            <div key={shop.id} className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                 <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🏪</div>
                 <div>
                    <h3 style={{ margin: 0 }}>{shop.name}</h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700 }}>● Active Location</div>
                 </div>
              </div>
              
              <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem' }}>
                 <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <span style={{ opacity: 0.5 }}>📍</span>
                    <span>{shop.address || 'No address provided'}</span>
                 </div>
                 <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <span style={{ opacity: 0.5 }}>📞</span>
                    <span>{shop.contact_details || 'No contact info'}</span>
                 </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                 <button className="btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}>Edit Details</button>
                 <button className="btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}>View Analytics</button>
              </div>
            </div>
          ))
        )}
      </div>

      {isAdding && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--bg-glass)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '450px', backgroundColor: 'var(--bg-surface-elevated)' }}>
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary)' }}>Register Shop</h2>
            <form onSubmit={handleAddShop} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Shop Name</label>
                <input 
                  type="text" 
                  value={newShop.name} 
                  onChange={(e) => setNewShop({ ...newShop, name: e.target.value })} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  placeholder="e.g. Downtown Branch"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Address</label>
                <input 
                  type="text" 
                  value={newShop.address} 
                  onChange={(e) => setNewShop({ ...newShop, address: e.target.value })} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  placeholder="Physical location"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Contact Details</label>
                <input 
                  type="text" 
                  value={newShop.contact} 
                  onChange={(e) => setNewShop({ ...newShop, contact: e.target.value })} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  placeholder="Phone or email"
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsAdding(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }}>Register Location</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
