import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:     'bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800 shadow-sm hover:shadow-md border border-violet-600',
  secondary:   'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-200 border border-slate-200',
  outline:     'bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border border-slate-200 hover:border-slate-300',
  ghost:       'bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200 border border-transparent',
  destructive: 'bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-100 border border-red-200',
}

const SIZES: Record<Size, string> = {
  sm:  'px-3 py-1.5 text-[12px] font-semibold rounded-xl gap-1.5 h-8 min-w-[32px]',
  md:  'px-4 py-2 text-[13px] font-semibold rounded-xl gap-2 h-9 min-w-[36px]',
  lg:  'px-5 py-2.5 text-[14px] font-semibold rounded-2xl gap-2 h-11 min-w-[44px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin flex-shrink-0" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children && <span className="truncate">{children}</span>}
    </button>
  )
}
