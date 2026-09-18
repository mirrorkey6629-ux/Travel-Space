import type { ReactNode } from 'react'

export function SecondaryText({ children, interactive = false, className = '' }: { children: ReactNode; interactive?: boolean; className?: string }) {
  return <span className={`secondary-text${interactive ? ' secondary-text-interactive' : ''}${className ? ` ${className}` : ''}`}>{children}</span>
}
