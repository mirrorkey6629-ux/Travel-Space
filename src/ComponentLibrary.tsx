import { Fragment, useState } from 'react'
import { GalaxyBackground } from './App'
import { Icon, type IconName } from './components/Icon'
import { Button, IconButton } from './components/Button'
import { AddRow } from './components/AddRow'
import { Input, Select } from './components/FormControls'
import { InfoRow } from './components/InfoRow'
import { TypographyGroup } from './components/TypographyGroup'
import { Tabs } from './components/Tabs'
import { SecondaryText } from './components/SecondaryText'
import { CityRow } from './components/CityRow'
import { IconText } from './components/IconText'
import { ItemList } from './components/ItemList'
import './component-library.css'

const icons: IconName[] = ['add-plus', 'arrow-back', 'attractions', 'barefoot', 'calendar-month', 'casino', 'check-small', 'close', 'content-copy', 'delete-forever', 'docs', 'download', 'edit', 'email', 'encrypted', 'face', 'footprint', 'hotel', 'link', 'money-bag', 'pin', 'pin-add', 'pin-home', 'plane', 'planet', 'refresh', 'sailing', 'ticket', 'time', 'train']

const navigation = [
  { id: 'colors', label: 'Цвета' },
  { id: 'typography', label: 'Типографика' },
  { id: 'icons', label: 'Иконки' },
  { id: 'typography-groups', label: 'Группы текста' },
  { id: 'buttons', label: 'Кнопки' },
  { id: 'fields', label: 'Поля и селекты' },
  { id: 'lists', label: 'Списки и плашки' },
  { id: 'states', label: 'Чекбоксы и состояния' },
  { id: 'glass', label: 'Контейнеры' },
]

function Specimen({ name, children, className = '' }: { name: string; children: React.ReactNode; className?: string }) {
  return <article className={`kit-specimen ${className}`.trim()}><header><h3>{name}</h3></header><div className="kit-demo">{children}</div></article>
}

function Variant({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={`kit-variant${wide ? ' kit-variant-wide' : ''}`}><span className="kit-variant-label">{label}</span><div className="kit-variant-example">{children}</div></div>
}

function Section({ id, title, description, className = '', children }: { id: string; title: string; description?: string; className?: string; children: React.ReactNode }) {
  return <section id={id} className={`kit-section glass${className ? ` ${className}` : ''}`}><TypographyGroup className="kit-section-title" headingLevel="h2" title={title} text={description ?? ''} /><div className="kit-grid">{children}</div></section>
}

export default function ComponentLibrary() {
  const [checked, setChecked] = useState(true)
  const [activeTab, setActiveTab] = useState('plane')
  const [buttonIcons, setButtonIcons] = useState(false)
  const [inputLabel, setInputLabel] = useState(true)
  const [inputLeftIcon, setInputLeftIcon] = useState(false)
  const [inputRightIcon, setInputRightIcon] = useState(false)
  const [infoRowFirstAction, setInfoRowFirstAction] = useState(true)
  const [infoRowSecondAction, setInfoRowSecondAction] = useState(false)
  const [infoRowImage, setInfoRowImage] = useState(false)
  const [infoRowImageShape, setInfoRowImageShape] = useState<'square' | 'circle'>('square')
  const [infoRowActionTheme, setInfoRowActionTheme] = useState<'transparent' | 'secondary'>('transparent')
  const [cityRowImage, setCityRowImage] = useState(false)
  const inputIcons = {
    icon: inputLeftIcon ? <Icon name="attractions" /> : undefined,
    trailingIcon: inputRightIcon ? <Icon name="content-copy" /> : undefined,
  }
  return (
    <main className="component-library">
      <GalaxyBackground />
      <div className="kit-page">
        <aside className="kit-sidebar glass">
          <TypographyGroup className="kit-sidebar-heading" title={<span className="kit-sidebar-brand"><Icon name="planet" size={40} />Travel Space</span>} />
          <nav className="kit-navigation" aria-label="Группы компонентов">
            {navigation.map((item) => <Fragment key={item.id}><a href={`#${item.id}`}>{item.label}</a>{item.id === 'icons' && <span className="kit-navigation-divider" aria-hidden="true" />}</Fragment>)}
          </nav>
          <a className="kit-back-link ui-button ui-button-secondary ui-button-m secondary" href={import.meta.env.BASE_URL}>В приложение</a>
        </aside>

        <div className="kit-content">
        <Section id="colors" title="Цвета" description="Семантические цвета текста и фонов компонентов" className="kit-colors-section">
          <Specimen name="Основной текст"><Variant label="#FFFFFF"><div className="kit-color-token"><span className="kit-color-swatch kit-color-swatch-primary" /><div><strong>Primary</strong><p>Заголовки, введённый текст и выбранные значения</p><code>--color-text-primary</code></div></div></Variant></Specimen>
          <Specimen name="Второстепенный текст"><Variant label="White · 60%"><div className="kit-color-token"><span className="kit-color-swatch kit-color-swatch-secondary" /><div><strong>Secondary</strong><p>Обычный текст, подписи и пояснения</p><code>--color-text-secondary</code></div></div></Variant></Specimen>
          <Specimen name="Основной фон"><Variant label="#FFFFFF"><div className="kit-color-token"><span className="kit-color-swatch kit-background-swatch-primary" /><div><strong>Primary background</strong><p>Основные кнопки и акцентные действия</p><code>--color-background-primary</code></div></div></Variant></Specimen>
          <Specimen name="Второстепенный фон"><Variant label="White · 12%"><div className="kit-color-token"><span className="kit-color-swatch kit-background-swatch-secondary" /><div><strong>Secondary background</strong><p>Второстепенные кнопки, поля и вложенные плашки</p><code>--color-background-secondary</code></div></div></Variant></Specimen>
          <Specimen name="Стеклянный фон"><Variant label="White · 16%"><div className="kit-color-token"><span className="kit-color-swatch kit-background-swatch-glass" /><div><strong>Glass background</strong><p>Основные стеклянные панели и контейнеры</p><code>--color-background-glass</code></div></div></Variant></Specimen>
        </Section>

        <Section id="typography" title="Типографика" description="Единая шкала текста проекта" className="kit-typography-section">
          <Specimen name="Head L"><Variant label="32px · Medium"><p className="type-head-l kit-type-line">Название поездки</p></Variant></Specimen>
          <Specimen name="Head M"><Variant label="20px · Medium"><p className="type-head-m kit-type-line">Название города</p></Variant></Specimen>
          <Specimen name="Text"><Variant label="15px · Regular · Абзацы 12px"><div className="type-text-paragraphs kit-type-line"><p>Первый абзац основного текста</p><p>Второй абзац с отступом 12px</p></div></Variant></Specimen>
          <Specimen name="Text S"><Variant label="13px · Regular"><p className="type-text-s kit-type-line">Вспомогательный текст</p></Variant></Specimen>
          <Specimen name="Secondary text"><Variant label="Default"><SecondaryText>Вторичный текст</SecondaryText></Variant><Variant label="Interactive"><button className="kit-secondary-text-demo"><SecondaryText interactive>Наведи на текст</SecondaryText></button></Variant></Specimen>
        </Section>

        <Section id="icons" title="Иконки" description={`${icons.length} иконок · белый цвет · базовый размер 24px`}>
          <div className="kit-icons">{icons.map((name) => <div className="kit-icon-item" key={name}><span><Icon name={name} /></span><code>{name}</code></div>)}</div>
        </Section>

        <Section id="typography-groups" title="Группы текста" description="Готовые сочетания заголовков и поясняющего текста" className="kit-typography-groups-section">
          <Specimen name="Head L + Text"><Variant label="Gap 8"><TypographyGroup title="Название поездки" text="4–15 октября · 12 дней" /></Variant></Specimen>
          <Specimen name="Head M + Text"><Variant label="Gap 4"><TypographyGroup variant="head-m-text" headingLevel="h3" title="Осака" text="Прибытие" /></Variant></Specimen>
          <Specimen name="Icon + Text"><Variant label="Icon"><IconText icon={<Icon name="train" />}>Аэропорт Кансай</IconText></Variant><Variant label="Checkbox · Empty"><button className="kit-check-row" onClick={() => setChecked(!checked)}><IconText checked={false}>Не прикреплено</IconText></button></Variant><Variant label="Checkbox · Checked"><button className="kit-check-row" onClick={() => setChecked(!checked)}><IconText checked={checked}>Прикреплено</IconText></button></Variant></Specimen>
        </Section>

        <Section id="buttons" title="Кнопки" description="Основные действия и компактные контролы">
          <Specimen name="Button"><div className="kit-button-showcase"><label className="kit-toggle"><span>Иконка</span><input type="checkbox" checked={buttonIcons} onChange={(event) => setButtonIcons(event.target.checked)} /><i aria-hidden="true" /></label><div className="kit-button-matrix kit-button-matrix-text"><span /><b>L</b><b>M</b><span>Primary · Default</span><Button icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><Button size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><span>Primary · Disabled</span><Button icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button><Button size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button><span>Secondary · Default</span><Button theme="secondary" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><Button theme="secondary" size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><span>Secondary · Disabled</span><Button theme="secondary" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button><Button theme="secondary" size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button></div></div></Specimen>
          <Specimen name="Icon button"><div className="kit-button-matrix kit-button-matrix-icon"><span /><b>L</b><b>M</b><b>S</b><span>Primary · Default</span><IconButton theme="primary" size="l" icon={<Icon name="add-plus" />} aria-label="Primary L" /><IconButton theme="primary" size="m" icon={<Icon name="add-plus" />} aria-label="Primary M" /><IconButton theme="primary" size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Primary S" /><span>Primary · Disabled</span><IconButton theme="primary" size="l" icon={<Icon name="add-plus" />} aria-label="Primary L disabled" disabled /><IconButton theme="primary" size="m" icon={<Icon name="add-plus" />} aria-label="Primary M disabled" disabled /><IconButton theme="primary" size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Primary S disabled" disabled /><span>Secondary · Default</span><IconButton size="l" icon={<Icon name="add-plus" />} aria-label="Secondary L" /><IconButton size="m" icon={<Icon name="add-plus" />} aria-label="Secondary M" /><IconButton size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Secondary S" /><span>Secondary · Disabled</span><IconButton size="l" icon={<Icon name="add-plus" />} aria-label="Secondary L disabled" disabled /><IconButton size="m" icon={<Icon name="add-plus" />} aria-label="Secondary M disabled" disabled /><IconButton size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Secondary S disabled" disabled /><span>Transparent · Default</span><IconButton theme="transparent" size="l" icon={<Icon name="add-plus" />} aria-label="Transparent L" /><IconButton theme="transparent" size="m" icon={<Icon name="add-plus" />} aria-label="Transparent M" /><IconButton theme="transparent" size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Transparent S" /><span>Transparent · Disabled</span><IconButton theme="transparent" size="l" icon={<Icon name="add-plus" />} aria-label="Transparent L disabled" disabled /><IconButton theme="transparent" size="m" icon={<Icon name="add-plus" />} aria-label="Transparent M disabled" disabled /><IconButton theme="transparent" size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Transparent S disabled" disabled /></div></Specimen>
          <Specimen name="Add row"><Variant label="Default" wide><AddRow icon={<Icon name="add-plus" />} aria-label="Добавить" /></Variant><Variant label="Disabled" wide><AddRow icon={<Icon name="add-plus" />} aria-label="Добавить" disabled /></Variant></Specimen>
          <Specimen name="Tabs"><Variant label="4 варианта" wide><Tabs value={activeTab} ariaLabel="Тип перемещения" options={[{ value: 'train', label: 'Поезд' }, { value: 'plane', label: 'Самолёт' }, { value: 'bus', label: 'Автобус' }, { value: 'ship', label: 'Корабль' }]} onChange={setActiveTab} /></Variant></Specimen>
        </Section>

        <Section id="fields" title="Поля и селекты" description="Высота 60px, скругление 16px" className="kit-fields-section">
          <Specimen name="Input" className="kit-input-specimen"><div className="kit-control-toggles"><label className="kit-toggle"><span>Подпись</span><input type="checkbox" checked={inputLabel} onChange={(event) => setInputLabel(event.target.checked)} /><i aria-hidden="true" /></label><label className="kit-toggle"><span>Иконка слева</span><input type="checkbox" checked={inputLeftIcon} onChange={(event) => setInputLeftIcon(event.target.checked)} /><i aria-hidden="true" /></label><label className="kit-toggle"><span>Иконка справа</span><input type="checkbox" checked={inputRightIcon} onChange={(event) => setInputRightIcon(event.target.checked)} /><i aria-hidden="true" /></label></div><div className="kit-input-matrix"><span /><b>Обычная</b><b>Акцентная</b><span>Empty</span><Input label="Город" showLabel={inputLabel} {...inputIcons} placeholder="Название города" /><Input theme="accent" label="Город" showLabel={inputLabel} {...inputIcons} placeholder="Название города" /><span>Filled</span><Input label="Город" showLabel={inputLabel} {...inputIcons} defaultValue="Осака" /><Input theme="accent" label="Город" showLabel={inputLabel} {...inputIcons} defaultValue="Осака" /><span>Disabled</span><Input label="Город" showLabel={inputLabel} {...inputIcons} value="Осака" disabled readOnly /><Input theme="accent" label="Город" showLabel={inputLabel} {...inputIcons} value="Осака" disabled readOnly /></div></Specimen>
          <Specimen name="Select" className="kit-input-specimen"><Variant label="Date"><Select content="date" icon={<Icon name="calendar-month" />} defaultValue="4 октября"><option>4 октября</option><option>5 октября</option></Select></Variant><Variant label="Date · Disabled"><Select content="date" icon={<Icon name="calendar-month" />} disabled><option>4 октября</option></Select></Variant><Variant label="List"><Select content="list" icon={<Icon name="time" />} defaultValue="День"><option>Утро</option><option>День</option><option>Вечер</option></Select></Variant><Variant label="List · Disabled"><Select content="list" icon={<Icon name="time" />} disabled><option>День</option></Select></Variant></Specimen>
        </Section>

        <Section id="lists" title="Списки и плашки" description="Карточки основного интерфейса" className="kit-lists-section">
          <Specimen name="Item list"><Variant label="Gap 10" wide><ItemList><IconText icon={<Icon name="train" />}>Киото</IconText><IconText icon={<Icon name="rocket-launch" />}>Киото – Токио</IconText><IconText icon={<Icon name="train" />}>Токио</IconText></ItemList></Variant></Specimen>
          <Specimen name="City row"><div className="kit-city-row-controls"><label className="kit-toggle"><span>Картинка</span><input type="checkbox" checked={cityRowImage} onChange={(event) => setCityRowImage(event.target.checked)} /><i aria-hidden="true" /></label></div><Variant label="Default" wide><CityRow city="Осака" dates="4–6 окт" duration="1,5 дня" image={cityRowImage ? `${import.meta.env.BASE_URL}assets/autumn-garden.jpg` : undefined} imageAlt="Осенний сад" /></Variant><Variant label="Selected" wide><CityRow className="kit-selected" city="📌 Киото" dates="7–10 окт" duration="2,5 дня" image={cityRowImage ? `${import.meta.env.BASE_URL}assets/autumn-garden.jpg` : undefined} imageAlt="Осенний сад" /></Variant></Specimen>
          <Specimen name="Info row">
            <div className="kit-info-row-controls">
              <label className="kit-toggle"><span>Кнопка 1</span><input type="checkbox" checked={infoRowFirstAction} onChange={(event) => setInfoRowFirstAction(event.target.checked)} /><i aria-hidden="true" /></label>
              <label className="kit-toggle"><span>Кнопка 2</span><input type="checkbox" checked={infoRowSecondAction} onChange={(event) => setInfoRowSecondAction(event.target.checked)} /><i aria-hidden="true" /></label>
              <label className="kit-toggle"><span>Картинка</span><input type="checkbox" checked={infoRowImage} onChange={(event) => setInfoRowImage(event.target.checked)} /><i aria-hidden="true" /></label>
              <label className="kit-property-select"><span>Тип картинки</span><select value={infoRowImageShape} onChange={(event) => setInfoRowImageShape(event.target.value as 'square' | 'circle')}><option value="square">Квадратная</option><option value="circle">Круглая</option></select></label>
              <label className="kit-property-select"><span>Тип кнопок</span><select value={infoRowActionTheme} onChange={(event) => setInfoRowActionTheme(event.target.value as 'transparent' | 'secondary')}><option value="transparent">Transparent</option><option value="secondary">Secondary</option></select></label>
            </div>
            <Variant label={`${Number(infoRowFirstAction) + Number(infoRowSecondAction)} ${Number(infoRowFirstAction) + Number(infoRowSecondAction) === 1 ? 'кнопка' : 'кнопок'} · ${infoRowActionTheme === 'transparent' ? 'Transparent' : 'Secondary'}`} wide>
              <InfoRow image={infoRowImage ? `${import.meta.env.BASE_URL}assets/autumn-garden.jpg` : undefined} imageAlt="Осенний сад" imageShape={infoRowImageShape} title="Аниме Тур" subtitle="Владелец · 4–15 октября" actionTheme={infoRowActionTheme} actions={[...(infoRowFirstAction ? [{ icon: <Icon name="download" />, label: 'Экспортировать' }] : []), ...(infoRowSecondAction ? [{ icon: <Icon name="delete-forever" />, label: 'Удалить' }] : [])]} />
            </Variant>
          </Specimen>
        </Section>

        <Section id="states" title="Чекбоксы и состояния" className="kit-states-section">
          <Specimen name="Status text"><Variant label="Default"><span>Основной текст</span></Variant><Variant label="Muted"><span className="kit-muted">Вспомогательный текст</span></Variant><Variant label="Error"><span className="app-error kit-inline-error">Текст ошибки</span></Variant></Specimen>
        </Section>

        <Section id="glass" title="Контейнеры" description="Основные уровни вложенности" className="kit-containers-section">
          <Specimen name="Main glass"><Variant label="Default" wide><div className="glass kit-glass-card"><h3>Основная карточка</h3><p>Blur 50px, основной стеклянный фон</p></div></Variant></Specimen>
          <Specimen name="Soft glass"><Variant label="Default" wide><div className="kit-soft-card"><h3>Вложенная плашка</h3><p>Используется внутри карточек</p></div></Variant></Specimen>
          <Specimen name="Divider"><Variant label="Default" wide><div className="divider" /></Variant></Specimen>
        </Section>

        </div>
      </div>
    </main>
  )
}
