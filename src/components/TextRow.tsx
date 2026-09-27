import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'

type TextRowProps = {
  children: ReactNode
  className?: string
  hoverEffect?: boolean
} & (
  | { showIcon: false; iconType?: never; icon?: never; checkboxState?: never }
  | { showIcon?: true; iconType: 'icon'; icon: ReactNode; checkboxState?: never }
  | { showIcon?: true; iconType: 'checkbox'; icon?: never; checkboxState: 'on' | 'off' }
)

export function TextRow(props: TextRowProps) {
  const { children, className = '', hoverEffect = false } = props
  const showIcon = props.showIcon !== false
  const checkbox = showIcon && props.iconType === 'checkbox'

  return <span className={`text-row${checkbox ? ' text-row-checkbox' : ''}${hoverEffect ? ' text-row-hover-effect' : ''}${className ? ` ${className}` : ''}`}>
    {showIcon && <span className="text-row-icon" aria-hidden={!checkbox} role={checkbox ? 'checkbox' : undefined} aria-checked={checkbox ? props.checkboxState === 'on' : undefined}>{checkbox ? <Icon name={props.checkboxState === 'on' ? 'checkbox-filled' : 'checkbox-empty'} /> : props.icon}</span>}
    <span className="text-row-label">{children}</span>
  </span>
}

export function CheckboxTextRow({ checked, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { checked: boolean }) {
  return <button type="button" className={`checkbox-text-row${className ? ` ${className}` : ''}`} {...props}><TextRow iconType="checkbox" checkboxState={checked ? 'on' : 'off'} hoverEffect>{children}</TextRow></button>
}
