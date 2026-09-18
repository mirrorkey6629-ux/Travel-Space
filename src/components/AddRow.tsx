import type { ButtonHTMLAttributes, ReactNode } from 'react'

type AddRowProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: ReactNode
}

export function AddRow({ icon, className = '', type = 'button', ...props }: AddRowProps) {
  return (
    <button type={type} className={`add-row ${className}`.trim()} {...props}>
      {icon}
    </button>
  )
}
