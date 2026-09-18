import type { ButtonHTMLAttributes } from 'react'

type CityRowProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  city: string
  dates: string
  duration: string
  image?: string
  imageAlt?: string
  selected?: boolean
}

export function CityRow({ city, dates, duration, image, imageAlt = '', selected = false, className = '', ...props }: CityRowProps) {
  return (
    <button type="button" className={`city-row${image ? ' city-row-with-image' : ''}${selected ? ' selected' : ''}${className ? ` ${className}` : ''}`} {...props}>
      {image && <img className="city-row-image" src={image} alt={imageAlt} />}
      <strong>{city}</strong>
      <span>{dates}</span>
      <span>{duration}</span>
    </button>
  )
}
