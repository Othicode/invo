import React, { useState, useEffect } from 'react';
import { isMock } from '../../lib/supabase';
import { Receipt } from './Receipt';
import { useAudioNotification } from '../hooks/useAudioNotification';

type Product = {
  id: string;
  name: string;
  price: number;
  stock_count: number;
  is_new?: boolean;
};

type Notification = {
  id: string;
  message: string;
  itemId: string;
  itemName: string;
};

type ReminderModalProps = {
  itemName: string;
  onClose: () => void;
  onConfirm: (duration: string, unit: 'm' | 'h' | 'd') => void;
};

const ReminderModal: React.FC<ReminderModalProps> = ({ itemName, onClose, onConfirm }) => {
  const [duration, setDuration] = useState('15');
  const [unit, setUnit] = useState<'m' | 'h' | 'd'>('m');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    const val = parseInt(duration);
    if (isNaN(val) || val <= 0) {
      setError('Enter a valid duration');
      return;
    }
    onConfirm(duration, unit);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--bg-glass)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
      <div className="card animate-fade-in" style={{ textAlign: 'center', width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-surface-elevated)' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Set Reminder for {itemName}</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>{itemName} checked out but isn't part of the inventory. When should we remind you to update it?</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { label: '15m', val: '15', u: 'm' },
            { label: '1h', val: '1', u: 'h' },
            { label: '4h', val: '4', u: 'h' },
            { label: '1d', val: '1', u: 'd' },
            { label: '1w', val: '7', u: 'd' }
          ].map(opt => (
            <button 
              key={opt.label} 
              onClick={() => { setDuration(opt.val); setUnit(opt.u as any); }}
              className={duration === opt.val && unit === opt.u ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.5rem', fontSize: '0.75rem' }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
          <input 
            type="number" 
            value={duration} 
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Custom"
            style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          />
          <select 
            value={unit} 
            onChange={(e) => setUnit(e.target.value as any)}
            style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          >
            <option value="m">Min</option>
            <option value="h">Hours</option>
            <option value="d">Days</option>
          </select>
        </div>

        {error && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginBottom: '1rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={handleConfirm} className="btn-primary" style={{ flex: 1 }}>Confirm</button>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export const SalesPage: React.FC<{ shopId: string }> = ({ shopId }) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [cart, setCart] = useState<(Product & { quantity: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'momo'>('cash');
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [completedItems, setCompletedItems] = useState<any[]>([]);
  const [reminderItem, setReminderItem] = useState<{ id: string, name: string } | null>(null);
  const { playNotification } = useAudioNotification();

  const SHOP_ID = shopId;
  const USER_ID = '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) performSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = async () => {
    if (isMock) {
      const localProducts = JSON.parse(localStorage.getItem(`invo_products_${SHOP_ID}`) || '[]');
      const filtered = localProducts.filter((p: any) => p.name.toLowerCase().includes(query.toLowerCase()));
      setSearchResults(filtered);
      return;
    }

    try {
      const response = await fetch(`/api/products/search?shop_id=${SHOP_ID}&query=${query}`);
      const data = await response.json();
      if (response.ok) {
        setSearchResults(data.results || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.length >= 2) {
      const exact = searchResults.find(p => p.name.toLowerCase() === query.toLowerCase());
      if (exact) {
        addToCart(exact);
      } else {
        // Silent Auto-Add for Unknown Items
        const newProduct: Product = {
          id: `new-${Date.now()}`,
          name: query,
          price: 0,
          stock_count: 0,
          is_new: true
        };
        addToCart(newProduct);
      }
    }
  };

  const addToCart = (product: Product) => {
    // If not new, check stock
    if (!product.is_new && product.stock_count <= 0) {
      playNotification('warning');
      alert('Insufficient stock!');
      return;
    }
    const existing = cart.find(item => item.id === product.id || (item.is_new && item.name === product.name));
    if (existing) {
      // Don't add if would exceed stock
      if (!product.is_new && existing.quantity + 1 > product.stock_count) {
        playNotification('warning');
        alert('Cannot add more than available stock');
        return;
      }
      setCart(cart.map(item => (item.id === product.id || (item.is_new && item.name === product.name)) ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    setQuery('');
    setSearchResults([]);
  };

  const updateCartPrice = (id: string, name: string, price: number, isNew?: boolean) => {
    if (price < 0) return;
    setCart(prev => prev.map(item => {
      if ((isNew && item.name === name) || (!isNew && item.id === id)) {
        return { ...item, price };
      }
      return item;
    }));
  };

  const updateCartQuantity = (id: string, name: string, quantity: number, isNew?: boolean) => {
    if (quantity < 1) return;
    
    setCart(prev => prev.map(item => {
      if ((isNew && item.name === name) || (!isNew && item.id === id)) {
        // Validation for inventory items
        if (!isNew && quantity > item.stock_count) {
          playNotification('warning');
          alert(`Only ${item.stock_count} units available`);
          return item;
        }
        return { ...item, quantity };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string, name: string, isNew?: boolean) => {
    setCart(prev => prev.filter(item => isNew ? item.name !== name : item.id !== id));
  };

  const handleCheckout = async () => {
    // Validation
    const invalidItems = cart.filter(item => item.price <= 0);
    if (invalidItems.length > 0) {
      playNotification('warning');
      alert(`Please enter a valid price for: ${invalidItems.map(i => i.name).join(', ')}`);
      return;
    }

    setLoading(true);
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    try {
      if (isMock) {
        // Mock checkout logic
        const saleId = crypto.randomUUID();
        const mockSale = {
          id: saleId,
          shop_id: SHOP_ID,
          user_id: USER_ID,
          total_amount: total,
          payment_method: paymentMethod,
          receipt_number: `MOCK-INV-${Date.now()}`,
          created_at: new Date().toISOString(),
          shops: { name: 'Mock Shop', address: 'Localhost', contact_details: '000-000' },
          profiles: { full_name: 'Mock Cashier' }
        };

        // Update local stock
        const localProducts = JSON.parse(localStorage.getItem(`invo_products_${SHOP_ID}`) || '[]');
        const updatedProducts = localProducts.map((p: any) => {
          const cartItem = cart.find(item => item.id === p.id);
          if (cartItem) return { ...p, stock_count: p.stock_count - cartItem.quantity };
          return p;
        });
        localStorage.setItem(`invo_products_${SHOP_ID}`, JSON.stringify(updatedProducts));

        // Success notifications for new items
        const newItemsInMock = cart.filter(item => item.is_new);
        const checkoutNotifications: Notification[] = newItemsInMock.map(item => ({
          id: crypto.randomUUID(),
          message: `${item.name} checked out, isn't part of the inventory`,
          itemId: item.id || `mock-${Date.now()}`,
          itemName: item.name
        }));
        setNotifications(prev => [...prev, ...checkoutNotifications]);

        // Also add a general success notification to persistent bell
        const bellNotification = {
          id: crypto.randomUUID(),
          title: 'Successful Checkout (Offline)',
          message: `Sale of ₵${total.toFixed(2)} recorded locally.`,
          is_read: false,
          created_at: new Date().toISOString(),
          type: 'success'
        } as any;
        const localNotifications = JSON.parse(localStorage.getItem(`invo_notifications_${SHOP_ID}`) || '[]');
        localStorage.setItem(`invo_notifications_${SHOP_ID}`, JSON.stringify([bellNotification, ...localNotifications]));

        setCompletedSale(mockSale);
        setCompletedItems([...cart]);
        setCart([]);
        playNotification('success');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: SHOP_ID,
          user_id: USER_ID,
          total_amount: total,
          payment_method: paymentMethod,
          items: cart.map(item => ({
            product_id: item.is_new ? null : item.id,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            is_new: !!item.is_new
          }))
        })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response received:", text);
        throw new Error("Server error: Received source code or HTML instead of JSON. Check backend configuration.");
      }

      const result = await response.json();
      if (response.ok) {
        playNotification('success');
        // Prepare data for receipt
        setCompletedSale(result.sale);
        setCompletedItems([...cart]);

        // Success notifications for new items
        const newItems = cart.filter(item => item.is_new);
        const checkoutNotifications: Notification[] = newItems.map(item => ({
          id: crypto.randomUUID(),
          message: `${item.name} checked out, isn't part of the inventory`,
          itemId: result.new_item_ids?.[item.name] || '',
          itemName: item.name
        }));
        setNotifications(prev => [...prev, ...checkoutNotifications]);

        setCart([]);
      } else {
        playNotification('error');
        alert('Error: ' + result.error);
      }
    } catch (e: any) {
      playNotification('error');
      alert('Error: ' + e.message);
    }
    setLoading(false);
  };

  const handleSaveTransaction = async (customName: string) => {
    setLoading(true);
    try {
      const saleId = completedSale.id;
      const timestamp = new Date().toISOString();
      const uniqueFilename = `${customName}_${saleId}_${Date.now()}`;

      if (isMock) {
        // Validate uniqueness in local storage
        const localSales = JSON.parse(localStorage.getItem(`invo_sales_${SHOP_ID}`) || '[]');
        if (localSales.some((s: any) => s.custom_name === customName)) {
          alert('A transaction with this name already exists. Please choose a unique name.');
          setLoading(false);
          return;
        }

        const formattedItems = completedItems.map(item => ({
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        }));

        const fullSaleRecord = {
          ...completedSale,
          custom_name: customName,
          unique_filename: uniqueFilename,
          recorded_by: 'Mock Cashier',
          items: formattedItems,
          created_at: timestamp
        };

        localStorage.setItem(`invo_sales_${SHOP_ID}`, JSON.stringify([fullSaleRecord, ...localSales]));
        
        // Success notification
        const notification = {
          id: crypto.randomUUID(),
          title: 'Transaction Saved',
          message: `Transaction "${customName}" has been successfully moved to history.`,
          is_read: false,
          created_at: timestamp,
          type: 'success'
        };
        const localNotifications = JSON.parse(localStorage.getItem(`invo_notifications_${SHOP_ID}`) || '[]');
        localStorage.setItem(`invo_notifications_${SHOP_ID}`, JSON.stringify([notification, ...localNotifications]));
      }

      setCompletedSale(null);
      setCompletedItems([]);
      alert(`Transaction "${customName}" saved successfully!`);
    } catch (e) {
      console.error('Failed to save transaction', e);
      alert('Error saving transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReminderConfirm = async (duration: string, unit: 'm' | 'h' | 'd') => {
    if (!reminderItem) return;

    playNotification('info');
    let dueAt = new Date();
    const val = parseInt(duration);
    if (unit === 'm') dueAt.setMinutes(dueAt.getMinutes() + val);
    else if (unit === 'h') dueAt.setHours(dueAt.getHours() + val);
    else if (unit === 'd') dueAt.setDate(dueAt.getDate() + val);

    if (isMock) {
      const reminder = {
        id: Math.random().toString(36).substr(2, 9),
        product_id: reminderItem.id,
        product_name: reminderItem.name,
        due_at: dueAt.toISOString(),
        status: 'PENDING'
      };
      const localReminders = JSON.parse(localStorage.getItem(`invo_reminders_${SHOP_ID}`) || '[]');
      localStorage.setItem(`invo_reminders_${SHOP_ID}`, JSON.stringify([...localReminders, reminder]));
      
      const notification = {
        id: crypto.randomUUID(),
        title: 'Reminder Set',
        message: `We'll remind you to update "${reminderItem.name}" in ${duration} ${unit === 'm' ? 'minutes' : unit === 'h' ? 'hours' : 'days'}.`,
        is_read: false,
        created_at: new Date().toISOString(),
        type: 'info'
      };
      const localNotifications = JSON.parse(localStorage.getItem(`invo_notifications_${SHOP_ID}`) || '[]');
      localStorage.setItem(`invo_notifications_${SHOP_ID}`, JSON.stringify([notification, ...localNotifications]));
    } else {
      try {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: reminderItem.id,
            user_id: USER_ID,
            due_at: dueAt.toISOString(),
            status: 'PENDING'
          })
        });
      } catch (e) {
        console.error('Failed to set reminder', e);
      }
    }

    setReminderItem(null);
    alert(`Reminder set for ${reminderItem.name}`);
  };

  const handleGoToInventory = (itemName: string, itemId: string) => {
    window.location.href = `/inventory?prefill_name=${encodeURIComponent(itemName)}&prefill_id=${itemId}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Dynamic Notifications */}
      <div style={{ position: 'fixed', top: '100px', right: '2rem', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {notifications.map(n => (
          <div key={n.id} className="card animate-fade-in glass-panel" style={{ width: '320px', borderLeft: '4px solid var(--primary)' }}>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: 500 }}>{n.message}</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => handleGoToInventory(n.itemName, n.itemId)} className="btn-primary" style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem' }}>Update</button>
              <button 
                onClick={() => {
                  setReminderItem({ id: n.itemId, name: n.itemName });
                  setNotifications(prev => prev.filter(notif => notif.id !== n.id));
                }}
                className="btn-secondary" style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem' }}
              >
                Remind
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Point of Sale</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Process new transactions and record sales.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Status:</span>
          <span style={{ padding: '0.25rem 0.75rem', borderRadius: '2rem', backgroundColor: '#dcfce7', color: '#166534', fontSize: '0.75rem', fontWeight: 700 }}>Online</span>
        </div>
      </div>
      
      <div style={{ position: 'relative' }}>
        <input 
          type="text" 
          placeholder="Search inventory or type new item name..." 
          value={query} 
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ width: '100%', padding: '1.25rem 1.5rem', fontSize: '1.125rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }} 
        />
        {searchResults.length > 0 && (
          <div className="card glass-panel" style={{ position: 'absolute', width: '100%', marginTop: '0.5rem', zIndex: 100, padding: '0.5rem' }}>
            {searchResults.map(p => (
              <div 
                key={p.id} 
                onClick={() => addToCart(p)} 
                style={{ padding: '1rem', cursor: 'pointer', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', transition: 'var(--transition-fast)' }}
                className="hover-bg"
              >
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>₵{p.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>Active Cart</h3>
          
          {cart.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.2 }}>🛒</div>
              <p>No items in current transaction.</p>
              <p style={{ fontSize: '0.875rem' }}>Use the search bar above to add products.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {cart.map(item => (
                <div key={item.id} className="animate-fade-in" style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  padding: '1.25rem', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-lg)', 
                  backgroundColor: 'var(--bg-surface-elevated)' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)' }}>
                      {item.name}
                      {item.is_new && <span style={{ marginLeft: '0.5rem', padding: '0.2rem 0.5rem', backgroundColor: 'var(--warning)', color: 'var(--text-inverse)', borderRadius: '4px', fontSize: '0.625rem', verticalAlign: 'middle', fontWeight: 800 }}>NEW</span>}
                    </div>
                    <button onClick={() => removeFromCart(item.id, item.name, item.is_new)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.25rem', opacity: 0.7 }} className="hover-bg">✕</button>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Quantity</label>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: 'var(--bg-main)' }}>
                          <button onClick={() => updateCartQuantity(item.id, item.name, item.quantity - 1, item.is_new)} style={{ padding: '0.5rem 0.75rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)' }}>-</button>
                          <input type="number" value={item.quantity} readOnly style={{ width: '40px', border: 'none', textAlign: 'center', fontWeight: 700, background: 'transparent', color: 'var(--text-primary)' }} />
                          <button onClick={() => updateCartQuantity(item.id, item.name, item.quantity + 1, item.is_new)} style={{ padding: '0.5rem 0.75rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)' }}>+</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Unit Price (₵)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={item.price} 
                          onChange={(e) => updateCartPrice(item.id, item.name, parseFloat(e.target.value) || 0, item.is_new)}
                          style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', width: '100px', fontWeight: 700, backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total Item Price</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>₵{(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card glass-panel" style={{ position: 'sticky', top: '100px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Checkout Summary</h3>
            
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Payment Method</span>
                  <select 
                    value={paymentMethod} 
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    style={{ border: 'none', background: 'none', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="momo">MoMo</option>
                  </select>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Item Count</span>
                  <span style={{ fontWeight: 700 }}>{cart.reduce((sum, i) => sum + i.quantity, 0)} items</span>
               </div>
            </div>

            <div style={{ borderTop: '2px dashed var(--border-color)', margin: '0 -1.5rem', padding: '1.5rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2rem' }}>
                  <span style={{ fontSize: '1.125rem', fontWeight: 600 }}>Total Amount</span>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>₵{cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}</div>
               </div>
               
               <button 
                disabled={cart.length === 0 || loading} 
                onClick={handleCheckout}
                className="btn-primary"
                style={{ width: '100%', padding: '1.25rem', fontSize: '1.25rem' }}
              >
                {loading ? 'Processing...' : 'Complete Checkout'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {completedSale && (
        <Receipt sale={completedSale} items={completedItems} onSave={handleSaveTransaction} />
      )}

      {reminderItem && (
        <ReminderModal itemName={reminderItem.name} onClose={() => setReminderItem(null)} onConfirm={handleReminderConfirm} />
      )}
    </div>
  );
};
