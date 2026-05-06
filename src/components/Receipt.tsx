import React, { useState } from 'react';

type ReceiptProps = {
  sale: any;
  items: any[];
  onSave: (customName: string) => void;
};

export const Receipt: React.FC<ReceiptProps> = ({ sale, items, onSave }) => {
  const [customName, setCustomName] = useState('');

  return (
    <div className="card animate-fade-in" style={{ 
      backgroundColor: 'var(--bg-surface-elevated)', 
      padding: '2.5rem', 
      boxShadow: 'var(--shadow-xl)', 
      color: 'var(--text-primary)', 
      fontFamily: '"Courier New", Courier, monospace',
      maxWidth: '450px',
      margin: '0 auto',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'var(--font-sans)', color: 'var(--primary)' }}>{sale.shops?.name || 'Retail Receipt'}</h2>
        <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)' }}>{sale.shops?.address || 'Main Street, Branch 1'}</p>
        <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)' }}>{sale.shops?.contact_details || '000-000-0000'}</p>
      </div>

      <div style={{ borderTop: '1px dashed var(--border-color)', borderBottom: '1px dashed var(--border-color)', padding: '1rem 0', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span>Receipt #:</span>
          <span style={{ fontWeight: 600 }}>{sale.receipt_number}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span>Date:</span>
          <span style={{ fontWeight: 600 }}>{new Date(sale.created_at).toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Cashier:</span>
          <span style={{ fontWeight: 600 }}>{sale.profiles?.full_name || 'Staff'}</span>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
          <span>Item</span>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <span>Qty</span>
            <span>Total</span>
          </div>
        </div>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
            <div style={{ display: 'flex', gap: '2.5rem' }}>
              <span>{item.quantity}</span>
              <span style={{ fontWeight: 600 }}>₵{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '2px solid var(--text-muted)', paddingTop: '1rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--font-sans)', color: 'var(--primary)' }}>
          <span>TOTAL</span>
          <span>₵{sale.total_amount.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
          <span>Payment Method:</span>
          <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{sale.payment_method}</span>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '0.75rem', fontStyle: 'italic' }}>
        Thank you for your business!
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', fontFamily: 'var(--font-sans)' }}>
        <input 
          type="text" 
          placeholder="Enter Customer Name (Optional)" 
          value={customName} 
          onChange={(e) => setCustomName(e.target.value)}
          style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', width: '100%', border: '1px solid var(--border-color)' }}
        />
        <div style={{ display: 'flex', gap: '0.75rem' }}>
           <button onClick={() => onSave(customName)} className="btn-primary" style={{ flex: 1 }}>Save Transaction</button>
           <button onClick={() => window.print()} className="btn-secondary" style={{ flex: 1 }}>Print</button>
        </div>
      </div>
    </div>
  );
};
