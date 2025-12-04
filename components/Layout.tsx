import React, { useEffect, useState } from 'react';
import supabase from '../lib/supabaseClient';
import { Hammer, User, LogOut } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<{ avatar_url?: string }>({});
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then((r) => setSession(r.data.session));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.data.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!session?.access_token) return;
      const r = await fetch('/api/profile', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const b = await r.json();
      setProfile(b);
      setAvatarUrl(b?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.id}`);
    }
    loadProfile();
  }, [session]);

  // Pre-set avatar URL when session is available to avoid flash
  useEffect(() => {
    if (session?.user && !avatarUrl) {
      setAvatarUrl(`https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.id}`);
    }
  }, [session, avatarUrl]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = () => setMenuOpen(false);
    if (menuOpen) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [menuOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div>
      <nav style={nav}>
        <div style={navInner}>
          <a href="/" style={brand}>
            <Hammer size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
            Rift Architect
          </a>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {session?.user && avatarUrl && (
              <div style={{ position: 'relative' }}>
                <div 
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <img
                    src={avatarUrl}
                    alt="profile"
                    width={32}
                    height={32}
                    style={{
                      borderRadius: 4,
                      border: '2px solid #d4af37',
                      boxShadow: '0 2px 8px rgba(212,175,55,0.4)'
                    }}
                  />
                </div>
                {menuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 8,
                    background: 'linear-gradient(145deg, rgba(42,37,32,0.98) 0%, rgba(26,20,16,0.98) 100%)',
                    border: '2px solid #3d352d',
                    borderRadius: 6,
                    minWidth: 160,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                    zIndex: 100
                  }}>
                    <a 
                      href="/profile"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 16px',
                        color: '#f0e6d2',
                        textDecoration: 'none',
                        fontSize: 14,
                        fontFamily: 'Cinzel, serif',
                        borderBottom: '1px solid #3d352d',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(212,175,55,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <User size={16} /> Profile
                    </a>
                    <button
                      onClick={handleSignOut}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 16px',
                        color: '#f87171',
                        textDecoration: 'none',
                        fontSize: 14,
                        fontFamily: 'Cinzel, serif',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        boxShadow: 'none',
                        textTransform: 'none',
                        letterSpacing: 'normal',
                        fontWeight: 600
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>
      <div style={container}>{children}</div>
    </div>
  );
}

const nav: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  backdropFilter: 'saturate(1.8) blur(10px)',
  background: 'linear-gradient(180deg, rgba(26,20,16,0.85) 0%, rgba(15,12,9,0.9) 100%)',
  borderBottom: '2px solid',
  borderImage: 'linear-gradient(90deg, transparent, #d4af37, transparent) 1',
  boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
  zIndex: 20
};
const navInner: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 20px',
  maxWidth: 1000,
  margin: '0 auto'
};
const brand: React.CSSProperties = {
  fontFamily: 'Cinzel, serif',
  fontWeight: 900,
  fontSize: 20,
  letterSpacing: 1.2,
  color: '#d4af37',
  textDecoration: 'none',
  textShadow: '0 2px 8px rgba(212,175,55,0.4), 0 0 20px rgba(212,175,55,0.2)'
};
const link: React.CSSProperties = {
  color: '#b8a895',
  textDecoration: 'none',
  fontWeight: 600,
  fontFamily: 'Cinzel, serif',
  fontSize: 14,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  transition: 'color 0.2s ease'
};
const container: React.CSSProperties = { maxWidth: 1000, margin: '0 auto', padding: '20px 16px' };
