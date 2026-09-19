import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Держит произвольный React-узел в заданной координате карты. Штатный InfoWindow
 * не используется: его белый пузырь с собственным крестиком не сводится к
 * стеклянному тёмному оформлению проекта.
 */
export function MapOverlay({ maps, map, position, children }: {
  maps: any
  map: any
  position: { lat: number; lng: number }
  children: ReactNode
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const overlayRef = useRef<any>(null)

  useEffect(() => {
    if (!maps || !map) return
    const element = document.createElement('div')
    element.className = 'map-overlay'
    // OverlayView можно наследовать только после загрузки Maps, поэтому объект
    // создаётся внутри эффекта, а не на уровне модуля.
    const overlay = new maps.OverlayView()
    overlay.__position = position
    // floatPane — единственная панель выше маркеров, которая принимает клики:
    // в остальных тултип оказался бы под маркерами либо перестал нажиматься.
    overlay.onAdd = () => overlay.getPanes()?.floatPane.appendChild(element)
    overlay.onRemove = () => element.remove()
    overlay.draw = () => {
      const projection = overlay.getProjection()
      if (!projection) return
      const point = projection.fromLatLngToDivPixel(new maps.LatLng(overlay.__position.lat, overlay.__position.lng))
      if (!point) return
      element.style.left = `${point.x}px`
      element.style.top = `${point.y}px`
    }
    overlay.setMap(map)
    overlayRef.current = overlay
    setContainer(element)
    return () => {
      overlay.setMap(null)
      overlayRef.current = null
      setContainer(null)
    }
  }, [maps, map])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    overlay.__position = position
    overlay.draw()
  }, [position.lat, position.lng])

  return container ? createPortal(children, container) : null
}
