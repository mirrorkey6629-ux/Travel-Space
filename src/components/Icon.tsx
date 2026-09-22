export type IconName = 'link' | 'content-copy' | 'pin-add' | 'add-plus' | 'arrow-back' | 'attractions' | 'barefoot' | 'book' | 'calendar-month' | 'casino' | 'check-small' | 'cloud-off' | 'directions-transit' | 'time' | 'planet' | 'email' | 'encrypted' | 'refresh' | 'close' | 'pin' | 'pin-home' | 'pin-transport' | 'edit' | 'face' | 'footprint' | 'hotel' | 'delete-forever' | 'download' | 'docs' | 'money-bag' | 'plane' | 'rocket-launch' | 'sailing' | 'ticket' | 'train'

const ICON_ASSET_VERSION = '20260922-2'

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return <img className="ui-icon" src={`${import.meta.env.BASE_URL}assets/icons/${name}.svg?v=${ICON_ASSET_VERSION}`} width={size} height={size} alt="" aria-hidden="true" />
}
