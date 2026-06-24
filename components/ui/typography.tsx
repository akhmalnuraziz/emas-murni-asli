import { cn } from '@/lib/utils'

type Props = { children: React.ReactNode; className?: string }

export const Title1   = ({ children, className }: Props) =>
  <h1 className={cn('text-[24px] font-bold text-slate-900 tracking-tight leading-tight', className)}>{children}</h1>

export const Title2   = ({ children, className }: Props) =>
  <h2 className={cn('text-[20px] font-bold text-slate-900 tracking-tight leading-tight', className)}>{children}</h2>

export const Title3   = ({ children, className }: Props) =>
  <h3 className={cn('text-[18px] font-semibold text-slate-800 leading-snug', className)}>{children}</h3>

export const Headline = ({ children, className }: Props) =>
  <p className={cn('text-[16px] font-semibold text-slate-800', className)}>{children}</p>

export const Body     = ({ children, className }: Props) =>
  <p className={cn('text-[15px] font-normal text-slate-700 leading-relaxed', className)}>{children}</p>

export const Subhead  = ({ children, className }: Props) =>
  <p className={cn('text-[13px] font-normal text-slate-700', className)}>{children}</p>

export const Footnote = ({ children, className }: Props) =>
  <p className={cn('text-[12px] font-normal text-slate-500', className)}>{children}</p>

export const Caption  = ({ children, className }: Props) =>
  <p className={cn('text-[11px] font-medium text-slate-400', className)}>{children}</p>

export const Caption2 = ({ children, className }: Props) =>
  <p className={cn('text-[10px] font-semibold text-slate-400 uppercase tracking-widest', className)}>{children}</p>
