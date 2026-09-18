import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconButton } from './Button'

type InfoRowAction = {
  icon: ReactNode
  label: string
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  title?: string
  className?: string
}

export function InfoRow({
  title,
  subtitle,
  onClick,
  actions = [],
  actionTheme = 'transparent',
  className = '',
}: {
  title: ReactNode
  subtitle?: ReactNode
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  actions?: InfoRowAction[]
  actionTheme?: 'transparent' | 'secondary'
  className?: string
}) {
  const copy = <><strong>{title}</strong>{subtitle !== undefined && subtitle !== null && subtitle !== '' && <span>{subtitle}</span>}</>

  return <div className={`info-row ${className}`.trim()}>
    {onClick ? <button type="button" className="info-row-copy info-row-trigger" onClick={onClick}>{copy}</button> : <div className="info-row-copy">{copy}</div>}
    {actions.length > 0 && <div className="info-row-actions">{actions.slice(0, 2).map((action, index) => <IconButton key={`${action.label}-${index}`} type="button" size="m" theme={actionTheme} icon={action.icon} onClick={action.onClick} className={action.className} aria-label={action.label} title={action.title ?? action.label} />)}</div>}
  </div>
}
