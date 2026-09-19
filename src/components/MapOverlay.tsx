import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Держит произвольный React-узел в заданной координате карты.
 *
 * Узел намеренно НЕ рендерится внутрь панелей карты. Портал в floatPane лежал бы
 * внутри DOM карты, и клики по кнопкам тултипа всплывали бы до обработчика клика
 * карты, сбрасывая черновую точку. Погасить их через stopPropagation нельзя:
 * React слушает события на корне дерева, поэтому вместе с картой обработчики
 * потерял бы и сам тултип. Поэтому OverlayView используется только как источник
 * проекции, а разметка живёт соседом карты и позиционируется абсолютно.
 *
 * Штатный InfoWindow не подходит отдельно: его оформление не сводится к
 * стеклянному тёмному стилю проекта.
 */
export function MapOverlay({ maps, map, position, children }: {
  maps: any
  map: any
  position: { lat: number; lng: number }
  children: ReactNode
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!maps || !map) return
    const overlay = new maps.OverlayView()
    overlay.__position = position
    overlay.onAdd = () => undefined
    overlay.onRemove = () => undefined
    // draw вызывается картой на каждый сдвиг и зум, поэтому тултип едет за точкой.
    overlay.draw = () => {
      const projection = overlay.getProjection()
      const element = elementRef.current
      if (!projection || !element) return
      const point = projection.fromLatLngToContainerPixel(new maps.LatLng(overlay.__position.lat, overlay.__position.lng))
      if (!point) return
      element.style.left = `${point.x}px`
      element.style.top = `${point.y}px`
      element.style.visibility = 'visible'
    }
    overlay.setMap(map)
    overlayRef.current = overlay
    setReady(true)
    return () => {
      overlay.setMap(null)
      overlayRef.current = null
      setReady(false)
    }
  }, [maps, map])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    overlay.__position = position
    overlay.draw()
  }, [position.lat, position.lng, ready])

  // Стартовая невидимость убирает мигание в левом верхнем углу до первого draw.
  return <div ref={elementRef} className="map-overlay" style={{ visibility: 'hidden' }}>{children}</div>
}
