import { Button, IconButton } from './Button'
import { Input, Select } from './FormControls'
import { Icon } from './Icon'
import { PLACE_ICON_OPTIONS, placeIconUrl } from '../placeIcons'
import { UNSCHEDULED_KEY, type PlaceDraft } from '../places'

export function PlacePopup({ mode, draft, dates, formatDate, readOnly, mapsUrl, onEdit, onChange, onSave, onDelete, onClose }: {
  mode: 'view' | 'edit'
  draft: PlaceDraft
  dates: string[]
  formatDate: (value: string) => string
  readOnly?: boolean
  mapsUrl?: string
  onEdit: () => void
  onChange: (draft: PlaceDraft) => void
  onSave: () => void
  onDelete?: () => void
  onClose: () => void
}) {
  if (mode === 'view') {
    return (
      <div className="place-popup">
        <div className="place-popup-head">
          <img className="ui-icon" src={placeIconUrl(draft.icon)} width={24} height={24} alt="" aria-hidden="true" />
          <strong>{draft.name}</strong>
          <IconButton type="button" theme="transparent" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
        </div>
        <p className="secondary-text">{draft.date === UNSCHEDULED_KEY ? 'Без даты' : formatDate(draft.date)}</p>
        {mapsUrl && <a className="place-popup-link" href={mapsUrl} target="_blank" rel="noreferrer">Открыть в Google Maps</a>}
        {!readOnly && <Button type="button" theme="secondary" onClick={onEdit}>Редактировать</Button>}
      </div>
    )
  }
  return (
    <form className="place-popup" onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) onSave() }}>
      <div className="place-popup-head">
        <strong>{onDelete ? 'Редактирование точки' : 'Новая точка'}</strong>
        <IconButton type="button" theme="transparent" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
      </div>
      <Input icon={<Icon name="attractions" />} aria-label="Название места" value={draft.name} placeholder="Название места" autoFocus
        onChange={(event) => onChange({ ...draft, name: event.target.value })} />
      <div className="place-popup-icons" role="radiogroup" aria-label="Иконка места">
        {PLACE_ICON_OPTIONS.map((option) => (
          <button key={option.key} type="button" role="radio" aria-checked={draft.icon === option.key} title={option.label}
            className={`place-icon-choice${draft.icon === option.key ? ' is-selected' : ''}`}
            onClick={() => onChange({ ...draft, icon: option.key })}>
            <img className="ui-icon" src={placeIconUrl(option.key)} width={24} height={24} alt={option.label} />
          </button>
        ))}
      </div>
      <Select content="date" icon={<Icon name="calendar-month" />} aria-label="Дата посещения" value={draft.date}
        onChange={(event) => onChange({ ...draft, date: event.target.value })}>
        <option value={UNSCHEDULED_KEY}>Без даты</option>
        {dates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}
      </Select>
      <div className="place-popup-actions">
        <Button size="m" disabled={!draft.name.trim()}>Сохранить</Button>
        {onDelete && <Button type="button" size="m" theme="secondary" onClick={onDelete}>Удалить</Button>}
      </div>
    </form>
  )
}
