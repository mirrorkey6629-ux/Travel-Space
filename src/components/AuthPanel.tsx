import type { FormEventHandler, ReactNode } from 'react'

type AuthPanelProps = {
  as?: 'div' | 'form'
  children: ReactNode
  offset?: boolean
  onSubmit?: FormEventHandler<HTMLFormElement>
}

export function AuthPanel({ as = 'div', children, offset = false, onSubmit }: AuthPanelProps) {
  const className = `glass auth-panel${offset ? ' auth-panel-offset' : ''}`

  if (as === 'form') {
    return <form className={className} onSubmit={onSubmit}>{children}</form>
  }

  return <div className={className}>{children}</div>
}
