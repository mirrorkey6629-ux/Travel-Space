import type { ReactNode } from 'react'

type FormControlListProps = {
  children: ReactNode
  className?: string
  gap?: 8 | 12 | 16 | 24
  headline?: ReactNode
}

type FormControlRowProps = {
  children: ReactNode
  className?: string
  columns?: 1 | 2
}

export function FormControlList({ children, className = '', gap = 8, headline }: FormControlListProps) {
  return <div className={`form-control-list form-control-list-gap-${gap}${className ? ` ${className}` : ''}`}>{headline !== undefined && headline !== null && headline !== '' && <h3 className="form-control-list-headline">{headline}</h3>}{children}</div>
}

export function FormControlRow({ children, className = '', columns = 1 }: FormControlRowProps) {
  return <div className={`form-control-row form-control-row-columns-${columns}${className ? ` ${className}` : ''}`}>{children}</div>
}
