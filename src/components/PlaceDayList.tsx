import { DndContext, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { placeIconUrl, type PlaceIconKey } from '../placeIcons'
import { UNSCHEDULED_KEY } from '../places'

export type ListPlace = { id: string; name: string; icon: PlaceIconKey }

function PlaceRow({ place, index, onFocus }: { place: ListPlace; index: number; onFocus: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: place.id })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`place-row${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={() => onFocus(place.id)}
      {...attributes}
      {...listeners}
    >
      <img className="ui-icon" src={placeIconUrl(place.icon)} width={16} height={16} alt="" aria-hidden="true" />
      <span>{index + 1}. {place.name}</span>
    </button>
  )
}

function Day({ dayKey, title, places, active, readOnly, onActivate, onFocusPlace }: {
  dayKey: string
  title: string
  places: ListPlace[]
  active: boolean
  readOnly?: boolean
  onActivate: () => void
  onFocusPlace: (id: string) => void
}) {
  // Дроп-зона нужна и на пустом дне, иначе в него нечего было бы перетащить.
  const { setNodeRef, isOver } = useDroppable({ id: dayKey, disabled: readOnly })
  return (
    <div ref={setNodeRef} className={`city-day${dayKey === UNSCHEDULED_KEY ? ' unscheduled-day' : ''}${active ? ' is-active' : ''}${isOver ? ' is-over' : ''}`}>
      <h3><button type="button" className="city-day-title" aria-pressed={active} onClick={onActivate}>{title}</button></h3>
      {places.map((place, index) => readOnly
        ? <button key={place.id} type="button" className="place-row" onClick={() => onFocusPlace(place.id)}>
            <img className="ui-icon" src={placeIconUrl(place.icon)} width={16} height={16} alt="" aria-hidden="true" />
            <span>{index + 1}. {place.name}</span>
          </button>
        : <PlaceRow key={place.id} place={place} index={index} onFocus={onFocusPlace} />)}
    </div>
  )
}

export function PlaceDayList({ dates, placesByDate, activeDate, readOnly, formatDate, onActivateDate, onFocusPlace, onMove }: {
  dates: string[]
  placesByDate: Record<string, ListPlace[]>
  activeDate: string | null
  readOnly?: boolean
  formatDate: (value: string) => string
  onActivateDate: (date: string | null) => void
  onFocusPlace: (id: string) => void
  onMove: (placeId: string, date: string | null, position: number) => void
}) {
  // Порог 5px обязателен: без него обычный клик по точке съедался бы началом
  // перетаскивания и точка перестала бы открываться на карте.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const dayKeys = [UNSCHEDULED_KEY, ...dates]

  const dayOf = (id: string) => (id in placesByDate ? id : dayKeys.find((key) => (placesByDate[key] ?? []).some((place) => place.id === id)))

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId) return
    const targetDay = dayKeys.includes(overId) ? overId : dayOf(overId)
    const sourceDay = dayOf(activeId)
    if (!targetDay || !sourceDay) return
    const target = placesByDate[targetDay] ?? []
    const withoutActive = target.filter((place) => place.id !== activeId)
    const overIndex = withoutActive.findIndex((place) => place.id === overId)
    // Бросок на заголовок или пустое место дня означает «в конец»,
    // бросок на конкретную точку — «на её место».
    const position = dayKeys.includes(overId) ? withoutActive.length : Math.max(0, overIndex)
    if (targetDay === sourceDay && target.findIndex((place) => place.id === activeId) === position) return
    onMove(activeId, targetDay === UNSCHEDULED_KEY ? null : targetDay, position)
  }

  const renderDay = (dayKey: string) => (
    <Day
      key={dayKey}
      dayKey={dayKey}
      title={dayKey === UNSCHEDULED_KEY ? 'Без даты' : formatDate(dayKey)}
      places={placesByDate[dayKey] ?? []}
      // «Без даты» не может быть активным днём: activeDate === null и означает «активного дня нет».
      active={dayKey !== UNSCHEDULED_KEY && activeDate === dayKey}
      readOnly={readOnly}
      onActivate={() => onActivateDate(dayKey === UNSCHEDULED_KEY || activeDate === dayKey ? null : dayKey)}
      onFocusPlace={onFocusPlace}
    />
  )

  if (readOnly) return <div className="city-days">{dayKeys.map(renderDay)}</div>

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="city-days">
        {dayKeys.map((dayKey) => (
          <SortableContext key={dayKey} items={(placesByDate[dayKey] ?? []).map((place) => place.id)} strategy={verticalListSortingStrategy}>
            {renderDay(dayKey)}
          </SortableContext>
        ))}
      </div>
    </DndContext>
  )
}
