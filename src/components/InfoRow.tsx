import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconButton } from './Button'

type InfoRowAction = {
  icon: ReactNode
  label: string
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  title?: string
  className?: string
}

type InfoRowProps = {
  title: ReactNode
  subtitle?: ReactNode
  metadata?: ReactNode
  image?: string
  imageAlt?: string
  imageFallback?: string
  imageShape?: 'square' | 'circle'
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  actionTheme?: 'transparent' | 'secondary'
  className?: string
  disabled?: boolean
} & (
  | { trailing?: never; actions?: InfoRowAction[] }
  | { trailing: ReactNode; actions?: never }
)

export function InfoRow({
  title,
  subtitle,
  metadata,
  trailing,
  image,
  imageAlt = '',
  imageFallback,
  imageShape = 'square',
  onClick,
  actions = [],
  actionTheme = 'transparent',
  className = '',
  disabled = false,
}: InfoRowProps) {
  const hasTrailing = trailing !== undefined && trailing !== null && trailing !== ''
  const copy = <><strong>{title}</strong>{subtitle !== undefined && subtitle !== null && subtitle !== '' && <span>{subtitle}</span>}{metadata !== undefined && metadata !== null && metadata !== '' && <small className="info-row-metadata">{metadata}</small>}</>
  const content = <>{image && <img className={`info-row-image info-row-image-${imageShape}`} src={image} alt={imageAlt} onError={(event) => { if (!imageFallback || event.currentTarget.dataset.fallbackApplied) return; event.currentTarget.dataset.fallbackApplied = 'true'; event.currentTarget.src = imageFallback }} />}<div className="info-row-copy">{copy}</div></>

  return <div className={`info-row${image ? ' info-row-with-image' : ' info-row-without-image'}${hasTrailing ? ' info-row-with-trailing' : ''}${disabled ? ' info-row-disabled' : ''} ${className}`.trim()} aria-disabled={disabled || undefined}>
    {onClick ? <button type="button" className="info-row-content info-row-trigger" onClick={onClick} disabled={disabled}>{content}</button> : <div className="info-row-content">{content}</div>}
    {hasTrailing && <div className="info-row-trailing">{trailing}</div>}
    {actions.length > 0 && <div className="info-row-actions">{actions.slice(0, 2).map((action, index) => <IconButton key={`${action.label}-${index}`} type="button" size="m" theme={actionTheme} icon={action.icon} onClick={action.onClick} className={action.className} aria-label={action.label} title={action.title ?? action.label} disabled={disabled} />)}</div>}
  </div>
}
