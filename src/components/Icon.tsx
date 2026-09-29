export type IconName = 'link' | 'content-copy' | 'pin-add' | 'add-plus' | 'arrow-back' | 'arrow-down' | 'attractions' | 'barefoot' | 'book' | 'cached' | 'calendar-month' | 'cannabis' | 'casino' | 'checkbox-empty' | 'checkbox-filled' | 'cloud-off' | 'directions-transit' | 'done-indicator' | 'door-open' | 'time' | 'planet' | 'public' | 'email' | 'encrypted' | 'refresh' | 'close' | 'pin' | 'pin-home' | 'pin-transport' | 'edit' | 'face' | 'footprint' | 'foundation' | 'hotel' | 'delete-forever' | 'download' | 'docs' | 'money-bag' | 'plane' | 'rocket-launch' | 'sailing' | 'soup-kitchen' | 'ticket' | 'train' | 'warning'

const ICON_ASSET_VERSION = '20260929-19'

export function Icon({ name, size = 24, tone = 'primary' }: { name: IconName; size?: number; tone?: 'primary' | 'secondary' | 'disabled' }) {
  if (name === 'warning') return <svg className={`ui-icon ui-icon-${tone}`} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M11.0371 8.00094C11.0204 7.54862 11.012 7.32247 11.14 7.17378C11.1522 7.15962 11.1651 7.14615 11.1788 7.13344C11.3227 7 11.549 7 12.0016 7C12.4529 7 12.6786 7 12.8223 7.13293C12.836 7.14559 12.8489 7.15901 12.8611 7.17312C12.9891 7.32126 12.9815 7.54677 12.9662 7.9978L12.8236 12.2121C12.8139 12.4977 12.809 12.6405 12.7477 12.7479C12.7005 12.8305 12.6308 12.898 12.5466 12.9423C12.4372 13 12.2943 13 12.0085 13C11.7235 13 11.581 13 11.4718 12.9426C11.3878 12.8984 11.318 12.8312 11.2708 12.7489C11.2094 12.6419 11.2041 12.4995 11.1935 12.2147L11.0371 8.00094Z" fill="currentColor" />
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="15.5" r="1" fill="currentColor" />
  </svg>
  return <img className={`ui-icon ui-icon-${tone}`} src={`${import.meta.env.BASE_URL}assets/icons/${name}.svg?v=${ICON_ASSET_VERSION}`} width={size} height={size} alt="" aria-hidden="true" />
}
