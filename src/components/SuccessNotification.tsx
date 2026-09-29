import { IconButton } from './Button'
import { Icon } from './Icon'
import { TypographyGroup } from './TypographyGroup'

type SuccessNotificationProps = {
  title?: string
  message?: string
  onClose: () => void
}

export function SuccessNotification({ title = 'Всё сохранилось', message = 'Можете закрывать страницу', onClose }: SuccessNotificationProps) {
  return (
    <aside className="point-card success-notification" role="status" aria-live="polite">
      <TypographyGroup className="success-notification-copy" variant="head-m-text" headingLevel="h2" title={title} text={message} />
      <IconButton type="button" size="m" theme="secondary" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть уведомление" />
    </aside>
  )
}
