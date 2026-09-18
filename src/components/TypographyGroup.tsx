import type { ReactNode } from 'react'

type HeadingLevel = 'h1' | 'h2' | 'h3'
type TypographyGroupVariant = 'head-l-text' | 'head-m-text'

export function TypographyGroup({
  title,
  text,
  headingLevel = 'h1',
  variant = 'head-l-text',
  className = '',
}: {
  title: ReactNode
  text?: ReactNode
  headingLevel?: HeadingLevel
  variant?: TypographyGroupVariant
  className?: string
}) {
  const Heading = headingLevel
  return <div className={`typography-group typography-group-${variant} ${className}`.trim()}><Heading className="typography-group-title">{title}</Heading>{text !== undefined && text !== null && text !== '' && <div className="typography-group-text">{text}</div>}</div>
}
