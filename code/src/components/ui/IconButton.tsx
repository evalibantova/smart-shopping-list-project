import React from 'react'

type Variant = 'default' | 'accent' | 'coral' | 'danger'

const variantStyles: Record<Variant, React.CSSProperties> = {
  default: { color: 'var(--text-dim)' },
  accent: { color: 'var(--charcoal)' },
  coral: { color: 'var(--coral)' },
  danger: { color: 'var(--red)' },
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function IconButton({ variant = 'default', style, className, ...props }: IconButtonProps) {
  return (
    <button
      className={['rd-act', className].filter(Boolean).join(' ')}
      style={{
        width: 44,
        height: 44,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        transition: 'opacity 0.15s, transform 0.1s',
        flexShrink: 0,
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    />
  )
}
