import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { ShopManagement } from './components/ShopManagement';
import { FeedbackSystem } from './components/FeedbackSystem';
import { MainManagerDashboard } from './components/MainManagerDashboard';
import { BranchManagerDashboard } from './components/BranchManagerDashboard';
import { InventoryPage } from './components/InventoryPage';
import { SalesPage } from './components/SalesPage';
import { SalesHistory } from './components/SalesHistory';
import { NotificationBell } from './components/NotificationBell';
import { isMock } from '../lib/supabase';
import './App.css';

type View = 'record' | 'history' | 'dashboard' | 'shops' | 'main_manager' | 'branch_manager' | 'inventory' | 'sales_page';

function App() {
  const [view, setView] = useState<View>('dashboard');
  const [currentShopId, setCurrentShopId] = useState<string>('00000000-0000-0000-0000-000000000000');
  const [shops, setShops] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<'owner' | 'branch_manager' | 'attendant' | null>(null);

  // Mock user_id
  const USER_ID = '00000000-0000-0000-0000-000000000000';

  // --- Background Reminder Engine ---
  useEffect(() => {
    const interval = setInterval(() => {
      checkReminders();
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [currentShopId]);

  useEffect(() => {
    fetchShops();
    window.addEventListener('shop_created', fetchShops);
    return () => window.removeEventListener('shop_created', fetchShops);
  }, []);

  useEffect(() => {
    if (currentShopId && currentShopId !== '00000000-0000-0000-0000-000000000000') {
      fetchUserRole();
    }
  }, [currentShopId]);

  const fetchUserRole = async () => {
    try {
      const response = await fetch(`/api/shops/role?user_id=${USER_ID}&shop_id=${currentShopId}`);
      const data = await response.json();
      if (response.ok) {
        setUserRole(data.role);
      }
    } catch (e) {
      // Mock fallback: if it's the default shop, assume owner
      setUserRole(currentShopId.startsWith('0000') ? 'owner' : 'branch_manager');
    }
  };

  const fetchShops = async () => {
    try {
      const response = await fetch(`/api/shops?user_id=${USER_ID}`);
      const data = await response.json();
      if (response.ok) {
        setShops(data);
        if (data.length > 0 && currentShopId === '00000000-0000-0000-0000-000000000000') {
          setCurrentShopId(data[0].id);
        }
      } else {
        throw new Error('API failed');
      }
    } catch (error) {
      const localShops = JSON.parse(localStorage.getItem('invo_shops') || '[]');
      setShops(localShops);
      if (localShops.length > 0 && currentShopId === '00000000-0000-0000-0000-000000000000') {
        setCurrentShopId(localShops[0].id);
      }
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-text">invo</div>
          <select 
            value={currentShopId} 
            onChange={(e) => setCurrentShopId(e.target.value)} 
            className="shop-selector"
            aria-label="Select Shop"
          >
            {shops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
          </select>
        </div>
        <NotificationBell userId={USER_ID} shopId={currentShopId} />
      </header>

      <nav className="app-nav">
        {[
          { id: 'dashboard', label: 'Dashboard', roles: ['owner', 'branch_manager', 'attendant'] },
          { id: 'inventory', label: 'Inventory', roles: ['owner', 'branch_manager', 'attendant'] },
          { id: 'sales_page', label: 'Sales (POS)', roles: ['owner', 'branch_manager', 'attendant'] },
          { id: 'history', label: 'History', roles: ['owner', 'branch_manager'] },
          { id: 'shops', label: 'Settings', roles: ['owner'] },
          { id: 'main_manager', label: 'Owner View', roles: ['owner'] },
          { id: 'branch_manager', label: 'Branch View', roles: ['branch_manager'] }
        ].filter(tab => !userRole || tab.roles.includes(userRole)).map(tab => (
          <button 
            key={tab.id}
            onClick={() => setView(tab.id as View)}
            className={`nav-link ${view === tab.id ? 'active' : ''}`}
            aria-current={view === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-main animate-fade-in">
        {view === 'dashboard' && <Dashboard />}
        {view === 'inventory' && <InventoryPage shopId={currentShopId} userId={USER_ID} />}
        {view === 'sales_page' && <SalesPage shopId={currentShopId} />}
        {view === 'history' && <SalesHistory shopId={currentShopId} />}
        {view === 'shops' && <ShopManagement />}
        {view === 'main_manager' && <MainManagerDashboard />}
        {view === 'branch_manager' && <BranchManagerDashboard />}
      </main>

      <FeedbackSystem userId={USER_ID} shopId={currentShopId} />
    </div>
  );
}

export default App;
