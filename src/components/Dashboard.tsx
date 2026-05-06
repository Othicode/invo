import React, { useState, useEffect } from 'react';

type ShopSale = {
  id: string;
  name: string;
  total: number;
};

type DashboardData = {
  total_today: number;
  shops: ShopSale[];
};

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock user_id for now
  const USER_ID = '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard/today?user_id=${USER_ID}`);
      const result = await response.json();
      if (response.ok) {
        setData(result);
      } else {
        throw new Error('API failed');
      }
    } catch (error) {
      // Local testing aggregation logic
      const localShops = JSON.parse(localStorage.getItem('invo_shops') || '[]');
      const shopSales: ShopSale[] = localShops.map((shop: any) => {
        const sales = JSON.parse(localStorage.getItem(`invo_sales_${shop.id}`) || '[]');
        const today = new Date().toDateString();
        const total = sales
          .filter((s: any) => new Date(s.created_at).toDateString() === today)
          .reduce((sum: number, s: any) => sum + s.total_amount, 0);
        
        return { id: shop.id, name: shop.name, total };
      });

      const grandTotal = shopSales.reduce((sum, s) => sum + s.total, 0);
      
      setData({
        total_today: grandTotal,
        shops: shopSales
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: '2rem' }}>
        <div className="card" style={{ height: '200px', opacity: 0.5 }}></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div className="card" style={{ height: '150px', opacity: 0.3 }}></div>
          <div className="card" style={{ height: '150px', opacity: 0.3 }}></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', letterSpacing: '-0.04em' }}>Business Analytics</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Real-time performance overview across all locations.</p>
        </div>
        <button onClick={fetchDashboardData} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔄</span> Refresh Data
        </button>
      </div>

      {/* Grand Total Hero Section */}
      <div className="card glass-panel" style={{ 
        background: 'linear-gradient(135deg, var(--primary), #4f46e5)',
        color: 'white',
        border: 'none',
        padding: '3rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Abstract background elements */}
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', filter: 'blur(40px)' }}></div>
        <div style={{ position: 'absolute', bottom: '-20%', left: '-5%', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', filter: 'blur(30px)' }}></div>
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.875rem', fontWeight: 600, opacity: 0.8, marginBottom: '1rem' }}>Total Sales Today</p>
          <h2 style={{ fontSize: '4rem', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.05em' }}>₵{data?.total_today.toFixed(2)}</h2>
          <div style={{ marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.15)', borderRadius: '2rem', fontSize: '0.875rem' }}>
            <span style={{ color: '#4ade80' }}>↑ 12.5%</span> from yesterday
          </div>
        </div>
      </div>

      {/* Per Shop Breakdown Grid */}
      <div>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Location Breakdown</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {data?.shops.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏪</div>
              <p>No active shop locations found.</p>
            </div>
          ) : (
            data?.shops.map(shop => (
              <div key={shop.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.125rem' }}>{shop.name}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Daily Revenue</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>₵{shop.total.toFixed(2)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Active</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
