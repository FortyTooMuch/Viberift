import React from 'react';

type ModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div style={backdrop}>
      <div style={sheet}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: '#d4af37' }}>{title}</h3>
          <button 
            onClick={onClose} 
            style={closeBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)';
              e.currentTarget.style.borderColor = '#d4af37';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = '#3d352d';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 12, 9, 0.85)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 100,
  overflowY: 'auto'
};
const sheet: React.CSSProperties = {
  width: '100%',
  maxWidth: 540,
  maxHeight: 'calc(100vh - 32px)',
  overflowY: 'auto',
  background: 'linear-gradient(145deg, rgba(42,37,32,0.95) 0%, rgba(26,20,16,0.98) 100%)',
  border: '2px solid #3d352d',
  borderRadius: 6,
  padding: 20,
  boxShadow: '0 20px 50px rgba(0,0,0,0.8), inset 0 1px 0 rgba(212,175,55,0.15)',
  animation: 'slideUp 0.3s ease-out',
  margin: 'auto'
};
const closeBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#d4af37',
  border: '1px solid #3d352d',
  width: 32,
  height: 32,
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 18,
  fontWeight: 'bold',
  lineHeight: '1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
  padding: 0,
  boxShadow: 'none'
};
