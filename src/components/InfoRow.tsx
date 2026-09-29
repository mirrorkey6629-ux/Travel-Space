import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { IconButton } from './Button'
import { TypographyGroup } from './TypographyGroup'
import { Avatar } from './Avatar'
import { FieldError } from './FormControls'

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
  titleStyle?: 'head-m' | 'text'
  subtitle?: ReactNode
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
  error?: ReactNode
} & (
  | { trailing?: never; actions?: InfoRowAction[] }
  | { trailing: ReactNode; actions?: never }
)

export function InfoRow({
  title,
  titleStyle = 'head-m',
  subtitle,
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
  error,
}: InfoRowProps) {
  const errorId = useId()
  const hasTrailing = trailing !== undefined && trailing !== null && trailing !== ''
  const resolvedTitleStyle = theme === 'background' ? 'text' : titleStyle
  const copy = <div className="info-row-copy"><TypographyGroup variant={resolvedTitleStyle === 'text' ? 'text-text' : 'head-m-text'} headingLevel="h3" title={title} text={subtitle} /></div>
  const content = <>{image && <Avatar className={`info-row-image${imageDimmed ? ' info-row-image-dimmed' : ''}`} src={image} alt={imageAlt} fallback={imageFallback} shape={imageShape} size={theme === 'background' ? 48 : 56} />}{copy}</>

  const row = <div className={`info-row info-row-${theme}${image ? ' info-row-with-image' : ' info-row-without-image'}${hasTrailing ? ' info-row-with-trailing' : ''}${hoverEffect ? ' info-row-hover-effect' : ''}${disabled ? ' info-row-disabled' : ''} ${className}`.trim()} aria-disabled={disabled || undefined} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}>
    {onClick ? <button type="button" className="info-row-content info-row-trigger" onClick={onClick} disabled={disabled}>{content}</button> : <div className="info-row-content">{content}</div>}
    {hasTrailing && <div className="info-row-trailing">{trailing}</div>}
    {actions.length > 0 && <div className="info-row-actions">{actions.slice(0, 2).map((action, index) => <IconButton key={`${action.label}-${index}`} type="button" size="m" theme={actionTheme} icon={action.icon} indicator={showActionIndicators && actionTheme === 'secondary' && action.complete} onClick={action.onClick} className={action.className} aria-label={action.label} title={action.title ?? action.label} disabled={disabled} />)}</div>}
  </div>
  return error ? <div className="info-row-field">{row}<FieldError id={errorId}>{error}</FieldError></div> : row
}
