import type { ReactNode } from 'react'
import { TypographyGroup } from './TypographyGroup'

export function InfoRowList({ children, className = '', rowTheme = 'background', gap, headline, text }: { children: ReactNode; className?: string; rowTheme?: 'background' | 'transparent'; gap?: 4 | 8 | 16; headline?: ReactNode; text?: ReactNode }) {
  const hasHeadline = headline !== undefined && headline !== null && headline !== ''
  const hasText = text !== undefined && text !== null && text !== ''
  const resolvedGap = gap ?? (rowTheme === 'transparent' ? 4 : 8)
  return <div className={`info-row-list info-row-list-${rowTheme} info-row-list-gap-${resolvedGap}${className ? ` ${className}` : ''}`}>{(hasHeadline || hasText) && <TypographyGroup className="info-row-list-heading" variant="head-m-text" headingLevel="h3" title={headline} text={text} />}<div className="info-row-list-content">{children}</div></div>
}
