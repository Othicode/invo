import React, { useState, useEffect } from 'react';
import { supabase, isMock } from '../../lib/supabase';
import { useAudioNotification } from '../hooks/useAudioNotification';

type Notification = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type: 'success' | 'warning' | 'info';
};

interface NotificationBellProps {
  userId: string;
  shopId: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ userId, shopId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { playNotification, preferences, toggleMute, setVolume } = useAudioNotification();
  const [showSettings, setShowSettings] = useState(false);

  const fetchNotifications = async (isNew = false) => {
    setLoading(true);
    try {
      if (isMock) {
        const localNotifications = JSON.parse(localStorage.getItem(`invo_notifications_${shopId}`) || '[]');
        
        // If it's a new notification update, check if we should play a sound
        if (isNew && localNotifications.length > notifications.length) {
          const latest = localNotifications[0];
          playNotification(latest.type === 'error' ? 'error' : latest.type || 'info');
        }

        setNotifications(localNotifications);
        return;
      }

      const response = await fetch(`/api/notifications?user_id=${userId}&shop_id=${shopId}`);
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server did not return JSON. It might be misconfigured.");
      }

      const data = await response.json();
      if (response.ok) {
        if (isNew && data.length > notifications.length) {
          const latest = data[0];
          playNotification(latest.type === 'error' ? 'error' : latest.type || 'info');
        }
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
      const localNotifications = JSON.parse(localStorage.getItem(`invo_notifications_${shopId}`) || '[]');
      setNotifications(localNotifications);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleUpdate = () => fetchNotifications(true);
    window.addEventListener('notifications_updated', handleUpdate);

    // Realtime subscription
      const channel = supabase
        .channel('notifications_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'checkout_notifications', filter: `user_id=eq.${userId}` }, 
          () => {
            fetchNotifications(true);
          }
        )
        .subscribe();
  
      return () => {
        supabase.removeChannel(channel);
        window.removeEventListener('notifications_updated', handleUpdate);
      };
  }, [userId, shopId, notifications.length]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllAsRead = async () => {
    if (isMock) {
      const updated = notifications.map(n => ({ ...n, is_read: true }));
      localStorage.setItem(`invo_notifications_${shopId}`, JSON.stringify(updated));
      setNotifications(updated);
      return;
    }

    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, shop_id: shopId })
      });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Audio settings"
          className="btn-secondary"
          style={{ padding: '0.5rem', borderRadius: '50%', border: 'none', background: 'transparent' }}
        >
          {preferences.muted ? '🔇' : '🔊'}
        </button>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          aria-label={`${unreadCount} unread notifications`}
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            position: 'relative',
            padding: 'var(--spacing-2)',
            display: 'flex',
            alignItems: 'center',
            fontSize: '1.5rem',
            color: 'var(--text-secondary)'
          }}
        >
          <span>🔔</span>
          {unreadCount > 0 && (
            <span style={{ 
              position: 'absolute', 
              top: '4px', 
              right: '4px', 
              backgroundColor: 'var(--error)', 
              color: 'white', 
              borderRadius: '50%', 
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 800,
              border: '2px solid var(--bg-surface)'
            }}>
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {showSettings && (
        <div className="card glass-panel" style={{
          position: 'absolute',
          top: 'calc(100% + 1rem)',
          right: '0',
          padding: '1.5rem',
          width: '220px',
          zIndex: 1001,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Audio Settings</span>
            <button onClick={() => setShowSettings(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)' }}>✕</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Mute All</label>
            <input type="checkbox" checked={preferences.muted} onChange={toggleMute} style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Volume</label>
            <input 
              type="range" 
              min="0" max="1" step="0.1" 
              value={preferences.volume} 
              onChange={(e) => setVolume(parseFloat(e.target.value))} 
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}

      {isOpen && (
        <div 
          role="region"
          aria-label="Notifications Panel"
          className="card glass-panel animate-fade-in"
          style={{ 
            position: 'absolute', 
            top: 'calc(100% + 1rem)', 
            right: '0', 
            width: '380px', 
            maxHeight: '500px', 
            overflowY: 'auto', 
            zIndex: 1000,
            padding: 0
          }}
        >
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, backgroundColor: 'var(--bg-glass)', backdropFilter: 'blur(10px)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} style={{ border: 'none', background: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Mark all as read</button>
            )}
          </div>
          
          <div style={{ padding: '0.5rem' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✨</div>
                <p style={{ fontSize: '0.875rem' }}>You're all caught up!</p>
              </div>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  style={{ 
                    padding: '1.25rem', 
                    borderRadius: 'var(--radius-md)', 
                    marginBottom: '0.25rem',
                    backgroundColor: n.is_read ? 'transparent' : 'var(--primary-light)',
                    transition: 'var(--transition-fast)',
                    cursor: 'default'
                  }}
                  className="hover-bg"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: n.is_read ? 'var(--text-primary)' : 'var(--primary)' }}>{n.title || 'Notification'}</div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
