import { useEffect, useRef, useState } from 'react'
import { GalaxyBackground, TRIP_ACCENT_COLORS } from './App'
import { Icon, type IconName } from './components/Icon'
import { Button, IconButton } from './components/Button'
import { AddRow } from './components/AddRow'
import { Input, Select, Textarea } from './components/FormControls'
import { InfoRow } from './components/InfoRow'
import { InfoRowList } from './components/InfoRowList'
import { TypographyGroup } from './components/TypographyGroup'
import { TextRow } from './components/TextRow'
import { ItemList } from './components/ItemList'
import { FormControlList, FormControlRow } from './components/FormControlList'
import { Avatar } from './components/Avatar'
import { TextareaList } from './components/TextareaList'
import { FormPanel, FormPanelGroup, FormPanelHeader, FormPanelNote } from './components/FormPanel'
import { ComponentContentPreview } from './ComponentContentPreview'
import { PointCard } from './components/PointCard'
import { PlaceMarker } from './components/PlaceMarker'
import { UpdateNotification } from './components/UpdateNotification'
import { ErrorNotification } from './components/ErrorNotification'
import { SuccessNotification } from './components/SuccessNotification'
import { AuthPanel } from './components/AuthPanel'
import { PLACE_ICON_OPTIONS, placeIconUrl } from './placeIcons'
import './component-library.css'

const icons: IconName[] = ['add-plus', 'arrow-back', 'arrow-down', 'attractions', 'barefoot', 'cached', 'calendar-month', 'cannabis', 'casino', 'checkbox-empty', 'checkbox-filled', 'close', 'content-copy', 'delete-forever', 'docs', 'done-indicator', 'download', 'edit', 'email', 'encrypted', 'face', 'footprint', 'foundation', 'hotel', 'link', 'money-bag', 'pin', 'pin-add', 'pin-home', 'pin-transport', 'plane', 'planet', 'public', 'refresh', 'sailing', 'soup-kitchen', 'ticket', 'time', 'train', 'warning']

const colorGroups = [
  { title: 'Текст', colors: [
    { title: 'Основной текст', token: '--color-text-primary', value: '#FFFFFF', swatch: 'kit-color-swatch-primary' },
    { title: 'Второстепенный текст', token: '--color-text-secondary', value: 'White 60%', swatch: 'kit-color-swatch-secondary' },
    { title: 'Недоступный текст', token: '--color-text-disabled', value: 'White 30%', swatch: 'kit-color-swatch-disabled' },
  ] },
  { title: 'Иконки', colors: [
    { title: 'Основная иконка', token: '--color-icon-primary', value: 'White 100%', swatch: 'kit-color-swatch-icon-primary' },
    { title: 'Второстепенная иконка', token: '--color-icon-secondary', value: 'White 60%', swatch: 'kit-color-swatch-icon-secondary' },
    { title: 'Недоступная иконка', token: '--color-icon-disabled', value: 'White 30%', swatch: 'kit-color-swatch-icon-disabled' },
  ] },
  { title: 'Фоны', colors: [
    { title: 'Основной фон', token: '--color-background-primary', value: '#FFFFFF', swatch: 'kit-background-swatch-primary' },
    { title: 'Второстепенный фон', token: '--color-background-secondary', value: 'White 12%', swatch: 'kit-background-swatch-secondary' },
    { title: 'Затемнённое стекло', token: '--glass-point-card', value: 'Glass + Black 30%', swatch: 'kit-background-swatch-point-card' },
    { title: 'Фон при наведении', token: '--color-background-hover', value: 'White 20%', swatch: 'kit-background-swatch-hover' },
  ] },
  { title: 'Эффекты', colors: [
    { title: 'Эффект стекла', token: '.glass', value: 'Blur 50px + Saturation 115% + Stroke 1px White 12%', swatch: 'kit-effect-swatch-glass' },
  ] },
]

const navigation = [
  { id: 'colors', label: 'Цвета и эффекты' },
  { id: 'typography', label: 'Типографика' },
  { id: 'icons', label: 'Иконки' },
  { id: 'buttons', label: 'Кнопки' },
  { id: 'fields', label: 'Контролы формы' },
  { id: 'visual-elements', label: 'Аватары' },
  { id: 'point-details', label: 'Точки на карте' },
  { id: 'notifications', label: 'Уведомления' },
  { id: 'rows', label: 'Плашки' },
  { id: 'lists', label: 'Списки' },
  { id: 'glass', label: 'Контейнеры' },
]

function Specimen({ name, children, className = '' }: { name: string; children: React.ReactNode; className?: string }) {
  return <article className={`kit-specimen ${className}`.trim()}><header><h3>{name}</h3></header><div className="kit-demo">{children}</div></article>
}

function Variant({ label, wide = false, children }: { label?: React.ReactNode; wide?: boolean; children: React.ReactNode }) {
  return <div className={`kit-variant${wide ? ' kit-variant-wide' : ''}`}>{label && <span className="kit-variant-label">{label}</span>}<div className="kit-variant-example">{children}</div></div>
}

function TypeMetrics({ size, weight, lineHeight, letterSpacing }: { size: number; weight: number; lineHeight: number; letterSpacing: number | string }) {
  return <span className="kit-type-metrics"><span>Size: {size}</span><span>Weight: {weight}</span><span>Linehight: {lineHeight}</span><span>Letter spacing: {letterSpacing}</span></span>
}

function PropertySelect({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: { value: string; label: string; color?: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  return <div className={`kit-property-select${disabled ? ' kit-property-select-disabled' : ''}`} ref={rootRef}><span>{label}</span><div className="kit-property-select-control"><button type="button" aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)}><span className="kit-property-option-label">{selected.color && <i style={{ backgroundColor: selected.color }} aria-hidden="true" />}{selected.label}</span><Icon name="arrow-down" size={16} /></button>{open && <div className="kit-property-select-menu" role="listbox" aria-label={label}>{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false) }}><span className="kit-property-select-check" aria-hidden="true">{option.value === value ? '✓' : ''}</span><span className="kit-property-option-label">{option.color && <i style={{ backgroundColor: option.color }} aria-hidden="true" />}{option.label}</span></button>)}</div>}</div></div>
}

function PropertyToggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <div className={`kit-property-select${disabled ? ' kit-property-select-disabled' : ''}`}><span>{label}</span><label className="kit-property-toggle-control"><span>{checked ? 'On' : 'Off'}</span><span className="kit-toggle"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></span></label></div>
}

function Section({ id, title, description, className = '', children }: { id: string; title: string; description?: string; className?: string; children: React.ReactNode }) {
  return <section id={id} className={`kit-section glass${className ? ` ${className}` : ''}`}><TypographyGroup className="kit-section-title" headingLevel="h2" title={title} text={description ?? ''} /><div className="kit-grid">{children}</div></section>
}

export default function ComponentLibrary() {
  const view = new URLSearchParams(window.location.search).get('view') === 'content' ? 'content' : 'components'
  const [checked, setChecked] = useState(true)
  const [iconSize, setIconSize] = useState<16 | 24 | 32>(24)
  const [iconTone, setIconTone] = useState<'primary' | 'secondary' | 'disabled'>('primary')
  const [buttonIcons, setButtonIcons] = useState(false)
  const [iconButtonIndicator, setIconButtonIndicator] = useState(false)
  const [inputType, setInputType] = useState<'default' | 'money'>('default')
  const [inputLabel, setInputLabel] = useState(true)
  const [inputLeftIcon, setInputLeftIcon] = useState(false)
  const [inputRightIcon, setInputRightIcon] = useState(false)
  const [selectType, setSelectType] = useState<'date' | 'time' | 'assignee'>('date')
  const [selectLabel, setSelectLabel] = useState(true)
  const [infoRowRightContent, setInfoRowRightContent] = useState<'none' | 'text' | 'actions'>('actions')
  const [infoRowTheme, setInfoRowTheme] = useState<'background' | 'transparent'>('background')
  const [infoRowActionCount, setInfoRowActionCount] = useState<1 | 2>(1)
  const [infoRowImage, setInfoRowImage] = useState(false)
  const [infoRowImageShape, setInfoRowImageShape] = useState<'square' | 'circle'>('square')
  const [infoRowActionTheme, setInfoRowActionTheme] = useState<'primary' | 'secondary' | 'transparent'>('transparent')
  const [infoRowHoverEffect, setInfoRowHoverEffect] = useState(false)
  const [infoRowActionIndicators, setInfoRowActionIndicators] = useState(false)
  const [infoRowTitleStyle, setInfoRowTitleStyle] = useState<'head-m' | 'text'>('head-m')
  const [infoRowError, setInfoRowError] = useState(false)
  const [avatarHoverEffect, setAvatarHoverEffect] = useState(false)
  const [pointDetailsActionCount, setPointDetailsActionCount] = useState<1 | 2>(2)
  const [markerColor, setMarkerColor] = useState('#4D4FAB')
  const [markerDimmed, setMarkerDimmed] = useState(false)
  const [markerInteractive, setMarkerInteractive] = useState(true)
  const [textRowIcon, setTextRowIcon] = useState(true)
  const [textRowIconType, setTextRowIconType] = useState<'icon' | 'checkbox'>('icon')
  const [textRowCheckboxState, setTextRowCheckboxState] = useState<'on' | 'off'>('off')
  const [textRowHoverEffect, setTextRowHoverEffect] = useState(false)
  const [formControlListLayout, setFormControlListLayout] = useState<'single' | 'double' | 'mixed'>('mixed')
  const [formControlListHeadline, setFormControlListHeadline] = useState(false)
  const [infoRowListHeadline, setInfoRowListHeadline] = useState(false)
  const [infoRowListText, setInfoRowListText] = useState(false)
  const [itemListHeadline, setItemListHeadline] = useState(false)
  const [textareaListHeadline, setTextareaListHeadline] = useState(false)
  const [authPanelTopButton, setAuthPanelTopButton] = useState(false)
  const [formPanelTopButton, setFormPanelTopButton] = useState(false)
  const [notificationShakeKey, setNotificationShakeKey] = useState(0)
  const [assignees, setAssignees] = useState<string[]>(['torch'])
  const [emptyMoney, setEmptyMoney] = useState(0)
  const [money, setMoney] = useState(3500)
  const inputIcons = {
    icon: inputLeftIcon ? <Icon name="attractions" /> : undefined,
    trailingIcon: inputRightIcon ? <Icon name="content-copy" /> : undefined,
  }
  const infoRowPreview = (title: string, subtitle: string) => infoRowRightContent === 'text'
    ? <InfoRow theme={infoRowTheme} image={infoRowImage ? `${import.meta.env.BASE_URL}assets/autumn-garden.jpg` : undefined} imageAlt="Осенний сад" imageShape={infoRowImageShape} title={title} titleStyle={infoRowTitleStyle} subtitle={subtitle} trailing="54 000 ₽" hoverEffect={infoRowHoverEffect} error={infoRowError ? 'Нужно исправить значение' : undefined} />
    : <InfoRow theme={infoRowTheme} image={infoRowImage ? `${import.meta.env.BASE_URL}assets/autumn-garden.jpg` : undefined} imageAlt="Осенний сад" imageShape={infoRowImageShape} title={title} titleStyle={infoRowTitleStyle} subtitle={subtitle} actionTheme={infoRowActionTheme} hoverEffect={infoRowHoverEffect} showActionIndicators={infoRowActionIndicators} error={infoRowError ? 'Нужно исправить значение' : undefined} actions={infoRowRightContent === 'actions' ? [{ icon: <Icon name="download" />, label: 'Экспортировать', complete: true }, ...(infoRowActionCount === 2 ? [{ icon: <Icon name="delete-forever" />, label: 'Удалить', complete: true }] : [])] : []} />
  const textRowPreview = (label: string, icon: IconName = 'train') => !textRowIcon
    ? <TextRow showIcon={false} hoverEffect={textRowHoverEffect}>{label}</TextRow>
    : textRowIconType === 'icon'
      ? <TextRow iconType="icon" icon={<Icon name={icon} />} hoverEffect={textRowHoverEffect}>{label}</TextRow>
      : <TextRow iconType="checkbox" checkboxState={textRowCheckboxState} hoverEffect={textRowHoverEffect}>{label}</TextRow>
  const selectPreview = (disabled = false, error = false) => selectType === 'date'
    ? <Select type="date" label="Дата" showLabel={selectLabel} icon={<Icon name="calendar-month" />} defaultValue="4 октября" error={error ? 'Выберите дату' : undefined} disabled={disabled}><option>4 октября</option><option>5 октября</option></Select>
    : selectType === 'time'
      ? <Select type="time" label="Время" showLabel={selectLabel} icon={<Icon name="time" />} secondaryText="UTC +3" defaultValue="День" error={error ? 'Выберите время' : undefined} disabled={disabled}><option>Утро</option><option>День</option><option>Вечер</option></Select>
      : <Select type="assignee" showLabel={selectLabel} options={[{ value: 'torch', label: 'Torch' }, { value: 'playsty', label: 'Playsty' }]} value={disabled ? [] : assignees} icon={<Icon name="face" />} emptyLabel="Кто платил" error={error ? 'Выберите участника' : undefined} onValueChange={setAssignees} disabled={disabled} />
  return (
    <main className="component-library">
      <GalaxyBackground />
      <div className="kit-page">
        <aside className="kit-sidebar glass">
          <TypographyGroup className="kit-sidebar-heading" title={<span className="kit-sidebar-brand"><Icon name="planet" size={40} />Travel Space</span>} text={view === 'content' ? 'Наполнение компонентов' : undefined} />
          {view === 'components' && <nav className="kit-navigation" aria-label="Группы компонентов">
            {navigation.map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}
          </nav>}
          {view === 'content' && <nav className="kit-navigation" aria-label="Наполнение компонентов">
            <a href="#content-inputs">Input</a>
            <a href="#content-selects">Select</a>
            <a href="#content-info-rows">Info Row</a>
            <a href="#content-default-images">Изображения</a>
            <a href="#content-field-errors">Ошибки полей</a>
            <a href="#content-info-row-errors">Ошибки Info Row</a>
            <a href="#content-success-notifications">Успешные уведомления</a>
            <a href="#content-error-notifications">Уведомления об ошибках</a>
            <a href="#content-system-errors">Системные ошибки</a>
          </nav>}
          <div className="kit-sidebar-actions">
            <a className="kit-back-link ui-button ui-button-secondary ui-button-m secondary" href={import.meta.env.BASE_URL}>В приложение</a>
          </div>
        </aside>

        <div className="kit-content">
        {view === 'content' ? <ComponentContentPreview /> : <>
        <Section id="colors" title="Цвета и эффекты" description="Семантические токены интерфейса" className="kit-colors-section">
          {colorGroups.map((group) => <div className="kit-color-group" key={group.title}>
            <p className="kit-color-group-label type-text-s">{group.title}</p>
            <div className="kit-color-group-cards">{group.colors.map((color) => <figure className="kit-color-card" key={color.token}>
              <div className="kit-color-preview"><span className={`kit-color-swatch ${color.swatch}`} /></div>
              <figcaption><span className="kit-color-title type-head-m">{color.title}</span><span className="kit-token-details type-text-s"><span>Token: {color.token}</span><span>Value: {color.value}</span></span></figcaption>
            </figure>)}</div>
          </div>)}
        </Section>

        <Section id="typography" title="Типографика" description="Единая шкала текста проекта" className="kit-typography-section">
          <div className="kit-type-group">
            <p className="kit-type-group-label type-text-s">Заголовки</p>
            <div className="kit-type-group-cards">
              <Specimen name="Head L"><Variant label={<TypeMetrics size={32} weight={600} lineHeight={32} letterSpacing="1%" />}><p className="type-head-l kit-type-line">Название поездки</p></Variant></Specimen>
              <Specimen name="Head M"><Variant label={<TypeMetrics size={22} weight={500} lineHeight={22} letterSpacing="2%" />}><p className="type-head-m kit-type-line">Название города</p></Variant></Specimen>
            </div>
          </div>
          <div className="kit-type-group">
            <p className="kit-type-group-label type-text-s">Подзаголовки</p>
            <div className="kit-type-group-cards">
              <Specimen name="Text"><Variant label={<TypeMetrics size={15} weight={400} lineHeight={20} letterSpacing={0} />}><div className="type-text-paragraphs kit-type-line"><p>Первый абзац основного текста</p><p>Второй абзац с отступом 12px</p></div></Variant></Specimen>
              <Specimen name="Text S"><Variant label={<TypeMetrics size={13} weight={400} lineHeight={15.6} letterSpacing={0} />}><p className="type-text-s kit-type-line">Вспомогательный текст</p></Variant></Specimen>
            </div>
          </div>
          <div className="kit-type-group">
            <p className="kit-type-group-label type-text-s">Группы текста</p>
            <div className="kit-type-group-cards">
              <Specimen name="Head L + Text"><Variant label="Gap: 6"><TypographyGroup title="Название поездки" text="4 – 15 октября · 12 дней" /></Variant></Specimen>
              <Specimen name="Head M + Text"><Variant label="Gap: 4"><TypographyGroup variant="head-m-text" headingLevel="h3" title="Осака" text="Прибытие" /></Variant></Specimen>
              <Specimen name="Text + Text"><Variant label="Gap: 2"><TypographyGroup variant="text-text" headingLevel="h3" title="Название города" text="Осака" /></Variant></Specimen>
            </div>
          </div>
        </Section>

        <Section id="icons" title="Иконки" description={`${icons.length} иконок · белый цвет · базовый размер 24px`}>
          <div className="kit-icons-layout">
            <div className="kit-icons">{icons.map((name) => <div className="kit-icon-item" key={name}><span><Icon name={name} size={iconSize} tone={iconTone} /></span><code className="type-text-s">{name}</code></div>)}</div>
            <div className="kit-icons-controls">
              <PropertySelect label="Size" value={String(iconSize)} options={[{ value: '16', label: '16' }, { value: '24', label: '24' }, { value: '32', label: '32' }]} onChange={(value) => setIconSize(Number(value) as 16 | 24 | 32)} />
              <PropertySelect label="Tone" value={iconTone} options={[{ value: 'primary', label: 'Primary' }, { value: 'secondary', label: 'Secondary' }, { value: 'disabled', label: 'Disabled' }]} onChange={(value) => setIconTone(value as 'primary' | 'secondary' | 'disabled')} />
            </div>
          </div>
        </Section>

        <Section id="buttons" title="Кнопки" description="Основные действия и компактные контролы">
          <Specimen name="Button"><div className="kit-button-config-layout"><div className="kit-button-matrix kit-button-matrix-text"><span /><b>L</b><b>M</b><span>Primary · Default</span><Button icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><Button size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><span>Primary · Disabled</span><Button icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button><Button size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button><span>Secondary · Default</span><Button theme="secondary" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><Button theme="secondary" size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><span>Secondary · Disabled</span><Button theme="secondary" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button><Button theme="secondary" size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button><span>Transparent · Default</span><Button theme="transparent" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><Button theme="transparent" size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><span>Transparent · Disabled</span><Button theme="transparent" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button><Button theme="transparent" size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button></div><div className="kit-button-controls"><PropertyToggle label="Icon" checked={buttonIcons} onChange={setButtonIcons} /></div></div></Specimen>
          <Specimen name="Icon button"><div className="kit-button-config-layout"><div className="kit-button-matrix kit-button-matrix-icon"><span /><b>L</b><b>M</b><b>S</b><span>Primary · Default</span><IconButton theme="primary" size="l" icon={<Icon name="add-plus" />} indicator={iconButtonIndicator} aria-label="Primary L" /><IconButton theme="primary" size="m" icon={<Icon name="add-plus" />} indicator={iconButtonIndicator} aria-label="Primary M" /><IconButton theme="primary" size="s" icon={<Icon name="add-plus" size={16} />} indicator={iconButtonIndicator} aria-label="Primary S" /><span>Primary · Disabled</span><IconButton theme="primary" size="l" icon={<Icon name="add-plus" />} aria-label="Primary L disabled" disabled /><IconButton theme="primary" size="m" icon={<Icon name="add-plus" />} aria-label="Primary M disabled" disabled /><IconButton theme="primary" size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Primary S disabled" disabled /><span>Secondary · Default</span><IconButton size="l" icon={<Icon name="add-plus" />} indicator={iconButtonIndicator} aria-label="Secondary L" /><IconButton size="m" icon={<Icon name="add-plus" />} indicator={iconButtonIndicator} aria-label="Secondary M" /><IconButton size="s" icon={<Icon name="add-plus" size={16} />} indicator={iconButtonIndicator} aria-label="Secondary S" /><span>Secondary · Disabled</span><IconButton size="l" icon={<Icon name="add-plus" />} aria-label="Secondary L disabled" disabled /><IconButton size="m" icon={<Icon name="add-plus" />} aria-label="Secondary M disabled" disabled /><IconButton size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Secondary S disabled" disabled /><span>Transparent · Default</span><IconButton theme="transparent" size="l" icon={<Icon name="add-plus" />} indicator={iconButtonIndicator} aria-label="Transparent L" /><IconButton theme="transparent" size="m" icon={<Icon name="add-plus" />} indicator={iconButtonIndicator} aria-label="Transparent M" /><IconButton theme="transparent" size="s" icon={<Icon name="add-plus" size={16} />} indicator={iconButtonIndicator} aria-label="Transparent S" /><span>Transparent · Disabled</span><IconButton theme="transparent" size="l" icon={<Icon name="add-plus" />} aria-label="Transparent L disabled" disabled /><IconButton theme="transparent" size="m" icon={<Icon name="add-plus" />} aria-label="Transparent M disabled" disabled /><IconButton theme="transparent" size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Transparent S disabled" disabled /></div><div className="kit-button-controls"><PropertyToggle label="Indicator" checked={iconButtonIndicator} onChange={setIconButtonIndicator} /></div></div></Specimen>
        </Section>

        <Section id="fields" title="Контролы формы" description="Поля ввода, селекты и многострочные контролы формы" className="kit-fields-section">
          <Specimen name="Input" className="kit-input-specimen">
            <div className="kit-info-row-layout">
              <div className="kit-info-row-controls">
                <PropertySelect label="Type" value={inputType} options={[{ value: 'default', label: 'Default' }, { value: 'money', label: 'Money' }]} onChange={(value) => setInputType(value as 'default' | 'money')} />
                <PropertyToggle label="Label" checked={inputLabel} onChange={setInputLabel} />
                <PropertyToggle label="Left Icon" checked={inputLeftIcon} onChange={setInputLeftIcon} disabled={inputType === 'money'} />
                <PropertyToggle label="Right Icon" checked={inputRightIcon} onChange={setInputRightIcon} disabled={inputType === 'money'} />
              </div>
              <Variant wide>
                {inputType === 'default'
                  ? <div className="kit-input-matrix"><span>Empty</span><Input label="Название города" showLabel={inputLabel} {...inputIcons} placeholder="Например, Осака" /><span>Filled</span><Input label="Название города" showLabel={inputLabel} {...inputIcons} defaultValue="Осака" /><span>Error</span><Input label="Название города" showLabel={inputLabel} {...inputIcons} error="Нужно ввести название города" /><span>Disabled</span><Input label="Название города" showLabel={inputLabel} {...inputIcons} value="Осака" disabled readOnly /></div>
                  : <div className="kit-input-matrix"><span>Empty</span><Input content="money" showLabel={inputLabel} aria-label="Пустая общая сумма" value={emptyMoney} onValueChange={setEmptyMoney} /><span>Filled</span><Input content="money" showLabel={inputLabel} aria-label="Общая сумма" value={money} onValueChange={setMoney} /><span>Disabled</span><Input content="money" showLabel={inputLabel} aria-label="Недоступная общая сумма" value={3500} onValueChange={() => undefined} disabled /></div>}
              </Variant>
            </div>
          </Specimen>
          <Specimen name="Select" className="kit-input-specimen">
            <div className="kit-info-row-layout">
              <div className="kit-info-row-controls"><PropertySelect label="Type" value={selectType} options={[{ value: 'date', label: 'Date' }, { value: 'time', label: 'Time' }, { value: 'assignee', label: 'Assignee' }]} onChange={(value) => setSelectType(value as 'date' | 'time' | 'assignee')} /><PropertyToggle label="Label" checked={selectLabel} onChange={setSelectLabel} /></div>
              <Variant wide><div className="kit-input-matrix"><span>Default</span>{selectPreview()}<span>Error</span>{selectPreview(false, true)}<span>Disabled</span>{selectPreview(true)}</div></Variant>
            </div>
          </Specimen>
          <Specimen name="Textarea" className="kit-input-specimen"><Variant label="Empty" wide><Textarea aria-label="Заметки" placeholder="Места, ориентиры и важная информация" /></Variant><Variant label="Filled" wide><Textarea aria-label="Заполненные заметки" defaultValue="Заселение после 15:00" /></Variant><Variant label="Disabled" wide><Textarea aria-label="Недоступные заметки" value="Заселение после 15:00" disabled readOnly /></Variant></Specimen>
        </Section>

        <Section id="visual-elements" title="Аватары" description="Изображения квадратной и круглой формы">
          <Specimen name="Avatar" className="kit-input-specimen kit-avatar-specimen">
            <div className="kit-info-row-layout">
              <div className="kit-info-row-controls"><PropertyToggle label="Hover Effect" checked={avatarHoverEffect} onChange={setAvatarHoverEffect} /></div>
              <div className="kit-avatar-variants"><Variant label="Square"><Avatar src={`${import.meta.env.BASE_URL}assets/autumn-garden.jpg`} alt="Осенний сад" hoverEffect={avatarHoverEffect} /></Variant><Variant label="Circle"><Avatar src={`${import.meta.env.BASE_URL}assets/autumn-garden.jpg`} alt="Осенний сад" shape="circle" hoverEffect={avatarHoverEffect} /></Variant></div>
            </div>
          </Specimen>
        </Section>

        <Section id="point-details" title="Точки на карте" description="Компоненты просмотра, создания и изменения точек" className="kit-point-details-section">
          <div className="kit-point-details-layout">
            <div className="kit-point-details-examples">
              <Specimen name="Маркер точки" className="kit-point-details-specimen">
                <div className="kit-point-component-layout">
                  <div className="kit-point-details-row kit-point-details-row-single kit-place-marker-row">
                    <div className="kit-point-details-example kit-place-marker-example">
                      <div className="kit-place-marker-groups">
                        <div className="kit-place-marker-group">
                          <p className="kit-type-group-label type-text-s">Системные точки</p>
                          <div className="kit-place-markers">
                            {[{ key: 'hotel' as const, label: 'Жильё' }, { key: 'transport' as const, label: 'Транспорт' }].map((option) => <div className="kit-place-marker-item" key={option.key}>
                              <span><PlaceMarker icon={option.key} dimmed={markerDimmed} interactive={markerInteractive} managed accentColor={markerColor} /><PlaceMarker icon={option.key} dimmed={markerDimmed} interactive={markerInteractive} managed selected accentColor={markerColor} /></span>
                              <code className="type-text-s">{option.label}</code>
                            </div>)}
                          </div>
                        </div>
                        <div className="kit-place-marker-group">
                          <p className="kit-type-group-label type-text-s">Пользовательские точки</p>
                          <div className="kit-place-markers">
                            {PLACE_ICON_OPTIONS.map((option) => <div className="kit-place-marker-item" key={option.key}>
                              <span><PlaceMarker icon={option.key} dimmed={markerDimmed} interactive={markerInteractive} accentColor={markerColor} /><PlaceMarker icon={option.key} dimmed={markerDimmed} interactive={markerInteractive} selected accentColor={markerColor} /></span>
                              <code className="type-text-s">{option.label}</code>
                            </div>)}
                          </div>
                        </div>
                        <div className="kit-place-marker-group">
                          <p className="kit-type-group-label type-text-s">Черновик</p>
                          <div className="kit-place-markers">
                            <div className="kit-place-marker-item">
                              <span><PlaceMarker dimmed={markerDimmed} draft interactive={markerInteractive} accentColor={markerColor} /><PlaceMarker dimmed={markerDimmed} draft interactive={markerInteractive} selected accentColor={markerColor} /></span>
                              <code className="type-text-s">Новая точка</code>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="kit-point-details-controls">
                    <PropertySelect label="Color" value={markerColor} options={TRIP_ACCENT_COLORS.map((color) => ({ value: color, label: color, color }))} onChange={setMarkerColor} />
                    <PropertyToggle label="Muted" checked={markerDimmed} onChange={setMarkerDimmed} />
                    <PropertyToggle label="Interactive" checked={markerInteractive} onChange={setMarkerInteractive} />
                  </div>
                </div>
              </Specimen>
              <Specimen name="Просмотр точки" className="kit-point-details-specimen kit-point-view-specimen">
                <div className="kit-point-component-layout">
                  <div className="kit-point-component-preview">
                <div className="kit-point-details-row">
                <div className="kit-point-details-example">
                <span className="kit-variant-label">Просмотр / Жильё</span>
                <PointCard
                  variant="view"
                  pointType="accommodation"
                  actionCount={pointDetailsActionCount}
                  title="Название точки"
                  rows={[
                    { icon: <Icon name="calendar-month" />, content: '3 – 5 октября · 2 дня · Жильё' },
                    { icon: <Icon name="time" />, content: 'Заселение в\u00a015:00 · Выселение до\u00a010:00' },
                    { icon: <Icon name="pin-home" />, content: 'Адрес в Google Maps' },
                  ]}
                  secondaryAction={{ label: 'Бронь отеля' }}
                  primaryAction={{ label: 'Изменить' }}
                  onClose={() => undefined}
                />
                </div>
                <div className="kit-point-details-example">
                  <span className="kit-variant-label">Просмотр / Транспорт</span>
                  <PointCard
                    variant="view"
                    pointType="transport"
                    actionCount={pointDetailsActionCount}
                    title="Название точки"
                    rows={[
                      { icon: <Icon name="calendar-month" />, content: '3 октября · Транспорт' },
                      { icon: <Icon name="pin-transport" />, content: 'Адрес в Google Maps' },
                    ]}
                    secondaryAction={{ label: 'Билет' }}
                    primaryAction={{ label: 'Изменить' }}
                    onClose={() => undefined}
                  />
                </div>
              </div>
              <div className="kit-point-details-row kit-point-details-row-single">
                <div className="kit-point-details-example">
                  <span className="kit-variant-label">Просмотр / Точка на карте</span>
                  <PointCard variant="view" pointType="place" title="Замок Осака" rows={[{ icon: <Icon name="calendar-month" />, content: '5 октября · Достопримечательность' }, { icon: <Icon name="pin" />, content: 'Адрес в Google Maps' }]} secondaryAction={{ label: 'Удалить' }} primaryAction={{ label: 'Изменить' }} onClose={() => undefined} />
                </div>
              </div>
                  </div>
                  <div className="kit-point-details-controls">
                    <PropertySelect label="Buttons" value={String(pointDetailsActionCount)} options={[{ value: '1', label: '1' }, { value: '2', label: '2' }]} onChange={(value) => setPointDetailsActionCount(Number(value) as 1 | 2)} />
                  </div>
                </div>
              </Specimen>
              <Specimen name="Изменение и создание точки" className="kit-point-details-specimen kit-point-form-specimen">
                <div className="kit-point-details-row">
                <div className="kit-point-details-example">
                  <span className="kit-variant-label">Точка с карты / Изменение</span>
                  <PointCard variant="edit" onSubmit={() => undefined} onDelete={() => undefined} onClose={() => undefined}>
                    <FormControlRow><Input label="Название локации" icon={<Icon name="book" />} aria-label="Название локации" value="Замок Осака" onChange={() => undefined} /></FormControlRow>
                    <FormControlRow><Select type="default" label="Тип локации" icon={<img className="ui-icon" src={placeIconUrl('sightseeing')} width={24} height={24} alt="" />} optionIcons={Object.fromEntries(PLACE_ICON_OPTIONS.map((option) => [option.key, <img className="ui-icon" src={placeIconUrl(option.key)} width={24} height={24} alt="" />]))} aria-label="Тип локации" value="sightseeing" onChange={() => undefined}>{PLACE_ICON_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</Select></FormControlRow>
                    <FormControlRow><Select type="date" label="Когда посещаем" icon={<Icon name="calendar-month" />} aria-label="Когда посещаем" value="2026-10-03" displayValue="3 октября" onChange={() => undefined}><option value="2026-10-03">3 октября</option></Select></FormControlRow>
                    <FormControlRow><Textarea autoResize={false} aria-label="Описание точки" placeholder="Описание точки" value="Главная историческая точка дня" onChange={() => undefined} /></FormControlRow>
                  </PointCard>
                </div>
                <div className="kit-point-details-example">
                  <span className="kit-variant-label">Точка с карты / Создание</span>
                  <PointCard variant="create" onSubmit={() => undefined} onClose={() => undefined}>
                    <FormControlRow><Input label="Название локации" icon={<Icon name="book" />} aria-label="Название локации" /></FormControlRow>
                    <FormControlRow><Select type="default" label="Тип локации" icon={<img className="ui-icon" src={placeIconUrl('sightseeing')} width={24} height={24} alt="" />} optionIcons={Object.fromEntries(PLACE_ICON_OPTIONS.map((option) => [option.key, <img className="ui-icon" src={placeIconUrl(option.key)} width={24} height={24} alt="" />]))} aria-label="Тип локации" value="sightseeing" onChange={() => undefined}>{PLACE_ICON_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</Select></FormControlRow>
                    <FormControlRow><Select type="date" label="Когда посещаем" icon={<Icon name="calendar-month" />} aria-label="Когда посещаем" value="unscheduled" onChange={() => undefined}><option value="unscheduled">Без даты</option><option value="2026-10-03">3 октября</option></Select></FormControlRow>
                    <FormControlRow><Textarea autoResize={false} aria-label="Описание точки" placeholder="Описание точки" /></FormControlRow>
                  </PointCard>
                </div>
                </div>
              </Specimen>
            </div>
          </div>
        </Section>

        <Section id="notifications" title="Уведомления" description="Системные сообщения поверх текущего экрана" className="kit-notifications-section">
          <Specimen name="Update notification">
            <div className="kit-notification-layout">
              <div className="kit-notification-preview">
                <UpdateNotification key={notificationShakeKey} message="Максим · Отель · Токио" shake={Boolean(notificationShakeKey)} onRefresh={() => undefined} />
              </div>
              <div className="kit-notification-controls">
                <Button size="m" theme="secondary" onClick={() => setNotificationShakeKey((value) => value + 1)}>Анимация</Button>
              </div>
            </div>
          </Specimen>
          <Specimen name="Error notification">
            <div className="kit-notification-layout">
              <div className="kit-notification-preview">
                <ErrorNotification title="Эх, не сохраняется" message="Попробуйте ещё раз" onClose={() => undefined} onRetry={() => undefined} />
              </div>
            </div>
          </Specimen>
          <Specimen name="Success notification">
            <div className="kit-notification-layout">
              <div className="kit-notification-preview">
                <SuccessNotification onClose={() => undefined} />
              </div>
            </div>
          </Specimen>
        </Section>

        <Section id="lists" title="Списки" description="Группы однотипных элементов" className="kit-lists-section">
          <Specimen name="Form control list" className="kit-form-control-list-specimen">
            <div className="kit-info-row-layout">
              <div className="kit-info-row-controls">
                <PropertySelect label="Layout" value={formControlListLayout} options={[{ value: 'single', label: '1 Column' }, { value: 'double', label: '2 Columns' }, { value: 'mixed', label: 'Mixed' }]} onChange={(value) => setFormControlListLayout(value as 'single' | 'double' | 'mixed')} />
                <PropertyToggle label="Headline" checked={formControlListHeadline} onChange={setFormControlListHeadline} />
              </div>
              <Variant wide>
                <FormControlList headline={formControlListHeadline ? 'Оплата' : undefined}>
                  <FormControlRow columns={formControlListLayout === 'single' ? 1 : 2}>
                    <Input label="Отъезд" icon={<Icon name="calendar-month" />} defaultValue="3 октября · Сб" />
                    {formControlListLayout !== 'single' && <Input label="Прибытие" icon={<Icon name="calendar-month" />} defaultValue="4 октября · Вс" />}
                  </FormControlRow>
                  <FormControlRow columns={formControlListLayout === 'single' ? 1 : 2}>
                    <Input showLabel={false} aria-label="Место отправления" icon={<Icon name="attractions" />} defaultValue="Шереметьево (SVO)" />
                    {formControlListLayout !== 'single' && <Input showLabel={false} aria-label="Место прибытия" icon={<Icon name="attractions" />} defaultValue="Kansai (KIX)" />}
                  </FormControlRow>
                  <FormControlRow columns={formControlListLayout === 'double' ? 2 : 1}>
                    <Input showLabel={false} aria-label="Ссылка Google Maps" icon={<Icon name="link" />} defaultValue="https://maps.app.goo.gl/example" trailingIcon={<Icon name="content-copy" />} />
                    {formControlListLayout === 'double' && <Input showLabel={false} aria-label="Номер рейса" icon={<Icon name="book" />} defaultValue="MU-248, MU-515" />}
                  </FormControlRow>
                </FormControlList>
              </Variant>
            </div>
          </Specimen>
          <Specimen name="Textarea list" className="kit-form-control-list-specimen">
            <div className="kit-info-row-layout">
              <div className="kit-info-row-controls"><PropertyToggle label="Headline" checked={textareaListHeadline} onChange={setTextareaListHeadline} /></div>
              <Variant wide><TextareaList headline={textareaListHeadline ? 'Что стоит помнить' : undefined}><Textarea aria-label="Заметка 1" placeholder="Места и ориентиры" /><Textarea aria-label="Заметка 2" placeholder="Важная информация" /><Textarea aria-label="Заметка 3" placeholder="Дополнительные детали" /></TextareaList></Variant>
            </div>
          </Specimen>
          <Specimen name="Item list" className="kit-item-list-specimen kit-configurable-list-specimen">
            <div className="kit-info-row-layout">
              <div className="kit-info-row-controls"><PropertyToggle label="Headline" checked={itemListHeadline} onChange={setItemListHeadline} /></div>
              <div className="kit-item-list-examples">
                <Variant label="Icons · Gap 10">
                  <ItemList headline={itemListHeadline ? 'Маршрут' : undefined}><TextRow iconType="icon" icon={<Icon name="train" />}>Киото</TextRow><TextRow iconType="icon" icon={<Icon name="rocket-launch" />}>Киото – Токио</TextRow><TextRow iconType="icon" icon={<Icon name="train" />}>Токио</TextRow></ItemList>
                </Variant>
                <Variant label="Checkboxes · Gap 10">
                  <ItemList headline={itemListHeadline ? 'Готовность' : undefined}><button className="kit-check-row" onClick={() => setChecked(!checked)}><TextRow iconType="checkbox" checkboxState={checked ? 'on' : 'off'}>Отель</TextRow></button><button className="kit-check-row" onClick={() => setChecked(!checked)}><TextRow iconType="checkbox" checkboxState="off">Билеты</TextRow></button><button className="kit-check-row" onClick={() => setChecked(!checked)}><TextRow iconType="checkbox" checkboxState={checked ? 'on' : 'off'}>Маршрут</TextRow></button></ItemList>
                </Variant>
              </div>
            </div>
          </Specimen>
          <Specimen name="Info row list" className="kit-info-row-list-specimen kit-configurable-list-specimen">
            <div className="kit-info-row-layout">
              <div className="kit-info-row-controls"><PropertyToggle label="Headline" checked={infoRowListHeadline} onChange={setInfoRowListHeadline} /><PropertyToggle label="Text" checked={infoRowListText} onChange={setInfoRowListText} /></div>
              <div className="kit-info-row-list-examples">
                <Variant label="Color · Gap 8">
                  <InfoRowList headline={infoRowListHeadline ? 'Маршрут' : undefined} text={infoRowListText ? 'Три города' : undefined}>
                    <InfoRow title="Осака" subtitle="4–7 окт · 2,5 дня" image={`${import.meta.env.BASE_URL}assets/autumn-garden.jpg`} imageAlt="Осака" />
                    <InfoRow title="Нара" subtitle="7 окт · 1 день" image={`${import.meta.env.BASE_URL}assets/autumn-garden.jpg`} imageAlt="Нара" />
                    <InfoRow title="Киото" subtitle="7–10 окт · 2 дня" image={`${import.meta.env.BASE_URL}assets/autumn-garden.jpg`} imageAlt="Киото" />
                  </InfoRowList>
                </Variant>
                <Variant label="Transparent · Gap 4">
                  <InfoRowList rowTheme="transparent" headline={infoRowListHeadline ? 'Маршрут' : undefined} text={infoRowListText ? 'Три города' : undefined}>
                    <InfoRow theme="transparent" title="Осака" subtitle="4–7 окт · 2,5 дня" image={`${import.meta.env.BASE_URL}assets/autumn-garden.jpg`} imageAlt="Осака" />
                    <InfoRow theme="transparent" title="Нара" subtitle="7 окт · 1 день" image={`${import.meta.env.BASE_URL}assets/autumn-garden.jpg`} imageAlt="Нара" />
                    <InfoRow theme="transparent" title="Киото" subtitle="7–10 окт · 2 дня" image={`${import.meta.env.BASE_URL}assets/autumn-garden.jpg`} imageAlt="Киото" />
                  </InfoRowList>
                </Variant>
              </div>
            </div>
          </Specimen>
        </Section>

        <Section id="rows" title="Плашки" description="Отдельные карточки и строки интерфейса" className="kit-lists-section">
          <Specimen name="Text row">
            <div className="kit-info-row-layout">
              <div className="kit-info-row-controls">
                <PropertyToggle label="Icon" checked={textRowIcon} onChange={setTextRowIcon} />
                <PropertySelect label="Icon Type" value={textRowIconType} options={[{ value: 'icon', label: 'Icon' }, { value: 'checkbox', label: 'Checkbox' }]} onChange={(value) => setTextRowIconType(value as 'icon' | 'checkbox')} disabled={!textRowIcon} />
                <PropertyToggle label="Checkbox State" checked={textRowCheckboxState === 'on'} onChange={(checked) => setTextRowCheckboxState(checked ? 'on' : 'off')} disabled={!textRowIcon || textRowIconType !== 'checkbox'} />
                <PropertyToggle label="Hover Effect" checked={textRowHoverEffect} onChange={setTextRowHoverEffect} />
              </div>
              <Variant label="Single" wide>
                <div className="kit-info-row-previews">
                  {textRowPreview('Аэропорт Кансай')}
                  <div className="kit-info-row-list-preview">
                    <span className="kit-variant-label">List</span>
                    <ItemList>
                      {textRowPreview('Киото')}
                      {textRowPreview('Киото – Токио', 'rocket-launch')}
                      {textRowPreview('Токио')}
                    </ItemList>
                  </div>
                </div>
              </Variant>
            </div>
          </Specimen>
          <Specimen name="Info row">
            <div className="kit-info-row-layout">
              <div className="kit-info-row-controls">
                <PropertySelect label="Theme" value={infoRowTheme} options={[{ value: 'background', label: 'Color' }, { value: 'transparent', label: 'Transperent' }]} onChange={(value) => setInfoRowTheme(value as 'background' | 'transparent')} />
                <PropertySelect label="Title" value={infoRowTheme === 'background' ? 'text' : infoRowTitleStyle} options={[{ value: 'head-m', label: 'Head M' }, { value: 'text', label: 'Text' }]} onChange={(value) => setInfoRowTitleStyle(value as 'head-m' | 'text')} disabled={infoRowTheme === 'background'} />
                <PropertyToggle label="Hover Effect" checked={infoRowHoverEffect} onChange={setInfoRowHoverEffect} />
                <PropertyToggle label="Image" checked={infoRowImage} onChange={setInfoRowImage} />
                <PropertySelect label="Image Type" value={infoRowImageShape} options={[{ value: 'square', label: 'Square' }, { value: 'circle', label: 'Circle' }]} onChange={(value) => setInfoRowImageShape(value as 'square' | 'circle')} disabled={!infoRowImage} />
                <PropertySelect label="Right Part" value={infoRowRightContent} options={[{ value: 'none', label: 'Empty' }, { value: 'text', label: 'Text' }, { value: 'actions', label: 'Button' }]} onChange={(value) => setInfoRowRightContent(value as 'none' | 'text' | 'actions')} />
                <PropertySelect label="Buttons Count" value={String(infoRowActionCount)} options={[{ value: '1', label: '1 Button' }, { value: '2', label: '2 Buttons' }]} onChange={(value) => setInfoRowActionCount(Number(value) as 1 | 2)} disabled={infoRowRightContent !== 'actions'} />
                <PropertySelect label="Buttons Type" value={infoRowActionTheme} options={[{ value: 'primary', label: 'Primary' }, { value: 'secondary', label: 'Secondary' }, { value: 'transparent', label: 'Transparent' }]} onChange={(value) => setInfoRowActionTheme(value as 'primary' | 'secondary' | 'transparent')} disabled={infoRowRightContent !== 'actions'} />
                <PropertyToggle label="Action Indicators" checked={infoRowActionIndicators} onChange={setInfoRowActionIndicators} disabled={infoRowRightContent !== 'actions' || infoRowActionTheme !== 'secondary'} />
                <PropertyToggle label="Error" checked={infoRowError} onChange={setInfoRowError} />
              </div>
              <Variant label="Single" wide>
                <div className="kit-info-row-previews">
                  {infoRowPreview('Аниме Тур', 'Владелец · 4–15 октября')}
                  <div className="kit-info-row-list-preview">
                    <span className="kit-variant-label">List</span>
                    <InfoRowList rowTheme={infoRowTheme}>
                      {infoRowPreview('Осака', '4–7 окт · 2,5 дня')}
                      {infoRowPreview('Нара', '7 окт · 1 день')}
                      {infoRowPreview('Киото', '7–10 окт · 2 дня')}
                    </InfoRowList>
                  </div>
                </div>
              </Variant>
            </div>
          </Specimen>
          <Specimen name="Add row"><Variant label="Default" wide><AddRow icon={<Icon name="add-plus" />} aria-label="Добавить" /></Variant><Variant label="Disabled" wide><AddRow icon={<Icon name="add-plus" />} aria-label="Добавить" disabled /></Variant></Specimen>
        </Section>

        <Section id="glass" title="Контейнеры" description="Основные уровни вложенности" className="kit-containers-section">
          <Specimen name="Auth panel">
            <div className="kit-info-row-layout">
            <div className="kit-info-row-controls"><PropertyToggle label="Top Button" checked={authPanelTopButton} onChange={setAuthPanelTopButton} /></div>
            <Variant label={<>Width: 500<br />Padding: 48<br />Gap: 32</>} wide>
              <div className="kit-auth-panel-preview">
                <AuthPanel action={authPanelTopButton ? <IconButton icon={<Icon name="close" />} aria-label="Закрыть" /> : undefined}>
                  <h1>Добро пожаловать</h1>
                  <FormControlList>
                    <FormControlRow><Input icon={<Icon name="email" />} placeholder="Email" /></FormControlRow>
                    <FormControlRow><Input icon={<Icon name="encrypted" />} type="password" placeholder="Пароль — минимум 8 символов" /></FormControlRow>
                  </FormControlList>
                  <Button>Войти</Button>
                  <Button size="m" theme="transparent">Нет аккаунта? Зарегистрироваться</Button>
                </AuthPanel>
              </div>
            </Variant>
            </div>
          </Specimen>
          <Specimen name="Form panel">
            <div className="kit-info-row-layout">
            <div className="kit-info-row-controls"><PropertyToggle label="Top Button" checked={formPanelTopButton} onChange={setFormPanelTopButton} /></div>
            <Variant label={<>Width: 680<br />Padding: 48<br />Group gap: 32</>} wide>
              <FormPanel>
                <FormPanelGroup>
                  <FormPanelHeader title="Дом – Осака" text="✈️ В пути 14 ч 30 мин" action={formPanelTopButton ? <IconButton icon={<Icon name="close" />} aria-label="Закрыть" /> : undefined} />
                  <FormControlList>
                    <FormControlRow columns={2}><Input label="Уедем" icon={<Icon name="calendar-month" />} defaultValue="3 октября · Сб" /><Input label="Приедем" icon={<Icon name="calendar-month" />} defaultValue="4 октября · Вс" /></FormControlRow>
                    <FormControlRow columns={2}><Input label="Место отъезда" icon={<Icon name="public" />} defaultValue="Домодедово" /><Input label="Место приезда" icon={<Icon name="public" />} defaultValue="Аэропорт Кансай" /></FormControlRow>
                  </FormControlList>
                </FormPanelGroup>
                <FormPanelGroup gap={24}>
                  <FormControlList headline="Как поедем"><FormControlRow columns={2}><Input label="Тип транспорта" icon={<Icon name="plane" />} defaultValue="Самолёт" /><Input label="Номер рейса" icon={<Icon name="book" />} /></FormControlRow></FormControlList>
                  <FormPanelGroup gap={8}>
                    <InfoRow image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title="билет.svg" subtitle="Playsty · 20 сентября в 08:15" actionTheme="secondary" actions={[{ icon: <Icon name="download" />, label: 'Скачать билет' }, { icon: <Icon name="delete-forever" />, label: 'Удалить билет' }]} />
                    <TextRow iconType="checkbox" checkboxState="off">Билет купить на месте</TextRow>
                  </FormPanelGroup>
                </FormPanelGroup>
                <FormPanelGroup>
                  <TextareaList headline="Что стоит помнить"><Textarea aria-label="Заметки в примере панели" placeholder="Места, ориентиры и важная информация" /></TextareaList>
                </FormPanelGroup>
                <FormPanelGroup>
                  <FormControlList headline="Оплата"><FormControlRow columns={2}><Select type="assignee" options={[{ value: 'torch', label: 'Torch' }, { value: 'playsty', label: 'Playsty' }]} value={['torch', 'playsty']} icon={<Icon name="face" />} emptyLabel="Кто платил" onValueChange={() => undefined} /><Input content="money" aria-label="Общая сумма" value={3500} onValueChange={() => undefined} /></FormControlRow></FormControlList>
                </FormPanelGroup>
                <FormPanelNote centered>P.S. Галочка в меню появится после заполнения дат, времени, названий локаций и прикрепления билета</FormPanelNote>
              </FormPanel>
            </Variant>
            </div>
          </Specimen>
          <Specimen name="Divider"><Variant label="Default" wide><div className="divider" /></Variant></Specimen>
        </Section>

        </>}

        </div>
      </div>
    </main>
  )
}
