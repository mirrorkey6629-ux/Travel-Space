import { useState } from 'react'
import { DndContext, MeasuringStrategy, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { placeIconUrl, type PlaceIconKey } from '../placeIcons'
import { UNSCHEDULED_KEY } from '../places'

export type ListPlace = { id: string; name: string; icon: PlaceIconKey }

const handleUrl = `${import.meta.env.BASE_URL}assets/icons/drag-handle.svg`

function RowBody({ place, number }: { place: ListPlace; number?: number }) {
  return (
    <>
      <img className="ui-icon" src={placeIconUrl(place.icon)} width={16} height={16} alt="" aria-hidden="true" />
      <span>{number === undefined ? place.name : `${number}. ${place.name}`}</span>
      {/* Подсказка, что строку можно перетащить. Тащится вся строка, поэтому
          иконка декоративная и своих обработчиков не имеет. */}
      <img className="ui-icon place-row-handle" src={handleUrl} width={16} height={16} alt="" aria-hidden="true" />
    </>
  )
}

function PlaceRow({ place, number, onFocus }: { place: ListPlace; number: number; onFocus: (id: string) => void }) {
  // transform намеренно не применяется. Иначе перетаскиваемая строка отрывается
  // от списка и висит под курсором, а соседи разъезжаются собственными
  // трансформациями. Порядок целиком ведёт раскладка предпросмотра: строка
  // всегда стоит в слоте, просто переставляется между слотами.
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: place.id })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`place-row${isDragging ? ' is-dragging' : ''}`}
      onClick={() => onFocus(place.id)}
      {...attributes}
      {...listeners}
    >
      <RowBody place={place} number={number} />
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
            <RowBody place={place} number={index + 1} />
          </button>
        : <PlaceRow key={place.id} place={place} number={index + 1} onFocus={onFocusPlace} />)}
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

  // Раскладка на время перетаскивания: точка переезжает в целевой день между
  // нужными соседями ещё до отпускания. Без этого видна только подсветка дня,
  // но не место вставки.
  const [preview, setPreview] = useState<Record<string, ListPlace[]> | null>(null)
  const view = preview ?? placesByDate

  const dayOfIn = (source: Record<string, ListPlace[]>, id: string) => dayKeys.find((key) => (source[key] ?? []).some((place) => place.id === id))

  const handleDragStart = () => setPreview(null)

  const sameOrder = (left: Record<string, ListPlace[]>, right: Record<string, ListPlace[]>) =>
    dayKeys.every((key) => {
      const a = left[key] ?? []
      const b = right[key] ?? []
      return a.length === b.length && a.every((place, index) => place.id === b[index].id)
    })

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const movedId = String(active.id)
    const overId = String(over.id)
    if (overId === movedId) return
    const base = preview ?? placesByDate
    const from = dayOfIn(base, movedId)
    const to = dayKeys.includes(overId) ? overId : dayOfIn(base, overId)
    if (!from || !to) return
    const moved = (base[from] ?? []).find((place) => place.id === movedId)
    if (!moved) return
    const withoutMoved = (base[from] ?? []).filter((place) => place.id !== movedId)
    const targetBase = from === to ? withoutMoved : [...(base[to] ?? [])]
    // Курсор ниже середины точки — встаём после неё, выше — перед ней.
    const overIndex = dayKeys.includes(overId) ? targetBase.length : targetBase.findIndex((place) => place.id === overId)
    const translated = active.rect.current.translated
    const below = !!(translated && over.rect && translated.top > over.rect.top + over.rect.height / 2)
    const index = overIndex < 0 ? targetBase.length : overIndex + (below ? 1 : 0)
    const inserted = [...targetBase.slice(0, index), moved, ...targetBase.slice(index)]
    const next: Record<string, ListPlace[]> = {}
    for (const key of dayKeys) next[key] = base[key] ?? []
    next[from] = from === to ? inserted : withoutMoved
    next[to] = inserted
    // Без этой отсечки каждое движение мыши перерисовывало бы весь список заново.
    if (sameOrder(next, base)) return
    setPreview(next)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const movedId = String(event.active.id)
    const base = preview ?? placesByDate
    setPreview(null)
    const day = dayOfIn(base, movedId)
    const origin = dayOfIn(placesByDate, movedId)
    if (!day || !origin) return
    // Предпросмотр уже показывает итоговую раскладку — берём позицию прямо из него.
    const position = (base[day] ?? []).findIndex((place) => place.id === movedId)
    const wasAt = (placesByDate[origin] ?? []).findIndex((place) => place.id === movedId)
    if (day === origin && wasAt === position) return
    onMove(movedId, day === UNSCHEDULED_KEY ? null : day, position)
  }

  const renderDay = (dayKey: string) => (
    <Day
      key={dayKey}
      dayKey={dayKey}
      title={dayKey === UNSCHEDULED_KEY ? 'Без даты' : formatDate(dayKey)}
      places={view[dayKey] ?? []}
      // «Без даты» не может быть активным днём: activeDate === null и означает «активного дня нет».
      active={dayKey !== UNSCHEDULED_KEY && activeDate === dayKey}
      readOnly={readOnly}
      onActivate={() => onActivateDate(dayKey === UNSCHEDULED_KEY || activeDate === dayKey ? null : dayKey)}
      onFocusPlace={onFocusPlace}
    />
  )

  if (readOnly) return <div className="city-days">{dayKeys.map(renderDay)}</div>

  // DragOverlay намеренно не используется: отдельная плашка под курсором дублировала
  // строку и закрывала карту.
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      // Раскладка меняется прямо во время перетаскивания, поэтому размеры
      // зон нужно перемерять постоянно — иначе dnd-kit считает по устаревшим.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setPreview(null)}
    >
      <div className="city-days">
        {dayKeys.map((dayKey) => (
          <SortableContext key={dayKey} items={(view[dayKey] ?? []).map((place) => place.id)} strategy={verticalListSortingStrategy}>
            {renderDay(dayKey)}
          </SortableContext>
        ))}
      </div>
    </DndContext>
  )
}
