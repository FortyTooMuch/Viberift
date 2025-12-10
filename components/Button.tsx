import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  full?: boolean;
};

export default function Button({ variant = 'primary', full, style, children, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    appearance: 'none',
    border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: 4,
    padding: '11px 18px',
    fontWeight: 700,
    fontFamily: 'Cinzel, serif',
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all .2s ease',
    width: full ? '100%' : undefined,
    boxShadow: '0 4px 12px rgba(212,175,55,.3), inset 0 1px 0 rgba(255,255,255,0.15)'
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, #d4af37 0%, #b8941e 100%)',
      color: '#1a1410',
      borderColor: 'rgba(212,175,55,0.5)'
    },
    secondary: {
      background: 'linear-gradient(145deg, rgba(42,37,32,0.8) 0%, rgba(26,20,16,0.9) 100%)',
      color: '#d4af37',
      border: '1px solid #3d352d'
    },
    ghost: {
      background: 'transparent',
      color: '#b8a895',
      border: '1px solid #3d352d',
      boxShadow: 'none'
    }
  };
  return (
    <button
      {...props}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.98) translateY(1px)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1) translateY(0)';
      }}
      onMouseEnter={(e) => {
        if (variant === 'primary') {
          e.currentTarget.style.background = 'linear-gradient(135deg, #f4cf67 0%, #d4af37 100%)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(212,175,55,.5), inset 0 1px 0 rgba(255,255,255,0.25)';
          e.currentTarget.style.transform = 'scale(1) translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (variant === 'primary') {
          e.currentTarget.style.background = 'linear-gradient(135deg, #d4af37 0%, #b8941e 100%)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(212,175,55,.3), inset 0 1px 0 rgba(255,255,255,0.15)';
          e.currentTarget.style.transform = 'scale(1) translateY(0)';
        }
      }}
    >
      {children}
    </button>
  );
}
