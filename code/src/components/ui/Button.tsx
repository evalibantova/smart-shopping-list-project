import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import React from 'react'

const buttonVariants = cva(
  [
    'inline-flex items-center gap-2 font-semibold cursor-pointer transition select-none',
    'border-0 outline-none rounded-[var(--radius)]',
    'hover:opacity-[0.88] active:scale-[0.97]',
  ].join(' '),
  {
    variants: {
      intent: {
        primary: 'bg-[var(--charcoal)] text-white',
        coral: 'bg-[var(--coral)] text-white',
        secondary: 'bg-[var(--surface)] text-[var(--text-mid)] shadow-[var(--shadow-sm)]',
        ghost: 'bg-transparent text-[var(--text-dim)]',
        amber: 'bg-[var(--amber-pale)] text-[var(--amber)]',
        danger: 'bg-[var(--red-pale)] text-[var(--red)]',
      },
      size: {
        default: 'h-10 px-4 text-sm',
        sm: 'h-8 px-3 text-xs',
        xs: 'h-6 px-2 text-xs',
      },
    },
    defaultVariants: {
      intent: 'primary',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, intent, size, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(buttonVariants({ intent, size }), className)}
      {...props}
    />
  )
}
