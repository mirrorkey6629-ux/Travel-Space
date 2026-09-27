import type { ReactNode } from 'react'

type TextareaListProps = {
  children: ReactNode
  className?: string
  headline?: ReactNode
}

export function TextareaList({ children, className = '', headline }: TextareaListProps) {
  return <div className={`textarea-list${className ? ` ${className}` : ''}`}>
    {headline !== undefined && headline !== null && headline !== '' && <h3 className="textarea-list-headline">{headline}</h3>}
    {children}
  </div>
}
