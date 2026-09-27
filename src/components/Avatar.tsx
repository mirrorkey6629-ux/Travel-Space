import type { CSSProperties } from 'react'

type AvatarProps = {
  src: string
  alt?: string
  fallback?: string
  shape?: 'square' | 'circle'
  size?: number
  className?: string
}

export function Avatar({ src, alt = '', fallback, shape = 'square', size = 56, className = '' }: AvatarProps) {
  return <img className={`avatar avatar-${shape}${className ? ` ${className}` : ''}`} src={src} alt={alt} width={size} height={size} style={{ '--avatar-size': `${size}px` } as CSSProperties} onError={(event) => { if (!fallback || event.currentTarget.dataset.fallbackApplied) return; event.currentTarget.dataset.fallbackApplied = 'true'; event.currentTarget.src = fallback }} />
}
