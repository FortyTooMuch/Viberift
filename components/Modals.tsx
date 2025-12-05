import React, { useEffect, useRef, useState } from 'react';
import Button from './Button';
import Modal from './Modal';

// --- Props Interfaces ---
export interface ModalProps {
  open: boolean;
  title: string;
  inputValue?: string;
  setInputValue?: (v: string) => void;
  onClose: () => void;
  onAction: () => void;
  actionLabel: string;
  loading?: boolean;
  children?: React.ReactNode;
}

export const TextInputModal: React.FC<ModalProps> = ({
  open, title, inputValue = '', setInputValue, onClose, onAction, actionLabel, children
}) => (
  <Modal open={open} title={title} onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <input
        type="text"
        value={inputValue}
        onChange={e => setInputValue && setInputValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onAction()}
        autoFocus
        style={{
          width: '100%',
          padding: '0.75rem 0.75rem',
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          borderRadius: 6,
          color: '#f0e6d2',
          fontSize: 14,
          boxSizing: 'border-box'
        }}
      />
      {children}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onAction}>{actionLabel}</Button>
      </div>
    </div>
  </Modal>
);

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  danger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open, title, message, onClose, onConfirm, confirmLabel, danger
}) => (
  <Modal open={open} title={title} onClose={onClose}>
    <p>{message}</p>
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button onClick={onConfirm} style={danger ? { background: '#d9534f', color: '#fff' } : {}}>{confirmLabel}</Button>
    </div>
  </Modal>
);

export interface ImageModalProps {
  open: boolean;
  title: string;
  cardSearch: string;
  setCardSearch: (v: string) => void;
  loadingCards: boolean;
  vaultCards: any[];
  onChoose: (url: string, focus?: string) => void;
  onClose: () => void;
  emptyText: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  open, title, cardSearch, setCardSearch, loadingCards, vaultCards, onChoose, onClose, emptyText
}) => {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Reset selection when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedUrl(null);
      setFocus({ x: 50, y: 50 });
      setIsDragging(false);
    }
  }, [open]);

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const updateFocusFromEvent = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100);
    setFocus({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  };

  const attachFocus = (url: string, pos: { x: number; y: number }) =>
    `${url}#focus=${encodeURIComponent(`${pos.x}% ${pos.y}%`)}`;

  const parseFocus = (url: string | null) => {
    if (!url) return { base: null, focus: { x: 50, y: 50 } };
    const [base, hash] = url.split('#focus=');
    if (!hash) return { base, focus: { x: 50, y: 50 } };
    try {
      const decoded = decodeURIComponent(hash);
      const [x, y] = decoded.split(' ').map(v => parseFloat(v.replace('%', '')));
      if (Number.isFinite(x) && Number.isFinite(y)) {
        return { base, focus: { x, y } };
      }
    } catch (err) {
      // ignore parse issues
    }
    return { base, focus: { x: 50, y: 50 } };
  };

  const filteredCards = vaultCards.filter((c: any) =>
    !cardSearch.trim() || c.card?.name?.toLowerCase().includes(cardSearch.trim().toLowerCase())
  );

  const handleSave = () => {
    if (!selectedUrl) return;
    const parsed = parseFocus(selectedUrl);
    const finalUrl = attachFocus(parsed.base ?? selectedUrl, focus);
    onChoose(finalUrl, `${focus.x}% ${focus.y}%`);
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <input
        type="text"
        placeholder="Search cards..."
        value={cardSearch}
        onChange={e => setCardSearch(e.target.value)}
        autoFocus
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'rgba(26,20,16,0.6)',
          border: '1px solid #3d352d',
          borderRadius: 4,
          color: '#e8dcc4',
          fontSize: 14,
          marginBottom: 16,
        }}
      />
      {loadingCards ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ animation: 'pulse 2s infinite' }}>Loading cards...</div>
        </div>
      ) : vaultCards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <p className="muted">{emptyText}</p>
          <Button variant="ghost" onClick={onClose} style={{ marginTop: 12 }}>Close</Button>
        </div>
      ) : (
        <>
          <div style={{
            maxHeight: 320,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 12,
          }}>
            {filteredCards.map((c: any) => (
              <div
                key={c.id}
                style={{
                  cursor: 'pointer',
                  border: selectedUrl === c.card?.image_url ? '2px solid #d4af37' : '2px solid transparent',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#1a140f'
                }}
                onClick={() => {
                  setSelectedUrl(c.card?.image_url);
                  const parsed = parseFocus(c.card?.image_url ?? null);
                  setFocus(parsed.focus);
                }}
              >
                <img src={c.card?.image_url} alt={c.card?.name} style={{ width: '100%', height: 100, objectFit: 'cover' }} />
                <div style={{ padding: 6, fontSize: 12, color: '#e8dcc4', textAlign: 'center' }}>{c.card?.name}</div>
              </div>
            ))}
          </div>

          {selectedUrl && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: '#e8dcc4' }}>Drag to set the visible area</div>
                <div style={{ fontSize: 12, color: '#b8a895' }}>{`${focus.x}% ${focus.y}%`}</div>
              </div>
              <div
                ref={previewRef}
                onMouseDown={e => { setIsDragging(true); updateFocusFromEvent(e); }}
                onMouseMove={e => { if (isDragging) updateFocusFromEvent(e); }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                style={{
                  height: 180,
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: '1px solid rgba(212,175,55,0.3)',
                  backgroundImage: `url(${parseFocus(selectedUrl).base ?? selectedUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: `${focus.x}% ${focus.y}%`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                  cursor: 'grab',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <Button variant="ghost" onClick={() => setFocus({ x: 50, y: 50 })}>Reset</Button>
                <Button onClick={handleSave}>Save cover</Button>
              </div>
            </div>
          )}

          {!selectedUrl && (
            <Button variant="ghost" onClick={onClose} style={{ marginTop: 12 }}>Close</Button>
          )}
        </>
      )}
    </Modal>
  );
};
