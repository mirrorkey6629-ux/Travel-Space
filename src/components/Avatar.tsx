import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'

type AvatarProps = {
  src: string
  alt?: string
  fallback?: string
  shape?: 'square' | 'circle'
  size?: number
  className?: string
  hoverEffect?: boolean
  hoverIcon?: ReactNode
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  disabled?: boolean
  actionLabel?: string
}

export function Avatar({ src, alt = '', fallback, shape = 'square', size = 56, className = '', hoverEffect = false, hoverIcon, onClick, disabled = false, actionLabel }: AvatarProps) {
  const style = { '--avatar-size': `${size}px` } as CSSProperties
  const image = <img className={`avatar avatar-${shape}`} src={src} alt={alt} width={size} height={size} onError={(event) => { if (!fallback || event.currentTarget.dataset.fallbackApplied) return; event.currentTarget.dataset.fallbackApplied = 'true'; event.currentTarget.src = fallback }} />

  if (!hoverEffect && !onClick) return <img className={`avatar avatar-${shape}${className ? ` ${className}` : ''}`} src={src} alt={alt} width={size} height={size} style={style} onError={(event) => { if (!fallback || event.currentTarget.dataset.fallbackApplied) return; event.currentTarget.dataset.fallbackApplied = 'true'; event.currentTarget.src = fallback }} />

  const content = <>{image}{hoverEffect && <span className="avatar-hover-overlay" aria-hidden="true">{hoverIcon ?? <Icon name="edit" size={Math.min(32, Math.max(20, size / 3))} />}</span>}</>
  const controlClassName = `avatar-control avatar-${shape}${hoverEffect ? ' avatar-control-hover' : ''}${className ? ` ${className}` : ''}`

  if (onClick) return <button className={controlClassName} type="button" style={style} onClick={onClick} disabled={disabled} aria-label={actionLabel}>{content}</button>
  return <span className={controlClassName} style={style}>{content}</span>
}
