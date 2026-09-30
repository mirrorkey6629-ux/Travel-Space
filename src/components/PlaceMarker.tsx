import { managedPlaceIconUrl, placeIconUrl, type PlaceIconKey } from '../placeIcons'

export type PlaceMarkerProps = {
  icon?: PlaceIconKey
  dimmed?: boolean
  draft?: boolean
  interactive?: boolean
  managed?: boolean
  selected?: boolean
  accentColor?: string
}

const markerClassName = ({ dimmed = false, draft = false, interactive = true, managed = false, selected = false }: PlaceMarkerProps) =>
  `place-marker${managed ? ' place-marker-managed' : ''}${draft ? ' place-marker-draft' : ''}${dimmed ? ' is-dimmed' : ''}${selected ? ' is-selected' : ''}${interactive ? '' : ' is-static'}`

const markerIconUrl = ({ icon = 'default', draft = false, managed = false }: PlaceMarkerProps) => draft
  ? `${import.meta.env.BASE_URL}assets/icons/add-plus.svg`
  : managed && (icon === 'hotel' || icon === 'transport')
    ? managedPlaceIconUrl(icon)
    : placeIconUrl(icon)

const markerBackground = ({ accentColor }: PlaceMarkerProps) => accentColor

export function PlaceMarker(props: PlaceMarkerProps) {
  return <div className={markerClassName(props)} style={{ background: markerBackground(props) }}><img className="ui-icon" src={markerIconUrl(props)} width={24} height={24} alt="" /></div>
}

// Google Maps AdvancedMarkerElement принимает DOM-элемент, а не React-node.
// Эта фабрика и React-компонент выше делят одни и те же правила состояний.
export function createPlaceMarkerElement(props: PlaceMarkerProps): HTMLDivElement {
  const element = document.createElement('div')
  element.className = markerClassName(props)
  const background = markerBackground(props)
  if (background) element.style.background = background
  const image = document.createElement('img')
  image.className = 'ui-icon'
  image.width = 24
  image.height = 24
  image.alt = ''
  image.src = markerIconUrl(props)
  element.appendChild(image)
  return element
}
