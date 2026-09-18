import type { ButtonHTMLAttributes, ReactNode } from 'react'

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
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode; size?: IconButtonSize; theme?: IconButtonTheme }) {
  return <button className={`icon-button icon-button-${theme} icon-button-${size} ${className}`.trim()} {...props}>{icon}</button>
}
