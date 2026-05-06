import React, { useState } from 'react';

interface FeedbackSystemProps {
  userId: string;
  shopId: string;
}

export const FeedbackSystem: React.FC<FeedbackSystemProps> = ({ userId, shopId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'bug' | 'feature' | 'other'>('bug');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Mock sending feedback
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Feedback submitted:', { userId, shopId, type, message });
      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
        setMessage('');
      }, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="glass-panel"
        style={{ 
          position: 'fixed', 
          bottom: '2rem', 
          right: '2rem', 
          zIndex: 100, 
          padding: '0.75rem 1.5rem', 
          borderRadius: '2rem', 
          border: '1px solid var(--border-glass)', 
          cursor: 'pointer',
          fontWeight: 700,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <span>💬</span> Feedback
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--bg-glass)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-surface-elevated)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
               <h2 style={{ margin: 0, color: 'var(--primary)' }}>Send Feedback</h2>
               <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--text-muted)' }}>✕</button>
            </div>

            {success ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                 <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚀</div>
                 <h3 style={{ color: 'var(--success)' }}>Thank You!</h3>
                 <p style={{ color: 'var(--text-secondary)' }}>Your feedback helps us build a better platform.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Feedback Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                     {(['bug', 'feature', 'other'] as const).map(opt => (
                        <button 
                          key={opt}
                          type="button"
                          onClick={() => setType(opt)}
                          className={type === opt ? 'btn-primary' : 'btn-secondary'}
                          style={{ padding: '0.5rem', fontSize: '0.75rem', textTransform: 'capitalize' }}
                        >
                          {opt}
                        </button>
                     ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Message</label>
                  <textarea 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    required 
                    rows={4}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', resize: 'none', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
                    placeholder="Tell us what's on your mind..."
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '1rem' }}>
                  {loading ? 'Sending...' : 'Submit Feedback'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
