export type IconName = 'link' | 'content-copy' | 'add-pin' | 'add-circle' | 'add-plus' | 'arrow-back' | 'attractions' | 'barefoot' | 'bus' | 'calendar-month' | 'casino' | 'check-small' | 'time' | 'planet' | 'email' | 'encrypted' | 'refresh' | 'close' | 'edit-location' | 'pin-home' | 'image' | 'edit' | 'face' | 'hotel' | 'key' | 'delete-forever' | 'download' | 'upload-file' | 'docs' | 'plane' | 'rocket-launch' | 'sailing' | 'ticket' | 'train'

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return <img className="ui-icon" src={`${import.meta.env.BASE_URL}assets/icons/${name}.svg`} width={size} height={size} alt="" aria-hidden="true" />
}
