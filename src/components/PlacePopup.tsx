import { Button, IconButton } from './Button'
import { Input, Select } from './FormControls'
import { Icon } from './Icon'
import { IconText } from './IconText'
import { PLACE_ICON_OPTIONS, placeIconUrl } from '../placeIcons'
import { UNSCHEDULED_KEY, type PlaceDraft } from '../places'

type HotelPointDetails = { cityName: string; dateLabel: string; checkInTime: string; checkOutTime: string; hasBooking: boolean }

export function PlacePopup({ mode, draft, dates, formatDate, readOnly, dateLocked, mapsUrl, hotelDetails, onOpenBooking, onEdit, onChange, onSave, onDelete, onClose }: {
  mode: 'view' | 'edit'
  draft: PlaceDraft
  dates: string[]
  formatDate: (value: string) => string
  readOnly?: boolean
  dateLocked?: boolean
  mapsUrl?: string
  hotelDetails?: HotelPointDetails
  onOpenBooking?: () => void
  onEdit: () => void
  onChange: (draft: PlaceDraft) => void
  onSave: () => void
  onDelete?: () => void
  onClose: () => void
}) {
  if (mode === 'view') {
    if (hotelDetails) {
      const stayTimes = [hotelDetails.checkInTime ? `Заселение в ${hotelDetails.checkInTime}` : '', hotelDetails.checkOutTime ? `Выселение до ${hotelDetails.checkOutTime}` : ''].filter(Boolean).join(' * ')
      return (
        <div className="place-popup place-popup-hotel-view">
          <div className="place-popup-hotel-head">
            <div className="place-popup-hotel-title"><strong>{draft.name}</strong><span>Жильё, {hotelDetails.cityName}</span></div>
            <IconButton type="button" theme="transparent" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
          </div>
          <div className="place-popup-hotel-details">
            <IconText icon={<Icon name="calendar-month" />}>{hotelDetails.dateLabel}</IconText>
            {stayTimes && <IconText icon={<Icon name="time" />}>{stayTimes}</IconText>}
            {mapsUrl && <IconText icon={<Icon name="pin-home" />}><a className="place-popup-link" href={mapsUrl} target="_blank" rel="noreferrer">Адрес с гугл карт</a></IconText>}
          </div>
          <div className="place-popup-actions">
            {hotelDetails.hasBooking && onOpenBooking && <Button type="button" size="m" theme="secondary" onClick={onOpenBooking}>Открыть бронь</Button>}
            {!readOnly && <Button type="button" size="m" onClick={onEdit}>Редактировать</Button>}
          </div>
        </div>
      )
    }
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
    <form className="place-popup place-popup-edit" onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) onSave() }}>
      <div className="place-popup-head">
        <strong>{onDelete ? 'Редактирование' : 'Новая точка'}</strong>
        <IconButton type="button" theme="transparent" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
      </div>
      <div className="place-popup-icons" role="radiogroup" aria-label="Иконка места">
        {PLACE_ICON_OPTIONS.map((option) => (
          <button key={option.key} type="button" role="radio" aria-checked={draft.icon === option.key} title={option.label}
            className={`place-icon-choice${draft.icon === option.key ? ' is-selected' : ''}`}
            onClick={() => onChange({ ...draft, icon: option.key })}>
            <img className="ui-icon" src={placeIconUrl(option.key)} width={24} height={24} alt={option.label} />
          </button>
        ))}
      </div>
      <Select content="date" icon={<Icon name="calendar-month" />} aria-label="Дата посещения" value={draft.date} disabled={dateLocked}
        onChange={(event) => onChange({ ...draft, date: event.target.value })}>
        <option value={UNSCHEDULED_KEY}>Без даты</option>
        {dates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}
      </Select>
      <Input icon={<img className="ui-icon" src={placeIconUrl(draft.icon)} width={24} height={24} alt="" aria-hidden="true" />} aria-label="Название места" value={draft.name} placeholder="Название места" autoFocus
        onChange={(event) => onChange({ ...draft, name: event.target.value })} />
      <div className="place-popup-actions">
        {onDelete && <Button type="button" size="m" theme="secondary" onClick={onDelete}>Удалить</Button>}
        <Button size="m" disabled={!draft.name.trim()}>{onDelete ? 'Сохранить' : 'Добавить точку'}</Button>
      </div>
    </form>
  )
}
