import React, { useState, useEffect } from 'react';
import { isMock } from '../../lib/supabase';
import { Receipt } from './Receipt';

type SaleItem = {
  product_name: string;
  quantity: number;
  price: number;
  total: number;
};

type Sale = {
  id: string;
  total_amount: number;
  created_at: string;
  recorded_by: string;
  payment_method: string;
  receipt_number: string;
  custom_name?: string;
  unique_filename?: string;
  items: SaleItem[];
  shops?: {
    name: string;
    address: string;
    contact_details: string;
  };
  profiles?: {
    full_name: string;
  };
};

export const SalesHistory: React.FC<{ shopId: string }> = ({ shopId }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const SHOP_ID = shopId;

  useEffect(() => {
    fetchSales();
  }, [dateFilter, SHOP_ID]);

  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = sales.filter(s => 
      (s.recorded_by || '').toLowerCase().includes(query) || 
      (s.receipt_number || '').toLowerCase().includes(query) ||
      (s.custom_name || '').toLowerCase().includes(query) ||
      (s.id || '').toLowerCase().includes(query)
    );
    setFilteredSales(filtered);
  }, [searchQuery, sales]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      if (isMock) {
        const localSales = JSON.parse(localStorage.getItem(`invo_sales_${SHOP_ID}`) || '[]');
        let filtered = localSales;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === 'today') {
          filtered = localSales.filter((s: any) => new Date(s.created_at) >= today);
        } else if (dateFilter === '7days') {
          const last7 = new Date();
          last7.setDate(today.getDate() - 7);
          filtered = localSales.filter((s: any) => new Date(s.created_at) >= last7);
        } else if (dateFilter === '30days') {
          const last30 = new Date();
          last30.setDate(today.getDate() - 30);
          filtered = localSales.filter((s: any) => new Date(s.created_at) >= last30);
        }
        
        setSales(filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/sales?shop_id=${SHOP_ID}&date=${dateFilter}`);
      const data = await response.json();
      if (response.ok) {
        setSales(data);
      } else {
        throw new Error('API failed');
      }
    } catch (error) {
      console.error('Failed to fetch sales', error);
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Transaction History</h1>
          <p style={{ color: 'var(--text-secondary)' }}>View and manage past sales records for this location.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', backgroundColor: 'var(--bg-surface)', padding: '0.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          {[
            { id: 'today', label: 'Today' },
            { id: '7days', label: '7 Days' },
            { id: '30days', label: '30 Days' },
            { id: 'all', label: 'All Time' }
          ].map(opt => (
            <button 
              key={opt.id}
              onClick={() => setDateFilter(opt.id)}
              className={dateFilter === opt.id ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', boxShadow: dateFilter === opt.id ? 'var(--shadow-sm)' : 'none' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <input 
          type="text" 
          placeholder="Search by receipt #, customer name, or cashier..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', fontSize: '1rem' }}
        />
        <span style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>🔍</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Receipt Info</th>
                <th style={{ padding: '1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Date & Time</th>
                <th style={{ padding: '1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Method</th>
                <th style={{ padding: '1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', textAlign: 'right' }}>Total Amount</th>
                <th style={{ padding: '1.25rem', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading history...</td></tr>
              ) : filteredSales.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found for this period.</td></tr>
              ) : (
                filteredSales.map(sale => (
                  <tr key={sale.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition-fast)' }} className="hover-bg">
                    <td style={{ padding: '1.25rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sale.receipt_number}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sale.custom_name || 'Quick Sale'}</div>
                    </td>
                    <td style={{ padding: '1.25rem' }}>
                      <div style={{ fontSize: '0.875rem' }}>{new Date(sale.created_at).toLocaleDateString()}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td style={{ padding: '1.25rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px', 
                        fontSize: '0.625rem', 
                        fontWeight: 800, 
                        textTransform: 'uppercase',
                        backgroundColor: sale.payment_method === 'cash' ? '#fef3c7' : sale.payment_method === 'card' ? '#dbeafe' : '#dcfce7',
                        color: sale.payment_method === 'cash' ? '#92400e' : sale.payment_method === 'card' ? '#1e40af' : '#166534'
                      }}>
                        {sale.payment_method}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--primary)' }}>₵{sale.total_amount.toFixed(2)}</div>
                    </td>
                    <td style={{ padding: '1.25rem', textAlign: 'center' }}>
                      <button 
                        onClick={() => { setSelectedSale(sale); setShowReceipt(true); }}
                        className="btn-secondary" 
                        style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}
                      >
                        View Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showReceipt && selectedSale && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(12px)', padding: '2rem' }}>
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-xl)', backgroundColor: 'white', position: 'relative' }}>
             <button 
                onClick={() => setShowReceipt(false)} 
                style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10, background: 'var(--bg-main)', border: 'none', width: '2.5rem', height: '2.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
              >✕</button>
             <Receipt 
                sale={selectedSale} 
                items={selectedSale.items.map(i => ({ name: i.product_name, quantity: i.quantity, price: i.price })) as any} 
                onSave={() => setShowReceipt(false)} 
             />
          </div>
        </div>
      )}
    </div>
  );
};
