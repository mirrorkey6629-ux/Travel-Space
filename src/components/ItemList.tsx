import type { ReactNode } from 'react'

export function ItemList({ children, className = '', as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol' }) {
  const Element = as
  return <Element className={`item-list${className ? ` ${className}` : ''}`}>{children}</Element>
}
