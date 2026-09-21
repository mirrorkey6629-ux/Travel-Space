import type { ReactNode } from 'react'

type IconTextProps = { children: ReactNode; className?: string } & (
  | { icon: ReactNode; checked?: never }
  | { icon?: never; checked: boolean }
)

export function IconText({ icon, checked, children, className = '' }: IconTextProps) {
  const checkbox = checked !== undefined
  return <span className={`icon-text${checkbox ? ' icon-text-checkbox' : ''}${className ? ` ${className}` : ''}`}><span className="icon-text-icon" aria-hidden={!checkbox}>{checkbox ? <span className={`document-check${checked ? ' checked' : ''}`} role="checkbox" aria-checked={checked} /> : icon}</span><span className="icon-text-label">{children}</span></span>
}
