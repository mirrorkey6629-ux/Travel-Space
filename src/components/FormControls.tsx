import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode
  trailingIcon?: ReactNode
  trailingIconLabel?: string
  onTrailingIconClick?: () => void
  label?: ReactNode
  theme?: 'default' | 'accent'
  showIcon?: boolean
  showLabel?: boolean
  controlClassName?: string
  fieldClassName?: string
}

export function Input({ icon, trailingIcon, trailingIconLabel, onTrailingIconClick, label, theme = 'default', showIcon = true, showLabel = true, controlClassName = '', fieldClassName = '', ...props }: InputProps) {
  const control = (
    <span className={`form-control form-control-${theme}${showIcon && icon ? ' form-control-with-icon' : ''}${trailingIcon ? ' form-control-with-trailing-icon' : ''}${controlClassName ? ` ${controlClassName}` : ''}`}>
      {showIcon && icon && <span className="form-control-icon">{icon}</span>}
      <input {...props} />
      {trailingIcon && (onTrailingIconClick
        ? <button className="form-control-trailing-icon" type="button" onClick={onTrailingIconClick} aria-label={trailingIconLabel}>{trailingIcon}</button>
        : <span className="form-control-trailing-icon" aria-hidden="true">{trailingIcon}</span>)}
    </span>
  )
  if (showLabel && label) return <label className={`field${fieldClassName ? ` ${fieldClassName}` : ''}`}><span>{label}</span>{control}</label>
  return control
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode
  controlClassName?: string
  fieldClassName?: string
}

export function Textarea({ label, controlClassName = '', fieldClassName = '', ...props }: TextareaProps) {
  const control = <span className={`form-control form-textarea${controlClassName ? ` ${controlClassName}` : ''}`}><textarea {...props} /></span>
  return label ? <label className={`field${fieldClassName ? ` ${fieldClassName}` : ''}`}><span>{label}</span>{control}</label> : control
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  content: 'date' | 'list'
  icon?: ReactNode
  displayValue?: ReactNode
  controlClassName?: string
  children: ReactNode
}

export function Select({ content, icon, displayValue, controlClassName = '', children, ...props }: SelectProps) {
  return (
    <span className={`form-control form-select form-select-${content}${icon ? ' form-control-with-icon' : ''}${displayValue !== undefined ? ' form-select-with-display-value' : ''}${controlClassName ? ` ${controlClassName}` : ''}`}>
      {icon && <span className="form-control-icon">{icon}</span>}
      {displayValue !== undefined && <span className="form-select-display-value" aria-hidden="true">{displayValue}</span>}
      <select {...props}>{children}</select>
    </span>
  )
}
