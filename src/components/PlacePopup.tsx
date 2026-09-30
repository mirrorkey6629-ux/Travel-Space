import { useState } from 'react'
import { Input, Select, Textarea } from './FormControls'
import { FormControlRow } from './FormControlList'
import { Icon } from './Icon'
import { PointCard } from './PointCard'
import { PLACE_ICON_OPTIONS, placeIconUrl } from '../placeIcons'
import { UNSCHEDULED_KEY, type PlaceDraft } from '../places'

type HotelPointDetails = { cityName: string; dateLabel: string; checkInTime: string; checkOutTime: string; hasBooking: boolean }

const mapNotes = (value: string) => value
  .split(/\r?\n/)
  .filter((line) => line.trim())
  .join('\n')

export function PlacePopup({ mode, draft, dates, formatDate, formatDateOption, readOnly, dateLocked, mapsUrl, mapsAddress, hotelDetails, attachmentKind, onOpenAttachment, onOpenBooking, onEdit, onChange, onSave, onDelete, onClose }: {
  mode: 'view' | 'edit'
  draft: PlaceDraft
  dates: string[]
  formatDate: (value: string) => string
  formatDateOption: (value: string) => string
  readOnly?: boolean
  dateLocked?: boolean
  mapsUrl?: string
  mapsAddress?: string
  hotelDetails?: HotelPointDetails
  attachmentKind?: 'hotel' | 'ticket'
  onOpenAttachment?: () => void
  onOpenBooking?: () => void
  onEdit: () => void
  onChange: (draft: PlaceDraft) => void
  onSave: () => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [nameTouched, setNameTouched] = useState(false)
  const visibleNotes = mapNotes(draft.notes)
  if (mode === 'view') {
    if (hotelDetails) {
      const stayTimes = [hotelDetails.checkInTime ? `Заселение в\u00a0${hotelDetails.checkInTime}` : '', hotelDetails.checkOutTime ? `Выселение до\u00a0${hotelDetails.checkOutTime}` : ''].filter(Boolean).join(' · ')
      return (
        <PointCard
          variant="view"
          pointType="accommodation"
        actionCount={hotelDetails.hasBooking ? 3 : 2}
          title={draft.name}
          rows={[
            { icon: <Icon name="calendar-month" />, content: <>{hotelDetails.dateLabel} · Жильё</> },
            ...(stayTimes ? [{ icon: <Icon name="time" />, content: stayTimes }] : []),
            ...(mapsUrl ? [{ icon: <Icon name="pin-home" />, content: <a className="place-popup-link" href={mapsUrl} target="_blank" rel="noreferrer">{mapsAddress || 'Открыть в Google Maps'}</a> }] : []),
            ...(visibleNotes ? [{ icon: <Icon name="docs" />, content: <span className="place-popup-notes">{visibleNotes}</span> }] : []),
          ]}
          secondaryAction={hotelDetails.hasBooking && (onOpenAttachment || onOpenBooking) ? { label: 'Отель', onClick: onOpenAttachment || onOpenBooking } : undefined}
          primaryAction={!readOnly ? { label: 'Изменить', onClick: onEdit } : undefined}
          onClose={onClose}
        />
      )
    }
    const pointType = PLACE_ICON_OPTIONS.find((option) => option.key === draft.icon)?.label ?? 'Точка на карте'
    return (
      <PointCard
        variant="view"
        pointType={attachmentKind === 'ticket' ? 'transport' : 'place'}
        title={draft.name}
        rows={[
          { icon: <Icon name="calendar-month" />, content: <>{draft.date === UNSCHEDULED_KEY ? 'Без даты' : formatDate(draft.date)} · {pointType}</> },
          ...(mapsUrl ? [{ icon: <Icon name={dateLocked && draft.icon === 'transport' ? 'pin-transport' : 'pin'} />, content: <a className="place-popup-link" href={mapsUrl} target="_blank" rel="noreferrer">{mapsAddress || 'Открыть в Google Maps'}</a> }] : []),
          ...(visibleNotes ? [{ icon: <Icon name="docs" />, content: <span className="place-popup-notes">{visibleNotes}</span> }] : []),
        ]}
        secondaryAction={attachmentKind === 'ticket' && onOpenAttachment ? { label: 'Билет', onClick: onOpenAttachment } : undefined}
        primaryAction={!readOnly ? { label: 'Изменить', onClick: onEdit } : undefined}
        onClose={onClose}
      />
    )
  }
  return (
    <PointCard variant={onDelete ? 'edit' : 'create'} canSubmit={Boolean(draft.name.trim())} onSubmit={onSave} onDelete={onDelete} onClose={onClose}>
        <FormControlRow><Input label="Название локации" icon={<Icon name="book" />} aria-label="Название локации" value={draft.name} autoFocus error={nameTouched && !draft.name.trim() ? 'Нужно ввести название места' : undefined}
          onBlur={() => setNameTouched(true)}
          onChange={(event) => onChange({ ...draft, name: event.target.value })} /></FormControlRow>
        <FormControlRow><Select type="default" label="Тип локации" icon={<img className="ui-icon" src={placeIconUrl(draft.icon)} width={24} height={24} alt="" aria-hidden="true" />} optionIcons={Object.fromEntries(PLACE_ICON_OPTIONS.map((option) => [option.key, <img className="ui-icon" src={placeIconUrl(option.key)} width={24} height={24} alt="" />]))} aria-label="Тип локации" value={draft.icon}
          onChange={(event) => onChange({ ...draft, icon: event.target.value as PlaceDraft['icon'] })}>
          {PLACE_ICON_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </Select></FormControlRow>
        <FormControlRow><Select type="date" label="Когда посещаем" icon={<Icon name="calendar-month" />} aria-label="Когда посещаем" value={draft.date} disabled={dateLocked}
          onChange={(event) => onChange({ ...draft, date: event.target.value })}>
          <option value={UNSCHEDULED_KEY}>Без даты</option>
          {dates.map((date) => <option key={date} value={date}>{formatDateOption(date)}</option>)}
        </Select></FormControlRow>
        <FormControlRow><Textarea autoResize={false} aria-label="Описание точки" placeholder="Описание точки" value={draft.notes}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></FormControlRow>
    </PointCard>
  )
}
