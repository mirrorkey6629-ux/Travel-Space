import type { ReactNode } from 'react'
import { TypographyGroup } from './TypographyGroup'

type FormControlListProps = {
  children: ReactNode
  className?: string
  gap?: 8 | 12 | 16 | 24
  headline?: ReactNode
  text?: ReactNode
}

type FormControlRowProps = {
  children: ReactNode
  className?: string
  columns?: 1 | 2
}

export function FormControlList({ children, className = '', gap = 8, headline, text }: FormControlListProps) {
  const hasHeadline = headline !== undefined && headline !== null && headline !== ''
  const hasText = text !== undefined && text !== null && text !== ''
  return <div className={`form-control-list form-control-list-gap-${gap}${className ? ` ${className}` : ''}`}>{(hasHeadline || hasText) && <TypographyGroup className="form-control-list-heading" variant="head-m-text" headingLevel="h3" title={headline} text={text} />}<div className="form-control-list-content">{children}</div></div>
}

export function FormControlRow({ children, className = '', columns = 1 }: FormControlRowProps) {
  return <div className={`form-control-row form-control-row-columns-${columns}${className ? ` ${className}` : ''}`}>{children}</div>
}
