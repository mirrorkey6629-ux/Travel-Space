import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

type InputBaseProps = {
  icon?: ReactNode
  trailingIcon?: ReactNode
  trailingIconLabel?: string
  onTrailingIconClick?: () => void
  label?: ReactNode
  showIcon?: boolean
  showLabel?: boolean
  controlClassName?: string
  fieldClassName?: string
}

type InputProps = InputBaseProps & (
  | (InputHTMLAttributes<HTMLInputElement> & { content?: 'text'; onValueChange?: never })
  | (Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & { content: 'money'; value: number; onValueChange: (value: number) => void })
)

export function Input(props: InputProps) {
  const [moneyFocused, setMoneyFocused] = useState(false)
  const { icon, trailingIcon, trailingIconLabel, onTrailingIconClick, label, showIcon = true, showLabel = true, controlClassName = '', fieldClassName = '', content = 'text', ...inputProps } = props
  const money = content === 'money'
  const moneyValue = money ? Number(props.value) : 0
  const resolvedIcon = money ? icon ?? <Icon name="money-bag" /> : icon
  const resolvedControlClassName = `${money ? 'money-input' : ''}${controlClassName ? ` ${controlClassName}` : ''}`.trim()
  const resolvedInputProps = money
    ? {
        ...inputProps,
        type: 'text',
        inputMode: 'numeric' as const,
        placeholder: inputProps.placeholder ?? 'Общая сумма, ₽',
        value: moneyValue > 0 ? (moneyFocused ? String(moneyValue) : `${moneyValue.toLocaleString('ru-RU')} ₽`) : '',
        onFocus: (event: React.FocusEvent<HTMLInputElement>) => { setMoneyFocused(true); props.onFocus?.(event) },
        onBlur: (event: React.FocusEvent<HTMLInputElement>) => { setMoneyFocused(false); props.onBlur?.(event) },
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onValueChange?.(Math.max(0, Number.parseInt(event.target.value.replace(/\D/g, ''), 10) || 0)),
      }
    : inputProps
  const floatingLabel = showLabel ? label ?? resolvedInputProps.placeholder : undefined
  const floatingPlaceholder = floatingLabel
    ? label ? resolvedInputProps.placeholder ?? ' ' : ' '
    : resolvedInputProps.placeholder
  const control = (
    <span className={`form-control${floatingLabel ? ' form-control-floating' : ''}${showIcon && resolvedIcon ? ' form-control-with-icon' : ''}${trailingIcon ? ' form-control-with-trailing-icon' : ''}${resolvedControlClassName ? ` ${resolvedControlClassName}` : ''}`}>
      {showIcon && resolvedIcon && <span className="form-control-icon">{resolvedIcon}</span>}
      <span className="form-control-input">
        {floatingLabel && <span className="form-control-floating-label">{floatingLabel}</span>}
        <input {...resolvedInputProps} placeholder={floatingPlaceholder} />
      </span>
      {trailingIcon && (onTrailingIconClick
        ? <button className="form-control-trailing-icon" type="button" onClick={onTrailingIconClick} aria-label={trailingIconLabel}>{trailingIcon}</button>
        : <span className="form-control-trailing-icon" aria-hidden="true">{trailingIcon}</span>)}
    </span>
  )
  if (floatingLabel) return <label className={`field floating-field${fieldClassName ? ` ${fieldClassName}` : ''}`}>{control}</label>
  return control
}

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  icon?: ReactNode
  label: ReactNode
  displayValue?: ReactNode
}

export function DateInput({ icon, label, displayValue, disabled, ...props }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return <label className="form-control form-date-input" onClick={(event) => {
    event.preventDefault()
    if (!inputRef.current?.disabled) inputRef.current?.showPicker()
  }}>
    {icon && <span className="form-control-icon">{icon}</span>}
    <span className="form-control-copy"><span className="form-control-copy-label">{label}</span><span>{displayValue}</span></span>
    <input ref={inputRef} {...props} disabled={disabled} type="date" />
  </label>
}

type TimeZoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  icon?: ReactNode
  label: ReactNode
  secondaryText: ReactNode
  secondaryLabel: string
  secondaryValue: string
  secondaryOptions: { value: string; label: string }[]
  onSecondaryChange: (value: string) => void
}

export function TimeZoneInput({ icon, label, secondaryText, secondaryLabel, secondaryValue, secondaryOptions, onSecondaryChange, disabled, ...props }: TimeZoneInputProps) {
  return <label className="form-control form-time-zone-input">
    {icon && <span className="form-control-icon">{icon}</span>}
    <span className="form-control-copy"><span className="form-control-copy-label">{label}</span><input {...props} disabled={disabled} type="time" /></span>
    <span className="form-control-secondary-select"><span>{secondaryText}</span><select aria-label={secondaryLabel} disabled={disabled} value={secondaryValue} onChange={(event) => onSecondaryChange(event.target.value)}>{secondaryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></span>
  </label>
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

type NativeSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  type: 'date' | 'time'
  label?: ReactNode
  showLabel?: boolean
  icon?: ReactNode
  displayValue?: ReactNode
  secondaryText?: ReactNode
  controlClassName?: string
  children: ReactNode
}

type AssigneeSelectProps = {
  type: 'assignee'
  label?: ReactNode
  showLabel?: boolean
  icon?: ReactNode
  options: { value: string; label: string }[]
  value: string[]
  emptyLabel?: string
  disabled?: boolean
  onValueChange: (value: string[]) => void
}

type SelectProps = NativeSelectProps | AssigneeSelectProps

function AssigneeSelect({ label, showLabel = true, icon, options, value, emptyLabel = 'Не назначен', disabled = false, onValueChange }: Omit<AssigneeSelectProps, 'type'>) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const selectedLabels = options.filter((option) => value.includes(option.value)).map((option) => option.label)
  const floatingLabel = showLabel ? label ?? emptyLabel : undefined
  return <div className={`assignee-select${open ? ' open' : ''}`} ref={containerRef}>
    <button className={`form-control${floatingLabel ? ' form-control-floating' : ''} assignee-select-trigger`} type="button" data-filled={floatingLabel && selectedLabels.length > 0 || undefined} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      {icon && <span className="form-control-icon">{icon}</span>}
      <span className="form-control-input">
        {floatingLabel && <span className="form-control-floating-label">{floatingLabel}</span>}
        <span className="assignee-select-value">{selectedLabels.length > 0 ? selectedLabels.join(', ') : floatingLabel ? '\u00a0' : emptyLabel}</span>
      </span>
    </button>
    {open && <div className="assignee-select-menu" role="listbox" aria-multiselectable="true">
      {options.map((option) => {
        const selected = value.includes(option.value)
        return <button key={option.value} type="button" role="option" aria-selected={selected} onClick={() => onValueChange(selected ? value.filter((item) => item !== option.value) : [...value, option.value])}>
          <span className={`document-check${selected ? ' checked' : ''}`} aria-hidden="true" />
          <span>{option.label}</span>
        </button>
      })}
    </div>}
  </div>
}

export function Select(props: SelectProps) {
  if (props.type === 'assignee') {
    const { type: _type, ...assigneeProps } = props
    return <AssigneeSelect {...assigneeProps} />
  }
  const { type, label, showLabel = true, icon, displayValue, secondaryText, controlClassName = '', children, ...selectProps } = props
  const floatingLabel = showLabel ? label : undefined
  const hasValue = Boolean(selectProps.value ?? selectProps.defaultValue)
  return (
    <span className={`form-control form-select form-select-${type}${floatingLabel ? ' form-select-floating' : ''}${icon ? ' form-control-with-icon' : ''}${displayValue !== undefined ? ' form-select-with-display-value' : ''}${controlClassName ? ` ${controlClassName}` : ''}`} data-filled={floatingLabel && hasValue || undefined}>
      {icon && <span className="form-control-icon">{icon}</span>}
      <span className="form-control-input">
        {floatingLabel && <span className="form-control-floating-label">{floatingLabel}</span>}
        {displayValue !== undefined && <span className="form-select-display-value" aria-hidden="true">{displayValue}</span>}
        <select {...selectProps}>{children}</select>
      </span>
      {type === 'time' && secondaryText !== undefined && <span className="form-select-secondary-text">{secondaryText}</span>}
    </span>
  )
}
