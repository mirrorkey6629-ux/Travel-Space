import type { FormEvent, ReactNode } from 'react'
import { Button, IconButton } from './Button'
import { FormControlList } from './FormControlList'
import { Icon } from './Icon'
import { TextRow } from './TextRow'
import { TypographyGroup } from './TypographyGroup'

type PointAction = { label: ReactNode; onClick?: () => void; disabled?: boolean }
type PointRow = { icon: ReactNode; content: ReactNode }

type ViewProps = {
  variant: 'view'
  pointType: 'accommodation' | 'transport' | 'place'
  actionCount?: 1 | 2
  title: ReactNode
  subtitle: ReactNode
  rows: PointRow[]
  secondaryAction?: PointAction
  primaryAction?: PointAction
}

type EditorProps = {
  variant: 'edit' | 'create'
  children: ReactNode
  canSubmit?: boolean
  onSubmit: () => void
  onDelete?: () => void
}

type PointCardProps = (ViewProps | EditorProps) & { onClose: () => void; className?: string }

export function PointCard(props: PointCardProps) {
  const { variant, onClose, className = '' } = props

  if (variant === 'view') {
    const { pointType, actionCount = 2, title, subtitle, rows, secondaryAction, primaryAction } = props
    const showSecondaryAction = pointType === 'place' || actionCount === 2
    return (
      <section className={`point-card point-card-view${className ? ` ${className}` : ''}`} aria-label={typeof title === 'string' ? title : 'Информация о точке'}>
        <header className="point-details-header">
          <TypographyGroup className="point-details-title" variant="head-m-text" headingLevel="h3" title={title} text={subtitle} />
          <IconButton type="button" theme="transparent" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
        </header>
        <div className="divider" />
        <div className="point-details-rows">
          {rows.map((row, index) => <TextRow key={index} iconType="icon" icon={row.icon}>{row.content}</TextRow>)}
        </div>
        {((showSecondaryAction && secondaryAction) || primaryAction) && <div className="point-card-actions">
          {showSecondaryAction && secondaryAction && <Button type="button" size="m" theme="secondary" disabled={secondaryAction.disabled} onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>}
          {primaryAction && <Button type="button" size="m" disabled={primaryAction.disabled} onClick={primaryAction.onClick}>{primaryAction.label}</Button>}
        </div>}
      </section>
    )
  }

  const { children, canSubmit = true, onSubmit, onDelete } = props
  const editing = variant === 'edit'
  return (
    <form className={`point-card point-card-editor${className ? ` ${className}` : ''}`} onSubmit={(event: FormEvent) => { event.preventDefault(); if (canSubmit) onSubmit() }}>
      <header className="point-editor-header">
        <h3>{editing ? 'Изменить точку' : 'Новая точка'}</h3>
        <IconButton type="button" theme="transparent" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
      </header>
      <FormControlList>{children}</FormControlList>
      <div className="point-card-actions">
        {editing && onDelete && <Button type="button" size="m" theme="secondary" onClick={onDelete}>Удалить</Button>}
        <Button size="m" disabled={!canSubmit}>{editing ? 'Сохранить' : 'Добавить точку'}</Button>
      </div>
    </form>
  )
}
