import { IconButton } from './Button'
import { Icon } from './Icon'
import { TypographyGroup } from './TypographyGroup'

type ErrorNotificationProps = {
  title: string
  message: string
  onClose?: () => void
  onRetry?: () => void
  retryLabel?: string
  actionIcon?: 'retry' | 'refresh'
}

export function ErrorNotification({ title, message, onClose, onRetry, retryLabel = 'Повторить действие', actionIcon = 'retry' }: ErrorNotificationProps) {
  return (
    <aside className="point-card error-notification" role="alert" aria-live="assertive">
      <TypographyGroup className="error-notification-copy" variant="head-m-text" headingLevel="h2" title={title} text={message} />
      <div className="error-notification-actions">
        {onRetry && <IconButton type="button" size="m" theme="secondary" icon={<Icon name={actionIcon === 'refresh' ? 'cached' : 'refresh'} />} onClick={onRetry} aria-label={retryLabel} title={retryLabel} />}
        {onClose && <IconButton type="button" size="m" theme="secondary" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть уведомление" />}
      </div>
    </aside>
  )
}
