import React, { useState, useEffect } from 'react';
import { isMock, supabase } from '../../lib/supabase';
import { useAudioNotification } from '../hooks/useAudioNotification';

type Product = {
  id: string;
  name: string;
  price: number;
  stock_count: number;
  updated_at: string;
};

export const InventoryPage: React.FC<{ shopId: string; userId: string }> = ({ shopId, userId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '' });
  const [updateStatus, setUpdateStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { playNotification } = useAudioNotification();

  const SHOP_ID = shopId;
  const USER_ID = userId;

  useEffect(() => {
    fetchInventory();

    // Handle prefill from URL
    const params = new URLSearchParams(window.location.search);
    const prefillName = params.get('prefill_name');
    if (prefillName) {
      setNewProduct(prev => ({ ...prev, name: prefillName }));
      setIsAdding(true);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (isMock) return;

    // Subscribe to Realtime delta
    const channel = supabase
      .channel('inventory_delta')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setProducts(prev => [payload.new as Product, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setProducts(prev => prev.map(p => p.id === payload.new.id ? payload.new as Product : p));
        } else if (payload.eventType === 'DELETE') {
          setProducts(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    if (isMock) {
      const localProducts = JSON.parse(localStorage.getItem(`invo_products_${SHOP_ID}`) || '[]');
      setProducts(localProducts.filter((p: any) => !p.deleted_at));
      setLoading(false);
      return;
    }
    
    const { data, error } = await supabase.from('products').select('*').eq('shop_id', SHOP_ID).order('updated_at', { ascending: false });
    if (!error) setProducts(data);
    setLoading(false);
  };

  const safeJson = async (response: Response) => {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse JSON:', text);
      return null;
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const price = parseFloat(editingProduct.price.toString());
    const stock = parseInt(editingProduct.stock_count.toString());

    if (isNaN(price) || isNaN(stock) || price < 0 || stock < 0) {
      playNotification('warning');
      setUpdateStatus({ type: 'error', message: 'Please enter valid positive numbers for price and stock.' });
      return;
    }

    setIsSubmitting(true);
    setUpdateStatus(null);

    if (isMock) {
      // Local testing fallback
      try {
        const localProducts = JSON.parse(localStorage.getItem(`invo_products_${SHOP_ID}`) || '[]');
        const updatedProducts = localProducts.map((p: any) => 
          p.id === editingProduct.id 
            ? { ...p, price, stock_count: stock, updated_at: new Date().toISOString() } 
            : p
        );
        localStorage.setItem(`invo_products_${SHOP_ID}`, JSON.stringify(updatedProducts));
        
        setProducts(updatedProducts.filter((p: any) => !p.deleted_at));
        playNotification('success');
        setUpdateStatus({ type: 'success', message: 'Product updated successfully (Local Storage)!' });
        setTimeout(() => {
          setEditingProduct(null);
          setUpdateStatus(null);
        }, 1500);
      } catch (err: any) {
        setUpdateStatus({ type: 'error', message: 'Local update failed: ' + err.message });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const response = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: editingProduct.id,
          user_id: USER_ID,
          price,
          stock_count: stock,
          action: 'UPDATE_PRODUCT'
        })
      });

      const result = await safeJson(response);
      if (response.ok) {
        playNotification('success');
        setUpdateStatus({ type: 'success', message: 'Product updated successfully!' });
        setTimeout(() => {
          setEditingProduct(null);
          setUpdateStatus(null);
        }, 1500);
        fetchInventory();
      } else {
        throw new Error(result?.error || 'Update failed');
      }
    } catch (error: any) {
      playNotification('error');
      setUpdateStatus({ type: 'error', message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    if (isMock) {
      const localProducts = JSON.parse(localStorage.getItem(`invo_products_${SHOP_ID}`) || '[]');
      const updated = localProducts.map((p: any) => 
        p.id === id ? { ...p, deleted_at: new Date().toISOString() } : p
      );
      localStorage.setItem(`invo_products_${SHOP_ID}`, JSON.stringify(updated));
      setProducts(updated.filter((p: any) => !p.deleted_at));
      return;
    }

    try {
      const response = await fetch(`/api/products?product_id=${id}&user_id=${USER_ID}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const result = await response.json();
        playNotification('error');
        throw new Error(result.error);
      }
      playNotification('info');
    } catch (error: any) {
      playNotification('error');
      alert('Delete failed: ' + error.message);
      fetchInventory();
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newProduct.price);
    const stock = parseInt(newProduct.stock) || 0;

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          shop_id: SHOP_ID, 
          user_id: USER_ID,
          name: newProduct.name, 
          price: price,
          stock_count: stock
        })
      });
      
      const result = await safeJson(response);
      if (response.ok) {
        playNotification('success');
        setIsAdding(false);
        setNewProduct({ name: '', price: '', stock: '' });
      } else {
        playNotification('error');
        alert(result?.error || 'Failed to add product');
      }
    } catch (error) {
      playNotification('success');
      // Local testing fallback: Save to localStorage
      const product: Product = {
        id: crypto.randomUUID(),
        shop_id: SHOP_ID,
        name: newProduct.name,
        price: price,
        stock_count: stock,
        updated_at: new Date().toISOString()
      } as any;

      const localProducts = JSON.parse(localStorage.getItem(`invo_products_${SHOP_ID}`) || '[]');
      const updated = [product, ...localProducts];
      localStorage.setItem(`invo_products_${SHOP_ID}`, JSON.stringify(updated));
      
      setProducts(updated);
      setIsAdding(false);
      setNewProduct({ name: '', price: '', stock: '' });
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading inventory data...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Inventory Catalog</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage products, stock levels, and pricing for this location.</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="btn-primary">
          + Add New Product
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {products.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem' }}>
             <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
             <h3>No products found</h3>
             <p style={{ color: 'var(--text-muted)' }}>Start by adding your first product to the catalog.</p>
          </div>
        ) : (
          products.map(p => (
            <div key={p.id} className="card animate-fade-in" style={{ 
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{p.name}</h3>
                  <span style={{ 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '2rem', 
                    fontSize: '0.75rem', 
                    fontWeight: 700,
                    backgroundColor: p.stock_count < 10 ? 'var(--primary-light)' : '#f1f5f9',
                    color: p.stock_count < 10 ? 'var(--primary)' : 'var(--text-secondary)'
                  }}>
                    {p.stock_count < 10 ? 'Low Stock' : 'In Stock'}
                  </span>
                </div>
                
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Current Price</span>
                    <strong style={{ color: 'var(--success)' }}>₵{p.price.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Available Quantity</span>
                    <strong style={{ color: p.stock_count < 10 ? 'var(--error)' : 'var(--text-primary)' }}>
                      {p.stock_count} units
                    </strong>
                  </div>
                </div>
                
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  Last modified: {new Date(p.updated_at || Date.now()).toLocaleDateString()}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button onClick={() => setEditingProduct(p)} className="btn-secondary" style={{ flex: 1, padding: '0.5rem' }}>
                  Update
                </button>
                <button 
                  onClick={() => handleDeleteProduct(p.id)}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: 'transparent', 
                    color: 'var(--error)', 
                    border: '1px solid var(--error)', 
                    borderRadius: 'var(--radius-lg)', 
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Update Modal */}
      {editingProduct && (
        <div style={{ 
          position: 'fixed', 
          inset: 0,
          backgroundColor: 'var(--bg-glass)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          zIndex: 1000,
          backdropFilter: 'blur(8px)',
          padding: '1rem'
        }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '450px', boxShadow: 'var(--shadow-xl)', backgroundColor: 'var(--bg-surface-elevated)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ margin: 0, color: 'var(--primary)' }}>Update Details</h2>
              <button onClick={() => setEditingProduct(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleUpdateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Product Name</label>
                <input type="text" value={editingProduct.name} disabled style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Price (₵)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                    required
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Stock Level</label>
                  <input 
                    type="number" 
                    value={editingProduct.stock_count}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock_count: parseInt(e.target.value) || 0 })}
                    required
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>

              {updateStatus && (
                <div style={{ 
                  padding: '1rem', 
                  borderRadius: 'var(--radius-md)', 
                  backgroundColor: updateStatus.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: updateStatus.type === 'success' ? 'var(--success)' : 'var(--error)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textAlign: 'center',
                  border: `1px solid ${updateStatus.type === 'success' ? 'var(--success)' : 'var(--error)'}`
                }}>
                  {updateStatus.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setEditingProduct(null)} className="btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ flex: 2 }}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAdding && (
        <div style={{ 
          position: 'fixed', 
          inset: 0,
          backgroundColor: 'var(--bg-glass)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          zIndex: 1000,
          backdropFilter: 'blur(8px)',
          padding: '1rem'
        }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '450px', backgroundColor: 'var(--bg-surface-elevated)' }}>
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary)' }}>New Product</h2>
            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Product Name</label>
                <input 
                  type="text" 
                  value={newProduct.name} 
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} 
                  required 
                  autoFocus
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  placeholder="e.g. Premium Sachet Water"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Price (₵)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={newProduct.price} 
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} 
                    required 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Initial Stock</label>
                  <input 
                    type="number" 
                    value={newProduct.stock} 
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsAdding(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }}>Create Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
