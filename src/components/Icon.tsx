export type IconName = 'link' | 'content-copy' | 'pin-add' | 'add-plus' | 'arrow-back' | 'arrow-down' | 'attractions' | 'barefoot' | 'book' | 'cached' | 'calendar-month' | 'cannabis' | 'casino' | 'checkbox-empty' | 'checkbox-filled' | 'cloud-off' | 'directions-transit' | 'done-indicator' | 'door-open' | 'time' | 'planet' | 'public' | 'email' | 'encrypted' | 'refresh' | 'close' | 'pin' | 'pin-home' | 'pin-transport' | 'edit' | 'face' | 'footprint' | 'foundation' | 'hotel' | 'delete-forever' | 'download' | 'docs' | 'money-bag' | 'plane' | 'rocket-launch' | 'sailing' | 'soup-kitchen' | 'ticket' | 'train'

const ICON_ASSET_VERSION = '20260928-17'

export function Icon({ name, size = 24, tone = 'primary' }: { name: IconName; size?: number; tone?: 'primary' | 'secondary' | 'disabled' }) {
  return <img className={`ui-icon ui-icon-${tone}`} src={`${import.meta.env.BASE_URL}assets/icons/${name}.svg?v=${ICON_ASSET_VERSION}`} width={size} height={size} alt="" aria-hidden="true" />
}
