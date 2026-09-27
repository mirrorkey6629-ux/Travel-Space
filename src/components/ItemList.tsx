import type { ReactNode } from 'react'

export function ItemList({ children, className = '', as = 'div', headline }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol'; headline?: ReactNode }) {
  const Element = as
  if (headline !== undefined && headline !== null && headline !== '') {
    return <div className={`item-list-group${className ? ` ${className}` : ''}`}><h3 className="item-list-headline">{headline}</h3><Element className="item-list">{children}</Element></div>
  }
  return <Element className={`item-list${className ? ` ${className}` : ''}`}>{children}</Element>
}
