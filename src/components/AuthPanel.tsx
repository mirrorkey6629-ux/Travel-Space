import type { FormEventHandler, ReactNode } from 'react'

type AuthPanelProps = {
  as?: 'div' | 'form'
  children: ReactNode
  action?: ReactNode
  offset?: boolean
  onSubmit?: FormEventHandler<HTMLFormElement>
}

export function AuthPanel({ as = 'div', children, action, offset = false, onSubmit }: AuthPanelProps) {
  const className = `glass auth-panel${offset ? ' auth-panel-offset' : ''}`
  const content = <>{action && <span className="auth-panel-action">{action}</span>}{children}</>

  if (as === 'form') {
    return <form className={className} onSubmit={onSubmit}>{content}</form>
  }

  return <div className={className}>{content}</div>
}
