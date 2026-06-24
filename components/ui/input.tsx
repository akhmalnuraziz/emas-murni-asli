import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId}
            className="block text-[11px] font-medium text-slate-500 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-slate-400">{icon}</span>
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-white border rounded-lg text-[13px] text-slate-900',
              'placeholder:text-slate-400 placeholder:font-normal font-normal',
              'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100/60',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-150',
              error
                ? 'border-red-300 focus:border-red-400 focus:ring-red-100 bg-red-50'
                : 'border-slate-200',
              icon ? 'pl-9 pr-3 py-2' : 'px-3 py-2',
              className,
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-[11px] text-red-500 mt-1 font-medium">{error}</p>
        )}
        {hint && !error && (
          <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

/* ── Select ── */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, id, children, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId}
            className="block text-[11px] font-medium text-slate-500 mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'w-full bg-slate-50 border rounded-lg text-[13px] text-slate-900 px-3 py-2',
            'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100/60',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-150',
            error ? 'border-red-300' : 'border-slate-200',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="text-[11px] text-red-500 mt-1 font-medium">{error}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

/* ── Textarea ── */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId}
            className="block text-[11px] font-medium text-slate-500 mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full bg-slate-50 border rounded-lg text-[13px] text-slate-900 px-3 py-2',
            'placeholder:text-slate-400 font-normal',
            'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100/60',
            'disabled:opacity-50 disabled:cursor-not-allowed resize-y',
            'transition-all duration-150',
            error ? 'border-red-300' : 'border-slate-200',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-[11px] text-red-500 mt-1 font-medium">{error}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
