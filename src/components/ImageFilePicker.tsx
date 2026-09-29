import { useCallback, useEffect, useRef, type ReactNode } from 'react'

type ImageFilePickerControls = {
  open: () => void
  clearPreview: () => void
}

type FilePickerControls = {
  open: () => void
}

type FilePickerProps = {
  children: (controls: FilePickerControls) => ReactNode
  accept?: string
  disabled?: boolean
  onSelect: (file: File) => void
}

type ImageFilePickerProps = {
  children: (controls: ImageFilePickerControls) => ReactNode
  disabled?: boolean
  onSelect: (file: File, previewUrl: string) => void
}

export function FilePicker({ children, accept, disabled = false, onSelect }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const open = () => {
    if (!disabled) inputRef.current?.click()
  }

  return <>
    {children({ open })}
    <input
      ref={inputRef}
      className="hidden-file-input"
      type="file"
      accept={accept}
      disabled={disabled}
      onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) onSelect(file)
        event.currentTarget.value = ''
      }}
    />
  </>
}

export function ImageFilePicker({ children, disabled = false, onSelect }: ImageFilePickerProps) {
  const previewUrlRef = useRef<string | null>(null)

  const clearPreview = useCallback(() => {
    if (!previewUrlRef.current) return
    URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
  }, [])

  useEffect(() => clearPreview, [clearPreview])

  return <FilePicker accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={disabled} onSelect={(file) => {
    clearPreview()
    const previewUrl = URL.createObjectURL(file)
    previewUrlRef.current = previewUrl
    onSelect(file, previewUrl)
  }}>{({ open }) => children({ open, clearPreview })}</FilePicker>
}
