import { useCallback, useEffect, useRef, type ReactNode } from 'react'

type ImageFilePickerControls = {
  open: () => void
  clearPreview: () => void
}

type ImageFilePickerProps = {
  children: (controls: ImageFilePickerControls) => ReactNode
  disabled?: boolean
  onSelect: (file: File, previewUrl: string) => void
}

export function ImageFilePicker({ children, disabled = false, onSelect }: ImageFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)

  const clearPreview = useCallback(() => {
    if (!previewUrlRef.current) return
    URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
  }, [])

  useEffect(() => clearPreview, [clearPreview])

  const open = () => {
    if (!disabled) inputRef.current?.click()
  }

  return <>
    {children({ open, clearPreview })}
    <input
      ref={inputRef}
      className="hidden-file-input"
      type="file"
      accept="image/*"
      disabled={disabled}
      onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) {
          clearPreview()
          const previewUrl = URL.createObjectURL(file)
          previewUrlRef.current = previewUrl
          onSelect(file, previewUrl)
        }
        event.currentTarget.value = ''
      }}
    />
  </>
}
