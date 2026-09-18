import type { ButtonHTMLAttributes } from 'react'

type CityRowProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  city: string
  dates: string
  duration: string
  image?: string
  imageAlt?: string
  imageFallback?: string
  selected?: boolean
}

export function CityRow({ city, dates, duration, image, imageAlt = '', imageFallback, selected = false, className = '', ...props }: CityRowProps) {
  return (
    <button type="button" className={`city-row${image ? ' city-row-with-image' : ''}${selected ? ' selected' : ''}${className ? ` ${className}` : ''}`} {...props}>
      {image && <img className="city-row-image" src={image} alt={imageAlt} onError={(event) => { if (!imageFallback || event.currentTarget.dataset.fallbackApplied) return; event.currentTarget.dataset.fallbackApplied = 'true'; event.currentTarget.src = imageFallback }} />}
      <span className="city-row-copy">
        <strong>{city}</strong>
        <span className="city-row-meta">{dates} · {duration}</span>
      </span>
    </button>
  )
}
