import { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

function PlaceRow({ place, onFocus }: { place: ListPlace; onFocus: (id: string) => void }) {
  // newIndex — позиция, которую точка займёт прямо сейчас с учётом перетаскивания.
  // Обычный индекс в массиве при переносе внутри дня не меняется: там соседей
  // двигает сам SortableContext трансформациями, и номер разошёлся бы с местом.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, newIndex } = useSortable({ id: place.id })
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
      <RowBody place={place} number={newIndex + 1} />
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
        : <PlaceRow key={place.id} place={place} onFocus={onFocusPlace} />)}
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

  const [activeId, setActiveId] = useState<string | null>(null)
  // Раскладка на время перетаскивания: точка переезжает в целевой день между
  // нужными соседями ещё до отпускания. Без этого видна только подсветка дня,
  // но не место вставки.
  const [preview, setPreview] = useState<Record<string, ListPlace[]> | null>(null)
  const view = preview ?? placesByDate

  const dayOfIn = (source: Record<string, ListPlace[]>, id: string) => dayKeys.find((key) => (source[key] ?? []).some((place) => place.id === id))

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
    setPreview(null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const movedId = String(active.id)
    const overId = String(over.id)
    const base = preview ?? placesByDate
    const from = dayOfIn(base, movedId)
    const to = dayKeys.includes(overId) ? overId : dayOfIn(base, overId)
    // Порядок внутри одного дня показывает сам SortableContext своими
    // трансформациями. Если вмешаться ещё и здесь, сдвиг применится дважды:
    // нумерация пойдёт по нашей раскладке, а положение на экране — по чужой.
    if (!from || !to || from === to) return
    const fromItems = base[from] ?? []
    const toItems = base[to] ?? []
    const moved = fromItems.find((place) => place.id === movedId)
    if (!moved) return
    // Курсор ниже середины точки — встаём после неё, выше — перед ней.
    const overIndex = dayKeys.includes(overId) ? toItems.length : toItems.findIndex((place) => place.id === overId)
    const translated = active.rect.current.translated
    const below = !!(translated && over.rect && translated.top > over.rect.top + over.rect.height / 2)
    const index = overIndex < 0 ? toItems.length : overIndex + (below ? 1 : 0)
    const next: Record<string, ListPlace[]> = {}
    for (const key of dayKeys) next[key] = base[key] ?? []
    next[from] = fromItems.filter((place) => place.id !== movedId)
    next[to] = [...toItems.slice(0, index), moved, ...toItems.slice(index)]
    setPreview(next)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const movedId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    const base = preview ?? placesByDate
    setActiveId(null)
    setPreview(null)
    const day = dayOfIn(base, movedId)
    const origin = dayOfIn(placesByDate, movedId)
    if (!day || !origin) return
    const list = base[day] ?? []
    // Итоговая позиция — место точки, над которой отпустили; над днём целиком — конец.
    let position = list.findIndex((place) => place.id === movedId)
    if (overId) {
      const overIndex = dayKeys.includes(overId) ? list.length - 1 : list.findIndex((place) => place.id === overId)
      if (overIndex >= 0) position = overIndex
    }
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

  const draggedDay = activeId ? dayOfIn(view, activeId) : undefined
  const dragged = draggedDay && activeId ? (view[draggedDay] ?? []).find((place) => place.id === activeId) ?? null : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveId(null); setPreview(null) }}
    >
      <div className="city-days">
        {dayKeys.map((dayKey) => (
          <SortableContext key={dayKey} items={(view[dayKey] ?? []).map((place) => place.id)} strategy={verticalListSortingStrategy}>
            {renderDay(dayKey)}
          </SortableContext>
        ))}
      </div>
      {/* Копия строки под курсором: без неё непонятно, что именно перетаскиваешь. */}
      <DragOverlay dropAnimation={null}>
        {dragged ? <div className="place-row place-row-overlay"><RowBody place={dragged} /></div> : null}
      </DragOverlay>
    </DndContext>
  )
}
