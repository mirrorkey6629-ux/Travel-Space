import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'

type ButtonTheme = 'primary' | 'secondary' | 'transparent'
type ButtonSize = 'l' | 'm'
type IconButtonSize = 'l' | 'm' | 's'
type IconButtonTheme = ButtonTheme | 'transparent'

export function Button({
  theme = 'primary',
  size = 'l',
  icon,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { theme?: ButtonTheme; size?: ButtonSize; icon?: ReactNode }) {
  return <button className={`ui-button ui-button-${theme} ui-button-${size} ${theme} ${className}`.trim()} {...props}>{icon && <span className="ui-button-icon">{icon}</span>}{children}</button>
}

export function IconButton({
  icon,
  size = 'm',
  theme = 'secondary',
  indicator = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode; size?: IconButtonSize; theme?: IconButtonTheme; indicator?: boolean }) {
  const showIndicator = indicator && theme === 'secondary' && size !== 's' && !props.disabled

  return <button className={`icon-button icon-button-${theme} icon-button-${size} ${className}`.trim()} {...props}>{icon}{showIndicator && <span className="icon-button-indicator" aria-hidden="true"><Icon name="done-indicator" size={16} /></span>}</button>
}
