import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconButton } from './Button'
import { TypographyGroup } from './TypographyGroup'
import { Avatar } from './Avatar'

type InfoRowAction = {
  icon: ReactNode
  label: string
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  title?: string
  className?: string
  complete?: boolean
}

type InfoRowProps = {
  title: ReactNode
  subtitle?: ReactNode
  metadata?: ReactNode
  image?: string
  imageAlt?: string
  imageFallback?: string
  imageShape?: 'square' | 'circle'
  imageDimmed?: boolean
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  theme?: 'background' | 'transparent'
  actionTheme?: 'primary' | 'secondary' | 'transparent'
  hoverEffect?: boolean
  showActionIndicators?: boolean
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
  imageDimmed = false,
  onClick,
  actions = [],
  theme = 'background',
  actionTheme = 'transparent',
  hoverEffect = false,
  showActionIndicators = false,
  className = '',
  disabled = false,
}: InfoRowProps) {
  const hasTrailing = trailing !== undefined && trailing !== null && trailing !== ''
  const copy = <div className="info-row-copy"><TypographyGroup variant="head-m-text" headingLevel="h3" title={title} text={subtitle} />{metadata !== undefined && metadata !== null && metadata !== '' && <small className="info-row-metadata">{metadata}</small>}</div>
  const content = <>{image && <Avatar className={`info-row-image${imageDimmed ? ' info-row-image-dimmed' : ''}`} src={image} alt={imageAlt} fallback={imageFallback} shape={imageShape} size={theme === 'background' ? 48 : 56} />}{copy}</>

  return <div className={`info-row info-row-${theme}${image ? ' info-row-with-image' : ' info-row-without-image'}${hasTrailing ? ' info-row-with-trailing' : ''}${hoverEffect ? ' info-row-hover-effect' : ''}${disabled ? ' info-row-disabled' : ''} ${className}`.trim()} aria-disabled={disabled || undefined}>
    {onClick ? <button type="button" className="info-row-content info-row-trigger" onClick={onClick} disabled={disabled}>{content}</button> : <div className="info-row-content">{content}</div>}
    {hasTrailing && <div className="info-row-trailing">{trailing}</div>}
    {actions.length > 0 && <div className="info-row-actions">{actions.slice(0, 2).map((action, index) => <IconButton key={`${action.label}-${index}`} type="button" size="m" theme={actionTheme} icon={action.icon} indicator={showActionIndicators && actionTheme === 'secondary' && action.complete} onClick={action.onClick} className={action.className} aria-label={action.label} title={action.title ?? action.label} disabled={disabled} />)}</div>}
  </div>
}
