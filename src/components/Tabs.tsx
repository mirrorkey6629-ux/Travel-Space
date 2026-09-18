export type TabOption<T extends string> = { value: T; label: string; disabled?: boolean }

export function Tabs<T extends string>({ value, options, onChange, ariaLabel, className = '' }: { value?: T; options: TabOption<T>[]; onChange: (value: T) => void; ariaLabel: string; className?: string }) {
  return (
    <div className={`ui-tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => <button key={option.value} type="button" role="tab" aria-selected={value === option.value} className={`ui-tab${value === option.value ? ' selected' : ''}`} disabled={option.disabled} onClick={() => onChange(option.value)}>{option.label}</button>)}
    </div>
  )
}
