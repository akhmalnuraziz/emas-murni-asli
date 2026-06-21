import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hoverable?: boolean
  padded?: boolean
}

export function Card({ children, className, hoverable, padded = true }: CardProps) {
  return (
    <div className={cn(
      'bg-white border border-slate-200 rounded-xl',
      padded && 'p-5',
      hoverable && 'transition-all duration-150 hover:shadow-md hover:border-slate-300 cursor-pointer',
      className,
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-[13px] font-semibold text-slate-800', className)}>
      {children}
    </h3>
  )
}

export function CardSection({ label, children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 last:mb-0', className)}>
      {label && (
        <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
          {label}
        </p>
      )}
      {children}
    </div>
  )
}
