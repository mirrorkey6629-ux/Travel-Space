import type { ReactNode } from 'react'

export function ItemList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`item-list${className ? ` ${className}` : ''}`}>{children}</div>
}
