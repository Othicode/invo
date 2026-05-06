import React, { useState, useEffect } from 'react';

type Product = {
  id: string;
  name: string;
  price: number;
  currency: string;
  variation_name?: string | null;
};

type SearchResult = {
  results: Product[];
  exact_match: boolean;
  exact_match_id: string | null;
};

export const RecordSale: React.FC = () => {
  const [cart, setCart] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult>({ results: [], exact_match: false, exact_match_id: null });
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', variation: '', isVariation: false, parentId: '' });
  const [loading, setLoading] = useState(false);

  const SHOP_ID = '00000000-0000-0000-0000-000000000000';

  // --- Intelligent Search & Duplicate Detection ---
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        performSearch(query);
      } else {
        setSearchResults({ results: [], exact_match: false, exact_match_id: null });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = async (q: string) => {
    try {
      const response = await fetch(`/api/products/search?shop_id=${SHOP_ID}&query=${encodeURIComponent(q)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      } else {
        // Local fallback search
        const localProducts = JSON.parse(localStorage.getItem(`invo_products_${SHOP_ID}`) || '[]');
        const filtered = localProducts.filter((p: any) => p.name.toLowerCase().includes(q.toLowerCase()));
        const exact = localProducts.find((p: any) => p.name.toLowerCase() === q.toLowerCase());
        setSearchResults({
          results: filtered.slice(0, 5),
          exact_match: !!exact,
          exact_match_id: exact?.id || null
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- Quick Add Logic ---
  const handleQuickAdd = async () => {
    const price = parseFloat(newProduct.price);
    if (!newProduct.name || isNaN(price)) return;

    setLoading(true);
    try {
      const payload = {
        shop_id: SHOP_ID,
        name: newProduct.name,
        price,
        currency: 'GHS',
        variation_name: newProduct.isVariation ? newProduct.variation : null,
        parent_id: newProduct.isVariation ? newProduct.parentId : null
      };

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const savedProduct = await response.json();
        addToCart(savedProduct);
        setIsAddingProduct(false);
        setNewProduct({ name: '', price: '', variation: '', isVariation: false, parentId: '' });
        setQuery('');
      } else {
        throw new Error('Save failed');
      }
    } catch (e) {
      // Local Save Fallback
      const localProduct = {
        id: crypto.randomUUID(),
        name: newProduct.name,
        price,
        currency: 'GHS',
        variation_name: newProduct.isVariation ? newProduct.variation : null,
        parent_id: newProduct.isVariation ? newProduct.parentId : null
      };
      const localProducts = JSON.parse(localStorage.getItem(`invo_products_${SHOP_ID}`) || '[]');
      localStorage.setItem(`invo_products_${SHOP_ID}`, JSON.stringify([...localProducts, localProduct]));
      
      addToCart(localProduct);
      setIsAddingProduct(false);
      setNewProduct({ name: '', price: '', variation: '', isVariation: false, parentId: '' });
      setQuery('');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Record Sale (GHS)</h1>

      {/* Intelligent Search Input */}
      <div style={{ marginBottom: '20px', position: 'relative' }}>
        <input
          type="text"
          placeholder="Type product name (e.g. Sachet Water)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: '100%', padding: '15px', fontSize: '18px', borderRadius: '8px', border: '2px solid #007bff', boxSizing: 'border-box' }}
        />

        {/* Search Results / Duplicate Detection */}
        {query.length >= 2 && (
          <div style={{ 
            position: 'absolute', top: '100%', left: 0, right: 0, 
            backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '0 0 8px 8px', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10 
          }}>
            {searchResults.exact_match && (
              <div style={{ padding: '10px', backgroundColor: '#fff3cd', color: '#856404', borderBottom: '1px solid #ffeeba', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>⚠️ Exact match found: <strong>{query}</strong></span>
                <button 
                  onClick={() => {
                    setNewProduct({ ...newProduct, name: query, isVariation: true, parentId: searchResults.exact_match_id! });
                    setIsAddingProduct(true);
                  }}
                  style={{ padding: '5px 10px', backgroundColor: '#856404', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  + Add Variation
                </button>
              </div>
            )}
            
            {searchResults.results.map(p => (
              <div 
                key={p.id} 
                onClick={() => { addToCart(p); setQuery(''); }}
                style={{ padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              >
                <span>{p.name} {p.variation_name ? `(${p.variation_name})` : ''}</span>
                <span style={{ fontWeight: 'bold' }}>₵{p.price.toFixed(2)}</span>
              </div>
            ))}

            {!searchResults.exact_match && query.length >= 2 && (
              <div 
                onClick={() => { setNewProduct({ ...newProduct, name: query, isVariation: false }); setIsAddingProduct(true); }}
                style={{ padding: '12px', color: '#007bff', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold' }}
              >
                + Create "{query}" as New Product
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Add Modal */}
      {isAddingProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', width: '320px' }}>
            <h3>{newProduct.isVariation ? `Add Variation for ${newProduct.name}` : `Quick Add: ${newProduct.name}`}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
              {newProduct.isVariation && (
                <input 
                  type="text" 
                  placeholder="Variation Name (e.g. Large, Red)" 
                  value={newProduct.variation}
                  onChange={(e) => setNewProduct({ ...newProduct, variation: e.target.value })}
                  style={{ padding: '10px' }}
                />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontWeight: 'bold' }}>₵</span>
                <input 
                  type="number" 
                  placeholder="Price (GHS)" 
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  style={{ padding: '10px', flex: 1 }}
                />
              </div>
              <button 
                onClick={handleQuickAdd}
                disabled={loading}
                style={{ padding: '15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {loading ? 'Saving...' : 'Confirm & Add to Sale'}
              </button>
              <button 
                onClick={() => setIsAddingProduct(false)}
                style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Section */}
      <div style={{ marginTop: '30px', borderTop: '2px solid #eee', paddingTop: '20px' }}>
        <h3>Current Transaction</h3>
        {cart.length === 0 ? <p style={{ color: '#999' }}>No items added.</p> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {cart.map(item => (
              <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f9f9f9' }}>
                <span>{item.name} {item.variation_name ? `(${item.variation_name})` : ''} x {item.quantity}</span>
                <strong>₵{(item.price * item.quantity).toFixed(2)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Grand Total */}
      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '20px' }}>Total Amount</span>
        <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#28a745' }}>₵{totalAmount.toFixed(2)}</span>
      </div>

      <button 
        disabled={cart.length === 0 || loading}
        style={{ width: '100%', padding: '18px', marginTop: '20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer' }}
      >
        Complete Sale
      </button>
    </div>
  );
};
