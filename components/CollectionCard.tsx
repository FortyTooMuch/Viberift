import React from 'react';

interface CollectionCardProps {
  collection: any;
  menuOpen: string | null;
  setMenuOpen: (id: string | null) => void;
  onRename: (c: any) => void;
  onChooseImage: (c: any) => void;
  onDuplicate: (c: any) => void;
  onDelete: (c: any) => void;
}

const CollectionCard: React.FC<CollectionCardProps> = ({
  collection: c,
  menuOpen,
  setMenuOpen,
  onRename,
  onChooseImage,
  onDuplicate,
  onDelete,
}) => {
  const parseImage = (raw?: string | null) => {
    if (!raw) return { src: null, focus: '50% 50%' };
    const [src, hash] = raw.split('#focus=');
    return { src, focus: hash ? decodeURIComponent(hash) : '50% 50%' };
  };
  const { src, focus } = parseImage(c.image_url);
  const menuKey = `collection-${c.id}`;

  return (
    <div style={{ position: 'relative', overflow: 'visible' }}>
      <div
        style={{
          height: 200,
          position: 'relative',
          display: 'block',
          background: src
            ? `linear-gradient(180deg, rgba(10,8,6,0.1) 0%, rgba(10,8,6,0.6) 55%, rgba(10,8,6,0.9) 100%), url(${src})`
            : 'radial-gradient(circle at 20% 20%, rgba(212,175,55,0.18), transparent 30%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.08), transparent 28%), linear-gradient(145deg, rgba(36,29,24,0.95) 0%, rgba(18,14,11,0.97) 55%, rgba(10,8,6,0.98) 100%)',
          backgroundSize: 'cover',
          backgroundPosition: focus,
          overflow: 'hidden',
          transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
          boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
          borderRadius: 10,
          padding: 0,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 24px 48px rgba(0,0,0,0.6)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 18px 40px rgba(0,0,0,0.55)';
        }}
      >
        <div style={{ position: 'relative', height: '100%' }}>
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 48,
              padding: '6px 10px',
              background: 'rgba(15,12,9,0.75)',
              border: '1px solid rgba(212,175,55,0.35)',
              color: '#f4cf67',
              fontSize: 12,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              borderRadius: 999,
              zIndex: 2,
              boxShadow: '0 6px 18px rgba(0,0,0,0.45)'
            }}
          >
            Vault
          </div>
          <a
            href={`/collections/${c.id}`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              cursor: 'pointer',
              zIndex: 1,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(8,6,5,0.05) 0%, rgba(8,6,5,0.55) 60%, rgba(8,6,5,0.82) 100%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative', zIndex: 1, padding: '16px 16px 10px' }}>
              <h3
                style={{
                  margin: 0,
                  fontFamily: 'Cinzel, serif',
                  fontSize: 20,
                  color: '#f8f3e2',
                  textShadow: '0 2px 6px rgba(0,0,0,0.6)',
                }}
              >
                {c.name}
              </h3>
              {c.description && (
                <p
                  className="muted"
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    color: '#ded2bd',
                    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  }}
                >
                  {c.description}
                </p>
              )}
            </div>
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                padding: '12px 16px 16px',
                background: 'linear-gradient(180deg, rgba(12,10,8,0.6) 0%, rgba(8,6,5,0.95) 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#c8bcaa', fontSize: 12 }}>
                <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(212,175,55,0.14)', color: '#f4cf67', border: '1px solid rgba(212,175,55,0.28)' }}>
                  Created {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </a>
        </div>
      </div>
      <button
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen(menuOpen === menuKey ? null : menuKey);
        }}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 10,
          background: 'rgba(15,12,9,0.85)',
          border: 'none',
          borderRadius: 4,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#d4af37',
          fontSize: 18,
          fontWeight: 'bold',
          boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
        }}
      >
        ⋮
      </button>
      {menuOpen === menuKey && (
        <div
          style={{
            position: 'absolute',
            top: 44,
            right: 8,
            zIndex: 11,
            background: 'rgba(15,12,9,0.95)',
            border: '1px solid #d4af37',
            borderRadius: 4,
            boxShadow: '0 4px 16px rgba(0,0,0,0.8)',
            minWidth: 160,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onRename(c);
            }}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              color: '#b8a895',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 14,
              borderBottom: '1px solid rgba(212,175,55,0.2)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Rename
          </button>
          <button
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onChooseImage(c);
            }}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              color: '#b8a895',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 14,
              borderBottom: '1px solid rgba(212,175,55,0.2)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Set Cover Image
          </button>
          <button
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onDuplicate(c);
            }}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              color: '#b8a895',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 14,
              borderBottom: '1px solid rgba(212,175,55,0.2)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Duplicate
          </button>
          <button
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(c);
            }}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              color: '#d9534f',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 14,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(217,83,79,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default CollectionCard;
