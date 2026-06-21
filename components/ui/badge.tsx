import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'violet' | 'gold'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  dot?: boolean
}

const BADGE_STYLES: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-600 border-slate-200',
  success: 'bg-green-50  text-green-700  border-green-100',
  warning: 'bg-amber-50  text-amber-700  border-amber-100',
  error:   'bg-red-50    text-red-700    border-red-100',
  info:    'bg-blue-50   text-blue-700   border-blue-100',
  violet:  'bg-violet-50 text-violet-700 border-violet-100',
  gold:    'bg-gold-50   text-gold-700   border-gold-100',
}

const DOT_COLORS: Record<BadgeVariant, string> = {
  default: 'bg-slate-400',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error:   'bg-red-500',
  info:    'bg-blue-500',
  violet:  'bg-violet-500',
  gold:    'bg-gold-500',
}

export function Badge({ variant = 'default', children, className, dot }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold',
      BADGE_STYLES[variant],
      className,
    )}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', DOT_COLORS[variant])} />}
      {children}
    </span>
  )
}

/* ── Status badge mapping for production statuses ── */
const STATUS_MAP: Record<string, BadgeVariant> = {
  'Cutting':       'info',
  'Pas Berat':     'warning',
  'Annealing':     'gold',
  'Siap Packing':  'success',
  'Sudah Packing': 'violet',
  'Reject':        'error',
  'Press Stamp':   'info',
  'Selesai':       'success',
  'Proses':        'warning',
  'Open':          'info',
  'Partial':       'warning',
  'Closed':        'default',
  'ACC':           'success',
  'Ditolak':       'error',
  'Transit':       'info',
  'Diterima':      'success',
  'Pending':       'warning',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = STATUS_MAP[status] ?? 'default'
  return (
    <Badge variant={variant} dot className={className}>
      {status}
    </Badge>
  )
}
