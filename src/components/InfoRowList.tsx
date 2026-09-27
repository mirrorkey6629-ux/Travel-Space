import type { ReactNode } from 'react'
import { TypographyGroup } from './TypographyGroup'

export function InfoRowList({ children, className = '', gap = 8, headline, text }: { children: ReactNode; className?: string; gap?: 4 | 8 | 16; headline?: ReactNode; text?: ReactNode }) {
  const hasHeadline = headline !== undefined && headline !== null && headline !== ''
  const hasText = text !== undefined && text !== null && text !== ''
  return <div className={`info-row-list info-row-list-gap-${gap}${className ? ` ${className}` : ''}`}>{(hasHeadline || hasText) && <TypographyGroup className="info-row-list-heading" variant="head-m-text" headingLevel="h3" title={headline} text={text} />}<div className="info-row-list-content">{children}</div></div>
}
