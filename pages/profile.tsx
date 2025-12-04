import React, { useEffect, useState, useRef, useMemo } from 'react';
import supabase from '../lib/supabaseClient';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { UserCircle, Package, CreditCard, TrendingUp, Plus, Minus, Edit } from 'lucide-react';

type Stats = {
  totalCards: number;
  totalValue: number;
  collectionCount: number;
};

type Activity = {
  id: string;
  type: 'add' | 'remove';
  cardId: string;
  cardName: string;
  quantity: number;
  collectionId: string;
  collectionName: string;
  occurredAt: string;
};

type ValueHistoryPoint = {
  date: string;
  value: number;
};

export default function ProfilePage() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<{ username?: string; avatar_url?: string }>({});
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [stats, setStats] = useState<Stats>({ totalCards: 0, totalValue: 0, collectionCount: 0 });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [hasMoreActivity, setHasMoreActivity] = useState(true);
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false);
  const [valueHistory, setValueHistory] = useState<ValueHistoryPoint[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACTIVITY_PER_PAGE = 10;

  useEffect(() => {
    supabase.auth.getSession().then((r) => setSession(r.data.session));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.data.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    async function load() {
      if (!session?.access_token) return;
      
      setLoading(true);
      
      try {
        // Load all data in parallel for better performance
        const [profileRes, statsRes, activityRes, historyRes] = await Promise.all([
          fetch('/api/profile', { headers: { Authorization: `Bearer ${session.access_token}` } }),
          fetch('/api/profile/stats', { headers: { Authorization: `Bearer ${session.access_token}` } }),
          fetch(`/api/profile/activity?limit=${ACTIVITY_PER_PAGE}&offset=0`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
          fetch('/api/profile/value-history', { headers: { Authorization: `Bearer ${session.access_token}` } })
        ]);

        const [profileData, statsData, activityData, historyData] = await Promise.all([
          profileRes.json(),
          statsRes.json(),
          activityRes.json(),
          historyRes.json()
        ]);

        setProfile(profileData);
        setUsername(profileData?.username ?? '');
        setAvatarUrl(profileData?.avatar_url ?? '');
        setStats(statsData);
        setActivity(activityData.activity ?? []);
        setHasMoreActivity((activityData.activity ?? []).length === ACTIVITY_PER_PAGE);
        setValueHistory(historyData.history ?? []);
      } catch (err) {
        console.error('Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  const loadMoreActivity = async () => {
    if (!session?.access_token || loadingMoreActivity || !hasMoreActivity) return;
    
    setLoadingMoreActivity(true);
    try {
      const offset = activityPage * ACTIVITY_PER_PAGE;
      const res = await fetch(`/api/profile/activity?limit=${ACTIVITY_PER_PAGE}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      const newActivity = data.activity ?? [];
      
      setActivity(prev => [...prev, ...newActivity]);
      setActivityPage(prev => prev + 1);
      setHasMoreActivity(newActivity.length === ACTIVITY_PER_PAGE);
    } catch (err) {
      console.error('Load more activity error:', err);
    } finally {
      setLoadingMoreActivity(false);
    }
  };

  const save = async () => {
    if (!session?.access_token) return;
    const r = await fetch('/api/profile', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, avatar_url: avatarUrl })
    });
    const b = await r.json();
    setProfile(b);
    setEditModalOpen(false);
  };

  const deleteProfile = async () => {
    if (!confirm('Are you sure you want to delete your profile? This action cannot be undone.')) return;
    if (!session?.access_token) return;
    
    // TODO: Implement delete profile endpoint
    alert('Profile deletion is not yet implemented');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.access_token) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        
        const res = await fetch('/api/profile/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageData: base64Data,
            fileName: file.name
          })
        });

        const data = await res.json();
        
        if (res.ok && data.avatarUrl) {
          setAvatarUrl(data.avatarUrl);
          setProfile(prev => ({ ...prev, avatar_url: data.avatarUrl }));
        } else {
          alert('Upload failed: ' + (data.error || 'Unknown error'));
        }
        
        setUploading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed');
      setUploading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Layout>
      <header className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>⚚ Architect's Chronicle</h2>
        <a href="/">
          <Button variant="secondary">Home</Button>
        </a>
      </header>
      <div className="card" style={{ marginTop: 16 }}>
        {session?.user ? (
          loading ? (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* Loading Skeleton */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 96, height: 96, background: 'rgba(212,175,55,0.2)', borderRadius: 8, animation: 'pulse 2s infinite' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '60%', height: 28, background: 'rgba(212,175,55,0.2)', borderRadius: 4, marginBottom: 8, animation: 'pulse 2s infinite' }} />
                  <div style={{ width: '40%', height: 16, background: 'rgba(212,175,55,0.2)', borderRadius: 4, animation: 'pulse 2s infinite' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="card" style={{ textAlign: 'center', padding: 12 }}>
                    <div style={{ width: '60%', height: 32, background: 'rgba(212,175,55,0.2)', borderRadius: 4, margin: '0 auto', animation: 'pulse 2s infinite' }} />
                    <div style={{ width: '40%', height: 16, background: 'rgba(212,175,55,0.2)', borderRadius: 4, margin: '8px auto 0', animation: 'pulse 2s infinite' }} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
          <div style={{ display: 'grid', gap: 20 }}>
            {/* Profile Header */}
            <div className="profile-header" style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative' }}>
                  <img
                    src={avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.id}`}
                    alt="avatar"
                    width={96}
                  height={96}
                  style={{
                    borderRadius: 8,
                    border: '3px solid #d4af37',
                    boxShadow: '0 4px 16px rgba(212,175,55,0.4)',
                    cursor: 'pointer',
                    objectFit: 'cover'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: -8,
                    right: -8,
                    background: 'linear-gradient(135deg, #d4af37 0%, #b8941e 100%)',
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: '2px solid #1a1410',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.6)'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? '...' : '▲'}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Cinzel, serif', color: '#d4af37' }}>
                  {profile?.username || 'Unnamed Architect'}
                </div>
                <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>{session.user.email ?? '—'}</div>
              </div>
              </div>
              <Button onClick={() => setEditModalOpen(true)} variant="secondary" style={{ minWidth: '120px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Edit size={16} /> Edit Profile
              </Button>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div className="card" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#d4af37' }}>{stats.collectionCount}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Vaults</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#d4af37' }}>{stats.totalCards}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Cards</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#d4af37' }}>€{stats.totalValue.toFixed(2)}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Total Value</div>
              </div>
            </div>

            {/* Value History Chart */}
            {valueHistory.length > 0 && (
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Collection Value Over Time</h3>
                <ValueChart data={valueHistory} />
              </div>
            )}

            {/* Activity Feed */}
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Recent Activity</h3>
              {activity.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', padding: 20 }}>No activity yet. Begin inscribing relics!</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {activity.map((log) => (
                    <a
                      key={log.id}
                      href={`/collections/${log.collectionId}`}
                      className="activity-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 10,
                        background: 'rgba(42,37,32,0.3)',
                        borderRadius: 4,
                        borderLeft: `3px solid ${log.type === 'add' ? '#4ade80' : '#f87171'}`,
                        textDecoration: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        willChange: 'transform, background'
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: log.type === 'add' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)',
                          borderRadius: 4,
                          color: log.type === 'add' ? '#4ade80' : '#f87171',
                          border: `2px solid ${log.type === 'add' ? '#4ade80' : '#f87171'}`
                        }}
                      >
                        {log.type === 'add' ? <Plus size={18} /> : <Minus size={18} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14 }}>
                          <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 600 }}>{log.collectionName}</span>
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                          {log.type === 'add' ? 'Inscribed' : 'Removed'} {log.quantity}x <span style={{ color: '#d4af37' }}>{log.cardName}</span>
                        </div>
                      </div>
                      <div className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        {formatDate(log.occurredAt)}
                      </div>
                    </a>
                  ))}
                </div>
              )}
              {hasMoreActivity && (
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <Button 
                    onClick={loadMoreActivity} 
                    disabled={loadingMoreActivity}
                    variant="secondary"
                    style={{ width: '100%' }}
                  >
                    {loadingMoreActivity ? 'Loading...' : 'Load More'}
                  </Button>
                </div>
              )}
            </div>
          </div>
          )
        ) : (
          <p className="muted">Not signed in.</p>
        )}
      </div>

      {/* Mobile Bottom Action Bar - Only visible on mobile */}
      {session?.user && !loading && (
        <div className="mobile-bottom-bar">
          <Button onClick={() => setEditModalOpen(true)} variant="secondary" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <Edit size={16} /> Edit Profile
          </Button>
          {hasMoreActivity && (
            <Button 
              onClick={loadMoreActivity} 
              disabled={loadingMoreActivity}
              variant="secondary"
              style={{ margin: 0 }}
            >
              {loadingMoreActivity ? '...' : 'More'}
            </Button>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      <Modal open={editModalOpen} title="Edit Profile" onClose={() => setEditModalOpen(false)}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose your name"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Email</label>
            <input
              value={session?.user?.email || ''}
              disabled
              style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed' }}
            />
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Email cannot be changed</p>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 8 }}>
            <Button onClick={deleteProfile} variant="secondary" style={{ background: '#b91c1c', borderColor: '#991b1b' }}>
              Delete Profile
            </Button>
            <Button onClick={save}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}

const ValueChart = React.memo(({ data }: { data: ValueHistoryPoint[] }) => {
  if (data.length === 0) return null;

  const { maxValue, minValue, valueRange, firstValue, lastValue, percentChange, isPositive } = useMemo(() => {
    const max = Math.max(...data.map(d => d.value));
    const min = Math.min(...data.map(d => d.value));
    const range = max - min || 1;
    const first = data[0].value;
    const last = data[data.length - 1].value;
    const change = first > 0 ? ((last - first) / first) * 100 : 0;
    const positive = change >= 0;
    
    return {
      maxValue: max,
      minValue: min,
      valueRange: range,
      firstValue: first,
      lastValue: last,
      percentChange: change,
      isPositive: positive
    };
  }, [data]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Summary Stats */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', padding: '8px 0' }}>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>30 Days Ago</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#d4af37' }}>€{firstValue.toFixed(2)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 12 }}>Change</div>
          <div style={{ 
            fontSize: 18, 
            fontWeight: 700, 
            color: isPositive ? '#4ade80' : '#f87171' 
          }}>
            {isPositive ? '▲' : '▼'} {Math.abs(percentChange).toFixed(1)}%
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="muted" style={{ fontSize: 12 }}>Current</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#d4af37' }}>€{lastValue.toFixed(2)}</div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ 
        position: 'relative',
        height: 200,
        background: 'rgba(42,37,32,0.3)',
        borderRadius: 6,
        padding: '12px 8px',
        overflow: 'hidden'
      }}>
        {/* Grid lines */}
        <div style={{ position: 'absolute', inset: '12px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ 
              width: '100%', 
              height: 1, 
              background: 'rgba(212,175,55,0.1)'
            }} />
          ))}
        </div>

        {/* Line Chart */}
        <svg 
          width="100%" 
          height="100%" 
          style={{ position: 'relative', zIndex: 1 }}
          preserveAspectRatio="none"
          viewBox={`0 0 ${data.length - 1} 100`}
        >
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isPositive ? '#4ade80' : '#f87171'} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isPositive ? '#4ade80' : '#f87171'} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          
          {/* Area under the line */}
          <path
            d={`
              M 0,${100 - ((data[0].value - minValue) / valueRange) * 100}
              ${data.slice(1).map((point, i) => 
                `L ${i + 1},${100 - ((point.value - minValue) / valueRange) * 100}`
              ).join(' ')}
              L ${data.length - 1},100
              L 0,100
              Z
            `}
            fill="url(#chartGradient)"
          />
          
          {/* Line */}
          <polyline
            points={data.map((point, i) => 
              `${i},${100 - ((point.value - minValue) / valueRange) * 100}`
            ).join(' ')}
            fill="none"
            stroke={isPositive ? '#4ade80' : '#f87171'}
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* X-axis labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8a7f6f' }}>
        <span>{new Date(data[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span>{new Date(data[Math.floor(data.length / 2)].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span>{new Date(data[data.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  );
});
