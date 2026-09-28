import { IconButton } from './Button'
import { Icon } from './Icon'
import { TypographyGroup } from './TypographyGroup'

type UpdateNotificationProps = {
  message: string
  shake?: boolean
  onRefresh: () => void
}

export function UpdateNotification({ message, shake = false, onRefresh }: UpdateNotificationProps) {
  return (
    <aside className={`point-card update-notification${shake ? ' update-notification-shake' : ''}`} role="status" aria-live="polite">
      <TypographyGroup className="update-notification-copy" variant="head-m-text" headingLevel="h2" title="Обновились данные" text={message} />
      <IconButton type="button" size="m" theme="primary" icon={<Icon name="cached" />} onClick={onRefresh} aria-label="Загрузить новые данные" />
    </aside>
  )
}
