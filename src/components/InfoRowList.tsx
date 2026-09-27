import type { ReactNode } from 'react'

export function InfoRowList({ children, className = '', gap = 4, headline }: { children: ReactNode; className?: string; gap?: 4 | 8 | 16; headline?: ReactNode }) {
  return <div className={`info-row-list info-row-list-gap-${gap}${className ? ` ${className}` : ''}`}>{headline !== undefined && headline !== null && headline !== '' && <h3 className="info-row-list-headline">{headline}</h3>}{children}</div>
}
