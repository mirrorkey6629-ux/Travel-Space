import type { HTMLAttributes, ReactNode } from 'react'
import { TypographyGroup } from './TypographyGroup'

type FormPanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  scrollable?: boolean
}

type FormPanelLayoutProps = {
  children: ReactNode
  action?: ReactNode
  className?: string
}

type FormPanelGroupProps = {
  children: ReactNode
  className?: string
  gap?: 8 | 24 | 32
  as?: 'div' | 'fieldset'
  disabled?: boolean
  flatten?: boolean
  order?: 'first' | 'normal' | 'last'
}

type FormPanelHeaderProps = {
  title: ReactNode
  text?: ReactNode
  action?: ReactNode
  className?: string
  id?: string
}

export function FormPanel({ children, className = '', scrollable = false, ...props }: FormPanelProps) {
  return <section className={`glass editor form-panel${scrollable ? ' form-panel-scrollable' : ''}${className ? ` ${className}` : ''}`} {...props}>{children}</section>
}

export function FormPanelLayout({ children, action, className = '' }: FormPanelLayoutProps) {
  return <div className={`form-panel-layout${className ? ` ${className}` : ''}`}><FormPanel scrollable>{children}</FormPanel>{action}</div>
}

export function FormPanelGroup({ children, className = '', gap = 32, as = 'div', disabled, flatten = false, order = 'normal' }: FormPanelGroupProps) {
  const classes = `form-panel-group form-panel-group-gap-${gap}${flatten ? ' form-panel-group-flatten' : ''}${order !== 'normal' ? ` form-panel-group-order-${order}` : ''}${className ? ` ${className}` : ''}`
  if (as === 'fieldset') return <fieldset className={classes} disabled={disabled}>{children}</fieldset>
  return <div className={classes}>{children}</div>
}

export function FormPanelHeader({ title, text, action, className = '', id }: FormPanelHeaderProps) {
  return <div className="form-panel-header-row" id={id}><TypographyGroup className={`form-panel-header${className ? ` ${className}` : ''}`} headingLevel="h2" title={title} text={text} />{action && <span className="form-panel-header-action">{action}</span>}</div>
}

export function FormPanelNote({ children, centered = false, className = '' }: { children: ReactNode; centered?: boolean; className?: string }) {
  return <p className={`form-panel-note type-text-s${centered ? ' form-panel-note-centered' : ''}${className ? ` ${className}` : ''}`}>{children}</p>
}
