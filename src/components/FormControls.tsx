import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

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

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  content: 'date' | 'list'
  icon?: ReactNode
  controlClassName?: string
  children: ReactNode
}

export function Select({ content, icon, controlClassName = '', children, ...props }: SelectProps) {
  return (
    <span className={`form-control form-select form-select-${content}${icon ? ' form-control-with-icon' : ''}${controlClassName ? ` ${controlClassName}` : ''}`}>
      {icon && <span className="form-control-icon">{icon}</span>}
      <select {...props}>{children}</select>
    </span>
  )
}
